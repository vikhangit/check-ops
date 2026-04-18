import { useEffect, useState, useRef } from 'react'
import { useUserStore } from '../../store/useUserStore'
import { useAppStore } from '../../store/useAppStore'
import { useDataStore } from '../../store/useDataStore'
import { supabase } from '../../lib/supabase'
import { queryWithRetry, refreshAuthSession } from '../../lib/supabaseUtils'
import { downloadTemplateSample, parseTemplateExcel } from '../../lib/excelImport'
import type { ChecklistTemplate } from '../../types/electron'
import { TemplateForm } from './components/TemplateForm'
import styles from './TemplatesPage.module.css'

export function TemplatesPage() {
  const { currentUser } = useUserStore()
  const { toast } = useAppStore()
  const { templates, categories, users, loadTemplates } = useDataStore()
  const [localTemplates, setLocalTemplates] = useState<ChecklistTemplate[]>([])
  const [synced, setSynced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<ChecklistTemplate | null>(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use global store templates, but keep local copy for optimistic updates
  const displayTemplates: ChecklistTemplate[] = localTemplates.length > 0 ? localTemplates : templates as any

  useEffect(() => {
    // If already have cached data, don't show spinner — refresh in background
    if (templates.length > 0 && !synced) {
      setSynced(true)
      loadTemplates()  // Silent background refresh
    } else if (templates.length === 0) {
      setLoading(true)
      loadTemplates().finally(() => setLoading(false))
    }
  }, [])

  // Sync local from store whenever store updates
  useEffect(() => {
    if (templates.length > 0) {
      setLocalTemplates(templates as any)
    }
  }, [templates])

  const loadAll = async () => {
    setRefreshing(true)
    try {
      // Force refresh auth session before loading
      await refreshAuthSession()
      await loadTemplates()
      toast.success('Đã làm mới templates')
    } catch (err: any) {
      console.error('Refresh failed:', err)
      toast.error('Không thể làm mới - vui lòng kiểm tra kết nối')
    } finally {
      setRefreshing(false)
    }
  }

  const openCreate = () => {
    setEditTemplate(null)
    setIsFormOpen(true)
  }

  const openEdit = (tpl: ChecklistTemplate) => {
    setEditTemplate(tpl)
    setIsFormOpen(true)
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    // Reload data after a short delay
    setTimeout(() => {
      loadTemplates().catch(err => console.warn('Auto-reload failed:', err))
    }, 300)
  }

  const handleDelete = async (tpl: ChecklistTemplate) => {
    if (!confirm(`Xoá template "${tpl.title}"? Các checklist đã tạo từ template này sẽ không bị ảnh hưởng.`)) return
    try {
      const { error } = await queryWithRetry(() => 
        supabase.from('checklist_templates').delete().eq('id', tpl.id)
      )
      if (error) throw error
      toast.success('Đã xoá template')
      setTimeout(() => {
        loadTemplates().catch(err => console.warn('Auto-reload failed:', err))
      }, 300)
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xoá template')
    }
  }

  const handleToggleActive = async (tpl: ChecklistTemplate) => {
    try {
      const { error } = await queryWithRetry(() =>
        supabase
          .from('checklist_templates')
          .update({ is_active: !tpl.is_active } as any)
          .eq('id', tpl.id)
      )
      if (error) throw error
      setTimeout(() => {
        loadTemplates().catch(err => console.warn('Auto-reload failed:', err))
      }, 300)
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật template')
    }
  }

  const handleDownloadSample = () => {
    try {
      downloadTemplateSample()
      toast.success('Đã tải xuống mẫu Excel')
    } catch (err: any) {
      toast.error('Lỗi tải mẫu: ' + err.message)
    }
  }

  const handleImportExcel = async (file: File) => {
    if (!file) return

    setImporting(true)
    try {
      // Parse Excel file
      const templates = await parseTemplateExcel(file)
      
      if (templates.length === 0) {
        toast.error('Không tìm thấy template nào trong file')
        return
      }

      // Process each template
      let successCount = 0
      let errorCount = 0

      for (const template of templates) {
        try {
          // Find category ID by name
          let category_id = undefined
          if (template.category_name) {
            const category = categories.find(c => 
              c.name.toLowerCase() === template.category_name!.toLowerCase()
            )
            if (category) {
              category_id = category.id
            }
          }

          // Find user ID by name
          let assigned_user_id = undefined
          if (template.assigned_user_name) {
            const user = users.find(u => 
              u.name.toLowerCase() === template.assigned_user_name!.toLowerCase()
            )
            if (user) {
              assigned_user_id = user.id
            }
          }

          const data = {
            title: template.title,
            description: template.description || '',
            category_id,
            assigned_user_id,
            priority: template.priority,
            is_active: template.is_active,
            sort_order: templates.length + successCount,
            sub_items: template.sub_items,
          }

          const { error } = await queryWithRetry(() =>
            supabase.from('checklist_templates').insert([data as any])
          )

          if (error) throw error
          successCount++
        } catch (err) {
          console.error('Import template error:', err)
          errorCount++
        }
      }

      if (successCount > 0) {
        toast.success(`Đã import thành công ${successCount} template`)
        setTimeout(() => {
          loadTemplates().catch(err => console.warn('Auto-reload failed:', err))
        }, 300)
      }

      if (errorCount > 0) {
        toast.error(`Có ${errorCount} template import thất bại`)
      }

      setIsImportOpen(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err: any) {
      toast.error('Lỗi import: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && 
          !file.name.endsWith('.xlsx')) {
        toast.error('Chỉ chấp nhận file Excel (.xlsx)')
        return
      }
      handleImportExcel(file)
    }
  }

  const activeCount = displayTemplates.filter((t) => t.is_active).length

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.info}>
          <span className={styles.count}>{displayTemplates.length} templates</span>
          <span className={styles.activeCount}>({activeCount} đang hoạt động)</span>
          <div className={styles.hint}>
            💡 Templates được tự động tạo checklist mỗi ngày khi bạn nhấn "Tạo Từ Template"
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={loadAll}
            disabled={refreshing}
            title="Làm mới dữ liệu templates"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {refreshing ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                Đang làm mới...
              </>
            ) : (
              <>🔄 Làm Mới</>
            )}
          </button>
          <button 
            className="btn btn-outline" 
            onClick={() => setIsImportOpen(true)}
            title="Import templates từ Excel"
          >
            📥 Import Excel
          </button>
          {(currentUser?.role === 'admin' || currentUser?.permissions?.templates?.add) && (
            <button className="btn btn-primary" onClick={openCreate}>
              ➕ Thêm Template
            </button>
          )}
        </div>
      </div>

      {loading && displayTemplates.length === 0 ? (
        <div className="empty-state">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <p style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>Đang tải templates...</p>
        </div>
      ) : displayTemplates.length === 0 ? (
        <div className="empty-state card">
          <span className="empty-icon">📋</span>
          <p style={{ fontWeight: 600 }}>Chưa có template nào</p>
          <p style={{ fontSize: 13 }}>Tạo template để tự động generate checklist mỗi ngày</p>
          {(currentUser?.role === 'admin' || currentUser?.permissions?.templates?.add) && (
            <button className="btn btn-primary" onClick={openCreate}>➕ Tạo Template Đầu Tiên</button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {displayTemplates.map((tpl, idx) => (
            <div key={tpl.id} className={`card ${styles.card} ${!tpl.is_active ? styles.cardInactive : ''}`}>
              <div className={styles.cardTop}>
                <span className={styles.cardNum}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.cardTitle}>{tpl.title}</div>
                  {tpl.description && (
                    <div className={styles.cardDesc}>{tpl.description}</div>
                  )}
                </div>
                <div className={styles.cardActions}>
                  {(currentUser?.role === 'admin' || currentUser?.permissions?.templates?.edit) && (
                    <>
                      <button
                        className={`btn btn-sm ${tpl.is_active ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => handleToggleActive(tpl)}
                        title={tpl.is_active ? 'Đang bật – click để tắt' : 'Đang tắt – click để bật'}
                      >
                        {tpl.is_active ? '✅ Bật' : '⭕ Tắt'}
                      </button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(tpl)}>✏️</button>
                    </>
                  )}
                  {(currentUser?.role === 'admin' || currentUser?.permissions?.templates?.delete) && (
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(tpl)}>🗑️</button>
                  )}
                </div>
              </div>
              <div className={styles.cardMeta}>
                {tpl.category_name && (
                  <span
                    className={styles.catChip}
                    style={{ background: `${tpl.category_color}20`, color: tpl.category_color || '#6366f1', borderColor: `${tpl.category_color}30` }}
                  >
                    {tpl.category_icon} {tpl.category_name}
                  </span>
                )}
                {tpl.assigned_user_name && (
                  <span className={styles.userChip}>👤 {tpl.assigned_user_name}</span>
                )}
                <span className={`${styles.priorityChip} ${styles[`pri_${tpl.priority}`]}`}>
                  {tpl.priority === 'high' ? '🔴 Cao' : tpl.priority === 'low' ? '🔵 Thấp' : '🟡 Bình Thường'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <TemplateForm
          editTemplate={editTemplate}
          categories={categories}
          users={users}
          onClose={() => setIsFormOpen(false)}
          onSuccess={handleFormSuccess}
          sortOrder={templates.length}
        />
      )}

      {/* Import Excel Modal */}
      {isImportOpen && (
        <div className="modal-overlay" onClick={() => !importing && setIsImportOpen(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📥 Import Templates từ Excel</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => !importing && setIsImportOpen(false)} disabled={importing}>✕</button>
            </div>
            <div style={{ padding: 20, opacity: importing ? 0.6 : 1, pointerEvents: importing ? 'none' : 'auto' }}>
              <div style={{ marginBottom: 20 }}>
                <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
                  Tải lên file Excel (.xlsx) chứa danh sách templates cần import.
                </p>
                
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <button 
                    className="btn btn-outline" 
                    onClick={handleDownloadSample}
                    style={{ flex: 1 }}
                  >
                    📋 Tải Mẫu Excel
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <button 
                    className="btn btn-primary" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    style={{ flex: 1 }}
                  >
                    📁 Chọn File Excel
                  </button>
                </div>

                {importing && (
                  <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                      Đang import templates...
                    </p>
                  </div>
                )}

                <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong>Hướng dẫn:</strong>
                  <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                    <li>Tải mẫu Excel để xem định dạng</li>
                    <li>Điền thông tin template theo mẫu</li>
                    <li>Tên danh mục và người phụ trách phải khớp với dữ liệu có sẵn</li>
                    <li>Có thể có tối đa 5 template con</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
