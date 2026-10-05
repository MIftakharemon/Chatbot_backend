import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  getPageProfile,
  getLongLivedPageToken,
  subscribeApp,
} from '@/lib/facebook/graph'

/**
 * Full connection sequence for one page:
 * never-expiring page token → subscribe webhook app → avatar → upsert.
 * Reused by /api/connect/callback and POST /api/pages.
 */
export async function connectPage(
  userId: string,
  fbPageId: string,
  pageName: string,
  userToken: string
) {
  const accessToken = await getLongLivedPageToken(fbPageId, userToken)

  try {
    await subscribeApp(fbPageId, accessToken)
  } catch (err) {
    console.error('[connect] subscribe_app failed', err)
  }

  let avatar: string | null = null
  try {
    const profile = await getPageProfile(fbPageId, accessToken)
    avatar = profile?.picture?.data?.url ?? null
  } catch {
    /* avatar is optional */
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pages')
    .upsert(
      {
        owner_id: userId,
        fb_page_id: fbPageId,
        page_name: pageName,
        page_avatar_url: avatar,
        access_token: accessToken,
        is_active: true,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'fb_page_id' }
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}
