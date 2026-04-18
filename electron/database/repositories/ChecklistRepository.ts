import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'
import type { SubItem } from '../../../src/types/electron'

export interface ChecklistItem {
  id: string
  template_id?: string
  title: string
  description?: string
  category_id?: string
  assigned_user_id?: string
  status: 'pending' | 'in_progress' | 'done' | 'error'
  check_time?: string
  notes?: string
  date: string
  priority: 'low' | 'normal' | 'high'
  sort_order: number
  created_by?: string
  created_at: string
  updated_at: string
  category_name?: string
  category_color?: string
  category_icon?: string
  assigned_user_name?: string
  sub_items?: SubItem[]
}

export interface ChecklistFilters {
  date?: string
  status?: string
  category_id?: string
  assigned_user_id?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

function parseSubItems(item: any): ChecklistItem {
  if (!item) return item;
  try {
    item.sub_items = typeof item.sub_items === 'string' ? JSON.parse(item.sub_items) : [];
  } catch (e) {
    item.sub_items = [];
  }
  return item as ChecklistItem;
}

export class ChecklistRepository {
  getByDate(date: string): ChecklistItem[] {
    const db = getDb()
    const result = db
      .prepare(
        `SELECT ci.*,
          c.name as category_name, c.color as category_color, c.icon as category_icon,
          u.name as assigned_user_name
         FROM checklist_items ci
         LEFT JOIN categories c ON ci.category_id = c.id
         LEFT JOIN users u ON ci.assigned_user_id = u.id
         WHERE ci.date = ?
         ORDER BY ci.sort_order ASC, ci.created_at ASC`
      )
      .all(date)
    return result.map(parseSubItems)
  }

  getAll(filters: ChecklistFilters = {}): ChecklistItem[] {
    const db = getDb()
    let query = `
      SELECT ci.*,
        c.name as category_name, c.color as category_color, c.icon as category_icon,
        u.name as assigned_user_name
      FROM checklist_items ci
      LEFT JOIN categories c ON ci.category_id = c.id
      LEFT JOIN users u ON ci.assigned_user_id = u.id
      WHERE 1=1
    `
    const params: (string | number)[] = []

    if (filters.date) {
      query += ' AND ci.date = ?'
      params.push(filters.date)
    }
    if (filters.dateFrom) {
      query += ' AND ci.date >= ?'
      params.push(filters.dateFrom)
    }
    if (filters.dateTo) {
      query += ' AND ci.date <= ?'
      params.push(filters.dateTo)
    }
    if (filters.status) {
      query += ' AND ci.status = ?'
      params.push(filters.status)
    }
    if (filters.category_id) {
      query += ' AND ci.category_id = ?'
      params.push(filters.category_id)
    }
    if (filters.assigned_user_id) {
      query += ' AND ci.assigned_user_id = ?'
      params.push(filters.assigned_user_id)
    }
    if (filters.search) {
      query += ' AND (ci.title LIKE ? OR ci.description LIKE ? OR ci.notes LIKE ?)'
      const likeVal = `%${filters.search}%`
      params.push(likeVal, likeVal, likeVal)
    }

    query += ' ORDER BY ci.date DESC, ci.sort_order ASC, ci.created_at ASC'

    const result = db.prepare(query).all(...params)
    return result.map(parseSubItems)
  }

  create(data: Omit<ChecklistItem, 'id' | 'created_at' | 'updated_at'>): ChecklistItem {
    const db = getDb()
    const id = uuidv4()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO checklist_items
       (id, template_id, title, description, category_id, assigned_user_id,
        status, notes, date, priority, sort_order, sub_items, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.template_id || null,
      data.title,
      data.description || null,
      data.category_id || null,
      data.assigned_user_id || null,
      data.status || 'pending',
      data.notes || null,
      data.date,
      data.priority || 'normal',
      data.sort_order || 0,
      JSON.stringify(data.sub_items || []),
      data.created_by || null,
      now,
      now
    )

    return this.getById(id)!
  }

