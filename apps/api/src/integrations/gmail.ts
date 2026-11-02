export type GmailDraftRequest = {
  to: string;
  subject: string;
  body: string;
};

export async function createGmailDraft(_request: GmailDraftRequest): Promise<{ status: 'not_configured' }> {
  // Gmail OAuth and draft creation are intentionally isolated behind this boundary.
  // There is no send method: outbound email must remain human-approved.
  return { status: 'not_configured' };
}
