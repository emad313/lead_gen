# Lead Gen Automation

Initial runnable foundation for the AI-powered B2B lead generation workflow.

## Stack

- **API/worker:** Node.js, TypeScript, Fastify, `node-cron`
- **Dashboard:** Vue 3, TypeScript, Vite
- **Database:** PostgreSQL 16
- **Notifications:** Telegram adapter
- **AI analysis:** Google Gemini
- **Outreach:** Gmail draft adapter only; no send operation exists

## Run locally

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start PostgreSQL: `npm run db:up`.
4. Start API and dashboard: `npm run dev`.
5. Open `http://localhost:5173`.

The API listens on `http://localhost:3000`. Use `POST /api/leads` to add a
lead. External source discovery, Google OAuth, Gmail drafts, and Telegram
delivery are intentionally isolated behind adapters and require credentials.
Leads without an email use an empty internal email key so repeated discovery
for the same normalized domain updates one record instead of creating duplicates.

Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in `.env` to enable Gemini.
`POST /api/leads/:leadId/analyze` performs evidence-grounded analysis and
returns confirmed requirements separately from inferred opportunities.

## Safety

The system stores research evidence and supports human-reviewed Gmail drafts.
It must not be extended with automatic cold-email sending. Configure source
adapters only for permitted public sources and implement opt-out suppression
before production use.
