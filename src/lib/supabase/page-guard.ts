import 'server-only'

import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export interface PageGuard {
  user: User
  supabase: Awaited<ReturnType<typeof createClient>>
  page: { id: string; fb_page_id: string; page_name: string }
}

/**
 * Resolves the signed-in user + the active Facebook page for a client API
 * route. Returns either the guard or a ready-to-send error Response.
 */
export async function resolvePageGuard(
  request: NextRequest
): Promise<{ guard: PageGuard } | { response: Response }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const cookiePageId = request.cookies.get('active_page_id')?.value

  // cookie first (RLS makes sure it belongs to this user), else first page
  let page: { id: string; fb_page_id: string; page_name: string } | null = null
  if (cookiePageId) {
    const { data } = await supabase
      .from('pages')
      .select('id, fb_page_id, page_name')
      .eq('id', cookiePageId)
      .maybeSingle()
    page = data
  }
  if (!page) {
    const { data } = await supabase
      .from('pages')
      .select('id, fb_page_id, page_name')
      .order('connected_at', { ascending: true })
      .limit(1)
    page = data?.[0] ?? null
  }

  if (!page) {
    return {
      response: Response.json(
        { error: 'NO_PAGE', message: 'কোনো ফেসবুক পেজ কানেক্ট করা নেই।' },
        { status: 400 }
      ),
    }
  }

  return { guard: { user, supabase, page } }
}
