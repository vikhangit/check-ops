import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useUserStore } from '../../store/useUserStore'
import { useAppStore } from '../../store/useAppStore'
import { useDataStore } from '../../store/useDataStore'
import { useChecklistStore } from '../../store/useChecklistStore'
import styles from './Sidebar.module.css'

const navItems = [
  { to: '/dashboard', icon: '⚡', label: 'Dashboard' },
  { to: '/checklist', icon: '✅', label: 'Checklist Hàng Ngày' },
  { to: '/templates', icon: '📋', label: 'Templates' },
  { to: '/reports', icon: '📊', label: 'Báo Cáo' },
  { to: '/settings', icon: '⚙️', label: 'Cài Đặt' },
]

export function Sidebar() {
  const { currentUser, logout, theme, setTheme } = useUserStore()
  const { syncStatus, toast } = useAppStore()
  const { loadTemplates } = useDataStore()
  const { currentDate, fetchByDate } = useChecklistStore()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      // 1. Force refresh auth session
      await useUserStore.getState().refreshSession()
      
      // 2. Refresh metadata and templates
      await loadTemplates()
      
      // 3. Refresh checklist items for current date
      await fetchByDate(currentDate)
      
      toast.success('Dữ liệu đã được làm mới')
    } catch (err) {
      console.error('Refresh data failed:', err)
      toast.error('Không thể làm mới dữ liệu - vui lòng kiểm tra kết nối')
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <span>✅</span>
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>CheckOps</span>
          <span className={styles.logoSub}>v5.0 Vận Hành</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          <span className={styles.navSectionLabel}>Menu Chính</span>
          {navItems.map((item) => {
            const isAdmin = currentUser?.role === 'admin'
            const perms = currentUser?.permissions

            // Admin sees everything. Staff sees based on permissions object.
            const canView = (() => {
              if (isAdmin) return true
              if (item.to === '/dashboard') return true   // everyone sees dashboard
              if (item.to === '/checklist') return true   // everyone sees checklist
              if (item.to === '/templates') return !!perms?.templates?.view
              if (item.to === '/reports')   return !!perms?.reports?.view
              if (item.to === '/settings')  return !!perms?.settings?.view
              return false
            })()

            if (!canView) return null

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* 🔄 Refresh / Reload Button — prominent, above Supabase status */}
      <div style={{ padding: '0 12px 10px' }}>
        <button
          onClick={refreshData}
          disabled={isRefreshing}
          title="Tải lại dữ liệu từ server"
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 10,
            border: '1.5px solid rgba(99,102,241,0.5)',
            background: isRefreshing 
              ? 'rgba(99,102,241,0.1)' 
              : 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 100%)',
            color: '#a5b4fc',
            fontSize: 13,
            fontWeight: 700,
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            letterSpacing: 0.3,
            transition: 'all 0.2s',
            opacity: isRefreshing ? 0.7 : 1,
          }}
          onMouseEnter={e => {
            if (isRefreshing) return
            (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.25) 100%)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#c7d2fe'
          }}
          onMouseLeave={e => {
            if (isRefreshing) return
            (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 100%)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.5)'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#a5b4fc'
          }}
        >
          {isRefreshing ? (
            <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
          ) : (
            <span style={{ fontSize: 16 }}>🔄</span>
          )}
          {isRefreshing ? 'Đang Tải...' : 'Làm Mới Dữ Liệu'}
        </button>
      </div>

      {/* Real-time status indicator */}
      <div className={styles.syncBar}>
        <span className={`${styles.syncDot} ${styles.syncDotIdle}`} />
        <span className={styles.syncLabel}>Supabase Real-time</span>
      </div>

      {/* User footer */}
      <div className={styles.userArea}>
        {/* Theme Toggle */}
        <button
          className={styles.themeToggle}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          data-tooltip={theme === 'dark' ? 'Chuyển Light Mode' : 'Chuyển Dark Mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* User info */}
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className={styles.userDetails}>
            <span className={styles.userName}>{currentUser?.name || 'Unknown'}</span>
            <span className={styles.userRole}>
              {currentUser?.role === 'admin' ? '👑 Admin' : '👤 Staff'}
            </span>
          </div>
        </div>

        <button className={styles.logoutBtn} onClick={logout} data-tooltip="Đăng xuất">
          🚪
        </button>
      </div>
    </aside>
  )
}
