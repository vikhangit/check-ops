-- HỆ THỐNG QUẢN LÝ THEO DÕI - DATABASE SETUP
-- Copy và chạy script này trong Supabase SQL Editor

-- 1. XÓA NẾU ĐÃ TỒN TẠI (Để reset sạch sẽ)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.checklist_items CASCADE;
DROP TABLE IF EXISTS public.checklist_templates CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. TẠO BẢNG PROFILES (Lưu thông tin người dùng)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  avatar TEXT,
  permissions JSONB DEFAULT '{"checklist":{"view":true,"add":true,"edit":true,"delete":false},"templates":{"view":false,"add":false,"edit":false,"delete":false},"reports":{"view":false,"add":false,"edit":false,"delete":false},"settings":{"view":false,"add":false,"edit":false,"delete":false}}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TẠO BẢNG CATEGORIES (Danh mục công việc)
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_type TEXT NOT NULL DEFAULT 'system',
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT '📋',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TẠO BẢNG CHECKLIST TEMPLATES (Các mẫu công việc lặp lại)
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id TEXT PRIMARY KEY DEFAULT 'tpl-' || substr(gen_random_uuid()::text, 1, 8),
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  assigned_user_ids UUID[] DEFAULT '{}'::UUID[],
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  sub_items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TẠO BẢNG CHECKLIST ITEMS (Các công việc thực tế theo ngày)
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id TEXT REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  assigned_user_ids UUID[] DEFAULT '{}'::UUID[],
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'error')),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  check_time TIMESTAMPTZ,
  notes TEXT,
  result TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sub_items JSONB DEFAULT '[]'::jsonb,
  error_reported_at TIMESTAMPTZ,
  error_resolved_at TIMESTAMPTZ
);

-- 6. THIẾT LẬP ROW LEVEL SECURITY (RLS)
-- Cho phép mọi người xem dữ liệu nếu đã đăng nhập hoặc tùy chỉnh theo nhu cầu
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- Các chính sách (Policies)
-- Profiles: Mọi người xem được. Tự cập nhật hồ sơ của mình (nhưng không được tự sửa role/permissions). Admin sửa tất cả.
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can update ALL profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "Admin can delete ALL profiles" ON public.profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
-- Categories: Phân quyền theo JSONB 'templates'
CREATE POLICY "Categories viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Insert categories based on permission" ON public.categories FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'templates'->>'add')::boolean = true))
);
CREATE POLICY "Update categories based on permission" ON public.categories FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'templates'->>'edit')::boolean = true))
);
CREATE POLICY "Delete categories based on permission" ON public.categories FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'templates'->>'delete')::boolean = true))
);

-- Templates: Phân quyền theo JSONB 'templates'
CREATE POLICY "Templates viewable by everyone" ON public.checklist_templates FOR SELECT USING (true);
CREATE POLICY "Insert templates based on permission" ON public.checklist_templates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'templates'->>'add')::boolean = true))
);
CREATE POLICY "Update templates based on permission" ON public.checklist_templates FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'templates'->>'edit')::boolean = true))
);
CREATE POLICY "Delete templates based on permission" ON public.checklist_templates FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'templates'->>'delete')::boolean = true))
);

-- Checklist Items: Phân quyền theo JSONB 'checklist'
-- Tạm gộp mọi quyền viết vào add/edit/delete
CREATE POLICY "Checklist items viewable by everyone" ON public.checklist_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'checklist'->>'view')::boolean = true))
);
CREATE POLICY "Insert checklist items based on permission" ON public.checklist_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'checklist'->>'add')::boolean = true))
);
CREATE POLICY "Update checklist items based on permission" ON public.checklist_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'checklist'->>'edit')::boolean = true))
);
CREATE POLICY "Delete checklist items based on permission" ON public.checklist_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'admin' OR (p.permissions->'checklist'->>'delete')::boolean = true))
);

