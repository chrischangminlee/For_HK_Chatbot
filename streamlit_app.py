import os
import json
from typing import Dict, Any

import streamlit as st
import google.generativeai as genai


st.set_page_config(page_title="Context-Only Chatbot (Validated)", page_icon="🤖", layout="centered")


def ensure_gemini_configured() -> None:
    """Configure Gemini SDK; check for API key in env vars.

    Priority: `VITE_GEMINI_API_KEY` → `GEMINI_API_KEY` → `GOOGLE_API_KEY`.
    """
    api_key = (
        os.getenv("VITE_GEMINI_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
    )
    if not api_key:
        st.error("VITE_GEMINI_API_KEY is not set (no fallbacks found).")
        st.info(
            "Set locally: export VITE_GEMINI_API_KEY=your_key (or GEMINI_API_KEY/GOOGLE_API_KEY).\n"
            "On Vercel: add VITE_GEMINI_API_KEY in Project Settings → Environment Variables."
        )
        st.stop()
    genai.configure(api_key=api_key)


def build_context_system_prompt(context: str) -> str:
    return (
        "You are Responder. Answer ONLY using the Provided Context.\n"
        "- If the answer is not fully supported by the context, reply exactly: \"I don't know based on the provided context.\"\n"
        "- Be concise and factual.\n"
        "\nProvided Context:\n" + context.strip()
    )


def build_validator_system_prompt(context: str) -> str:
    return (
        "You are Validator. You must verify that the assistant's draft answer\n"
        "is FULLY supported by the Provided Context. If any part is unsupported\n"
        "or speculative, produce a corrected answer that ONLY uses the context.\n"
        "If a correct answer cannot be formed, set the final answer to\n"
        "\"I don't know based on the provided context.\"\n"
        "\nOutput strict JSON with fields: {verdict: 'approve'|'revise', final_answer: string, reasons: string[]}.\n"
        "Do not include any text outside JSON.\n"
        "\nProvided Context:\n" + context.strip()
    )


def call_responder(model_name: str, temperature: float, context: str, user_question: str) -> str:
    system_prompt = build_context_system_prompt(context)
    model = genai.GenerativeModel(model_name=model_name, system_instruction=system_prompt)
    response = model.generate_content(
        user_question,
        generation_config=genai.types.GenerationConfig(temperature=temperature),
    )
    return (response.text or "").strip()


def call_validator(
    model_name: str,
    temperature: float,
    context: str,
    user_question: str,
    draft_answer: str,
) -> Dict[str, Any]:
    system_prompt = build_validator_system_prompt(context)
    payload = f"Question:\n{user_question.strip()}\n\nDraft Answer:\n{draft_answer.strip()}"
    model = genai.GenerativeModel(model_name=model_name, system_instruction=system_prompt)
    response = model.generate_content(
        payload,
        generation_config=genai.types.GenerationConfig(
            temperature=min(temperature, 0.3),
            response_mime_type="application/json",
        ),
    )
    content = (response.text or "").strip()
    try:
        data = json.loads(content)
        verdict = (data.get("verdict") or "").lower()
        final_answer = data.get("final_answer") or ""
        reasons = data.get("reasons") or []
        if verdict not in {"approve", "revise"}:
            verdict = "revise"
        return {"verdict": verdict, "final_answer": final_answer, "reasons": reasons, "raw": content}
    except Exception:
        return {
            "verdict": "revise",
            "final_answer": "I don't know based on the provided context.",
            "reasons": ["Validator returned non-JSON or invalid JSON."],
            "raw": content,
        }


def init_state():
    if "messages" not in st.session_state:
        st.session_state.messages = []  # {role: 'user'|'assistant', content: str}
    if "context" not in st.session_state:
        st.session_state.context = ""
    if "show_debug" not in st.session_state:
        st.session_state.show_debug = False


def main():
    init_state()

    st.title("🤖 Context-Only Chatbot (Validated)")
    st.caption("Two-step: Respond → Validate against provided context.")

    with st.sidebar:
        st.subheader("Settings")
        model_name = st.selectbox(
            "Gemini Model",
            options=[
                "gemini-1.5-flash",
                "gemini-1.5-flash-8b",
                "gemini-1.5-pro",
            ],
            index=0,
            help="Pick a capable, cost-effective Gemini model.",
        )
        temperature = st.slider("Temperature", 0.0, 1.0, 0.2, 0.05)

        st.divider()
        st.session_state.context = st.text_area(
            "Context / Knowledge Base",
            value=st.session_state.context,
            height=220,
            placeholder=(
                "Paste the authoritative info here. The assistant will only\n"
                "use this to answer. If not found, it will say it doesn't know."
            ),
        )
        st.session_state.show_debug = st.checkbox("Show validator details", value=False)

    # Display chat history
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])  # history is already validated

    user_input = st.chat_input("Ask a question based on the context…")
    if user_input:
        if not st.session_state.context.strip():
            st.warning("Please provide Context in the sidebar before asking.")
            st.stop()

        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            with st.spinner("Generating draft answer…"):
                ensure_gemini_configured()
                draft = call_responder(
                    model_name=model_name,
                    temperature=temperature,
                    context=st.session_state.context,
                    user_question=user_input,
                )
                if st.session_state.show_debug:
                    st.info("Draft (before validation):\n\n" + draft)

            with st.spinner("Validating against the provided context…"):
                verdict = call_validator(
                    model_name=model_name,
                    temperature=temperature,
                    context=st.session_state.context,
                    user_question=user_input,
                    draft_answer=draft,
                )

            final_answer = draft if verdict["verdict"] == "approve" else verdict["final_answer"]
            st.markdown(final_answer)

            if st.session_state.show_debug:
                with st.expander("Validator details"):
                    st.write(verdict)

        # Only save the validated final answer to history
        st.session_state.messages.append({"role": "assistant", "content": final_answer})


if __name__ == "__main__":
    main()
