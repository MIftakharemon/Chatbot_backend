import { NextRequest } from 'next/server'
import { after } from 'next/server'
import crypto from 'crypto'
import { env } from '@/lib/env'
import { handleFeedComment, handleInboundMessage } from '@/lib/bot/engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ------------------------------------------------------------------ */
/* GET — webhook verification (hub.challenge)                          */
/* ------------------------------------------------------------------ */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  if (mode === 'subscribe' && token && token === env.FACEBOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return new Response('Forbidden', { status: 403 })
}

/* ------------------------------------------------------------------ */
/* POST — HMAC verification, then process events after the 200        */
/* ------------------------------------------------------------------ */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!isValidSignature(request.headers.get('x-hub-signature-256'), rawBody)) {
    return new Response('Invalid signature', { status: 403 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Respond immediately — Meta expects a fast 200; work happens afterwards.
  after(async () => {
    try {
      await processPayload(payload)
    } catch (err) {
      console.error('[webhook] processing failed', err)
    }
  })

  return Response.json({ status: 'ok' })
}

/** X-Hub-Signature-256: sha256=hex(hmac(body, app_secret)) */
function isValidSignature(header: string | null, rawBody: string) {
  const secret = env.FACEBOOK_APP_SECRET
  if (!secret) {
    console.error('[webhook] FACEBOOK_APP_SECRET is not configured')
    return false
  }
  if (!header || !header.startsWith('sha256=')) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const received = header.slice('sha256='.length)

  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(received, 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/* ------------------------------------------------------------------ */
/* Event processing                                                    */
/* ------------------------------------------------------------------ */
async function processPayload(payload: any) {
  const entries: any[] = payload?.entry ?? []

  for (const entry of entries) {
    const fbPageId: string = entry.id

    // Messaging events (messages, postbacks, quick replies)
    for (const event of entry.messaging ?? []) {
      await handleMessagingEvent(fbPageId, event)
    }
    // Standby events (handover protocol) — still record them
    for (const event of entry.standby ?? []) {
      await handleMessagingEvent(fbPageId, event)
    }

    // Page feed events (comments on posts)
    for (const change of entry.changes ?? []) {
      if (change.field === 'feed') {
        await handleFeedChange(fbPageId, change.value)
      }
    }
  }
}

async function handleMessagingEvent(fbPageId: string, event: any) {
  const senderId: string | undefined = event?.sender?.id
  if (!senderId) return

  const message = event.message
  const postback = event.postback

  // Ignore our own echoes / message deliveries / reads
  if (message?.is_echo) return

  if (postback) {
    const profile = await fetchProfile(fbPageId, senderId)
    await handleInboundMessage({
      fbPageId,
      psid: senderId,
      text: postback.title ?? '',
      payload: postback.payload ?? postback.title ?? 'POSTBACK',
      ...profile,
    })
    return
  }

  if (message) {
    const payload: string | undefined = message.quick_reply?.payload
    const text =
      message.text ??
      (message.attachments?.length ? '[attachment]' : '')

    if (!text && !payload) return

    const profile = await fetchProfile(fbPageId, senderId)
    await handleInboundMessage({
      fbPageId,
      psid: senderId,
      text,
      payload,
      ...profile,
    })
  }
}

async function handleFeedChange(fbPageId: string, value: any) {
  if (value?.item !== 'comment' || value?.verb !== 'add') return
  // Ignore our own page comments
  if (value?.from?.id && value?.from?.id === fbPageId) return

  await handleFeedComment({
    fbPageId,
    commentId: value.comment_id,
    postId: value.post_id,
    commentText: value.message,
    fromName: value.from?.name,
  })
}

/** Best-effort sender name / profile picture (needs pages_messaging, page token) */
async function fetchProfile(fbPageId: string, psid: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { graphGet } = await import('@/lib/facebook/graph')

    const admin = createAdminClient()
    const { data: page } = await admin
      .from('pages')
      .select('access_token')
      .eq('fb_page_id', fbPageId)
      .maybeSingle()
    if (!page?.access_token) return {}

    const profile = await graphGet<{ first_name?: string; last_name?: string; profile_pic?: string }>(
      `/${psid}`,
      { fields: 'first_name,last_name,profile_pic' },
      page.access_token
    )

    return {
      senderName: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null,
      senderPfp: profile.profile_pic ?? null,
    }
  } catch {
    return {}
  }
}
