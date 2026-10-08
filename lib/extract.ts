/**
 * AI document extraction via Anthropic's vision API.
 * Reads a policy document / illustration / e-app screenshot and pulls
 * structured sale fields. Requires ANTHROPIC_API_KEY env var.
 */

const EXTRACTION_PROMPT = `You are reading an insurance policy document, illustration, or e-application confirmation for a life insurance agent's tracker.

Extract these fields from the document. Return ONLY valid JSON, no markdown, no explanation:

{
  "client_name": "full name of the insured/proposed insured, or null",
  "carrier": "carrier name (e.g. American Amicable, Mutual of Omaha, Transamerica, Gerber, Royal Neighbors), or null",
  "product": "product name (e.g. Senior Choice, Living Promise, Trendsetter LB), or null",
  "face_amount": number (coverage amount in dollars, no commas) or null,
  "monthly_premium": number (monthly premium in dollars) or null,
  "policy_number": "policy/certificate number, or null",
  "effective_date": "YYYY-MM-DD effective/requested date, or null",
  "confidence": "high" | "medium" | "low"
}

Rules:
- If the document shows an annual premium, divide by 12 for monthly_premium.
- face_amount is the death benefit / coverage amount, not cash value.
- Prefer the insured's name over the agent's name for client_name.
- If you can't confidently identify a field, use null rather than guessing.
- confidence reflects overall extraction quality.`;

export interface ExtractedPolicy {
  client_name: string | null;
  carrier: string | null;
  product: string | null;
  face_amount: number | null;
  monthly_premium: number | null;
  policy_number: string | null;
  effective_date: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export async function extractPolicyDocument(
  fileBase64: string,
  mediaType: string
): Promise<ExtractedPolicy | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.warn('[extract] ANTHROPIC_API_KEY not set');
    return null;
  }

  // PDFs go in as document blocks; images as image blocks
  const isPdf = mediaType === 'application/pdf';
  const content: object = isPdf
    ? {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: fileBase64 },
      };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [content, { type: 'text', text: EXTRACTION_PROMPT }],
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error('[extract] Anthropic error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    // Strip markdown fences if the model added them
    const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(json) as ExtractedPolicy;
    return parsed;
  } catch (err) {
    console.error('[extract] failed:', err);
    return null;
  }
}
