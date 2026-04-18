# TODO: Fix Supabase Auth Session Errors
Status: 0/13 COMPLETE ✅

## Plan Steps (Approved - User said "do all")

### 1. 🔧 Core Utils (supabase.ts + supabaseUtils.ts) ✅
- [x] Add safeAuthQuery wrapper to supabase.ts
- [x] Fix refreshAuthSession null checks in supabaseUtils.ts
- [x] Add ensureAuthReady() guard

### 2. 🏪 Stores (useChecklistStore.ts + useUserStore.ts)
- [x] Wrap fetchByDate in safeAuthQuery (useChecklistStore.ts line 87) ✅
- [ ] Enhance useUserStore initialize guard

### 3. 📊 Pages (DashboardPage.tsx + ChecklistPage.tsx + TemplatesPage.tsx)
- [x] Fix loadStats safe query (DashboardPage.tsx line 134) ✅
- [ ] ChecklistPage useEffect auth guard
- [ ] TemplatesPage load safety

### 4. ⚡ Hooks (useTemplateDraft.ts)
- [x] Fix checkAuthValidity null safety (line 119) ✅

### 5. 📄 Components (TemplateForm.tsx)
- [x] Read + fix handleSubmit auth ✅

### 6. 🌐 Global (App.tsx)
- [x] Add AuthProvider or useEffect init ✅

### 7. 🧪 Testing
- [ ] Test login → Dashboard/Checklist
- [ ] Clear localStorage test
- [ ] attempt_completion

**Next Step**: Implement supabase.ts + supabaseUtils.ts first (foundation)

