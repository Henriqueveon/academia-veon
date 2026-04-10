import type { VercelRequest, VercelResponse } from '@vercel/node'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

const ALLOWED_FOLDERS = ['posts', 'avatars', 'covers']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { folder, contentType, ext } = req.body as {
      folder?: string
      contentType?: string
      ext?: string
    }

    if (!folder || !ALLOWED_FOLDERS.some((f) => folder.startsWith(f))) {
      return res.status(400).json({ error: 'Invalid folder' })
    }

    if (!contentType) {
      return res.status(400).json({ error: 'Missing content type' })
    }

    const safeExt = (ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5)
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 }) // 10 min
    const publicUrl = `${R2_PUBLIC_URL}/${key}`

    return res.status(200).json({ uploadUrl, publicUrl, key })
  } catch (error: any) {
    console.error('R2 sign error:', error)
    return res.status(500).json({ error: 'Failed to sign upload', details: error.message })
  }
}
