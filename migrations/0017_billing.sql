-- 0017_billing — one subscription per workspace (SaaS metering).
--
-- Control plane, like the tenancy tables (migration 0016): no RLS, scoped by
-- tenant_id in the service layer. A row is created on sign-up (a 14-day trial);
-- a billing provider's webhooks move `status` / `plan` / `current_period_end`.

CREATE TABLE subscription (
  id                       text PRIMARY KEY,
  tenant_id                text NOT NULL UNIQUE,
  plan                     text NOT NULL DEFAULT 'trial'
                             CHECK (plan IN ('trial', 'starter', 'growth')),
  status                   text NOT NULL DEFAULT 'trialing'
                             CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at            timestamptz,
  current_period_end       timestamptz,
  provider                 text NOT NULL DEFAULT 'none' CHECK (provider IN ('none', 'stripe')),
  provider_customer_id     text,
  provider_subscription_id text,
  created_at               timestamptz NOT NULL,
  updated_at               timestamptz NOT NULL
);
CREATE INDEX subscription_customer_idx ON subscription (provider_customer_id);
