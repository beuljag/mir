const {app,BrowserWindow,ipcMain,dialog,shell}=require('electron');
const path=require('node:path');
const net=require('node:net');
let win,server,origin;
app.setName('미르 V106');
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 app.whenReady().then(async()=>{
  const probe=net.createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  process.env.MIR_DEPLOYMENT='';process.env.HOST='127.0.0.1';process.env.PORT=String(port);
  const root=app.isPackaged?path.join(process.resourcesPath,'web'):path.join(__dirname,'web');
  server=require(path.join(root,'serve.cjs')).createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin='http://127.0.0.1:'+port;
  win=new BrowserWindow({width:1440,height:960,minWidth:360,minHeight:560,title:'미르 V106',icon:path.join(__dirname,'icon.ico'),show:process.env.MIR_EXE_TEST!=='1',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const trusted=event=>event.sender===win?.webContents&&event.senderFrame?.url.startsWith(origin+'/');
  ipcMain.on('mir:close-confirmed',event=>{if(trusted(event))win.destroy();});
  ipcMain.on('mir:titlebar', (event,colors)=>{if(trusted(event)&&/^#[0-9a-f]{6}$/i.test(colors?.color||''))win.setBackgroundColor(colors.color);});
  win.webContents.on('will-prevent-unload',()=>win.webContents.send('mir:confirm-close'));
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/'))event.preventDefault();});
  win.webContents.setWindowOpenHandler(({url})=>{
   if(url.startsWith(origin+'/'))return {action:'allow',overrideBrowserWindowOptions:{autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}}};
   if(/^https:\/\//i.test(url))void shell.openExternal(url);
   return {action:'deny'};
  });
  await win.loadURL(origin+'/');
 }).catch(()=>{dialog.showErrorBox('미르 V106','제작대를 시작할 수 없어요. 앱을 종료한 뒤 다시 실행해 주세요.');app.quit();});
 app.on('window-all-closed',()=>{server?.close();app.quit();});
 app.on('before-quit',()=>server?.close());
}
