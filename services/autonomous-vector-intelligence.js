// Autonomous Vector Intelligence System
// Integrates all autonomous agents for intelligent vector operations

class AutonomousVectorIntelligence {
  constructor(storageAdapter, embeddingConfig = {}) {
    this.storageAdapter = storageAdapter;
    
    // Initialize embedding service (OpenAI or local)
    this.initializeEmbeddingService(embeddingConfig);
    
    // Initialize autonomous agents
    this.agents = {
      embedding: new AutonomousEmbeddingAgent(this.embeddingService, this.storageAdapter),
      search: new IntelligentSearchStrategyAgent(this.storageAdapter, null), // Will set embedding agent later
      context: null // Will initialize after search agent
    };
    
    // Set circular references
    this.agents.search.embeddingAgent = this.agents.embedding;
    this.agents.context = new ContextMatchingSystem(
      this.storageAdapter,
      this.agents.embedding,
      this.agents.search
    );
    
    // System state
    this.state = {
      initialized: false,
      activeOperations: 0,
      performance: {
        embeddingsCreated: 0,
        searchesPerformed: 0,
        cacheHits: 0,
        avgResponseTime: 0
      }
    };
    
    // Learning and adaptation
    this.learningModule = this.initializeLearningModule();
    
    console.log('🤖 Autonomous Vector Intelligence System initialized');
  }

  // Initialize embedding service
  initializeEmbeddingService(config) {
    const provider = config.provider || 'local';
    
    if (provider === 'openai' && config.apiKey) {
      console.log('🔑 Using OpenAI embeddings for vector intelligence');
      console.log('💰 API calls will be made to: https://api.openai.com/v1/embeddings');
      console.log('📊 Cost: $0.0001 per 1k tokens');
      this.embeddingService = new OpenAIEmbeddingService(config.apiKey);
      this.embeddingService.provider = 'openai';
    } else {
      console.log('💾 Using LOCAL embeddings for vector intelligence');
      console.log('🚫 NO API CALLS - All processing done locally');
      console.log('💸 Cost: FREE');
      console.log('⚡ Speed: INSTANT (no network latency)');
      // Create a mock embedding service for local mode
      this.embeddingService = {
        provider: 'local',
        generateEmbedding: async (text) => {
          console.log('🔧 Generating LOCAL embedding (no API call)');
          // Use the existing local embedding logic
          return this.generateLocalEmbedding(text);
        },
        generateBatchEmbeddings: async (texts) => {
          console.log(`🔧 Generating ${texts.length} LOCAL embeddings (no API calls)`);
          return Promise.all(texts.map(text => this.generateLocalEmbedding(text)));
        },
        generateCompatibleEmbedding: async (text, dimension) => {
          console.log('🔧 Generating compatible LOCAL embedding (no API call)');
          const embedding = await this.generateLocalEmbedding(text);
          return this.resizeEmbedding(embedding, dimension);
        }
      };
    }
  }

  // Main intelligent vectorization method
  async vectorize(text, context = {}) {
    const startTime = Date.now();
    
    console.log('\n=== STARTING VECTORIZATION PROCESS ===');
    console.log(`📝 Text: "${text.substring(0, 50)}..."`);
    
    try {
      // STEP 1: CHECK CACHE
      console.log('\n📍 STEP 1: CHECKING CACHE');
      const cacheCheck = await this.checkCache(text);
      if (cacheCheck && cacheCheck.valid) {
        console.log('✅ FOUND IN CACHE - NO API CALLS NEEDED');
        return {
          vectorized: true,
          embedding: cacheCheck.embedding,
          cached: true,
          source: 'cache'
        };
      }
      console.log('❌ NOT IN CACHE - PROCEEDING');
      
      // STEP 2: AUTONOMOUS DECISION
      console.log('\n📍 STEP 2: AUTONOMOUS DECISION');
      const decision = await this.agents.embedding.shouldCreateEmbedding(text, context);
      
      if (!decision.shouldEmbed) {
        console.log(`⏭️ SKIPPING VECTORIZATION: ${decision.reason}`);
        console.log('🚫 NO API CALLS WILL BE MADE');
        return {
          vectorized: false,
          reason: decision.reason,
          cached: false
        };
      }
      
      // STEP 3: GENERATE EMBEDDING
      console.log('\n📍 STEP 3: GENERATING EMBEDDING');
      console.log(`🔄 Provider: ${this.embeddingService.provider?.toUpperCase() || 'LOCAL'}`);
      
      if (this.embeddingService.provider === 'openai') {
        console.log('🌐 CALLING OPENAI API...');
        console.log('📡 Endpoint: https://api.openai.com/v1/embeddings');
      } else {
        console.log('💻 GENERATING LOCAL EMBEDDING (NO API CALL)');
      }
      
      const embedding = await this.generateOptimizedEmbedding(text, context);
      console.log(`✅ EMBEDDING GENERATED - Dimension: ${embedding.length}`);
      
      // STEP 4: STORE EMBEDDING
      console.log('\n📍 STEP 4: STORING EMBEDDING');
      await this.intelligentStore(text, embedding, context);
      
      // STEP 5: UPDATE LEARNING
      console.log('\n📍 STEP 5: UPDATING LEARNING MODULE');
      this.learningModule.recordVectorization(text, embedding, context);
      
      // Update performance metrics
      this.updatePerformanceMetrics('vectorization', Date.now() - startTime);
      console.log(`\n⏱️ Total time: ${Date.now() - startTime}ms`);
      console.log('=== VECTORIZATION COMPLETE ===\n');
      
      return {
        vectorized: true,
        embedding,
        dimension: embedding.length,
        quality: this.assessEmbeddingQuality(embedding, context),
        source: this.embeddingService.provider || 'local'
      };
      
    } catch (error) {
      console.error('\n❌ VECTORIZATION FAILED:', error);
      console.log('🔄 ATTEMPTING FALLBACK...');
      
      // Fallback to cached or local embedding
      const fallback = await this.handleVectorizationFailure(text, context);
      return fallback;
    }
  }

