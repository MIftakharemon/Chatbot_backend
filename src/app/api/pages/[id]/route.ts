import { NextRequest } from 'next/server'
import { resolvePageGuard } from '@/lib/supabase/page-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/pages/[id] — { is_active?: boolean, make_active?: boolean } */
export async function PATCH(request: NextRequest, ctx: Params) {
  const result = await resolvePageGuard(request)
  if ('response' in result) return result.response
  const { supabase, page } = result.guard
  const { id } = await ctx.params

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    /* empty body allowed */
  }

  const patch: Record<string, unknown> = {}
  if ('is_active' in body) patch.is_active = Boolean(body.is_active)

  if (Object.keys(patch).length) {
    const { error } = await supabase
      .from('pages')
      .update(patch)
      .eq('id', id)
      .eq('owner_id', result.guard.user.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  if (body?.make_active || body?.is_active === true) {
    const response = Response.json({ ok: true })
    response.headers.append(
      'Set-Cookie',
      `active_page_id=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
    )
    return response
  }

  return Response.json({ ok: true, active_page_id: page.id })
}

/** DELETE /api/pages/[id] — disconnect the page */
export async function DELETE(request: NextRequest, ctx: Params) {
  const result = await resolvePageGuard(request)
  if ('response' in result) return result.response
  const { supabase } = result.guard
  const { id } = await ctx.params

  const { error } = await supabase
    .from('pages')
    .delete()
    .eq('id', id)
    .eq('owner_id', result.guard.user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const response = Response.json({ ok: true })
  response.headers.append('Set-Cookie', 'active_page_id=; Path=/; HttpOnly; Max-Age=0')
  return response
}
