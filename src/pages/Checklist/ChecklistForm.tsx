import { useState } from 'react'
import { useChecklistStore } from '../../store/useChecklistStore'
import { useUserStore } from '../../store/useUserStore'
import { useAppStore } from '../../store/useAppStore'
import { v4 as uuidv4 } from 'uuid'
import type { ChecklistItem, Category, User, SubItem } from '../../types/electron'

interface Props {
  item: ChecklistItem | null
  date: string
  categories: Category[]
  users: User[]
  onClose: () => void
}

const STATUSES = [
  { value: 'pending', label: '⭕ Chưa làm' },
  { value: 'in_progress', label: '🔄 Đang làm' },
  { value: 'done', label: '✅ Hoàn thành' },
  { value: 'error', label: '❌ Lỗi' },
]

const PRIORITIES = [
  { value: 'high', label: '🔴 Cao' },
  { value: 'normal', label: '🟡 Bình thường' },
  { value: 'low', label: '🔵 Thấp' },
]

export function ChecklistForm({ item, date, categories, users, onClose }: Props) {
  const { createItem, updateItem, fetchByDate, currentDate } = useChecklistStore()
  const { currentUser } = useUserStore()
  const { toast } = useAppStore()

  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    category_id: item?.category_id || '',
    assigned_user_id: item?.assigned_user_id || '',
    status: item?.status || 'pending',
    priority: item?.priority || 'normal',
    notes: item?.notes || '',
    date: item?.date || date,
  })

  const [subItems, setSubItems] = useState<SubItem[]>(item?.sub_items || [])

  const isEditing = !!item

  const setField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const addSubItem = () => {
    setSubItems([...subItems, { id: uuidv4(), title: '', status: 'pending', notes: '' }])
  }

  const updateSubItem = (id: string, field: keyof SubItem, value: string) => {
    setSubItems(subItems.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const removeSubItem = (id: string) => {
    setSubItems(subItems.filter((s) => s.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Tên công việc không được để trống')
      return
    }

    if (subItems.some((s) => !s.title.trim())) {
      toast.error('Tên mục con không được để trống')
      return
    }

    setLoading(true)
    try {
      const now = new Date().toISOString()
      const processedSubItems = subItems.map(s => {
        if (s.status === 'done' && s.error_details && !s.error_details.is_resolved) {
          return {
            ...s,
            error_details: {
              ...s.error_details,
              is_resolved: true,
              resolved_at: s.error_details.resolved_at || now
            }
          }
        }
        return s
      })

      const data = {
        ...form,
        category_id: form.category_id || undefined,
        assigned_user_id: form.assigned_user_id || undefined,
        notes: form.notes || undefined,
        created_by: currentUser?.id,
        sub_items: processedSubItems,
      }

      if (isEditing && item) {
        await updateItem(item.id, data)
        toast.success('Đã cập nhật công việc')
      } else {
        await createItem(data)
        toast.success('Đã thêm công việc mới')
      }

      await fetchByDate(currentDate)
      onClose()
    } catch (err) {
      toast.error('Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {isEditing ? '✏️ Chỉnh Sửa Công Việc' : '➕ Thêm Công Việc Mới'}
          </h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Tên Công Việc *</label>
              <input
                id="checklist-title"
                type="text"
                className="form-input"
                placeholder="Nhập tên công việc..."
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mô Tả</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Mô tả chi tiết về công việc..."
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Danh Mục</label>
                <select
                  className="form-select"
                  value={form.category_id}
                  onChange={(e) => setField('category_id', e.target.value)}
                >
                  <option value="">— Chọn danh mục —</option>
                  <optgroup label="Hệ Thống Nền Tảng">
                    {categories.filter((c) => c.group_type === 'system').map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Phản Hồi Khách Hàng">
                    {categories.filter((c) => c.group_type === 'customer').map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Người Phụ Trách</label>
                <select
                  className="form-select"
                  value={form.assigned_user_id}
                  onChange={(e) => setField('assigned_user_id', e.target.value)}
                >
                  <option value="">— Chưa giao —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Chuyên Mục Con (Sub-checklists)</label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addSubItem}>
                  + Thêm Mục Con
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {subItems.map((sub, index) => (
                  <div key={sub.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, width: 20 }}>{index + 1}.</span>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ flex: 1 }}
                      placeholder="Tên mục con..."
                      value={sub.title}
                      onChange={(e) => updateSubItem(sub.id, 'title', e.target.value)}
                      required
                    />
                    <select 
                      className="form-select" 
                      style={{ width: 140 }}
                      value={sub.status}
                      onChange={(e) => updateSubItem(sub.id, 'status', e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-icon" 
                      onClick={() => removeSubItem(sub.id)}
                      title="Xoá"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                
                {subItems.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
                    Không có mục con nào. Bấm "+ Thêm Mục Con" để phân rã công việc này.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Trạng Thái Tổng</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ưu Tiên Mức</label>
                <select
                  className="form-select"
                  value={form.priority}
                  onChange={(e) => setField('priority', e.target.value)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {!isEditing && (
              <div className="form-group">
                <label className="form-label">Ngày Thực Hiện</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={(e) => setField('date', e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Ghi Chú</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Ghi chú thêm về công việc..."
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Huỷ
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <><div className="spinner" /> Đang lưu...</>
              ) : (
                isEditing ? '💾 Cập Nhật' : '➕ Thêm Mới'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
