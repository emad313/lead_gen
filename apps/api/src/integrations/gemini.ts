import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

export type LeadResearchInput = {
  companyName: string;
  website?: string;
  industry?: string;
  location?: string;
  contactName?: string;
  designation?: string;
  requiredServices: string[];
  evidence: Array<{ sourceUrl: string; sourceType: string; summary: string }>;
};

export type LeadResearchResult = {
  confirmedRequirements: string[];
  inferredOpportunities: string[];
  technicalChallenges: string[];
  recommendedServices: string[];
  rationale: string;
  confidence: number;
};

export async function analyzeLeadWithGemini(input: LeadResearchInput): Promise<LeadResearchResult> {
  if (!config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const client = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: config.GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json' }
  });
  const response = await model.generateContent([
    `Analyze this B2B lead using only the supplied evidence.
Return JSON matching this shape exactly:
{
  "confirmedRequirements": ["..."],
  "inferredOpportunities": ["..."],
  "technicalChallenges": ["..."],
  "recommendedServices": ["..."],
  "rationale": "...",
  "confidence": 0
}
Rules:
- confirmedRequirements must contain only requirements directly supported by evidence.
- inferredOpportunities must be clearly labeled as inference, not fact.
- Do not invent contacts, technologies, budgets, or business facts.
- confidence must be a number from 0 to 1.

Lead:
${JSON.stringify(input, null, 2)}`
  ]);

  const text = response.response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }

  const result = parsed as Partial<LeadResearchResult>;
  if (
    !Array.isArray(result.confirmedRequirements) ||
    !Array.isArray(result.inferredOpportunities) ||
    !Array.isArray(result.technicalChallenges) ||
    !Array.isArray(result.recommendedServices) ||
    typeof result.rationale !== 'string' ||
    typeof result.confidence !== 'number' ||
    result.confidence < 0 ||
    result.confidence > 1
  ) {
    throw new Error('Gemini returned an invalid lead research shape');
  }
  return result as LeadResearchResult;
}
