// Intelligent Search Strategy Agent
// Makes autonomous decisions about search strategies and result ranking

class IntelligentSearchStrategyAgent {
  constructor(storageAdapter, embeddingAgent) {
    this.storageAdapter = storageAdapter;
    this.embeddingAgent = embeddingAgent;
    
    // Search strategy configuration
    this.strategies = {
      exact: { weight: 0.3, enabled: true },
      semantic: { weight: 0.4, enabled: true },
      contextual: { weight: 0.2, enabled: true },
      pattern: { weight: 0.1, enabled: true }
    };
    
    // Learning parameters
    this.searchHistory = new Map();
    this.strategyPerformance = new Map();
    this.queryIntentClassifier = this.initializeQueryClassifier();
    
    // Autonomous decision thresholds
    this.thresholds = {
      relevanceScore: 0.7,
      confidenceLevel: 0.8,
      maxResults: 20,
      semanticDepth: 3
    };
    
    // Context understanding
    this.contextWindow = {
      temporal: [], // Recent searches
      topical: [],  // Related topics
      behavioral: [] // User behavior patterns
    };
  }

  // Main autonomous search method
  async search(query, videoId, options = {}) {
    console.log('🔍 Intelligent Search Agent: Processing query:', query);
    
    // Step 1: Understand query intent
    const queryIntent = await this.analyzeQueryIntent(query);
    console.log('🎯 Query intent:', queryIntent);
    
    // Step 2: Select optimal search strategies
    const selectedStrategies = this.selectSearchStrategies(queryIntent, options);
    console.log('📋 Selected strategies:', selectedStrategies);
    
    // Step 3: Generate search embeddings
    const searchEmbeddings = await this.generateSearchEmbeddings(query, queryIntent);
    
    // Step 4: Execute multi-strategy search
    const searchResults = await this.executeMultiStrategySearch(
      query, 
      videoId, 
      searchEmbeddings, 
      selectedStrategies
    );
    
    // Step 5: Intelligent result ranking
    const rankedResults = await this.intelligentRanking(
      searchResults, 
      query, 
      queryIntent,
      searchEmbeddings
    );
    
    // Step 6: Learn from search
    this.recordSearchPerformance(query, queryIntent, rankedResults);
    
    // Step 7: Adapt strategies based on performance
    await this.adaptStrategies();
    
    return {
      results: rankedResults,
      intent: queryIntent,
      strategies: selectedStrategies,
      confidence: this.calculateSearchConfidence(rankedResults, queryIntent)
    };
  }

  // Analyze query intent using NLP-like techniques
  async analyzeQueryIntent(query) {
    const intent = {
      type: 'unknown',
      entities: [],
      sentiment: 'neutral',
      complexity: 'simple',
      expectedResultType: 'general',
      confidence: 0
    };
    
    // Classify query type
    const classifications = {
      business: /pay|buy|purchase|cost|price|monetize|sell|offer/i,
      technical: /how|tutorial|guide|implement|code|fix|solve|debug/i,
      opinion: /think|feel|opinion|believe|best|worst|recommend/i,
      factual: /what|when|where|who|why|which|define|explain/i,
      comparison: /vs|versus|compare|difference|better|worse/i,
      emotional: /love|hate|angry|happy|sad|frustrated|excited/i
    };
    
    // Detect primary intent
    let maxScore = 0;
    for (const [type, pattern] of Object.entries(classifications)) {
      const matches = query.match(pattern);
      if (matches) {
        const score = matches.length / query.split(/\s+/).length;
        if (score > maxScore) {
          maxScore = score;
          intent.type = type;
        }
      }
    }
    
    // Extract entities (key terms)
    intent.entities = this.extractEntities(query);
    
    // Analyze sentiment
    intent.sentiment = this.analyzeSentiment(query);
    
    // Determine complexity
    intent.complexity = this.analyzeComplexity(query);
    
    // Predict expected result type
    intent.expectedResultType = this.predictResultType(intent.type, query);
    
    // Calculate confidence
    intent.confidence = this.calculateIntentConfidence(intent, query);
    
    // Use historical data to refine intent
    intent.refined = await this.refineIntentWithHistory(query, intent);
    
    return intent;
  }

