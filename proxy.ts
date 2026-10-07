import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/session';

// Route-group gating only — NOT the authorization layer (TRD.md §11). Each route
// handler still calls requireSession()/requirePlatformSession() for the real,
// DB-backed role + tenant check. This only decides whether to bounce to /login.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verifySessionToken(token) : null;

  // /platform/login must stay reachable without a session, or an unauthenticated visit
  // would redirect to itself forever.
  if (pathname.startsWith('/platform') && pathname !== '/platform/login') {
    if (!payload || payload.kind !== 'platform') {
      return redirectToLogin(request, '/platform/login');
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/m') || pathname.startsWith('/app')) {
    if (!payload || payload.kind !== 'user') {
      return redirectToLogin(request, '/login');
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, loginPath: string) {
  const url = request.nextUrl.clone();
  const next = url.pathname + (url.search || '');
  url.pathname = loginPath;
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/m/:path*', '/app/:path*', '/platform/:path*'],
};
