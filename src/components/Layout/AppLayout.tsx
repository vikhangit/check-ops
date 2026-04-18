import { ReactNode, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useChecklistStore } from '../../store/useChecklistStore'
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime'
import styles from './AppLayout.module.css'

interface Props {
  children: ReactNode
}

export function AppLayout({ children }: Props) {
  // Initialize Real-time Subscriptions
  useSupabaseRealtime()

  // Handle focus recovery when returning from another app
  useEffect(() => {
    const handleFocus = () => {
      // Small delay to ensure Electron has fully focused the window
      setTimeout(() => {
        const activeElement = document.activeElement as HTMLElement
        if (
          activeElement && 
          (activeElement.tagName === 'INPUT' || 
           activeElement.tagName === 'TEXTAREA' || 
           activeElement.hasAttribute('contenteditable'))
        ) {
          activeElement.focus()
        }
      }, 50)
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <Header />
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  )
}
