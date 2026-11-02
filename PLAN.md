# AI-Powered B2B Lead Generation and Outreach Automation

## Goal

Build a daily, duplicate-resistant lead discovery and research workflow for IT,
software development, web/mobile development, and AI automation opportunities.
The system will collect evidence-backed lead data, write it to Google Sheets,
create Gmail drafts for human approval, schedule contextual follow-up drafts,
and report activity through Telegram.

The system will **never automatically send cold email**. Initial messages and
follow-ups remain Gmail drafts until a human reviews and sends them.

## Scope and guardrails

- Replace WhatsApp notifications with Telegram notifications.
- Search only public, permitted sources and respect each source's terms,
  robots rules, rate limits, and applicable privacy and anti-spam laws.
- Never invent a person, email address, requirement, or technology stack.
- Store evidence URLs and discovery timestamps for every material claim.
- Mark contact details as `verified`, `unverified`, or `unavailable`.
- Clearly separate confirmed requirements from AI-inferred opportunities.
- Deduplicate by normalized company website/domain plus contact identity where
  available; retain source evidence for subsequent discoveries.
- Require human approval before every outbound message.
- Keep secrets in environment variables or a secret manager, never in Sheets,
  source code, or logs.

## Proposed architecture

1. **Scheduler**
   - Runs the daily discovery/research/report workflow.
   - Runs a separate follow-up check at least once daily.
   - Uses an idempotency key for each run and lead action.

2. **Source adapters**
   - Search engines, business directories, job boards, forums, and public
     company pages.
   - Each adapter emits a common lead candidate shape:
     source URL, observed request/evidence, company hints, contact hints, and
     discovery timestamp.
   - Adapters are rate-limited and independently observable.

3. **Lead qualification and deduplication**
   - Scores buying intent using explicit evidence such as a project request,
     hiring requirement, RFP, or service request.
   - Normalizes domains, company names, URLs, and contact identities.
   - Merges duplicate evidence into one lead while preserving all source URLs.

4. **Website and decision-maker research**
   - Fetches public website pages and relevant public professional profiles.
   - Extracts company facts, industry, location, decision-maker candidates,
     service requirements, and technology evidence.
   - Uses an email verifier only where legally and technically appropriate;
     no email is considered verified without a successful verification result.

5. **AI analysis**
   - Produces structured output for confirmed requirements, inferred
     opportunities, supporting evidence, recommended services, rationale, and
     confidence.
   - Rejects unsupported claims and records the evidence used.

6. **Google Sheets repository**
   - Maintains one canonical row per lead/contact.
   - Uses stable Lead IDs and idempotent upserts.
   - Stores the requested lead, research, outreach, follow-up, and notes
     columns, plus operational columns needed for auditability.

7. **Gmail draft workflow**
   - Generates a concise, context-specific subject and body.
   - Creates an initial Gmail draft only for qualified leads with sufficient
     evidence and an available contact address.
   - Checks the thread before creating a follow-up draft.
   - Stops follow-up generation when a reply or other configured stop condition
     is detected.

8. **Audit and notifications**
   - Writes append-only activity events with lead ID, event type, timestamp,
     actor, status, and error details.
   - Sends Telegram alerts for new qualified leads, batch completion, drafts
     awaiting approval, due follow-ups, replies, and important failures.
   - Telegram messages include company, contact, recommended services, and
     Sheets/Gmail references where available.

## Initial data model

### Leads

- `lead_id`
- `company_name`
- `website`
- `normalized_domain`
- `industry`
- `location`
- `contact_name`
- `designation`
- `business_email`
- `email_verification_status`
- `linkedin_profile`
- `required_services`
- `confirmed_requirements`
- `inferred_opportunities`
- `ai_research_and_audit`
- `recommended_solution`
- `lead_source`
- `discovery_date`
- `lead_status`
- `initial_email_status`
- `initial_email_date`
- `follow_up_date`
- `follow_up_status`
- `next_action`
- `notes`
- `created_at`
- `updated_at`

### Evidence

- `evidence_id`
- `lead_id`
- `source_url`
- `source_type`
- `observed_text_or_summary`
- `observed_at`
- `captured_at`

### Activity events

