import type { Pool, PoolClient } from 'pg';
import { pool } from '../db.js';
import { normalizeDomain, type LeadInput } from '../domain.js';

type LeadRow = Record<string, unknown>;

export async function listLeads(limit = 100): Promise<LeadRow[]> {
  const result = await pool.query(
    `SELECT * FROM leads ORDER BY updated_at DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 500)]
  );
  return result.rows;
}

export async function listAllLeads(): Promise<LeadRow[]> {
  const result = await pool.query(`SELECT * FROM leads ORDER BY updated_at ASC`);
  return result.rows;
}

export async function getLead(leadId: string): Promise<LeadRow | undefined> {
  const result = await pool.query(`SELECT * FROM leads WHERE lead_id = $1`, [leadId]);
  return result.rows[0];
}

export async function listEvidence(leadId: string): Promise<Array<{ sourceUrl: string; sourceType: string; summary: string }>> {
  const result = await pool.query(
    `SELECT source_url AS "sourceUrl", source_type AS "sourceType",
      observed_text_or_summary AS summary
     FROM evidence WHERE lead_id = $1 ORDER BY observed_at DESC`,
    [leadId]
  );
  return result.rows;
}

export async function createLead(input: LeadInput, client: Pool | PoolClient = pool): Promise<LeadRow> {
  const domain = normalizeDomain(input.website, input.companyName);
  const result = await client.query(
    `INSERT INTO leads (
      company_name, website, normalized_domain, industry, location, contact_name,
      designation, business_email, email_verification_status, linkedin_profile,
      required_services, confirmed_requirements, inferred_opportunities,
      ai_research_and_audit, recommended_solution, lead_source, discovery_date, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,COALESCE($17,CURRENT_DATE),$18)
    ON CONFLICT (normalized_domain, business_email) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      website = COALESCE(EXCLUDED.website, leads.website),
      industry = COALESCE(EXCLUDED.industry, leads.industry),
      location = COALESCE(EXCLUDED.location, leads.location),
      contact_name = COALESCE(EXCLUDED.contact_name, leads.contact_name),
      designation = COALESCE(EXCLUDED.designation, leads.designation),
      email_verification_status = EXCLUDED.email_verification_status,
      linkedin_profile = COALESCE(EXCLUDED.linkedin_profile, leads.linkedin_profile),
      required_services = CASE WHEN cardinality(EXCLUDED.required_services) > 0 THEN EXCLUDED.required_services ELSE leads.required_services END,
      confirmed_requirements = COALESCE(EXCLUDED.confirmed_requirements, leads.confirmed_requirements),
      inferred_opportunities = COALESCE(EXCLUDED.inferred_opportunities, leads.inferred_opportunities),
      ai_research_and_audit = COALESCE(EXCLUDED.ai_research_and_audit, leads.ai_research_and_audit),
      recommended_solution = COALESCE(EXCLUDED.recommended_solution, leads.recommended_solution),
      notes = COALESCE(EXCLUDED.notes, leads.notes),
      updated_at = NOW()
    RETURNING *`,
    [
      input.companyName, input.website ?? null, domain, input.industry ?? null, input.location ?? null,
      input.contactName ?? null, input.designation ?? null, input.businessEmail ?? '',
      input.emailVerificationStatus, input.linkedinProfile ?? null, input.requiredServices,
      input.confirmedRequirements ?? null, input.inferredOpportunities ?? null,
      input.aiResearchAndAudit ?? null, input.recommendedSolution ?? null, input.leadSource,
      input.discoveryDate ?? null, input.notes ?? null
    ]
  );
  return result.rows[0];
}

export async function recordEvent(
  leadId: string | undefined,
  eventType: string,
  status: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO activity_events (lead_id, event_type, status, details) VALUES ($1,$2,$3,$4)`,
    [leadId ?? null, eventType, status, details]
  );
}

export async function recordEvidence(
  leadId: string,
  sourceUrl: string,
  sourceType: string,
  summary: string
): Promise<void> {
  await pool.query(
    `INSERT INTO evidence (lead_id, source_url, source_type, observed_text_or_summary)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (lead_id, source_url) DO UPDATE SET
       observed_text_or_summary = EXCLUDED.observed_text_or_summary,
       captured_at = NOW()`,
    [leadId, sourceUrl, sourceType, summary]
  );
}

export async function recordDiscoveredEmail(
  email: string,
  sourceUrl: string,
  status: string,
  reason: string,
  leadId?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO discovered_emails (lead_id, email, source_url, verification_status, verification_reason)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (email, source_url) DO UPDATE SET
       verification_status = EXCLUDED.verification_status,
       verification_reason = EXCLUDED.verification_reason`,
    [leadId ?? null, email, sourceUrl, status, reason]
  );
}

export async function listCrawlJobs(limit = 20): Promise<LeadRow[]> {
  const result = await pool.query(
    `SELECT * FROM crawl_jobs ORDER BY created_at DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)]
  );
  return result.rows;
}

export async function listActivityEvents(limit = 30): Promise<LeadRow[]> {
  const result = await pool.query(
    `SELECT event_id, lead_id, event_type, event_timestamp, status, details, error_code
     FROM activity_events ORDER BY event_timestamp DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)]
  );
  return result.rows;
}
