import { useEffect, useState, useMemo, Fragment } from 'react'
import { useChecklistStore } from '../../store/useChecklistStore'
import { useAppStore } from '../../store/useAppStore'
import { useUserStore } from '../../store/useUserStore'
import { supabase } from '../../lib/supabase'
import type { ChecklistItem, Category, User, SubItem } from '../../types/electron'
import { ChecklistForm } from './ChecklistForm'
import { StatusBadge } from '../../components/StatusBadge'
import styles from './ChecklistPage.module.css'

const STATUSES = [
  { value: 'pending', label: 'Chưa làm', icon: '⭕' },
  { value: 'in_progress', label: 'Đang làm', icon: '🔄' },
  { value: 'done', label: 'Hoàn thành', icon: '✅' },
  { value: 'error', label: 'Lỗi', icon: '❌' },
]

const PRIORITIES = [
  { value: 'high', label: 'Cao', color: '#ef4444' },
  { value: 'normal', label: 'Bình thường', color: '#6366f1' },
  { value: 'low', label: 'Thấp', color: '#6b7280' },
]

export function ChecklistPage() {
  const {
    items,
    loading,
    currentDate,
    filters,
    fetchByDate,
    setCurrentDate,
    setFilters,
    clearFilters,
    updateStatus,
    deleteItem,
    generateFromTemplates,
    duplicateFromDate,
    updateItem,
    subscribeToChanges,
    unsubscribeFromChanges,
  } = useChecklistStore()

  const { toast } = useAppStore()
  const { currentUser } = useUserStore()

  const [categories, setCategories] = useState<Category[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [editItem, setEditItem] = useState<ChecklistItem | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isNewItem, setIsNewItem] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateFromDateStr, setDuplicateFromDateStr] = useState('')
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null)
  const [subStatusDropdownId, setSubStatusDropdownId] = useState<string | null>(null)
  const [notesModalItem, setNotesModalItem] = useState<ChecklistItem | null>(null)
  const [notesText, setNotesText] = useState('')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [errorModalSubItem, setErrorModalSubItem] = useState<{ item: ChecklistItem; subId: string; } | null>(null)
  const [errorForm, setErrorForm] = useState({ description: '', reported_to: '', handled_by: '', is_resolved: false })
  const [resultModalSubItem, setResultModalSubItem] = useState<{ item: ChecklistItem; subId: string; status: string; } | null>(null)
  const [resultText, setResultText] = useState('')

  useEffect(() => {
    fetchByDate(currentDate)
    subscribeToChanges(currentDate)
    loadMeta()
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.modal')) return
      if (!target.closest(`.${styles.statusDropdownWrapper}`)) {
        setStatusDropdownId(null)
        setSubStatusDropdownId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      unsubscribeFromChanges()
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const loadMeta = async () => {
    const [catsRes, usrsRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('profiles').select('*').order('name'),
    ])
    setCategories(catsRes.data || [])
    setUsers(usrsRes.data || [])
  }

  // Compute prev/next dates
  const prevDate = useMemo(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }, [currentDate])

  const nextDate = useMemo(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }, [currentDate])

  const today = new Date().toISOString().split('T')[0]

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters.status && item.status !== filters.status) return false
      if (filters.category_id && item.category_id !== filters.category_id) return false
      if (filters.assigned_user_id && item.assigned_user_id !== filters.assigned_user_id) return false
      if (filters.search) {
        const s = filters.search.toLowerCase()
        const matched =
          item.title.toLowerCase().includes(s) ||
          (item.description || '').toLowerCase().includes(s) ||
          (item.notes || '').toLowerCase().includes(s) ||
          (item.assigned_user_name || '').toLowerCase().includes(s)
        if (!matched) return false
      }
      return true
    })
  }, [items, filters])

  // Stats for current day
  const dayStats = useMemo(() => {
    const total = items.length
    const done = items.filter((i) => i.status === 'done').length
    const error = items.filter((i) => i.status === 'error').length
    const rate = total ? Math.round((done / total) * 100) : 0
    return { total, done, error, rate }
  }, [items])

  // Compute parent status from sub-items
  const computeParentStatus = (subItems: SubItem[]): string => {
    if (subItems.length === 0) return 'pending'
    const hasError = subItems.some(s => s.status === 'error')
    if (hasError) return 'error'
    const allDone = subItems.every(s => s.status === 'done')
    if (allDone) return 'done'
    const hasInProgress = subItems.some(s => s.status === 'in_progress')
    if (hasInProgress) return 'in_progress'
    return 'pending'
  }

  const handleStatusChange = async (item: ChecklistItem, newStatus: string) => {
    setStatusDropdownId(null)
    
    // If item has sub-items, status is controlled automatically — block manual changes
    if (item.sub_items && item.sub_items.length > 0) {
      toast.error('Trạng thái công việc chính tự động theo mục con!')
      return
    }

    // No sub-items — allow free status change without error modal
    await updateStatus(item.id, newStatus)
    toast.success('Cập nhật trạng thái thành công')
  }

  const handleSubItemStatusChange = async (item: ChecklistItem, subId: string, newStatus: string) => {
    setSubStatusDropdownId(null)
    if (!item.sub_items) return
    const targetSub = item.sub_items.find(s => s.id === subId)
    if (!targetSub) return

    if (newStatus === 'error') {
      // Open error modal — will stamp reported_at when saving
      setErrorModalSubItem({ item, subId })
      setErrorForm({
        description: targetSub.error_details?.description || '',
        reported_to: targetSub.error_details?.reported_to || '',
        handled_by: targetSub.error_details?.handled_by || '',
        is_resolved: targetSub.error_details?.is_resolved || false,
      })
      return
    }

    // Chỉ mở dialog nhập kết quả khi chuyển sang "Hoàn thành"
    if (newStatus === 'done') {
      setResultModalSubItem({ item, subId, status: newStatus })
      setResultText(targetSub.result || '')
      return
    }

    // Các trạng thái khác (Pending, In Progress) cập nhật trực tiếp
    const now = new Date().toISOString()
    const newSubItems = item.sub_items.map(s => {
      if (s.id === subId) {
        const updatedSub = { ...s, status: newStatus as any }
        // Ghi nhận thời gian bắt đầu nếu chuyển sang Đang làm
        if (newStatus === 'in_progress' && !s.start_time) {
          updatedSub.start_time = now
        }
        return updatedSub
      }
      return s
    })
    
    const parentStatus = computeParentStatus(newSubItems)
    await updateItem(item.id, { sub_items: newSubItems, status: parentStatus as any })
  }

  const handleSaveSubItemResult = async () => {
    if (!resultModalSubItem) return
    const { item, subId, status } = resultModalSubItem
    if (!item.sub_items) return

    const now = new Date().toISOString()
    const newSubItems = item.sub_items.map(s => {
      if (s.id === subId) {
        const updatedSub = { ...s, status: status as any, result: resultText }
        
        // Nếu chuyển sang Hoàn thành và trước đó đang bị Lỗi, tự động resolve lỗi luôn
        if (status === 'done' && s.error_details && !s.error_details.is_resolved) {
          updatedSub.error_details = {
            ...s.error_details,
            is_resolved: true,
            resolved_at: now
          }
        }

        // Ghi nhận thời gian bắt đầu cho mục con
        if (status === 'in_progress' && !s.start_time) {
          updatedSub.start_time = now
        }
        
        // Ghi nhận thời gian kết thúc cho mục con
        if ((status === 'done' || status === 'error') && s.start_time && !s.end_time) {
          updatedSub.end_time = now
        } else if ((status === 'done' || status === 'error') && !s.start_time) {
          // Trường hợp nhảy thẳng từ Pending -> Hoàn thành
          updatedSub.start_time = now
          updatedSub.end_time = now
        }
        
        return updatedSub
      }
      return s
    })
    
    const parentStatus = computeParentStatus(newSubItems)
    await updateItem(item.id, { sub_items: newSubItems, status: parentStatus as any })
    
    setResultModalSubItem(null)
    setResultText('')
    toast.success('Đã cập nhật kết quả')
  }

  const handleSaveSubItemError = async (resolveImmediately = false) => {
    if (!errorModalSubItem) return
    const { item, subId } = errorModalSubItem
    if (!item.sub_items) return

    if (!errorForm.description.trim()) { toast.error('Vui lòng mô tả chi tiết lỗi'); return }
    if (!errorForm.reported_to.trim()) { toast.error('Vui lòng ghi rõ báo cho bộ phận nào'); return }
    if (!errorForm.handled_by.trim()) { toast.error('Vui lòng ghi thông tin người xử lý'); return }

    const now = new Date().toISOString()
    const targetSub = item.sub_items.find(s => s.id === subId)
    const existingReportedAt = targetSub?.error_details?.reported_at

    const newSubItems = item.sub_items.map(s => {
      if (s.id === subId) {
        return {
          ...s,
          status: resolveImmediately ? ('done' as any) : ('error' as any),
          error_details: {
            ...errorForm,
            is_resolved: resolveImmediately,
            reported_at: existingReportedAt || now,
            resolved_at: resolveImmediately ? now : undefined
          }
        }
      }
      return s
    })

    const parentStatus = computeParentStatus(newSubItems)
    await updateItem(item.id, { sub_items: newSubItems, status: parentStatus as any })
    
    if (resolveImmediately) {
      toast.success('Đã xác nhận Xử Lý Lỗi thành công (Hoàn Thành)')
    } else {
      toast.success('Đã lưu Biên Bản Lỗi')
    }
    setErrorModalSubItem(null)
  }

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async (item: ChecklistItem) => {
    if (!confirm(`Xoá công việc "${item.title}"?`)) return
    const ok = await deleteItem(item.id)
    if (ok) toast.success('Đã xoá công việc')
    else toast.error('Không thể xoá')
  }

  const handleGenerate = async () => {
    const count = await generateFromTemplates()
    if (count > 0) toast.success(`Đã tạo ${count} công việc từ templates`)
    else toast.info('Checklist hôm nay đã được tạo từ trước hoặc không có template nào')
  }

  const handleDuplicate = async () => {
    if (!duplicateFromDateStr) { toast.error('Chọn ngày muốn sao chép'); return }
    const count = await duplicateFromDate(duplicateFromDateStr)
    setShowDuplicateModal(false)
    if (count > 0) toast.success(`Đã sao chép ${count} công việc từ ${duplicateFromDateStr}`)
    else toast.info('Ngày hôm nay đã có dữ liệu, không sao chép')
  }

  const handleSaveNotes = async () => {
    if (!notesModalItem) return

    if (notesModalItem.status === 'error' && !notesText.trim()) {
      toast.error('Vui lòng nhập nguyên nhân lỗi hoặc ghi chú!')
      return
    }

    const errorOptions: any = {}
    if (notesModalItem.status === 'error') {
      // Always stamp reported_at if it's not already stamped (or maybe again to refresh)
      if (!notesModalItem.error_reported_at) {
        errorOptions.error_reported_at = new Date().toISOString()
      }
      errorOptions.error_resolved_at = null
    } else if (notesModalItem.status === 'done' && notesModalItem.error_reported_at) {
      errorOptions.error_resolved_at = new Date().toISOString()
    }

    await updateStatus(notesModalItem.id, notesModalItem.status, notesText, Object.keys(errorOptions).length > 0 ? errorOptions : undefined)
    
    setNotesModalItem(null)
    toast.success('Đã cập nhật trạng thái và ghi chú')
  }

  const displayDate = new Date(currentDate + 'T00:00:00').toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const hasActiveFilters = !!(filters.status || filters.category_id || filters.assigned_user_id || filters.search)

  return (
    <div className={styles.page}>
      {/* Date Navigation */}
      <div className={styles.dateNav}>
        <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(prevDate)}>
          ← Hôm Trước
        </button>

        <div className={styles.dateCenter}>
          <h2 className={styles.dateLabel}>{displayDate}</h2>
          {currentDate !== today && (
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(today)}>
              Về Hôm Nay
            </button>
          )}
          <input
            type="date"
            className={styles.datePicker}
            value={currentDate}
            onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
          />
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setCurrentDate(nextDate)}
          disabled={nextDate > today}
        >
          Hôm Sau →
        </button>

        {/* Refresh / Reload button */}
        <button
          className="btn btn-ghost btn-sm"
          title="Tải lại trang"
          onClick={() => window.location.reload()}
          style={{ padding: '0 10px', fontSize: 16, lineHeight: 1 }}
        >
          🔄
        </button>
      </div>

      {/* Day stats bar */}
      <div className={styles.dayStats}>
        <div className={styles.dayStatsLeft}>
          <span className={styles.dayStatItem}>
            📋 <strong>{dayStats.total}</strong> công việc
          </span>
          <span className={`${styles.dayStatItem} ${styles.done}`}>
            ✅ <strong>{dayStats.done}</strong> hoàn thành
          </span>
          <span className={`${styles.dayStatItem} ${styles.error}`}>
            ❌ <strong>{dayStats.error}</strong> lỗi
          </span>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${dayStats.rate}%` }} />
          </div>
          <span className={styles.dayStatItem}><strong>{dayStats.rate}%</strong></span>
        </div>

        {(currentUser?.role === 'admin' || currentUser?.permissions?.checklist?.add) && (
          <div className={styles.dayStatsActions}>
            <button className="btn btn-secondary btn-sm" onClick={handleGenerate}>
              🪄 Tạo Từ Template
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowDuplicateModal(true)}>
              📋 Sao Chép Ngày
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => { setIsNewItem(true); setEditItem(null); setIsFormOpen(true) }}>
              + Thêm Công Việc
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className="form-input"
          style={{ maxWidth: 240 }}
          placeholder="🔍 Tìm kiếm công việc..."
          value={filters.search || ''}
          onChange={(e) => setFilters({ search: e.target.value })}
        />
        <select
          className="form-select"
          style={{ maxWidth: 160 }}
          value={filters.status || ''}
          onChange={(e) => setFilters({ status: e.target.value || undefined })}
        >
          <option value="">Tất cả trạng thái</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={filters.category_id || ''}
          onChange={(e) => setFilters({ category_id: e.target.value || undefined })}
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ maxWidth: 160 }}
          value={filters.assigned_user_id || ''}
          onChange={(e) => setFilters({ assigned_user_id: e.target.value || undefined })}
        >
          <option value="">Tất cả người PT</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>✕ Xoá Filter</button>
        )}
        <span className={styles.count}>{filteredItems.length} công việc</span>
      </div>

      {/* Checklist Table */}
      {/* Only show blocking spinner for true first load with no data */}
      {loading && filteredItems.length === 0 && items.length === 0 ? (
        <div className="empty-state">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <p style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>Đang tải dữ liệu...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state card">
          <span className="empty-icon">📋</span>
          <p style={{ fontWeight: 600 }}>Chưa có công việc nào</p>
          <p style={{ fontSize: 13 }}>
            {hasActiveFilters
              ? 'Thử xoá bộ lọc để xem tất cả công việc'
              : 'Nhấn "Tạo Từ Template" hoặc "+ Thêm Công Việc" để bắt đầu'}
          </p>
          {(currentUser?.role === 'admin' || currentUser?.permissions?.checklist?.add) && (
            <button className="btn btn-primary" onClick={handleGenerate}>
              🪄 Tạo Từ Template
            </button>
          )}
        </div>
      ) : (
        <div className={`card ${styles.tableWrapper}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ width: 280 }}>Công Việc / Mục Con</th>
                <th style={{ width: 180 }}>Thông Tin</th>
                <th style={{ width: 150 }}>Kết Quả</th>
                <th style={{ width: 100 }}>Ưu Tiên</th>
                <th style={{ width: 180 }}>Thời Gian Check</th>
                <th style={{ width: 100, textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const isExpanded = expandedItems.has(item.id)
                const hasSubItems = item.sub_items && item.sub_items.length > 0
                
                return (
                  <Fragment key={item.id}>
                    {/* Main Parent Row */}
                    <tr className={`${styles.row} ${styles[`row_${item.status}`]} ${isExpanded ? styles.expandedParent : ''}`}>
                      <td className={styles.numCell}>{idx + 1}</td>
                      <td className={styles.titleCell}>
                        <div className={styles.titleMain}>{item.title}</div>
                        {item.description && (
                          <div className={styles.titleSub}>{item.description}</div>
                        )}
                        {item.notes && (
                          <div className={styles.notesLine}>💬 {item.notes}</div>
                        )}
                        
                        {hasSubItems && (
                          <div 
                            style={{ marginTop: 8, fontSize: 13, color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}
                            onClick={() => toggleExpand(item.id)}
                          >
                            {isExpanded ? '📂 Thu gọn' : '📁 Mở rộng'} {item.sub_items!.length} mục con ({item.sub_items!.filter(s => s.status === 'done').length}/{item.sub_items!.length} hoàn thành)
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {item.category_name ? (
                            <span
                              className={styles.catChip}
                              style={{ background: `${item.category_color}20`, color: item.category_color || '#6366f1', borderColor: `${item.category_color}40`, width: 'fit-content' }}
                            >
                              {item.category_icon} {item.category_name}
                            </span>
                          ) : (
                            <span className={styles.empty}>—</span>
                          )}

                          {item.assigned_user_name ? (
                            <span className={styles.userChip} style={{ fontSize: 11 }}>
                              <span className={styles.userInitial} style={{ width: 18, height: 18, fontSize: 10 }}>
                                {item.assigned_user_name.charAt(0).toUpperCase()}
                              </span>
                              {item.assigned_user_name}
                            </span>
                          ) : (
                            <span className={styles.empty}>—</span>
                          )}

                          <div className={styles.statusCell}>
                            <StatusBadge status={item.status} />
                            {(currentUser?.role === 'admin' || currentUser?.permissions?.checklist?.edit) && (
                              <div 
                                className={styles.statusDropdownWrapper}
                                style={{ zIndex: statusDropdownId === item.id ? 100 : undefined }}
                              >
                                <button
                                  className={styles.statusBtn}
                                  onClick={() => setStatusDropdownId(statusDropdownId === item.id ? null : item.id)}
                                >
                                  ▾
                                </button>
                                {statusDropdownId === item.id && (
                                  <div className={styles.statusDropdown} style={{ top: '-20px', left: '-40px' }}>
                                    {STATUSES.map((s) => (
                                      <button
                                        key={s.value}
                                        className={`${styles.statusOption} ${item.status === s.value ? styles.statusOptionActive : ''}`}
                                        onClick={() => handleStatusChange(item, s.value)}
                                      >
                                        {s.icon} {s.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {item.result ? (
                          <div style={{ color: 'var(--c-success)', fontWeight: 500 }}>{item.result}</div>
                        ) : hasSubItems ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            {item.sub_items!.filter(s => s.status === 'done').length}/{item.sub_items!.length} mục xong
                          </div>
                        ) : (
                          <span className={styles.empty}>Chưa có KQ</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={styles.priorityChip}
                          style={{ color: PRIORITIES.find((p) => p.value === item.priority)?.color }}
                        >
                          {item.priority === 'high' ? '🔴' : item.priority === 'low' ? '🔵' : '🟡'}
                          {' '}{PRIORITIES.find((p) => p.value === item.priority)?.label}
                        </span>
                      </td>
                      <td className={styles.timeCell}>
                        {!hasSubItems ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: 9, width: 45 }}>Bắt đầu:</span>
                              <span style={{ fontWeight: 600, color: item.start_time ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                {item.start_time ? new Date(item.start_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: 9, width: 45 }}>Kết thúc:</span>
                              <span style={{ fontWeight: 600, color: item.end_time ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                {item.end_time ? new Date(item.end_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                             📂 Nhấn mở rộng để xem TG
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          {(currentUser?.role === 'admin' || currentUser?.permissions?.checklist?.edit) && (
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => {
                                setEditItem(item)
                                setIsNewItem(false)
                                setIsFormOpen(true)
                              }}
                              title="Chỉnh sửa"
                            >
                              ✏️
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => {
                              setNotesModalItem(item)
                              setNotesText(item.notes || '')
                            }}
                            title="Ghi chú"
                          >
                            💬
                          </button>
                          {(currentUser?.role === 'admin' || currentUser?.permissions?.checklist?.delete) && (
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => handleDelete(item)}
                              title="Xoá"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Sub-item Rows (rendered when expanded) */}
                    {isExpanded && hasSubItems && item.sub_items!.map((sub) => (
                      <tr key={sub.id} className={`${styles.subRow} ${sub.status === 'error' ? styles.subRowError : ''}`}>
                        <td className={styles.numCell} style={{ opacity: 0.3 }}>↳</td>
                        <td className={styles.titleCell} style={{ paddingLeft: 24 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                             <span style={{ color: sub.status === 'done' ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: 13 }}>
                                {sub.title}
                             </span>
                             <div 
                                className={styles.statusDropdownWrapper}
                                style={{ zIndex: subStatusDropdownId === `${item.id}-${sub.id}` ? 100 : undefined }}
                              >
                                <div 
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => setSubStatusDropdownId(subStatusDropdownId === `${item.id}-${sub.id}` ? null : `${item.id}-${sub.id}`)}
                                >
                                  <StatusBadge status={sub.status} />
                                </div>
                                
                                {subStatusDropdownId === `${item.id}-${sub.id}` && (
                                  <div className={styles.statusDropdown} style={{ bottom: '0', top: 'auto', right: '-10px', left: 'auto' }}>
                                    {STATUSES.map((s) => (
                                      <button
                                        key={s.value}
                                        className={`${styles.statusOption} ${sub.status === s.value ? styles.statusOptionActive : ''}`}
                                        onClick={() => handleSubItemStatusChange(item, sub.id, s.value)}
                                      >
                                        {s.icon} {s.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                          </div>
                          
                          {sub.status === 'error' && sub.error_details && (
                            <div style={{ marginTop: 6, fontSize: 12 }}>
                              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: 6 }}>
                                <div style={{ marginBottom: 4 }}>
                                  <strong style={{ color: '#ef4444' }}>⚠️ Lỗi:</strong> <span style={{ color: '#7f1d1d' }}>{sub.error_details.description}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 12, color: '#991b1b', fontSize: 11 }}>
                                  <span>🏢 {sub.error_details.reported_to || '—'}</span>
                                  <span>🧑‍🔧 {sub.error_details.handled_by || '—'}</span>
                                </div>
                                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                                  <button className="btn btn-sm" style={{ padding: '0 8px', height: 22, fontSize: 11, background: 'var(--bg-primary)', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => handleSubItemStatusChange(item, sub.id, 'error')}>
                                    ✏️ Sửa
                                  </button>
                                  <button className="btn btn-sm" style={{ padding: '0 8px', height: 22, fontSize: 11, background: '#10b981', color: '#fff', border: 'none' }} onClick={() => handleSubItemStatusChange(item, sub.id, 'done')}>
                                    ✅ Xong
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className={styles.empty}></td>
                        <td style={{ fontSize: 12 }}>
                           {sub.result ? (
                             <div style={{ color: 'var(--c-success)', fontWeight: 500 }}>{sub.result}</div>
                           ) : (
                             <span className={styles.empty} style={{ fontSize: 11 }}>Chưa có KQ</span>
                           )}
                        </td>
                        <td className={styles.empty}></td>
                        <td className={styles.timeCell}>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: 9, width: 45 }}>Bắt đầu:</span>
                                <span style={{ fontWeight: 600, color: sub.start_time ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                  {sub.start_time ? new Date(sub.start_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: 9, width: 45 }}>Kết thúc:</span>
                                <span style={{ fontWeight: 600, color: sub.end_time ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                  {sub.end_time ? new Date(sub.end_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                </span>
                              </div>
                            </div>
                        </td>
                        <td className={styles.empty}></td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Checklist Form Modal */}
      {isFormOpen && (
        <ChecklistForm
          item={isNewItem ? null : editItem}
          date={currentDate}
          categories={categories}
          users={users}
          onClose={() => setIsFormOpen(false)}
        />
      )}

      {/* Duplicate Modal */}
      {showDuplicateModal && (
        <div className="modal-overlay" onClick={() => setShowDuplicateModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Sao Chép Từ Ngày Khác</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowDuplicateModal(false)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Sao chép các công việc từ ngày đã chọn sang <strong>{displayDate}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Ngày Nguồn</label>
              <input
                type="date"
                className="form-input"
                value={duplicateFromDateStr}
                max={today}
                onChange={(e) => setDuplicateFromDateStr(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDuplicateModal(false)}>Huỷ</button>
              <button className="btn btn-primary" onClick={handleDuplicate}>📋 Sao Chép</button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModalItem && (
        <div className="modal-overlay" onClick={() => setNotesModalItem(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">💬 Ghi Chú</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setNotesModalItem(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, fontWeight: 600 }}>
              {notesModalItem.title}
            </p>
            <div className="form-group">
              <label className="form-label">Ghi Chú</label>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder="Nhập ghi chú về công việc này..."
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNotesModalItem(null)}>Huỷ</button>
              <button className="btn btn-primary" onClick={handleSaveNotes}>💾 Lưu Ghi Chú</button>
            </div>
          </div>
        </div>
      )}

      {/* SubItem Error Details Modal */}
      {errorModalSubItem && (
        <div className="modal-overlay" onClick={() => setErrorModalSubItem(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--error-color)' }}>❌ Báo Nhận Lỗi Mục Con</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setErrorModalSubItem(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              <strong>{errorModalSubItem.item.sub_items?.find(s => s.id === errorModalSubItem.subId)?.title}</strong><br/>
              Khi ghi nhận lỗi, phải có ghi nhận thông tin rõ ràng mới cho hoàn thành công việc.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Mô tả rõ vấn đề Lỗi *</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Lỗi cụ thể là gì?..."
                  value={errorForm.description}
                  onChange={(e) => setErrorForm(p => ({ ...p, description: e.target.value }))}
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Báo cáo cho Bộ phận *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="IT, Admin, Marketing..."
                    value={errorForm.reported_to}
                    onChange={(e) => setErrorForm(p => ({ ...p, reported_to: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tên người xử lý *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tên nhân sự..."
                    value={errorForm.handled_by}
                    onChange={(e) => setErrorForm(p => ({ ...p, handled_by: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setErrorModalSubItem(null)}>Huỷ</button>
              <button 
                className="btn btn-ghost" 
                style={{ color: 'var(--error-color)', border: '1px solid var(--error-color)' }} 
                onClick={() => handleSaveSubItemError(false)}
              >
                🛑 Lưu Thông Tin (Đang Lỗi)
              </button>
              <button 
                className="btn btn-primary" 
                style={{ background: 'var(--success-color)', border: 'none' }} 
                onClick={() => handleSaveSubItemError(true)}
              >
                ✅ Lưu & Đóng Lỗi (Hoàn Thành)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal for SubItems */}
      {resultModalSubItem && (
        <div className="modal-overlay" onClick={() => setResultModalSubItem(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📝 Kết Quả Công Việc</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setResultModalSubItem(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              <strong>{resultModalSubItem.item.sub_items?.find(s => s.id === resultModalSubItem.subId)?.title}</strong><br/>
              Vui lòng nhập kết quả thực hiện của công việc này.
            </p>
            <div className="form-group">
              <label className="form-label">Kết Quả *</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Mô tả kết quả thực hiện..."
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setResultModalSubItem(null)}>Huỷ</button>
              <button className="btn btn-primary" onClick={handleSaveSubItemResult}>💾 Lưu Kết Quả</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

