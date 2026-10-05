import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { BotSettings, CartItem, Conversation, Product } from '@/lib/types'
import {
  sendButtons,
  sendCommentReply,
  sendGeneric,
  sendPrivateReply,
  sendQuickReplies,
  sendText,
  type Button,
  type GenericElement,
} from '@/lib/bot/send'
import {
  extractNumber,
  isBrowseRequest,
  isHumanRequest,
  isInsideDhaka,
  isMore,
  isNo,
  isResumeRequest,
  isYes,
  normalize,
  normalizePhone,
} from '@/lib/bot/keywords'

export interface InboundEvent {
  /** Facebook page id (the string one, not our uuid) */
  fbPageId: string
  psid: string
  text?: string
  payload?: string
  senderName?: string | null
  senderPfp?: string | null
}

export interface CommentEvent {
  fbPageId: string
  commentId: string
  postId?: string
  commentText?: string
  fromName?: string | null
}

const DEFAULT_SETTINGS: Omit<BotSettings, 'page_id'> = {
  welcome_message:
    'আসসালামু আলাইকুম! 👋\nআমাদের পণ্য দেখতে "পণ্য" লিখুন অথবা নিচের মেনু থেকে বেছে নিন।',
  fallback_message:
    'দুঃখিত, আমি বুঝতে পারিনি। অনুগ্রহ করে "পণ্য" লিখুন বা নিচের বোতামে ক্লিক করুন।',
  delivery_inside: 60,
  delivery_outside: 120,
  payment_methods: ['ক্যাশ অন ডেলিভারি', 'বিকাশ'],
  auto_comment_reply: true,
  comment_reply_text: 'ইনবক্স করুন — আমরা সাথে সাথে অর্ডার করে দিতে পারব! 📦',
  bot_enabled: true,
}

