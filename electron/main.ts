import { app, BrowserWindow, ipcMain, shell } from 'electron'
import * as path from 'path'
import { registerExportHandlers } from './ipc/export.handler'
import { setupAutoUpdater } from './autoUpdater'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Force Vietnamese locale for date pickers and system UI
app.commandLine.appendSwitch('lang', 'vi')

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: true,
    titleBarStyle: 'default',
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false, // Ngăn Electron tạm dừng app khi ở background
    },
    backgroundColor: '#0f1117',
    show: false,
    autoHideMenuBar: true,
  })
  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Setup Auto Updater
  if (!isDev) {
    const setupAutoUpdaterAsync = async () => {
      try {
        const module = await import('./autoUpdater')
        module.setupAutoUpdater(mainWindow!)
      } catch (err) {
        console.warn('Auto updater not available:', err)
      }
    }
    // Setup after window is created
    setTimeout(setupAutoUpdaterAsync, 2000)
  }

  // Register Export IPC handlers
  registerExportHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const allowedOrigins = ['http://localhost:5173']
    const { origin } = new URL(url)
    if (!allowedOrigins.includes(origin) && !isDev) {
      event.preventDefault()
    }
  })
})
