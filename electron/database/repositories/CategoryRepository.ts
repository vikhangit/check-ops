import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'

export interface Category {
  id: string
  name: string
  group_type: 'system' | 'customer'
  color: string
  icon: string
  sort_order: number
  created_at: string
}

export class CategoryRepository {
  getAll(): Category[] {
    const db = getDb()
    return db
      .prepare('SELECT * FROM categories ORDER BY group_type, sort_order ASC')
      .all() as Category[]
  }

  create(data: Omit<Category, 'id' | 'created_at'>): Category {
    const db = getDb()
    const id = uuidv4()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.name, data.group_type, data.color || '#6366f1', data.icon || '📋', data.sort_order || 0, now)

    return this.getById(id)!
  }

  update(id: string, data: Partial<Category>): Category | null {
    const db = getDb()
    const fields: string[] = []
    const values: (string | number | null)[] = []

    for (const field of ['name', 'group_type', 'color', 'icon', 'sort_order']) {
      if (field in data) {
        fields.push(`${field} = ?`)
        values.push((data as Record<string, string | number | null>)[field] ?? null)
      }
    }

    if (fields.length > 0) {
      values.push(id)
      db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }

    return this.getById(id)
  }

  delete(id: string): boolean {
    const db = getDb()
    const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    return result.changes > 0
  }

  getById(id: string): Category | null {
    const db = getDb()
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | null
  }
}
