**Context-Only Chatbot (Validated, Gemini)**

- A Streamlit chatbot that answers strictly from a provided context/knowledge base.
- Two-step pipeline: (1) Responder drafts an answer, (2) Validator checks it against the context and approves/revises.
- Uses Google Gemini via `google-generativeai` (Python Streamlit) or `@google/generative-ai` (Node API).
- Reads the API key from `VITE_GEMINI_API_KEY` (preferred). Local fallbacks: `GEMINI_API_KEY` or `GOOGLE_API_KEY`.

**Quickstart**
- Python 3.10+ recommended.
- Set env var: `export VITE_GEMINI_API_KEY=your_gemini_key` (or `GEMINI_API_KEY`/`GOOGLE_API_KEY` locally)
- Install deps: `pip install -r requirements.txt`
- Run locally: `streamlit run streamlit_app.py`

**Usage**
- In the sidebar, paste your authoritative Context/Knowledge Base.
- Ask a question in the chat box.
- The model will either answer from the context or say it doesn't know. The Validator ensures the final answer is context-only.

**Two-Step Design**
- Responder: Uses only the provided context to draft an answer. If unsupported, responds with "I don't know based on the provided context.".
- Validator: Verifies the draft is fully supported by the same context. If any part isn’t, it revises to a safe, context-only answer or returns "I don't know based on the provided context.". The validator requests strict JSON using Gemini's `response_mime_type`.

**Configuration**
- Env vars:
  - `VITE_GEMINI_API_KEY`: Your Gemini API key (use this on Vercel).
  - Optional local fallbacks: `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
- Sidebar settings:
  - Gemini model selection (defaults to `gemini-1.5-flash`).
  - Temperature.

**Deploying on Vercel (via Docker)**
- Vercel does not natively host Streamlit servers as serverless functions. Use a Docker deployment (container) if you must deploy to Vercel.
- Steps:
  1. Push this repo to GitHub.
  2. In Vercel, import the repo and select "Use Dockerfile" (or deploy with `vercel --prebuilt`).
  3. Add `VITE_GEMINI_API_KEY` in Project Settings → Environment Variables.
  4. Deploy. Vercel will run the container and expose `$PORT` (we default to `3000`).

Note: If you want to deploy the Vite + Vercel Function flow below, do not use Docker (remove or rename the Dockerfile, or keep the Vite setup in a separate repo).

**Vercel Functions + Vite Frontend (no Docker)**
- API: `api/chat.js` (Node serverless function). Reads `process.env.VITE_GEMINI_API_KEY`.
- Frontend: `web/` (Vite + React) calls `/api/chat` serverless endpoint. No API key in the browser.

Steps:
1) Push repo to GitHub.
2) Remove or rename `Dockerfile` so Vercel uses functions/static build.
3) In Vercel → Project Settings → Environment Variables, add `VITE_GEMINI_API_KEY`.
4) (Optional) Add `vercel.json` with builds for monorepo, or set project root to `web/` and keep `api/` for functions at repo root.
5) Deploy. Vercel builds `api/` with Node and `web/` as a static site.

Local dev options:
- Using Vercel CLI: run `vercel dev` at repo root (serves `/api` and proxies to Vite if configured).
- Using Vite dev server directly: `cd web && npm i && npm run dev` and rely on `vite.config.ts` proxy to `http://localhost:3000/api` (assuming `vercel dev` is running for the API).

If Vercel’s container option isn’t available, alternatives:
- Streamlit Community Cloud (works great for Streamlit apps).
- Fly.io, Render, or similar PaaS with Docker support.

**Files**
- `streamlit_app.py`: The Streamlit app (two-step respond+validate flow, Gemini SDK).
- `requirements.txt`: Python dependencies (Streamlit + google-generativeai).
- `Dockerfile`: Container for Streamlit runtime (uses `$PORT`).
- `.env.example`: Sample showing required env vars.
- `api/chat.js`: Vercel serverless function implementing respond+validate with Gemini.
- `package.json`: Node deps for the serverless function.
- `web/`: Vite + React SPA calling `/api/chat`.

**Notes**
- The app intentionally does not send prior chat history back to the model—only your question and the current context—to enforce strict context-only answers.
- You can enable "Show validator details" in the sidebar to debug validation decisions.
