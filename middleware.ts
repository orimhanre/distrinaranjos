import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Force HTTPS redirect in production
  if (process.env.NODE_ENV === 'production' && !request.headers.get('x-forwarded-proto')?.includes('https')) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301);
  }

  // Check if the request is for an admin route
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // For admin routes, we'll let the client-side handle authentication
    // This middleware is mainly for future server-side protection if needed
    return NextResponse.next();
  }

  // For non-admin routes, continue normally
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 