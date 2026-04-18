import { supabase, safeAuthQuery } from './supabase'

/**
 * Retry wrapper for Supabase queries with exponential backoff
 * Handles auth lock timeouts and network issues
 * Default timeout: 12 seconds per attempt (resilient for slow networks)
 */
export async function queryWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 400,
  timeoutMs = 12000
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wrap request with timeout
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs / 1000}s`)), timeoutMs)
        )
      ])
    } catch (err: any) {
      lastError = err
      const isLastAttempt = attempt === maxRetries - 1
      console.warn(`Query attempt ${attempt + 1}/${maxRetries} failed:`, err.message)
      
      if (!isLastAttempt) {
        // Exponential backoff: 500ms, 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // Force refresh auth session before retry
        if (err.message?.includes('lock') || err.message?.includes('401') || err.message?.includes('timeout')) {
          console.log('Refreshing auth session...')
          await refreshAuthSession()
        }
      }
    }
  }
  
  throw lastError || new Error('Query failed after all retries')
}

/**
 * Singleton promise to prevent concurrent auth refreshes
 */
let refreshPromise: Promise<void> | null = null

export async function refreshAuthSession(): Promise<void> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      console.log('--- Auth Refresh Started ---')
      if (!supabase?.auth) throw new Error('Auth client uninitialized')

      // 1. First, check if we have a session in storage/memory at all
      const { data: { session: currentSession } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      
      if (!currentSession) {
         console.log('No current session, attempting full refreshSession() from storage...')
         const { data, error } = await supabase.auth.refreshSession().catch(err => ({ data: { session: null }, error: err }))
         if (error) {
            console.error('Full refreshSession failed:', error.message)
         } else if (data.session) {
            console.log('Successfully re-established session from storage.')
            return
         }
      }

      // 2. If we HAVE a session, check its health/expiry
      if (currentSession?.access_token) {
        const expiresAt = currentSession.expires_at ? currentSession.expires_at * 1000 : 0
        const timeUntilExpiry = expiresAt - Date.now()
        
        // Refresh if within 20 mins or already expired
        if (timeUntilExpiry < 20 * 60 * 1000) {
          console.log(`Session expiring in ${Math.round(timeUntilExpiry / 60000)}m, refreshing...`)
          const { error } = await supabase.auth.refreshSession().catch(err => ({ error: err }))
          if (error) console.error('Token refresh failed:', error.message)
        } else {
          // If the session is supposedly valid but we're having issues, 
          // force a quick heartbeat to ensure the token actually works
          try {
            const { error: pingError } = await supabase.from('profiles').select('id').limit(1).single()
            if (pingError && (pingError.message?.includes('JWT') || pingError.message?.includes('401'))) {
               console.warn('JWT invalid despite expiry, forcing hard refresh...')
               await supabase.auth.refreshSession().catch(() => {})
            }
          } catch (e) {
            console.warn('Ping error during refresh check:', e)
          }
        }
      }
    } catch (err: any) {
      console.error('refreshAuthSession core error:', err.message)
    } finally {
      console.log('--- Auth Refresh Ended ---')
      refreshPromise = null
    }
  })()

  // Add an absolute safety timeout for the SINGLETON itself (20s)
  setTimeout(() => { if (refreshPromise) refreshPromise = null }, 20000)

  return refreshPromise
}

/**
 * Force a session refresh and return the session
 */
export async function forceRefreshSession() {
  const { data, error } = await supabase.auth.refreshSession()
  if (error) throw error
  return data.session
}

/**
 * Singleton lock for reconnection process
 */
let isReconnecting = false

/**
 * 4-Step Professional Reconnect:
 * 1. SINGLE RECONNECT LOCK -> Tránh spam
 * 2. REFRESH AUTH FIRST -> Tránh JWT error
 * 3. DISCONNECT -> WAIT -> CONNECT -> Tránh socket bug
 * 4. CLEAR OLD CHANNELS -> Tránh duplicate
 */
export async function hardReconnect(): Promise<boolean> {
  if (isReconnecting) {
    console.log('Reconnection already in progress, skipping...')
    return false
  }

  isReconnecting = true
  console.log('--- Starting Hard Reconnect Sequence ---')

  try {
    // 1. Clear all old channels first to prevent duplicates/leaks
    console.log('Step 1: Clearing all channels...')
    await supabase.removeAllChannels()

    // 2. Refresh Auth Session to get a fresh JWT
    console.log('Step 2: Refreshing auth session...')
    const { data: { session }, error: authError } = await supabase.auth.refreshSession()
    if (authError) {
      console.warn('Auth refresh failed during reconnect:', authError.message)
    }

    // 3. Socket Reset: Disconnect -> Wait -> Connect
    console.log('Step 3: Resetting socket connection...')
    supabase.realtime.disconnect()
    
    // Wait 500ms for clean closure
    await new Promise(resolve => setTimeout(resolve, 500))
    
    supabase.realtime.connect()
    console.log('Step 4: Socket connection re-established.')
    
    return true
  } catch (err) {
    console.error('Hard reconnect failed:', err)
    return false
  } finally {
    isReconnecting = false
    console.log('--- Reconnect Sequence Finished ---')
  }
}

/**
 * Reset Supabase client - useful when connection hangs
 */
export async function resetSupabaseConnection(): Promise<void> {
  await hardReconnect()
}

/**
 * Check if auth is in a stuck state and recover
 */
export async function checkAndRecoverAuthState(): Promise<boolean> {
  try {
    console.log('Checking auth state health...')
    // Try a simple profile fetch to see if we're actually connected
    // If this hangs for 4s, we assume the connection is dead
    const result = await Promise.race([
      supabase.from('profiles').select('id').limit(1),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Health check hung')), 4000))
    ]).catch(err => ({ error: err }))
    
    if (result.error) {
      console.warn('Health check failed, performing connection reset...')
      await resetSupabaseConnection()
      await refreshAuthSession().catch(() => {})
      return true
    }
    console.log('Auth state is healthy.')
    return false
  } catch (err: any) {
    console.warn('Auth recovery exception:', err?.message || err)
    await resetSupabaseConnection()
    await refreshAuthSession().catch(() => {})
    return true
  }
}

