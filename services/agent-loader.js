// Agent Loader
// Loads all agent modules for the Chrome extension

// Load all agent classes
async function loadAgents() {
  try {
    // In a Chrome extension, we need to load scripts differently
    // This loader helps manage the agent dependencies
    
    const scripts = [
      'config/embedding-config.js',  // Load config first
      'services/storage-adapter.js',  // Load storage adapter
      'services/tidb-service.js',
      'services/openai-embedding-service.js',  // Add OpenAI service
      'services/comment-ingestion-agent.js',
      'services/vector-processing-agent.js',
      'services/semantic-analysis-agent.js',
      'services/insight-generation-agent.js',
      'services/agent-coordinator.js'
    ];
    
    // For content script context, we'll inject these as script tags
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      // We're in a Chrome extension
      console.log('🔧 Loading agent modules...');
      
      // Create a promise that resolves when all agents are loaded
      return new Promise((resolve) => {
        let loadedCount = 0;
        
        scripts.forEach(script => {
          const scriptElement = document.createElement('script');
          scriptElement.src = chrome.runtime.getURL(script);
          scriptElement.onload = () => {
            loadedCount++;
            console.log(`✅ Loaded ${script}`);
            
            if (loadedCount === scripts.length) {
              console.log('✅ All agent modules loaded');
              resolve();
            }
          };
          scriptElement.onerror = (error) => {
            console.error(`❌ Failed to load ${script}:`, error);
            // Continue loading other scripts even if one fails
            loadedCount++;
            if (loadedCount === scripts.length) {
              console.log('⚠️ Some modules failed to load, but continuing...');
              resolve();
            }
          };
          
          document.head.appendChild(scriptElement);
        });
      });
    } else {
      // For testing outside Chrome extension
      console.log('Loading agents in non-extension environment');
      return Promise.resolve();
    }
  } catch (error) {
    console.error('❌ Agent loader error:', error);
    throw error;
  }
}

// Initialize the multi-agent system
async function initializeMultiAgentSystem(config = {}) {
  try {
    // Load all agent modules first
    await loadAgents();
    
    // Wait a bit for scripts to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create and initialize the coordinator
    if (typeof AgentCoordinator === 'undefined') {
      throw new Error('AgentCoordinator not loaded');
    }
    
    // Get embedding configuration
    let embeddingConfig = { provider: 'local' };
    if (typeof getEmbeddingConfig !== 'undefined') {
      const loadedConfig = await getEmbeddingConfig();
      embeddingConfig = {
        provider: loadedConfig.defaultProvider,
        apiKey: loadedConfig.openai.apiKey,
        ...loadedConfig.settings
      };
    }
    
    // Default configuration that works with local storage
    const defaultConfig = {
      storageMode: 'auto',  // Will try TiDB first, then fall back to local
      tidb: {
        host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
        port: 4000,
        user: '4GESgVjG1QNSAoU.root',
        password: 'xOgHk9Jv2BCRqXmz',
        database: 'youtube-comments-analytics',
        ssl: { rejectUnauthorized: true },
        backendUrl: null  // No backend API, will use development mode
      },
      embedding: embeddingConfig
    };
    
    // Merge with user config
    const finalConfig = { ...defaultConfig, ...config };
    
    const coordinator = new AgentCoordinator(finalConfig);
    await coordinator.initialize();
    
    console.log('✅ Multi-agent system ready');
    return coordinator;
    
  } catch (error) {
    console.error('❌ Failed to initialize multi-agent system:', error);
    // Return a coordinator that works with local storage only
    console.log('⚠️ Creating local-only coordinator');
    const localCoordinator = new AgentCoordinator({ storageMode: 'local' });
    await localCoordinator.initialize();
    return localCoordinator;
  }
}

// Export functions
window.YouTubeCommentMultiAgent = {
  loadAgents,
  initializeMultiAgentSystem
};