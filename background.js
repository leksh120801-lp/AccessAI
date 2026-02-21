// background.js

importScripts("config.js");

// ================= GEMINI CONFIG =================
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
// ================= CALL GEMINI =================
async function callGemini(prompt, retryCount = 0) {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: prompt }] }
        ]
      })
    });

    // Retry if rate limited
    if (response.status === 429 && retryCount < 2) {
      await new Promise(res => setTimeout(res, 2000));
      return callGemini(prompt, retryCount + 1);
    }

    if (!response.ok) {
      const errorJson = await response.json();
      return `Error ${response.status}: ${
        errorJson.error?.message || "Something went wrong"
      }`;
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      return "AI could not generate summary.";
    }

    return data.candidates[0].content.parts[0].text;

  } catch (error) {
    return "Connection error. Check internet.";
  }
}


// ================= SUMMARY FUNCTION =================
async function handleSummaryRequest(text) {
  const prompt = `
Provide a short, clear, dyslexia-friendly summary in 5 simple bullet points.

Text:
${text}
`;

  const result = await callGemini(prompt);
  return { result };
}


// ================= MESSAGE LISTENER =================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "summarize") {
    handleSummaryRequest(request.text).then(sendResponse);
    return true; // keep channel open
  }

  if (request.action === "checkGrammar") {
    const grammarPrompt = `
Fix spelling and grammar.
Return ONLY the corrected text.

Text:
"${request.text}"
`;

    callGemini(grammarPrompt)
      .then(result => sendResponse({ result: result.trim() }))
      .catch(err => sendResponse({ result: "Error: " + err.message }));

    return true;
  }
});