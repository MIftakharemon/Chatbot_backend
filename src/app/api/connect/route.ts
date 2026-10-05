import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { env } from '@/lib/env'
import { buildLoginUrl } from '@/lib/facebook/graph'
import { getUser } from '@/lib/supabase/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/connect — starts the Facebook Login for Business OAuth flow.
 * Requires a signed-in dashboard user.
 */
export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/dashboard/pages', request.url))
  }

  const state = crypto.randomBytes(24).toString('hex')
  const redirectUri = `${env.APP_URL}/api/connect/callback`

  const response = NextResponse.redirect(buildLoginUrl(redirectUri, state))
  response.cookies.set('fb_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
