import { NextRequest } from 'next/server'
import { resolvePageGuard } from '@/lib/supabase/page-guard'
import { isOrderStatus } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/orders/[id] — status update */
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

  if (!isOrderStatus(body?.status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status: body.status })
    .eq('id', id)
    .eq('page_id', page.id)
    .select('*')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data?.length) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ order: data[0] })
}
