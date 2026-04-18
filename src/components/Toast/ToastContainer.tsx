import { useAppStore } from '../../store/useAppStore'
import styles from './ToastContainer.module.css'

const toastIcons = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
}

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]}`}
          onClick={() => removeToast(toast.id)}
        >
          <span className={styles.icon}>{toastIcons[toast.type]}</span>
          <span className={styles.message}>{toast.message}</span>
          <button className={styles.close}>✕</button>
        </div>
      ))}
    </div>
  )
}
