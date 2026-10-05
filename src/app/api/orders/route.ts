import { NextRequest } from 'next/server'
import { resolvePageGuard } from '@/lib/supabase/page-guard'
import { isOrderStatus } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/orders?status=&q= */
export async function GET(request: NextRequest) {
  const result = await resolvePageGuard(request)
  if ('response' in result) return result.response
  const { supabase, page } = result.guard

  const params = request.nextUrl.searchParams
  const status = params.get('status')
  const q = params.get('q')?.trim()

  let query = supabase
    .from('orders')
    .select('*')
    .eq('page_id', page.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (status && isOrderStatus(status)) query = query.eq('status', status)
  if (q) query = query.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,order_number.eq.${q || 0}`)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ orders: data })
}
