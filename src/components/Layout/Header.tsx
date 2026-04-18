import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { useUserStore } from '../../store/useUserStore'
import styles from './Header.module.css'

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Tổng quan hệ thống vận hành' },
  '/checklist': { title: 'Checklist Hàng Ngày', subtitle: 'Quản lý công việc vận hành theo ngày' },
  '/templates': { title: 'Templates', subtitle: 'Mẫu checklist cố định tự động tạo mỗi ngày' },
  '/reports': { title: 'Báo Cáo', subtitle: 'Thống kê và phân tích hiệu suất vận hành' },
  '/settings': { title: 'Cài Đặt', subtitle: 'Cấu hình hệ thống và đồng bộ Google Sheets' },
}

export function Header() {
  const location = useLocation()
  const routeInfo = routeTitles[location.pathname] || { title: 'CheckOps', subtitle: '' }
  const { syncStatus } = useAppStore()
  const { currentUser } = useUserStore()
  const now = new Date()

  const dateStr = now.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div>
          <h1 className={styles.title}>{routeInfo.title}</h1>
          <p className={styles.subtitle}>{routeInfo.subtitle}</p>
        </div>
      </div>

      <div className={styles.right}>
        {/* Date */}
        <div className={styles.dateChip}>
          <span className={styles.dateIcon}>📅</span>
          <span className={styles.dateText}>{dateStr}</span>
        </div>

        {/* Sync Status */}
        {syncStatus === 'syncing' && (
          <div className={styles.syncChip}>
            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            <span>Đang đồng bộ...</span>
          </div>
        )}

        {/* User badge */}
        <div className={styles.userChip}>
          <div className={styles.userDot} />
          <span className={styles.userChipName}>{currentUser?.name}</span>
        </div>
      </div>
    </header>
  )
}
