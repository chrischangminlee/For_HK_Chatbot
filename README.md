**Context-Only Chatbot (Validated, Gemini) — Streamlit (Docker)**

- A Streamlit chatbot that answers strictly from a provided context/knowledge base.
- Two-step pipeline: (1) Responder drafts an answer, (2) Validator checks it against the context and approves/revises.
- Pure Python runtime (no Node). Uses Google Gemini via `google-generativeai` in Streamlit.
- Fixed model: `gemini-2.5-flash`. Temperature is fixed internally (no UI control).
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
  
No model/temperature selection is exposed in the UI; the app uses `gemini-2.5-flash` with a conservative temperature.

**Deploying on Vercel (Docker)**
- Vercel supports container deployments; we use the provided `Dockerfile` to run Streamlit.
- Steps:
  1. Push this repo to GitHub (already done).
  2. In Vercel, import the repo and choose “Use Dockerfile”.
  3. Add `VITE_GEMINI_API_KEY` in Project Settings → Environment Variables.
  4. Deploy. The container listens on `$PORT` (default 3000) and serves the Streamlit app.

Note: If you want to deploy the Vite + Vercel Function flow below, do not use Docker (remove or rename the Dockerfile, or keep the Vite setup in a separate repo).

Note: This project intentionally does not use Node.js or Vercel Functions to avoid runtime version conflicts and to keep your key server‑side within Python.

If Vercel’s container option isn’t available, alternatives:
- Streamlit Community Cloud (works great for Streamlit apps).
- Fly.io, Render, or similar PaaS with Docker support.

**Files**
- `streamlit_app.py`: The Streamlit app (two-step respond+validate flow, Gemini SDK).
- `requirements.txt`: Python dependencies (Streamlit + google-generativeai).
- `Dockerfile`: Container for Streamlit runtime (uses `$PORT`).
- `.env.example`: Sample showing required env vars.
- `web/`: Optional Vite + React SPA (not used in Docker deployment).

**Notes**
- The app intentionally does not send prior chat history back to the model—only your question and the current context—to enforce strict context-only answers.
- You can enable "Show validator details" in the sidebar to debug validation decisions.
