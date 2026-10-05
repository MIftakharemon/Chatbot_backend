import { NextRequest } from 'next/server'
import { resolvePageGuard } from '@/lib/supabase/page-guard'
import { sanitizeProduct } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/products — list products for the active page */
export async function GET(request: NextRequest) {
  const result = await resolvePageGuard(request)
  if ('response' in result) return result.response
  const { supabase, page } = result.guard

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('page_id', page.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ products: data })
}

/**
 * POST /api/products — create one product, or bulk import with
 * `{ items: [...] }` (CSV import from the dashboard).
 */
export async function POST(request: NextRequest) {
  const result = await resolvePageGuard(request)
  if ('response' in result) return result.response
  const { supabase, page } = result.guard

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rawItems: any[] = Array.isArray(body?.items) ? body.items : [body]
  if (!rawItems.length) return Response.json({ error: 'No items' }, { status: 400 })

  const sanitized = rawItems.map((item) => sanitizeProduct(item, page.id))
  for (const item of sanitized) {
    if ('error' in item) return Response.json({ error: item.error }, { status: 400 })
  }

  const rows = sanitized.map((row) => ({ ...row }))

  const { data, error } = await supabase.from('products').insert(rows).select('*')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ products: data }, { status: 201 })
}
