import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'

const pdfDirectory = path.join(process.cwd(), 'PDF')

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileName: string }> }
) {
  const { fileName } = await context.params
  const normalizedName = path.basename(fileName)

  if (!normalizedName.toLowerCase().endsWith('.pdf')) {
    return new Response('Invalid PDF file name.', { status: 400 })
  }

  const absolutePath = path.resolve(pdfDirectory, normalizedName)
  const resolvedDirectory = path.resolve(pdfDirectory)

  if (!absolutePath.startsWith(resolvedDirectory)) {
    return new Response('Invalid PDF path.', { status: 400 })
  }

  try {
    const buffer = await readFile(absolutePath)
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${normalizedName.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new Response('PDF not found.', { status: 404 })
  }
}
