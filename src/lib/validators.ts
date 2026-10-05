export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Normalizes a product payload coming from the dashboard or CSV import. */
export function sanitizeProduct(input: any, pageId: string) {
  const name = String(input?.name ?? '').trim()
  if (!name) return { error: 'পণ্যের নাম আবশ্যক (name is required)' }

  const price = Number(input?.price ?? 0)
  if (!Number.isFinite(price) || price < 0) return { error: 'সঠিক দাম দিন (invalid price)' }

  const stock = Math.max(0, Math.floor(Number(input?.stock ?? 0)))

  return {
    page_id: pageId,
    name: name.slice(0, 200),
    description: input?.description ? String(input.description).slice(0, 2000) : null,
    price,
    sizes: toArray(input?.sizes),
    colors: toArray(input?.colors),
    stock,
    image_url: input?.image_url ? String(input.image_url) : null,
    sku: input?.sku ? String(input.sku).slice(0, 80) : null,
    is_active: input?.is_active === undefined ? true : Boolean(input.is_active),
  }
}

export function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 30)
  if (typeof value === 'string') {
    return value.split(/[;,|]/).map((v) => v.trim()).filter(Boolean).slice(0, 30)
  }
  return []
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)
}

/** Only the editable bot_settings columns are accepted. */
export function sanitizeSettings(input: any) {
  const allowed: Record<string, (v: any) => any> = {
    welcome_message: (v) => String(v).slice(0, 2000),
    fallback_message: (v) => String(v).slice(0, 2000),
    delivery_inside: (v) => Math.max(0, Math.floor(Number(v) || 0)),
    delivery_outside: (v) => Math.max(0, Math.floor(Number(v) || 0)),
    payment_methods: (v) => toArray(v),
    auto_comment_reply: (v) => Boolean(v),
    comment_reply_text: (v) => String(v).slice(0, 2000),
    bot_enabled: (v) => Boolean(v),
  }

  const patch: Record<string, unknown> = {}
  for (const [key, transform] of Object.entries(allowed)) {
    if (input && key in input && input[key] !== undefined && input[key] !== null) {
      patch[key] = transform(input[key])
    }
  }
  return patch
}
