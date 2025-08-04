// Embedding Configuration
// Configure which embedding service to use

const EmbeddingConfig = {
  // Default embedding provider
  // Options: 'openai', 'google', 'local'
  defaultProvider: 'local',
  
  // OpenAI Configuration
  openai: {
    enabled: false, // Set to true to use OpenAI
    apiKey: '', // Add your OpenAI API key here
    model: 'text-embedding-ada-002',
    dimension: 1536, // OpenAI ada-002 native dimension
    targetDimension: 768, // Reduce to this for compatibility
    maxTokens: 8191,
    rateLimit: 3000, // requests per minute
    costPer1kTokens: 0.0001
  },
  
  // Google Configuration (future)
  google: {
    enabled: false,
    apiKey: '',
    model: 'embedding-001',
    dimension: 768
  },
  
  // Local embedding configuration
  local: {
    enabled: true, // Always available as fallback
    dimension: 768,
    method: 'feature-based' // 'feature-based' or 'hash-based'
  },
  
  // General settings
  settings: {
    cacheEmbeddings: true,
    maxCacheSize: 1000,
    batchSize: 50,
    retryOnFailure: true,
    fallbackToLocal: true
  }
};

// Helper function to get embedding configuration
async function getEmbeddingConfig() {
  try {
    // Try to load from Chrome storage
    const stored = await chrome.storage.local.get(['embeddingConfig']);
    if (stored.embeddingConfig) {
      return { ...EmbeddingConfig, ...stored.embeddingConfig };
    }
  } catch (error) {
    console.error('Failed to load embedding config from storage:', error);
  }
  
  // Check for OpenAI API key in environment or settings
  const openAIKey = await getOpenAIKey();
  if (openAIKey) {
    EmbeddingConfig.openai.apiKey = openAIKey;
    EmbeddingConfig.openai.enabled = true;
    EmbeddingConfig.defaultProvider = 'openai';
  }
  
  return EmbeddingConfig;
}

// Get OpenAI API key from storage
async function getOpenAIKey() {
  try {
    const stored = await chrome.storage.local.get(['openaiApiKey']);
    return stored.openaiApiKey || '';
  } catch (error) {
    return '';
  }
}

// Save OpenAI API key
async function saveOpenAIKey(apiKey) {
  try {
    await chrome.storage.local.set({ openaiApiKey: apiKey });
    console.log('OpenAI API key saved');
    
    // Update config
    EmbeddingConfig.openai.apiKey = apiKey;
    EmbeddingConfig.openai.enabled = !!apiKey;
    EmbeddingConfig.defaultProvider = apiKey ? 'openai' : 'local';
    
    // Save updated config
    await chrome.storage.local.set({ embeddingConfig: EmbeddingConfig });
  } catch (error) {
    console.error('Failed to save OpenAI API key:', error);
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmbeddingConfig, getEmbeddingConfig, saveOpenAIKey };
} else {
  window.EmbeddingConfig = EmbeddingConfig;
  window.getEmbeddingConfig = getEmbeddingConfig;
  window.saveOpenAIKey = saveOpenAIKey;
}