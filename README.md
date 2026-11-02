# Lead Gen Automation

Initial runnable foundation for the AI-powered B2B lead generation workflow.

## Stack

- **API/worker:** Node.js, TypeScript, Fastify, `node-cron`
- **Dashboard:** Vue 3, TypeScript, Vite
- **Database:** PostgreSQL 16
- **Notifications:** Telegram adapter
- **AI analysis:** Google Gemini
- **Crawling:** native `fetch`, Cheerio, robots-parser, tldts
- **Email discovery:** public-page extraction, DNS/MX, cautious SMTP probe
- **Jobs:** Redis + BullMQ
- **Outreach:** Gmail draft adapter only; no send operation exists

## Run locally

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start PostgreSQL, Redis, and SearXNG: `npm run db:up`.
4. Confirm services: `docker compose ps`.
5. Start API and dashboard: `npm run dev`.
6. Open `http://localhost:5173`.

The API listens on `http://localhost:3000`. Use `POST /api/leads` to add a
lead. External source discovery, Google OAuth, Gmail drafts, and Telegram
delivery are intentionally isolated behind adapters and require credentials.
Leads without an email use an empty internal email key so repeated discovery
for the same normalized domain updates one record instead of creating duplicates.

The Docker PostgreSQL service uses host port `55432` to avoid conflicts with
an existing local PostgreSQL installation.

Google OAuth is optional for the current local workflow. Discovery, crawling,
Gemini analysis, PostgreSQL persistence, Redis jobs, SearXNG search, and
Telegram notifications do not require a Google refresh token. Gmail drafts and
Google Sheets synchronization remain disabled until a future OAuth integration
is explicitly enabled.

Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in `.env` to enable Gemini.
`POST /api/leads/:leadId/analyze` performs evidence-grounded analysis and
returns confirmed requirements separately from inferred opportunities.

For automatic discovery, `npm run db:up` starts the self-hosted SearXNG instance
at `http://localhost:8080`. The configured
`DISCOVERY_QUERIES` are searched automatically, and public result URLs are
crawled. `DISCOVERY_SEEDS` is optional and can contain extra direct URLs.
Start Redis before the API when using the discovery queue.

The crawler respects `robots.txt`, same-origin boundaries, configured depth and
page limits, and request delays. It extracts only publicly visible email
addresses. SMTP probing never sends email and ambiguous results remain
`smtp_unknown`; it is not proof of mailbox ownership or deliverability.

## Safety

The system stores research evidence and supports human-reviewed Gmail drafts.
It must not be extended with automatic cold-email sending. Configure source
adapters only for permitted public sources and implement opt-out suppression
before production use.
