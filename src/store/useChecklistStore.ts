import { create } from 'zustand'
import type { ChecklistItem, ChecklistFilters, SubItem } from '../types/electron'
import { supabase, safeAuthQuery } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ChecklistState {
  items: ChecklistItem[]
  loading: boolean
  currentDate: string
  lastLoadedDate: string | null
  filters: ChecklistFilters
  channel: RealtimeChannel | null

  setCurrentDate: (date: string) => void
  setFilters: (filters: Partial<ChecklistFilters>) => void
  clearFilters: () => void
  fetchByDate: (date: string) => Promise<void>
  fetchAll: (filters?: ChecklistFilters) => Promise<void>
  createItem: (data: Partial<ChecklistItem>) => Promise<ChecklistItem | null>
  updateItem: (id: string, data: Partial<ChecklistItem>) => Promise<ChecklistItem | null>
  updateStatus: (id: string, status: string, notes?: string, errorOptions?: { error_reported_at?: string, error_resolved_at?: string | null }) => Promise<void>
  deleteItem: (id: string) => Promise<boolean>
  duplicateFromDate: (fromDate: string) => Promise<number>
  generateFromTemplates: () => Promise<number>
  refreshByDate: (date: string) => Promise<void>
  subscribeToChanges: (date: string) => void
  unsubscribeFromChanges: () => void
}

const today = new Date().toISOString().split('T')[0]

