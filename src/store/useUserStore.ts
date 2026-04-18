import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types/electron'
import { supabase, getCurrentSession } from '../lib/supabase'
import { queryWithRetry } from '../lib/supabaseUtils'

interface UserState {
  currentUser: User | null
  isLoggedIn: boolean
  theme: 'dark' | 'light'
  login: (user: User) => void
  logout: () => Promise<void>
  setTheme: (theme: 'dark' | 'light') => void
  initialize: () => Promise<void>
  refreshSession: () => Promise<boolean>
}

const DEFAULT_PERMISSIONS = {
  checklist: { view: true, add: true, edit: true, delete: false },
  templates: { view: false, add: false, edit: false, delete: false },
  reports: { view: false, add: false, edit: false, delete: false },
  settings: { view: false, add: false, edit: false, delete: false }
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => {
      const updateStore = async (user: any) => {
        if (!user) {
          set({ currentUser: null, isLoggedIn: false })
          return
        }
        
        try {
          // Use queryWithRetry and timeout for profile fetch
          const profileResult = await queryWithRetry(
            () => supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single(),
            2,
            500,
            10000 // 10s timeout
          ).catch(err => {
            console.warn('Profile query failed during updateStore, using fallback:', err)
            return { data: null, error: err }
          })

          const profile = profileResult.data
          const profileError = profileResult.error

          if (profile && !profileError) {
            // If staff but no permissions set, use defaults
            const perms = profile.role === 'admin' 
              ? undefined 
              : (profile.permissions || DEFAULT_PERMISSIONS)

            set({ 
              currentUser: { 
                id: user.id, 
                name: profile.name, 
                role: profile.role,
                avatar: profile.avatar || profile.avatar_url || '',
                permissions: perms,
                is_active: profile.is_active ? 1 : 0,
                created_at: profile.created_at,
                email: user.email
              }, 
              isLoggedIn: true 
            })
          } else {
            // Profile missing or DB error (schema issue)
            console.warn('Profile not found during init, using fallback:', profileError)
            set({
              currentUser: {
                id: user.id,
                name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                role: (user.email === 'tranphuong0512@gmail.com' ? 'admin' : 'staff'),
                avatar: '',
                is_active: 1,
                created_at: user.created_at,
                email: user.email,
                permissions: (user.email === 'tranphuong0512@gmail.com' ? undefined : DEFAULT_PERMISSIONS)
              },
              isLoggedIn: true
            })
          }
        } catch (err) {
          console.error('updateStore internal error:', err)
          // Ensure app doesn't break
          set({ isLoggedIn: !!user }) 
        }
      }

      return {
        currentUser: null,
        isLoggedIn: false,
        theme: 'dark',

        login: (user) => {
          set({ currentUser: user, isLoggedIn: true })
        },

        logout: async () => {
          await supabase.auth.signOut()
          set({ currentUser: null, isLoggedIn: false })
        },

        setTheme: (theme) => {
          set({ theme })
          document.documentElement.setAttribute('data-theme', theme)
        },

        initialize: async () => {
          try {
            console.log('UserStore initialize starting...')
            
            // Listen for auth changes early - important for Electron lifecycle
            supabase.auth.onAuthStateChange(async (event, session) => {
              console.log('Auth event received:', event)
              if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
                if (session?.user) {
                  // Wait for updateStore to finish without blocking entire initialize
                  updateStore(session.user).catch(err => console.error('updateStore in onAuthStateChange failed:', err))
                }
              } else if (event === 'SIGNED_OUT') {
                set({ currentUser: null, isLoggedIn: false })
              }
            })

            // Use getCurrentSession with safety timeout
            const { session } = await getCurrentSession()
            if (session?.user) {
              await updateStore(session.user)
            }
          } catch (err) {
            console.error('UserStore initialization failed:', err)
            // Still set app as ready even if we can't find a session
            set({ isLoggedIn: false, currentUser: null })
          } finally {
            console.log('UserStore initialize completed.')
          }
        },

        refreshSession: async () => {
          try {
            console.log('Manually refreshing session...')
            const { data, error } = await supabase.auth.refreshSession()
            if (error) throw error
            if (data.session?.user) {
              await updateStore(data.session.user)
              return true
            }
            return false
          } catch (err) {
            console.error('Manual refreshSession failed:', err)
            return false
          }
        }
      }
    },
    {
      name: 'user-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isLoggedIn: state.isLoggedIn,
        theme: state.theme,
      }),
    }
  )
)
