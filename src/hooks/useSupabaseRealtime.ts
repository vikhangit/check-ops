import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useChecklistStore } from '../store/useChecklistStore'
import { useUserStore } from '../store/useUserStore'
import { useAppStore } from '../store/useAppStore'
import { checkAndRecoverAuthState, hardReconnect } from '../lib/supabaseUtils'

export function useSupabaseRealtime() {
  const { fetchByDate, currentDate } = useChecklistStore()
  const { refreshSession } = useUserStore()
  const { toast } = useAppStore()
  
  // Ref để theo dõi session để tránh re-init thừa thãi
  const initialized = useRef(false)

  useEffect(() => {
    let checklistChannel: any
    let categoryChannel: any
    let templateChannel: any

    const setupChannels = () => {
      console.log('Setting up Real-time channels...')
      
      // 1. Subscribe to Checklist Items
      checklistChannel = supabase
        .channel('checklist-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, async (payload) => {
          const affectedItem = payload.new as any || payload.old as any
          if (affectedItem && affectedItem.date === currentDate) {
            await fetchByDate(currentDate)
            if (payload.eventType === 'INSERT') toast.info('Có nhiệm vụ mới vừa được thêm')
          }
        })
        .subscribe()

      // 2. Subscribe to Categories
      categoryChannel = supabase.channel('category-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {})
        .subscribe()

      // 3. Subscribe to Templates
      templateChannel = supabase.channel('template-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_templates' }, () => {})
        .subscribe()
    }

    // --- 1. HEARTBEAT MECHANISM ---
    const heartbeat = setInterval(async () => {
       const { error } = await supabase.from('profiles').select('id').limit(1).single()
       if (error && (error.message.includes('JWT') || error.message.includes('401'))) {
          console.warn('Heartbeat: Session invalid, triggering hard reconnect...')
          const success = await hardReconnect()
          if (success) setupChannels()
       }
    }, 30000)

    // --- 2. RESUME/VISIBILITY RECOVERY ---
    const handleVisibilityChange = async () => {
       if (document.visibilityState === 'visible') {
          console.log('App resumed: Executing professional reconnect sequence...')
          const success = await hardReconnect()
          if (success) {
            setupChannels()
            await fetchByDate(currentDate).catch(() => {})
          }
       }
    }

    const handleOnline = () => {
       console.log('Online: Triggering reconnect...')
       hardReconnect().then(success => { if (success) setupChannels() })
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    // Initial Setup
    setupChannels()

    return () => {
      clearInterval(heartbeat)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      supabase.removeAllChannels()
    }
  }, [currentDate, fetchByDate, toast])
}
