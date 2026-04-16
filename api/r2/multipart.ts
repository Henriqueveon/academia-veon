import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const ALLOWED_FOLDERS = ['posts', 'avatars', 'covers', 'treinamentos', 'modulos', 'aulas', 'programas']
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/mov',
  'audio/webm', 'audio/mp4', 'audio/mpeg',
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.body as { action?: string }

  try {
    if (action === 'init') {
      const { folder, contentType, ext } = req.body as {
        folder?: string; contentType?: string; ext?: string
      }
      if (!folder || !ALLOWED_FOLDERS.some((f) => folder.startsWith(f))) {
        return res.status(400).json({ error: 'Invalid folder' })
      }
      if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
        return res.status(400).json({ error: 'Tipo de arquivo não permitido' })
      }
      const safeExt = (ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5)
      const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`
      const { UploadId } = await s3.send(
        new CreateMultipartUploadCommand({ Bucket: R2_BUCKET_NAME, Key: key, ContentType: contentType }),
      )
      return res.status(200).json({ uploadId: UploadId, key, publicUrl: `${R2_PUBLIC_URL}/${key}` })
    }

    if (action === 'sign-part') {
      const { key, uploadId, partNumber } = req.body as {
        key?: string; uploadId?: string; partNumber?: number
      }
      if (!key || !uploadId || !partNumber) {
        return res.status(400).json({ error: 'Missing key, uploadId or partNumber' })
      }
      const cmd = new UploadPartCommand({
        Bucket: R2_BUCKET_NAME, Key: key, UploadId: uploadId, PartNumber: partNumber,
      })
      const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 3600 }) // 1h por parte
      return res.status(200).json({ signedUrl })
    }

    if (action === 'complete') {
      const { key, uploadId, parts } = req.body as {
        key?: string
        uploadId?: string
        parts?: Array<{ partNumber: number; etag: string }>
      }
      if (!key || !uploadId || !parts?.length) {
        return res.status(400).json({ error: 'Missing key, uploadId or parts' })
      }
      await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
          },
        }),
      )
      return res.status(200).json({ ok: true })
    }

    if (action === 'abort') {
      const { key, uploadId } = req.body as { key?: string; uploadId?: string }
      if (!key || !uploadId) return res.status(400).json({ error: 'Missing key or uploadId' })
      await s3.send(
        new AbortMultipartUploadCommand({ Bucket: R2_BUCKET_NAME, Key: key, UploadId: uploadId }),
      )
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (error: any) {
    console.error('R2 multipart error:', error)
    return res.status(500).json({ error: 'Multipart operation failed', details: error.message })
  }
}
