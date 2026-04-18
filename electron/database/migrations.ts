import Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const migrations: { name: string; sql: string }[] = [
    {
      name: '001_initial_schema',
      sql: `
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          password_hash TEXT,
          role TEXT DEFAULT 'staff',
          avatar TEXT,
          google_id TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Categories table
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          group_type TEXT NOT NULL DEFAULT 'system',
          color TEXT DEFAULT '#6366f1',
          icon TEXT DEFAULT '📋',
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Checklist templates
        CREATE TABLE IF NOT EXISTS checklist_templates (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
          assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          priority TEXT DEFAULT 'normal',
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Checklist items (daily instances)
        CREATE TABLE IF NOT EXISTS checklist_items (
          id TEXT PRIMARY KEY,
          template_id TEXT REFERENCES checklist_templates(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT,
          category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
          assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          status TEXT DEFAULT 'pending',
          check_time DATETIME,
          notes TEXT,
          date TEXT NOT NULL,
          priority TEXT DEFAULT 'normal',
          sort_order INTEGER DEFAULT 0,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Google Sheets sync config
        CREATE TABLE IF NOT EXISTS sync_config (
          id TEXT PRIMARY KEY DEFAULT 'default',
          spreadsheet_id TEXT,
          credentials_json TEXT,
          token_json TEXT,
          auto_sync_enabled INTEGER DEFAULT 0,
          sync_interval_minutes INTEGER DEFAULT 30,
          last_sync_at DATETIME,
          sync_status TEXT DEFAULT 'idle'
        );

        -- Sync logs
        CREATE TABLE IF NOT EXISTS sync_logs (
          id TEXT PRIMARY KEY,
          sync_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          direction TEXT,
          status TEXT,
          items_synced INTEGER DEFAULT 0,
          error_message TEXT
        );

        -- App settings
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        -- Performance indexes
        CREATE INDEX IF NOT EXISTS idx_checklist_date ON checklist_items(date);
        CREATE INDEX IF NOT EXISTS idx_checklist_status ON checklist_items(status);
        CREATE INDEX IF NOT EXISTS idx_checklist_user ON checklist_items(assigned_user_id);
        CREATE INDEX IF NOT EXISTS idx_checklist_category ON checklist_items(category_id);
      `,
    },
    {
      name: '002_seed_default_data',
      sql: `
        -- Default admin user
        INSERT OR IGNORE INTO users (id, name, email, role, password_hash)
        VALUES ('user-admin-001', 'Admin', 'admin@local', 'admin', 'admin123');

        -- Default categories - System group
        INSERT OR IGNORE INTO categories (id, name, group_type, color, icon, sort_order) VALUES
          ('cat-web-001', 'Website', 'system', '#6366f1', '🌐', 1),
          ('cat-tool-001', 'Tools Nội Bộ', 'system', '#8b5cf6', '🔧', 2),
          ('cat-app-001', 'Ứng Dụng', 'system', '#06b6d4', '📱', 3),
          ('cat-bot-001', 'Chatbot AI', 'system', '#10b981', '🤖', 4),
          ('cat-api-001', 'API / Server', 'system', '#f59e0b', '⚡', 5);

        -- Default categories - Customer group
        INSERT OR IGNORE INTO categories (id, name, group_type, color, icon, sort_order) VALUES
          ('cat-zalo-001', 'Zalo OA', 'customer', '#0068ff', '💬', 6),
          ('cat-fb-001', 'Facebook Page', 'customer', '#1877f2', '📘', 7),
          ('cat-wchat-001', 'Website Chatbox', 'customer', '#059669', '💻', 8),
          ('cat-other-001', 'Kênh Khác', 'customer', '#dc2626', '📡', 9);

        -- Default sync config row
        INSERT OR IGNORE INTO sync_config (id) VALUES ('default');

        -- Default app settings
        INSERT OR IGNORE INTO app_settings (key, value) VALUES
          ('theme', 'dark'),
          ('language', 'vi'),
          ('currentUserId', 'user-admin-001');

        -- Sample checklist templates
        INSERT OR IGNORE INTO checklist_templates (id, title, description, category_id, priority, sort_order) VALUES
          ('tpl-001', 'Kiểm tra website hoạt động', 'Truy cập website chính và kiểm tra tất cả trang chủ, sản phẩm, liên hệ', 'cat-web-001', 'high', 1),
          ('tpl-002', 'Kiểm tra tốc độ tải trang', 'Dùng PageSpeed Insights để đánh giá hiệu suất', 'cat-web-001', 'normal', 2),
          ('tpl-003', 'Kiểm tra API server status', 'Ping API endpoints và kiểm tra response time', 'cat-api-001', 'high', 3),
          ('tpl-004', 'Kiểm tra Chatbot AI phản hồi', 'Test các kịch bản hội thoại cơ bản', 'cat-bot-001', 'normal', 4),
          ('tpl-005', 'Check tin nhắn Zalo OA', 'Kiểm tra và phản hồi tin nhắn chưa đọc trên Zalo OA', 'cat-zalo-001', 'high', 5),
          ('tpl-006', 'Check tin nhắn Facebook Page', 'Kiểm tra inbox và comment trên Facebook Page', 'cat-fb-001', 'high', 6),
          ('tpl-007', 'Kiểm tra form liên hệ website', 'Test form submit và xác nhận email nhận về', 'cat-wchat-001', 'normal', 7);
      `,
    },
    {
      name: '003_add_sub_items',
      sql: `
        ALTER TABLE checklist_templates ADD COLUMN sub_items TEXT DEFAULT '[]';
        ALTER TABLE checklist_items ADD COLUMN sub_items TEXT DEFAULT '[]';
      `,
    },
  ]

  for (const migration of migrations) {
    const applied = db
      .prepare('SELECT id FROM _migrations WHERE name = ?')
      .get(migration.name)

    if (!applied) {
      console.log('[DB] Running migration:', migration.name)
      db.exec(migration.sql)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name)
      console.log('[DB] Migration applied:', migration.name)
    }
  }
}
