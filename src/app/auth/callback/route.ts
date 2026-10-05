import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Supabase auth callback: exchanges the code for a session. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const next = params.get('next') || '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const url = new URL(next.startsWith('/') ? next : '/dashboard', request.url)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', request.url))
}
