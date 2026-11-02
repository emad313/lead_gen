import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  CRAWL_MAX_DEPTH: z.coerce.number().int().min(0).max(5).default(2),
  CRAWL_MAX_PAGES_PER_DOMAIN: z.coerce.number().int().positive().max(100).default(25),
  CRAWL_REQUEST_DELAY_MS: z.coerce.number().int().min(250).default(1000),
  CRAWL_USER_AGENT: z.string().min(1).default('LeadGenResearchBot/1.0'),
  SEARXNG_URL: z.string().url().optional(),
  DISCOVERY_SEEDS: z.string().default(''),
  DISCOVERY_QUERIES: z.string().default('custom software development,AI automation project,Laravel developer needed'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_SHEETS_ID: z.string().optional(),
  GOOGLE_SHEETS_TAB: z.string().default('Leads')
});

export const config = schema.parse(process.env);
