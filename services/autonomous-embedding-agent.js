// Autonomous Embedding Agent
// Makes intelligent decisions about text vectorization and embedding management

class AutonomousEmbeddingAgent {
  constructor(embeddingService, storageAdapter) {
    this.embeddingService = embeddingService;
    this.storageAdapter = storageAdapter;
    
    // Autonomous decision parameters
    this.config = {
      // Embedding generation thresholds
      minTextLength: 20,           // Don't embed very short texts
      maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      importanceThreshold: 0.7,    // Importance score to decide embedding
      
      // Resource management
      apiQuota: {
        daily: 1000000,           // 1M tokens per day
        hourly: 50000,            // 50k tokens per hour
        minute: 3000              // 3k requests per minute
      },
      currentUsage: {
        daily: 0,
        hourly: 0,
        minute: 0,
        lastReset: {
          daily: Date.now(),
          hourly: Date.now(),
          minute: Date.now()
        }
      },
      
      // Learning parameters
      searchPatterns: new Map(),   // Track what users search for
      embeddingQuality: new Map(), // Track embedding effectiveness
      adaptiveThresholds: {
        importance: 0.7,
        similarity: 0.75,
        cacheHitTarget: 0.8
      }
    };
    
    // Initialize learning system
    this.initializeLearningSystem();
  }

