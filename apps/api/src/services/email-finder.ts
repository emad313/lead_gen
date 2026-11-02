import dns from 'node:dns/promises';
import net from 'node:net';
import type { MxRecord } from 'node:dns';
import { getDomain } from 'tldts';

export type EmailFinding = {
  email: string;
  status: 'invalid_format' | 'domain_invalid' | 'no_mx_record' | 'smtp_unknown' | 'likely_deliverable' | 'role_based';
  reason: string;
};

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const ROLE_PREFIXES = new Set(['admin', 'careers', 'contact', 'hello', 'info', 'jobs', 'office', 'sales', 'support']);

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase().replace(/^mailto:/, '').split('?')[0];
}

export function extractEmails(html: string): string[] {
  const decoded = html
    .replace(/\s*\[at\]\s*/gi, '@')
    .replace(/\s*\(at\)\s*/gi, '@')
    .replace(/\s*\[dot\]\s*/gi, '.')
    .replace(/\s*\(dot\)\s*/gi, '.');
  return [...new Set((decoded.match(EMAIL_PATTERN) ?? []).map(normalizeEmail))];
}

export async function validateEmail(email: string, smtpProbe = true): Promise<EmailFinding> {
  const normalized = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalized)) {
    EMAIL_PATTERN.lastIndex = 0;
    return { email: normalized, status: 'invalid_format', reason: 'Email format is invalid' };
  }
  EMAIL_PATTERN.lastIndex = 0;

  const domain = getDomain(normalized);
  if (!domain) return { email: normalized, status: 'domain_invalid', reason: 'Domain is invalid' };
  const localPart = normalized.split('@')[0];
  if (ROLE_PREFIXES.has(localPart)) {
    return { email: normalized, status: 'role_based', reason: 'Role-based mailbox' };
  }

  let mxRecords: MxRecord[];
  try {
    mxRecords = await dns.resolveMx(domain);
  } catch {
    return { email: normalized, status: 'no_mx_record', reason: 'Domain has no resolvable MX record' };
  }
  if (!mxRecords.length) return { email: normalized, status: 'no_mx_record', reason: 'Domain has no MX record' };
  if (!smtpProbe) return { email: normalized, status: 'likely_deliverable', reason: 'Syntax and MX checks passed' };

  // SMTP probing is intentionally conservative: it never sends a message and
  // ambiguous or blocked responses remain smtp_unknown.
  const host = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
  const result = await probeSmtp(host, normalized);
  return { email: normalized, status: result ? 'likely_deliverable' : 'smtp_unknown', reason: result ? 'SMTP accepted recipient' : 'SMTP result was ambiguous or blocked' };
}

function probeSmtp(host: string, email: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: 25, timeout: 5000 });
    let buffer = '';
    let stage = 0;
    const finish = (accepted: boolean) => {
      socket.destroy();
      resolve(accepted);
    };
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      if (!buffer.includes('\n')) return;
      const code = Number.parseInt(buffer.slice(-4, -1), 10);
      buffer = '';
      if (stage === 0 && code >= 200 && code < 400) {
        socket.write('EHLO leadgen.local\r\n');
        stage = 1;
      } else if (stage === 1 && code >= 200 && code < 400) {
        socket.write('MAIL FROM:<>\r\n');
        stage = 2;
      } else if (stage === 2 && code >= 200 && code < 400) {
        socket.write(`RCPT TO:<${email}>\r\n`);
        stage = 3;
      } else if (stage === 3) {
        finish(code >= 200 && code < 300);
      } else if (code >= 400) {
        finish(false);
      }
    });
    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));
  });
}
