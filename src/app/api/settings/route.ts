import { NextRequest } from 'next/server'
import { resolvePageGuard } from '@/lib/supabase/page-guard'
import { sanitizeSettings } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/settings — bot settings for the active page */
export async function GET(request: NextRequest) {
  const result = await resolvePageGuard(request)
  if ('response' in result) return result.response
  const { supabase, page } = result.guard

  const { data, error } = await supabase
    .from('bot_settings')
    .select('*')
    .eq('page_id', page.id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ settings: null })

  return Response.json({ settings: data })
}

/** PUT /api/settings — partial update */
export async function PUT(request: NextRequest) {
  const result = await resolvePageGuard(request)
  if ('response' in result) return result.response
  const { supabase, page } = result.guard

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch = sanitizeSettings(body)
  if (!Object.keys(patch).length) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bot_settings')
    .update(patch)
    .eq('page_id', page.id)
    .select('*')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) {
    // first-time insert (trigger normally creates it)
    const { data: created, error: insertError } = await supabase
      .from('bot_settings')
      .insert({ page_id: page.id, ...patch })
      .select('*')
      .single()
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 })
    return Response.json({ settings: created })
  }

  return Response.json({ settings: data })
}
