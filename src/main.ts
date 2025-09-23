import { groundedAnswer, generateAnswer, validateAnswer, envSummary } from './gemini';
import { KNOWLEDGE } from './knowledge';

function $(id: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function setText(id: string, text: string) {
  $(id).textContent = text;
}

function setHTML(id: string, html: string) {
  $(id).innerHTML = html;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'} as any)[c]);
}

function renderValidation(v: any) {
  const bullets = [
    `<b>is_supported:</b> <code>${String(v.is_supported)}</code>`,
    v.confidence != null ? `<b>confidence:</b> <code>${v.confidence}</code>` : '',
    (Array.isArray(v.issues) && v.issues.length)
      ? `<b>issues:</b>\n- ${v.issues.map((x: string) => escapeHtml(x)).join('\n- ')}`
      : '<b>issues:</b> none'
  ].filter(Boolean).join('\n');
  return bullets;
}

async function onAsk() {
  const askBtn = $('ask') as HTMLButtonElement;
  const draftBox = $('draft');
  const validBox = $('validation');
  const finalBox = $('final');
  const block = ($('block-unsupported') as HTMLInputElement).checked;
  const q = (document.getElementById('question') as HTMLTextAreaElement).value.trim();
  if (!q) {
    alert('Please enter a question.');
    return;
  }
  askBtn.disabled = true;
  setText('draft', '… thinking');
  setText('validation', '');
  setText('final', '');
  try {
    if (block) {
      const { draft, validation, final } = await groundedAnswer(q, KNOWLEDGE);
      setText('draft', draft);
      setText('validation', renderValidation(validation));
      setText('final', final);
    } else {
      const draft = await generateAnswer(q, KNOWLEDGE);
      const validation = await validateAnswer(q, KNOWLEDGE, draft);
      setText('draft', draft);
      setText('validation', renderValidation(validation));
      setText('final', draft);
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    setText('draft', '');
    setText('validation', '');
    setText('final', `Error: ${msg}`);
  } finally {
    askBtn.disabled = false;
  }
}

function init() {
  const { model, keyLoaded } = envSummary();
  setText('model', model);
  setText('key-status', keyLoaded ? 'loaded' : 'missing');
  setText('knowledge-preview', KNOWLEDGE.trim());
  $('ask')!.addEventListener('click', onAsk);
}

init();

