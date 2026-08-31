export const siteConfig = {
  name: 'Regulatory Readiness',
  legalName: 'TODO: owner to supply legal entity name',
  address: 'TODO: owner to supply registered address',
  description:
    'Regulatory evidence readiness for organizations preparing source-linked, reviewable records.',
  appUrl: import.meta.env.PUBLIC_APP_URL ?? 'https://app.readiness.example',
  contactEmail: 'hello@readiness.example',
  securityEmail: 'security@readiness.example',
  pressEmail: 'press@readiness.example',
} as const

/** Where the "Start free" / "Sign in" actions go. */
export const signUpUrl = `${siteConfig.appUrl}/sign-up`
export const signInUrl = siteConfig.appUrl

/**
 * Plan shape mirrors `apps/api/src/billing/plans.ts`. Prices are the one thing
 * the owner sets before launch — change them here and nowhere else.
 * TODO: owner to confirm monthly prices and the currency shown.
 */
export const plans = [
  {
    key: 'trial',
    name: 'Trial',
    price: 'Free for 14 days',
    priceNote: 'No card to start.',
    tagline: 'See the method against one real entity.',
    limits: ['3 regulated entities', '3 workspace seats', '100 MB evidence storage'],
    cta: 'Start free',
    featured: false,
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '€149',
    priceNote: 'per workspace, per month',
    tagline: 'A small team preparing one or two regulations.',
    limits: ['25 regulated entities', '10 workspace seats', '5 GB evidence storage'],
    cta: 'Start free',
    featured: true,
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '€399',
    priceNote: 'per workspace, per month',
    tagline: 'A portfolio of entities across several packs.',
    limits: ['Unlimited regulated entities', 'Unlimited seats', '50 GB evidence storage'],
    cta: 'Start free',
    featured: false,
  },
] as const

export const primaryNav = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/platform', label: 'Platform' },
  { href: '/packs', label: 'Packs' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/security', label: 'Security' },
  { href: '/blog', label: 'Briefings' },
] as const
