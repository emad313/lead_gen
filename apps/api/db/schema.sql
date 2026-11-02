CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS leads (
  lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  website TEXT,
  normalized_domain TEXT NOT NULL,
  industry TEXT,
  location TEXT,
  contact_name TEXT,
  designation TEXT,
  business_email TEXT NOT NULL DEFAULT '',
  email_verification_status TEXT NOT NULL DEFAULT 'unavailable'
    CHECK (email_verification_status IN ('verified', 'unverified', 'unavailable')),
  linkedin_profile TEXT,
  required_services TEXT[] NOT NULL DEFAULT '{}',
  confirmed_requirements TEXT,
  inferred_opportunities TEXT,
  ai_research_and_audit TEXT,
  recommended_solution TEXT,
  lead_source TEXT NOT NULL,
  discovery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lead_status TEXT NOT NULL DEFAULT 'new'
    CHECK (lead_status IN ('new', 'qualified', 'researching', 'draft_ready', 'contacted', 'replied', 'paused', 'disqualified')),
  initial_email_status TEXT NOT NULL DEFAULT 'not_created'
    CHECK (initial_email_status IN ('not_created', 'draft_ready', 'sent', 'replied', 'stopped')),
  initial_email_date TIMESTAMPTZ,
  follow_up_date TIMESTAMPTZ,
  follow_up_status TEXT NOT NULL DEFAULT 'not_scheduled'
    CHECK (follow_up_status IN ('not_scheduled', 'due', 'draft_ready', 'sent', 'stopped')),
  next_action TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (normalized_domain, business_email)
);

CREATE TABLE IF NOT EXISTS evidence (
  evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  observed_text_or_summary TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, source_url)
);

CREATE TABLE IF NOT EXISTS activity_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(lead_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  error_code TEXT,
  reference_url TEXT
);

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (lead_status);
CREATE INDEX IF NOT EXISTS follow_up_due_idx ON leads (follow_up_date, follow_up_status);
CREATE INDEX IF NOT EXISTS activity_lead_idx ON activity_events (lead_id, event_timestamp DESC);
