// OpenAI Embedding Service
// Alternative to Google's embedding-001 for local storage mode

class OpenAIEmbeddingService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.openai.com/v1/embeddings';
    this.model = 'text-embedding-ada-002'; // OpenAI's most cost-effective model
    this.dimension = 1536; // Ada-002 produces 1536-dimensional embeddings
    
    // Cache for embeddings to reduce API calls
    this.cache = new Map();
    this.maxCacheSize = 1000;
  }

  async generateEmbedding(text, options = {}) {
    console.log('🤖 Generating OpenAI embedding for text:', text.substring(0, 50) + '...');
    
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(text);
      if (this.cache.has(cacheKey)) {
        console.log('📦 Using cached embedding');
        return this.cache.get(cacheKey);
      }
      
      // Prepare request
      const requestBody = {
        input: text,
        model: options.model || this.model,
        encoding_format: "float" // Get raw floats instead of base64
      };
      
      // Make API request
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }
      
      const result = await response.json();
      
      // Extract embedding
      const embedding = result.data[0].embedding;
      
      // Cache the result
      this.cacheEmbedding(cacheKey, embedding);
      
      console.log('✅ OpenAI embedding generated successfully');
      return embedding;
      
    } catch (error) {
      console.error('❌ OpenAI embedding generation failed:', error);
      
      // Fallback to simple embedding if API fails
      if (options.useFallback !== false) {
        console.log('⚠️ Using fallback embedding generation');
        return this.generateFallbackEmbedding(text);
      }
      
      throw error;
    }
  }

  async generateBatchEmbeddings(texts, options = {}) {
    console.log(`🤖 Generating ${texts.length} OpenAI embeddings in batch`);
    
    try {
      // OpenAI supports batch embeddings in a single request
      // Max 2048 embeddings per request
      const batchSize = 100; // Conservative batch size
      const embeddings = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, Math.min(i + batchSize, texts.length));
        
        // Check cache for each text
        const uncachedTexts = [];
        const cachedEmbeddings = new Map();
        
        batch.forEach((text, index) => {
          const cacheKey = this.getCacheKey(text);
          if (this.cache.has(cacheKey)) {
            cachedEmbeddings.set(i + index, this.cache.get(cacheKey));
          } else {
            uncachedTexts.push({ text, originalIndex: i + index });
          }
        });
        
        // Only request embeddings for uncached texts
        if (uncachedTexts.length > 0) {
          const requestBody = {
            input: uncachedTexts.map(item => item.text),
            model: options.model || this.model,
            encoding_format: "float"
          };
          
          const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(requestBody)
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
          }
          
          const result = await response.json();
          
          // Map embeddings back to original indices
          result.data.forEach((item, idx) => {
            const originalIndex = uncachedTexts[idx].originalIndex;
            const embedding = item.embedding;
            embeddings[originalIndex] = embedding;
            
            // Cache the embedding
            const cacheKey = this.getCacheKey(uncachedTexts[idx].text);
            this.cacheEmbedding(cacheKey, embedding);
          });
        }
        
        // Add cached embeddings
        cachedEmbeddings.forEach((embedding, index) => {
          embeddings[index] = embedding;
        });
        
        // Rate limiting
        if (i + batchSize < texts.length) {
          await this.delay(100); // 100ms delay between batches
        }
      }
      
      console.log(`✅ Generated ${embeddings.length} embeddings successfully`);
      return embeddings;
      
    } catch (error) {
      console.error('❌ Batch embedding generation failed:', error);
      
      // Fallback to individual embeddings
      if (options.useFallback !== false) {
        console.log('⚠️ Falling back to individual embedding generation');
        return await Promise.all(
          texts.map(text => this.generateEmbedding(text, options))
        );
      }
      
      throw error;
    }
  }

  // Convert from OpenAI's 1536 dimensions to 768 for compatibility
  async generateCompatibleEmbedding(text, targetDimension = 768) {
    const fullEmbedding = await this.generateEmbedding(text);
    
    if (targetDimension === this.dimension) {
      return fullEmbedding;
    }
    
    // Dimension reduction using PCA-like approach (simplified)
    return this.reduceDimensions(fullEmbedding, targetDimension);
  }

  reduceDimensions(embedding, targetDim) {
    const sourceDim = embedding.length;
    
    if (targetDim >= sourceDim) {
      // Pad with zeros if target is larger
      return [...embedding, ...new Array(targetDim - sourceDim).fill(0)];
    }
    
    // Simple dimension reduction by averaging groups
    const ratio = sourceDim / targetDim;
    const reduced = new Array(targetDim);
    
    for (let i = 0; i < targetDim; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);
      
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += embedding[j];
      }
      reduced[i] = sum / (end - start);
    }
    
    // Normalize the reduced embedding
    const norm = Math.sqrt(reduced.reduce((sum, val) => sum + val * val, 0));
    return reduced.map(val => val / norm);
  }

  // Fallback embedding generation (when API is unavailable)
  generateFallbackEmbedding(text) {
    // This is a simplified version that creates deterministic embeddings
    // based on text features - not as good as OpenAI but works offline
    
    const dimension = 768; // Match TiDB expected dimensions
    const embedding = new Array(dimension).fill(0);
    
    // Simple feature extraction
    const words = text.toLowerCase().split(/\s+/);
    const features = {
      length: text.length / 1000,
      wordCount: words.length / 100,
      avgWordLength: words.reduce((sum, w) => sum + w.length, 0) / words.length / 10,
      questionMark: text.includes('?') ? 1 : 0,
      exclamation: text.includes('!') ? 0.5 : 0,
      uppercase: (text.match(/[A-Z]/g) || []).length / text.length,
      numbers: (text.match(/\d/g) || []).length / text.length,
      // Sentiment indicators
      positive: this.countSentimentWords(text, this.positiveWords) / 10,
      negative: this.countSentimentWords(text, this.negativeWords) / 10
    };
    
    // Hash words to positions
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      const position = hash % dimension;
      embedding[position] += 1 / (index + 1); // Weight by position
    });
    
    // Add features to specific positions
    Object.values(features).forEach((value, index) => {
      if (index < dimension) {
        embedding[index] = value;
      }
    });
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  // Helper methods
  getCacheKey(text) {
    // Create a simple hash of the text for caching
    return text.substring(0, 100) + '_' + text.length;
  }

  cacheEmbedding(key, embedding) {
    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry (FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, embedding);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  countSentimentWords(text, wordList) {
    const lowerText = text.toLowerCase();
    return wordList.filter(word => lowerText.includes(word)).length;
  }

  // Sentiment word lists for fallback
  positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
    'love', 'best', 'awesome', 'perfect', 'beautiful', 'helpful',
    'thank', 'appreciate', 'brilliant', 'outstanding'
  ];

  negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate',
    'useless', 'waste', 'disappointed', 'boring', 'confusing', 'poor',
    'wrong', 'failed', 'broken', 'annoying'
  ];

  // Get service info
  getInfo() {
    return {
      provider: 'OpenAI',
      model: this.model,
      dimension: this.dimension,
      costPer1k: 0.0001, // $0.0001 per 1k tokens
      rateLimit: '3000 requests/min',
      maxTokens: 8191
    };
  }
}

// Export for Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OpenAIEmbeddingService;
} else {
  window.OpenAIEmbeddingService = OpenAIEmbeddingService;
}