export const useChecklistStore = create<ChecklistState>((set, get) => ({
  items: [],
  loading: false,
  currentDate: today,
  lastLoadedDate: null,
  filters: {},
  channel: null,

  setCurrentDate: (date) => {
    set({ currentDate: date, filters: {} })
    get().fetchByDate(date)
    get().subscribeToChanges(date)
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }))
  },

  clearFilters: () => {
    set({ filters: {} })
  },

  subscribeToChanges: (date: string) => {
    const { channel: existingChannel } = get()
    if (existingChannel) {
      existingChannel.unsubscribe()
    }

    console.log(`[Realtime] Subscribing to checklist_items for date: ${date}`)
    const channel = supabase
      .channel('checklist_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'checklist_items',
          filter: `date=eq.${date}`
        },
        async (payload) => {
          console.log('[Realtime] Change received:', payload.eventType)
          
          const newId = (payload.new as any)?.id
          const oldId = (payload.old as any)?.id

          if (payload.eventType === 'INSERT' && newId) {
            // Re-fetch joins (category/profile) for the new item
            const { data: item } = await safeAuthQuery(async () => {
               const { data, error } = await supabase
                .from('checklist_items')
                .select('*, category:categories(*), assigned_user:profiles!checklist_items_assigned_user_id_fkey(*)')
                .eq('id', newId)
                .single()
               if (error) throw error
               return data
            })
            if (item) {
              const mapped = {
                ...(item as any),
                category_name: (item as any).category?.name,
                category_color: (item as any).category?.color,
                category_icon: (item as any).category?.icon,
                assigned_user_name: (item as any).assigned_user?.name
              }
              set(state => ({ items: [...state.items.filter(i => i.id !== mapped.id), mapped] }))
            }
          } else if (payload.eventType === 'UPDATE' && newId) {
            set(state => ({
              items: state.items.map(i => i.id === newId ? { ...i, ...payload.new } : i)
            }))
          } else if (payload.eventType === 'DELETE' && oldId) {
            set(state => ({
              items: state.items.filter(i => i.id !== oldId)
            }))
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Status for ${date}:`, status)
      })

    set({ channel })
  },

  unsubscribeFromChanges: () => {
    const { channel } = get()
    if (channel) {
      channel.unsubscribe()
      set({ channel: null })
    }
  },

  fetchByDate: async (date: string) => {
    const { currentDate: existingDate, lastLoadedDate } = get()
    const isSilentRefresh = existingDate === date && lastLoadedDate === date
    if (!isSilentRefresh) set({ loading: true })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    try {
      const safeResult = await safeAuthQuery(async () => {
        const { data, error } = await supabase
          .from('checklist_items')
          .select(`
            *,
            category:categories(*),
            assigned_user:profiles!checklist_items_assigned_user_id_fkey(*)
          `)
          .eq('date', date)
          .order('sort_order', { ascending: true })
          .abortSignal(controller.signal)
        
        if (error) throw error
        return data
      })
      
      const { data, error } = safeResult
      if (error) throw error

      clearTimeout(timeout)

      const itemsArray = (data as any[]) || []
      const mapped = itemsArray.map((item: any) => ({
        ...item,
        category_name: item.category?.name,
        category_color: item.category?.color,
        category_icon: item.category?.icon,
        assigned_user_name: item.assigned_user?.name
      }))

      set({ items: mapped, currentDate: date, lastLoadedDate: date })
    } catch (error: any) {
      clearTimeout(timeout)
      console.error('fetchByDate error:', error)
    } finally {
      set({ loading: false })
    }
  },

  fetchAll: async (filters?: ChecklistFilters) => {
    set({ loading: true })
    try {
      const safeResult = await safeAuthQuery(async () => {
        let query = supabase
          .from('checklist_items')
          .select(`
            *,
            category:categories(*),
            assigned_user:profiles!checklist_items_assigned_user_id_fkey(*)
          `)

        if (filters?.date) query = query.eq('date', filters.date)
        if (filters?.status) query = query.eq('status', filters.status)
        if (filters?.category_id) query = query.eq('category_id', filters.category_id)
        
        const { data, error } = await query.order('date', { ascending: false })
        if (error) throw error
        return data
      })
      
      const { data, error } = safeResult
      if (error) throw error

      set({ 
        items: ((data as any[]) || []).map(item => ({
          ...item,
          category_name: item.category?.name,
          category_color: item.category?.color,
          category_icon: item.category?.icon,
          assigned_user_name: item.assigned_user?.name
        })) as any
      })
    } catch (error) {
      console.error('fetchAll error:', error)
    } finally {
      set({ loading: false })
    }
  },

  createItem: async (data: Partial<ChecklistItem>) => {
    try {
      const safeResult = await safeAuthQuery(async () => {
        const { data: item, error } = await supabase
          .from('checklist_items')
          .insert([{
            template_id: data.template_id,
            title: data.title,
            description: data.description,
            category_id: data.category_id,
            assigned_user_id: data.assigned_user_id,
            status: data.status || 'pending',
            date: data.date,
            priority: data.priority || 'normal',
            sort_order: data.sort_order || 0,
            sub_items: data.sub_items || []
          }])
          .select()
          .single()

        if (error) throw error
        return item
      })

      const { data: item, error } = safeResult
      if (error) throw error
      
      return item as any
    } catch (error) {
      console.error('createItem error:', error)
      return null
    }
  },

  updateItem: async (id: string, data: Partial<ChecklistItem>) => {
    try {
      const safeResult = await safeAuthQuery(async () => {
        const { items } = get()
        const currentItem = items.find(i => i.id === id)
        const finalData = { ...data }

        // Ghi nhận thời gian bắt đầu khi chuyển sang Đang làm
        if (data.status === 'in_progress' && !currentItem?.start_time) {
          (finalData as any).start_time = new Date().toISOString()
        }
        
        // Ghi nhận thời gian kết thúc khi chuyển sang Hoàn thành hoặc Lỗi
        if ((data.status === 'done' || data.status === 'error') && currentItem?.start_time && !currentItem?.end_time) {
          (finalData as any).end_time = new Date().toISOString()
        }

        const { data: updated, error } = await supabase
          .from('checklist_items')
          .update({
            ...finalData,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        return updated
      })

      const { data: updated, error } = safeResult
      if (error) throw error

      if (updated) {
        set(state => ({
          items: state.items.map(i => i.id === id ? { ...i, ...updated } : i)
        }))
      }

      return updated as any
    } catch (error) {
      console.error('updateItem error:', error)
      return null
    }
  },

  updateStatus: async (id: string, status: string, notes?: string, errorOptions?: { error_reported_at?: string, error_resolved_at?: string | null }) => {
    try {
      const { items } = get()
      const currentItem = items.find(i => i.id === id)
      
      const updatePayload: any = {
        status,
        notes: notes,
        check_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Ghi nhận thời gian bắt đầu khi chuyển sang Đang làm
      if (status === 'in_progress' && !currentItem?.start_time) {
        updatePayload.start_time = new Date().toISOString()
      }
      
      // Ghi nhận thời gian kết thúc khi chuyển sang Hoàn thành hoặc Lỗi
      if ((status === 'done' || status === 'error') && currentItem?.start_time && !currentItem?.end_time) {
        updatePayload.end_time = new Date().toISOString()
      }

      if (errorOptions) {
        if (errorOptions.error_reported_at !== undefined) updatePayload.error_reported_at = errorOptions.error_reported_at
        if (errorOptions.error_resolved_at !== undefined) updatePayload.error_resolved_at = errorOptions.error_resolved_at
      }

      const safeResult = await safeAuthQuery(async () => {
        const { error } = await supabase
          .from('checklist_items')
          .update(updatePayload)
          .eq('id', id)
        if (error) throw error
        return true
      })

      if (safeResult.error) throw safeResult.error

      set(state => ({
        items: state.items.map(i => i.id === id ? { ...i, ...updatePayload } : i)
      }))
    } catch (error) {
      console.error('updateStatus error:', error)
    }
  },

  deleteItem: async (id: string) => {
    try {
      const safeResult = await safeAuthQuery(async () => {
        const { error } = await supabase
          .from('checklist_items')
          .delete()
          .eq('id', id)
        if (error) throw error
        return true
      })

      return !safeResult.error
    } catch (error) {
      console.error('deleteItem error:', error)
      return false
    }
  },

  duplicateFromDate: async (fromDate: string) => {
    const { currentDate } = get()
    try {
      const safeResult = await safeAuthQuery(async () => {
        // 1. Get source items
        const { data: sourceItems, error: fetchError } = await supabase
          .from('checklist_items')
          .select('*')
          .eq('date', fromDate)

        if (fetchError) throw fetchError
        if (!sourceItems || sourceItems.length === 0) return 0

        // 2. Prepare new items
        const newItems = sourceItems.map(item => ({
          template_id: item.template_id,
          title: item.title,
          description: item.description,
          category_id: item.category_id,
          assigned_user_id: item.assigned_user_id,
          status: 'pending',
          date: currentDate,
          priority: item.priority,
          sort_order: item.sort_order,
          sub_items: (item.sub_items || []).map((s: any) => ({ ...s, status: 'pending', notes: '' }))
        }))

        // 3. Insert in bulk
        const { error: insertError } = await supabase.from('checklist_items').insert(newItems)
        if (insertError) throw insertError

        return newItems.length
      })

      const { data: count, error } = safeResult
      if (error) throw error

      if (count && count > 0) await get().fetchByDate(currentDate)
      return count || 0
    } catch (error) {
      console.error('duplicateFromDate error:', error)
      return 0
    }
  },

  generateFromTemplates: async () => {
    const { currentDate } = get()
    try {
      const safeResult = await safeAuthQuery(async () => {
        // 1. Get active templates
        const { data: templates, error: fetchError } = await supabase
          .from('checklist_templates')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })

        if (fetchError) throw fetchError
        if (!templates || templates.length === 0) return 0

        // 2. Prepare new items
        const newItems = templates.map(tpl => ({
          template_id: tpl.id,
          title: tpl.title,
          description: tpl.description,
          category_id: tpl.category_id,
          assigned_user_id: tpl.assigned_user_id,
          status: 'pending',
          date: currentDate,
          priority: tpl.priority,
          sort_order: tpl.sort_order,
          sub_items: (tpl.sub_items || []).map((s: any) => ({ ...s, status: 'pending', notes: '' }))
        }))

        // 3. Insert in bulk
        const { error: insertError } = await supabase.from('checklist_items').insert(newItems)
        if (insertError) throw insertError

        return newItems.length
      })

      const { data: count, error } = safeResult
      if (error) throw error

      if (count && count > 0) await get().fetchByDate(currentDate)
      return count || 0
    } catch (error) {
      console.error('generateFromTemplates error:', error)
      return 0
    }
  },

  refreshByDate: async (date: string) => {
    await get().fetchByDate(date)
  },
}))
