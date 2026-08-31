import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'
import process from 'node:process'

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://readiness.example',
  integrations: [mdx(), sitemap()],
  output: 'static',
  build: { format: 'directory' },
})
