import { NextRequest } from 'next/server'
import { connectPage } from '@/lib/facebook/connect'
import { getUserAccounts } from '@/lib/facebook/graph'
import { getUser } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/pages
 *  - with the short-lived `fb_user_token` cookie → pages available to connect
 *  - otherwise → the owner's already connected pages (no tokens exposed)
 */
export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userToken = request.cookies.get('fb_user_token')?.value
  if (userToken) {
    try {
      const accounts = await getUserAccounts(userToken)
      return Response.json({
        available: accounts.map((a) => ({ id: a.id, name: a.name, category: a.category })),
      })
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : 'failed to load pages' },
        { status: 502 }
      )
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pages')
    .select('id, fb_page_id, page_name, page_avatar_url, is_active, connected_at, token_expires_at')
    .order('connected_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ pages: data ?? [], active_page_id: data?.[0]?.id ?? null })
}

/**
 * POST /api/pages { fb_page_id, page_name }
 * Completes the OAuth connection for a page chosen in the dashboard.
 * Only needs a signed-in user + the temp user token — the very first page
 * of an account is connected here, so no "active page" may be required.
 */
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const userToken = request.cookies.get('fb_user_token')?.value
  if (!userToken) {
    return Response.json({ error: 'Session expired — connect again' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fbPageId = String(body?.fb_page_id ?? '')
  const pageName = String(body?.page_name ?? '').trim()
  if (!fbPageId || !pageName) {
    return Response.json({ error: 'fb_page_id and page_name are required' }, { status: 400 })
  }

  try {
    const newPageId = await connectPage(user.id, fbPageId, pageName, userToken)

    const supabase = await createClient()
    const { data: owned } = await supabase
      .from('pages')
      .select('id, fb_page_id, page_name, page_avatar_url, is_active, connected_at')
      .eq('id', newPageId)
      .maybeSingle()

    const response = Response.json({ page: owned }, { status: 201 })
    // make the newly connected page active + drop the temp user token
    response.headers.append(
      'Set-Cookie',
      `active_page_id=${newPageId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
    )
    response.headers.append('Set-Cookie', 'fb_user_token=; Path=/; HttpOnly; Max-Age=0')
    return response
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'connection failed' },
      { status: 502 }
    )
  }
}
