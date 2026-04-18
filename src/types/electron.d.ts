// Type definitions for the Electron API exposed via contextBridge
export interface SubItem {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'done' | 'error'
  notes?: string
  result?: string
  start_time?: string
  end_time?: string
  error_details?: {
    description: string
    reported_to: string
    handled_by: string
    is_resolved: boolean
    reported_at?: string
    resolved_at?: string
  }
}


export interface ChecklistItem {
  id: string
  template_id?: string
  title: string
  description?: string
  category_id?: string
  category_name?: string
  category_color?: string
  category_icon?: string
  assigned_user_id?: string
  assigned_user_name?: string
  status: 'pending' | 'in_progress' | 'done' | 'error'
  check_time?: string
  notes?: string
  date: string
  priority: 'low' | 'normal' | 'high'
  sort_order: number
  created_by?: string
  created_at: string
  updated_at: string
  sub_items?: SubItem[]
  result?: string
  start_time?: string
  end_time?: string
  error_reported_at?: string
  error_resolved_at?: string
}

export interface Category {
  id: string
  name: string
  group_type: 'system' | 'customer'
  color: string
  icon: string
  sort_order: number
  created_at: string
}

export interface ModulePermissions {
  view: boolean
  add: boolean
  edit: boolean
  delete: boolean
}

export interface UserPermissions {
  checklist: ModulePermissions
  templates: ModulePermissions
  reports: ModulePermissions
  settings: ModulePermissions
}

export interface User {
  id: string
  name: string
  email?: string
  role: 'admin' | 'staff'
  avatar?: string
  permissions?: UserPermissions
  is_active: number
  created_at: string
}
export interface ChecklistTemplate {
  id: string
  title: string
  description?: string
  category_id?: string
  category_name?: string
  category_color?: string
  category_icon?: string
  assigned_user_id?: string
  assigned_user_name?: string
  priority: 'low' | 'normal' | 'high'
  is_active: number
  sort_order: number
  created_at: string
  sub_items?: SubItem[]
  result?: string
  start_time?: string
  end_time?: string
}

export interface SyncConfig {
  id: string
  spreadsheet_id?: string
  auto_sync_enabled: number
  sync_interval_minutes: number
  last_sync_at?: string
  sync_status: string
}

export interface SyncLog {
  id: string
  sync_at: string
  direction: string
  status: string
  items_synced: number
  error_message?: string
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

export interface StatsResult {
  summary: {
    total: number
    done: number
    error: number
    pending: number
    in_progress: number
  }
  byCategory: Array<{ name: string; color: string; icon: string; total: number; done: number; error: number }>
  byUser: Array<{ name: string; total: number; done: number; error: number }>
  byDate: Array<{ date: string; total: number; done: number; error: number }>
}

export interface ElectronAPI {
  checklist: {
    getByDate: (date: string) => Promise<ChecklistItem[]>
    getAll: (filters?: ChecklistFilters) => Promise<ChecklistItem[]>
    create: (data: Partial<ChecklistItem>) => Promise<ChecklistItem>
    update: (id: string, data: Partial<ChecklistItem>) => Promise<ChecklistItem>
    updateStatus: (id: string, status: string, notes?: string) => Promise<ChecklistItem>
    delete: (id: string) => Promise<boolean>
    duplicateFromDate: (fromDate: string, toDate: string) => Promise<number>
    generateFromTemplates: (date: string) => Promise<number>
    getStats: (params: { dateFrom?: string; dateTo?: string; userId?: string }) => Promise<StatsResult>
  }
  category: {
    getAll: () => Promise<Category[]>
    create: (data: Partial<Category>) => Promise<Category>
    update: (id: string, data: Partial<Category>) => Promise<Category>
    delete: (id: string) => Promise<boolean>
  }
  user: {
    getAll: () => Promise<User[]>
    login: (name: string, password: string) => Promise<{ success: boolean; user?: User; message?: string }>
    create: (data: { name: string; email?: string; password: string; role?: string }) => Promise<User>
    update: (id: string, data: Partial<User>) => Promise<User>
    delete: (id: string) => Promise<boolean>
    updatePassword: (id: string, oldPwd: string, newPwd: string) => Promise<{ success: boolean; message: string }>
  }
  template: {
    getAll: () => Promise<ChecklistTemplate[]>
    create: (data: Partial<ChecklistTemplate>) => Promise<ChecklistTemplate>
    update: (id: string, data: Partial<ChecklistTemplate>) => Promise<ChecklistTemplate>
    delete: (id: string) => Promise<boolean>
    reorder: (ids: string[]) => Promise<{ success: boolean }>
  }
  sync: {
    getConfig: () => Promise<SyncConfig | null>
    saveConfig: (data: Partial<SyncConfig> & { credentials_json?: string }) => Promise<{ success: boolean; message?: string }>
    push: () => Promise<{ success: boolean; itemsSynced?: number; message?: string }>
    pull: () => Promise<{ success: boolean; itemsSynced?: number; message?: string }>
    getLogs: () => Promise<SyncLog[]>
    testConnection: () => Promise<{ success: boolean; message?: string }>
    exportConfig: () => Promise<{ success: boolean; message?: string }>
    importConfig: () => Promise<{ success: boolean; message?: string }>
    getAuthUrl: () => Promise<{ success: boolean; url?: string; message?: string }>
    exchangeCode: (code: string) => Promise<{ success: boolean; message?: string }>
  }
  export: {
    toExcel: (data: { items: ChecklistItem[]; dateRange: string; title: string }) => Promise<{ success: boolean; filePath?: string; message?: string }>
    toPdf: (data: { items: ChecklistItem[]; dateRange: string; title: string }) => Promise<{ success: boolean; filePath?: string; message?: string }>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<{ success: boolean }>
    getAll: () => Promise<Record<string, string>>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => (() => void) | void
  off: (channel: string, callback: (...args: unknown[]) => void) => void
  update: {
    check: () => Promise<any>
    download: () => Promise<void>
    install: () => Promise<void>
  }
  app: {
    version: () => Promise<string>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    electron?: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>
        on: (channel: string, callback: (...args: any[]) => void) => () => void
        off: (channel: string, callback: (...args: any[]) => void) => void
      }
    }
  }
}
