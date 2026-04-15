import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const { webhookUrl, data, programSlug } = req.body || {}

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Missing data' })
    }

    const payload = {
      nome: data.nome || '',
      whatsapp: data.whatsapp || '',
      email: data.email || '',
      instagram: data.instagram || '',
      programSlug: programSlug || '',
      timestamp: new Date().toISOString(),
    }

    if (!webhookUrl) {
      // Sem webhook configurado — aceitar o lead mesmo assim
      return res.status(200).json({ ok: true, warning: 'No webhook configured' })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const r = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (r.status >= 200 && r.status < 300) {
        return res.status(200).json({ ok: true })
      }
      const text = await r.text().catch(() => '')
      return res.status(200).json({ ok: false, error: `Webhook ${r.status}: ${text.slice(0, 200)}` })
    } catch (err: any) {
      clearTimeout(timeout)
      return res.status(200).json({ ok: false, error: err?.message || 'Webhook request failed' })
    }
  } catch (err: any) {
    console.error('Lead webhook error:', err)
    return res.status(500).json({ ok: false, error: 'Internal server error' })
  }
}
