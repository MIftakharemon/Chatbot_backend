import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePageGuard } from '@/lib/supabase/page-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const BUCKET = 'product-images'

/**
 * POST /api/upload (multipart/form-data: `file`)
 * Images land in Supabase Storage under the active page's folder.
 * Writes go through the service-role key — the browser never sees it.
 */
export async function POST(request: NextRequest) {
  const result = await resolvePageGuard(request)
  if ('response' in result) return result.response
  const { page } = result.guard

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'file field is required' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return Response.json({ error: 'Only images are allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'Image must be smaller than 5MB' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${page.id}/${crypto.randomUUID()}.${ext || 'png'}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const url = `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
  return Response.json({ url }, { status: 201 })
}
