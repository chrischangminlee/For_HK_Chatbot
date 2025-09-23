// Vercel Node Serverless Function: /api/chat
// Two-step pipeline (Respond -> Validate) using Google Gemini.
// Reads API key from process.env.VITE_GEMINI_API_KEY (preferred), or GEMINI_API_KEY/GOOGLE_API_KEY for local.

const { GoogleGenerativeAI } = require("@google/generative-ai");

const buildResponderSystem = (context) => {
  return (
    "You are Responder. Answer ONLY using the Provided Context.\n" +
    "- If the answer is not fully supported by the context, reply exactly: \"I don't know based on the provided context.\"\n" +
    "- Be concise and factual.\n\n" +
    "Provided Context:\n" + (context || "").trim()
  );
};

const buildValidatorSystem = (context) => {
  return (
    "You are Validator. You must verify that the assistant's draft answer\n" +
    "is FULLY supported by the Provided Context. If any part is unsupported\n" +
    "or speculative, produce a corrected answer that ONLY uses the context.\n" +
    "If a correct answer cannot be formed, set the final answer to\n" +
    '"I don\'t know based on the provided context."\n' +
    "\nOutput strict JSON with fields: {verdict: 'approve'|'revise', final_answer: string, reasons: string[]}.\n" +
    "Do not include any text outside JSON.\n\n" +
    "Provided Context:\n" + (context || "").trim()
  );
};

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  // Basic CORS (dev convenience)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  const apiKey =
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  if (!apiKey) return send(res, 500, { error: "Missing VITE_GEMINI_API_KEY" });

  let payload;
  try {
    payload = await readJson(req);
  } catch (e) {
    return send(res, 400, { error: "Invalid JSON" });
  }

  const question = (payload.question || "").trim();
  const context = (payload.context || "").trim();
  const modelName = payload.model || "gemini-1.5-flash";
  const temperature = typeof payload.temperature === "number" ? payload.temperature : 0.2;
  if (!question) return send(res, 400, { error: "Missing question" });
  if (!context) return send(res, 400, { error: "Missing context" });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Step 1: Responder
    const responderSystem = buildResponderSystem(context);
    const responder = genAI.getGenerativeModel({ model: modelName, systemInstruction: responderSystem });
    const draftResp = await responder.generateContent({
      contents: [{ role: "user", parts: [{ text: question }]}],
      generationConfig: { temperature }
    });
    const draft = (draftResp.response && draftResp.response.text()) || "";

    // Step 2: Validator (request JSON output)
    const validatorSystem = buildValidatorSystem(context);
    const validator = genAI.getGenerativeModel({ model: modelName, systemInstruction: validatorSystem });
    const payloadText = `Question:\n${question}\n\nDraft Answer:\n${draft}`;
    const validationResp = await validator.generateContent({
      contents: [{ role: "user", parts: [{ text: payloadText }]}],
      generationConfig: { temperature: Math.min(temperature, 0.3), responseMimeType: "application/json" }
    });
    const raw = (validationResp.response && validationResp.response.text()) || "";

    let verdict = "revise";
    let finalAnswer = "I don't know based on the provided context.";
    let reasons = ["Validator returned non-JSON or invalid JSON."];
    try {
      const data = JSON.parse(raw || "{}");
      if (data && typeof data === "object") {
        verdict = (data.verdict || "revise").toLowerCase();
        if (verdict !== "approve" && verdict !== "revise") verdict = "revise";
        finalAnswer = data.final_answer || finalAnswer;
        reasons = Array.isArray(data.reasons) ? data.reasons : reasons;
      }
    } catch (_) {}

    const final = verdict === "approve" ? draft : finalAnswer;
    return send(res, 200, { verdict, finalAnswer: final, reasons, draft, raw });
  } catch (err) {
    console.error("/api/chat error", err);
    return send(res, 500, { error: "Server error" });
  }
};
