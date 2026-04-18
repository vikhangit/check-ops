-- MIGRATION DATA FROM SQLITE
BEGIN;

-- Categories
INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at) 
VALUES ('cat-web-001', 'Website', 'system', '#6366f1', '🌐', 1, '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, group_type = EXCLUDED.group_type, color = EXCLUDED.color, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;
INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at) 
VALUES ('cat-tool-001', 'Tools Nội Bộ', 'system', '#8b5cf6', '🔧', 2, '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, group_type = EXCLUDED.group_type, color = EXCLUDED.color, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;
INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at) 
VALUES ('cat-app-001', 'Ứng Dụng', 'system', '#06b6d4', '📱', 3, '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, group_type = EXCLUDED.group_type, color = EXCLUDED.color, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;
INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at) 
VALUES ('cat-bot-001', 'Chatbot AI', 'system', '#10b981', '🤖', 4, '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, group_type = EXCLUDED.group_type, color = EXCLUDED.color, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;
INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at) 
VALUES ('cat-api-001', 'API / Server', 'system', '#f59e0b', '⚡', 5, '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, group_type = EXCLUDED.group_type, color = EXCLUDED.color, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;
INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at) 
VALUES ('cat-zalo-001', 'Zalo OA', 'customer', '#0068ff', '💬', 6, '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, group_type = EXCLUDED.group_type, color = EXCLUDED.color, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;
INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at) 
VALUES ('cat-fb-001', 'Facebook Page', 'customer', '#1877f2', '📘', 7, '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, group_type = EXCLUDED.group_type, color = EXCLUDED.color, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;
INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at) 
VALUES ('cat-wchat-001', 'Website Chatbox', 'customer', '#059669', '💻', 8, '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, group_type = EXCLUDED.group_type, color = EXCLUDED.color, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;
INSERT INTO categories (id, name, group_type, color, icon, sort_order, created_at) 
VALUES ('cat-other-001', 'Kênh Khác', 'customer', '#dc2626', '📡', 9, '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, group_type = EXCLUDED.group_type, color = EXCLUDED.color, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;

-- Profiles (Note: Users must exist in Auth first)
INSERT INTO profiles (id, name, email, role, avatar, created_at)
VALUES ('c7da1fcd-45d3-4324-9a66-33fbfe494b4b', 'thanhgiang', '', 'staff', '', '2026-04-07T05:59:35.432Z')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, avatar = EXCLUDED.avatar;
INSERT INTO profiles (id, name, email, role, avatar, created_at)
VALUES ('user-admin-001', 'Admin', 'admin@local', 'admin', '', '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, avatar = EXCLUDED.avatar;

-- Templates
INSERT INTO checklist_templates (id, title, description, category_id, assigned_user_id, priority, is_active, sort_order, sub_items, created_at)
VALUES ('tpl-001', 'Kiểm tra website hoạt động', 'Truy cập website chính và kiểm tra tất cả trang chủ, sản phẩm, liên hệ', NULL, NULL, 'high', 1, 1, '[]', '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, category_id = EXCLUDED.category_id, assigned_user_id = EXCLUDED.assigned_user_id, priority = EXCLUDED.priority, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_templates (id, title, description, category_id, assigned_user_id, priority, is_active, sort_order, sub_items, created_at)
VALUES ('tpl-002', 'Kiểm tra tốc độ tải trang', 'Dùng PageSpeed Insights để đánh giá hiệu suất', NULL, NULL, 'normal', 1, 2, '[]', '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, category_id = EXCLUDED.category_id, assigned_user_id = EXCLUDED.assigned_user_id, priority = EXCLUDED.priority, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_templates (id, title, description, category_id, assigned_user_id, priority, is_active, sort_order, sub_items, created_at)
VALUES ('tpl-003', 'Kiểm tra API server status', 'Ping API endpoints và kiểm tra response time', NULL, NULL, 'high', 1, 3, '[]', '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, category_id = EXCLUDED.category_id, assigned_user_id = EXCLUDED.assigned_user_id, priority = EXCLUDED.priority, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_templates (id, title, description, category_id, assigned_user_id, priority, is_active, sort_order, sub_items, created_at)
VALUES ('tpl-004', 'Kiểm tra Chatbot AI phản hồi', 'Test các kịch bản hội thoại cơ bản', NULL, NULL, 'normal', 0, 4, '[]', '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, category_id = EXCLUDED.category_id, assigned_user_id = EXCLUDED.assigned_user_id, priority = EXCLUDED.priority, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_templates (id, title, description, category_id, assigned_user_id, priority, is_active, sort_order, sub_items, created_at)
VALUES ('tpl-005', 'Check tin nhắn Zalo OA', 'Kiểm tra và phản hồi tin nhắn chưa đọc trên Zalo OA', NULL, NULL, 'high', 0, 5, '[]', '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, category_id = EXCLUDED.category_id, assigned_user_id = EXCLUDED.assigned_user_id, priority = EXCLUDED.priority, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_templates (id, title, description, category_id, assigned_user_id, priority, is_active, sort_order, sub_items, created_at)
VALUES ('tpl-006', 'Check tin nhắn Facebook Page', 'Kiểm tra inbox và comment trên Facebook Page', NULL, NULL, 'high', 0, 6, '[]', '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, category_id = EXCLUDED.category_id, assigned_user_id = EXCLUDED.assigned_user_id, priority = EXCLUDED.priority, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_templates (id, title, description, category_id, assigned_user_id, priority, is_active, sort_order, sub_items, created_at)
VALUES ('tpl-007', 'Kiểm tra form liên hệ website', 'Test form submit và xác nhận email nhận về', NULL, NULL, 'normal', 0, 7, '[]', '2026-04-07 03:04:17')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, category_id = EXCLUDED.category_id, assigned_user_id = EXCLUDED.assigned_user_id, priority = EXCLUDED.priority, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, sub_items = EXCLUDED.sub_items;

-- Checklist Items
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('54e78b1f-355b-4b92-b02d-19bad94551a1', 'tpl-001', 'Kiểm tra website hoạt động', 'Truy cập website chính và kiểm tra tất cả trang chủ, sản phẩm, liên hệ', NULL, NULL, 'done', '2026-04-07T04:13:02.015Z', 'ok', '2026-04-07', 'high', 1, NULL, '2026-04-07T03:05:36.253Z', '2026-04-07T04:13:02.015Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('0a2625c2-1bf2-43d8-85e6-7d99750948ec', 'tpl-002', 'Kiểm tra tốc độ tải trang', 'Dùng PageSpeed Insights để đánh giá hiệu suất', NULL, NULL, 'done', '2026-04-07T04:27:41.366Z', 'ee', '2026-04-07', 'normal', 2, NULL, '2026-04-07T03:05:36.253Z', '2026-04-07T04:27:41.366Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('984c2717-1bbf-4488-95ca-a4d14fef6e46', 'tpl-003', 'Kiểm tra API server status', 'Ping API endpoints và kiểm tra response time', NULL, NULL, 'pending', NULL, '', '2026-04-07', 'high', 3, NULL, '2026-04-07T03:05:36.253Z', '2026-04-07T03:05:36.253Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('cc58cebd-6a90-414c-b53d-6c3a9f6e5feb', 'tpl-004', 'Kiểm tra Chatbot AI phản hồi', 'Test các kịch bản hội thoại cơ bản', NULL, NULL, 'done', '2026-04-07T05:11:09.841Z', '', '2026-04-07', 'normal', 4, NULL, '2026-04-07T03:05:36.253Z', '2026-04-07T05:11:09.841Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('43526ec9-cff8-4e9a-9394-1b3eca03f512', 'tpl-005', 'Check tin nhắn Zalo OA', 'Kiểm tra và phản hồi tin nhắn chưa đọc trên Zalo OA', NULL, NULL, 'pending', NULL, '', '2026-04-07', 'high', 5, NULL, '2026-04-07T03:05:36.253Z', '2026-04-07T03:05:36.253Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('315de647-d4c2-424a-814f-88533361e8eb', 'tpl-006', 'Check tin nhắn Facebook Page', 'Kiểm tra inbox và comment trên Facebook Page', NULL, NULL, 'pending', NULL, '', '2026-04-07', 'high', 6, NULL, '2026-04-07T03:05:36.253Z', '2026-04-07T03:05:36.253Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('3c1647b1-5ecd-4d02-8db8-fba3ae8ec057', 'tpl-007', 'Kiểm tra form liên hệ website', 'Test form submit và xác nhận email nhận về', NULL, NULL, 'pending', NULL, '', '2026-04-07', 'normal', 7, NULL, '2026-04-07T03:05:36.253Z', '2026-04-07T03:05:36.253Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('2d32cb0a-4d52-4441-89f5-860bd4d2e4cd', NULL, 'kiểm tra', '', NULL, NULL, 'done', '2026-04-07T06:40:41.455Z', 'frsdfs', '2026-04-07', 'normal', 0, NULL, '2026-04-07T03:06:07.309Z', '2026-04-07T06:41:26.539Z', '[{"id":"62db567f-f964-4225-82b8-552b91aa01f5","title":"fdfdf","status":"done","notes":"","error_details":{"description":"12","reported_to":"12","handled_by":"12","is_resolved":true}},{"id":"d3febfae-601c-43fd-9d05-f3950fa0d0a9","title":"1","status":"done","notes":"","error_details":{"description":"12","reported_to":"12","handled_by":"12","is_resolved":true}},{"id":"40ea0f91-18c9-4edf-8363-589d728b888a","title":"2","status":"done","notes":"","error_details":{"description":"13123123","reported_to":"123123","handled_by":"123123","is_resolved":true}},{"id":"4dfbec22-911b-4207-a964-8cb3734731c3","title":"3","status":"done","notes":""},{"id":"0649ad4b-1bd1-4106-92e4-5388fedf46e1","title":"4","status":"done","notes":""},{"id":"195893a8-7ae8-41db-a4f9-d9c6021e0e55","title":"5","status":"done","notes":""}]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('5c241016-1b79-4123-9026-ca6d4bde4d99', 'tpl-001', 'Kiểm tra website hoạt động', 'Truy cập website chính và kiểm tra tất cả trang chủ, sản phẩm, liên hệ', NULL, NULL, 'pending', NULL, '', '2026-04-06', 'high', 1, NULL, '2026-04-07T06:18:24.215Z', '2026-04-07T06:18:24.215Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('e860e2c0-946e-4191-bb30-60fc3e8b70d5', 'tpl-002', 'Kiểm tra tốc độ tải trang', 'Dùng PageSpeed Insights để đánh giá hiệu suất', NULL, NULL, 'pending', NULL, '', '2026-04-06', 'normal', 2, NULL, '2026-04-07T06:18:24.215Z', '2026-04-07T06:18:24.215Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('21094e6b-a308-40da-8599-6d4c16a50d14', 'tpl-003', 'Kiểm tra API server status', 'Ping API endpoints và kiểm tra response time', NULL, NULL, 'pending', NULL, '', '2026-04-06', 'high', 3, NULL, '2026-04-07T06:18:24.215Z', '2026-04-07T06:18:24.215Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('87d49adc-2354-4e0a-aba8-daeab0a531e5', NULL, 'Kiểm tra hệ thống', 'Check web/app/chatbot, đơn hàng, lỗi 
', NULL, NULL, 'done', NULL, '', '2026-04-07', 'normal', 0, NULL, '2026-04-07T06:58:07.354Z', '2026-04-07T06:58:07.354Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('e4463dcb-8b0b-4769-a213-418510eaa624', NULL, 'CSKH công nghệ 	 ', 'Trả lời khách, hỗ trợ sử dụng ', NULL, NULL, 'done', '2026-04-07T07:10:49.196Z', '', '2026-04-07', 'normal', 0, NULL, '2026-04-07T07:01:43.548Z', '2026-04-07T07:10:49.196Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('a8fa4748-2bef-451b-91a5-5e2de9ed9d0d', NULL, 'Kiểm tra website hoạt động', 'Truy cập website chính và kiểm tra tất cả trang chủ, sản phẩm, liên hệ', NULL, NULL, 'pending', NULL, '', '2026-04-07', 'high', 0, NULL, '2026-04-07T06:55:18.567Z', '2026-04-07T06:55:18.567Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('2a5fa932-7647-45c7-b106-c1edb018e895', NULL, 'Kiểm tra tốc độ tải trang', 'Dùng PageSpeed Insights để đánh giá hiệu suất', NULL, NULL, 'pending', NULL, '', '2026-04-07', 'normal', 0, NULL, '2026-04-07T06:55:18.567Z', '2026-04-07T06:55:18.567Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('ba5dd26b-1c6f-4163-9d42-f31f7d79769a', NULL, 'Kiểm tra API server status', 'Ping API endpoints và kiểm tra response time', NULL, NULL, 'pending', NULL, '', '2026-04-07', 'high', 0, NULL, '2026-04-07T06:55:18.567Z', '2026-04-07T06:55:18.567Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('18e912b9-5dfb-44ad-b0a6-b0694dcc8397', NULL, 'Kiểm tra Chatbot AI phản hồi', 'Test các kịch bản hội thoại cơ bản', NULL, NULL, 'done', '2026-04-07T07:14:12.500Z', '', '2026-04-07', 'normal', 0, NULL, '2026-04-07T06:55:18.567Z', '2026-04-07T07:14:12.500Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('ecee2c4e-8d90-4320-b0ec-c084d69ec4bc', NULL, 'Check tin nhắn Zalo OA', 'Kiểm tra và phản hồi tin nhắn chưa đọc trên Zalo OA', NULL, NULL, 'pending', NULL, '', '2026-04-07', 'high', 0, NULL, '2026-04-07T06:55:18.567Z', '2026-04-07T06:55:18.567Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('dd01691c-2e15-4230-a64f-865c7b58b52b', NULL, 'Check tin nhắn Facebook Page', 'Kiểm tra inbox và comment trên Facebook Page', NULL, NULL, 'pending', NULL, '', '2026-04-07', 'high', 0, NULL, '2026-04-07T06:55:18.567Z', '2026-04-07T06:55:18.567Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('31f5d6a6-0cda-452a-81e7-9203db363335', NULL, 'Kiểm tra form liên hệ website', 'Test form submit và xác nhận email nhận về', NULL, NULL, 'pending', NULL, '', '2026-04-07', 'normal', 0, NULL, '2026-04-07T06:55:18.567Z', '2026-04-07T06:55:18.567Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('c4233d4b-a6d6-4178-a910-c059db05c259', NULL, 'Báo cáo dữ liệu 	', 'Tổng hợp user, đơn, doanh thu ', NULL, NULL, 'done', '2026-04-07T07:13:14.738Z', '', '2026-04-07', 'normal', 0, NULL, '2026-04-07T07:10:32.960Z', '2026-04-07T07:13:14.738Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;
INSERT INTO checklist_items (id, template_id, title, description, category_id, assigned_user_id, status, check_time, notes, date, priority, sort_order, created_by, created_at, updated_at, sub_items)
VALUES ('edefc888-d949-4172-a543-06fb32124c2a', NULL, 'Quản lý hệ thống 	', 'Kiểm tra chatbot, CRM, tích hợp ', NULL, NULL, 'in_progress', NULL, '', '2026-04-07', 'normal', 0, NULL, '2026-04-07T07:13:05.427Z', '2026-04-07T07:13:05.427Z', '[]')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, check_time = EXCLUDED.check_time, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, sub_items = EXCLUDED.sub_items;

COMMIT;