  // Select optimal search strategies based on intent
  selectSearchStrategies(queryIntent, options) {
    const selected = [];
    
    // Base strategy selection on intent type
    const strategyMap = {
      business: ['semantic', 'pattern', 'contextual'],
      technical: ['exact', 'semantic', 'pattern'],
      opinion: ['semantic', 'contextual'],
      factual: ['exact', 'semantic'],
      comparison: ['semantic', 'contextual', 'pattern'],
      emotional: ['semantic', 'contextual']
    };
    
    const recommendedStrategies = strategyMap[queryIntent.type] || ['semantic', 'exact'];
    
    // Adjust based on performance history
    recommendedStrategies.forEach(strategy => {
      const performance = this.getStrategyPerformance(strategy, queryIntent.type);
      
      if (performance.successRate > 0.6) {
        selected.push({
          name: strategy,
          weight: this.strategies[strategy].weight * performance.boost,
          config: this.getStrategyConfig(strategy, queryIntent)
        });
      }
    });
    
    // Add adaptive strategies based on context
    if (this.contextWindow.temporal.length > 0) {
      const contextualBoost = this.calculateContextualRelevance(queryIntent);
      if (contextualBoost > 0.3) {
        selected.push({
          name: 'contextual',
          weight: 0.3,
          config: { useTemporalContext: true, boost: contextualBoost }
        });
      }
    }
    
    return selected;
  }

  // Generate multiple embeddings for comprehensive search
  async generateSearchEmbeddings(query, intent) {
    const embeddings = {
      direct: null,
      expanded: [],
      contextual: []
    };
    
    // Direct embedding of the query
    const shouldEmbed = await this.embeddingAgent.shouldCreateEmbedding(query, {
      isSearch: true,
      intent: intent.type
    });
    
    if (shouldEmbed.shouldEmbed) {
      embeddings.direct = await this.embeddingAgent.embeddingService.generateEmbedding(query);
    }
    
    // Expanded query embeddings (synonyms, related terms)
    const expansions = this.expandQuery(query, intent);
    for (const expansion of expansions.slice(0, 3)) { // Limit to 3 expansions
      const expEmbedding = await this.embeddingAgent.embeddingService.generateEmbedding(expansion);
      embeddings.expanded.push({ text: expansion, embedding: expEmbedding });
    }
    
    // Contextual embeddings (based on recent searches)
    if (this.contextWindow.temporal.length > 0) {
      const contextQuery = this.buildContextualQuery(query, intent);
      const ctxEmbedding = await this.embeddingAgent.embeddingService.generateEmbedding(contextQuery);
      embeddings.contextual.push({ text: contextQuery, embedding: ctxEmbedding });
    }
    
    return embeddings;
  }

  // Execute multi-strategy search
  async executeMultiStrategySearch(query, videoId, embeddings, strategies) {
    const results = {
      exact: [],
      semantic: [],
      contextual: [],
      pattern: []
    };
    
    // Execute each strategy in parallel
    const searchPromises = strategies.map(async (strategy) => {
      switch (strategy.name) {
        case 'exact':
          results.exact = await this.exactMatchSearch(query, videoId, strategy.config);
          break;
          
        case 'semantic':
          results.semantic = await this.semanticSearch(embeddings, videoId, strategy.config);
          break;
          
        case 'contextual':
          results.contextual = await this.contextualSearch(query, embeddings, videoId, strategy.config);
          break;
          
        case 'pattern':
          results.pattern = await this.patternBasedSearch(query, videoId, strategy.config);
          break;
      }
    });
    
    await Promise.all(searchPromises);
    
    return results;
  }

  // Semantic search using embeddings
  async semanticSearch(embeddings, videoId, config) {
    const results = [];
    
    // Search with direct embedding
    if (embeddings.direct) {
      const directResults = await this.storageAdapter.searchSimilarComments(
        embeddings.direct,
        videoId,
        config.threshold || 0.75,
        config.limit || 20
      );
      results.push(...directResults.map(r => ({ ...r, source: 'direct' })));
    }
    
    // Search with expanded embeddings
    for (const expansion of embeddings.expanded) {
      const expandedResults = await this.storageAdapter.searchSimilarComments(
        expansion.embedding,
        videoId,
        (config.threshold || 0.75) * 0.9, // Slightly lower threshold for expansions
        config.limit || 10
      );
      results.push(...expandedResults.map(r => ({ 
        ...r, 
        source: 'expanded',
        expansion: expansion.text 
      })));
    }
    
    // Deduplicate and merge scores
    const merged = this.mergeSemanticResults(results);
    
    return merged;
  }

