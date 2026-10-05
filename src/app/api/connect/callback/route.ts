import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { exchangeCodeForLongLivedToken, getUserAccounts } from '@/lib/facebook/graph'
import { connectPage } from '@/lib/facebook/connect'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/connect/callback
 * code → short-lived token → long-lived user token → /me/accounts →
 * pick page(s) → never-expiring page token → subscribe app → store.
 *
 * With a single page we connect it right away; with multiple pages we
 * stash the user token in a short-lived cookie and let the owner choose
 * on /dashboard/pages (POST /api/pages completes the connection).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  if (params.get('error')) {
    return redirectWithError(request, 'access_denied')
  }

  const code = params.get('code')
  const state = params.get('state')
  const cookieState = request.cookies.get('fb_oauth_state')?.value

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectWithError(request, 'invalid_state')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  try {
    const redirectUri = `${env.APP_URL}/api/connect/callback`
    const { access_token: userToken } = await exchangeCodeForLongLivedToken(code, redirectUri)
    const accounts = await getUserAccounts(userToken)

    if (accounts.length === 0) return redirectWithError(request, 'no_pages')

    if (accounts.length === 1) {
      await connectPage(user.id, accounts[0].id, accounts[0].name, userToken)
      return redirectWithFlag(request, 'connected=1')
    }

    const response = NextResponse.redirect(new URL('/dashboard/pages?choose=1', request.url))
    response.cookies.set('fb_oauth_state', '', { maxAge: 0, path: '/' })
    response.cookies.set('fb_user_token', userToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[connect] callback failed', err)
    return redirectWithError(request, 'exchange_failed')
  }
}

function redirectWithError(request: NextRequest, reason: string) {
  const response = NextResponse.redirect(
    new URL(`/dashboard/pages?error=${encodeURIComponent(reason)}`, request.url)
  )
  response.cookies.set('fb_oauth_state', '', { maxAge: 0, path: '/' })
  response.cookies.set('fb_user_token', '', { maxAge: 0, path: '/' })
  return response
}

function redirectWithFlag(request: NextRequest, query: string) {
  const response = NextResponse.redirect(new URL(`/dashboard/pages?${query}`, request.url))
  response.cookies.set('fb_oauth_state', '', { maxAge: 0, path: '/' })
  response.cookies.set('fb_user_token', '', { maxAge: 0, path: '/' })
  return response
}
