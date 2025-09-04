(function () {
  // Prevent multiple injections
  if (window.aiHelperLoaded) {
    return;
  }
  window.aiHelperLoaded = true;

  // ================= ENABLE DISABLED FEATURES ==================
  function enableDisabledFeatures() {
    // 1. Enable text selection
    function enableTextSelection() {
      // Remove CSS rules that disable text selection
      const style = document.createElement("style");
      style.innerHTML = `
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
      }
      
      /* Override common selection disabling patterns */
      *:not(input):not(textarea) {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
      }
    `;
      document.head.appendChild(style);

      // Remove onselectstart and ondragstart event handlers
      document.onselectstart = null;
      document.ondragstart = null;

      // Override body and document selection restrictions
      if (document.body) {
        document.body.onselectstart = null;
        document.body.ondragstart = null;
        document.body.style.webkitUserSelect = "text";
        document.body.style.userSelect = "text";
      }

      // Remove event listeners that prevent selection
      const removeSelectionBlockers = () => {
        document.removeEventListener("selectstart", preventEvent, true);
        document.removeEventListener("dragstart", preventEvent, true);
        document.removeEventListener("mousedown", preventEvent, true);
      };

      function preventEvent(e) {
        e.stopPropagation();
        return true;
      }

      removeSelectionBlockers();
    }

    // 2. Enable right-click context menu
    function enableRightClick() {
      // Remove oncontextmenu restrictions
      document.oncontextmenu = null;
      if (document.body) {
        document.body.oncontextmenu = null;
      }

      // Remove context menu event listeners
      document.removeEventListener("contextmenu", preventEvent, true);
      document.removeEventListener("mouseup", preventEvent, true);
      document.removeEventListener("mousedown", preventEvent, true);
      document.removeEventListener("click", preventEvent, true);

      function preventEvent(e) {
        if (e.button === 2) {
          // Right click
          e.stopPropagation();
          return true;
        }
      }

      // Override common right-click blocking patterns
      const style = document.createElement("style");
      style.innerHTML = `
      * {
        pointer-events: auto !important;
      }
    `;
      document.head.appendChild(style);
    }

    // 3. Enable copy/paste functionality
    function enableCopyPaste() {
      // Remove keyboard event restrictions
      document.onkeydown = null;
      document.onkeyup = null;
      document.onkeypress = null;

      if (document.body) {
        document.body.onkeydown = null;
        document.body.onkeyup = null;
        document.body.onkeypress = null;
      }

      // Remove copy/paste blocking event listeners
      document.removeEventListener("keydown", blockCopyPaste, true);
      document.removeEventListener("keyup", blockCopyPaste, true);
      document.removeEventListener("copy", preventEvent, true);
      document.removeEventListener("paste", preventEvent, true);
      document.removeEventListener("cut", preventEvent, true);

      function blockCopyPaste(e) {
        // Allow Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, etc.
        if (e.ctrlKey || e.metaKey) {
          e.stopPropagation();
          return true;
        }
      }

      function preventEvent(e) {
        e.stopPropagation();
        return true;
      }

      // Enable clipboard access
      const style = document.createElement("style");
      style.innerHTML = `
      input, textarea {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
    `;
      document.head.appendChild(style);
    }

    // Apply all fixes
    enableTextSelection();
    enableRightClick();
    enableCopyPaste();
  }

  // Apply fixes immediately and after DOM load
  enableDisabledFeatures();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enableDisabledFeatures);
  } else {
    // DOM is already loaded
    setTimeout(enableDisabledFeatures, 100);
  }

  // Re-apply fixes if page dynamically changes
  const observer = new MutationObserver(() => {
    enableDisabledFeatures();
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });

  // ================= CONFIG ==================
  const api_key = "YOUR_API_KEY";
  const model = "llama-3.1-8b-instant";

  const DEFAULT_INSTRUCTION = `
You are an expert in aptitude, coding, and technical Q&A. For any question I provide, first identify the category (aptitude, coding, or technical). Do not mention the category. No preamble. Then answer it accurately and clearly, providing:
For aptitude: Firstly write the correct option number and its correct answer, then a step-by-step solution with the final answer.
For coding: a commentless Python solution with explanation and sample input/output.
For technical Q&A: a concise, short correct answer in very simple human language. Do not use punctuation marks unnecessarily, answer as if speaking and use very simple English.
`;

  // Track conversation context
  let conversationHistory = [];

  function convertMarkdown(text) {
    text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    text = text.replace(/\\\[(.*?)\\\]/g, '<div class="math-block">$1</div>');
    text = text.replace(
      /\\\((.*?)\\\)/g,
      '<span class="math-inline">$1</span>'
    );
    text = text.replace(/```([^`]+)```/g, "<pre><code>$1</code></pre>");
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/^###### (.*$)/gm, "<h6>$1</h6>");
    text = text.replace(/^##### (.*$)/gm, "<h5>$1</h5>");
    text = text.replace(/^#### (.*$)/gm, "<h4>$1</h4>");
    text = text.replace(/^### (.*$)/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.*$)/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.*$)/gm, "<h1>$1</h1>");
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    text = text.replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");
    text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    text = text.replace(/_([^_]+)_/g, "<em>$1</em>");
    text = text.replace(
      /!\[([^\]]*)\]\(([^\)]+)\)/g,
      '<img src="$2" alt="$1">'
    );
    text = text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');
    text = text.replace(
      /(?<!href=")(https?:\/\/[^\s]+)/g,
      '<a href="$1">$1</a>'
    );
    text = text.replace(/^\> (.+)$/gm, "<blockquote>$1</blockquote>");
    text = text.replace(/^\s*(\*\*\*|---)\s*$/gm, "<hr>");
    text = text.replace(
      /^\- \[ \] (.+)$/gm,
      '<li><input type="checkbox" disabled> $1</li>'
    );
    text = text.replace(
      /^\- \[x\] (.+)$/gm,
      '<li><input type="checkbox" checked disabled> $1</li>'
    );
    text = text.replace(/^\|(.+)\|\s*$/gm, function (match, p1) {
      const cells = p1
        .split("|")
        .map((c) => `<td>${c.trim()}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    });
    text = text.replace(/(<tr>.*<\/tr>)/gs, "<table>$1</table>");
    text = text.replace(/^\* (.+)$/gm, "<li>$1</li>");
    text = text.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
    text = text.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");
    text = text.replace(/(<ol>.*<\/ol>)/gs, "<ol>$1</ol>");
    text = text.replace(
      /\n\n(?!<div|<span|<h\d|<ul|<ol|<li|<pre|<blockquote|<img|<hr|<table)([^<].*)/g,
      "<p>$1</p>"
    );
    text = text.replace(/\n(?!<)(?!$)/g, "<br>");
    return text;
  }

  let isProcessing = false;
  let lastInjectedDiv = null;
  let chatContainer = null; // Track the chat container globally

  // ============ AI RESPONSE HIDE/SHOW FUNCTIONALITY ============
  function toggleAIResponse() {
    if (!lastInjectedDiv) return;

    if (lastInjectedDiv.style.display === "none") {
      lastInjectedDiv.style.display = "block";
    } else {
      lastInjectedDiv.style.display = "none";
    }
  }

  // Keyboard shortcut listener for Alt+H
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      toggleAIResponse();
    }
  });

  // ============ Handle Message from Context Menu ============
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.openChat) {
      openChatInterface(); // directly open chat window
      return;
    }

    if (msg.toggleChat) {
      toggleChatInterface(); // toggle chat window visibility
      return;
    }

    if (!msg.text || isProcessing) return;

    isProcessing = true;
    const userText = msg.text;

    if (lastInjectedDiv) {
      lastInjectedDiv.remove();
    }

    const prompt = DEFAULT_INSTRUCTION + "\n\nUser input:\n" + userText;

    // Add first user message to conversation history
    conversationHistory = [{ role: "user", content: userText }];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: DEFAULT_INSTRUCTION },
          ...conversationHistory,
        ],
      }),
    });

    try {
      const result = await res.json();
      const answer = result.choices?.[0]?.message?.content || "⚠️ No response";

      conversationHistory.push({ role: "assistant", content: answer });

      // ====== Create UI Container ======
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        const wrapper = document.createElement("div");
        wrapper.style.cssText = `display: block; width: 100%;`;

        const container = document.createElement("div");
        container.style.cssText = `
        display: flex;
        min-width: 500px;
        max-height: 400px;
        flex-direction: column;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        font-family: sans-serif;
        font-size: 14px;
        line-height: 1.5;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        position: relative;
        margin: 0 auto;
        user-select: text;
      `;

        const closeButton = document.createElement("button");
        closeButton.innerHTML = "X";
        closeButton.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        font-size: 20px;
        line-height: normal;
        cursor: pointer;
        color: #666;
      `;
        closeButton.addEventListener("click", () => {
          // Hide the wrapper instead of the container to be consistent with Alt+H
          wrapper.style.display = "none";
        });

        const responseDiv = document.createElement("div");
        responseDiv.style.cssText = `
        color: #2c3e50;
        overflow: auto;
        user-select: text;
      `;
        responseDiv.innerHTML = convertMarkdown(answer);

        responseDiv.querySelectorAll("pre code").forEach((block) => {
          block.style.cssText = `
          display: block;
          padding: 12px;
          background: inherit;
          border-radius: 4px;
          border: 1px solid #eee;
          white-space: pre-wrap;
          word-break: break-word;
        `;
        });

        const copyButton = document.createElement("button");
        copyButton.textContent = "Copy Response";
        copyButton.style.cssText = `
        margin-top: 12px;
        padding: 6px 12px;
        background: #f0f0f0;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      `;
        copyButton.addEventListener("click", () => {
          navigator.clipboard.writeText(answer);
          copyButton.textContent = "Copied!";
          setTimeout(() => (copyButton.textContent = "Copy Response"), 2000);
        });

        const continueButton = document.createElement("button");
        continueButton.textContent = "Continue to Chat";
        continueButton.style.cssText = `
        margin-top: 8px;
        padding: 6px 12px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      `;
        continueButton.addEventListener("click", openChatInterface);

        container.appendChild(closeButton);
        container.appendChild(responseDiv);
        container.appendChild(copyButton);
        container.appendChild(continueButton);

        wrapper.appendChild(container);
        range.insertNode(wrapper);
        lastInjectedDiv = wrapper;

        setTimeout(() => {
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error processing AI response:", error);
    } finally {
      isProcessing = false;
    }
  });

  function makeDraggable(element, handle) {
    let offsetX = 0,
      offsetY = 0,
      isDragging = false;

    handle.style.cursor = "move";

    handle.addEventListener("mousedown", (e) => {
      isDragging = true;
      offsetX = e.clientX - element.getBoundingClientRect().left;
      offsetY = e.clientY - element.getBoundingClientRect().top;
      document.body.style.userSelect = "none"; // prevent text selection
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;

      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Get element dimensions
      const elementRect = element.getBoundingClientRect();
      const elementWidth = elementRect.width;
      const elementHeight = elementRect.height;

      // Constrain within viewport boundaries
      // Left boundary
      if (x < 0) {
        x = 0;
      }
      // Right boundary (ensure at least 50px of the element is visible)
      if (x > viewportWidth - Math.max(50, elementWidth)) {
        x = viewportWidth - Math.max(50, elementWidth);
      }
      // Top boundary
      if (y < 0) {
        y = 0;
      }
      // Bottom boundary (ensure at least 50px of the element is visible)
      if (y > viewportHeight - Math.max(50, elementHeight)) {
        y = viewportHeight - Math.max(50, elementHeight);
      }

      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.style.position = "fixed"; // ensure it's floating
      element.style.zIndex = "9999";
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      document.body.style.userSelect = "auto";
    });
  }

  // ================= CHAT INTERFACE =================
  function openChatInterface() {
    // If chat is already open, just show it
    if (chatContainer && document.body.contains(chatContainer)) {
      chatContainer.style.display = "flex";
      return;
    }

    chatContainer = document.createElement("div");
    chatContainer.style.cssText = `
  position: fixed;
  top: 100px;
  right: 50px;
  width: 400px;
  height: 600px;
  background: inherit;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  z-index: 9999;
`;

    const chatHeader = document.createElement("div");
    chatHeader.style.cssText = `
    padding: 10px;
    font-weight: bold;
    border-bottom: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

    const closeChatButton = document.createElement("button");
    closeChatButton.textContent = "×";
    closeChatButton.style.cssText = `
    font-size: 20px;
    border: none;
    background: none;
    cursor: pointer;
    color: #666;
  `;
    closeChatButton.addEventListener("click", () => {
      chatContainer.style.display = "none"; // Hide instead of removing
    });
    chatHeader.appendChild(closeChatButton);
    makeDraggable(chatContainer, chatHeader);

    const chatMessages = document.createElement("div");
    chatMessages.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

    conversationHistory.forEach((msg) => {
      const msgDiv = document.createElement("div");
      msgDiv.style.padding = "8px 12px";
      msgDiv.style.borderRadius = "8px";
      msgDiv.style.maxWidth = "80%";
      msgDiv.style.wordWrap = "break-word";
      msgDiv.style.userSelect = "text";

      if (msg.role === "user") {
        msgDiv.style.background = "#e3f2fd";
        msgDiv.style.alignSelf = "flex-end";
        msgDiv.textContent = msg.content;
      } else {
        msgDiv.style.background = "#f1f1f1";
        msgDiv.style.alignSelf = "flex-start";
        msgDiv.innerHTML = convertMarkdown(msg.content);
      }
      chatMessages.appendChild(msgDiv);
    });

    const chatInputWrapper = document.createElement("div");
    chatInputWrapper.style.cssText = `display: flex; border-top: 1px solid #ddd;`;

    const chatInput = document.createElement("input");
    chatInput.type = "text";
    chatInput.placeholder = "Type your message...";
    chatInput.style.cssText = `flex: 1; padding: 8px; border: none; outline: none; font-size: 14px;`;

    const sendButton = document.createElement("button");
    sendButton.textContent = "Send";
    sendButton.style.cssText = `
    padding: 8px 12px;
    background: #007bff;
    color: white;
    border: none;
    cursor: pointer;
  `;

    async function sendMessage() {
      const userMsg = chatInput.value.trim();
      if (!userMsg) return;

      conversationHistory.push({ role: "user", content: userMsg });

      const userDiv = document.createElement("div");
      userDiv.textContent = userMsg;
      userDiv.style.cssText = `
      background: #e3f2fd;
      align-self: flex-end;
      padding: 8px 12px;
      border-radius: 8px;
      max-width: 80%;
      word-wrap: break-word;
      user-select: text;
    `;
      chatMessages.appendChild(userDiv);
      chatInput.value = "";
      chatMessages.scrollTop = chatMessages.scrollHeight;

      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert assistant. Help the user naturally.",
              },
              ...conversationHistory,
            ],
          }),
        }
      );

      const data = await res.json();
      const aiResponse =
        data.choices?.[0]?.message?.content || "⚠️ No response";

      conversationHistory.push({ role: "assistant", content: aiResponse });

      const aiDiv = document.createElement("div");
      aiDiv.innerHTML = convertMarkdown(aiResponse);
      aiDiv.style.cssText = `
      background: #f1f1f1;
      align-self: flex-start;
      padding: 8px 12px;
      border-radius: 8px;
      max-width: 80%;
      word-wrap: break-word;
      user-select: text;
    `;
      chatMessages.appendChild(aiDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    sendButton.addEventListener("click", sendMessage);
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        sendMessage();
      }
    });

    chatInputWrapper.appendChild(chatInput);
    chatInputWrapper.appendChild(sendButton);

    chatContainer.appendChild(chatHeader);
    chatContainer.appendChild(chatMessages);
    chatContainer.appendChild(chatInputWrapper);

    document.body.appendChild(chatContainer);
  }

  // ================= TOGGLE CHAT INTERFACE =================
  function toggleChatInterface() {
    if (!chatContainer || !document.body.contains(chatContainer)) {
      // If chat doesn't exist, create it
      openChatInterface();
    } else {
      // Toggle visibility
      if (chatContainer.style.display === "none") {
        chatContainer.style.display = "flex";
      } else {
        chatContainer.style.display = "none";
      }
    }
  }
})(); // End IIFE
