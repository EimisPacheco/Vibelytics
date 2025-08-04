// Popup Settings JavaScript

document.addEventListener('DOMContentLoaded', async () => {
  // Load current settings
  await loadSettings();
  
  // Event listeners
  document.getElementById('provider').addEventListener('change', handleProviderChange);
  document.getElementById('save-openai').addEventListener('click', saveOpenAISettings);
  document.getElementById('clear-cache').addEventListener('click', clearCache);
  document.getElementById('cache-enabled').addEventListener('change', toggleCache);
  
  // Load storage status
  await updateStorageStatus();
});

async function loadSettings() {
  try {
    // Load embedding config
    const config = await chrome.storage.local.get(['embeddingConfig', 'openaiApiKey']);
    
    // Set provider
    const provider = config.embeddingConfig?.defaultProvider || 'local';
    document.getElementById('provider').value = provider;
    
    // Show/hide OpenAI section
    handleProviderChange();
    
    // Load OpenAI key (masked)
    if (config.openaiApiKey) {
      const maskedKey = config.openaiApiKey.substring(0, 7) + '...' + config.openaiApiKey.substring(config.openaiApiKey.length - 4);
      document.getElementById('openai-key').placeholder = maskedKey;
    }
    
    // Update current config display
    updateConfigDisplay(config);
    
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

function handleProviderChange() {
  const provider = document.getElementById('provider').value;
  const openaiSection = document.getElementById('openai-section');
  
  if (provider === 'openai') {
    openaiSection.style.display = 'block';
  } else {
    openaiSection.style.display = 'none';
  }
}

async function saveOpenAISettings() {
  try {
    const apiKey = document.getElementById('openai-key').value;
    
    if (!apiKey || !apiKey.startsWith('sk-')) {
      showStatus('Please enter a valid OpenAI API key', 'error');
      return;
    }
    
    // Save API key
    await chrome.storage.local.set({ openaiApiKey: apiKey });
    
    // Update embedding config
    const config = await chrome.storage.local.get(['embeddingConfig']);
    const embeddingConfig = config.embeddingConfig || {};
    
    embeddingConfig.defaultProvider = 'openai';
    embeddingConfig.openai = {
      ...embeddingConfig.openai,
      enabled: true,
      apiKey: apiKey
    };
    
    await chrome.storage.local.set({ embeddingConfig });
    
    showStatus('OpenAI settings saved successfully!', 'success');
    
    // Update display
    await loadSettings();
    
  } catch (error) {
    console.error('Failed to save OpenAI settings:', error);
    showStatus('Failed to save settings', 'error');
  }
}

async function clearCache() {
  if (!confirm('Are you sure you want to clear all cached data?')) {
    return;
  }
  
  try {
    // Get all keys
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(allData).filter(key => 
      key.startsWith('youtube_embeddings_') || 
      key === 'analysis_cache' ||
      key === 'comment_patterns'
    );
    
    // Remove cache keys
    await chrome.storage.local.remove(keysToRemove);
    
    showStatus(`Cleared ${keysToRemove.length} cached items`, 'success');
    await updateStorageStatus();
    
  } catch (error) {
    console.error('Failed to clear cache:', error);
    showStatus('Failed to clear cache', 'error');
  }
}

async function toggleCache() {
  const enabled = document.getElementById('cache-enabled').checked;
  
  try {
    await chrome.storage.local.set({ cacheEnabled: enabled });
    showStatus(`Cache ${enabled ? 'enabled' : 'disabled'}`, 'success');
  } catch (error) {
    console.error('Failed to toggle cache:', error);
    showStatus('Failed to update cache setting', 'error');
  }
}

async function updateStorageStatus() {
  try {
    // Get storage usage
    const usage = await chrome.storage.local.getBytesInUse();
    const quota = chrome.storage.local.QUOTA_BYTES;
    const percentUsed = ((usage / quota) * 100).toFixed(2);
    
    // Count cached items
    const allData = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(allData).filter(key => 
      key.startsWith('youtube_embeddings_') || 
      key === 'analysis_cache'
    );
    
    const statusDiv = document.getElementById('storage-status');
    statusDiv.innerHTML = `
      <div>Used: ${formatBytes(usage)} / ${formatBytes(quota)} (${percentUsed}%)</div>
      <div>Cached videos: ${cacheKeys.length}</div>
      <div>Storage type: ${await getStorageType()}</div>
    `;
    
  } catch (error) {
    console.error('Failed to get storage status:', error);
  }
}

async function getStorageType() {
  try {
    // Check if using TiDB or local
    const config = await chrome.storage.local.get(['storageMode']);
    return config.storageMode === 'tidb' ? '🚀 TiDB' : '💾 Local';
  } catch (error) {
    return '💾 Local';
  }
}

function updateConfigDisplay(config) {
  const configDiv = document.getElementById('current-config');
  const displayConfig = {
    provider: config.embeddingConfig?.defaultProvider || 'local',
    openai_configured: !!config.openaiApiKey,
    cache_enabled: config.cacheEnabled !== false,
    storage_mode: 'auto'
  };
  
  configDiv.textContent = JSON.stringify(displayConfig, null, 2);
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  
  setTimeout(() => {
    statusDiv.className = 'status';
  }, 3000);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}