import { contextBridge, ipcRenderer } from 'electron'

// Expose safe APIs to renderer via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Checklist
  checklist: {
    getByDate: (date: string) => ipcRenderer.invoke('checklist:getByDate', date),
    getAll: (filters?: object) => ipcRenderer.invoke('checklist:getAll', filters),
    create: (data: object) => ipcRenderer.invoke('checklist:create', data),
    update: (id: string, data: object) => ipcRenderer.invoke('checklist:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('checklist:delete', id),
    duplicateFromDate: (fromDate: string, toDate: string) =>
      ipcRenderer.invoke('checklist:duplicateFromDate', fromDate, toDate),
    generateFromTemplates: (date: string) =>
      ipcRenderer.invoke('checklist:generateFromTemplates', date),
    getStats: (params: object) => ipcRenderer.invoke('checklist:getStats', params),
    updateStatus: (id: string, status: string, notes?: string) =>
      ipcRenderer.invoke('checklist:updateStatus', id, status, notes),
  },

  // Categories
  category: {
    getAll: () => ipcRenderer.invoke('category:getAll'),
    create: (data: object) => ipcRenderer.invoke('category:create', data),
    update: (id: string, data: object) => ipcRenderer.invoke('category:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('category:delete', id),
  },

  // Users
  user: {
    getAll: () => ipcRenderer.invoke('user:getAll'),
    create: (data: object) => ipcRenderer.invoke('user:create', data),
    update: (id: string, data: object) => ipcRenderer.invoke('user:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('user:delete', id),
    login: (name: string, password: string) => ipcRenderer.invoke('user:login', name, password),
    updatePassword: (id: string, oldPwd: string, newPwd: string) =>
      ipcRenderer.invoke('user:updatePassword', id, oldPwd, newPwd),
  },

  // Templates
  template: {
    getAll: () => ipcRenderer.invoke('template:getAll'),
    create: (data: object) => ipcRenderer.invoke('template:create', data),
    update: (id: string, data: object) => ipcRenderer.invoke('template:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('template:delete', id),
    reorder: (ids: string[]) => ipcRenderer.invoke('template:reorder', ids),
  },

  // Google Sheets Sync
  sync: {
    getConfig: () => ipcRenderer.invoke('sync:getConfig'),
    saveConfig: (data: object) => ipcRenderer.invoke('sync:saveConfig', data),
    push: () => ipcRenderer.invoke('sync:push'),
    pull: () => ipcRenderer.invoke('sync:pull'),
    getLogs: () => ipcRenderer.invoke('sync:getLogs'),
    testConnection: () => ipcRenderer.invoke('sync:testConnection'),
    exportConfig: () => ipcRenderer.invoke('sync:exportConfig'),
    importConfig: () => ipcRenderer.invoke('sync:importConfig'),
    getAuthUrl: () => ipcRenderer.invoke('sync:getAuthUrl'),
    exchangeCode: (code: string) => ipcRenderer.invoke('sync:exchangeCode', code),
  },

  // Export
  export: {
    toExcel: (data: object) => ipcRenderer.invoke('export:toExcel', data),
    toPdf: (data: object) => ipcRenderer.invoke('export:toPdf', data),
  },

  // App settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },

  // Event listeners from main
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = ['sync:status', 'sync:progress', 'notification', 'update:available', 'update:downloaded', 'update:progress', 'update:error']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
      // Return unsubscribe function
      return () => ipcRenderer.off(channel, callback)
    }
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.off(channel, callback)
  },

  // Auto Update
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
  },

  // App version
  app: {
    version: () => ipcRenderer.invoke('app:version'),
  },
})
