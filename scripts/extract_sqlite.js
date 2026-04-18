const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = 'C:/Users/Windows/AppData/Roaming/quan-ly-checklist/checklist.db';

async function extract() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('Database file not found at:', DB_PATH);
    return;
  }

  const db = new Database(DB_PATH);
  const sqlStatements = [];

  sqlStatements.push('-- MIGRATION DATA FROM SQLITE');
  sqlStatements.push('BEGIN;');

  // 1. Categories
  const categories = db.prepare('SELECT * FROM categories').all();
  sqlStatements.push('\n-- Categories');
  categories.forEach(cat => {
    sqlStatements.push(`INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at) 
VALUES ('${cat.id}', '${cat.name.replace(/'/g, "''")}', '${cat.group_type}', '${cat.color}', '${cat.icon}', ${cat.sort_order}, '${cat.created_at}')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, group_type = EXCLUDED.group_type, color = EXCLUDED.color, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;`);
  });

  // 2. Profiles (from users)
  const users = db.prepare('SELECT * FROM users').all();
  sqlStatements.push('\n-- Profiles (Note: Users must exist in Auth first)');
  users.forEach(user => {
    sqlStatements.push(`INSERT INTO profiles (id, name, email, role, avatar, created_at)
VALUES ('${user.id}', '${user.name.replace(/'/g, "''")}', '${user.email || ''}', '${user.role}', '${user.avatar || ''}', '${user.created_at}')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, avatar = EXCLUDED.avatar;`);
  });

  // 3. Templates
  const templates = db.prepare('SELECT * FROM checklist_templates').all();
  sqlStatements.push('\n-- Templates');
  templates.forEach(tpl => {
    sqlStatements.push(`INSERT INTO checklist_templates (id, title, description, category_id, assigned_user_id, priority, is_active, sort_order, sub_items, created_at)
VALUES ('${tpl.id}', '${tpl.title.replace(/'/g, "''")}', '${(tpl.description || '').replace(/'/g, "''")}', ${tpl.category_id ? `'${tpl.category_id}'` : 'NULL'}, ${tpl.assigned_user_id ? `'${tpl.assigned_user_id}'` : 'NULL'}, '${tpl.priority}', ${tpl.is_active}, ${tpl.sort_order}, '${tpl.sub_items || '[]'}', '${tpl.created_at}')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, category_id = EXCLUDED.category_id, assigned_user_id = EXCLUDED.assigned_user_id, priority = EXCLUDED.priority, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, sub_items = EXCLUDED.sub_items;`);
  });

  // 4. Items
  const items = db.prepare('SELECT * FROM checklist_items').all();
  sqlStatements.push('\n-- Checklist Items');
  items.forEach(item => {
    sqlStatements.push(`INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('${item.id}', ${item.template_id ? `'${item.template_id}'` : 'NULL'}, '${item.title.replace(/'/g, "''")}', '${(item.description || '').replace(/'/g, "''")}', ${item.category_id ? `'${item.category_id}'` : 'NULL'}, ${item.assigned_user_id ? `'${item.assigned_user_id}'` : 'NULL'}, '${item.status}', ${item.check_time ? `'${item.check_time}'` : 'NULL'}, '${(item.notes || '').replace(/'/g, "''")}', '${item.date}', '${item.priority}', ${item.sort_order}, ${item.created_by ? `'${item.created_by}'` : 'NULL'}, '${item.created_at}', '${item.updated_at}', '${item.sub_items || '[]'}')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;`);
  });

  sqlStatements.push('\nCOMMIT;');

  const outputPath = 'C:/Users/Windows/Desktop/QUAN LY THEO DOI/migration_data.sql';
  fs.writeFileSync(outputPath, sqlStatements.join('\n'));
  console.log('Migration script generated at:', outputPath);

  db.close();
}

extract().catch(err => console.error(err));
