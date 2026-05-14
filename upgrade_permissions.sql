-- MIGRATION TO SUPPORT MULTIPLE ASSIGNEES AND RESPONSIBILITY
-- Run this script in your Supabase SQL Editor

BEGIN;

-- 1. Add new columns to checklist_templates
ALTER TABLE public.checklist_templates 
ADD COLUMN IF NOT EXISTS assigned_user_ids UUID[] DEFAULT '{}'::UUID[],
ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Add new columns to checklist_items
ALTER TABLE public.checklist_items
ADD COLUMN IF NOT EXISTS assigned_user_ids UUID[] DEFAULT '{}'::UUID[];

-- 3. Migrate data from assigned_user_id to assigned_user_ids array
-- For templates
UPDATE public.checklist_templates
SET assigned_user_ids = ARRAY[assigned_user_id],
    responsible_user_id = assigned_user_id
WHERE assigned_user_id IS NOT NULL;

-- For items
UPDATE public.checklist_items
SET assigned_user_ids = ARRAY[assigned_user_id]
WHERE assigned_user_id IS NOT NULL;

-- 4. Drop old columns
ALTER TABLE public.checklist_templates DROP COLUMN IF EXISTS assigned_user_id;
ALTER TABLE public.checklist_items DROP COLUMN IF EXISTS assigned_user_id;

-- 5. Update RLS Policies for checklist_items
DROP POLICY IF EXISTS "Checklist items viewable by everyone" ON public.checklist_items;
DROP POLICY IF EXISTS "Update checklist items based on permission" ON public.checklist_items;

-- Anyone can view
CREATE POLICY "Checklist items viewable by everyone" ON public.checklist_items FOR SELECT USING (true);

-- Update logic: Admin OR Responsible person OR Assigned person
CREATE POLICY "Update checklist items based on permission" ON public.checklist_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND (
      p.role = 'admin' 
      OR (p.permissions->'checklist'->>'edit')::boolean = true
    )
  )
  OR auth.uid() = ANY(assigned_user_ids)
  OR auth.uid() IN (
    SELECT responsible_user_id FROM public.checklist_templates WHERE id = checklist_items.template_id
  )
);

-- 6. Update RLS Policies for checklist_templates
DROP POLICY IF EXISTS "Templates viewable by everyone" ON public.checklist_templates;
DROP POLICY IF EXISTS "Update templates based on permission" ON public.checklist_templates;
DROP POLICY IF EXISTS "Delete templates based on permission" ON public.checklist_templates;

CREATE POLICY "Templates viewable by everyone" ON public.checklist_templates FOR SELECT USING (true);

CREATE POLICY "Update templates based on permission" ON public.checklist_templates FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND (
      p.role = 'admin' 
      OR (p.permissions->'templates'->>'edit')::boolean = true
    )
  )
  OR auth.uid() = responsible_user_id
);

CREATE POLICY "Delete templates based on permission" ON public.checklist_templates FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND (
      p.role = 'admin' 
      OR (p.permissions->'templates'->>'delete')::boolean = true
    )
  )
  OR auth.uid() = responsible_user_id
);

COMMIT;
