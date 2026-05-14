import { createClient } from '@supabase/supabase-js'

// REPLACE THESE WITH YOUR SUPABASE PROJECT DETAILS
export const supabaseUrl = 'https://rsuiybfqgzcibqqjnnmn.supabase.co'
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzdWl5YmZxZ3pjaWJxcWpubm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDY4ODQsImV4cCI6MjA5MTEyMjg4NH0.AfIdh2Pw0Tjs3QNJWsPW904Mp0BU85C7JWhnjPSqU1Y'

// Custom No-op Lock Manager for Electron
// Bypasses the brittle Navigator LockManager which hangs in multi-process Electron
const noopLock = async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
  return await fn()
}

// In-memory fallback for environments where localStorage is flaky
const memoryStorage: Record<string, string> = {}

// Truly synchronous storage wrapper for Supabase compatibility
const SafeStorage = {
  getItem: (key: string): string | null => {
    try {
      const val = window.localStorage.getItem(key)
      if (val) memoryStorage[key] = val // Sync memory cache
      return val ?? memoryStorage[key] ?? null
    } catch (e) {
      console.warn('SafeStorage.getItem error, using memory fallback:', e)
      return memoryStorage[key] ?? null
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      window.localStorage.setItem(key, value)
      memoryStorage[key] = value // Sync memory cache
    } catch (e) {
      console.warn('SafeStorage.setItem error, using memory fallback:', e)
      memoryStorage[key] = value
    }
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key)
    } catch (e) {}
    delete memoryStorage[key]
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: SafeStorage,
    lock: noopLock as any, 
    broadcastTabEvents: true, // Enable to sync across tabs if needed
  },
  db: {
    schema: 'public',
  },
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, keepalive: true })
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 20, // Increase slightly for smoother updates
    },
    heartbeatIntervalMs: 15000, // Faster heartbeat (15s) to detect disconnects quicker
    reconnectAfterMs: (tries) => Math.min(tries * 1000, 5000), // Aggressive reconnection
  }
})

// Store original console methods
const originalWarn = console.warn
const originalError = console.error
const originalLog = console.log

/**
 * Suppress non-critical warnings and errors in Electron environment
 * These are safe to ignore:
 * - Supabase GoTrue LockManager warnings (Electron doesn't support it fully)
 * - Chromium GPU/disk cache errors
 * - DevTools protocol errors
 */
export function suppressLockManagerWarnings() {
  console.warn = (...args: any[]) => {
    const message = args.join(' ')
    
    // Suppress GoTrue LockManager warnings - safe in Electron
    if (message.includes('Navigator LockManager') || 
        (message.includes('Lock') && message.includes('sb-') && message.includes('auth-token')) ||
        message.includes('Forcefully acquiring the lock')) {
      return
    }
    
    // Pass through other warnings
    originalWarn(...args)
  }

  console.error = (...args: any[]) => {
    const message = args.join(' ')
    
    // Suppress non-critical Electron/Chromium errors
    if (
      message.includes('gpu_disk_cache') ||
      message.includes('disk_cache') ||
      message.includes('quota_database') ||
      message.includes('Autofill') ||
      message.includes('DevTools') ||
      message.includes('protocol_client')
    ) {
      return
    }
    
    // Pass through actual errors
    originalError(...args)
  }

  // Optional: suppress specific console.log patterns if needed
  console.log = (...args: any[]) => {
    const message = args.join(' ')
    
    // Only suppress if it's a Supabase GoTrue message about locks
    if (message.includes('@supabase/gotrue-js') && message.includes('Lock')) {
      return
    }
    
    originalLog(...args)
  }
}

// Suppress warnings on startup
if (typeof window !== 'undefined') {
  suppressLockManagerWarnings()
}

/**
 * SAFE AUTH WRAPPERS - Prevent "undefined session" crashes
 */

interface SafeQueryResult<T> {
  data: T | null
  error: any | null
  retry: () => Promise<SafeQueryResult<T>>
}

/**
 * Safe session getter with retry and timeout
 */
export async function getCurrentSession(): Promise<{session: any | null, user: any | null}> {
  try {
    // Race getSession against a timeout to prevent Electron hangs
    const { data, error } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 8000))
    ])
    
    if (error) {
      console.warn('getCurrentSession error reported by Supabase:', error.message)
      return { session: null, user: null }
    }
    return {
      session: data?.session ?? null,
      user: data?.session?.user ?? null
    }
  } catch (err: any) {
    console.warn('getCurrentSession exception:', err?.message || err)
    return { session: null, user: null }
  }
}

/**
 * Safe auth query wrapper - ensures session ready + retries + timeout
 */
export async function safeAuthQuery<T>(fn: () => Promise<T>, maxRetries = 2, timeoutMs = 15000): Promise<{data: T | null, error: any}> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 1. Ensure auth ready
      let { session } = await getCurrentSession()
      
      if (!session && attempt === 0) {
        console.log('safeAuthQuery: No session, triggering refresh...')
        const m = await import('./supabaseUtils')
        await m.refreshAuthSession().catch(() => {})
        // Re-check session
        const refreshed = await getCurrentSession()
        session = refreshed.session
      }
      
      // 2. Execute query with timeout
      const result = await Promise.race([
        fn(),
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error('Query execution timeout')), timeoutMs)
        )
      ])

      // If result looks like a Supabase response with error, throw it
      if (result && typeof result === 'object' && (result as any).error) {
        throw (result as any).error
      }
      
      return { data: result, error: null }
    } catch (err: any) {
      const message = err?.message || String(err)
      console.warn(`safeAuthQuery attempt ${attempt + 1} failed:`, message)
      
      if (attempt === maxRetries) return { data: null, error: err }
      
      // PRO-ACTIVE RECOVERY: If we failed once, or specifically with a JWT/Auth error
      const isAuthError = message.includes('JWT') || message.includes('401') || message.includes('session') || message.includes('timeout')
      
      if (attempt === 0 || isAuthError) {
        console.log('safeAuthQuery: Attempting pro-active connection reset and session refresh...')
        const m = await import('./supabaseUtils')
        await m.resetSupabaseConnection().catch(() => {})
        await m.refreshAuthSession().catch(() => {})
      }
      
      // Delay before retry
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  return { data: null, error: new Error('All retries failed') }
}

/**
 * Auth guard - throws if no valid session
 */
export async function ensureAuthReady(): Promise<void> {
  const { session } = await getCurrentSession()
  if (!session?.user) {
    throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.')
  }
}


