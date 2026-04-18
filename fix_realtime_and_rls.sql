-- 1. KÍCH HOẠT REALTIME CHO CÁC BẢNG QUAN TRỌNG
-- Mặc định Supabase không bật realtime cho bảng, phải chạy lệnh này:
BEGIN;
  -- Kiểm tra xem bảng đã có trong publication chưa, nếu chưa thì thêm vào
  DO $$ 
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'checklist_items'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_items;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'checklist_templates'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_templates;
    END IF;
  END $$;

  -- Bật REPLICA IDENTITY FULL để nhận được toàn bộ dữ liệu khi UPDATE/DELETE
  ALTER TABLE public.checklist_items REPLICA IDENTITY FULL;
  ALTER TABLE public.checklist_templates REPLICA IDENTITY FULL;
COMMIT;

-- 2. ĐẢM BẢO QUYỀN TRUY CẬP (RLS) KHÔNG BỊ CHẶN
-- Đôi khi chính sách RLS cũ bị xung đột. Lệnh này đảm bảo Admin và User đã login có quyền tối thiểu.

-- Đảm bảo profiles luôn xem được bởi user đã login (để join data)
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- Đảm bảo checklist_items có thể được xem bởi đúng người
DROP POLICY IF EXISTS "Checklist items viewable by everyone" ON public.checklist_items;
CREATE POLICY "Checklist items viewable by everyone" ON public.checklist_items FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'checklist'->>'view')::boolean = true))
  )
);

-- Cho phép Realtime lắng nghe (Realtime yêu cầu quyền SELECT)
-- Chạy lệnh này để đảm bảo realtime không bị chặn bởi RLS:
ALTER TABLE public.checklist_items FORCE ROW LEVEL SECURITY;
