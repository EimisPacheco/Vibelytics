// TiDB Configuration for YouTube Comment Analytics
// This file contains the configuration for connecting to TiDB Serverless

const TiDBConfig = {
  // TiDB Serverless connection details
  // Get these from your TiDB Cloud console
  connection: {
    host: process.env.TIDB_HOST || 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    port: process.env.TIDB_PORT || 4000,
    user: process.env.TIDB_USER || '4GESgVjG1QNSAoU.root',
    password: process.env.TIDB_PASSWORD || 'xOgHk9Jv2BCRqXmz',
    database: process.env.TIDB_DATABASE || 'youtube-comments-analytics',
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.TIDB_CA_PATH || '/etc/ssl/cert.pem'
    }
  },
  
  // Vector search configuration
  vectorSearch: {
    embeddingDimension: 768, // Standard for BERT-like models
    indexType: 'IVF_FLAT', // Index type for vector search
    nLists: 100, // Number of clusters for IVF index
    similarityThreshold: 0.7, // Minimum similarity for matches
    maxResults: 20 // Maximum results per query
  },
  
  // Caching configuration
  cache: {
    enabled: true,
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    maxEntries: 1000,
    cleanupInterval: 24 * 60 * 60 * 1000 // Daily cleanup
  },
  
  // Agent configuration
  agents: {
    ingestion: {
      batchSize: 100,
      maxCommentsPerVideo: 10000,
      retryAttempts: 3
    },
    vector: {
      batchSize: 50,
      embeddingTimeout: 30000, // 30 seconds
      patternUpdateInterval: 7 * 24 * 60 * 60 * 1000 // Weekly
    },
    semantic: {
      minPatternConfidence: 0.7,
      clusterCount: 5,
      controversyThreshold: 0.5
    },
    insight: {
      minOpportunityConfidence: 0.8,
      topResultsCount: 5,
      summaryLength: 200
    }
  },
  
  // API endpoints (if using external embedding service)
  embeddings: {
    // Option 1: Use TiDB's built-in ML functions
    useBuiltIn: true,
    
    // Option 2: Use external API (OpenAI, Cohere, etc.)
    externalAPI: {
      enabled: false,
      endpoint: 'https://api.openai.com/v1/embeddings',
      model: 'text-embedding-ada-002',
      apiKey: process.env.EMBEDDING_API_KEY
    },
    
    // Option 3: Use local model server
    localModel: {
      enabled: false,
      endpoint: 'http://localhost:8080/embeddings',
      model: 'sentence-transformers/all-MiniLM-L6-v2'
    }
  },
  
  // Performance tuning
  performance: {
    maxConcurrentQueries: 10,
    queryTimeout: 30000, // 30 seconds
    connectionPoolSize: 5,
    enableQueryCache: true
  },
  
  // Feature flags
  features: {
    enableVectorSearch: true,
    enableSemanticAnalysis: true,
    enableBusinessIntelligence: true,
    enableControversyDetection: true,
    enableTrendAnalysis: true,
    enableAudienceInsights: true
  }
};

// Helper function to get config from Chrome storage
async function loadConfigFromStorage() {
  try {
    const stored = await chrome.storage.local.get(['tidbConfig']);
    if (stored.tidbConfig) {
      return { ...TiDBConfig, ...stored.tidbConfig };
    }
  } catch (error) {
    console.error('Failed to load config from storage:', error);
  }
  return TiDBConfig;
}

// Helper function to save config to Chrome storage
async function saveConfigToStorage(config) {
  try {
    await chrome.storage.local.set({ tidbConfig: config });
    console.log('TiDB config saved to storage');
  } catch (error) {
    console.error('Failed to save config to storage:', error);
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TiDBConfig, loadConfigFromStorage, saveConfigToStorage };
} else {
  window.TiDBConfig = TiDBConfig;
  window.loadConfigFromStorage = loadConfigFromStorage;
  window.saveConfigToStorage = saveConfigToStorage;
}