  // Intelligent semantic search
  async semanticSearch(query, videoId, options = {}) {
    const startTime = Date.now();
    
    try {
      // Step 1: Use intelligent search strategy agent
      const searchResults = await this.agents.search.search(query, videoId, options);
      
      // Step 2: Apply context matching
      const contextualResults = await this.agents.context.matchWithContext(
        query,
        searchResults.results,
        { videoId, ...options }
      );
      
      // Step 3: Learn from search
      this.learningModule.recordSearch(query, contextualResults);
      
      // Update performance metrics
      this.updatePerformanceMetrics('search', Date.now() - startTime);
      
      return {
        results: contextualResults.results,
        strategy: searchResults.strategies,
        context: contextualResults.context,
        confidence: searchResults.confidence
      };
      
    } catch (error) {
      console.error('❌ Semantic search failed:', error);
      return this.fallbackSearch(query, videoId);
    }
  }

  // Document search with context understanding
  async documentSearch(documents, query, options = {}) {
    console.log('📄 Performing intelligent document search');
    
    // Step 1: Analyze query intent
    const queryIntent = await this.agents.search.analyzeQueryIntent(query);
    
    // Step 2: Vectorize documents intelligently
    const vectorizedDocs = await this.intelligentDocumentVectorization(documents, queryIntent);
    
    // Step 3: Multi-strategy search
    const searchResults = await this.multiStrategyDocumentSearch(
      vectorizedDocs,
      query,
      queryIntent,
      options
    );
    
    // Step 4: Context-aware ranking
    const rankedResults = await this.contextAwareDocumentRanking(
      searchResults,
      query,
      queryIntent
    );
    
    return {
      results: rankedResults,
      intent: queryIntent,
      totalDocuments: documents.length,
      vectorizedCount: vectorizedDocs.length
    };
  }

  // Context matching for relevance
  async contextMatch(source, target, context = {}) {
    console.log('🎯 Performing intelligent context matching');
    
    // Step 1: Vectorize if needed
    const sourceVector = await this.ensureVectorized(source, context);
    const targetVector = await this.ensureVectorized(target, context);
    
    // Step 2: Calculate multi-dimensional similarity
    const similarities = {
      semantic: this.calculateSemanticSimilarity(sourceVector, targetVector),
      contextual: await this.calculateContextualSimilarity(source, target, context),
      structural: this.calculateStructuralSimilarity(source, target),
      temporal: this.calculateTemporalSimilarity(context)
    };
    
    // Step 3: Intelligent weighting based on context
    const weights = this.determineOptimalWeights(context, similarities);
    
    // Step 4: Calculate final match score
    const matchScore = Object.entries(similarities).reduce(
      (score, [key, value]) => score + value * weights[key],
      0
    );
    
    return {
      match: matchScore > 0.7,
      score: matchScore,
      similarities,
      weights,
      explanation: this.generateMatchExplanation(similarities, weights)
    };
  }

