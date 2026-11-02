import * as cheerio from 'cheerio';
import robotsParserModule from 'robots-parser';
import { config } from '../config.js';
import { extractEmails, validateEmail, type EmailFinding } from './email-finder.js';

export type CrawledPage = {
  url: string;
  title: string;
  text: string;
  links: string[];
  emails: EmailFinding[];
  depth: number;
};

export async function crawlSeed(seed: string): Promise<CrawledPage[]> {
  const origin = new URL(seed);
  const robotsUrl = `${origin.protocol}//${origin.host}/robots.txt`;
  const robotsResponse = await fetch(robotsUrl, { headers: { 'user-agent': config.CRAWL_USER_AGENT } });
  const robotsParser = robotsParserModule as unknown as (url: string, text: string) => { isAllowed: (target: string, userAgent: string) => boolean };
  const robots = robotsParser(robotsUrl, robotsResponse.ok ? await robotsResponse.text() : '');
  const queue = [{ url: seed, depth: 0 }];
  const visited = new Set<string>();
  const pages: CrawledPage[] = [];

  while (queue.length && pages.length < config.CRAWL_MAX_PAGES_PER_DOMAIN) {
    const current = queue.shift();
    if (!current || visited.has(current.url) || current.depth > config.CRAWL_MAX_DEPTH) continue;
    visited.add(current.url);
    if (!robots.isAllowed(current.url, config.CRAWL_USER_AGENT)) continue;

    const response = await fetch(current.url, { headers: { 'user-agent': config.CRAWL_USER_AGENT } });
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('text/html')) continue;
    const html = await response.text();
    const $ = cheerio.load(html);
    const links = $('a[href]').map((_, element) => {
      try {
        const url = new URL($(element).attr('href') ?? '', current.url);
        return url.origin === origin.origin && ['http:', 'https:'].includes(url.protocol) ? url.toString().split('#')[0] : '';
      } catch {
        return '';
      }
    }).get().filter(Boolean);
    const emails = [];
    for (const email of extractEmails(html)) emails.push(await validateEmail(email, true));
    pages.push({ url: current.url, title: $('title').text().trim(), text: $('body').text().replace(/\s+/g, ' ').trim().slice(0, 10000), links, emails, depth: current.depth });
    for (const link of [...new Set(links)]) if (!visited.has(link)) queue.push({ url: link, depth: current.depth + 1 });
    await new Promise((resolve) => setTimeout(resolve, config.CRAWL_REQUEST_DELAY_MS));
  }
  return pages;
}
