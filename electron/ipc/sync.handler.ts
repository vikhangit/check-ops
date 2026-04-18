import { ipcMain, BrowserWindow, shell, dialog, app } from 'electron'
import { getDb } from '../database/db'
import { GoogleSheetsService } from '../services/GoogleSheetsService'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'

let sheetsService: GoogleSheetsService | null = null

function getService(): GoogleSheetsService {
  if (!sheetsService) {
    sheetsService = new GoogleSheetsService()
  }
  return sheetsService
}

export function registerSyncHandlers() {
  ipcMain.handle('sync:getConfig', () => {
    const db = getDb()
    const config = db.prepare('SELECT * FROM sync_config WHERE id = ?').get('default') as Record<string, unknown> | null
    if (config) {
      // Don't expose raw credentials
      delete config.credentials_json
      delete config.token_json
    }
    return config
  })

  ipcMain.handle('sync:saveConfig', (_event, data: { spreadsheet_id?: string; credentials_json?: string; auto_sync_enabled?: boolean; sync_interval_minutes?: number }) => {
    const db = getDb()

    if (data.credentials_json) {
      // Validate JSON
      try {
        JSON.parse(data.credentials_json)
      } catch {
        return { success: false, message: 'Credentials JSON không hợp lệ' }
      }
    }

    db.prepare(
      `INSERT INTO sync_config (id, spreadsheet_id, credentials_json, auto_sync_enabled, sync_interval_minutes)
       VALUES ('default', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         spreadsheet_id = excluded.spreadsheet_id,
         credentials_json = COALESCE(excluded.credentials_json, credentials_json),
         auto_sync_enabled = excluded.auto_sync_enabled,
         sync_interval_minutes = excluded.sync_interval_minutes`
    ).run(
      data.spreadsheet_id || null,
      data.credentials_json || null,
      data.auto_sync_enabled ? 1 : 0,
      data.sync_interval_minutes || 30
    )

    // Reinit service with new credentials
    sheetsService = new GoogleSheetsService()

    return { success: true }
  })

  ipcMain.handle('sync:getAuthUrl', async () => {
    try {
      const service = getService()
      const url = await service.getAuthUrl()
      return { success: true, url }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  })

  ipcMain.handle('sync:exchangeCode', async (_event, code: string) => {
    try {
      const service = getService()
      await service.exchangeCode(code)
      return { success: true }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  })

  ipcMain.handle('sync:testConnection', async () => {
    try {
      const service = getService()
      const ok = await service.testConnection()
      return { success: ok }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  })

  ipcMain.handle('sync:push', async (_event) => {
    const db = getDb()
    const logId = uuidv4()
    const win = BrowserWindow.getAllWindows()[0]

    try {
      db.prepare("UPDATE sync_config SET sync_status = 'syncing' WHERE id = 'default'").run()
      win?.webContents.send('sync:status', 'syncing')

      const service = getService()
      const itemsSynced = await service.push()

      const now = new Date().toISOString()
      db.prepare(
        `UPDATE sync_config SET sync_status = 'idle', last_sync_at = ? WHERE id = 'default'`
      ).run(now)

      db.prepare(
        `INSERT INTO sync_logs (id, sync_at, direction, status, items_synced)
         VALUES (?, ?, 'push', 'success', ?)`
      ).run(logId, now, itemsSynced)

      win?.webContents.send('sync:status', 'idle')
      return { success: true, itemsSynced }
    } catch (error) {
      const now = new Date().toISOString()
      db.prepare("UPDATE sync_config SET sync_status = 'error' WHERE id = 'default'").run()
      db.prepare(
        `INSERT INTO sync_logs (id, sync_at, direction, status, error_message)
         VALUES (?, ?, 'push', 'error', ?)`
      ).run(logId, now, String(error))

      win?.webContents.send('sync:status', 'error')
      return { success: false, message: String(error) }
    }
  })

  ipcMain.handle('sync:pull', async () => {
    const db = getDb()
    const logId = uuidv4()
    const win = BrowserWindow.getAllWindows()[0]

    try {
      db.prepare("UPDATE sync_config SET sync_status = 'syncing' WHERE id = 'default'").run()
      win?.webContents.send('sync:status', 'syncing')

      const service = getService()
      const itemsSynced = await service.pull()

      const now = new Date().toISOString()
      db.prepare(
        `UPDATE sync_config SET sync_status = 'idle', last_sync_at = ? WHERE id = 'default'`
      ).run(now)

      db.prepare(
        `INSERT INTO sync_logs (id, sync_at, direction, status, items_synced)
         VALUES (?, ?, 'pull', 'success', ?)`
      ).run(logId, now, itemsSynced)

      win?.webContents.send('sync:status', 'idle')
      return { success: true, itemsSynced }
    } catch (error) {
      const now = new Date().toISOString()
      db.prepare("UPDATE sync_config SET sync_status = 'error' WHERE id = 'default'").run()
      db.prepare(
        `INSERT INTO sync_logs (id, sync_at, direction, status, error_message)
         VALUES (?, ?, 'pull', 'error', ?)`
      ).run(logId, now, String(error))

      win?.webContents.send('sync:status', 'error')
      return { success: false, message: String(error) }
    }
  })

  ipcMain.handle('sync:getLogs', () => {
    const db = getDb()
    return db
      .prepare('SELECT * FROM sync_logs ORDER BY sync_at DESC LIMIT 50')
      .all()
  })

  // Settings
  ipcMain.handle('settings:get', (_event, key: string) => {
    const db = getDb()
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | null
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    const db = getDb()
    db.prepare(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, value)
    return { success: true }
  })

  ipcMain.handle('settings:getAll', () => {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM app_settings').all() as Array<{ key: string; value: string }>
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  })

  // Export/Import Connection Config
  ipcMain.handle('sync:exportConfig', async () => {
    const win = BrowserWindow.getAllWindows()[0]
    const db = getDb()
    const config = db.prepare('SELECT spreadsheet_id, credentials_json FROM sync_config WHERE id = ?').get('default') as any

    if (!config?.spreadsheet_id || !config?.credentials_json) {
      return { success: false, message: 'Vui lòng hoàn tất cấu hình (ID và JSON) trước khi xuất!' }
    }

    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Xuất Cấu Hình Kết Nối',
      defaultPath: path.join(app.getPath('downloads'), 'checklist_connection_config.json'),
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    })

    if (filePath) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
        return { success: true }
      } catch (err) {
        return { success: false, message: String(err) }
      }
    }
    return { success: false, message: 'Đã huỷ xuất file' }
  })

  ipcMain.handle('sync:importConfig', async () => {
    const win = BrowserWindow.getAllWindows()[0]
    const db = getDb()

    const { filePaths } = await dialog.showOpenDialog(win, {
      title: 'Nhập Cấu Hình Kết Nối',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'],
    })

    if (filePaths && filePaths.length > 0) {
      try {
        const content = fs.readFileSync(filePaths[0], 'utf-8')
        const config = JSON.parse(content)

        if (!config.spreadsheet_id || !config.credentials_json) {
          throw new Error('File cấu hình không đúng định dạng (Thiếu ID hoặc JSON)')
        }

        db.prepare(
          `UPDATE sync_config SET spreadsheet_id = ?, credentials_json = ? WHERE id = 'default'`
        ).run(config.spreadsheet_id, config.credentials_json)

        // Reinit service
        sheetsService = new GoogleSheetsService()

        return { success: true }
      } catch (err) {
        return { success: false, message: String(err) }
      }
    }
    return { success: false, message: 'Đã huỷ nhập file' }
  })
}