  // Intelligent document vectorization
  async intelligentDocumentVectorization(documents, queryIntent) {
    const vectorized = [];
    
    // Group documents by importance
    const grouped = await this.groupDocumentsByImportance(documents, queryIntent);
    
    // Vectorize high-importance documents first
    for (const group of ['high', 'medium', 'low']) {
      if (grouped[group].length === 0) continue;
      
      const batchDecisions = await Promise.all(
        grouped[group].map(doc => 
          this.agents.embedding.shouldCreateEmbedding(doc.text, {
            documentType: doc.type,
            importance: group,
            queryIntent
          })
        )
      );
      
      const toVectorize = grouped[group].filter((_, i) => batchDecisions[i].shouldEmbed);
      
      if (toVectorize.length > 0) {
        const embeddings = await this.agents.embedding.processBatch(
          toVectorize.map(d => d.text),
          toVectorize.map(d => ({ documentType: d.type }))
        );
        
        toVectorize.forEach((doc, i) => {
          if (embeddings[i]) {
            vectorized.push({
              ...doc,
              embedding: embeddings[i],
              importance: group
            });
          }
        });
      }
    }
    
    return vectorized;
  }

  // Multi-strategy document search
  async multiStrategyDocumentSearch(documents, query, queryIntent, options) {
    const strategies = [
      { name: 'semantic', weight: 0.4 },
      { name: 'keyword', weight: 0.3 },
      { name: 'contextual', weight: 0.3 }
    ];
    
    const results = new Map();
    
    // Execute each strategy
    for (const strategy of strategies) {
      const strategyResults = await this.executeDocumentSearchStrategy(
        documents,
        query,
        queryIntent,
        strategy
      );
      
      // Merge results
      strategyResults.forEach(result => {
        const existing = results.get(result.id) || { ...result, scores: {} };
        existing.scores[strategy.name] = result.score * strategy.weight;
        results.set(result.id, existing);
      });
    }
    
    // Calculate combined scores
    return Array.from(results.values()).map(result => ({
      ...result,
      finalScore: Object.values(result.scores).reduce((a, b) => a + b, 0)
    }));
  }

  // Learning module
  initializeLearningModule() {
    return {
      vectorizationHistory: new Map(),
      searchHistory: new Map(),
      performanceMetrics: new Map(),
      adaptationRules: new Map(),
      
      recordVectorization: (text, embedding, context) => {
        const record = {
          timestamp: Date.now(),
          textHash: this.hashText(text),
          embeddingQuality: this.assessEmbeddingQuality(embedding, context),
          context,
          usage: []
        };
        this.learningModule.vectorizationHistory.set(record.textHash, record);
      },
      
      recordSearch: (query, results) => {
        const record = {
          timestamp: Date.now(),
          query,
          resultCount: results.results.length,
          avgConfidence: results.results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.results.length,
          userInteraction: null // Will be updated based on user actions
        };
        this.learningModule.searchHistory.set(query, record);
      },
      
      adapt: async () => {
        // Analyze recent performance
        const recentVectorizations = Array.from(this.learningModule.vectorizationHistory.values())
          .filter(v => Date.now() - v.timestamp < 86400000); // Last 24 hours
        
        const recentSearches = Array.from(this.learningModule.searchHistory.values())
          .filter(s => Date.now() - s.timestamp < 86400000);
        
        // Update agent thresholds based on performance
        if (recentVectorizations.length > 50) {
          const avgQuality = recentVectorizations.reduce((sum, v) => sum + v.embeddingQuality, 0) / recentVectorizations.length;
          
          if (avgQuality < 0.6) {
            // Increase quality thresholds
            this.agents.embedding.config.importanceThreshold += 0.05;
            console.log('📈 Increased importance threshold for better quality');
          } else if (avgQuality > 0.85) {
            // Can be less selective
            this.agents.embedding.config.importanceThreshold -= 0.05;
            console.log('📉 Decreased importance threshold for more coverage');
          }
        }
        
        // Adapt search strategies
        if (recentSearches.length > 20) {
          await this.agents.search.adaptStrategies();
        }
      }
    };
  }

  // Performance optimization
  updatePerformanceMetrics(operation, duration) {
    this.state.performance[operation + 'Count'] = (this.state.performance[operation + 'Count'] || 0) + 1;
    this.state.performance.avgResponseTime = 
      (this.state.performance.avgResponseTime * (this.state.performance[operation + 'Count'] - 1) + duration) /
      this.state.performance[operation + 'Count'];
  }

  // Helper methods
  async checkCache(text) {
    const cacheKey = this.hashText(text);
    try {
      const cached = await this.storageAdapter.getLocalData(`embedding_${cacheKey}`);
      if (cached && cached.embedding) {
        const age = Date.now() - cached.timestamp;
        const isValid = age < 7 * 24 * 60 * 60 * 1000; // 7 days
        return {
          valid: isValid,
          embedding: cached.embedding,
          age: age
        };
      }
    } catch (error) {
      console.log('Cache check failed:', error);
    }
    return { valid: false };
  }

