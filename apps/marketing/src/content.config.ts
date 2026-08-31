import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'zod'

const packs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/packs' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    regulation: z.string(),
    jurisdiction: z.string(),
    status: z.enum(['available', 'discovery', 'hold']),
    enforcementDate: z.coerce.date().optional(),
    summary: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.url() })),
  }),
})

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    tags: z.array(z.string()),
    summary: z.string(),
    draft: z.boolean().default(false),
  }),
})

const legal = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/legal' }),
  schema: z.object({ title: z.string(), slug: z.string(), lastUpdated: z.coerce.date() }),
})

export const collections = { packs, posts, legal }
