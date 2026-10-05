import { NextRequest } from 'next/server'
import { resolvePageGuard } from '@/lib/supabase/page-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { isWithin24h, sendText } from '@/lib/bot/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/conversations/[id]/reply { text }
 * Human agent reply — only inside the 24h messaging window.
 */
export async function POST(request: NextRequest, ctx: Params) {
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

  const text = String(body?.text ?? '').trim()
  if (!text) return Response.json({ error: 'text is required' }, { status: 400 })
  if (text.length > 2000) return Response.json({ error: 'text too long' }, { status: 400 })

  // conversation must belong to the active page (RLS enforced)
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('id, psid, last_inbound_at, page_id')
    .eq('id', id)
    .eq('page_id', page.id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!conversation) return Response.json({ error: 'Not found' }, { status: 404 })

  if (!isWithin24h(conversation.last_inbound_at)) {
    return Response.json(
      {
        error: '24h window closed',
        message: 'মেসেজিং উইন্ডো ২৪ ঘণ্টা পেরিয়ে গেছে — কাস্টমার আগে মেসেজ দিলেই আবার পাঠানো যাবে।',
      },
      { status: 403 }
    )
  }

  const admin = createAdminClient()
  const { data: dbPage } = await admin
    .from('pages')
    .select('access_token')
    .eq('id', page.id)
    .maybeSingle()

  if (!dbPage?.access_token) {
    return Response.json({ error: 'Page token missing' }, { status: 500 })
  }

  try {
    await sendText(dbPage.access_token, conversation.psid, text)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Send failed' },
      { status: 502 }
    )
  }

  const { error: insertError } = await admin.from('messages').insert({
    page_id: conversation.page_id,
    conversation_id: conversation.id,
    psid: conversation.psid,
    role: 'agent',
    content: text.slice(0, 2000),
  })
  if (insertError) console.error('[reply] failed to log agent message', insertError)

  await admin
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id)

  return Response.json({ ok: true })
}
