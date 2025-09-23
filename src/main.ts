import { generateAnswer, envSummary } from './gemini';
import { KNOWLEDGE } from './knowledge';

function $(id: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function setText(id: string, text: string) {
  $(id).textContent = text;
}

async function onAsk() {
  const askBtn = $('ask') as HTMLButtonElement;
  const finalBox = $('final');
  const q = (document.getElementById('question') as HTMLTextAreaElement).value.trim();
  if (!q) {
    alert('Please enter a question.');
    return;
  }
  askBtn.disabled = true;
  setText('final', '… thinking');
  try {
    const answer = await generateAnswer(q, KNOWLEDGE);
    setText('final', answer);
  } catch (e: any) {
    const msg = e?.message || String(e);
    setText('final', `Error: ${msg}`);
  } finally {
    askBtn.disabled = false;
  }
}

function init() {
  const { model } = envSummary();
  setText('model', model);
  $('ask')!.addEventListener('click', onAsk);
  const textarea = document.getElementById('question') as HTMLTextAreaElement;
  textarea.addEventListener('keydown', (e: KeyboardEvent) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey
    ) {
      e.preventDefault();
      onAsk();
    }
  });
}

init();
