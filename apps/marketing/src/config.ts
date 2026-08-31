export const siteConfig = {
  name: 'Regulatory Readiness',
  legalName: 'TODO: owner to supply legal entity name',
  address: 'TODO: owner to supply registered address',
  description:
    'Regulatory evidence readiness for organizations preparing source-linked, reviewable records.',
  appUrl: import.meta.env.PUBLIC_APP_URL ?? 'https://app.readiness.example',
  schedulerUrl: import.meta.env.PUBLIC_SCHEDULER_URL ?? '/contact#schedule',
  contactEmail: 'hello@readiness.example',
  securityEmail: 'security@readiness.example',
  pressEmail: 'press@readiness.example',
} as const

export const primaryNav = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/platform', label: 'Platform' },
  { href: '/packs', label: 'Packs' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/security', label: 'Security' },
  { href: '/blog', label: 'Briefings' },
] as const
