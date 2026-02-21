
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Helper function to keep your code clean
async function processGrammar(textToQuery, outputDiv) {
  const grammarPrompt = `Act as a supportive proofreader for someone with dyslexia. 
  1. Correct the spelling and grammar of the following text.
  2. If you find homophone errors (like their/there), explain the difference simply.
  3. Provide the corrected text first, then a very short list of "Friendly Tips" for the mistakes found.
  
  Text to check: "${textToQuery}"`;
  
  const correctedText = await callGemini(grammarPrompt);
  outputDiv.innerText = correctedText;
}

document.getElementById("grammarBtn").addEventListener("click", () => {
  const outputDiv = document.getElementById("grammarOutput");
  // 1. Get the text from your manual input box
  const userInput = document.getElementById("manualTextInput").value;

  // 2. Check if the user actually wrote something
  if (!userInput || userInput.trim() === "") {
    outputDiv.innerText = "Please type something in the box above first!";
    return;
  }

  outputDiv.innerText = "Fixing your spelling...";

  // 3. Send the text to the background script
  chrome.runtime.sendMessage({ 
    action: "checkGrammar", 
    text: userInput.trim() 
  }, (response) => {
    if (chrome.runtime.lastError) {
      outputDiv.innerText = "Error connecting to background script.";
      return;
    }
    
    // 4. Display ONLY the result
    outputDiv.innerText = response.result;
  });
});

