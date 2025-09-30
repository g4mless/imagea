import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import ImageKit from 'imagekit'

const app = new Hono({ strict: false })

app.use('*', cors())

const REQUIRED = ['IMAGEKIT_PUBLIC_KEY','IMAGEKIT_PRIVATE_KEY','IMAGEKIT_URL_ENDPOINT'] as const
{
  const miss = REQUIRED.filter((k) => !process.env[k])
  if (miss.length) throw new Error(`Missing env: ${miss.join(', ')}`)
}

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
})

app.get('/', (c) => c.text('ok'))

// ImageKit SDK auth
app.get('/imagekit-auth', (c) => {
  const auth = imagekit.getAuthenticationParameters()
  return c.json(auth)
})

// Upload: multipart or JSON base64
app.post('/images', async (c) => {
  try {
    const contentType = c.req.header('content-type') || ''

    // JSON: base64 in "file" or "base64"
    if (contentType.includes('application/json')) {
      const json = (await c.req.json().catch(() => ({}))) as {
        file?: string
        base64?: string
        fileName?: string
        folder?: string
      }

      const base64 = json.file ?? json.base64
      if (!base64) {
        return c.json({ error: 'Missing "file" (base64) in JSON body' }, 400)
      }

      const cleanedBase64 = stripDataUrlPrefix(base64)
      const fileName = json.fileName || `upload_${Date.now()}.bin`

      const uploaded = await imagekit.upload({
        file: cleanedBase64,
        fileName,
        folder: json.folder ?? '/uploads',
      })

      return c.json(toPublicFile(uploaded), 201)
    }

    // multipart: "file" or "image"; optional "fileName", "folder"
    const body = await c.req.parseBody()
    const filePart = (body.file ?? body.image) as any
    let file: string | Buffer | undefined
    let fileName = (typeof body.fileName === 'string' && body.fileName) || undefined

    if (filePart && typeof filePart === 'object' && typeof (filePart as any).arrayBuffer === 'function') {
      const ab = await (filePart as any).arrayBuffer()
      file = Buffer.from(ab)
      fileName ||= (filePart as any).name || `upload_${Date.now()}.bin`
    } else if (typeof filePart === 'string') {
      file = stripDataUrlPrefix(filePart)
      fileName ||= `upload_${Date.now()}.bin`
    }

    if (!file) {
      return c.json({ error: 'Provide "file" as multipart file or base64 string' }, 400)
    }

    const uploaded = await imagekit.upload({
      file,
      fileName: fileName!,
      folder: typeof body.folder === 'string' ? body.folder : '/uploads',
    })

    return c.json(toPublicFile(uploaded), 201)
  } catch (err: any) {
    return c.json({ error: err?.message || 'Upload failed' }, 500)
  }
})

// Delete by fileId
app.delete('/images/:fileId', async (c) => {
  const fileId = c.req.param('fileId')
  if (!fileId) return c.json({ error: 'Missing fileId' }, 400)

  try {
    await imagekit.deleteFile(fileId)
    return c.json({ success: true, id: fileId })
  } catch (err: any) {
    return c.json({ error: err?.message || 'Delete failed' }, 500)
  }
})

// List images
app.get('/images', async (c) => {
  try {
    const q = c.req.query()

    const limitParsed = parseInt((q.limit as string) ?? '')
    const skipParsed = parseInt((q.skip as string) ?? '')
    const limit = Number.isFinite(limitParsed) ? Math.min(100, Math.max(1, limitParsed)) : 20
    const skip = Number.isFinite(skipParsed) ? Math.max(0, skipParsed) : 0

    const options: Record<string, any> = {
      limit,
      skip,
    }

    const pathParam = (q.folder as string) || (q.path as string)
    if (typeof pathParam === 'string' && pathParam) options.path = pathParam

    const fileType = q.fileType as string | undefined
    if (fileType && ['all', 'image', 'non-image', 'video'].includes(fileType)) {
      options.fileType = fileType
    }


    const items = await imagekit.listFiles(options)
    return c.json(items.map(toPublicFile))
  } catch (err: any) {
    return c.json({ error: err?.message || 'List failed' }, 500)
  }
})

// Get file details
app.get('/images/:fileId', async (c) => {
  const fileId = c.req.param('fileId')
  if (!fileId) return c.json({ error: 'Missing fileId' }, 400)
  try {
    const file = await imagekit.getFileDetails(fileId)
    return c.json(toPublicFile(file))
  } catch (err: any) {
    return c.json({ error: err?.message || 'Fetch details failed' }, 500)
  }
})

const port = Number(process.env.PORT) || 3000
serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)

type PublicFile = {
  id: string
  name: string
  filetype?: string
  url: string
  thumbnail?: string
}

function toPublicFile(f: any): PublicFile {
  const clean = (u?: string) => (u ? stripUpdatedAt(u) : '')
  return {
    id: f.fileId ?? f.id ?? '',
    name: f.name ?? '',
    filetype: f.fileType ?? f.mime ?? undefined,
    url: clean(f.url ?? ''),
    thumbnail: f.thumbnail ?? f.thumbnailUrl ?? undefined,
  }
}

function stripUpdatedAt(urlStr: string): string {
  try {
    const u = new URL(urlStr)
    u.searchParams.delete('updatedAt')
    return u.toString()
  } catch {
    return urlStr.replace(/([?&])updatedAt=\d+(&?)/, (_, sep, trailing) => {
      if (sep === '?' && !trailing) return ''
      if (trailing) return sep
      return ''
    })
  }
}

function stripDataUrlPrefix(input: string): string {
  const match = input.match(/^data:.*;base64,(.*)$/)
  return match ? match[1] : input
}