  update(id: string, data: Partial<ChecklistItem>): ChecklistItem | null {
    const db = getDb()
    const now = new Date().toISOString()

    const fields: string[] = []
    const values: (string | number | null)[] = []

    const updatableFields = [
      'title', 'description', 'category_id', 'assigned_user_id',
      'status', 'check_time', 'notes', 'date', 'priority', 'sort_order',
    ]

    for (const field of updatableFields) {
      if (field in data) {
        fields.push(`${field} = ?`)
        values.push((data as Record<string, string | number | null>)[field] ?? null)
      }
    }
    
    if ('sub_items' in data) {
      fields.push(`sub_items = ?`)
      values.push(JSON.stringify(data.sub_items || []))
    }

    if (fields.length === 0) return this.getById(id)

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    db.prepare(`UPDATE checklist_items SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    return this.getById(id)
  }

  updateStatus(id: string, status: string, notes?: string): ChecklistItem | null {
    const db = getDb()
    const now = new Date().toISOString()

    db.prepare(
      `UPDATE checklist_items
       SET status = ?, check_time = ?, notes = COALESCE(?, notes), updated_at = ?
       WHERE id = ?`
    ).run(status, now, notes || null, now, id)

    return this.getById(id)
  }

  delete(id: string): boolean {
    const db = getDb()
    const result = db.prepare('DELETE FROM checklist_items WHERE id = ?').run(id)
    return result.changes > 0
  }

  getById(id: string): ChecklistItem | null {
    const db = getDb()
    const result = db
      .prepare(
        `SELECT ci.*,
          c.name as category_name, c.color as category_color, c.icon as category_icon,
          u.name as assigned_user_name
         FROM checklist_items ci
         LEFT JOIN categories c ON ci.category_id = c.id
         LEFT JOIN users u ON ci.assigned_user_id = u.id
         WHERE ci.id = ?`
      )
      .get(id)
    return result ? parseSubItems(result) : null
  }

  duplicateFromDate(fromDate: string, toDate: string): number {
    const db = getDb()

    const existingCount = (
      db
        .prepare('SELECT COUNT(*) as count FROM checklist_items WHERE date = ?')
        .get(toDate) as { count: number }
    ).count

    if (existingCount > 0) return 0

    const sourceItems = this.getByDate(fromDate)
    const now = new Date().toISOString()

    const insert = db.prepare(
      `INSERT INTO checklist_items
       (id, template_id, title, description, category_id, assigned_user_id,
        status, date, priority, sort_order, sub_items, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
    )

    const insertMany = db.transaction(() => {
      for (const item of sourceItems) {
        // Reset status for duplicated sub_items
        const newSubItems = (item.sub_items || []).map(s => ({ ...s, status: 'pending', notes: '' }))
        insert.run(
          uuidv4(),
          item.template_id || null,
          item.title,
          item.description || null,
          item.category_id || null,
          item.assigned_user_id || null,
          toDate,
          item.priority,
          item.sort_order,
          JSON.stringify(newSubItems),
          now,
          now
        )
      }
    })

    insertMany()
    return sourceItems.length
  }

  generateFromTemplates(date: string): number {
    const db = getDb()

    const existingCount = (
      db
        .prepare('SELECT COUNT(*) as count FROM checklist_items WHERE date = ? AND template_id IS NOT NULL')
        .get(date) as { count: number }
    ).count

    if (existingCount > 0) return 0

    const templates = db
      .prepare('SELECT * FROM checklist_templates WHERE is_active = 1 ORDER BY sort_order ASC')
      .all()

    const now = new Date().toISOString()
    const insert = db.prepare(
      `INSERT INTO checklist_items
       (id, template_id, title, description, category_id, assigned_user_id,
        status, date, priority, sort_order, sub_items, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
    )

    const insertMany = db.transaction(() => {
      for (const tpl of templates as any[]) {
        let subItems = []
        try { subItems = typeof tpl.sub_items === 'string' ? JSON.parse(tpl.sub_items) : [] } catch(e) {}
        
        // Reset status for instantiated templates
        const newSubItems = subItems.map((s: any) => ({ ...s, status: 'pending', notes: '' }))

        insert.run(
          uuidv4(),
          tpl.id,
          tpl.title,
          tpl.description || null,
          tpl.category_id || null,
          tpl.assigned_user_id || null,
          date,
          tpl.priority || 'normal',
          tpl.sort_order || 0,
          JSON.stringify(newSubItems),
          now,
          now
        )
      }
    })

    insertMany()
    return templates.length
  }

  getStats(params: { dateFrom?: string; dateTo?: string; userId?: string }) {
    const db = getDb()
    let where = '1=1'
    const vals: string[] = []

    if (params.dateFrom) { where += ' AND date >= ?'; vals.push(params.dateFrom) }
    if (params.dateTo) { where += ' AND date <= ?'; vals.push(params.dateTo) }
    if (params.userId) { where += ' AND assigned_user_id = ?'; vals.push(params.userId) }

    const summary = db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
         FROM checklist_items WHERE ${where}`
      )
      .get(...vals)

    const byCategory = db
      .prepare(
        `SELECT c.name, c.color, c.icon,
          COUNT(*) as total,
          SUM(CASE WHEN ci.status = 'done' THEN 1 ELSE 0 END) as done,
          SUM(CASE WHEN ci.status = 'error' THEN 1 ELSE 0 END) as error
         FROM checklist_items ci
         LEFT JOIN categories c ON ci.category_id = c.id
         WHERE ${where}
         GROUP BY ci.category_id`
      )
      .all(...vals)

    const byUser = db
      .prepare(
        `SELECT u.name,
          COUNT(*) as total,
          SUM(CASE WHEN ci.status = 'done' THEN 1 ELSE 0 END) as done,
          SUM(CASE WHEN ci.status = 'error' THEN 1 ELSE 0 END) as error
         FROM checklist_items ci
         LEFT JOIN users u ON ci.assigned_user_id = u.id
         WHERE ${where}
         GROUP BY ci.assigned_user_id`
      )
      .all(...vals)

    const byDate = db
      .prepare(
        `SELECT date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error
         FROM checklist_items
         WHERE ${where}
         GROUP BY date
         ORDER BY date ASC`
      )
      .all(...vals)

    return { summary, byCategory, byUser, byDate }
  }

  getAllForSync(dateFrom?: string, dateTo?: string): ChecklistItem[] {
    const db = getDb()
    let query = 'SELECT * FROM checklist_items WHERE 1=1'
    const params: string[] = []
    if (dateFrom) { query += ' AND date >= ?'; params.push(dateFrom) }
    if (dateTo) { query += ' AND date <= ?'; params.push(dateTo) }
    query += ' ORDER BY date ASC, sort_order ASC'
    const result = db.prepare(query).all(...params)
    return result.map(parseSubItems)
  }
}
