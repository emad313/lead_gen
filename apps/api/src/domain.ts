import { z } from 'zod';

export const leadInputSchema = z.object({
  companyName: z.string().trim().min(1),
  website: z.string().url().optional(),
  industry: z.string().trim().optional(),
  location: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  businessEmail: z.string().email().optional(),
  emailVerificationStatus: z.enum(['verified', 'unverified', 'unavailable']).default('unavailable'),
  linkedinProfile: z.string().url().optional(),
  requiredServices: z.array(z.string().trim().min(1)).default([]),
  confirmedRequirements: z.string().trim().optional(),
  inferredOpportunities: z.string().trim().optional(),
  aiResearchAndAudit: z.string().trim().optional(),
  recommendedSolution: z.string().trim().optional(),
  leadSource: z.string().url(),
  discoveryDate: z.coerce.date().optional(),
  notes: z.string().trim().optional()
});

export type LeadInput = z.infer<typeof leadInputSchema>;

export function normalizeDomain(website: string | undefined, companyName: string): string {
  if (!website) return companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return new URL(website).hostname.toLowerCase().replace(/^www\./, '');
}
