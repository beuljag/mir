import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '서버'))
from fastapi.testclient import TestClient
from app.main import create_app
from app.local_connection import env_settings, load_api_keys
from app.runtime_config import bind_config, database_path
from app.directline_chat import settings as chat_settings

KEY = 'local-unit-test-key-not-production-0000'


class RuntimeTests(unittest.TestCase):
    def test_local_and_cloud_bind(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(bind_config(), ('127.0.0.1', 8000))
        with patch.dict(os.environ, {'MIR_DEPLOYMENT':'railway','PORT':'18191'}, clear=True):
            self.assertEqual(bind_config(), ('0.0.0.0', 18191))
        for host in ('127.0.0.1','localhost','::','legacy-host.example','0.0.0.0',''):
            with self.subTest(host=host), patch.dict(os.environ, {'MIR_DEPLOYMENT':'railway','HOST':host,'PORT':'18191'}, clear=True):
                self.assertEqual(bind_config(), ('0.0.0.0', 18191))
        with patch.dict(os.environ, {'HOST':'localhost','PORT':'18192'}, clear=True):
            self.assertEqual(bind_config(), ('localhost', 18192))

    def test_invalid_port_names_variable(self):
        with patch.dict(os.environ, {'PORT':'invalid'}, clear=True):
            with self.assertRaisesRegex(RuntimeError, 'PORT'):
                bind_config()

    def test_cloud_ignores_local_secret_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'config').mkdir()
            (root/'.env').write_text('CIRCUIT_API_KEY='+KEY+'\nCOPILOT_DIRECT_LINE_SECRET='+KEY,encoding='utf-8')
            (root/'config/local-api-keys.json').write_text('{"'+KEY+'":"local-user"}',encoding='utf-8')
            with patch.dict(os.environ, {'MIR_DEPLOYMENT':'railway'}, clear=True):
                self.assertNotIn('CIRCUIT_API_KEY',env_settings(root))
                self.assertEqual(load_api_keys(root),({},''))
                self.assertFalse(chat_settings(root/'.env')['configured'])
            with patch.dict(os.environ, {}, clear=True):
                self.assertIn(KEY,load_api_keys(root)[0])
                self.assertTrue(chat_settings(root/'.env')['configured'])

    def test_volume_required_and_outside_paths_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            with patch.dict(os.environ, {'MIR_DEPLOYMENT':'railway'},clear=True):
                with self.assertRaisesRegex(RuntimeError,'CIRCUIT_DB_PATH'):database_path(root)
            env={'MIR_DEPLOYMENT':'railway','CIRCUIT_DB_PATH':str(root/'db.sqlite')}
            with patch.dict(os.environ,env,clear=True):
                with self.assertRaisesRegex(RuntimeError,'RAILWAY_VOLUME_MOUNT_PATH'):database_path(root)
            env.update(RAILWAY_VOLUME_MOUNT_PATH=str(root),CIRCUIT_DB_PATH=str(root.parent/'outside.sqlite'))
            with patch.dict(os.environ,env,clear=True):
                with self.assertRaisesRegex(RuntimeError,'CIRCUIT_DB_PATH'):database_path(root)

    def test_auth_cors_mcp_and_database_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            db=Path(folder)/'circuits.db'
            env={'MIR_DEPLOYMENT':'railway','CIRCUIT_API_KEY':KEY,'CIRCUIT_DB_PATH':str(db),'RAILWAY_VOLUME_MOUNT_PATH':folder,'RAILWAY_PUBLIC_DOMAIN':'server.example','MIR_CORS_ORIGINS':'https://web.example'}
            with patch.dict(os.environ,env,clear=True):
                app=create_app()
                with TestClient(app,base_url='https://server.example') as client:
                    self.assertEqual(client.get('/health').status_code,200)
                    self.assertEqual(client.get('/components/search').status_code,401)
                    self.assertEqual(client.get('/components/search',headers={'X-API-Key':'wrong'}).status_code,401)
                    headers={'X-API-Key':KEY}
                    parts=client.get('/components/search',headers=headers);self.assertEqual(parts.status_code,200)
                    self.assertEqual(client.get('/local-connection/status',headers=headers).status_code,404)
                    cors={'Origin':'https://web.example','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'x-api-key'}
                    self.assertEqual(client.options('/components/search',headers=cors).status_code,200)
                    cors['Origin']='https://other.example';self.assertEqual(client.options('/components/search',headers=cors).status_code,400)
                    draft={'name':'restart test','component_instances':[{'instance_id':'U1','component_definition_id':parts.json()[0]['id']}],'nets':[]}
                    saved=client.post('/circuits',headers=headers,json=draft);self.assertEqual(saved.status_code,201);cid=saved.json()['id']
                    self.assertEqual(client.post('/mcp',json={}).status_code,401)
                    mcp=client.post('/mcp',headers={**headers,'Accept':'application/json, text/event-stream'},json={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-03-26','capabilities':{},'clientInfo':{'name':'local-check','version':'1'}}})
                    self.assertEqual(mcp.status_code,200)
                    config=client.get('/chat/config',headers=headers);self.assertEqual(config.status_code,200);self.assertFalse(config.json()['configured'])
                with TestClient(create_app(),base_url='https://server.example') as client:
                    reread=client.get('/circuits/'+cid,headers={'X-API-Key':KEY});self.assertEqual(reread.status_code,200);self.assertEqual(reread.json()['name'],'restart test')

    def test_real_uvicorn_uses_host_port_and_recovers_database(self):
        with tempfile.TemporaryDirectory() as folder:
            probe=socket.socket();probe.bind(('127.0.0.1',0));port=probe.getsockname()[1];probe.close()
            env={**os.environ,'MIR_DEPLOYMENT':'railway','HOST':'127.0.0.1','PORT':str(port),'CIRCUIT_API_KEY':KEY,'CIRCUIT_DB_PATH':str(Path(folder)/'circuits.db'),'RAILWAY_VOLUME_MOUNT_PATH':folder,'RAILWAY_PUBLIC_DOMAIN':'server.example','MIR_CORS_ORIGINS':'https://web.example'}
            process=subprocess.Popen([sys.executable,'run.py'],cwd=ROOT/'서버',env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            try:
                for _ in range(120):
                    if process.poll() is not None:self.fail('Uvicorn exited before health check')
                    try:
                        with urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/health',timeout=.5) as response:
                            self.assertEqual(response.status,200);break
                    except OSError:time.sleep(.1)
                else:self.fail('Uvicorn health timeout')
                self.assertTrue((Path(folder)/'circuits.db').exists())
            finally:
                process.terminate();process.wait(timeout=10)


if __name__ == '__main__':unittest.main()
