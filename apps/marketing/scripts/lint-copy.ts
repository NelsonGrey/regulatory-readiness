import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { scanMarketingCopy } from '@rre/copy-guard'

const root = new URL('../src/', import.meta.url)
const extensions = new Set(['.astro', '.md', '.mdx', '.ts', '.tsx'])
const violations: string[] = []

async function visit(directory: URL): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory)
    if (entry.isDirectory()) {
      await visit(new URL(`${entry.name}/`, directory))
      continue
    }
    if (!extensions.has(extname(entry.name))) continue
    const text = await readFile(url, 'utf8')
    for (const finding of scanMarketingCopy(text)) {
      const before = text.slice(0, finding.index)
      const line = before.split('\n').length
      violations.push(`${relative(process.cwd(), join(url.pathname))}:${line}: ${finding.phrase}`)
    }
  }
}

await visit(root)
if (violations.length > 0) {
  console.error(`Forbidden marketing language found:\n${violations.join('\n')}`)
  process.exitCode = 1
} else {
  console.log('Marketing copy guard passed.')
}
