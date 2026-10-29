const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  sendToAgent: (text, catalog) => ipcRenderer.invoke('agent:send', { text, catalog }),
  resetAgent: () => ipcRenderer.invoke('agent:reset'),
  testAgent: () => ipcRenderer.invoke('agent:test'),
  openAgentWebsite: (url) => ipcRenderer.invoke('agent:openWebsite', url),
  listParts: () => ipcRenderer.invoke('parts:list'),
  importParts: () => ipcRenderer.invoke('parts:import'),
  savePart: (p) => ipcRenderer.invoke('parts:save', p),
  openPartsFolder: () => ipcRenderer.invoke('parts:openFolder'),
  savePartTemplate: () => ipcRenderer.invoke('parts:template'),
  saveProject: (d) => ipcRenderer.invoke('project:save', d),
  openProject: () => ipcRenderer.invoke('project:open'),
  openDoc: (name) => ipcRenderer.invoke('docs:open', name),
  getAppIcon: () => ipcRenderer.invoke('app:icon'),
  requestCircuit: (path, options) => ipcRenderer.invoke('circuit:request', { path, options }),
  getAutoAuthStatus: () => ipcRenderer.invoke('circuit:autoStatus')
});
