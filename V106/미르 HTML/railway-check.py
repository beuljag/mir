import os,sys,tempfile,faulthandler
from pathlib import Path
faulthandler.dump_traceback_later(15)
os.environ.update(MIR_DEPLOYMENT='railway', CIRCUIT_API_KEY='a'*32, MIR_CORS_ORIGINS='https://web.example', RAILWAY_PUBLIC_DOMAIN='server.example')
sys.path.insert(0,str(Path('서버').resolve()))
from fastapi.testclient import TestClient
from app.main import create_app
with tempfile.TemporaryDirectory() as tmp:
 os.environ['CIRCUIT_DB_PATH']=str(Path(tmp)/'data.db')
 print('create app',flush=True)
 with TestClient(create_app(),base_url='https://server.example') as c:
  print('health',flush=True); assert c.get('/health').status_code==200
  print('auth',flush=True); assert c.get('/components/search').status_code==401; assert c.get('/components/search',headers={'X-API-Key':'a'*32}).status_code==200
  print('local',flush=True); assert c.get('/local-connection/status',headers={'X-API-Key':'a'*32}).status_code==404
  print('cors',flush=True); h={'origin':'https://web.example','access-control-request-method':'GET','access-control-request-headers':'x-api-key'}; assert c.options('/components/search',headers=h).status_code==200; h['origin']='https://evil.example'; assert c.options('/components/search',headers=h).status_code==400
  print('mcp',flush=True); assert c.post('/mcp',json={}).status_code==401
  r=c.post('/mcp',headers={'X-API-Key':'a'*32,'accept':'application/json, text/event-stream'},json={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-03-26','capabilities':{},'clientInfo':{'name':'test','version':'1'}}}); assert r.status_code==200,(r.status_code,r.text)
 assert Path(os.environ['CIRCUIT_DB_PATH']).is_file()
 with TestClient(create_app(),base_url='https://server.example') as c: assert c.get('/components/search',headers={'X-API-Key':'a'*32}).status_code==200
print('PASS')
