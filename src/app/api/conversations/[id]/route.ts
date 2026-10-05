import { NextRequest } from 'next/server'
import { resolvePageGuard } from '@/lib/supabase/page-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/conversations/[id] { is_paused: boolean }
 * Human takeover toggle — pauses/resumes the bot for one conversation.
 */
export async function PATCH(request: NextRequest, ctx: Params) {
  const result = await resolvePageGuard(request)
  if ('response' in result) return result.response
  const { supabase, page } = result.guard
  const { id } = await ctx.params

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body?.is_paused !== 'boolean') {
    return Response.json({ error: 'is_paused must be boolean' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { is_paused: body.is_paused }
  if (body.is_paused) {
    patch.state = 'paused'
    patch.temp_data = { prev_state: 'idle' }
  } else {
    patch.state = 'idle'
    patch.temp_data = {}
  }

  const { data, error } = await supabase
    .from('conversations')
    .update(patch)
    .eq('id', id)
    .eq('page_id', page.id)
    .select('id, is_paused, state')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data?.length) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ conversation: data[0] })
}
