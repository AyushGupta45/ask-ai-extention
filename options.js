// Options page script for AI Helper Extension

document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('apiKey');
    const modelSelect = document.getElementById('model');
    const saveBtn = document.getElementById('saveBtn');
    const testBtn = document.getElementById('testBtn');
    const statusDiv = document.getElementById('status');

    // Load saved settings
    try {
        const result = await chrome.storage.sync.get(['groqApiKey', 'selectedModel']);
        if (result.groqApiKey) {
            apiKeyInput.value = result.groqApiKey;
        }
        if (result.selectedModel) {
            modelSelect.value = result.selectedModel;
        } else {
            modelSelect.value = 'llama-3.1-8b-instant'; // default
        }
    } catch (error) {
        showStatus('Error loading settings', 'error');
    }

    // Save settings
    saveBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const selectedModel = modelSelect.value;

        if (!apiKey) {
            showStatus('Please enter your Groq API key', 'error');
            return;
        }

        if (!apiKey.startsWith('gsk_')) {
            showStatus('Invalid API key format. Groq keys start with "gsk_"', 'error');
            return;
        }

        try {
            await chrome.storage.sync.set({
                groqApiKey: apiKey,
                selectedModel: selectedModel
            });
            showStatus('Settings saved successfully!', 'success');
        } catch (error) {
            showStatus('Error saving settings: ' + error.message, 'error');
        }
    });

    // Test API connection
    testBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const selectedModel = modelSelect.value;

        if (!apiKey) {
            showStatus('Please enter your API key first', 'error');
            return;
        }

        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [
                        {
                            role: 'user',
                            content: 'Hello, this is a test. Please respond with "API connection successful!"'
                        }
                    ],
                    max_tokens: 50
                })
            });

            if (response.ok) {
                const data = await response.json();
                const message = data.choices?.[0]?.message?.content || 'Test completed';
                showStatus(`✅ API connection successful! Response: "${message}"`, 'success');
            } else {
                const errorData = await response.json();
                showStatus(`❌ API Error: ${errorData.error?.message || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            showStatus(`❌ Connection failed: ${error.message}`, 'error');
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = 'Test Connection';
        }
    });

    function showStatus(message, type) {
        statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 5000);
        }
    }

    // Show/hide API key
    const toggleKeyVisibility = document.createElement('button');
    toggleKeyVisibility.textContent = 'Show';
    toggleKeyVisibility.className = 'secondary';
    toggleKeyVisibility.style.marginLeft = '10px';
    toggleKeyVisibility.style.padding = '8px 12px';
    
    apiKeyInput.parentNode.appendChild(toggleKeyVisibility);
    
    toggleKeyVisibility.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleKeyVisibility.textContent = 'Hide';
        } else {
            apiKeyInput.type = 'password';
            toggleKeyVisibility.textContent = 'Show';
        }
    });

    // Auto-save model selection
    modelSelect.addEventListener('change', async () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            try {
                await chrome.storage.sync.set({
                    groqApiKey: apiKey,
                    selectedModel: modelSelect.value
                });
                showStatus('Model selection saved!', 'success');
            } catch (error) {
                console.error('Error auto-saving model:', error);
            }
        }
    });
});
