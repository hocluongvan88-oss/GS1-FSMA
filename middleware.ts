import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes - không cần đăng nhập
  const publicRoutes = ['/auth/login', '/auth/signup', '/dl']
  const isPublicRoute = publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

  // Homepage - redirect based on auth status
  if (request.nextUrl.pathname === '/') {
    if (!user) {
      return response // Show welcome page
    }
    // Redirect authenticated users to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Allow access to public routes
  if (isPublicRoute) {
    return response
  }

  // Protected dashboard routes - require authentication
  const isDashboardRoute = 
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/analytics') ||
    request.nextUrl.pathname.startsWith('/audit') ||
    request.nextUrl.pathname.startsWith('/products') ||
    request.nextUrl.pathname.startsWith('/locations') ||
    request.nextUrl.pathname.startsWith('/batches') ||
    request.nextUrl.pathname.startsWith('/partners') ||
    request.nextUrl.pathname.startsWith('/certifications') ||
    request.nextUrl.pathname.startsWith('/shipments') ||
    request.nextUrl.pathname.startsWith('/events') ||
    request.nextUrl.pathname.startsWith('/input') ||
    request.nextUrl.pathname.startsWith('/ai-review') ||
    request.nextUrl.pathname.startsWith('/admin')

  // Redirect unauthenticated users to login
  if (!user && isDashboardRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Get user role from database
  if (user) {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('[v0] Middleware: Error fetching user role:', error)
        // Allow access but don't enforce role-based restrictions if query fails
        return response
      }

      if (userData?.role) {
        // Store role in header for use in components
        response.headers.set('x-user-role', userData.role)
        
        // Role-based route protection
        const path = request.nextUrl.pathname

        // Admin routes - only for system_admin and admin
        if (path.startsWith('/admin')) {
          if (!['system_admin', 'admin'].includes(userData.role)) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
          }
        }

        // Admin & Factory Manager only routes
        if (path.startsWith('/products') || path.startsWith('/locations') || path.startsWith('/partners')) {
          if (!['system_admin', 'admin', 'factory_manager'].includes(userData.role)) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
          }
        }

        // Quality Inspector can't modify data
        if (userData.role === 'quality_inspector') {
          if (request.method !== 'GET' && !path.includes('/certifications')) {
            return new NextResponse('Unauthorized', { status: 403 })
          }
        }

        // Auditor - read-only access
        if (userData.role === 'auditor') {
          if (request.method !== 'GET') {
            return new NextResponse('Unauthorized', { status: 403 })
          }
        }
      }
    } catch (error) {
      console.error('[v0] Middleware: Exception fetching user role:', error)
      // Allow access on error to prevent blocking legitimate users
      return response
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
