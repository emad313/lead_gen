import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config.js';
import { crawlSeed } from './crawler.js';
import { pool } from '../db.js';
import { createLead, recordDiscoveredEmail, recordEvent, recordEvidence } from '../repositories/leads.js';

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
export const discoveryQueue = new Queue('lead-discovery', { connection });

const BUYING_INTENT = /\b(looking for|seeking|hiring|need(?:s|ed)?|request(?:ing|ed)?|rfp|project|developer|automation|integration)\b/i;

export function getDiscoveryQueries(): string[] {
  return config.DISCOVERY_QUERIES.split(',').map((query) => query.trim()).filter(Boolean);
}

async function findSearchSeeds(): Promise<string[]> {
  const directSeeds = config.DISCOVERY_SEEDS.split(',').map((seed) => seed.trim()).filter(Boolean);
  if (!config.SEARXNG_URL) return directSeeds;
  const queries = getDiscoveryQueries();
  const results = await Promise.all(queries.map(async (query) => {
    const url = new URL('/search', config.SEARXNG_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`SearXNG search failed with status ${response.status}`);
    const body = await response.json() as { results?: Array<{ url?: string }> };
    return (body.results ?? []).map((result) => result.url ?? '').filter(Boolean);
  }));
  return [...new Set([...directSeeds, ...results.flat()])];
}

export function startDiscoveryWorker(): Worker {
  return new Worker('lead-discovery', async (job) => {
    const seeds = await findSearchSeeds();
    const result = await pool.query(`INSERT INTO crawl_jobs (status, seed_count, started_at) VALUES ('running', $1, NOW()) RETURNING job_id`, [seeds.length]);
    const crawlJobId = result.rows[0].job_id as string;
    let pagesCrawled = 0;
    let emailsFound = 0;
    try {
      for (const seed of seeds) {
        const pages = await crawlSeed(seed);
        pagesCrawled += pages.length;
        emailsFound += pages.reduce((count, page) => count + page.emails.length, 0);
        await pool.query(
          `UPDATE crawl_jobs SET pages_crawled = $1, emails_found = $2 WHERE job_id = $3`,
          [pagesCrawled, emailsFound, crawlJobId]
        );
        const intentPages = pages.filter((page) => BUYING_INTENT.test(page.text));
        let leadId: string | undefined;
        if (intentPages.length) {
          const origin = new URL(seed);
          const lead = await createLead({
            companyName: origin.hostname.replace(/^www\./, ''),
            website: origin.origin,
            leadSource: seed,
            requiredServices: [],
            emailVerificationStatus: 'unavailable'
          });
          leadId = String(lead.lead_id);
          for (const page of intentPages) {
            await recordEvidence(leadId, page.url, 'website_crawl', page.text.slice(0, 4000));
          }
        }
        for (const page of pages) {
          for (const finding of page.emails) {
            await recordDiscoveredEmail(finding.email, page.url, finding.status, finding.reason, leadId);
          }
        }
        await recordEvent(undefined, 'crawl_seed_completed', 'success', { seed, pages: pages.length, emails: pages.flatMap((page) => page.emails).length });
      }
      await pool.query(`UPDATE crawl_jobs SET status = 'completed', pages_crawled = $1, emails_found = $2, completed_at = NOW() WHERE job_id = $3`, [pagesCrawled, emailsFound, crawlJobId]);
    } catch (error) {
      await pool.query(`UPDATE crawl_jobs SET status = 'failed', pages_crawled = $1, emails_found = $2, error = $3, completed_at = NOW() WHERE job_id = $4`, [pagesCrawled, emailsFound, error instanceof Error ? error.message : 'Unknown crawl error', crawlJobId]);
      throw error;
    }
  }, { connection, concurrency: 2 });
}
