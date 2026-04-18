import { google, sheets_v4 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { getDb } from '../database/db'
import { ChecklistRepository } from '../database/repositories/ChecklistRepository'

export class GoogleSheetsService {
  private oauth2Client: OAuth2Client | null = null
  private sheets: sheets_v4.Sheets | null = null

  private async initClient(): Promise<boolean> {
    const db = getDb()
    const config = db.prepare('SELECT * FROM sync_config WHERE id = ?').get('default') as {
      credentials_json?: string
      token_json?: string
      spreadsheet_id?: string
    } | null

    if (!config?.credentials_json) return false

    try {
      const credentials = JSON.parse(config.credentials_json)

      if (credentials.type === 'service_account') {
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
          ],
        })
        this.sheets = google.sheets({ version: 'v4', auth })
        return true
      }

      const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web

      this.oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

      if (config.token_json) {
        const token = JSON.parse(config.token_json)
        this.oauth2Client.setCredentials(token)

        // Auto-refresh token if needed
        this.oauth2Client.on('tokens', (tokens) => {
          if (tokens.refresh_token) {
            const db2 = getDb()
            const existing = JSON.parse(config.token_json || '{}')
            db2
              .prepare("UPDATE sync_config SET token_json = ? WHERE id = 'default'")
              .run(JSON.stringify({ ...existing, ...tokens }))
          }
        })
      }

      this.sheets = google.sheets({ version: 'v4', auth: this.oauth2Client })
      return true
    } catch (error) {
      console.error('[Sheets] Init client error:', error)
      return false
    }
  }

  async getAuthUrl(): Promise<string> {
    await this.initClient()
    
    const db = getDb()
    const config = db.prepare('SELECT credentials_json FROM sync_config WHERE id = ?').get('default') as { credentials_json?: string } | null
    if (config?.credentials_json && JSON.parse(config.credentials_json).type === 'service_account') {
      throw new Error('Bạn đang dùng Service Account. Không cần xác thực qua trình duyệt! Bạn có thể lưu cấu hình và test kết nối luôn.')
    }
    if (!this.oauth2Client) throw new Error('Chưa cấu hình Google credentials')

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
      prompt: 'consent',
    })
  }

  async exchangeCode(code: string): Promise<void> {
    if (!this.oauth2Client) await this.initClient()
    if (!this.oauth2Client) throw new Error('Chưa cấu hình Google credentials')

    const { tokens } = await this.oauth2Client.getToken(code)
    this.oauth2Client.setCredentials(tokens)

    const db = getDb()
    db.prepare("UPDATE sync_config SET token_json = ? WHERE id = 'default'").run(
      JSON.stringify(tokens)
    )
  }

  async testConnection(): Promise<boolean> {
    const ok = await this.initClient()
    if (!ok || !this.sheets) return false

    const db = getDb()
    const config = db.prepare('SELECT spreadsheet_id FROM sync_config WHERE id = ?').get('default') as { spreadsheet_id?: string } | null
    if (!config?.spreadsheet_id) return false

    try {
      await this.sheets.spreadsheets.get({ spreadsheetId: config.spreadsheet_id })
      return true
    } catch {
      return false
    }
  }

  async push(): Promise<number> {
    const ok = await this.initClient()
    if (!ok || !this.sheets) throw new Error('Không thể kết nối Google Sheets')

    const db = getDb()
    const config = db.prepare('SELECT spreadsheet_id FROM sync_config WHERE id = ?').get('default') as { spreadsheet_id?: string } | null
    if (!config?.spreadsheet_id) throw new Error('Chưa cấu hình Spreadsheet ID')

    const repo = new ChecklistRepository()
    // Push last 30 days
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const dateTo = new Date().toISOString().split('T')[0]
    const items = repo.getAllForSync(dateFrom, dateTo)

    // Group by date → each date is a separate sheet
    const byDate = items.reduce((acc, item) => {
      if (!acc[item.date]) acc[item.date] = []
      acc[item.date].push(item)
      return acc
    }, {} as Record<string, typeof items>)

    let totalSynced = 0

    for (const [date, dateItems] of Object.entries(byDate)) {
      const sheetTitle = `Checklist_${date}`

      // Get or create sheet
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: config.spreadsheet_id,
      })

      let sheetId: number | undefined
      const existingSheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === sheetTitle
      )

      if (!existingSheet) {
        const addResp = await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: config.spreadsheet_id,
          requestBody: {
            requests: [{ addSheet: { properties: { title: sheetTitle } } }],
          },
        })
        sheetId = addResp.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined
      } else {
        sheetId = existingSheet.properties?.sheetId ?? undefined
      }

      // Write headers + data
      const headers = ['ID', 'Tiêu Đề', 'Mô Tả', 'Danh Mục', 'Người Phụ Trách', 'Trạng Thái', 'Thời Gian Check', 'Ưu Tiên', 'Ghi Chú', 'Cập Nhật Lúc', 'Mục Con']
      const rows = [
        headers,
        ...dateItems.map((item) => [
          item.id,
          item.title,
          item.description || '',
          item.category_id || '',
          item.assigned_user_id || '',
          item.status,
          item.check_time || '',
          item.priority,
          item.notes || '',
          item.updated_at,
          item.sub_items ? JSON.stringify(item.sub_items) : '[]',
        ]),
      ]

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.spreadsheet_id,
        range: `${sheetTitle}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: rows },
      })

      totalSynced += dateItems.length
    }

    // Push Metadata (Users, Categories)
    try {
      // Users
      const users = db.prepare('SELECT * FROM users').all() as any[]
      await this.syncTableSheet(config.spreadsheet_id, '_Users',
        ['ID', 'Tên', 'Email', 'Vai Trò', 'Mật Khẩu', 'Trạng Thái', 'Tạo Lúc'],
        users.map(u => [u.id, u.name, u.email || '', u.role, u.password_hash || '', String(u.is_active), u.created_at])
      )
      
      // Categories
      const cats = db.prepare('SELECT * FROM categories').all() as any[]
      await this.syncTableSheet(config.spreadsheet_id, '_Categories',
        ['ID', 'Tên', 'Nhóm', 'Màu', 'Icon', 'Thứ Tự', 'Tạo Lúc'],
        cats.map(c => [c.id, c.name, c.group_type, c.color, c.icon, c.sort_order.toString(), c.created_at])
      )
      
    } catch(e) {
      console.error('Metadata push error:', e)
    }

    return totalSynced
  }

  async pull(): Promise<number> {
    const ok = await this.initClient()
    if (!ok || !this.sheets) throw new Error('Không thể kết nối Google Sheets')

    const db = getDb()
    const config = db.prepare('SELECT spreadsheet_id FROM sync_config WHERE id = ?').get('default') as { spreadsheet_id?: string } | null
    if (!config?.spreadsheet_id) throw new Error('Chưa cấu hình Spreadsheet ID')

    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: config.spreadsheet_id,
    })

    let totalSynced = 0

    for (const sheet of spreadsheet.data.sheets || []) {
      const title = sheet.properties?.title || ''
      if (!title.startsWith('Checklist_')) continue

      const dateStr = title.replace('Checklist_', '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheet_id,
        range: `${title}!A1:K1000`,
      })

      const rows = response.data.values || []
      if (rows.length <= 1) continue

      const dataRows = rows.slice(1) // Skip header

      for (const row of dataRows) {
        const [id, title2, description, category_id, assigned_user_id, status, check_time, priority, notes, updated_at, sub_items_json] = row as string[]
        if (!id || !title2) continue

        const existing = db.prepare('SELECT id, updated_at FROM checklist_items WHERE id = ?').get(id) as { id: string; updated_at: string } | null

        if (!existing) {
          // Insert new
          db.prepare(
            `INSERT OR IGNORE INTO checklist_items
             (id, title, description, category_id, assigned_user_id, status, check_time, priority, notes, sub_items, date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(id, title2, description, category_id || null, assigned_user_id || null, status || 'pending', check_time || null, priority || 'normal', notes || null, sub_items_json || '[]', dateStr, updated_at || new Date().toISOString(), updated_at || new Date().toISOString())
          totalSynced++
        } else if (updated_at && updated_at > existing.updated_at) {
          // Remote is newer - update local (conflict resolution: last-write-wins)
          db.prepare(
            `UPDATE checklist_items
             SET title = ?, description = ?, category_id = ?, assigned_user_id = ?, status = ?, check_time = ?, priority = ?, notes = ?, sub_items = ?, updated_at = ?
             WHERE id = ?`
          ).run(title2, description || null, category_id || null, assigned_user_id || null, status || 'pending', check_time || null, priority || 'normal', notes || null, sub_items_json || '[]', updated_at, id)
          totalSynced++
        }
      }
    }

    // Pull Metadata
    try {
      // Pull Users
      const usersSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === '_Users')
      if (usersSheet) {
        const ur = await this.sheets.spreadsheets.values.get({ spreadsheetId: config.spreadsheet_id, range: '_Users!A1:G1000' })
        const uRows = (ur.data.values || []).slice(1)
        for (const r of uRows) {
          const [id, name, email, role, pwd, is_active, created] = r as string[]
          if (!id || !name) continue
          db.prepare(`
            INSERT OR REPLACE INTO users (id, name, email, role, password_hash, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(id, name, email || null, role || 'staff', pwd || null, is_active === '1' ? 1 : 0, created || new Date().toISOString())
        }
      }

      // Pull Categories
      const catSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === '_Categories')
      if (catSheet) {
        const cr = await this.sheets.spreadsheets.values.get({ spreadsheetId: config.spreadsheet_id, range: '_Categories!A1:G1000' })
        const cRows = (cr.data.values || []).slice(1)
        for (const r of cRows) {
          const [id, name, group, color, icon, sort, created] = r as string[]
          if (!id || !name) continue
          db.prepare(`
            INSERT OR REPLACE INTO categories (id, name, group_type, color, icon, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(id, name, group || 'system', color || '#000000', icon || '', parseInt(sort || '0', 10), created || new Date().toISOString())
        }
      }
    } catch(e) {
      console.error('Metadata pull error:', e)
    }

    return totalSynced
  }

  private async syncTableSheet(spreadsheetId: string, sheetTitle: string, headers: string[], dataRows: any[][]) {
    if (!this.sheets) return
    const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId })
    const existing = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetTitle)
    if (!existing) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] },
      })
    } else {
      await this.sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetTitle}!A2:Z1000` })
    }
    const rows = [headers, ...dataRows]
    await this.sheets.spreadsheets.values.update({
      spreadsheetId, range: `${sheetTitle}!A1`, valueInputOption: 'RAW', requestBody: { values: rows }
    })
  }
}