const money = (n: number) => `৳${Number(n || 0).toLocaleString('en-BD')}`

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export async function handleInboundMessage(event: InboundEvent) {
  const admin = createAdminClient()

  const { data: page, error: pageError } = await admin
    .from('pages')
    .select('id, fb_page_id, page_name, access_token, is_active')
    .eq('fb_page_id', event.fbPageId)
    .maybeSingle()

  if (pageError || !page || !page.is_active) return

  const { data: settingsRow } = await admin
    .from('bot_settings')
    .select('*')
    .eq('page_id', page.id)
    .maybeSingle()

  const settings: Omit<BotSettings, 'page_id'> = { ...DEFAULT_SETTINGS, ...(settingsRow ?? {}) }

  let { data: conversation } = await admin
    .from('conversations')
    .select('*')
    .eq('page_id', page.id)
    .eq('psid', event.psid)
    .maybeSingle()

  if (!conversation) {
    const { data: created, error } = await admin
      .from('conversations')
      .insert({
        page_id: page.id,
        psid: event.psid,
        customer_name: event.senderName ?? null,
        customer_pfp: event.senderPfp ?? null,
        state: 'idle',
      })
      .select('*')
      .single()
    if (error) {
      // concurrent insert → re-read
      const { data: existing } = await admin
        .from('conversations')
        .select('*')
        .eq('page_id', page.id)
        .eq('psid', event.psid)
        .maybeSingle()
      conversation = existing
    } else {
      conversation = created
    }
  }
  if (!conversation) return

  const conv = conversation as Conversation

  // persist inbound message + timestamp (24h window reference)
  const inboundText = event.payload ? `[postback] ${event.payload}` : event.text ?? ''
  await admin.from('messages').insert({
    page_id: page.id,
    conversation_id: conv.id,
    psid: event.psid,
    role: 'customer',
    content: inboundText.slice(0, 2000),
  })
  await admin
    .from('conversations')
    .update({
      last_inbound_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      customer_name: event.senderName ?? conv.customer_name,
      customer_pfp: event.senderPfp ?? conv.customer_pfp,
    })
    .eq('id', conv.id)

  const ctx: Ctx = {
    admin,
    page,
    settings,
    conv,
    products: [],
    replies: createReplyHelpers(page.access_token, conv, admin),
  }

  try {
    ctx.products = await loadProducts(admin, page.id)

    const text = event.text ?? ''
    const payload = event.payload ?? ''

    /* ---- global: human takeover -------------------------------- */
    if (!payload && isHumanRequest(text)) {
      if (!conv.is_paused) await pauseBot(ctx, true)
      return
    }

    /* ---- paused: bot stays silent -------------------------------- */
    if (conv.is_paused) {
      if (!payload && isResumeRequest(text)) {
        await pauseBot(ctx, false)
        return
      }
      return
    }

    /* ---- master switch ------------------------------------------- */
    if (settings.bot_enabled === false) return

    /* ---- global: restart after an order --------------------------- */
    if (
      (conv.state === 'paused' || conv.state === 'order_placed') &&
      (isBrowseRequest(text) || isMore(text) || isYes(text))
    ) {
      await resetToBrowse(ctx)
      return
    }

    if (payload === 'GET_STARTED' || payload === 'WELCOME') {
      await ctx.replies.text(settings.welcome_message)
      await showProducts(ctx)
      return
    }

    /* ---- dispatch by state --------------------------------------- */
    switch (conv.state) {
      case 'idle':
        await handleIdle(ctx, text, payload)
        break
      case 'browsing':
        await handleBrowsing(ctx, text, payload)
        break
      case 'ask_size':
        await handleAskSize(ctx, text, payload)
        break
      case 'ask_qty':
        await handleAskQty(ctx, text, payload)
        break
      case 'ask_name':
        await handleAskName(ctx, text, payload)
        break
      case 'ask_phone':
        await handleAskPhone(ctx, text, payload)
        break
      case 'ask_address':
        await handleAskAddress(ctx, text, payload)
        break
      case 'confirm':
        await handleConfirm(ctx, text, payload)
        break
      case 'order_placed':
        await handleOrderPlaced(ctx, text, payload)
        break
      case 'paused':
        break
      default:
        await resetToBrowse(ctx)
    }

    await admin
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conv.id)
  } catch (err) {
    console.error('[bot] engine error', err)
    try {
      await ctx.replies.text(settings.fallback_message)
    } catch {
      /* ignore — 24h window or token issue */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Comment auto-reply                                                  */
/* ------------------------------------------------------------------ */

export async function handleFeedComment(event: CommentEvent) {
  const admin = createAdminClient()

  const { data: page } = await admin
    .from('pages')
    .select('id, access_token, is_active')
    .eq('fb_page_id', event.fbPageId)
    .maybeSingle()
  if (!page || !page.is_active) return

  const { data: settingsRow } = await admin
    .from('bot_settings')
    .select('*')
    .eq('page_id', page.id)
    .maybeSingle()
  const settings: Omit<BotSettings, 'page_id'> = { ...DEFAULT_SETTINGS, ...(settingsRow ?? {}) }
  if (!settings.auto_comment_reply) return

  // dedupe: unique constraint on fb_comment_id
  const { error: dupError } = await admin.from('comment_replies').insert({
    page_id: page.id,
    fb_comment_id: event.commentId,
    post_id: event.postId ?? null,
    comment_text: event.commentText ?? null,
  })
  if (dupError) {
    if (dupError.code !== '23505') console.error('[bot] comment_replies insert failed', dupError)
    return // already replied (or cannot record)
  }

  const text = settings.comment_reply_text

  try {
    await sendCommentReply(page.access_token, event.commentId, text)
  } catch (err) {
    console.error('[bot] public comment reply failed', err)
  }

  try {
    await sendPrivateReply(page.access_token, event.commentId, text)
  } catch (err) {
    // private replies are optional (permission / window dependent)
    console.error('[bot] private reply failed', err)
  }
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

type Admin = ReturnType<typeof createAdminClient>

interface Ctx {
  admin: Admin
  page: { id: string; fb_page_id: string; page_name: string; access_token: string; is_active: boolean }
  settings: Omit<BotSettings, 'page_id'>
  conv: Conversation
  products: Product[]
  replies: {
    text: (t: string) => Promise<void>
    buttons: (t: string, b: Button[]) => Promise<void>
    quick: (t: string, r: { title: string; payload: string }[]) => Promise<void>
    generic: (elements: GenericElement[]) => Promise<void>
  }
}

function createReplyHelpers(token: string, conv: Conversation, admin: Admin) {
  const log = async (role: 'bot' | 'agent', content: string) => {
    await admin.from('messages').insert({
      page_id: conv.page_id,
      conversation_id: conv.id,
      psid: conv.psid,
      role,
      content: content.slice(0, 2000),
    })
  }

  return {
    async text(t: string) {
      await sendText(token, conv.psid, t)
      await log('bot', t)
    },
    async buttons(t: string, b: Button[]) {
      await sendButtons(token, conv.psid, t, b)
      await log('bot', t)
    },
    async quick(t: string, r: { title: string; payload: string }[]) {
      await sendQuickReplies(token, conv.psid, t, r)
      await log('bot', `${t} [quick: ${r.map((x) => x.title).join(', ')}]`)
    },
    async generic(elements: GenericElement[]) {
      await sendGeneric(token, conv.psid, elements)
      const summary = elements.map((e) => `• ${e.title}${e.subtitle ? ` — ${e.subtitle}` : ''}`).join('\n')
      await log('bot', `📦 পণ্য তালিকা:\n${summary}`)
    },
  }
}

async function loadProducts(admin: Admin, pageId: string): Promise<Product[]> {
  const { data } = await admin
    .from('products')
    .select('*')
    .eq('page_id', pageId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as Product[]
}

async function persistState(
  ctx: Ctx,
  patch: Partial<Pick<Conversation, 'state' | 'cart' | 'temp_data' | 'is_paused' | 'customer_name'>>
) {
  Object.assign(ctx.conv, patch)
  const { error } = await ctx.admin.from('conversations').update(patch).eq('id', ctx.conv.id)
  if (error) throw new Error(`failed to persist conversation: ${error.message}`)
}

async function pauseBot(ctx: Ctx, paused: boolean) {
  if (paused) {
    const prev = ctx.conv.state === 'paused' ? 'idle' : ctx.conv.state
    await persistState(ctx, {
      is_paused: true,
      state: 'paused',
      temp_data: { ...ctx.conv.temp_data, prev_state: prev },
    })
    await ctx.replies.text(
      'আপনার অনুরোধ অনুযায়ী একজন প্রতিনিধি সাথে কথা বলতে পারবেন। আমাদের টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে। 🙏\n\n(বট আবার চালু করতে "বট" লিখুন)'
    )
  } else {
    const prev = (ctx.conv.temp_data?.prev_state as string) || 'idle'
    await persistState(ctx, {
      is_paused: false,
      state: prev === 'paused' ? 'idle' : prev,
      temp_data: {},
    })
    await ctx.replies.text('ধন্যবাদ! বট আবার চালু হয়েছে। পণ্য দেখতে "পণ্য" লিখুন। 🤖')
  }
}

async function resetToBrowse(ctx: Ctx) {
  await persistState(ctx, { cart: [], temp_data: {}, state: 'browsing' })
  await showProducts(ctx)
}

async function showProducts(ctx: Ctx) {
  if (ctx.products.length === 0) {
    await persistState(ctx, { state: 'idle' })
    await ctx.replies.text('দুঃখিত, এখন কোনো পণ্য পাওয়া যাচ্ছে না। পরে আবার চেষ্টা করুন। 🙏')
    return
  }

  const elements: GenericElement[] = ctx.products.slice(0, 10).map((p) => ({
    title: p.name,
    subtitle: [
      money(p.price),
      p.sizes?.length ? `সাইজ: ${p.sizes.join(', ')}` : null,
      p.stock > 0 ? `স্টক: ${p.stock}` : 'স্টক নেই',
    ]
      .filter(Boolean)
      .join(' • '),
    image_url: p.image_url ?? undefined,
    buttons: [
      {
        type: 'postback',
        title: p.stock > 0 ? '🛒 বাছাই করুন' : '❌ স্টক নেই',
        payload: p.stock > 0 ? `PRODUCT:${p.id}` : `INFO:${p.id}`,
      },
    ],
  }))

  await persistState(ctx, { state: 'browsing' })
  await ctx.replies.generic(elements)
  await ctx.replies.text('পছন্দের পণ্যের বোতামে ক্লিক করুন, অথবা নাম লিখে দিন। ✍️')
}

function pickProduct(ctx: Ctx, id: string): Product | undefined {
  return ctx.products.find((p) => p.id === id)
}

async function selectProduct(ctx: Ctx, product: Product) {
  if (product.stock <= 0) {
    await ctx.replies.text(`দুঃখিত, "${product.name}" এখন স্টকে নেই। অন্য কিছু দেখুন।`)
    await showProducts(ctx)
    return
  }

  const temp_data = {
    product_id: product.id,
    product_name: product.name,
    price: Number(product.price),
    image_url: product.image_url ?? null,
    size: null,
    qty: 1,
  }

  if (product.sizes?.length) {
    await persistState(ctx, { state: 'ask_size', temp_data })
    await ctx.replies.quick(
      `"${product.name}" এর সাইজ বাছাই করুন:\n${product.sizes.join(' • ')}`,
      product.sizes.slice(0, 10).map((s) => ({ title: String(s), payload: `SIZE:${s}` }))
    )
  } else {
    await persistState(ctx, { state: 'ask_qty', temp_data })
    await askQuantity(ctx, product)
  }
}

async function askQuantity(ctx: Ctx, product: Product) {
  await ctx.replies.text(
    `কতটি নিতে চান? (সর্বোচ্চ ${product.stock})\nশুধু সংখ্যা লিখুন — যেমন: 1`
  )
}

async function addToCart(ctx: Ctx) {
  const t = ctx.conv.temp_data as Record<string, any>
  const item: CartItem = {
    product_id: t.product_id,
    name: t.product_name,
    price: Number(t.price),
    size: t.size ?? null,
    qty: Number(t.qty) || 1,
    image_url: t.image_url ?? null,
  }

  const cart = [...(ctx.conv.cart ?? [])]
  const existing = cart.find(
    (c) => c.product_id === item.product_id && (c.size ?? null) === (item.size ?? null)
  )
  if (existing) existing.qty += item.qty
  else cart.push(item)

  await persistState(ctx, { cart })
}

async function askName(ctx: Ctx) {
  await persistState(ctx, { state: 'ask_name' })
  await ctx.replies.text('আপনার নাম লিখুন। নাম লিখে পাঠান। ✍️')
}

/* ---------------- state handlers ---------------- */

async function handleIdle(ctx: Ctx, text: string, payload: string) {
  if (payload.startsWith('PRODUCT:')) {
    const product = pickProduct(ctx, payload.slice(8))
    if (product) return selectProduct(ctx, product)
  }
  if (!isBrowseRequest(text)) {
    await ctx.replies.text(ctx.settings.welcome_message)
  }
  await showProducts(ctx)
}

async function handleBrowsing(ctx: Ctx, text: string, payload: string) {
  if (payload.startsWith('PRODUCT:') || payload.startsWith('INFO:')) {
    const product = pickProduct(ctx, payload.split(':')[1])
    if (!product) return ctx.replies.text(ctx.settings.fallback_message)
    if (payload.startsWith('INFO:')) {
      return ctx.replies.text(`দুঃখিত, "${product.name}" এখন স্টকে নেই। 🙏`)
    }
    return selectProduct(ctx, product)
  }

  if (payload === 'MORE_ITEMS' || isMore(text) || isBrowseRequest(text)) {
    return showProducts(ctx)
  }

  // numeric index
  const idx = extractNumber(text)
  if (idx !== null && idx >= 1 && idx <= ctx.products.length) {
    return selectProduct(ctx, ctx.products[idx - 1])
  }

  // name match
  const n = normalize(text)
  const match = ctx.products.find(
    (p) => normalize(p.name).includes(n) || n.includes(normalize(p.name))
  )
  if (match && n.length >= 2) return selectProduct(ctx, match)

  await ctx.replies.text(ctx.settings.fallback_message)
  await showProducts(ctx)
}

async function handleAskSize(ctx: Ctx, text: string, payload: string) {
  if (payload === 'MORE_ITEMS' || isMore(text)) return resetToBrowse(ctx)

  const product = pickProduct(ctx, String(ctx.conv.temp_data?.product_id ?? ''))
  if (!product) return resetToBrowse(ctx)

  const chosen = payload.startsWith('SIZE:')
    ? payload.slice(5)
    : product.sizes.find((s) => normalize(String(s)) === normalize(text))

  if (!chosen) {
    return ctx.replies.quick(
      `সঠিক সাইজ বাছাই করুন:\n${product.sizes.join(' • ')}`,
      product.sizes.slice(0, 10).map((s) => ({ title: String(s), payload: `SIZE:${s}` }))
    )
  }

  await persistState(ctx, {
    state: 'ask_qty',
    temp_data: { ...ctx.conv.temp_data, size: chosen },
  })
  await askQuantity(ctx, product)
}

async function handleAskQty(ctx: Ctx, text: string, payload: string) {
  if (payload === 'MORE_ITEMS' || isMore(text)) return resetToBrowse(ctx)

  const qty = extractNumber(text)
  const product = pickProduct(ctx, String(ctx.conv.temp_data?.product_id ?? ''))

  if (!product) return resetToBrowse(ctx)
  if (qty === null || qty < 1) {
    return ctx.replies.text('সঠিক সংখ্যা লিখুন — যেমন: 1')
  }
  if (qty > product.stock) {
    return ctx.replies.text(
      `স্টকে মাত্র ${product.stock}টি আছে। অনুগ্রহ করে কম সংখ্যা লিখুন।`
    )
  }

  await persistState(ctx, { temp_data: { ...ctx.conv.temp_data, qty } })
  await addToCart(ctx)
  await askName(ctx)
}

async function handleAskName(ctx: Ctx, text: string, payload: string) {
  if (payload === 'MORE_ITEMS' || isMore(text)) return resetToBrowse(ctx)

  const name = text.trim()
  if (name.length < 2) return ctx.replies.text('অনুগ্রহ করে আপনার নাম লিখুন। ✍️')

  await persistState(ctx, {
    state: 'ask_phone',
    customer_name: name.slice(0, 120),
    temp_data: { ...ctx.conv.temp_data, name },
  })
  await ctx.replies.text('আপনার মোবাইল নম্বর লিখুন। 📱\n(যেমন: 01712345678)')
}

async function handleAskPhone(ctx: Ctx, text: string, payload: string) {
  if (payload === 'MORE_ITEMS' || isMore(text)) return resetToBrowse(ctx)

  const phone = normalizePhone(text)
  if (!phone) {
    return ctx.replies.text(
      '❌ নম্বরটি সঠিক নয়। বাংলাদেশি নম্বর ফরম্যাটে লিখুন:\n01XXXXXXXXX (11 ডিজিট)'
    )
  }

  await persistState(ctx, {
    state: 'ask_address',
    temp_data: { ...ctx.conv.temp_data, phone },
  })
  await ctx.replies.text('ডেলিভারি ঠিকানা লিখুন। 🏠\n(এলাকা / রোড / বাড়ি নং / ল্যান্ডমার্ক)')
}

async function handleAskAddress(ctx: Ctx, text: string, payload: string) {
  if (payload === 'MORE_ITEMS' || isMore(text)) return resetToBrowse(ctx)

  const address = text.trim()
  if (address.length < 5) {
    return ctx.replies.text('অনুগ্রহ করে সম্পূর্ণ ঠিকানা লিখুন। 🏠')
  }

  const inside = isInsideDhaka(address)
  await persistState(ctx, {
    state: 'confirm',
    temp_data: {
      ...ctx.conv.temp_data,
      address,
      delivery_charge: inside ? ctx.settings.delivery_inside : ctx.settings.delivery_outside,
      zone: inside ? 'inside' : 'outside',
    },
  })
  await showConfirm(ctx)
}

async function showConfirm(ctx: Ctx) {
  const t = ctx.conv.temp_data as Record<string, any>
  const cart = ctx.conv.cart ?? []
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const delivery = Number(t.delivery_charge ?? ctx.settings.delivery_inside)
  const total = subtotal + delivery

  const lines = cart.map(
    (i, n) =>
      `${n + 1}. ${i.name}${i.size ? ` (${i.size})` : ''} × ${i.qty} = ${money(i.price * i.qty)}`
  )

  const summary = [
    '🧾 *অর্ডার সারাংশ*',
    ...lines,
    '',
    `সাবটোটাল: ${money(subtotal)}`,
    `ডেলিভারি: ${money(delivery)} (${t.zone === 'outside' ? 'ঢাকার বাইরে' : 'ঢাকার ভিতরে'})`,
    `মোট: *${money(total)}*`,
    '',
    `👤 নাম: ${t.name ?? ctx.conv.customer_name ?? '-'}`,
    `📱 ফোন: ${t.phone ?? '-'}`,
    `🏠 ঠিকানা: ${t.address ?? '-'}`,
    '',
    `💳 পেমেন্ট: ${ctx.settings.payment_methods.join(', ')}`,
    `🚚 ডেলিভারি সময়: ${t.zone === 'outside' ? ctx.settings.delivery_outside : ctx.settings.delivery_inside} মিনিট`,
  ].join('\n')

  await ctx.replies.buttons(summary, [
    { type: 'postback', title: '✅ অর্ডার কনফার্ম', payload: 'CONFIRM_ORDER' },
    { type: 'postback', title: '❌ বাতিল করুন', payload: 'CANCEL_ORDER' },
    { type: 'postback', title: '🛒 আরও যোগ করুন', payload: 'MORE_ITEMS' },
  ])
}

async function handleConfirm(ctx: Ctx, text: string, payload: string) {
  if (payload === 'CONFIRM_ORDER' || isYes(text)) return placeOrder(ctx)
  if (payload === 'CANCEL_ORDER' || isNo(text)) {
    await persistState(ctx, { cart: [], temp_data: {}, state: 'idle' })
    await ctx.replies.text('অর্ডার বাতিল করা হয়েছে। ❌\nআবার পণ্য দেখতে "পণ্য" লিখুন।')
    return showProducts(ctx)
  }
  if (payload === 'MORE_ITEMS' || isMore(text)) return resetToBrowse(ctx)
  await showConfirm(ctx)
}

async function placeOrder(ctx: Ctx) {
  const t = ctx.conv.temp_data as Record<string, any>
  const cart = ctx.conv.cart ?? []
  if (!cart.length) {
    await ctx.replies.text('আপনার কার্ট খালি। পণ্য বাছাই করুন।')
    return showProducts(ctx)
  }
  if (!t.phone || !t.address) {
    await ctx.replies.text('তথ্য অসম্পূর্ণ। আবার শুরু করি।')
    return resetToBrowse(ctx)
  }

  // atomic stock check + decrement
  for (const item of cart) {
    const { data: ok, error } = await ctx.admin.rpc('decrement_stock', {
      p_product_id: item.product_id,
      p_qty: item.qty,
    })
    if (error || !ok) {
      await ctx.replies.text(
        `❌ "${item.name}" স্টকে নেই বা পর্যাপ্ত নেই। অর্ডার সম্পন্ন হয়নি।\nঅনুগ্রহ করে কম পরিমাণ দিয়ে আবার চেষ্টা করুন।`
      )
      return resetToBrowse(ctx)
    }
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const delivery = Number(t.delivery_charge ?? ctx.settings.delivery_inside)
  const total = subtotal + delivery

  const { data: order, error } = await ctx.admin
    .from('orders')
    .insert({
      page_id: ctx.page.id,
      psid: ctx.conv.psid,
      customer_name: (t.name ?? ctx.conv.customer_name ?? 'Customer').slice(0, 120),
      customer_phone: t.phone,
      customer_address: t.address,
      items: cart,
      subtotal,
      delivery_charge: delivery,
      total,
      status: 'pending',
    })
    .select('order_number')
    .single()

  if (error) {
    console.error('[bot] order insert failed', error)
    await ctx.replies.text('⚠️ অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন অথবা মানুষের সাথে কথা বলুন ("মানুষ")।')
    return
  }

  await persistState(ctx, { cart: [], temp_data: {}, state: 'order_placed' })

  await ctx.replies.text(
    [
      '✅ *অর্ডার সফল হয়েছে!*',
      `🔢 অর্ডার নম্বর: #${order.order_number}`,
      `💰 মোট: ${money(total)}`,
      `📦 ডেলিভারি সময়: ${t.zone === 'outside' ? ctx.settings.delivery_outside : ctx.settings.delivery_inside} মিনিট`,
      '',
      'আমরা শীঘ্রই আপনাকে কল করব। ধন্যবাদ কেনা কারণে! 🙏',
      '',
      'আরও কিনতে চাইলে "পণ্য" লিখুন।',
    ].join('\n')
  )
}

async function handleOrderPlaced(ctx: Ctx, text: string, payload: string) {
  if (isBrowseRequest(text) || isMore(text) || isYes(text) || payload === 'MORE_ITEMS') {
    return resetToBrowse(ctx)
  }
  await ctx.replies.text('আরও কিছু কিনতে চাইলে "পণ্য" লিখুন, অথবা সাহায্যের জন্য "মানুষ" লিখুন। 😊')
}