  // Contextual search considering user's search context
  async contextualSearch(query, embeddings, videoId, config) {
    const results = [];
    
    // Get recent search context
    const recentContext = this.contextWindow.temporal.slice(-5);
    const topicalContext = this.contextWindow.topical.slice(-3);
    
    // Build context-aware query
    const contextFeatures = {
      recentTerms: recentContext.flatMap(ctx => ctx.entities),
      topics: topicalContext,
      userIntent: this.inferUserGoal(recentContext)
    };
    
    // Search with contextual embeddings
    for (const ctxEmbed of embeddings.contextual) {
      const contextualResults = await this.storageAdapter.searchSimilarComments(
        ctxEmbed.embedding,
        videoId,
        config.threshold || 0.7,
        config.limit || 15
      );
      
      // Boost results that align with context
      const boostedResults = contextualResults.map(result => {
        const contextScore = this.calculateContextAlignment(result, contextFeatures);
        return {
          ...result,
          similarity_score: result.similarity_score * (1 + contextScore * 0.3),
          source: 'contextual',
          contextScore
        };
      });
      
      results.push(...boostedResults);
    }
    
    return results;
  }

  // Pattern-based search for specific patterns
  async patternBasedSearch(query, videoId, config) {
    // Identify patterns in query
    const patterns = this.identifyPatterns(query);
    const results = [];
    
    for (const pattern of patterns) {
      const patternResults = await this.storageAdapter.findPatternMatches(
        videoId,
        pattern.type
      );
      
      results.push(...patternResults.map(r => ({
        ...r,
        source: 'pattern',
        patternType: pattern.type,
        patternConfidence: pattern.confidence
      })));
    }
    
    return results;
  }

  // Intelligent ranking of results
  async intelligentRanking(searchResults, query, queryIntent, embeddings) {
    // Combine all results
    const allResults = [
      ...searchResults.exact,
      ...searchResults.semantic,
      ...searchResults.contextual,
      ...searchResults.pattern
    ];
    
    // Calculate comprehensive scores
    const scoredResults = await Promise.all(
      allResults.map(async (result) => {
        const scores = {
          relevance: this.calculateRelevanceScore(result, query, queryIntent),
          quality: this.assessResultQuality(result),
          diversity: this.calculateDiversityScore(result, allResults),
          recency: this.calculateRecencyScore(result),
          engagement: this.calculateEngagementScore(result),
          contextual: result.contextScore || 0
        };
        
        // Weighted final score based on intent
        const weights = this.getScoreWeights(queryIntent);
        const finalScore = Object.entries(scores).reduce(
          (sum, [key, score]) => sum + score * (weights[key] || 0.1),
          0
        );
        
        return {
          ...result,
          scores,
          finalScore,
          explanation: this.generateScoreExplanation(scores, weights)
        };
      })
    );
    
    // Sort by final score
    scoredResults.sort((a, b) => b.finalScore - a.finalScore);
    
    // Apply diversity filter
    const diverseResults = this.ensureDiversity(scoredResults, queryIntent);
    
    // Limit results
    const topResults = diverseResults.slice(0, this.thresholds.maxResults);
    
    // Add result metadata
    return topResults.map((result, index) => ({
      ...result,
      rank: index + 1,
      confidence: this.calculateResultConfidence(result, queryIntent),
      snippet: this.generateSnippet(result.comment_text, query)
    }));
  }

  // Calculate relevance score
  calculateRelevanceScore(result, query, intent) {
    let score = 0;
    
    // Semantic similarity score (if available)
    if (result.similarity_score) {
      score += result.similarity_score * 0.4;
    }
    
    // Keyword overlap
    const queryTerms = new Set(query.toLowerCase().split(/\s+/));
    const resultTerms = new Set(result.comment_text.toLowerCase().split(/\s+/));
    const overlap = [...queryTerms].filter(term => resultTerms.has(term)).length;
    score += (overlap / queryTerms.size) * 0.3;
    
    // Intent alignment
    const intentAlignment = this.checkIntentAlignment(result, intent);
    score += intentAlignment * 0.3;
    
    return Math.min(1, score);
  }

