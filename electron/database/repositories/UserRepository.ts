import { getDb } from '../db'
import { v4 as uuidv4 } from 'uuid'

export interface User {
  id: string
  name: string
  email?: string
  password_hash?: string
  role: 'admin' | 'staff'
  avatar?: string
  google_id?: string
  is_active: number
  created_at: string
}

export class UserRepository {
  getAll(): User[] {
    const db = getDb()
    return db
      .prepare('SELECT id, name, email, role, avatar, is_active, created_at FROM users WHERE is_active = 1 ORDER BY name ASC')
      .all() as User[]
  }

  getById(id: string): User | null {
    const db = getDb()
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | null
  }

  findByCredentials(name: string, password: string): User | null {
    const db = getDb()
    return db
      .prepare('SELECT * FROM users WHERE name = ? AND password_hash = ? AND is_active = 1')
      .get(name, password) as User | null
  }

  create(data: { name: string; email?: string; password: string; role?: string }): User {
    const db = getDb()
    const id = uuidv4()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    ).run(id, data.name, data.email || null, data.password, data.role || 'staff', now)

    return this.getById(id)!
  }

  update(id: string, data: Partial<User>): User | null {
    const db = getDb()
    const fields: string[] = []
    const values: (string | number | null)[] = []

    for (const field of ['name', 'email', 'role', 'avatar', 'is_active']) {
      if (field in data) {
        fields.push(`${field} = ?`)
        values.push((data as Record<string, string | number | null>)[field] ?? null)
      }
    }

    if (fields.length > 0) {
      values.push(id)
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }

    return this.getById(id)
  }

  updatePassword(id: string, oldPassword: string, newPassword: string): boolean {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND password_hash = ?').get(id, oldPassword)
    if (!user) return false
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPassword, id)
    return true
  }

  delete(id: string): boolean {
    const db = getDb()
    // Soft delete
    const result = db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id)
    return result.changes > 0
  }
}
