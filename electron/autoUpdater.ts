import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  // Configure autoUpdater
  autoUpdater.autoDownload = false // Disable auto download, let user trigger it
  autoUpdater.allowPrerelease = false
  autoUpdater.logger = console

  // Check for updates every hour
  autoUpdater.checkForUpdatesAndNotify()
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 60 * 60 * 1000)

  // Update available
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
    mainWindow.webContents.send('update:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    })
  })

  // Update downloaded and ready to install
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version)
    mainWindow.webContents.send('update:downloaded')
  })

  // Update progress
  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update:progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  // Error
  autoUpdater.on('error', (err) => {
    console.error('Updater error:', err)
    mainWindow.webContents.send('update:error', err.message)
  })

  // IPC handlers for update actions
  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      console.log('Check result:', result)
      return result
    } catch (err) {
      console.error('Check error:', err)
      throw err
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      console.error('Download error:', err)
      throw err
    }
  })

  ipcMain.handle('update:install', async () => {
    try {
      autoUpdater.quitAndInstall()
    } catch (err) {
      console.error('Install error:', err)
      throw err
    }
  })

  ipcMain.handle('app:version', async () => {
    return autoUpdater.currentVersion.version
  })
}
