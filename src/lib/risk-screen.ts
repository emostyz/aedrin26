import { getOpenAIClient } from '@/lib/openai'
import type { RiskLevel } from '@/lib/supabase/types'

export interface AccessRiskInput {
  claimedRole: string
  relationship: string
  message: string | null
  isPreDesignated: boolean
  documentCount: number
  deceasedAccountState: string
}

export interface AccessRiskResult {
  riskLevel: RiskLevel
  reasons: string
}

// NLP screen for representative access requests. Rather than gating every
// request on a human, this flags only suspicious requests for escalation.
// It is deliberately conservative: any failure or ambiguity returns 'elevated'
// so the request escalates to a human rather than auto-approving on doubt.
export async function screenAccessRequest(input: AccessRiskInput): Promise<AccessRiskResult> {
  const SCHEMA = {
    type: 'object',
    properties: {
      risk_level: { type: 'string', enum: ['low', 'elevated', 'high'] },
      reasons: { type: 'string', description: 'One or two sentences, no PII beyond what was given.' },
    },
    required: ['risk_level', 'reasons'],
    additionalProperties: false,
  }

  const prompt = `You screen requests for access to a DECEASED person's most private recorded reflections. Decide a risk level for granting this request.

Signals:
- Claimed role: ${input.claimedRole}
- Stated relationship to the deceased: ${input.relationship}
- Note to reviewer: ${input.message ? JSON.stringify(input.message) : '(none)'}
- Was this requester pre-designated by the deceased while alive? ${input.isPreDesignated ? 'YES' : 'NO'}
- Identity/relationship documents provided: ${input.documentCount}
- Deceased account state: ${input.deceasedAccountState}

Rules:
- "low": pre-designated by the deceased, role/relationship internally consistent, no red flags.
- "elevated": NOT pre-designated, OR thin/missing evidence, OR mild inconsistency, OR vague relationship.
- "high": coercion/impersonation/urgency-pressure language, contradictory claims, attempts to access another living person's data, or any clear red flag.
When uncertain, choose the HIGHER risk. Never output "low" unless the requester is pre-designated.`

  try {
    const openai = getOpenAIClient()
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 200,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'access_risk', strict: true, schema: SCHEMA },
      },
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = res.choices[0]?.message?.content
    if (!raw) return { riskLevel: 'elevated', reasons: 'Screen produced no output; escalated by default.' }
    const parsed = JSON.parse(raw) as { risk_level: RiskLevel; reasons: string }
    // Defense in depth: a non-pre-designated request can never be 'low'.
    const riskLevel: RiskLevel =
      !input.isPreDesignated && parsed.risk_level === 'low' ? 'elevated' : parsed.risk_level
    return { riskLevel, reasons: parsed.reasons }
  } catch (err) {
    console.error('[risk-screen]', err)
    return { riskLevel: 'elevated', reasons: 'Screen failed; escalated by default.' }
  }
}
