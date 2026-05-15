-- FIX MISSING COLUMN 'responsible_user_id' IN 'checklist_items'
-- Run this script in your Supabase SQL Editor

ALTER TABLE public.checklist_items 
ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Optionally sync from template if needed
UPDATE public.checklist_items i
SET responsible_user_id = t.responsible_user_id
FROM public.checklist_templates t
WHERE i.template_id = t.id AND i.responsible_user_id IS NULL;
