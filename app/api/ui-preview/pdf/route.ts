import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const pdfDirectory = path.join(process.cwd(), 'PDF')

export async function GET() {
  try {
    const entries = await readdir(pdfDirectory, { withFileTypes: true })
    const firstPdf = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))[0]

    if (!firstPdf) {
      return NextResponse.json({
        available: false,
        fileName: null,
        src: null,
        message: 'No PDF found in the /PDF folder yet.',
      })
    }

    return NextResponse.json({
      available: true,
      fileName: firstPdf,
      src: `/api/ui-preview/pdf-file/${encodeURIComponent(firstPdf)}`,
      message: null,
    })
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
        ? 'The /PDF folder does not exist yet.'
        : 'Could not read the /PDF folder.'

    return NextResponse.json({
      available: false,
      fileName: null,
      src: null,
      message,
    })
  }
}
