import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useAppStore } from '../../store/useAppStore'
import { useDataStore } from '../../store/useDataStore'
import { useChecklistStore } from '../../store/useChecklistStore'
import { supabase, safeAuthQuery } from '../../lib/supabase'

import type { StatsResult } from '../../types/electron'
import styles from './DashboardPage.module.css'

const STATUS_COLORS = {
  done: '#10b981',
  error: '#ef4444',
  in_progress: '#f59e0b',
  pending: '#6b7280',
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { toast } = useAppStore()
  const { setCurrentDate, setFilters } = useChecklistStore()
  const { dashboardStats: stats, dashboardPeriod: period, setDashboardStats: setStats, setDashboardPeriod: setPeriod } = useDataStore()
  const [loading, setLoading] = useState(false)   // Start false — show cached or empty immediately
  const [error, setError] = useState<string | null>(null)
  const isLoadingRef = useRef(false)  // Prevent duplicate parallel calls

  const loadStats = async (silent = false) => {
    if (isLoadingRef.current) return  // Skip if already loading
    isLoadingRef.current = true
    if (!silent) setLoading(true)
    setError(null)
    try {
      const now = new Date()
      let dateFrom: string
      const dateTo = now.toISOString().split('T')[0]

      if (period === '7d') {
        const d = new Date(now)
        d.setDate(d.getDate() - 6)
        dateFrom = d.toISOString().split('T')[0]
      } else if (period === '30d') {
        const d = new Date(now)
        d.setDate(d.getDate() - 29)
        dateFrom = d.toISOString().split('T')[0]
      } else {
        dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      }

      // Add a timeout so we never hang forever
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)  // 10s max

      const safeResult = await safeAuthQuery(async () => {
        const { data, error } = await supabase
          .from('checklist_items')
          .select(`
            *,
            category:categories(*),
            assigned_user:profiles!checklist_items_assigned_user_id_fkey(*)
          `)
          .gte('date', dateFrom)
          .lte('date', dateTo)
          .abortSignal(controller.signal)
        
        if (error) throw error
        return data
      })
      const { data, error: fetchError } = safeResult

      clearTimeout(timeout)
      if (fetchError) throw fetchError

      const summary = { total: 0, done: 0, error: 0, in_progress: 0, pending: 0 }
      const byDateMap: Record<string, any> = {}
      const byUserMap: Record<string, any> = {}
      const byCategoryMap: Record<string, any> = {}
      let subItemErrorTotal = 0
      let subItemErrorUnresolved = 0
      let subItemErrorResolved = 0

      const itemsArray = (data as any[]) || []
      itemsArray.forEach(item => {
        summary.total++
        summary[item.status as keyof typeof summary]++

        if (item.sub_items && Array.isArray(item.sub_items)) {
          item.sub_items.forEach((sub: any) => {
            if (sub.error_details) {
              subItemErrorTotal++
              if (sub.error_details.is_resolved) subItemErrorResolved++
              else subItemErrorUnresolved++
            }
          })
        }

        if (!byDateMap[item.date]) {
          byDateMap[item.date] = { date: item.date, total: 0, done: 0, error: 0, in_progress: 0, pending: 0 }
        }
        byDateMap[item.date].total++
        byDateMap[item.date][item.status]++

        const userName = item.assigned_user?.name || 'Chưa giao'
        if (!byUserMap[userName]) {
          byUserMap[userName] = { name: userName, total: 0, done: 0, error: 0, in_progress: 0, pending: 0 }
        }
        byUserMap[userName].total++
        byUserMap[userName][item.status]++

        const catName = item.category?.name || 'Khác'
        if (!byCategoryMap[catName]) {
          byCategoryMap[catName] = { 
            name: catName, total: 0, done: 0, error: 0, 
            icon: item.category?.icon || '📁',
            color: item.category?.color || '#6366f1'
          }
        }
        byCategoryMap[catName].total++
        if (item.status === 'done') byCategoryMap[catName].done++
        if (item.status === 'error') byCategoryMap[catName].error++
      })

      setStats({
        summary,
        byDate: Object.values(byDateMap).sort((a, b) => a.date.localeCompare(b.date)),
        byUser: Object.values(byUserMap),
        byCategory: Object.values(byCategoryMap),
        subItemErrorTotal,
        subItemErrorUnresolved,
        subItemErrorResolved,
        _rawItems: data
      } as any)
      setError(null)
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Kết nối chậm, đang thử lại...')
        // Auto-retry after 3s
        setTimeout(() => { isLoadingRef.current = false; loadStats() }, 3000)
        return
      }
      console.error('Dashboard load error:', err)
      setError(err?.message || 'Không thể tải dữ liệu')
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }

  // Auto-refresh every 60 seconds silently in background
  useEffect(() => {
    // If stats are empty, do a non-silent fetch.
    // If we already have stats (e.g. from switching tabs), do a silent fetch in the background.
    const isSilentRefresh = stats !== null
    loadStats(isSilentRefresh)

    const interval = setInterval(() => loadStats(true), 60000)
    return () => clearInterval(interval)
  }, [period])

  const completionRate =
    stats?.summary.total
      ? Math.round((stats.summary.done / stats.summary.total) * 100)
      : 0

  const pieData = [
    { name: 'Hoàn thành', value: stats?.summary.done || 0, color: '#10b981' },
    { name: 'Đang làm', value: stats?.summary.in_progress || 0, color: '#f59e0b' },
    { name: 'Lỗi', value: stats?.summary.error || 0, color: '#ef4444' },
    { name: 'Chưa làm', value: stats?.summary.pending || 0, color: '#6b7280' },
  ].filter((d) => d.value > 0)

  const trendData = (stats?.byDate || []).map((d) => ({
    date: d.date.slice(5), // MM-DD
    'Hoàn thành': d.done,
    'Lỗi': d.error,
    'Tổng': d.total,
  }))

  const userData = (stats?.byUser || [])
    .filter((u) => u.name)
    .map((u) => ({
      name: u.name || 'Chưa giao',
      'Hoàn thành': u.done,
      'Lỗi': u.error,
      'Tổng': u.total,
    }))

  return (
    <div className={styles.page}>
      {/* Period filter */}
      <div className={styles.topBar}>
        <div className={styles.periodTabs}>
          {(['7d', '30d', 'thisMonth'] as const).map((p) => (
            <button
              key={p}
              className={`${styles.periodTab} ${period === p ? styles.periodTabActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === '7d' ? '7 Ngày' : p === '30d' ? '30 Ngày' : 'Tháng Này'}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/checklist')}>
          📋 Xem Checklist Hôm Nay
        </button>
      </div>

      {/* Subtle loading bar at top instead of blocking spinner */}
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 9999,
          background: 'linear-gradient(90deg, #6366f1, #10b981)', animation: 'pulse 1.5s infinite' }} />
      )}

      {/* Error banner */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 13 }}>⚠️ {error}</span>
          <button className="btn btn-sm" style={{ fontSize: 12 }} onClick={() => loadStats()}>🔄 Thử lại</button>
        </div>
      )}

      {/* Show skeleton only when no data yet AND loading */}
      {loading && !stats ? (
        <div className="empty-state">
          <div className="spinner" style={{ width: 36, height: 36 }} />
          <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Đang tải dữ liệu...</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className={styles.statsGrid}>
            <StatCard
              icon="📋"
              label="Tổng Checklist"
              value={stats?.summary.total || 0}
              color="var(--c-primary)"
              onClick={() => {
                setCurrentDate(new Date().toISOString().split('T')[0])
                navigate('/checklist')
              }}
            />
            <StatCard
              icon="✅"
              label="Hoàn Thành"
              value={stats?.summary.done || 0}
              color="var(--c-success)"
              sub={`${completionRate}% tỷ lệ`}
              onClick={() => {
                setCurrentDate(new Date().toISOString().split('T')[0])
                setFilters({ status: 'done' })
                navigate('/checklist')
              }}
            />
            <StatCard
              icon="❌"
              label="Lỗi Mục Con Tồn Đọ́ng"
              value={(stats as any)?.subItemErrorUnresolved || 0}
              color="var(--c-danger)"
              sub={(stats as any)?.subItemErrorResolved > 0 ? `Đã xử lý: ${(stats as any).subItemErrorResolved}` : undefined}
              onClick={() => {
                setCurrentDate(new Date().toISOString().split('T')[0])
                setFilters({ status: 'error' })
                navigate('/checklist')
              }}
            />
            <StatCard
              icon="⏳"
              label="Chưa Xử Lý"
              value={(stats?.summary.pending || 0) + (stats?.summary.in_progress || 0)}
              color="var(--c-warning)"
              onClick={() => {
                setCurrentDate(new Date().toISOString().split('T')[0])
                setFilters({ status: 'pending' })
                navigate('/checklist')
              }}
            />
          </div>

          {/* Charts Row 1 */}
          <div className={styles.chartRow}>
            {/* Trend chart */}
            <div className={`card ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>📈 Xu Hướng Hoàn Thành</h3>
              </div>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: '#8b8fa8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1a1c2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                      labelStyle={{ color: '#f1f2f8' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Hoàn thành" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Lỗi" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Tổng" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <span className="empty-icon">📊</span>
                  <p>Chưa có dữ liệu trong kỳ này</p>
                </div>
              )}
            </div>

            {/* Pie chart */}
            <div className={`card ${styles.chartCardSmall}`}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>🎯 Phân Bổ Trạng Thái</h3>
              </div>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1a1c2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.pieLegend}>
                    {pieData.map((d, i) => (
                      <div key={i} className={styles.pieLegendItem}>
                        <span className={styles.pieDot} style={{ background: d.color }} />
                        <span className={styles.pieName}>{d.name}</span>
                        <span className={styles.pieVal}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <span className="empty-icon">🎯</span>
                  <p>Chưa có dữ liệu</p>
                </div>
              )}
            </div>
          </div>

          {/* Charts Row 2 */}
          {userData.length > 0 && (
            <div className={`card ${styles.chartFull}`}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>👥 Hiệu Suất Nhân Sự</h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={userData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: '#8b8fa8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#8b8fa8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1c2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    labelStyle={{ color: '#f1f2f8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Hoàn thành" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Lỗi" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Tổng" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category breakdown */}
          {stats?.byCategory && stats.byCategory.length > 0 && (
            <div className={`card ${styles.categoryCard}`}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>📂 Theo Danh Mục</h3>
              </div>
              <div className={styles.categoryList}>
                {stats.byCategory.map((cat, i) => {
                  const rate = cat.total ? Math.round((cat.done / cat.total) * 100) : 0
                  return (
                    <div 
                      key={i} 
                      className={styles.categoryRow}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setCurrentDate(new Date().toISOString().split('T')[0])
                        // Assuming the category name can be used for search or we find ID
                        // Looking at the data load, we have category objects with name
                        // Let's try to find if we can filter by category_id
                        const catObj = (stats as any)?._rawItems?.find((it: any) => it.category?.name === cat.name)?.category
                        if (catObj?.id) {
                          setFilters({ category_id: catObj.id })
                        } else {
                          setFilters({ search: cat.name })
                        }
                        navigate('/checklist')
                      }}
                    >
                      <div className={styles.categoryInfo}>
                        <span className={styles.catIcon}>{cat.icon}</span>
                        <span className={styles.catName}>{cat.name || 'Khác'}</span>
                      </div>
                      <div className={styles.catBar}>
                        <div
                          className={styles.catBarFill}
                          style={{ width: `${rate}%`, background: cat.color || '#6366f1' }}
                        />
                      </div>
                      <div className={styles.catStats}>
                        <span className={styles.catRate}>{rate}%</span>
                        <span className={styles.catCount}>{cat.done}/{cat.total}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pending Errors Panel — Alert Style */}
          {(stats as any)?.subItemErrorUnresolved > 0 && (() => {
            type ErrorEntry = { parentTitle: string; subTitle: string; reported_to: string; handled_by: string; reported_at?: string; itemDate: string }
            const pendingErrors: ErrorEntry[] = []
            ;(stats as any)?._rawItems?.forEach((item: any) => {
              (item.sub_items || []).forEach((sub: any) => {
                if (sub.error_details && !sub.error_details.is_resolved) {
                  pendingErrors.push({
                    parentTitle: item.title,
                    subTitle: sub.title,
                    reported_to: sub.error_details.reported_to,
                    handled_by: sub.error_details.handled_by,
                    reported_at: sub.error_details.reported_at,
                    itemDate: item.date
                  })
                }
              })
            })
            return pendingErrors.length > 0 ? (
              <div style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderLeft: '4px solid #ef4444',
                borderRadius: 12,
                padding: '20px 24px',
                marginTop: 4
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 22 }}>🚨</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#ef4444', margin: 0 }}>
                    CÓ {pendingErrors.length} LỖI CHƯA ĐƯỢC XỬ LÝ TRONG KỲ NÀY
                  </h3>
                  <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
                    CẦN XỬ LÝ NGAY
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingErrors.map((e, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        setCurrentDate(e.itemDate)
                        setFilters({ search: e.parentTitle })
                        navigate('/checklist')
                      }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 8,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{e.parentTitle}</span>
                        <span style={{ color: '#ef4444', fontSize: 11 }}>›</span>
                        <span style={{ color: '#fca5a5' }}>{e.subTitle}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>({e.itemDate})</span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
                        {e.reported_to && <span>📢 <strong>{e.reported_to}</strong></span>}
                        {e.handled_by && <span>👤 {e.handled_by}</span>}
                        {e.reported_at && (
                          <span style={{ color: '#f87171' }}>
                            🕐 {new Date(e.reported_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          })()}
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color, sub, onClick }: {
  icon: string
  label: string
  value: number
  color: string
  sub?: string
  onClick?: () => void
}) {
  return (
    <div 
      className={`${styles.statCard} ${onClick ? styles.statCardClickable : ''}`} 
      style={{ '--card-color': color } as React.CSSProperties}
      onClick={onClick}
    >
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statBody}>
        <span className={styles.statValue}>{value.toLocaleString()}</span>
        <span className={styles.statLabel}>{label}</span>
        {sub && <span className={styles.statSub}>{sub}</span>}
      </div>
    </div>
  )
}
