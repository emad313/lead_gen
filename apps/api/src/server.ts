import Fastify from 'fastify';
import cors from '@fastify/cors';
import cron from 'node-cron';
import { config } from './config.js';
import { closeDatabase } from './db.js';
import { leadInputSchema } from './domain.js';
import { createLead, getLead, listLeads, recordEvent } from './repositories/leads.js';
import { notifyTelegram } from './integrations/telegram.js';
import { analyzeLeadWithGemini } from './integrations/gemini.js';
import { listEvidence } from './repositories/leads.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.WEB_ORIGIN });

app.get('/health', async () => ({ status: 'ok', database: 'configured' }));

app.get('/api/leads', async (request) => {
  const query = request.query as { limit?: string };
  return { data: await listLeads(Number(query.limit ?? 100)) };
});

app.get('/api/leads/:leadId', async (request, reply) => {
  const { leadId } = request.params as { leadId: string };
  const lead = await getLead(leadId);
  if (!lead) return reply.code(404).send({ error: 'Lead not found' });
  return { data: lead };
});

app.post('/api/leads', async (request, reply) => {
  const parsed = leadInputSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid lead payload', details: parsed.error.flatten() });
  const lead = await createLead(parsed.data);
  await recordEvent(String(lead.lead_id), 'lead_upserted', 'success', { source: parsed.data.leadSource });
  return reply.code(201).send({ data: lead });
});

app.post('/api/leads/:leadId/analyze', async (request, reply) => {
  const { leadId } = request.params as { leadId: string };
  const lead = await getLead(leadId);
  if (!lead) return reply.code(404).send({ error: 'Lead not found' });

  try {
    const result = await analyzeLeadWithGemini({
      companyName: String(lead.company_name),
      website: lead.website ? String(lead.website) : undefined,
      industry: lead.industry ? String(lead.industry) : undefined,
      location: lead.location ? String(lead.location) : undefined,
      contactName: lead.contact_name ? String(lead.contact_name) : undefined,
      designation: lead.designation ? String(lead.designation) : undefined,
      requiredServices: Array.isArray(lead.required_services) ? lead.required_services as string[] : [],
      evidence: await listEvidence(leadId)
    });
    await recordEvent(leadId, 'ai_research_completed', 'success', {
      provider: 'gemini',
      model: config.GEMINI_MODEL,
      confidence: result.confidence
    });
    return { data: result, provider: 'gemini', model: config.GEMINI_MODEL };
  } catch (error) {
    await recordEvent(leadId, 'ai_research_completed', 'failed', {
      provider: 'gemini',
      error: error instanceof Error ? error.message : 'Unknown Gemini error'
    });
    return reply.code(503).send({ error: error instanceof Error ? error.message : 'Gemini analysis failed' });
  }
});

app.post('/api/jobs/daily-discovery', async (_request, reply) => {
  await recordEvent(undefined, 'daily_discovery_started', 'success');
  await notifyTelegram('Lead generation daily workflow started. Source adapters are ready for configuration.');
  return reply.code(202).send({ status: 'accepted' });
});

cron.schedule('0 8 * * *', async () => {
  try {
    await recordEvent(undefined, 'daily_discovery_started', 'success', { scheduled: true });
    await notifyTelegram('Lead generation daily workflow started.');
  } catch (error) {
    app.log.error(error, 'Daily workflow failed');
  }
});

const shutdown = async (): Promise<void> => {
  await app.close();
  await closeDatabase();
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