  // MAIN AUTONOMOUS DECISION: Should we create an embedding?
  async shouldCreateEmbedding(text, context = {}) {
    console.log('🤖 Autonomous Embedding Agent: Analyzing embedding decision...');
    console.log('📝 Text preview:', text.substring(0, 50) + '...');
    
    // Decision factors
    const factors = {
      textQuality: this.assessTextQuality(text),
      importance: this.calculateImportance(text, context),
      resourceAvailability: await this.checkResourceAvailability(),
      cacheStatus: await this.checkCacheStatus(text),
      userIntent: this.predictUserIntent(context),
      costBenefit: this.calculateCostBenefit(text, context)
    };
    
    // Autonomous decision making
    const decision = this.makeEmbeddingDecision(factors);
    
    console.log('📊 Decision factors:', factors);
    
    // Clear logging for API call decision
    if (decision.shouldEmbed) {
      console.log('✅ WILL CREATE EMBEDDING - Reason:', decision.reason);
      console.log('🌐 API CALL WILL BE MADE to:', this.embeddingService.provider || 'local');
      if (this.embeddingService.apiUrl) {
        console.log('🔑 Using API:', this.embeddingService.apiUrl);
      } else {
        console.log('💾 Using LOCAL embedding generation (no API call)');
      }
    } else {
      console.log('❌ WILL NOT CREATE EMBEDDING - Reason:', decision.reason);
      console.log('🚫 NO API CALL - Saving resources');
      if (factors.cacheStatus.cached) {
        console.log('📦 Using CACHED embedding from local storage');
      }
    }
    
    console.log(`🎯 Decision confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    
    // Learn from decision
    this.recordDecision(text, context, decision, factors);
    
    return decision;
  }

  // Assess text quality for embedding worthiness
  assessTextQuality(text) {
    const quality = {
      length: text.length,
      wordCount: text.split(/\s+/).length,
      uniqueWords: new Set(text.toLowerCase().split(/\s+/)).size,
      informationDensity: 0,
      languageQuality: 0,
      score: 0
    };
    
    // Calculate information density
    quality.informationDensity = quality.uniqueWords / Math.max(1, quality.wordCount);
    
    // Assess language quality
    const qualityIndicators = {
      hasQuestions: /\?/.test(text),
      hasNumbers: /\d/.test(text),
      hasUrls: /https?:\/\//.test(text),
      hasTechnicalTerms: this.detectTechnicalTerms(text),
      sentenceStructure: this.analyzeSentenceStructure(text)
    };
    
    quality.languageQuality = Object.values(qualityIndicators).filter(v => v).length / 5;
    
    // Calculate overall quality score (0-1)
    quality.score = (
      (Math.min(quality.length, 500) / 500) * 0.2 +              // Length factor
      (Math.min(quality.wordCount, 50) / 50) * 0.2 +            // Word count factor
      quality.informationDensity * 0.3 +                         // Information density
      quality.languageQuality * 0.3                              // Language quality
    );
    
    return quality;
  }

  // Calculate importance of text for embedding
  calculateImportance(text, context) {
    let importance = 0;
    
    // Context-based importance
    if (context.isBusinessOpportunity) importance += 0.3;
    if (context.isQuestion) importance += 0.2;
    if (context.hasHighEngagement) importance += 0.2;
    if (context.isFromVerifiedUser) importance += 0.1;
    if (context.isControversial) importance += 0.2;
    
    // Content-based importance
    const importantPatterns = [
      { pattern: /pay|buy|purchase|cost|price/i, weight: 0.3 },
      { pattern: /tutorial|guide|how|learn|teach/i, weight: 0.25 },
      { pattern: /problem|issue|bug|error|fix/i, weight: 0.2 },
      { pattern: /love|hate|best|worst/i, weight: 0.15 },
      { pattern: /\?|help|please|need/i, weight: 0.2 }
    ];
    
    importantPatterns.forEach(({ pattern, weight }) => {
      if (pattern.test(text)) {
        importance += weight;
      }
    });
    
    // Engagement-based importance
    if (context.likes > 100) importance += 0.2;
    if (context.replies > 5) importance += 0.15;
    
    // Learn from past searches
    const searchRelevance = this.calculateSearchRelevance(text);
    importance += searchRelevance * 0.3;
    
    return Math.min(1, importance);
  }

  // Check resource availability
  async checkResourceAvailability() {
    this.updateUsageCounters();
    
    const usage = this.config.currentUsage;
    const quota = this.config.apiQuota;
    
    const availability = {
      daily: 1 - (usage.daily / quota.daily),
      hourly: 1 - (usage.hourly / quota.hourly),
      minute: 1 - (usage.minute / quota.minute),
      overall: 0
    };
    
    // Calculate overall availability (weighted)
    availability.overall = 
      availability.daily * 0.5 +
      availability.hourly * 0.3 +
      availability.minute * 0.2;
    
    // Check if we're approaching limits
    if (availability.minute < 0.1) {
      console.warn('⚠️ Approaching rate limit, will throttle');
      await this.throttle();
    }
    
    return availability;
  }

  // Intelligent cache checking
  async checkCacheStatus(text) {
    // Generate cache key
    const cacheKey = this.generateCacheKey(text);
    
    // Check if we have a cached embedding
    const cached = await this.storageAdapter.getLocalData(`embedding_${cacheKey}`);
    
    if (!cached) {
      return { cached: false, age: null, quality: null };
    }
    
    const age = Date.now() - cached.timestamp;
    const quality = cached.metadata?.quality || 0.5;
    
    // Assess if cache is still valid
    const isValid = age < this.config.maxCacheAge && quality > 0.7;
    
    return {
      cached: true,
      age,
      quality,
      isValid,
      shouldRefresh: !isValid || (age > this.config.maxCacheAge * 0.7 && quality < 0.9)
    };
  }

  // Predict user intent to optimize embeddings
  predictUserIntent(context) {
    const intent = {
      searchingBusinessOpportunities: false,
      analyzingSentiment: false,
      findingSimilar: false,
      identifyingPatterns: false,
      confidence: 0
    };
    
    // Analyze recent search patterns
    const recentSearches = Array.from(this.config.searchPatterns.entries())
      .filter(([_, data]) => Date.now() - data.timestamp < 3600000) // Last hour
      .map(([query, data]) => data);
    
    if (recentSearches.length > 0) {
      // Detect patterns in searches
      const searchTypes = recentSearches.map(s => s.type);
      intent.searchingBusinessOpportunities = searchTypes.filter(t => t === 'business').length > 2;
      intent.analyzingSentiment = searchTypes.filter(t => t === 'sentiment').length > 2;
      intent.findingSimilar = searchTypes.filter(t => t === 'similarity').length > 2;
      intent.identifyingPatterns = searchTypes.filter(t => t === 'pattern').length > 2;
      
      intent.confidence = Math.min(recentSearches.length / 10, 1);
    }
    
    return intent;
  }

  // Calculate cost-benefit ratio
  calculateCostBenefit(text, context) {
    // Costs
    const tokenCount = this.estimateTokens(text);
    const apiCost = tokenCount * 0.0001 / 1000; // $0.0001 per 1k tokens
    const timeCost = 0.2; // 200ms average
    
    // Benefits
    const benefits = {
      searchImprovement: context.importance * 0.5,
      userSatisfaction: this.estimateUserSatisfaction(context),
      learningValue: this.calculateLearningValue(text, context),
      reusability: this.estimateReusability(text, context)
    };
    
    const totalBenefit = Object.values(benefits).reduce((a, b) => a + b, 0);
    const totalCost = apiCost + (timeCost / 1000); // Normalize time cost
    
    return {
      ratio: totalBenefit / Math.max(0.001, totalCost),
      benefits,
      costs: { api: apiCost, time: timeCost },
      recommendation: totalBenefit > totalCost * 2 ? 'embed' : 'skip'
    };
  }

  // Make the final embedding decision
  makeEmbeddingDecision(factors) {
    // Multi-factor decision making
    const weights = {
      textQuality: 0.2,
      importance: 0.3,
      resourceAvailability: 0.15,
      cacheStatus: 0.15,
      costBenefit: 0.2
    };
    
    // Calculate weighted score
    let score = 0;
    score += factors.textQuality.score * weights.textQuality;
    score += factors.importance * weights.importance;
    score += factors.resourceAvailability.overall * weights.resourceAvailability;
    score += (factors.cacheStatus.cached && factors.cacheStatus.isValid ? 0 : 1) * weights.cacheStatus;
    score += Math.min(factors.costBenefit.ratio / 10, 1) * weights.costBenefit;
    
    // Adaptive threshold based on learning
    const threshold = this.config.adaptiveThresholds.importance;
    
    // Special cases
    if (factors.cacheStatus.cached && factors.cacheStatus.isValid && !factors.cacheStatus.shouldRefresh) {
      return { shouldEmbed: false, confidence: 0.9, reason: 'valid_cache' };
    }
    
    if (factors.resourceAvailability.minute < 0.05) {
      return { shouldEmbed: false, confidence: 0.95, reason: 'rate_limit' };
    }
    
    if (factors.textQuality.length < this.config.minTextLength) {
      return { shouldEmbed: false, confidence: 0.9, reason: 'too_short' };
    }
    
    // Main decision
    const shouldEmbed = score >= threshold;
    const confidence = shouldEmbed ? score : (1 - score);
    
    return {
      shouldEmbed,
      confidence,
      score,
      reason: this.getDecisionReason(factors, score),
      factors
    };
  }

  // Smart batch processing
  async processBatch(texts, contexts = []) {
    console.log(`🎯 Processing batch of ${texts.length} texts`);
    
    // Group by importance and quality
    const groups = {
      high: [],
      medium: [],
      low: []
    };
    
    for (let i = 0; i < texts.length; i++) {
      const decision = await this.shouldCreateEmbedding(texts[i], contexts[i] || {});
      
      if (decision.shouldEmbed) {
        if (decision.score > 0.8) groups.high.push({ text: texts[i], index: i });
        else if (decision.score > 0.6) groups.medium.push({ text: texts[i], index: i });
        else groups.low.push({ text: texts[i], index: i });
      }
    }
    
    // Process groups with different strategies
    const results = new Array(texts.length).fill(null);
    
    // High priority: Process immediately
    if (groups.high.length > 0) {
      const embeddings = await this.embeddingService.generateBatchEmbeddings(
        groups.high.map(g => g.text)
      );
      groups.high.forEach((g, i) => {
        results[g.index] = embeddings[i];
      });
    }
    
    // Medium priority: Process with rate limiting
    if (groups.medium.length > 0) {
      await this.throttle(100); // Small delay
      const embeddings = await this.embeddingService.generateBatchEmbeddings(
        groups.medium.map(g => g.text)
      );
      groups.medium.forEach((g, i) => {
        results[g.index] = embeddings[i];
      });
    }
    
    // Low priority: Consider skipping or deferring
    if (groups.low.length > 0 && this.config.currentUsage.hourly < this.config.apiQuota.hourly * 0.8) {
      const embeddings = await this.embeddingService.generateBatchEmbeddings(
        groups.low.map(g => g.text)
      );
      groups.low.forEach((g, i) => {
        results[g.index] = embeddings[i];
      });
    }
    
    return results;
  }

  // Learning system
  initializeLearningSystem() {
    // Load historical data
    this.loadHistoricalData();
    
    // Set up periodic learning
    setInterval(() => {
      this.updateAdaptiveThresholds();
      this.pruneOldData();
    }, 3600000); // Every hour
  }

  async loadHistoricalData() {
    try {
      const data = await this.storageAdapter.getLocalData('embedding_agent_history');
      if (data) {
        this.config.searchPatterns = new Map(data.searchPatterns || []);
        this.config.embeddingQuality = new Map(data.embeddingQuality || []);
        this.config.adaptiveThresholds = data.adaptiveThresholds || this.config.adaptiveThresholds;
      }
    } catch (error) {
      console.error('Failed to load historical data:', error);
    }
  }

  recordDecision(text, context, decision, factors) {
    const record = {
      timestamp: Date.now(),
      textHash: this.hashText(text),
      context,
      decision,
      factors,
      outcome: null // Will be updated when we see search results
    };
    
    // Store for learning
    this.config.embeddingQuality.set(record.textHash, record);
    
    // Persist periodically
    this.persistLearningData();
  }

  updateAdaptiveThresholds() {
    // Analyze recent decisions and outcomes
    const recentDecisions = Array.from(this.config.embeddingQuality.values())
      .filter(d => Date.now() - d.timestamp < 86400000); // Last 24 hours
    
    if (recentDecisions.length < 10) return;
    
    // Calculate success metrics
    const successfulEmbeddings = recentDecisions.filter(d => 
      d.decision.shouldEmbed && d.outcome?.wasUseful
    );
    const unnecessaryEmbeddings = recentDecisions.filter(d =>
      d.decision.shouldEmbed && !d.outcome?.wasUseful
    );
    
    const successRate = successfulEmbeddings.length / Math.max(1, recentDecisions.length);
    
    // Adjust thresholds
    if (successRate < 0.7) {
      // Too many unnecessary embeddings, increase threshold
      this.config.adaptiveThresholds.importance = Math.min(0.9, this.config.adaptiveThresholds.importance + 0.05);
    } else if (successRate > 0.9) {
      // Very high success, can be less selective
      this.config.adaptiveThresholds.importance = Math.max(0.5, this.config.adaptiveThresholds.importance - 0.05);
    }
    
    console.log(`📈 Updated importance threshold to ${this.config.adaptiveThresholds.importance} (success rate: ${successRate})`);
  }

  // Utility methods
  estimateTokens(text) {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  detectTechnicalTerms(text) {
    const technicalTerms = /API|SDK|JSON|HTML|CSS|JavaScript|Python|database|algorithm|function|variable/i;
    return technicalTerms.test(text);
  }

  analyzeSentenceStructure(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.length > 1 && sentences.some(s => s.split(/\s+/).length > 5);
  }

  calculateSearchRelevance(text) {
    // Check how often similar texts were searched
    let relevance = 0;
    const textWords = new Set(text.toLowerCase().split(/\s+/));
    
    this.config.searchPatterns.forEach((pattern, query) => {
      const queryWords = new Set(query.toLowerCase().split(/\s+/));
      const overlap = [...textWords].filter(w => queryWords.has(w)).length;
      const similarity = overlap / Math.max(textWords.size, queryWords.size);
      
      if (similarity > 0.5) {
        relevance += pattern.count * similarity;
      }
    });
    
    return Math.min(1, relevance / 10);
  }

  estimateUserSatisfaction(context) {
    // Based on engagement metrics
    const engagement = (context.likes || 0) / 100 + (context.replies || 0) / 10;
    return Math.min(1, engagement);
  }

  calculateLearningValue(text, context) {
    // How much will this embedding help the system learn?
    const uniqueness = 1 - this.calculateSimilarityToExisting(text);
    const contextRichness = Object.keys(context).length / 10;
    
    return (uniqueness + contextRichness) / 2;
  }

  estimateReusability(text, context) {
    // How likely is this embedding to be searched again?
    const generalityScore = this.calculateGenerality(text);
    const popularityScore = (context.likes || 0) / 1000;
    
    return Math.min(1, generalityScore + popularityScore);
  }

  calculateSimilarityToExisting(text) {
    // Simplified: check against recent embeddings
    // In production, would do actual vector similarity
    return 0.3; // Placeholder
  }

  calculateGenerality(text) {
    // General topics vs specific details
    const generalTerms = /tutorial|guide|how|what|why|best|tips/i;
    const specificTerms = /timestamp|episode|chapter|minute|second/i;
    
    const hasGeneral = generalTerms.test(text);
    const hasSpecific = specificTerms.test(text);
    
    if (hasGeneral && !hasSpecific) return 0.8;
    if (!hasGeneral && hasSpecific) return 0.2;
    return 0.5;
  }

  generateCacheKey(text) {
    return this.hashText(text.substring(0, 100));
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

  updateUsageCounters() {
    const now = Date.now();
    const usage = this.config.currentUsage;
    const lastReset = usage.lastReset;
    
    // Reset counters if needed
    if (now - lastReset.daily > 86400000) {
      usage.daily = 0;
      lastReset.daily = now;
    }
    if (now - lastReset.hourly > 3600000) {
      usage.hourly = 0;
      lastReset.hourly = now;
    }
    if (now - lastReset.minute > 60000) {
      usage.minute = 0;
      lastReset.minute = now;
    }
  }

  async throttle(ms = 200) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDecisionReason(factors, score) {
    if (factors.cacheStatus.cached && factors.cacheStatus.isValid) return 'valid_cache';
    if (factors.resourceAvailability.overall < 0.1) return 'low_resources';
    if (factors.textQuality.score < 0.3) return 'low_quality';
    if (factors.importance < 0.3) return 'low_importance';
    if (score > 0.8) return 'high_value';
    if (score > 0.6) return 'moderate_value';
    return 'marginal_value';
  }

  async persistLearningData() {
    try {
      const data = {
        searchPatterns: Array.from(this.config.searchPatterns.entries()),
        embeddingQuality: Array.from(this.config.embeddingQuality.entries()).slice(-1000), // Keep last 1000
        adaptiveThresholds: this.config.adaptiveThresholds
      };
      await this.storageAdapter.setLocalData('embedding_agent_history', data);
    } catch (error) {
      console.error('Failed to persist learning data:', error);
    }
  }

  pruneOldData() {
    // Remove old search patterns
    const cutoff = Date.now() - 7 * 86400000; // 7 days
    
    this.config.searchPatterns.forEach((data, key) => {
      if (data.timestamp < cutoff) {
        this.config.searchPatterns.delete(key);
      }
    });
    
    this.config.embeddingQuality.forEach((data, key) => {
      if (data.timestamp < cutoff) {
        this.config.embeddingQuality.delete(key);
      }
    });
  }

  // Public method to record search patterns
  recordSearch(query, type = 'general') {
    const existing = this.config.searchPatterns.get(query) || { count: 0, type, timestamp: Date.now() };
    existing.count++;
    existing.timestamp = Date.now();
    this.config.searchPatterns.set(query, existing);
  }

  // Public method to record embedding usage
  recordEmbeddingUsage(textHash, wasUseful) {
    const record = this.config.embeddingQuality.get(textHash);
    if (record) {
      record.outcome = { wasUseful, timestamp: Date.now() };
      this.config.embeddingQuality.set(textHash, record);
    }
  }
}

// Export for Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutonomousEmbeddingAgent;
} else {
  window.AutonomousEmbeddingAgent = AutonomousEmbeddingAgent;
}