document.getElementById("declutterBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // 1. Check if we already applied the declutter styles
      const styleId = "dyslexia-declutter-style";
      const existingStyle = document.getElementById(styleId);

      if (existingStyle) {
        // If it exists, remove it to show the original page again
        existingStyle.remove();
        console.log("Declutter Mode Deactivated");
        return;
      }

      // 2. Define which "noisy" parts of a website we want to hide
      const selectorsToHide = [
        "aside",           // Sidebars
        "footer",          // Usually full of links
        ".sidebar",        // Common class for sidebars
        "#sidebar",        // Common ID for sidebars
        ".ad", ".ads",     // Common ad classes
        ".social-share",   // Floating social media buttons
        "iframe[id*='google_ads']", // Google Ads
        ".newsletter-popup", // Annoying popups
        ".cookie-banner"   // Cookie notices
      ];

      // 3. Create a style tag and inject it into the page
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        ${selectorsToHide.join(", ")} {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `;

      document.head.appendChild(style);
      console.log("Declutter Mode Activated");
    }
  });
});
document.getElementById("fontBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {

      const existing = document.getElementById("dyslexia-font-style");

      if (existing) {
        existing.remove();
        return;
      }

      const fontURL = chrome.runtime.getURL("fonts/OpenDyslexic-Regular.otf");

      const style = document.createElement("style");
      style.id = "dyslexia-font-style";
      style.innerHTML = `
        @font-face {
          font-family: 'OpenDyslexic';
          src: url('${fontURL}');
        }

        * {
          font-family: 'OpenDyslexic' !important;
        }
      `;

      document.head.appendChild(style);
    }
  });
});


document.getElementById("spacingBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {

      const existing = document.getElementById("line-spacing-style");

      if (existing) {
        existing.remove();
        return;
      }

      const style = document.createElement("style");
      style.id = "line-spacing-style";
      style.innerHTML = `
        * {
          line-height: 4.8 !important;
        }
      `;

      document.head.appendChild(style);
    }
  });
});


document.getElementById("fontSlider").addEventListener("input", async (e) => {
  const tab = await getActiveTab();
  const size = e.target.value;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (size) => {
      document.body.style.fontSize = size + "px";
    },
    args: [size]
  });
});


const focusBtn = document.getElementById("focusBtn");

if (focusBtn) {
  focusBtn.addEventListener("click", async () => {
    const tab = await getActiveTab();
    
    // Safety check: get color, default to yellow if dropdown is missing
    const colorPicker = document.getElementById("rulerColor");
    const selectedColor = colorPicker ? colorPicker.value : "rgba(255, 255, 0, 0.4)";

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (rulerColor) => {
        // --- 1. TOGGLE OFF ---
        if (window.focusModeActive) {
          document.removeEventListener("mousemove", window.focusMoveHandler);
          window.focusOverlayTop?.remove();
          window.focusOverlayBottom?.remove();
          window.focusRulerLine?.remove();
          window.focusModeActive = false;
          return;
        }

        // --- 2. CREATE ELEMENTS ---
        const overlayTop = document.createElement("div");
        const overlayBottom = document.createElement("div");
        const rulerLine = document.createElement("div");

        // Style for the dark dimmers
        const dimmerStyle = {
          position: "fixed",
          left: "0",
          width: "100%",
          background: "rgba(0,0,0,0.5)",
          pointerEvents: "none",
          zIndex: "999997"
        };

        Object.assign(overlayTop.style, dimmerStyle);
        Object.assign(overlayBottom.style, dimmerStyle);
        
        // Style for the colored ruler
        Object.assign(rulerLine.style, {
          position: "fixed",
          left: "0",
          width: "100%",
          height: "40px",
          backgroundColor: rulerColor,
          pointerEvents: "none",
          zIndex: "999998",
          borderTop: "1px solid rgba(255,255,255,0.2)",
          borderBottom: "1px solid rgba(255,255,255,0.2)"
        });

        document.body.appendChild(overlayTop);
        document.body.appendChild(overlayBottom);
        document.body.appendChild(rulerLine);

        // --- 3. MOVEMENT LOGIC ---
        window.focusMoveHandler = (e) => {
          const y = e.clientY;
          const halfRuler = 20; // Half of the 40px height

          // Fix: Top dimmer starts at 0 and ends at top of ruler
          overlayTop.style.top = "0";
          overlayTop.style.height = (y - halfRuler) + "px";

          // Fix: Ruler centers on mouse
          rulerLine.style.top = (y - halfRuler) + "px";

          // Fix: Bottom dimmer starts at bottom of ruler and fills screen
          overlayBottom.style.top = (y + halfRuler) + "px";
          overlayBottom.style.height = (window.innerHeight - (y + halfRuler)) + "px";
        };

        document.addEventListener("mousemove", window.focusMoveHandler);
        
        // Save references for cleanup
        window.focusOverlayTop = overlayTop;
        window.focusOverlayBottom = overlayBottom;
        window.focusRulerLine = rulerLine;
        window.focusModeActive = true;
      },
      args: [selectedColor]
    });
  });
}

document.getElementById("summaryBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();
  const outputDiv = document.getElementById("summaryOutput");

  outputDiv.innerText = "Summarizing with Gemini AI...";

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: () => document.body.innerText.slice(0, 3000)
    },
    (results) => {
      const pageText = results?.[0]?.result;

      if (!pageText) {
        outputDiv.innerText = "No readable text found.";
        return;
      }

      chrome.runtime.sendMessage(
        { action: "summarize", text: pageText },
        (response) => {
          if (!response || !response.result) {
            outputDiv.innerText = "AI returned empty response.";
            return;
          }

          outputDiv.innerText = response.result;
        }
      );
    }
  );
});



document.getElementById("darkModeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});
document.getElementById("colorOverlay").addEventListener("change", async (e) => {
  const tab = await getActiveTab();
  const color = e.target.value;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (color) => {

      // Remove existing overlay if present
      const existing = document.getElementById("color-overlay-layer");
      if (existing) {
        existing.remove();
      }

      if (!color) return;

      // Create overlay
      const overlay = document.createElement("div");
      overlay.id = "color-overlay-layer";
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.backgroundColor = color;
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "999997";
      overlay.style.mixBlendMode = "multiply";

      document.body.appendChild(overlay);
    },
    args: [color]
  });
});

document.getElementById("resetBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // 1. Remove Super Focus Mode (Dimmers and Ruler)
      if (window.focusModeActive) {
        document.removeEventListener("mousemove", window.focusMoveHandler);
        window.focusOverlayTop?.remove();
        window.focusOverlayBottom?.remove();
        window.focusRulerLine?.remove();
        window.focusModeActive = false;
      }

      // 2. Remove Declutter Mode
      document.getElementById("dyslexia-declutter-style")?.remove();

      // 3. Remove Dyslexia Font
      document.getElementById("dyslexia-font-style")?.remove();

      // 4. Remove Line & Letter Spacing
      document.getElementById("line-spacing-style")?.remove();
      document.getElementById("letter-spacing-style")?.remove();

      // 5. Remove Color Overlay (if you have the separate one)
      document.getElementById("color-overlay-layer")?.remove();

      // 6. Reset basic body styles
      document.body.style.fontSize = "";
      document.body.style.lineHeight = "";
      document.body.style.letterSpacing = "";
    }
  });

  // 7. Clear the Popup UI itself
  document.getElementById("grammarOutput").innerText = "";
  document.getElementById("summaryOutput").innerText = "";
  document.getElementById("fontSlider").value = 16;
  document.getElementById("rulerColor").value = "rgba(255, 255, 0, 0.4)";
});
document.getElementById("wordFocusBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {

      if (window.wordFocusActive) {
        document.removeEventListener("mouseup", window.wordFocusHandler);
        window.wordFocusActive = false;
        return;
      }

      const handler = (e) => {

        // Remove previous highlight
        document.querySelectorAll(".word-highlight").forEach(el => {
          const parent = el.parentNode;
          parent.replaceChild(document.createTextNode(el.textContent), el);
          parent.normalize();
        });

        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!range) return;

        const node = range.startContainer;
        if (node.nodeType !== 3) return;

        const text = node.textContent;
        const offset = range.startOffset;

        const left = text.slice(0, offset).search(/\S+$/);
        const rightMatch = text.slice(offset).match(/\S+/);

        if (left < 0 || !rightMatch) return;

        const right = offset + rightMatch[0].length;

        const wordRange = document.createRange();
        wordRange.setStart(node, left);
        wordRange.setEnd(node, right);

        const span = document.createElement("span");
        span.className = "word-highlight";
        span.style.backgroundColor = "rgba(255,255,0,0.4)";
        span.style.borderRadius = "3px";

        wordRange.surroundContents(span);
      };

      document.addEventListener("mouseup", handler);
      window.wordFocusHandler = handler;
      window.wordFocusActive = true;
    }
  });
});


document.getElementById("letterSpacingBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {

      const existing = document.getElementById("letter-spacing-style");

      if (existing) {
        existing.remove();
        return;
      }

      const style = document.createElement("style");
      style.id = "letter-spacing-style";
      style.innerHTML = `
        * {
          letter-spacing: 0.12em !important;
        }
      `;

      document.head.appendChild(style);
    }
  });
});
document.getElementById("readAloudBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const text = document.body.innerText;
      const speech = new SpeechSynthesisUtterance(text);
      speech.rate = 0.9;
      window.speechSynthesis.speak(speech);
    }
  });
});
