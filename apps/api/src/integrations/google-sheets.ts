import { readFile } from 'node:fs/promises';
import { google, sheets_v4 } from 'googleapis';
import { config } from '../config.js';

type LeadRow = Record<string, unknown>;

const headers = [
  'Lead ID', 'Company Name', 'Website', 'Industry', 'Location', 'Contact Person',
  'Designation', 'Business Email', 'Email Verification Status', 'LinkedIn Profile',
  'Required Services', 'Confirmed Requirements', 'Inferred Opportunities',
  'AI Research & Audit', 'Recommended Solution', 'Lead Source', 'Discovery Date',
  'Lead Status', 'Initial Email Status', 'Initial Email Date', 'Follow-up Date',
  'Follow-up Status', 'Next Action', 'Notes'
];

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(config.GOOGLE_SERVICE_ACCOUNT_JSON_PATH && config.GOOGLE_SHEETS_ID);
}

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (!config.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || !config.GOOGLE_SHEETS_ID) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_PATH and GOOGLE_SHEETS_ID are required');
  }
  const credentials = JSON.parse(await readFile(config.GOOGLE_SERVICE_ACCOUNT_JSON_PATH, 'utf8')) as {
    client_email?: string;
    private_key?: string;
  };
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Service account JSON is missing client_email or private_key');
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

function value(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value instanceof Date) return value.toISOString();
  return value == null ? '' : String(value);
}

function rowFromLead(lead: LeadRow): string[] {
  return [
    value(lead.lead_id), value(lead.company_name), value(lead.website), value(lead.industry),
    value(lead.location), value(lead.contact_name), value(lead.designation), value(lead.business_email),
    value(lead.email_verification_status), value(lead.linkedin_profile), value(lead.required_services),
    value(lead.confirmed_requirements), value(lead.inferred_opportunities), value(lead.ai_research_and_audit),
    value(lead.recommended_solution), value(lead.lead_source), value(lead.discovery_date),
    value(lead.lead_status), value(lead.initial_email_status), value(lead.initial_email_date),
    value(lead.follow_up_date), value(lead.follow_up_status), value(lead.next_action), value(lead.notes)
  ];
}

export async function syncLeadToGoogleSheet(lead: LeadRow): Promise<{ rowNumber: number; action: 'inserted' | 'updated' }> {
  const sheets = await getSheetsClient();
  const spreadsheetId = config.GOOGLE_SHEETS_ID as string;
  const tab = config.GOOGLE_SHEETS_TAB;
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:X`
  });
  const rows = existing.data.values ?? [];
  if (!rows.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1:X2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers, rowFromLead(lead)] }
    });
    return { rowNumber: 2, action: 'inserted' };
  }
  if (rows[0].join('|') !== headers.join('|')) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1:X1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] }
    });
  }
  const rowIndex = rows.findIndex((row) => row[0] === value(lead.lead_id));
  if (rowIndex >= 1) {
    const rowNumber = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A${rowNumber}:X${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowFromLead(lead)] }
    });
    return { rowNumber, action: 'updated' };
  }
  const appended = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:X`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowFromLead(lead)] }
  });
  const rowNumber = Number(appended.data.updates?.updatedRange?.match(/(\d+)$/)?.[1] ?? 0);
  return { rowNumber, action: 'inserted' };
}
