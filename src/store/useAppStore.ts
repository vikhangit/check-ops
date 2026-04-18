import { create } from 'zustand'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

interface AppState {
  toasts: Toast[]
  isSyncing: boolean
  syncStatus: 'idle' | 'syncing' | 'error'

  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  setSyncStatus: (status: 'idle' | 'syncing' | 'error') => void
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
    warning: (message: string) => void
  }
}

export const useAppStore = create<AppState>((set) => ({
  toasts: [],
  isSyncing: false,
  syncStatus: 'idle',

  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },

  setSyncStatus: (status) => {
    set({ syncStatus: status, isSyncing: status === 'syncing' })
  },

  toast: {
    success: (message) => {
      const id = Math.random().toString(36).slice(2)
      set((state) => ({
        toasts: [...state.toasts, { id, type: 'success', message }],
      }))
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, 4000)
    },
    error: (message) => {
      const id = Math.random().toString(36).slice(2)
      set((state) => ({
        toasts: [...state.toasts, { id, type: 'error', message }],
      }))
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, 5000)
    },
    info: (message) => {
      const id = Math.random().toString(36).slice(2)
      set((state) => ({
        toasts: [...state.toasts, { id, type: 'info', message }],
      }))
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, 4000)
    },
    warning: (message) => {
      const id = Math.random().toString(36).slice(2)
      set((state) => ({
        toasts: [...state.toasts, { id, type: 'warning', message }],
      }))
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, 4000)
    },
  },
}))
