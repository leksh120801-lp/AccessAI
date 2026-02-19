
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}


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


document.getElementById("focusBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      if (window.focusModeActive) {
        document.removeEventListener("mousemove", window.focusMoveHandler);
        window.focusOverlayTop.remove();
        window.focusOverlayBottom.remove();
        window.focusModeActive = false;
        return;
      }

      const overlayTop = document.createElement("div");
      const overlayBottom = document.createElement("div");

      [overlayTop, overlayBottom].forEach(overlay => {
        overlay.style.position = "fixed";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.background = "rgba(0,0,0,0.4)";
        overlay.style.pointerEvents = "none";
        overlay.style.zIndex = "999998";
        document.body.appendChild(overlay);
      });

      const bandHeight = 60;

      const moveHandler = (e) => {
        const y = e.clientY;

        overlayTop.style.top = "0";
        overlayTop.style.height = (y - bandHeight / 2) + "px";

        overlayBottom.style.top = (y + bandHeight / 2) + "px";
        overlayBottom.style.height =
          (window.innerHeight - (y + bandHeight / 2)) + "px";
      };

      document.addEventListener("mousemove", moveHandler);

      window.focusOverlayTop = overlayTop;
      window.focusOverlayBottom = overlayBottom;
      window.focusMoveHandler = moveHandler;
      window.focusModeActive = true;
    }
  });
});


document.getElementById("summaryBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: () => {
        const paragraphs = Array.from(document.querySelectorAll("p"))
          .slice(0, 3)
          .map(p => p.innerText)
          .join("\n\n");
        return paragraphs;
      }
    },
    (results) => {
      document.getElementById("summaryOutput").innerText =
        results[0]?.result || "No text found.";
    }
  );
});

document.getElementById("darkModeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});


document.getElementById("resetBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      document.body.style = "";
      document.querySelectorAll("#reading-scanner").forEach(e => e.remove());
      if (window.focusModeActive) {
        document.removeEventListener("mousemove", window.focusMoveHandler);
        window.focusOverlayTop?.remove();
        window.focusOverlayBottom?.remove();
        window.focusModeActive = false;
      }
    }
  });


  document.getElementById("fontSlider").value = 16;
  document.getElementById("colorOverlay").value = "";
  document.getElementById("summaryOutput").innerText = "";
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
