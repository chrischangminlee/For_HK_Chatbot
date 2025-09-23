**HK사업관리 레츠고**

- Purpose: Two-call chatbot that (1) drafts an answer strictly from a provided knowledge base and (2) validates that draft is supported, blocking ungrounded answers.
- Stack: Vite (vanilla TS), REST calls to Gemini (`model: gemini-2.5-flash`).

**Quick Start**
- Copy `.env.example` to `.env` and set `VITE_GEMINI_API_KEY`.
- Optionally set `VITE_GEMINI_MODEL` (defaults to `gemini-2.5-flash`).
- Edit `src/knowledge.ts` and paste your knowledge in the `KNOWLEDGE` string.
- Run: `npm install` then `npm run dev`.

**Two-Step Flow**
- Step 1 (Draft): `src/gemini.ts#generateAnswer` uses a system prompt that enforces “only use Knowledge Base; otherwise say I don't know”.
- Step 2 (Validate): `src/gemini.ts#validateAnswer` asks Gemini to return strict JSON verdict (`is_supported`, `issues`, `adjusted_answer`).
- UI shows both; when “Block ungrounded answers” is on, final output uses `adjusted_answer` or a fallback refusal.

**Security Note**
- Client-side API keys are exposed in bundled JS for static hosting (GitHub Pages). If you must ship a key:
  - Add strict HTTP referrer restrictions for your domain in Google Cloud Console.
  - Consider a lightweight server/proxy to keep the key private.

**GitHub Pages Deploy**
- Set the correct base path for assets when building for Pages.
  - Copy `.env.production.example` to `.env.production` and set `VITE_BASE_PATH=/your-repo-name/`.
- Build: `npm run build` (outputs to `dist`).
- Publish with gh-pages: `npm run deploy` (requires `gh-pages` dev dep installed).
  - Alternatively push `dist` to a `gh-pages` branch and enable Pages.

**Config**
- `VITE_GEMINI_API_KEY`: Gemini API key (required).
- `VITE_GEMINI_MODEL`: Model ID (default `gemini-2.5-flash`).
- `VITE_GEMINI_API_HOST`: Default `https://generativelanguage.googleapis.com`.
- `VITE_GEMINI_API_VERSION`: Default `v1beta`.
- `VITE_BASE_PATH`: Vite `base` for GitHub Pages, e.g. `/<repo>/`.

**Where to Edit**
- Knowledge: `src/knowledge.ts`
- UI/logic: `src/main.ts`
- Gemini calls: `src/gemini.ts`

**Troubleshooting**
- 400/401 errors: Confirm `VITE_GEMINI_API_KEY` and model name are valid.
- CORS: Gemini endpoints support CORS; check referrer restrictions on your key.
- Blank validation: Validator returns non-JSON if the model ignores JSON; we request `responseMimeType: application/json` to reduce this.