  // Assess result quality
  assessResultQuality(result) {
    let quality = 0;
    
    // Text quality
    const textLength = result.comment_text.length;
    quality += Math.min(textLength / 200, 1) * 0.3;
    
    // Information density
    const uniqueWords = new Set(result.comment_text.split(/\s+/)).size;
    const totalWords = result.comment_text.split(/\s+/).length;
    quality += (uniqueWords / totalWords) * 0.3;
    
    // Engagement quality
    if (result.engagement_metrics) {
      const engagementScore = (result.engagement_metrics.likes || 0) / 100;
      quality += Math.min(engagementScore, 1) * 0.2;
    }
    
    // Sentiment clarity
    if (result.sentiment_score !== undefined) {
      quality += Math.abs(result.sentiment_score) * 0.2;
    }
    
    return quality;
  }

  // Ensure diversity in results
  ensureDiversity(results, intent) {
    const selected = [];
    const seenAuthors = new Set();
    const seenTopics = new Set();
    
    for (const result of results) {
      // Skip if we already have results from this author
      if (seenAuthors.has(result.author) && selected.length > 5) {
        continue;
      }
      
      // Extract main topic
      const topic = this.extractMainTopic(result.comment_text);
      
      // Skip if topic is too similar to existing
      if (seenTopics.has(topic) && selected.length > 10) {
        continue;
      }
      
      selected.push(result);
      seenAuthors.add(result.author);
      seenTopics.add(topic);
      
      if (selected.length >= this.thresholds.maxResults) {
        break;
      }
    }
    
    return selected;
  }

  // Learning and adaptation
  recordSearchPerformance(query, intent, results) {
    const performance = {
      query,
      intent,
      timestamp: Date.now(),
      resultCount: results.length,
      avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      topScore: results[0]?.finalScore || 0
    };
    
    // Record in search history
    this.searchHistory.set(query, performance);
    
    // Update strategy performance
    const strategies = new Set(results.map(r => r.source));
    strategies.forEach(strategy => {
      const current = this.strategyPerformance.get(strategy) || {
        uses: 0,
        successes: 0,
        avgScore: 0
      };
      
      current.uses++;
      if (performance.avgConfidence > 0.7) current.successes++;
      current.avgScore = (current.avgScore * (current.uses - 1) + performance.topScore) / current.uses;
      
      this.strategyPerformance.set(strategy, current);
    });
    
    // Update context windows
    this.updateContextWindows(query, intent, results);
  }

  async adaptStrategies() {
    // Analyze recent performance
    const recentSearches = Array.from(this.searchHistory.values())
      .filter(s => Date.now() - s.timestamp < 3600000); // Last hour
    
    if (recentSearches.length < 10) return;
    
    // Calculate strategy effectiveness
    this.strategyPerformance.forEach((perf, strategy) => {
      const successRate = perf.successes / perf.uses;
      
      // Adjust strategy weights
      if (successRate > 0.8) {
        this.strategies[strategy].weight = Math.min(0.5, this.strategies[strategy].weight * 1.1);
      } else if (successRate < 0.4) {
        this.strategies[strategy].weight = Math.max(0.1, this.strategies[strategy].weight * 0.9);
      }
    });
    
    // Normalize weights
    const totalWeight = Object.values(this.strategies).reduce((sum, s) => sum + s.weight, 0);
    Object.keys(this.strategies).forEach(key => {
      this.strategies[key].weight /= totalWeight;
    });
    
    console.log('📊 Adapted strategy weights:', this.strategies);
  }

