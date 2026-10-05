import 'server-only'

import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/** Authenticated user or null (Server Components + Route Handlers). */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/** Reads the active page id cookie (route handlers / server components). */
export async function getActivePageIdCookie(): Promise<string | null> {
  const store = await cookies()
  return store.get('active_page_id')?.value ?? null
}

/**
 * Page id the dashboard should scope to: the cookie if it still belongs to
 * this user (RLS), otherwise the first connected page.
 */
export async function resolveActivePageId(): Promise<string | null> {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const cookiePageId = await getActivePageIdCookie()

  if (cookiePageId) {
    const { data } = await supabase
      .from('pages')
      .select('id')
      .eq('id', cookiePageId)
      .maybeSingle()
    if (data) return data.id
  }

  const { data } = await supabase
    .from('pages')
    .select('id')
    .order('connected_at', { ascending: true })
    .limit(1)

  return data?.[0]?.id ?? null
}
