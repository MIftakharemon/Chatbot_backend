import { NextRequest } from 'next/server'
import { resolvePageGuard } from '@/lib/supabase/page-guard'
import { toArray } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/products/[id] */
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

  const patch: Record<string, unknown> = {}

  if ('name' in body) {
    const name = String(body.name ?? '').trim()
    if (!name) return Response.json({ error: 'পণ্যের নাম আবশ্যক' }, { status: 400 })
    patch.name = name.slice(0, 200)
  }
  if ('price' in body) {
    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) {
      return Response.json({ error: 'সঠিক দাম দিন' }, { status: 400 })
    }
    patch.price = price
  }
  if ('description' in body) patch.description = body.description ? String(body.description).slice(0, 2000) : null
  if ('sizes' in body) patch.sizes = toArray(body.sizes)
  if ('colors' in body) patch.colors = toArray(body.colors)
  if ('stock' in body) patch.stock = Math.max(0, Math.floor(Number(body.stock) || 0))
  if ('image_url' in body) patch.image_url = body.image_url ? String(body.image_url) : null
  if ('sku' in body) patch.sku = body.sku ? String(body.sku).slice(0, 80) : null
  if ('is_active' in body) patch.is_active = Boolean(body.is_active)

  if (!Object.keys(patch).length) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .eq('page_id', page.id)
    .select('*')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data?.length) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ product: data[0] })
}

/** DELETE /api/products/[id] */
export async function DELETE(request: NextRequest, ctx: Params) {
  const result = await resolvePageGuard(request)
  if ('response' in result) return result.response
  const { supabase, page } = result.guard
  const { id } = await ctx.params

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('page_id', page.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