- `event_id`
- `lead_id`
- `event_type`
- `event_timestamp`
- `status`
- `details`
- `error_code`
- `reference_url`

## Daily workflow

1. Start a run and record its idempotency key.
2. Query configured public sources for high-intent opportunities.
3. Normalize and deduplicate candidates against existing leads.
4. Qualify candidates and persist evidence before AI analysis.
5. Research company websites and public decision-maker information.
6. Verify email addresses where possible and label uncertainty.
7. Generate structured research and service recommendations.
8. Upsert leads and evidence into Google Sheets and the audit store.
9. Create Gmail drafts for qualified leads; do not send.
10. Send Telegram notifications for new leads, batches, drafts, and failures.
11. Generate a daily summary with totals and incomplete-task details.

## Follow-up workflow

1. Find leads whose initial email was sent three or more days ago and whose
   follow-up is not complete.
2. Check the Gmail thread for replies, bounces, unsubscribes, or other stop
   conditions.
3. If a stop condition exists, update the lead and do not create a draft.
4. Otherwise generate a contextual follow-up from the original evidence and
   create a Gmail draft for approval.
5. Update Sheets and the audit log, then notify Telegram.

## Reliability and security requirements

- Use retries with exponential backoff only for transient failures.
- Make discovery, Sheets upserts, Gmail draft creation, and notifications
  idempotent.
- Persist partial progress so one source or lead failure does not discard a
  complete batch.
- Redact secrets and sensitive payloads from logs.
- Apply least-privilege OAuth scopes for Google and Telegram credentials.
- Include unsubscribe/opt-out handling and suppress opted-out contacts.
- Provide dry-run mode for source collection and draft generation.
- Add health checks, structured logs, metrics, and failure notifications.

## Delivery phases

### Phase 1 - Foundation

- Choose runtime and deployment target.
- Add configuration, secret handling, structured logging, and persistence.
- Define schemas, state transitions, and idempotency rules.

### Phase 2 - Lead discovery

- Implement source adapter interface and initial permitted sources.
- Implement normalization, evidence capture, qualification, and deduplication.
- Add focused tests with fixtures instead of live scraping.

### Phase 3 - Research and analysis

- Implement website fetching and decision-maker extraction.
- Add email verification integration and explicit confidence/status fields.
- Add structured AI analysis with evidence requirements.

### Phase 4 - Sheets and Gmail

- Implement Google Sheets schema/upserts and audit columns.
- Implement Gmail draft creation and thread/reply checks.
- Add approval-oriented state transitions and dry-run tests.

### Phase 5 - Telegram and reporting

- Implement Telegram bot notifications and configurable chat routing.
- Add daily summaries, error alerts, and notification deduplication.

### Phase 6 - Operations

- Add scheduler deployment, health checks, dashboards, retention policies,
  rate-limit controls, and end-to-end testing.
- Run a limited pilot with human review before enabling daily production runs.

## Acceptance criteria

- A daily run can discover, qualify, deduplicate, research, and persist leads
  without losing source evidence.
- Every lead has a stable ID, discovery date, source URL, and explicit status
  for unverifiable fields.
- Confirmed requirements and inferred opportunities are visibly separate.
- Duplicate runs do not create duplicate lead rows or Gmail drafts.
- Initial and follow-up messages are Gmail drafts only; no automatic sending
  path exists.
- Follow-ups are suppressed after a reply, bounce, unsubscribe, or opt-out.
- Telegram notifications are delivered for all requested events and include
  useful references.
- Daily reports include successful, skipped, failed, and incomplete work.
- Automated tests cover normalization, deduplication, state transitions,
  follow-up suppression, draft idempotency, and failure recovery.

## Decisions needed before implementation

1. Runtime and deployment target (for example Python plus a scheduled worker,
   or Node.js plus a scheduled worker).
2. Initial source list and API credentials/quotas.
3. Gemini model and budget limits.
4. Persistent database choice versus Google Sheets plus a local state store.
5. Email verification provider.
6. Telegram bot token, destination chat ID(s), and notification preferences.
7. Google Cloud project, OAuth consent configuration, and Gmail/Sheets scopes.
8. Sending persona, service portfolio, and approval/status conventions.
