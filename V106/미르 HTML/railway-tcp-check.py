import os, subprocess, time, urllib.request, urllib.error, json, tempfile, sys
from pathlib import Path
root=Path.cwd(); env=os.environ.copy(); key='a'*32
with tempfile.TemporaryDirectory() as tmp:
 env.update(MIR_DEPLOYMENT='railway',HOST='127.0.0.1',PORT='18981',CIRCUIT_API_KEY=key,CIRCUIT_DB_PATH=str(Path(tmp)/'db.sqlite'),MIR_CORS_ORIGINS='https://web.example',RAILWAY_PUBLIC_DOMAIN='server.example')
 py=subprocess.Popen([sys.executable,'run.py'],cwd=root/'서버',env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 webenv=env|{'PORT':'18982','MIR_WEB_ORIGIN':'https://web.example','MIR_BACKEND_URL':'https://server.example'}
 node=subprocess.Popen(['node','serve.cjs'],cwd=root,env=webenv,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 def req(port,path='/',headers=None,data=None):
  try:
   with urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{port}'+path,headers=headers or {},data=data),timeout=2) as r: return r.status, r.read()
  except urllib.error.HTTPError as e: return e.code,e.read()
 try:
  for port,path in [(18981,'/health'),(18982,'/')]:
   for _ in range(60):
    try:
     assert req(port,path)[0]==200; break
    except (OSError,AssertionError): time.sleep(.2)
   else: raise RuntimeError(f'server {port} did not start')
  assert req(18981,'/components/search')[0]==401
  assert req(18981,'/components/search',{'X-API-Key':key})[0]==200
  assert req(18982,'/api/parts')[0]==200
  payload=json.dumps({'mode':'local','route':'/components/search?limit=100','method':'GET'}).encode()
  assert req(18982,'/api/mir',{'Origin':'https://web.example','Content-Type':'application/json'},payload)[0]==400
  assert req(18982,'/api/mir',{'Origin':'https://evil.example','Content-Type':'application/json'},payload)[0]==403
  payload=json.dumps({'mode':'remote','url':'https://evil.example','route':'/components/search?limit=100','method':'GET'}).encode()
  assert req(18982,'/api/mir',{'Origin':'https://web.example','Content-Type':'application/json','X-API-Key':key},payload)[0]==400
  print('Real TCP backend and web startup; authentication and proxy restrictions: PASS')
 finally:
  for p in (py,node): p.terminate(); p.wait(timeout=10)
