import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useDataStore } from '../../store/useDataStore'
import { supabase, safeAuthQuery } from '../../lib/supabase'
import type { ChecklistItem } from '../../types/electron'
import styles from './ReportsPage.module.css'

export function ReportsPage() {
  const { toast } = useAppStore()
  const { categories, users, loadMeta } = useDataStore()
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  
  // Use ref for immediate lock to prevent rapid clicks
  const isExportingRef = useRef(false)

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [filters, setFilters] = useState({
    dateFrom: sevenDaysAgo,
    dateTo: today,
    status: '',
    category_id: '',
    assigned_user_id: '',
    search: '',
  })

  useEffect(() => {
    loadMeta()  // Load meta from global cache (no spinner)
    loadData(filters)  // Always load on mount
  }, [])

  const loadData = async (currentFilters = filters) => {
    setLoading(true)
    try {
      const safeResult = await safeAuthQuery(async () => {
        let query = supabase
          .from('checklist_items')
          .select(`
            id, title, description, date, status, priority, notes, check_time,
            sort_order, sub_items, category_id, assigned_user_id, created_at,
            category:categories(id, name, color, icon),
            assigned_user:profiles!checklist_items_assigned_user_id_fkey(id, name, role)
          `)
          .gte('date', currentFilters.dateFrom)
          .lte('date', currentFilters.dateTo)

        if (currentFilters.status) query = query.eq('status', currentFilters.status)
        if (currentFilters.category_id) query = query.eq('category_id', currentFilters.category_id)
        if (currentFilters.assigned_user_id) query = query.eq('assigned_user_id', currentFilters.assigned_user_id)
        
        if (currentFilters.search) {
          query = query.or(`title.ilike.%${currentFilters.search}%,description.ilike.%${currentFilters.search}%`)
        }

        const { data, error } = await query
          .order('date', { ascending: false })
          .order('sort_order', { ascending: true })
        
        if (error) throw error
        return data
      })

      const { data, error: fetchError } = safeResult
      if (fetchError) throw fetchError
      
      const itemsArray = (data as any[]) || []
      const mapped = itemsArray.map(item => {
        const rawSubs = (item as any).sub_items
        // Parse sub_items — it's JSONB, could be array, string, or null
        let subItems: any[] = []
        if (Array.isArray(rawSubs)) {
          subItems = rawSubs
        } else if (typeof rawSubs === 'string') {
          try { subItems = JSON.parse(rawSubs) } catch { subItems = [] }
        }
        return {
          ...item,
          category_name: (item as any).category?.name ?? '',
          category_color: (item as any).category?.color ?? '',
          category_icon: (item as any).category?.icon ?? '',
          assigned_user_name: (item as any).assigned_user?.name ?? '',
          sub_items: subItems,  // Always a plain JS array
        }
      })

      console.log(`[Reports] Loaded ${mapped.length} items, sub_items sample:`, mapped[0]?.sub_items?.length)
      setItems(mapped as any)
    } catch (err: any) {
      console.error('Error loading reports details:', err)
      toast.error(`Lỗi: ${err.message || 'Không thể tải dữ liệu báo cáo'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExportExcel = async () => {
    if (isExportingRef.current) return
    isExportingRef.current = true
    setExporting(true)
    const exportId = Math.random().toString(36).substring(7)
    
    try {
      const dateRange = `${filters.dateFrom} den ${filters.dateTo}`
      const title = `Bao Cao Van Hanh CheckOps (${filters.dateFrom} - ${filters.dateTo})`
      
      // Serialize items fully to plain objects (avoid proxy/class issues through IPC)
      const plainItems = JSON.parse(JSON.stringify(items))
      console.log(`[Export Excel] [${exportId}] Sending ${plainItems.length} items`)
      const result = await window.electronAPI.export.toExcel({ items: plainItems, dateRange, title })
      
      if (result.success) toast.success(`Da xuat Excel (3 sheet): ${result.filePath}`)
      else toast.error(result.message || 'Loi xuat Excel')
    } catch (err: any) {
      console.error(`[Export Excel] [${exportId}] Exception:`, err)
      toast.error(`Lỗi hệ thống khi xuất Excel: ${err.message || 'Không rõ nguyên nhân'}`)
    } finally {
      setExporting(false)
      isExportingRef.current = false
    }
  }

  const handleExportPdf = async () => {
    // Immediate synchronous check to block double-triggering
    if (isExportingRef.current) {
      console.warn('[Export PDF] Blocked redundant call (isExportingRef is true)')
      return
    }
    
    isExportingRef.current = true
    setExporting(true)
    const exportId = Math.random().toString(36).substring(7)
    
    try {
      const dateRange = `${filters.dateFrom} den ${filters.dateTo}`
      const title = `Bao Cao Van Hanh CheckOps (${filters.dateFrom} - ${filters.dateTo})`
      toast.info('Dang tao PDF, vui long cho...')
      
      // Use items from state directly - it is already a plain array of objects
      console.log(`[Export PDF] [${exportId}] TRACE: Sending ${items.length} items`)
      console.trace(`[Export PDF] [${exportId}] Call stack`)
      
      const result = await window.electronAPI.export.toPdf({ 
        items: JSON.parse(JSON.stringify(items)), 
        dateRange, 
        title 
      })
      
      if (result.success) {
        toast.success(`Da xuat PDF A4 Ngang: ${result.filePath}`)
      } else {
        console.error(`[Export PDF] [${exportId}] Backend Error:`, result.message)
        toast.error(result.message || 'Loi xuat PDF')
      }
    } catch (err: any) {
      console.error(`[Export PDF] [${exportId}] Exception:`, err)
      toast.error(`Lỗi hệ thống khi xuất PDF: ${err.message || 'Không rõ nguyên nhân'}`)
    } finally {
      // Small delay before releasing lock to prevent accidental double-clicks from keyboard/hardware
      setTimeout(() => {
        setExporting(false)
        isExportingRef.current = false
      }, 1000)
    }
  }

  const setFilter = (field: string, value: string) => {
    setFilters((f) => ({ ...f, [field]: value }))
  }

  const totalDone = items.filter((i) => i.status === 'done').length
  const rate = items.length ? Math.round((totalDone / items.length) * 100) : 0

  // Collect all sub-item errors across all items
  type SubErrorRow = {
    date: string
    parentTitle: string
    subTitle: string
    description: string
    reported_to: string
    handled_by: string
    reported_at?: string
    resolved_at?: string
    is_resolved: boolean
  }
  const subErrorRows: SubErrorRow[] = []
  items.forEach(item => {
    (item.sub_items || []).forEach(sub => {
      if (sub.error_details) {
        subErrorRows.push({
          date: item.date,
          parentTitle: item.title,
          subTitle: sub.title,
          description: sub.error_details.description,
          reported_to: sub.error_details.reported_to,
          handled_by: sub.error_details.handled_by,
          reported_at: sub.error_details.reported_at,
          resolved_at: sub.error_details.resolved_at,
          is_resolved: sub.error_details.is_resolved,
        })
      }
    })
  })

  const subErrorsUnresolved = subErrorRows.filter(r => !r.is_resolved).length
  const subErrorsResolved = subErrorRows.filter(r => r.is_resolved).length

  const formatDuration = (startIso?: string, endIso?: string): string => {
    if (!startIso || !endIso) return '—'
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
    if (ms <= 0) return '—'
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  let avgSubErrorTimeStr = '—'
  const resolvedWithTimes = subErrorRows.filter(r => r.is_resolved && r.reported_at && r.resolved_at)
  if (resolvedWithTimes.length > 0) {
    const totalMs = resolvedWithTimes.reduce((acc, r) => {
      return acc + (new Date(r.resolved_at!).getTime() - new Date(r.reported_at!).getTime())
    }, 0)
    const avgMs = totalMs / resolvedWithTimes.length
    const hours = Math.floor(avgMs / (1000 * 60 * 60))
    const minutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60))
    avgSubErrorTimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const STATUS_LABELS: Record<string, string> = {
    pending: 'Chưa làm', in_progress: 'Đang làm', done: 'Hoàn thành', error: 'Lỗi',
  }

  return (
    <div className={styles.page}>
      {/* Filter Panel */}
      <div className="card">
        <div className={styles.filterTitle}>🔍 Bộ Lọc Báo Cáo</div>
        <div className={styles.filterGrid}>
          <div className="form-group">
            <label className="form-label">Từ Ngày</label>
            <input type="date" className="form-input"
              value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} max={filters.dateTo} />
          </div>
          <div className="form-group">
            <label className="form-label">Đến Ngày</label>
            <input type="date" className="form-input"
              value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} min={filters.dateFrom} max={today} />
          </div>
          <div className="form-group">
            <label className="form-label">Trạng Thái</label>
            <select className="form-select" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">Tất cả</option>
              <option value="done">✅ Hoàn thành</option>
              <option value="error">❌ Lỗi</option>
              <option value="pending">⭕ Chưa làm</option>
              <option value="in_progress">🔄 Đang làm</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Danh Mục</label>
            <select className="form-select" value={filters.category_id} onChange={(e) => setFilter('category_id', e.target.value)}>
              <option value="">Tất cả</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Nhân Sự</label>
            <select className="form-select" value={filters.assigned_user_id} onChange={(e) => setFilter('assigned_user_id', e.target.value)}>
              <option value="">Tất cả</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tìm Kiếm</label>
            <input type="text" className="form-input" placeholder="Tìm theo tên..."
              value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
          </div>
        </div>
        <div className={styles.filterActions}>
          <button className="btn btn-primary" onClick={() => loadData(filters)} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Dang tai...</> : '🔍 Tao Bao Cao'}
          </button>
          <button className="btn btn-success" onClick={handleExportExcel} disabled={exporting || items.length === 0}>
            📊 Xuất Excel
          </button>
          <button className="btn btn-secondary" onClick={handleExportPdf} disabled={exporting || items.length === 0}>
            📄 Xuất PDF
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {items.length > 0 && (
        <>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard} style={{ '--c': '#6366f1' } as React.CSSProperties}>
              <span className={styles.summaryVal}>{items.length}</span>
              <span className={styles.summaryKey}>Tổng Đầu Việc</span>
            </div>
            <div className={styles.summaryCard} style={{ '--c': '#10b981' } as React.CSSProperties}>
              <span className={styles.summaryVal}>{totalDone}</span>
              <span className={styles.summaryKey}>Việc Hoàn Thành</span>
            </div>
            <div className={styles.summaryCard} style={{ '--c': '#0ea5e9' } as React.CSSProperties}>
              <span className={styles.summaryVal}>{rate}%</span>
              <span className={styles.summaryKey}>Tỷ Lệ Hoàn Thành</span>
            </div>
            <div className={styles.summaryCard} style={{ '--c': '#ef4444' } as React.CSSProperties}>
              <span className={styles.summaryVal}>{subErrorsUnresolved}</span>
              <span className={styles.summaryKey}>Lỗi Mục Con Tồn Đọng</span>
            </div>
            <div className={styles.summaryCard} style={{ '--c': '#f59e0b' } as React.CSSProperties}>
              <span className={styles.summaryVal}>{subErrorsResolved}</span>
              <span className={styles.summaryKey}>Lỗi Mục Con Đã Xử Lý</span>
            </div>
            <div className={styles.summaryCard} style={{ '--c': '#8b5cf6' } as React.CSSProperties}>
              <span className={styles.summaryVal}>{avgSubErrorTimeStr}</span>
              <span className={styles.summaryKey}>TG Khắc Phục Lỗi (TB)</span>
            </div>
          </div>

          {/* Data table */}
          <div className={`card ${styles.tableWrapper}`}>
            <div className={styles.tableHeader}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>📋 Chi Tiết ({items.length} công việc)</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Ngày</th>
                    <th>Công Việc</th>
                    <th>Danh Mục</th>
                    <th>Người PT</th>
                    <th>Trạng Thái</th>
                    <th>Ưu Tiên</th>
                    <th>Check Lúc</th>
                    <th>Ghi Chú</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} className={styles[`status_${item.status}`]}>
                      <td className={styles.numCell}>{i + 1}</td>
                      <td>{item.date}</td>
                      <td>
                        <div className={styles.titleMain}>{item.title}</div>
                        {item.description && <div className={styles.titleSub}>{item.description}</div>}
                      </td>
                      <td>
                        {item.category_name ? (
                          <span className={styles.catChip} style={{ color: item.category_color || '#6366f1' }}>
                            {item.category_icon} {item.category_name}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{item.assigned_user_name || '—'}</td>
                      <td>
                        <span className={`badge badge-${item.status}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {item.priority === 'high' ? '🔴 Cao' : item.priority === 'low' ? '🔵 Thấp' : '🟡 TB'}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {item.check_time
                          ? new Date(item.check_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td style={{ fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sub-item Error Detail Table */}
          {subErrorRows.length > 0 && (
            <div className={`card ${styles.tableWrapper}`} style={{ marginTop: 16 }}>
              <div className={styles.tableHeader}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>❌ Biên Bản Lỗi Mục Kiểm Tra ({subErrorRows.length} lỗi)</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Ngày</th>
                      <th>Công Việc Chính</th>
                      <th>Mục Kiểm Tra</th>
                      <th>Mô Tả Lỗi</th>
                      <th>Bộ Phận</th>
                      <th>Người Xử Lý</th>
                      <th>Phát Hiện Lúc</th>
                      <th>Giải Quyết Lúc</th>
                      <th>TG Xử Lý</th>
                      <th>Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subErrorRows.map((row, i) => (
                      <tr key={i} style={{ background: row.is_resolved ? undefined : 'rgba(239,68,68,0.07)' }}>
                        <td className={styles.numCell}>{i + 1}</td>
                        <td style={{ fontSize: 12 }}>{row.date}</td>
                        <td style={{ fontWeight: 600, fontSize: 12 }}>{row.parentTitle}</td>
                        <td style={{ fontSize: 12 }}>{row.subTitle}</td>
                        <td style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.description}>{row.description}</td>
                        <td style={{ fontSize: 12 }}>{row.reported_to || '—'}</td>
                        <td style={{ fontSize: 12 }}>{row.handled_by || '—'}</td>
                        <td style={{ fontSize: 11 }}>
                          {row.reported_at ? new Date(row.reported_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ fontSize: 11 }}>
                          {row.resolved_at ? new Date(row.resolved_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: row.resolved_at ? '#10b981' : '#f59e0b' }}>
                          {formatDuration(row.reported_at, row.resolved_at)}
                        </td>
                        <td>
                          <span className={`badge badge-${row.is_resolved ? 'done' : 'error'}`}>
                            {row.is_resolved ? '✅ Đã Xử Lý' : '❌ Tồn Đọng'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && items.length === 0 && (
        <div className="empty-state card">
          <span className="empty-icon">📊</span>
          <p style={{ fontWeight: 600 }}>Chưa có dữ liệu</p>
          <p style={{ fontSize: 13 }}>Chọn khoảng thời gian và nhấn "Tạo Báo Cáo"</p>
        </div>
      )}
    </div>
  )
}
