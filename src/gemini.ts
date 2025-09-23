import type { GenerateOptions, ValidatorResult } from './types';

const DEFAULT_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string) || 'gemini-2.5-flash';
const API_HOST = (import.meta.env.VITE_GEMINI_API_HOST as string) || 'https://generativelanguage.googleapis.com';
const API_VERSION = (import.meta.env.VITE_GEMINI_API_VERSION as string) || 'v1beta';

function getApiKey(override?: string) {
  return (override || (import.meta.env.VITE_GEMINI_API_KEY as string) || '').trim();
}

function endpoint(model: string, apiKey: string) {
  const base = `${API_HOST.replace(/\/$/, '')}/${API_VERSION}`;
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  return url;
}

function buildSystemPrompt(knowledge: string) {
  return [
    'You are a strict, concise assistant.',
    'Answer the user question using ONLY the facts in the Knowledge Base below.',
    'If the answer is not fully supported, reply exactly:',
    '"I don\'t know based on the provided information."',
    '',
    'Knowledge Base:',
    '---',
    knowledge.trim(),
    '---'
  ].join('\n');
}

async function postJSON(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

function extractText(resp: any): string {
  try {
    const cand = resp.candidates?.[0];
    const parts = cand?.content?.parts || [];
    const textParts = parts.map((p: any) => p?.text).filter(Boolean);
    return String(textParts.join('\n')).trim();
  } catch {
    return '';
  }
}

export async function generateAnswer(
  question: string,
  knowledge: string,
  opts: GenerateOptions = {}
): Promise<string> {
  const apiKey = getApiKey(opts.apiKey);
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY. Set it in your env.');
  const model = (opts.model || DEFAULT_MODEL).trim();
  const url = endpoint(model, apiKey);

  const systemInstruction = { role: 'system', parts: [{ text: buildSystemPrompt(knowledge) }] };
  const body = {
    systemInstruction,
    contents: [
      { role: 'user', parts: [{ text: `Question: ${question}` }] }
    ],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 512
    }
  } as const;

  const resp = await postJSON(url, body);
  return extractText(resp);
}

export async function validateAnswer(
  question: string,
  knowledge: string,
  draftAnswer: string,
  opts: GenerateOptions = {}
): Promise<ValidatorResult> {
  const apiKey = getApiKey(opts.apiKey);
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY. Set it in your env.');
  const model = (opts.model || DEFAULT_MODEL).trim();
  const url = endpoint(model, apiKey);

  const instruction = [
    'You are a strict validator that checks whether the DRAFT ANSWER is fully grounded in the Knowledge Base.',
    'Rules:',
    '- Only accept statements present in the Knowledge Base.',
    '- If any part is unsupported, set is_supported=false and list issues.',
    '- If possible, provide adjusted_answer that is fully grounded.',
    '',
    'Return ONLY a compact JSON object with keys:',
    '{ "is_supported": boolean, "issues": string[], "adjusted_answer": string|null, "confidence": number|null }',
  ].join('\n');

  const systemInstruction = { role: 'system', parts: [{ text: instruction + '\n\nKnowledge Base:\n---\n' + knowledge.trim() + '\n---' }] };

  const body = {
    systemInstruction,
    contents: [
      { role: 'user', parts: [{ text: [
        `Question: ${question}`,
        '',
        'Draft Answer:',
        draftAnswer
      ].join('\n') }] }
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: 'application/json'
    }
  } as const;

  const resp = await postJSON(url, body);
  const text = extractText(resp);
  try {
    const parsed = JSON.parse(text) as ValidatorResult;
    return {
      is_supported: Boolean(parsed.is_supported),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      adjusted_answer: typeof parsed.adjusted_answer === 'string' ? parsed.adjusted_answer : null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null
    };
  } catch (e) {
    return { is_supported: false, issues: ['Validator returned non-JSON or invalid JSON.'], adjusted_answer: null, confidence: null };
  }
}

export async function groundedAnswer(
  question: string,
  knowledge: string,
  opts: GenerateOptions = {}
): Promise<{ draft: string; validation: ValidatorResult; final: string }>{
  const draft = await generateAnswer(question, knowledge, opts);
  const validation = await validateAnswer(question, knowledge, draft, opts);
  let final = draft;
  if (!validation.is_supported) {
    final = validation.adjusted_answer || "I don't know based on the provided information.";
  }
  return { draft, validation, final };
}

export function envSummary() {
  const key = getApiKey();
  return {
    model: DEFAULT_MODEL,
    keyLoaded: key.length > 0
  };
}

