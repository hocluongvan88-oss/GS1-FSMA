-- 1. Chèn hoặc cập nhật thông tin admin vào bảng public
INSERT INTO public.users (id, role, full_name)
VALUES ('2c18a610-a9b1-4aa2-91a1-c33565b82fc3', 'system_admin', 'Lương Văn Học')
ON CONFLICT (id) 
DO UPDATE SET role = 'system_admin';

-- 2. Kiểm tra lại ngay lập tức
SELECT * FROM public.users WHERE id = '2c18a610-a9b1-4aa2-91a1-c33565b82fc3';
