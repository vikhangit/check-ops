import { useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase, getCurrentSession } from '../lib/supabase'
import { refreshAuthSession } from '../lib/supabaseUtils'

const DRAFT_KEY = 'template_draft'
const PERIODIC_SAVE_INTERVAL = 60 * 1000 // 1 minute
const AUTH_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

export interface TemplateDraft {
  title: string
  description: string
  category_id: string
  assigned_user_ids: string[]
  responsible_user_id: string
  priority: 'low' | 'normal' | 'high'
  is_active: number
  subItems: Array<{ id: string; title: string }>
  savedAt: number
}

/**
 * Hook for auto-saving template draft to localStorage
 * Saves every time form changes, with debouncing, and periodically
 */
export function useTemplateDraft() {
  const periodicSaveRef = useRef<NodeJS.Timeout>()
  const lastDraftRef = useRef<Omit<TemplateDraft, 'savedAt'> | null>(null)
  
  const saveDraft = useCallback((draft: Omit<TemplateDraft, 'savedAt'>) => {
    try {
      lastDraftRef.current = draft
      const data: TemplateDraft = {
        ...draft,
        savedAt: Date.now(),
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
      console.log('Draft auto-saved to localStorage')
    } catch (err) {
      console.error('Failed to save draft:', err)
    }
  }, [])

  const loadDraft = useCallback((): TemplateDraft | null => {
    try {
      const data = localStorage.getItem(DRAFT_KEY)
      if (!data) return null
      
      const draft = JSON.parse(data) as TemplateDraft
      
      // Check if draft is older than 24 hours
      const ageInHours = (Date.now() - draft.savedAt) / (1000 * 60 * 60)
      if (ageInHours > 24) {
        clearDraft()
        return null
      }
      
      console.log(`Loaded draft from ${ageInHours.toFixed(1)} hours ago`)
      // Initialize ref with loaded draft
      lastDraftRef.current = draft
      return draft
    } catch (err) {
      console.error('Failed to load draft:', err)
      return null
    }
  }, [])

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY)
      lastDraftRef.current = null
      console.log('Draft cleared')
    } catch (err) {
      console.error('Failed to clear draft:', err)
    }
  }, [])

  // Start periodic saving when form is open
  const startPeriodicSave = useCallback(() => {
    if (periodicSaveRef.current) clearInterval(periodicSaveRef.current)
    
    periodicSaveRef.current = setInterval(() => {
      if (lastDraftRef.current) {
        saveDraft(lastDraftRef.current)
      }
    }, PERIODIC_SAVE_INTERVAL)
  }, [saveDraft])

  // Stop periodic saving
  const stopPeriodicSave = useCallback(() => {
    if (periodicSaveRef.current) {
      clearInterval(periodicSaveRef.current)
      periodicSaveRef.current = undefined
    }
  }, [])

  const result = useMemo(() => ({ 
    saveDraft, 
    loadDraft, 
    clearDraft, 
    startPeriodicSave, 
    stopPeriodicSave 
  }), [saveDraft, loadDraft, clearDraft, startPeriodicSave, stopPeriodicSave])

  return result
}

/**
 * Hook for keeping Supabase session alive while form is open
 * Validates session periodically and on window focus
 */
export function useSessionKeepAlive(isFormOpen: boolean) {
  const authCheckRef = useRef<NodeJS.Timeout>()
  
  useEffect(() => {
    if (!isFormOpen) {
      if (authCheckRef.current) clearInterval(authCheckRef.current)
      return
    }

    // Check auth validity
    const checkAuthValidity = async () => {
      try {
        const { session } = await getCurrentSession()
        if (!session) {
          console.warn('Auth session invalid, attempting refresh...')
          await refreshAuthSession().catch(() => {})
          return
        }

        const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
        const timeUntilExpiry = expiresAt - Date.now()
        const tenMinutes = 10 * 60 * 1000

        if (timeUntilExpiry < tenMinutes) {
          console.log('Session expiring soon, refreshing...')
          await refreshAuthSession().catch(() => {})
        }
      } catch (err) {
        console.warn('Auth validity check failed:', err)
      }
    }

    // Handler for window focus - pro-active recovery
    const handleFocus = () => {
      console.log('Window focused, checking auth state...')
      checkAuthValidity()
    }

    // Initial check
    checkAuthValidity()

    // Setup interval for periodic health check
    authCheckRef.current = setInterval(checkAuthValidity, AUTH_CHECK_INTERVAL)
    
    // Listen for focus to handle app switching
    window.addEventListener('focus', handleFocus)

    return () => {
      if (authCheckRef.current) clearInterval(authCheckRef.current)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isFormOpen])
}
