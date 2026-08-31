import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import type { APIContext } from 'astro'

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', ({ data }) => !data.draft)
  return rss({
    title: 'Regulatory Readiness deadline briefings',
    description: 'Methods, source changes, and practical regulatory evidence preparation.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: post.data.date,
      link: `/blog/${post.data.slug}/`,
    })),
  })
}