-- 7. TRIGGER TỰ ĐỘNG TẠO PROFILE VÀ GÁN ADMIN
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE 
      WHEN NEW.email = 'tranphuong0512@gmail.com' THEN 'admin' 
      ELSE 'staff' 
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. CẬP NHẬT TÀI KHOẢN HIỆN CÓ THÀNH ADMIN (Nếu đã lỡ đăng ký trước đó)
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'tranphuong0512@gmail.com';

-- 9. DỮ LIỆU BAN ĐẦU (Dựa trên migration_data.sql)
-- Categories
INSERT INTO public.categories (id, name, group_type, color, icon, sort_order) 
VALUES 
('cat-web-001', 'Website', 'system', '#6366f1', '🌐', 1),
('cat-tool-001', 'Tools Nội Bộ', 'system', '#8b5cf6', '🔧', 2),
('cat-app-001', 'Ứng Dụng', 'system', '#06b6d4', '📱', 3),
('cat-bot-001', 'Chatbot AI', 'system', '#10b981', '🤖', 4),
('cat-api-001', 'API / Server', 'system', '#f59e0b', '⚡', 5),
('cat-zalo-001', 'Zalo OA', 'customer', '#0068ff', '💬', 6),
('cat-fb-001', 'Facebook Page', 'customer', '#1877f2', '📘', 7),
('cat-wchat-001', 'Website Chatbox', 'customer', '#059669', '💻', 8),
('cat-other-001', 'Kênh Khác', 'customer', '#dc2626', '📡', 9)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name, 
  group_type = EXCLUDED.group_type, 
  color = EXCLUDED.color, 
  icon = EXCLUDED.icon, 
  sort_order = EXCLUDED.sort_order;

-- Templates
INSERT INTO public.checklist_templates (id, title, description, category_id, priority, is_active, sort_order)
VALUES 
('tpl-001', 'Kiểm tra website hoạt động', 'Truy cập website chính và kiểm tra tất cả trang chủ, sản phẩm, liên hệ', 'cat-web-001', 'high', true, 1),
('tpl-002', 'Kiểm tra tốc độ tải trang', 'Dùng PageSpeed Insights để đánh giá hiệu suất', 'cat-web-001', 'normal', true, 2),
('tpl-003', 'Kiểm tra API server status', 'Ping API endpoints và kiểm tra response time', 'cat-api-001', 'high', true, 3),
('tpl-004', 'Kiểm tra Chatbot AI phản hồi', 'Test các kịch bản hội thoại cơ bản', 'cat-bot-001', 'normal', true, 4),
('tpl-005', 'Check tin nhắn Zalo OA', 'Kiểm tra và phản hồi tin nhắn chưa đọc trên Zalo OA', 'cat-zalo-001', 'high', true, 5),
('tpl-006', 'Check tin nhắn Facebook Page', 'Kiểm tra inbox và comment trên Facebook Page', 'cat-fb-001', 'high', true, 6),
('tpl-007', 'Kiểm tra form liên hệ website', 'Test form submit và xác nhận email nhận về', 'cat-web-001', 'normal', true, 7)
ON CONFLICT (id) DO UPDATE SET 
  title = EXCLUDED.title, 
  description = EXCLUDED.description, 
  category_id = EXCLUDED.category_id, 
  priority = EXCLUDED.priority, 
  is_active = EXCLUDED.is_active, 
  sort_order = EXCLUDED.sort_order;

-- 10. ĐỒNG BỘ TẤT CẢ TÀI KHOẢN ĐÃ ĐĂNG KÝ TRƯỚC ĐÓ VÀO BẢNG PROFILES (Sửa lỗi PGRST116 và RLS 403)
INSERT INTO public.profiles (id, name, email, role, avatar)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  au.email,
  CASE WHEN au.email = 'tranphuong0512@gmail.com' THEN 'admin' ELSE 'staff' END,
  au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 11. THÊM TRƯỜNG THỜI GIAN LỖI (CHỈ CHẠY NẾU UPDATE TỪ BẢN CŨ)
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS error_reported_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.checklist_items ADD COLUMN IF NOT EXISTS error_resolved_at TIMESTAMP WITH TIME ZONE;
