import type { GenerateOptions } from './types';

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
    '너는 매우 엄격한 어시스턴트다.',
    '아래 Knowledge Base에 포함된 사실만 사용해서 간결하게 답하라.',
    '직접적이지 않더라고 관련된 정보가 있으면, 해당 정보도 포함하라',
    '강조를 위해 **를 사용하지 마라.',
    '아래 정보에 근거가 없으면 정확히 다음 문장으로만 답하라:',
    '"제공된 정보에 기반해선 알 수 없습니다."',
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

export function envSummary() {
  const key = getApiKey();
  return {
    model: DEFAULT_MODEL,
    keyLoaded: key.length > 0
  };
}
