import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'
import type { SubItem } from '../../../src/types/electron'

export interface ChecklistTemplate {
  id: string
  title: string
  description?: string
  category_id?: string
  assigned_user_id?: string
  priority: 'low' | 'normal' | 'high'
  is_active: number
  sort_order: number
  created_at: string
  category_name?: string
  category_color?: string
  category_icon?: string
  assigned_user_name?: string
  sub_items?: SubItem[]
}

function parseSubItems(item: any): ChecklistTemplate {
  if (!item) return item;
  try {
    item.sub_items = typeof item.sub_items === 'string' ? JSON.parse(item.sub_items) : [];
  } catch (e) {
    item.sub_items = [];
  }
  return item as ChecklistTemplate;
}

export class TemplateRepository {
  getAll(): ChecklistTemplate[] {
    const db = getDb()
    const result = db
      .prepare(
        `SELECT ct.*,
          c.name as category_name, c.color as category_color, c.icon as category_icon,
          u.name as assigned_user_name
         FROM checklist_templates ct
         LEFT JOIN categories c ON ct.category_id = c.id
         LEFT JOIN users u ON ct.assigned_user_id = u.id
         ORDER BY ct.sort_order ASC, ct.created_at ASC`
      )
      .all()
    return result.map(parseSubItems)
  }

  create(data: Omit<ChecklistTemplate, 'id' | 'created_at'>): ChecklistTemplate {
    const db = getDb()
    const id = uuidv4()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO checklist_templates
       (id, title, description, category_id, assigned_user_id, priority, is_active, sort_order, sub_items, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.title,
      data.description || null,
      data.category_id || null,
      data.assigned_user_id || null,
      data.priority || 'normal',
      data.is_active ?? 1,
      data.sort_order || 0,
      JSON.stringify(data.sub_items || []),
      now
    )

    return this.getById(id)!
  }

  update(id: string, data: Partial<ChecklistTemplate>): ChecklistTemplate | null {
    const db = getDb()
    const fields: string[] = []
    const values: (string | number | null)[] = []

    for (const field of ['title', 'description', 'category_id', 'assigned_user_id', 'priority', 'is_active', 'sort_order']) {
      if (field in data) {
        fields.push(`${field} = ?`)
        values.push((data as Record<string, string | number | null>)[field] ?? null)
      }
    }

    if ('sub_items' in data) {
      fields.push(`sub_items = ?`)
      values.push(JSON.stringify(data.sub_items || []))
    }

    if (fields.length > 0) {
      values.push(id)
      db.prepare(`UPDATE checklist_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }

    return this.getById(id)
  }

  delete(id: string): boolean {
    const db = getDb()
    const result = db.prepare('DELETE FROM checklist_templates WHERE id = ?').run(id)
    return result.changes > 0
  }

  getById(id: string): ChecklistTemplate | null {
    const db = getDb()
    const result = db
      .prepare(
        `SELECT ct.*,
          c.name as category_name, c.color as category_color, c.icon as category_icon,
          u.name as assigned_user_name
         FROM checklist_templates ct
         LEFT JOIN categories c ON ct.category_id = c.id
         LEFT JOIN users u ON ct.assigned_user_id = u.id
         WHERE ct.id = ?`
      )
      .get(id)
    return result ? parseSubItems(result) : null
  }

  reorder(ids: string[]): void {
    const db = getDb()
    const update = db.prepare('UPDATE checklist_templates SET sort_order = ? WHERE id = ?')
    const updateMany = db.transaction(() => {
      ids.forEach((id, index) => {
        update.run(index, id)
      })
    })
    updateMany()
  }
}
