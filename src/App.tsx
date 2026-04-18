import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useUserStore } from './store/useUserStore'
import { useAppStore } from './store/useAppStore'
import { AppLayout } from './components/Layout/AppLayout'
import { LoginPage } from './pages/Login/LoginPage'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { ChecklistPage } from './pages/Checklist/ChecklistPage'
import { TemplatesPage } from './pages/Templates/TemplatesPage'
import { ReportsPage } from './pages/Reports/ReportsPage'
import { SettingsPage } from './pages/Settings/SettingsPage'
import { ToastContainer } from './components/Toast/ToastContainer'
import { UpdateNotification } from './components/Update/UpdateNotification'
import { supabase, suppressLockManagerWarnings } from './lib/supabase'

function App() {
  const { isLoggedIn, theme, setTheme, currentUser, initialize } = useUserStore()
  const { setSyncStatus } = useAppStore()
  const [appReady, setAppReady] = useState(false)

  useEffect(() => {
    // Suppress non-critical warnings on app start
    suppressLockManagerWarnings()

    // Apply saved theme
    document.documentElement.setAttribute('data-theme', theme)

    // Check session on mount
    const checkSession = async () => {
      // Set a hard timeout to prevent eternal spinner
      const timeout = setTimeout(() => {
        if (!appReady) {
          console.warn('Session check taking too long, forcing appReady...')
          setAppReady(true)
        }
      }, 8000)

      try {
        await initialize()
      } catch (err) {
        console.error('Auth init failed:', err)
      } finally {
        clearTimeout(timeout)
        setAppReady(true)
      }
    }

    checkSession()
  }, [])

  if (!appReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0b0f' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    )
  }

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          {/* Checklist: everyone with valid session can access */}
          <Route path="/checklist" element={<ChecklistPage />} />
          {/* Templates: admin always, staff only if templates.view permission */}
          <Route
            path="/templates"
            element={
              !currentUser
                ? <Navigate to="/dashboard" replace />
                : currentUser.role === 'admin' || currentUser.permissions?.templates?.view
                  ? <TemplatesPage />
                  : <Navigate to="/dashboard" replace />
            }
          />
          {/* Reports: admin always, staff only if reports.view permission */}
          <Route
            path="/reports"
            element={
              !currentUser
                ? <Navigate to="/dashboard" replace />
                : currentUser.role === 'admin' || currentUser.permissions?.reports?.view
                  ? <ReportsPage />
                  : <Navigate to="/dashboard" replace />
            }
          />
          {/* Settings: admin always, staff only if settings.view permission */}
          <Route
            path="/settings"
            element={
              !currentUser
                ? <Navigate to="/dashboard" replace />
                : currentUser.role === 'admin' || currentUser.permissions?.settings?.view
                  ? <SettingsPage />
                  : <Navigate to="/dashboard" replace />
            }
          />
        </Routes>
      </AppLayout>
      <UpdateNotification />
      <ToastContainer />
    </HashRouter>
  )
}

export default App
