/**
 * useDataStore — Global cache for metadata and report data.
 * Persists between tab switches so pages don't reload from scratch each time.
 */
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { queryWithRetry, refreshAuthSession } from '../lib/supabaseUtils'
import type { Category, User, ChecklistTemplate } from '../types/electron'
import type { StatsResult } from '../types/electron'

interface DataState {
  // Metadata
  categories: Category[]
  users: User[]
  templates: ChecklistTemplate[]
  metaLoaded: boolean

  // Report cache
  reportItems: any[]
  reportFilters: {
    dateFrom: string
    dateTo: string
    status: string
    category_id: string
    assigned_user_id: string
    search: string
  } | null
  reportLoading: boolean

  // Dashboard cache
  dashboardStats: StatsResult | null
  dashboardPeriod: '7d' | '30d' | 'thisMonth'
  setDashboardStats: (stats: StatsResult | null) => void
  setDashboardPeriod: (period: '7d' | '30d' | 'thisMonth') => void

  // Actions
  loadMeta: () => Promise<void>
  loadTemplates: () => Promise<void>
  loadReport: (filters: {
    dateFrom: string
    dateTo: string
    status: string
    category_id: string
    assigned_user_id: string
    search: string
  }) => Promise<void>
  reorderTemplates: (ids: string[]) => Promise<void>
}

const today = new Date().toISOString().split('T')[0]
const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

export const useDataStore = create<DataState>((set, get) => ({
  categories: [],
  users: [],
  templates: [],
  metaLoaded: false,
  reportItems: [],
  reportFilters: null,
  reportLoading: false,

  dashboardStats: null,
  dashboardPeriod: '7d',
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  setDashboardPeriod: (period) => set({ dashboardPeriod: period }),

  loadMeta: async () => {
    // Skip if already loaded recently
    if (get().metaLoaded && get().categories.length > 0) return
    try {
      const [{ data: cats }, { data: profiles }] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('profiles').select('*').order('name'),
      ])
      set({
        categories: (cats || []) as any,
        users: (profiles || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          avatar: p.avatar_url,
          is_active: p.is_active ? 1 : 0,
          created_at: p.created_at,
        })) as any,
        metaLoaded: true,
      })
    } catch (err) {
      console.error('loadMeta error:', err)
    }
  },

  loadTemplates: async () => {
    // If already have templates cached, refresh silently without blocking
    const hasCached = get().templates.length > 0
    if (!hasCached) {
      // Do nothing special, just fetch
    }
    try {
      // Use retry logic to handle auth lock timeouts
      const [{ data: tpls }, { data: cats }, { data: profiles }] = await Promise.all([
        queryWithRetry(() => supabase.from('checklist_templates').select('*').order('sort_order', { ascending: true })),
        queryWithRetry(() => supabase.from('categories').select('*').order('sort_order', { ascending: true })),
        queryWithRetry(() => supabase.from('profiles').select('*').order('name')),
      ])
      set({
        templates: (tpls || []) as any,
        categories: (cats || []) as any,
        users: (profiles || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          avatar: p.avatar_url,
          is_active: p.is_active ? 1 : 0,
          created_at: p.created_at,
        })) as any,
        metaLoaded: true,
      })
    } catch (err) {
      console.error('loadTemplates error after retries:', err)
      // Try one more recovery attempt
      try {
        await refreshAuthSession()
      } catch (recoveryErr) {
        console.error('Recovery attempt failed:', recoveryErr)
      }
    }
  },

  loadReport: async (filters) => {
    set({ reportLoading: true })
    try {
      let query = supabase
        .from('checklist_items')
        .select(`
          *,
          category:categories(*),
          assigned_user:profiles!checklist_items_assigned_user_id_fkey(*)
        `)
        .gte('date', filters.dateFrom)
        .lte('date', filters.dateTo)

      if (filters.status) query = query.eq('status', filters.status)
      if (filters.category_id) query = query.eq('category_id', filters.category_id)
      if (filters.assigned_user_id) query = query.eq('assigned_user_id', filters.assigned_user_id)
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      const { data, error } = await query
        .order('date', { ascending: false })
        .order('sort_order', { ascending: true })

      if (error) throw error

      const mapped = (data || []).map(item => ({
        ...item,
        category_name: (item as any).category?.name,
        category_color: (item as any).category?.color,
        category_icon: (item as any).category?.icon,
        assigned_user_name: (item as any).assigned_user?.name,
        // Ensure sub_items is always an array
        sub_items: Array.isArray((item as any).sub_items) ? (item as any).sub_items : [],
      }))

      set({ reportItems: mapped, reportFilters: filters })
    } catch (err) {
      console.error('loadReport error:', err)
      throw err
    } finally {
      set({ reportLoading: false })
    }
  },

  reorderTemplates: async (ids: string[]) => {
    try {
      // Optimistic update
      const { templates } = get()
      const reordered = ids.map((id, index) => {
        const tpl = templates.find(t => t.id === id)
        return { ...tpl, sort_order: index + 1 } as ChecklistTemplate
      })
      set({ templates: reordered })

      // Real update to Supabase
      for (let i = 0; i < ids.length; i++) {
        const newOrder = i + 1
        // 1. Update Template
        await supabase
          .from('checklist_templates')
          .update({ sort_order: newOrder } as any)
          .eq('id', ids[i])
        
        // 2. Update existing items to match (optional since step 1 handles it via join, but good for consistency)
        await supabase
          .from('checklist_items')
          .update({ sort_order: newOrder } as any)
          .eq('template_id', ids[i])
      }
    } catch (err) {
      console.error('reorderTemplates error:', err)
    }
  },
}))
