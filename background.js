// Copy your callGemini function here from popup.js
const GEMINI_API_KEY = "YOU_API_KEY_HERE"; // Replace with your actual API key
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// background.js
async function callGemini(prompt, retryCount = 0) {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (response.status === 429 && retryCount < 2) {
       console.log("Rate limited. Waiting 2 seconds to retry...");
       await new Promise(res => setTimeout(res, 2000)); // Wait 2 seconds
       return callGemini(prompt, retryCount + 1); // Try again
    }

    if (!response.ok) {
      const errorJson = await response.json();
      return `Error ${response.status}: ${errorJson.error?.message || "Something went wrong"}`;
    }

   // Inside your callGemini function
const data = await response.json();

if (!data.candidates || data.candidates.length === 0) {
  return "The AI couldn't summarize this page due to safety settings or empty content.";
}

return data.candidates[0].content.parts[0].text;

  } catch (error) {
    return "Connection Error. Check your internet.";
  }
}

async function handleSummaryRequest(text) {
  const aiPrompt = `Please provide a simple, dyslexia-friendly summary: \n\n${text}`;
  try {
    const result = await callGemini(aiPrompt);
    return { result: result };
  } catch (error) {
    return { result: "AI Error: " + error.message };
  }
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "summarize") {
    handleSummaryRequest(request.text).then(response => {
      sendResponse(response);
    });
    return true; // Keep channel open for summary
  }


  if (request.action === "checkGrammar") {
    const grammarPrompt = `
    Task: Fix spelling and grammar.
    Constraint: Return ONLY the corrected text. Do not include greetings, explanations, or tips.
    
    Text to fix: "${request.text}"`;

    callGemini(grammarPrompt).then(result => {

    sendResponse({ result: result.trim() });
    
    }).catch(err => {
      sendResponse({ result: "Error: " + err.message });
    });
    
    return true; // Keep channel open for grammar
  }
});