  async generateOptimizedEmbedding(text, context) {
    // Pre-process text based on context
    const processedText = this.preprocessTextForContext(text, context);
    
    // Generate embedding
    const embedding = await this.embeddingService.generateEmbedding(processedText);
    
    // Post-process embedding based on requirements
    return this.postprocessEmbedding(embedding, context);
  }

  async handleVectorizationFailure(text, context) {
    console.log('📍 FALLBACK: TRYING LOCAL EMBEDDING');
    try {
      const embedding = await this.generateLocalEmbedding(text);
      console.log('✅ FALLBACK SUCCESSFUL - USING LOCAL EMBEDDING');
      return {
        vectorized: true,
        embedding,
        dimension: embedding.length,
        source: 'local_fallback'
      };
    } catch (error) {
      console.error('❌ FALLBACK ALSO FAILED');
      return {
        vectorized: false,
        reason: 'all_methods_failed',
        error: error.message
      };
    }
  }

  preprocessTextForContext(text, context) {
    let processed = text;
    
    // Add context-specific preprocessing
    if (context.isQuestion) {
      processed = `Question: ${processed}`;
    }
    if (context.isBusinessOpportunity) {
      processed = `Business opportunity: ${processed}`;
    }
    
    return processed;
  }

  postprocessEmbedding(embedding, context) {
    // Apply any necessary transformations
    if (context.normalize) {
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return embedding.map(val => val / norm);
    }
    
    return embedding;
  }

  generateLocalEmbedding(text) {
    // Enhanced local embedding generation
    const dimension = 768;
    const embedding = new Array(dimension).fill(0);
    
    // Use multiple feature extraction methods
    const features = [
      ...this.extractStatisticalFeatures(text),
      ...this.extractSemanticFeatures(text),
      ...this.extractStructuralFeatures(text)
    ];
    
    // Map features to embedding dimensions
    features.forEach((value, index) => {
      if (index < dimension) {
        embedding[index] = value;
      }
    });
    
    // Add some randomness for diversity
    for (let i = features.length; i < dimension; i++) {
      embedding[i] = (Math.random() - 0.5) * 0.1;
    }
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  extractStatisticalFeatures(text) {
    return [
      text.length / 1000,
      text.split(/\s+/).length / 100,
      new Set(text.split(/\s+/)).size / 100,
      (text.match(/[A-Z]/g) || []).length / text.length,
      (text.match(/\d/g) || []).length / text.length
    ];
  }

  extractSemanticFeatures(text) {
    const features = [];
    const semanticPatterns = [
      { pattern: /question|ask|how|why|what/i, weight: 1 },
      { pattern: /pay|buy|purchase|cost/i, weight: 1 },
      { pattern: /good|great|excellent|love/i, weight: 1 },
      { pattern: /bad|poor|hate|terrible/i, weight: -1 }
    ];
    
    semanticPatterns.forEach(({ pattern, weight }) => {
      features.push(pattern.test(text) ? weight : 0);
    });
    
    return features;
  }

  extractStructuralFeatures(text) {
    return [
      text.includes('?') ? 1 : 0,
      text.includes('!') ? 0.5 : 0,
      text.split(/[.!?]/).length / 10,
      Math.min(text.split(',').length / 5, 1)
    ];
  }

  resizeEmbedding(embedding, targetDimension) {
    if (embedding.length === targetDimension) return embedding;
    
    if (embedding.length < targetDimension) {
      // Pad with zeros
      return [...embedding, ...new Array(targetDimension - embedding.length).fill(0)];
    }
    
    // Reduce dimensions by averaging groups
    const ratio = embedding.length / targetDimension;
    const reduced = new Array(targetDimension);
    
    for (let i = 0; i < targetDimension; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);
      
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += embedding[j];
      }
      reduced[i] = sum / (end - start);
    }
    
    return reduced;
  }

  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  assessEmbeddingQuality(embedding, context) {
    // Assess quality based on various factors
    let quality = 0;
    
    // Check embedding properties
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0.9 && norm < 1.1) quality += 0.3;
    
    // Check diversity (not all zeros or same value)
    const uniqueValues = new Set(embedding).size;
    quality += Math.min(uniqueValues / 100, 0.3);
    
    // Context-based quality
    if (context.importance > 0.8) quality += 0.2;
    if (context.fromTrustedSource) quality += 0.2;
    
    return quality;
  }

  // Periodic adaptation
  async startAdaptation() {
    // Run adaptation every hour
    setInterval(async () => {
      console.log('🔄 Running autonomous adaptation...');
      await this.learningModule.adapt();
      await this.agents.embedding.updateAdaptiveThresholds();
      await this.agents.search.adaptStrategies();
    }, 3600000);
  }
}

// Export for Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutonomousVectorIntelligence;
} else {
  window.AutonomousVectorIntelligence = AutonomousVectorIntelligence;
}