import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase, safeAuthQuery, ensureAuthReady } from '../../../lib/supabase'
import { queryWithRetry, refreshAuthSession, checkAndRecoverAuthState, resetSupabaseConnection } from '../../../lib/supabaseUtils'
import { useTemplateDraft, useSessionKeepAlive } from '../../../hooks/useTemplateDraft'
import { useAppStore } from '../../../store/useAppStore'
import type { ChecklistTemplate, SubItem, Category, User } from '../../../types/electron'

interface TemplateFormProps {
  editTemplate: ChecklistTemplate | null
  categories: Category[]
  users: User[]
  onClose: () => void
  onSuccess: () => void
  sortOrder: number
}

export function TemplateForm({ editTemplate, categories, users, onClose, onSuccess, sortOrder }: TemplateFormProps) {
  const { toast } = useAppStore()
  const { saveDraft, loadDraft, clearDraft, startPeriodicSave, stopPeriodicSave } = useTemplateDraft()
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false) // Tránh closure bug cho setTimeout
  const [subItems, setSubItems] = useState<SubItem[]>(editTemplate?.sub_items || [])
  const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Force focus on mount to overcome focus/interaction lock in Electron
  useEffect(() => {
    const timer = setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus()
      }
    }, 150) // 150ms is enough for any unmount transitions to complete
    return () => clearTimeout(timer)
  }, [])

  const [form, setForm] = useState({
    title: editTemplate?.title || '',
    description: editTemplate?.description || '',
    category_id: editTemplate?.category_id || '',
    assigned_user_id: editTemplate?.assigned_user_id || '',
    priority: editTemplate?.priority || 'normal',
    is_active: editTemplate ? editTemplate.is_active : 1,
  })

  // Keep session alive while form is open
  useSessionKeepAlive(true)

  // Load draft only for new templates
  useEffect(() => {
    if (!editTemplate) {
      const draft = loadDraft()
      if (draft) {
        setForm({
          title: draft.title,
          description: draft.description,
          category_id: draft.category_id,
          assigned_user_id: draft.assigned_user_id,
          priority: draft.priority,
          is_active: draft.is_active,
        })
        setSubItems(draft.subItems.map(s => ({ 
          id: s.id, 
          title: s.title, 
          status: 'pending' as const, 
          notes: '' 
        })))
        toast.info(`✅ Đã phục hồi bản nháp từ lúc ${new Date(draft.savedAt).toLocaleTimeString('vi-VN')}`)
      }
    }
  }, [editTemplate, loadDraft, toast])

  // Periodic save setup
  useEffect(() => {
    startPeriodicSave()
    return () => stopPeriodicSave()
  }, [startPeriodicSave, stopPeriodicSave])

  // Debounced auto-save on changes
  useEffect(() => {
    const currentDraft = {
      title: form.title,
      description: form.description,
      category_id: form.category_id,
      assigned_user_id: form.assigned_user_id,
      priority: form.priority as any,
      is_active: form.is_active,
      subItems: subItems.map(s => ({ id: s.id, title: s.title })),
    }

    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)

    draftTimeoutRef.current = setTimeout(() => {
      saveDraft(currentDraft)
    }, 1000)

    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)
    }
  }, [form, subItems, saveDraft])

  const addSubItem = () => {
    setSubItems([...subItems, { id: uuidv4(), title: '', status: 'pending', notes: '' }])
  }

  const updateSubItem = (id: string, field: keyof SubItem, value: string) => {
    setSubItems(subItems.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const removeSubItem = (id: string) => {
    setSubItems(subItems.filter(s => s.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Tên template không được để trống'); return }
    if (submittingRef.current) return
    
    setSubmitting(true)
    submittingRef.current = true
    console.log('--- TEMPLATE SUBMIT START ---')
    
    // BẢO HIỂM: Sau 50s nếu vẫn đang treo thì tự động nhả nút lưu (Tăng từ 25s lên 50s để đủ thời gian retry ngầm)
    const safetyTimer = setTimeout(() => {
       if (submittingRef.current) {
         console.warn('Safety timer triggered - forcing UI reset')
         setSubmitting(false)
         submittingRef.current = false
         toast.error('Thao tác quá lâu - Vui lòng kiểm tra lại kết nối mạng')
         
         try {
            resetSupabaseConnection()
         } catch (e) {
            console.error('Failed to reset connection in safety timer:', e)
         }
       }
    }, 50000)

    let isSuccess = false
    try {
      // 1. Ép buộc kiểm tra và làm mới Auth ngay trước khi gửi
      await checkAndRecoverAuthState().catch(() => {})

      // 2. Prepare data
      const templateData = {
        id: editTemplate ? editTemplate.id : `tpl-${uuidv4().substring(0, 8)}`,
        ...form,
        is_active: !!form.is_active,
        priority: form.priority as 'normal' | 'low' | 'high',
        category_id: form.category_id || null,
        assigned_user_id: form.assigned_user_id || null,
        sort_order: editTemplate ? editTemplate.sort_order : sortOrder,
        sub_items: subItems,
      }
      
      // 3. Perform query - safeAuthQuery đã có sẵn cơ chế retry và timeout 15s
      const { error } = await safeAuthQuery(async () => {
        if (editTemplate) {
          const { error: updateError } = await supabase
            .from('checklist_templates')
            .update(templateData as any)
            .eq('id', editTemplate.id)
          if (updateError) throw updateError
        } else {
          const { error: insertError } = await supabase
            .from('checklist_templates')
            .insert([templateData as any])
          if (insertError) throw insertError
        }
        return true
      })

      if (error) throw error
      
      toast.success(editTemplate ? 'Đã cập nhật template' : 'Đã thêm template mới')
      clearDraft()
      isSuccess = true
    } catch (err: any) { 
      console.error('Lỗi khi lưu template:', err)
      const message = err.message || 'Lỗi kết nối database'
      
      if (message.includes('timeout') || message.includes('lock') || message.includes('401') || message.includes('fetch')) {
         toast.error('Kết nối gặp sự cố - Đang tự động thiết lập lại kết nối...')
         await resetSupabaseConnection().catch(() => {})
      } else {
         toast.error('Lỗi: ' + message)
      }
    } finally {
      console.log('--- TEMPLATE SUBMIT END ---')
      clearTimeout(safetyTimer)
      setSubmitting(false)
      submittingRef.current = false
      
      // Delay onSuccess slightly so the unmount happens after state cleanup
      if (isSuccess) {
        setTimeout(() => {
          onSuccess()
        }, 100)
      }
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()} style={{ opacity: submitting ? 0.8 : 1 }}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{editTemplate ? '✏️ Sửa Template' : '➕ Tạo Template Mới'}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => !submitting && onClose()} disabled={submitting}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: submitting ? 0.6 : 1 }}>
            <div className="form-group">
              <label className="form-label">Tên Template *</label>
              <input 
                ref={titleInputRef}
                type="text" className="form-input" placeholder="Tên công việc template..."
                value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} autoFocus required disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Mô Tả</label>
              <textarea className="form-textarea" rows={2} placeholder="Mô tả..."
                value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} disabled={submitting} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Danh Mục</label>
                <select className="form-select" value={form.category_id} disabled={submitting}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>                 
                  <option value="">— Chọn danh mục —</option>
                  <optgroup label="Hệ Thống">
                    {categories.filter((c) => c.group_type === 'system').map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Khách Hàng">
                    {categories.filter((c) => c.group_type === 'customer').map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Người Phụ Trách</label>
                <select className="form-select" value={form.assigned_user_id} disabled={submitting}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_user_id: e.target.value }))}>                    
                  <option value="">— Chưa giao —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Template Con (Được tạo tự động theo)</label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addSubItem} disabled={submitting}>+ Thêm Mục Con</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {subItems.map((sub, index) => (
                  <div key={sub.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, width: 20 }}>{index + 1}.</span>
                    <input type="text" className="form-input" style={{ flex: 1 }} placeholder="Tên mục con phân rã..."
                      value={sub.title} onChange={(e) => updateSubItem(sub.id, 'title', e.target.value)} required disabled={submitting} />
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeSubItem(sub.id)} title="Xoá" disabled={submitting}>✕</button>
                  </div>
                ))}
                {subItems.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
                    Không có template con. Mục này sẽ là một công việc đơn lẻ.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Ưu Tiên</label>
                <select className="form-select" value={form.priority} disabled={submitting}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as 'low' | 'normal' | 'high' }))}>                   
                  <option value="high">🔴 Cao</option>
                  <option value="normal">🟡 Bình thường</option>
                  <option value="low">🔵 Thấp</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Trạng Thái</label>
                <select className="form-select" value={form.is_active} disabled={submitting}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: Number(e.target.value) }))}>                  
                  <option value={1}>✅ Đang hoạt động</option>
                  <option value={0}>⭕ Tạm tắt</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => !submitting && onClose()} disabled={submitting}>Huỷ</button>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  Đang lưu...
                </>
              ) : (
                editTemplate ? '💾 Cập Nhật' : '➕ Tạo Template'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
