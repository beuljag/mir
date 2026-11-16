const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('mirDesktop',{
 onConfirmClose:callback=>ipcRenderer.on('mir:confirm-close',()=>callback()),
 closeConfirmed:()=>ipcRenderer.send('mir:close-confirmed'),
 setTitlebarColors:colors=>ipcRenderer.send('mir:titlebar',colors)
});
