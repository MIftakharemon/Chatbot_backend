import 'server-only'

import { GRAPH_BASE } from '@/lib/env'

/* ------------------------------------------------------------------ */
/* Send API helpers — every call uses the page's stored access_token   */
/* ------------------------------------------------------------------ */

export interface Button {
  type: 'postback' | 'web_url'
  title: string
  payload?: string
  url?: string
}

export interface GenericElement {
  title: string
  subtitle?: string
  image_url?: string
  buttons?: Button[]
}

async function send(payload: Record<string, unknown>, pageToken: string) {
  const res = await fetch(`${GRAPH_BASE}/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_type: 'RESPONSE', ...payload, access_token: pageToken }),
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Send API error ${res.status}`)
  }
  return json as { recipient_id: string; message_id: string }
}

export function sendText(pageToken: string, psid: string, text: string) {
  return send({ recipient: { id: psid }, message: { text } }, pageToken)
}

export function sendButtons(pageToken: string, psid: string, text: string, buttons: Button[]) {
  return send(
    {
      recipient: { id: psid },
      message: {
        attachment: {
          type: 'template',
          payload: { template_type: 'button', text, buttons: buttons.slice(0, 3) },
        },
      },
    },
    pageToken
  )
}

/** Product card carousel — max 10 elements, max 3 buttons each */
export function sendGeneric(pageToken: string, psid: string, elements: GenericElement[]) {
  return send(
    {
      recipient: { id: psid },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: elements.slice(0, 10).map((el) => ({
              ...el,
              buttons: (el.buttons ?? []).slice(0, 3),
            })),
          },
        },
      },
    },
    pageToken
  )
}

export function sendQuickReplies(
  pageToken: string,
  psid: string,
  text: string,
  replies: { title: string; payload: string }[]
) {
  return send(
    {
      recipient: { id: psid },
      message: {
        text,
        quick_replies: replies.slice(0, 13).map((r) => ({
          content_type: 'text',
          title: r.title.slice(0, 20),
          payload: r.payload,
        })),
      },
    },
    pageToken
  )
}

/** Typing indicator / mark seen — best-effort */
export function sendSenderAction(pageToken: string, psid: string, action: 'typing_on' | 'typing_off' | 'mark_seen') {
  return send({ recipient: { id: psid }, sender_action: action }, pageToken)
}

/** Private reply to a post/comment (must be sent within 7 days) */
export async function sendPrivateReply(
  pageToken: string,
  commentId: string,
  message: string
) {
  const res = await fetch(`${GRAPH_BASE}/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: message },
      messaging_type: 'RESPONSE',
      access_token: pageToken,
    }),
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) throw new Error(json?.error?.message || 'private reply failed')
  return json
}

/** Public reply under a comment */
export async function sendCommentReply(pageToken: string, commentId: string, message: string) {
  const res = await fetch(`${GRAPH_BASE}/${commentId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message, access_token: pageToken }),
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) throw new Error(json?.error?.message || 'comment reply failed')
  return json
}

/** True when the 24h standard messaging window is still open. */
export function isWithin24h(iso: string | null | undefined) {
  if (!iso) return false
  const last = new Date(iso).getTime()
  if (Number.isNaN(last)) return false
  return Date.now() - last < 24 * 60 * 60 * 1000
}
