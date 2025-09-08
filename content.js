(function () {
  // Prevent multiple injections
  if (window.aiHelperLoaded) {
    return;
  }
  window.aiHelperLoaded = true;

  // Initialize bypass restrictions immediately
  bypassWebsiteRestrictions();

  const config = {
    api_key: "YOUR_GROQ_API_KEY_HERE",
    model: "llama-3.1-8b-instant",
    api_endpoint: "https://api.groq.com/openai/v1/chat/completions",
    instructions: {
      default:
        "You are an intelligent assistant. The user will give you a piece of text selected from a webpage, without extra instructions. Your job: 1. Understand what the text likely represents (e.g., a question, an article snippet, a code block, a definition, or a statement). 2. Provide the most helpful and relevant response in a natural, clear way. Examples: - If it's a question, answer it accurately and concisely. - If it's a paragraph or article, provide a short summary or explanation. - If it's code, explain what it does and/or improve it if needed. - If it's a problem to solve (like math or logic), give the correct solution with clear steps. - If it's unclear, give a helpful interpretation or context. 3. Keep the tone helpful and natural. Do not include unnecessary words or preambles. 4. If needed, provide short step-by-step reasoning or examples, but stay concise.",
    },
  };

  // Check if API key is defined
  if (!config.api_key || config.api_key === "YOUR_GROQ_API_KEY_HERE") {
    console.error(
      "AI Helper: API key not configured. Please set your Groq API key in the config."
    );
    return;
  }

  // Track conversation context
  let conversationHistory = [];

  let isProcessing = false;
  let lastInjectedDiv = null;
  let chatContainer = null; // Track the chat container globally

  // Keyboard shortcut listener for Alt+C and Alt+G
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      toggleAIResponse();
    }

    if (e.altKey && e.key.toLowerCase() === "g") {
      e.preventDefault();
      // Generate AI response for selected text
      const selectedText = window.getSelection().toString().trim();
      if (selectedText) {
        processSelectedText(selectedText);
      }
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

    if (msg.generateResponse) {
      // Handle keyboard shortcut for generating response on selected text
      const selectedText = window.getSelection().toString().trim();
      if (selectedText) {
        // Trigger the AI response for selected text
        chrome.runtime.sendMessage({}, async (response) => {
          await processSelectedText(selectedText);
        });
      }
      return;
    }

    if (!msg.text || isProcessing) return;

    await processSelectedText(msg.text);
  });

  // Function to process selected text and generate AI response
  async function processSelectedText(userText) {
    if (isProcessing) return;

    isProcessing = true;

    if (lastInjectedDiv) {
      lastInjectedDiv.remove();
    }

    // Add first user message to conversation history
    conversationHistory = [{ role: "user", content: userText }];

    const res = await fetch(config.api_endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: config.instructions.default },
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
        width: 100%;
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

        const buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
      `;

        const copyButton = document.createElement("button");
        copyButton.textContent = "Copy Response";
        copyButton.style.cssText = `
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

        const regenerateButton = document.createElement("button");
        regenerateButton.textContent = "Regenerate";
        regenerateButton.style.cssText = `
            padding: 6px 12px;
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
      `;
        regenerateButton.addEventListener("click", async () => {
          regenerateButton.textContent = "Regenerating...";
          regenerateButton.disabled = true;

          try {
            const res = await fetch(config.api_endpoint, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${config.api_key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: config.model,
                messages: [
                  { role: "system", content: config.instructions.default },
                  {
                    role: "user",
                    content:
                      userText +
                      "\n\nPlease provide a different response from your previous answer.",
                  },
                ],
              }),
            });

            const result = await res.json();
            const newAnswer =
              result.choices?.[0]?.message?.content || "⚠️ No response";

            // Update the response div with new content
            responseDiv.innerHTML = convertMarkdown(newAnswer);

            // Update conversation history with new response
            conversationHistory[conversationHistory.length - 1] = {
              role: "assistant",
              content: newAnswer,
            };

            // Update copy button to copy new response
            copyButton.onclick = () => {
              navigator.clipboard.writeText(newAnswer);
              copyButton.textContent = "Copied!";
              setTimeout(
                () => (copyButton.textContent = "Copy Response"),
                2000
              );
            };
          } catch (error) {
            console.error("Error regenerating response:", error);
            responseDiv.innerHTML =
              "<p style='color: red;'>⚠️ Error regenerating response. Please try again.</p>";
          } finally {
            regenerateButton.textContent = "Regenerate";
            regenerateButton.disabled = false;
          }
        });

        const continueButton = document.createElement("button");
        continueButton.textContent = "Continue to Chat";
        continueButton.style.cssText = `
            padding: 6px 12px;
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
      `;
        continueButton.addEventListener("click", openChatInterface);

        buttonContainer.appendChild(copyButton);
        buttonContainer.appendChild(regenerateButton);
        buttonContainer.appendChild(continueButton);

        container.appendChild(closeButton);
        container.appendChild(responseDiv);
        container.appendChild(buttonContainer);

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
  }

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
    // If chat is already open, update it with current conversation and show it
    if (chatContainer && document.body.contains(chatContainer)) {
      chatContainer.style.display = "flex";
      // Update the chat messages to reflect current conversationHistory
      updateChatMessages();
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

    const headerTitle = document.createElement("span");
    headerTitle.textContent = "AI Chat";
    headerTitle.style.cssText = `
    font-size: 14px;
    color: #333;
  `;

    const headerButtons = document.createElement("div");
    headerButtons.style.cssText = `
    display: flex;
    gap: 8px;
    align-items: center;
  `;

    const newChatButton = document.createElement("button");
    newChatButton.textContent = "New Chat";
    newChatButton.style.cssText = `
        padding: 6px 12px;
        background: #f0f0f0;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
  `;
    newChatButton.addEventListener("click", () => {
      // Clear conversation history
      conversationHistory = [];

      // Clear chat messages using updateChatMessages (which will show empty since history is cleared)
      updateChatMessages();

      // Show confirmation
      const confirmMsg = document.createElement("div");
      confirmMsg.textContent =
        "New chat started! Previous conversation cleared.";
      confirmMsg.style.cssText = `
        background: #d4edda;
        color: #155724;
        padding: 8px 12px;
        border-radius: 4px;
        text-align: center;
        font-size: 12px;
        margin: 10px 0;
      `;

      const chatMessages = chatContainer.querySelector(".chat-messages");
      if (chatMessages) {
        chatMessages.appendChild(confirmMsg);

        // Remove confirmation message after 3 seconds
        setTimeout(() => {
          if (chatMessages.contains(confirmMsg)) {
            chatMessages.removeChild(confirmMsg);
          }
        }, 3000);
      }
    });

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

    headerButtons.appendChild(newChatButton);
    headerButtons.appendChild(closeChatButton);
    chatHeader.appendChild(headerTitle);
    chatHeader.appendChild(headerButtons);
    makeDraggable(chatContainer, chatHeader);

    const chatMessages = document.createElement("div");
    chatMessages.className = "chat-messages"; // Add class for easy selection
    chatMessages.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

    // Use the updateChatMessages function to render initial messages
    // We'll call it after appending chatMessages to chatContainer

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

      const userWrapper = document.createElement("div");
      userWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        margin: 8px 0;
      `;

      const userDiv = document.createElement("div");
      userDiv.textContent = userMsg;
      userDiv.style.cssText = `
      background: #e3f2fd;
      padding: 8px 12px;
      border-radius: 8px;
      max-width: 80%;
      word-wrap: break-word;
      user-select: text;
    `;
      userWrapper.appendChild(userDiv);
      chatMessages.appendChild(userWrapper);
      chatInput.value = "";
      chatMessages.scrollTop = chatMessages.scrollHeight;

      const res = await fetch(config.api_endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "system",
              content: config.instructions.default,
            },
            ...conversationHistory,
          ],
        }),
      });

      const data = await res.json();
      const aiResponse =
        data.choices?.[0]?.message?.content || "⚠️ No response";

      conversationHistory.push({ role: "assistant", content: aiResponse });

      const aiWrapper = document.createElement("div");
      aiWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        margin: 8px 0;
      `;

      const aiDiv = document.createElement("div");
      aiDiv.innerHTML = convertMarkdown(aiResponse);
      aiDiv.style.cssText = `
      background: #f1f1f1;
      padding: 8px 12px;
      border-radius: 8px;
      max-width: 80%;
      word-wrap: break-word;
      user-select: text;
    `;

      const regenerateBtnDiv = document.createElement("div");
      regenerateBtnDiv.style.cssText = `
        margin-top: 4px;
        text-align: left;
      `;

      const regenerateBtn = document.createElement("button");
      regenerateBtn.textContent = "↻ Regenerate";
      regenerateBtn.style.cssText = `
        padding: 6px 12px;
        background: #f0f0f0;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      `;

      regenerateBtn.addEventListener("click", async () => {
        regenerateBtn.textContent = "Generating...";
        regenerateBtn.disabled = true;

        try {
          const res = await fetch(config.api_endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.api_key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: config.model,
              messages: [
                {
                  role: "system",
                  content:
                    "You are an expert assistant. Help the user naturally. Provide a different response from your previous answer.",
                },
                {
                  role: "user",
                  content: userMsg + "\n\nPlease provide a different response.",
                },
              ],
            }),
          });

          const newData = await res.json();
          const newAiResponse =
            newData.choices?.[0]?.message?.content || "⚠️ No response";

          // Update the message content
          aiDiv.innerHTML = convertMarkdown(newAiResponse);

          // Update conversation history
          conversationHistory[conversationHistory.length - 1] = {
            role: "assistant",
            content: newAiResponse,
          };
        } catch (error) {
          console.error("Error regenerating message:", error);
          aiDiv.innerHTML =
            "<p style='color: red;'>⚠️ Error regenerating. Please try again.</p>";
        } finally {
          regenerateBtn.textContent = "↻ Regenerate";
          regenerateBtn.disabled = false;
        }
      });

      regenerateBtnDiv.appendChild(regenerateBtn);
      aiWrapper.appendChild(aiDiv);
      aiWrapper.appendChild(regenerateBtnDiv);
      chatMessages.appendChild(aiWrapper);
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

    // Now render the messages from current conversation history
    updateChatMessages();

    document.body.appendChild(chatContainer);
  }

  // Function to update chat messages with current conversation history
  function updateChatMessages() {
    if (!chatContainer) return;

    const chatMessages = chatContainer.querySelector(".chat-messages");
    if (!chatMessages) return;

    // Clear existing messages
    chatMessages.innerHTML = "";

    // Re-render all messages from current conversationHistory
    conversationHistory.forEach((msg, index) => {
      const msgWrapper = document.createElement("div");
      msgWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: ${msg.role === "user" ? "flex-end" : "flex-start"};
        margin: 8px 0;
      `;

      const msgDiv = document.createElement("div");
      msgDiv.style.padding = "8px 12px";
      msgDiv.style.borderRadius = "8px";
      msgDiv.style.maxWidth = "80%";
      msgDiv.style.wordWrap = "break-word";
      msgDiv.style.userSelect = "text";

      if (msg.role === "user") {
        msgDiv.style.background = "#e3f2fd";
        msgDiv.textContent = msg.content;
        msgWrapper.appendChild(msgDiv);
      } else {
        msgDiv.style.background = "#f1f1f1";
        msgDiv.innerHTML = convertMarkdown(msg.content);

        // Add regenerate button for AI responses
        const regenerateBtnDiv = document.createElement("div");
        regenerateBtnDiv.style.cssText = `
          margin-top: 4px;
          text-align: left;
        `;

        const regenerateBtn = document.createElement("button");
        regenerateBtn.textContent = "↻ Regenerate";
        regenerateBtn.style.cssText = `
            padding: 6px 12px;
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;

        regenerateBtn.addEventListener("click", async () => {
          regenerateBtn.textContent = "Generating...";
          regenerateBtn.disabled = true;

          try {
            // Find the corresponding user message
            const userMsg = conversationHistory[index - 1];
            if (userMsg && userMsg.role === "user") {
              const res = await fetch(config.api_endpoint, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${config.api_key}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: config.model,
                  messages: [
                    {
                      role: "system",
                      content:
                        "You are an expert assistant. Help the user naturally. Provide a different response from your previous answer.",
                    },
                    {
                      role: "user",
                      content:
                        userMsg.content +
                        "\n\nPlease provide a different response.",
                    },
                  ],
                }),
              });

              const data = await res.json();
              const newResponse =
                data.choices?.[0]?.message?.content || "⚠️ No response";

              // Update the message content
              msgDiv.innerHTML = convertMarkdown(newResponse);

              // Update conversation history
              conversationHistory[index] = {
                role: "assistant",
                content: newResponse,
              };
            }
          } catch (error) {
            console.error("Error regenerating message:", error);
            msgDiv.innerHTML =
              "<p style='color: red;'>⚠️ Error regenerating. Please try again.</p>";
          } finally {
            regenerateBtn.textContent = "↻ Regenerate";
            regenerateBtn.disabled = false;
          }
        });

        regenerateBtnDiv.appendChild(regenerateBtn);
        msgWrapper.appendChild(msgDiv);
        msgWrapper.appendChild(regenerateBtnDiv);
      }

      chatMessages.appendChild(msgWrapper);
    });

    // Scroll to bottom to show latest messages
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ============ AI RESPONSE HIDE/SHOW FUNCTIONALITY ============
  function toggleAIResponse() {
    if (!lastInjectedDiv) return;

    if (lastInjectedDiv.style.display === "none") {
      lastInjectedDiv.style.display = "block";
    } else {
      lastInjectedDiv.style.display = "none";
    }
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

  // ============ Markdown Conversion ============
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

  // ================= BYPASS WEBSITE RESTRICTIONS =================
  function bypassWebsiteRestrictions() {
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

    // Apply all bypass fixes
    enableTextSelection();
    enableRightClick();
    enableCopyPaste();

    // Apply fixes after DOM load if needed
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        enableTextSelection();
        enableRightClick();
        enableCopyPaste();
      });
    } else {
      // DOM is already loaded, apply fixes with a small delay
      setTimeout(() => {
        enableTextSelection();
        enableRightClick();
        enableCopyPaste();
      }, 100);
    }

    // Re-apply fixes if page dynamically changes
    const observer = new MutationObserver(() => {
      enableTextSelection();
      enableRightClick();
      enableCopyPaste();
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  }
})(); // End IIFE - Initialize AI Helper