  // Helper methods
  extractEntities(query) {
    // Simple entity extraction
    const words = query.split(/\s+/);
    const entities = [];
    
    // Look for capitalized words (potential proper nouns)
    words.forEach(word => {
      if (word.length > 2 && word[0] === word[0].toUpperCase()) {
        entities.push({ text: word, type: 'proper_noun' });
      }
    });
    
    // Look for numbers
    const numbers = query.match(/\d+/g);
    if (numbers) {
      numbers.forEach(num => entities.push({ text: num, type: 'number' }));
    }
    
    // Look for quoted strings
    const quoted = query.match(/"([^"]+)"/g);
    if (quoted) {
      quoted.forEach(q => entities.push({ text: q.replace(/"/g, ''), type: 'quoted' }));
    }
    
    return entities;
  }

  analyzeSentiment(query) {
    const positive = /good|great|love|best|awesome|excellent/i;
    const negative = /bad|hate|worst|terrible|awful|poor/i;
    
    if (positive.test(query)) return 'positive';
    if (negative.test(query)) return 'negative';
    return 'neutral';
  }

  analyzeComplexity(query) {
    const words = query.split(/\s+/);
    if (words.length < 3) return 'simple';
    if (words.length > 10) return 'complex';
    if (query.includes(' AND ') || query.includes(' OR ')) return 'complex';
    return 'moderate';
  }

  expandQuery(query, intent) {
    const expansions = [];
    
    // Synonym expansion
    const synonymMap = {
      'tutorial': ['guide', 'how-to', 'lesson', 'course'],
      'problem': ['issue', 'error', 'bug', 'trouble'],
      'good': ['great', 'excellent', 'best', 'awesome'],
      'bad': ['poor', 'terrible', 'worst', 'awful']
    };
    
    const words = query.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (synonymMap[word]) {
        synonymMap[word].forEach(synonym => {
          expansions.push(query.replace(new RegExp(word, 'gi'), synonym));
        });
      }
    });
    
    // Intent-based expansion
    if (intent.type === 'business') {
      expansions.push(query + ' monetization');
      expansions.push(query + ' business opportunity');
    }
    
    return [...new Set(expansions)].slice(0, 5);
  }

  getStrategyPerformance(strategy, intentType) {
    const key = `${strategy}_${intentType}`;
    const perf = this.strategyPerformance.get(key) || {
      uses: 0,
      successes: 0,
      avgScore: 0.5,
      boost: 1.0
    };
    
    perf.successRate = perf.uses > 0 ? perf.successes / perf.uses : 0.5;
    perf.boost = 0.5 + perf.successRate * 0.5;
    
    return perf;
  }

  mergeSemanticResults(results) {
    const merged = new Map();
    
    results.forEach(result => {
      const key = result.comment_id;
      if (merged.has(key)) {
        const existing = merged.get(key);
        existing.similarity_score = Math.max(existing.similarity_score, result.similarity_score);
        existing.sources = [...(existing.sources || []), result.source];
      } else {
        merged.set(key, { ...result, sources: [result.source] });
      }
    });
    
    return Array.from(merged.values());
  }

  generateSnippet(text, query) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const sentences = text.split(/[.!?]+/);
    
    // Find most relevant sentence
    let bestSentence = sentences[0] || text;
    let maxRelevance = 0;
    
    sentences.forEach(sentence => {
      const relevance = queryTerms.filter(term => 
        sentence.toLowerCase().includes(term)
      ).length;
      
      if (relevance > maxRelevance) {
        maxRelevance = relevance;
        bestSentence = sentence;
      }
    });
    
    // Trim to reasonable length
    if (bestSentence.length > 150) {
      return bestSentence.substring(0, 147) + '...';
    }
    
    return bestSentence.trim();
  }

  updateContextWindows(query, intent, results) {
    // Update temporal context
    this.contextWindow.temporal.push({
      query,
      intent,
      timestamp: Date.now(),
      entities: intent.entities
    });
    
    // Keep only recent context
    this.contextWindow.temporal = this.contextWindow.temporal
      .filter(ctx => Date.now() - ctx.timestamp < 600000) // 10 minutes
      .slice(-10);
    
    // Update topical context
    if (results.length > 0) {
      const topics = results.slice(0, 3).map(r => 
        this.extractMainTopic(r.comment_text)
      );
      this.contextWindow.topical.push(...topics);
      this.contextWindow.topical = [...new Set(this.contextWindow.topical)].slice(-10);
    }
  }

  extractMainTopic(text) {
    // Simple topic extraction - in production, use NLP
    const words = text.toLowerCase().split(/\s+/)
      .filter(w => w.length > 4)
      .filter(w => !this.isStopWord(w));
    
    return words.slice(0, 3).join(' ');
  }

  isStopWord(word) {
    const stopWords = ['this', 'that', 'these', 'those', 'very', 'really', 'just'];
    return stopWords.includes(word);
  }
}

// Export for Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IntelligentSearchStrategyAgent;
} else {
  window.IntelligentSearchStrategyAgent = IntelligentSearchStrategyAgent;
}