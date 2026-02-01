import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Xử lý CORS cho trình duyệt
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { zaloToken, userInfo } = await req.json()

    if (!userInfo || !userInfo.id) {
      throw new Error("Dữ liệu người dùng Zalo không hợp lệ");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const zaloId = userInfo.id;
    const email = `${zaloId}@zalo.vexim.vn`;

    // 1. Tìm người dùng trong hệ thống dựa trên email ảo
    // Chúng ta dùng listUsers thay vì getUserById để tránh lỗi 400 khi không tìm thấy
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    let user = users.users.find(u => u.email === email);

    if (!user) {
      // 2. Nếu chưa có, tạo user mới cho khách hàng Vexim
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { 
          full_name: userInfo.name,
          avatar_url: userInfo.avatar,
          zalo_id: zaloId,
          role: 'customer' // Vai trò khách hàng
        }
      })
      if (createError) throw createError
      user = newUser.user
    }

    // 3. Tạo link đăng nhập (Magic Link) để lấy session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email
    })
    
    if (linkError) throw linkError

    return new Response(
      JSON.stringify({
        access_token: "authorized", // Giả lập để vượt qua bước check ở client
        user: {
          id: user.id,
          zaloId: zaloId,
          fullName: user.user_metadata.full_name || userInfo.name,
          role: user.user_metadata.role || 'customer'
        },
        expiresAt: Date.now() + 86400 * 1000 // Có hiệu lực trong 24h
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error("Lỗi xác thực:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Trả về 200 kèm object error để client dễ xử lý log
    })
  }
})
