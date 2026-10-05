import 'server-only'

import { GRAPH_BASE, env } from '@/lib/env'

export class GraphApiError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'GraphApiError'
    this.status = status
  }
}

type Params = Record<string, string | number | boolean | undefined | null>

function buildUrl(path: string, params: Params) {
  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, '')}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  return url
}

export async function graphGet<T = any>(path: string, params: Params = {}, token?: string): Promise<T> {
  const url = buildUrl(path, params)
  if (token) url.searchParams.set('access_token', token)

  const res = await fetch(url, { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) {
    throw new GraphApiError(json?.error?.message || `Graph API error ${res.status}`, res.status)
  }
  return json as T
}

export async function graphPost<T = any>(path: string, body: Params, token?: string): Promise<T> {
  const url = buildUrl(path, {})
  const form = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) form.set(key, String(value))
  }
  if (token) form.set('access_token', token)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.error) {
    throw new GraphApiError(json?.error?.message || `Graph API error ${res.status}`, res.status)
  }
  return json as T
}

/* ------------------------------------------------------------------ */
/* OAuth (Facebook Login for Business)                                 */
/* ------------------------------------------------------------------ */

export const FB_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
  'pages_read_engagement',
  'pages_manage_engagement',
  'pages_manage_posts',
].join(',')

export function buildLoginUrl(redirectUri: string, state: string) {
  const url = new URL(`https://www.facebook.com/${env.FACEBOOK_GRAPH_VERSION}/dialog/oauth`)
  url.searchParams.set('client_id', env.FACEBOOK_APP_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', FB_OAUTH_SCOPES)
  return url.toString()
}

/** code → short-lived user token → long-lived user token */
export async function exchangeCodeForLongLivedToken(code: string, redirectUri: string) {
  const shortLived = await graphGet<{ access_token: string }>('/oauth/access_token', {
    client_id: env.FACEBOOK_APP_ID,
    client_secret: env.FACEBOOK_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  })

  return graphGet<{ access_token: string; expires_in: number }>('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: env.FACEBOOK_APP_ID,
    client_secret: env.FACEBOOK_APP_SECRET,
    fb_exchange_token: shortLived.access_token,
  })
}

export interface FbPageAccount {
  id: string
  name: string
  access_token: string
  category?: string
  tasks?: string[]
}

/** Pages the user can manage, with their short-lived page tokens */
export async function getUserAccounts(userToken: string) {
  const data = await graphGet<{ data: FbPageAccount[] }>('/me/accounts', { fields: 'id,name,category,tasks' }, userToken)
  return data.data ?? []
}

/**
 * Never-expiring page token:
 * 1. GET /{page-id}?fields=access_token with the long-lived user token
 * 2. exchange that page token again via fb_exchange_token
 */
export async function getLongLivedPageToken(pageId: string, userToken: string) {
  const pageToken = await graphGet<{ access_token: string }>(
    `/${pageId}`,
    { fields: 'access_token' },
    userToken
  )

  try {
    const exchanged = await graphGet<{ access_token: string }>('/oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: env.FACEBOOK_APP_ID,
      client_secret: env.FACEBOOK_APP_SECRET,
      fb_exchange_token: pageToken.access_token,
    })
    return exchanged.access_token || pageToken.access_token
  } catch {
    return pageToken.access_token
  }
}

/** Subscribe the app to the page's webhook fields */
export async function subscribeApp(pageId: string, pageToken: string) {
  return graphPost(
    `/${pageId}/subscribed_apps`,
    { subscribed_fields: 'messages,messaging_postbacks,feed' },
    pageToken
  )
}

export async function getPageProfile(pageId: string, pageToken: string) {
  return graphGet<{ id: string; name: string; picture?: { data?: { url?: string } } }>(
    `/${pageId}`,
    { fields: 'id,name,picture.type(large)' },
    pageToken
  )
}
