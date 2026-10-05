/**
 * Server-side environment access.
 * The service-role key and Facebook app secret MUST only ever be read here.
 */

export const env = {
  get FACEBOOK_APP_ID() {
    return process.env.FACEBOOK_APP_ID ?? ''
  },
  get FACEBOOK_APP_SECRET() {
    return process.env.FACEBOOK_APP_SECRET ?? ''
  },
  get FACEBOOK_VERIFY_TOKEN() {
    return process.env.FACEBOOK_VERIFY_TOKEN ?? ''
  },
  get FACEBOOK_GRAPH_VERSION() {
    return process.env.FACEBOOK_GRAPH_VERSION || 'v21.0'
  },
  get SUPABASE_URL() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  },
  get SUPABASE_ANON_KEY() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  },
  get APP_URL() {
    return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  },
}

export const GRAPH_BASE = `https://graph.facebook.com/${env.FACEBOOK_GRAPH_VERSION}`
