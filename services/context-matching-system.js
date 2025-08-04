// Context Matching System
// Intelligently matches comments based on contextual understanding

class ContextMatchingSystem {
  constructor(storageAdapter, embeddingAgent, searchAgent) {
    this.storageAdapter = storageAdapter;
    this.embeddingAgent = embeddingAgent;
    this.searchAgent = searchAgent;
    
    // Context understanding models
    this.contextModels = {
      temporal: this.initializeTemporalModel(),
      conversational: this.initializeConversationalModel(),
      topical: this.initializeTopicalModel(),
      social: this.initializeSocialModel()
    };
    
    // Context cache for performance
    this.contextCache = new Map();
    this.maxCacheSize = 100;
    
    // Learning parameters
    this.matchingHistory = new Map();
    this.contextualPatterns = new Map();
    
    // Thresholds
    this.thresholds = {
      contextRelevance: 0.7,
      temporalWindow: 3600000, // 1 hour
      conversationalDepth: 5,
      topicalSimilarity: 0.8
    };
  }

  // Main context matching method
  async matchWithContext(query, candidates, videoContext) {
    console.log('🎯 Context Matching System: Processing contextual search');
    
    // Step 1: Build comprehensive context
    const fullContext = await this.buildFullContext(query, videoContext);
    
    // Step 2: Analyze contextual requirements
    const contextRequirements = this.analyzeContextualRequirements(query, fullContext);
    
    // Step 3: Score each candidate based on context
    const contextualScores = await Promise.all(
      candidates.map(async (candidate) => {
        const score = await this.scoreContextualMatch(
          candidate,
          query,
          fullContext,
          contextRequirements
        );
        return { ...candidate, contextualScore: score };
      })
    );
    
    // Step 4: Apply contextual filtering
    const filtered = this.applyContextualFilters(contextualScores, contextRequirements);
    
    // Step 5: Re-rank based on context
    const reranked = this.contextualReranking(filtered, fullContext);
    
    // Step 6: Learn from matching
    this.recordMatchingPerformance(query, reranked, fullContext);
    
    return {
      results: reranked,
      context: fullContext,
      requirements: contextRequirements
    };
  }

  // Build comprehensive context
  async buildFullContext(query, videoContext) {
    const context = {
      query: {
        text: query,
        entities: this.extractQueryEntities(query),
        intent: await this.searchAgent.analyzeQueryIntent(query),
        timestamp: Date.now()
      },
      video: {
        id: videoContext.videoId,
        title: videoContext.title,
        channel: videoContext.channel,
        publishDate: videoContext.publishDate,
        topics: await this.extractVideoTopics(videoContext)
      },
      temporal: await this.buildTemporalContext(videoContext.videoId),
      conversational: await this.buildConversationalContext(videoContext.videoId),
      social: await this.buildSocialContext(videoContext.videoId),
      user: this.buildUserContext()
    };
    
    // Add derived context
    context.derived = this.deriveAdditionalContext(context);
    
    return context;
  }

  // Build temporal context
  async buildTemporalContext(videoId) {
    const temporal = {
      currentTime: Date.now(),
      videoAge: 0,
      commentTimeline: [],
      activityPeriods: [],
      trends: []
    };
    
    // Get comment timeline
    const comments = await this.storageAdapter.getLocalData(`youtube_embeddings_${videoId}`);
    if (comments && comments.embeddings) {
      const timeline = Object.values(comments.embeddings)
        .map(c => ({
          timestamp: c.storedAt || Date.now(),
          sentiment: c.sentimentScore || 0,
          engagement: c.engagementMetrics?.likes || 0
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      temporal.commentTimeline = timeline;
      
      // Identify activity periods
      temporal.activityPeriods = this.identifyActivityPeriods(timeline);
      
      // Detect temporal trends
      temporal.trends = this.detectTemporalTrends(timeline);
    }
    
    return temporal;
  }

  // Build conversational context
  async buildConversationalContext(videoId) {
    const conversational = {
      threads: [],
      replyChains: [],
      discussionTopics: [],
      influencers: []
    };
    
    // Get all comments
    const comments = await this.storageAdapter.getLocalData(`youtube_embeddings_${videoId}`);
    if (comments && comments.embeddings) {
      const allComments = Object.values(comments.embeddings);
      
      // Identify conversation threads
      conversational.threads = this.identifyConversationThreads(allComments);
      
      // Find reply chains
      conversational.replyChains = this.findReplyChains(allComments);
      
      // Extract discussion topics
      conversational.discussionTopics = this.extractDiscussionTopics(conversational.threads);
      
      // Identify influential participants
      conversational.influencers = this.identifyInfluencers(allComments);
    }
    
    return conversational;
  }

  // Build social context
  async buildSocialContext(videoId) {
    const social = {
      communityType: 'unknown',
      engagementLevel: 'low',
      sentimentDistribution: {},
      authorNetwork: new Map(),
      viralComments: []
    };
    
    const comments = await this.storageAdapter.getLocalData(`youtube_embeddings_${videoId}`);
    if (comments && comments.embeddings) {
      const allComments = Object.values(comments.embeddings);
      
      // Determine community type
      social.communityType = this.determineCommunityType(allComments);
      
      // Calculate engagement level
      social.engagementLevel = this.calculateEngagementLevel(allComments);
      
      // Analyze sentiment distribution
      social.sentimentDistribution = this.analyzeSentimentDistribution(allComments);
      
      // Build author network
      social.authorNetwork = this.buildAuthorNetwork(allComments);
      
      // Find viral comments
      social.viralComments = this.findViralComments(allComments);
    }
    
    return social;
  }

  // Score contextual match
  async scoreContextualMatch(candidate, query, context, requirements) {
    const scores = {
      temporal: 0,
      conversational: 0,
      topical: 0,
      social: 0,
      semantic: candidate.similarity_score || 0
    };
    
    // Temporal relevance
    scores.temporal = this.scoreTemporalRelevance(candidate, context.temporal, requirements);
    
    // Conversational relevance
    scores.conversational = this.scoreConversationalRelevance(candidate, context.conversational);
    
    // Topical relevance
    scores.topical = await this.scoreTopicalRelevance(candidate, context, query);
    
    // Social relevance
    scores.social = this.scoreSocialRelevance(candidate, context.social);
    
    // Calculate weighted final score
    const weights = this.getContextualWeights(requirements);
    const finalScore = Object.entries(scores).reduce(
      (sum, [key, score]) => sum + score * (weights[key] || 0.2),
      0
    );
    
    return {
      scores,
      finalScore,
      explanation: this.generateContextExplanation(scores, weights)
    };
  }

  // Score temporal relevance
  scoreTemporalRelevance(candidate, temporalContext, requirements) {
    let score = 0;
    
    // Recency factor
    const age = Date.now() - (candidate.storedAt || Date.now());
    const recencyScore = Math.exp(-age / (7 * 24 * 60 * 60 * 1000)); // Decay over 7 days
    score += recencyScore * 0.3;
    
    // Activity period alignment
    const inActivePeriod = temporalContext.activityPeriods.some(period =>
      candidate.storedAt >= period.start && candidate.storedAt <= period.end
    );
    if (inActivePeriod) score += 0.3;
    
    // Trend alignment
    const trendAlignment = this.checkTrendAlignment(candidate, temporalContext.trends);
    score += trendAlignment * 0.4;
    
    return score;
  }

  // Score conversational relevance
  scoreConversationalRelevance(candidate, conversationalContext) {
    let score = 0;
    
    // Check if part of a thread
    const inThread = conversationalContext.threads.some(thread =>
      thread.comments.some(c => c.commentId === candidate.commentId)
    );
    if (inThread) score += 0.4;
    
    // Check if from an influencer
    const isInfluencer = conversationalContext.influencers.some(inf =>
      inf.author === candidate.author
    );
    if (isInfluencer) score += 0.3;
    
    // Topic alignment
    const topicMatch = conversationalContext.discussionTopics.some(topic =>
      this.checkTopicMatch(candidate.text, topic)
    );
    if (topicMatch) score += 0.3;
    
    return score;
  }

  // Score topical relevance
  async scoreTopicalRelevance(candidate, context, query) {
    let score = 0;
    
    // Direct topic match with video
    const videoTopicMatch = context.video.topics.some(topic =>
      candidate.text.toLowerCase().includes(topic.toLowerCase())
    );
    if (videoTopicMatch) score += 0.3;
    
    // Semantic topic similarity
    if (candidate.embedding && this.embeddingAgent.embeddingService) {
      const queryEmbedding = await this.embeddingAgent.embeddingService.generateEmbedding(query);
      const topicSimilarity = this.cosineSimilarity(candidate.embedding, queryEmbedding);
      score += topicSimilarity * 0.4;
    }
    
    // Entity overlap
    const entityOverlap = this.calculateEntityOverlap(
      candidate.text,
      context.query.entities
    );
    score += entityOverlap * 0.3;
    
    return score;
  }

  // Score social relevance
  scoreSocialRelevance(candidate, socialContext) {
    let score = 0;
    
    // Engagement metrics
    const engagement = candidate.engagementMetrics || {};
    const normalizedLikes = Math.min((engagement.likes || 0) / 100, 1);
    score += normalizedLikes * 0.3;
    
    // Author influence
    const authorInfluence = socialContext.authorNetwork.get(candidate.author) || 0;
    score += Math.min(authorInfluence, 1) * 0.3;
    
    // Viral potential
    const isViral = socialContext.viralComments.some(v => v.commentId === candidate.commentId);
    if (isViral) score += 0.4;
    
    return score;
  }

  // Apply contextual filters
  applyContextualFilters(candidates, requirements) {
    return candidates.filter(candidate => {
      // Apply hard filters based on requirements
      if (requirements.mustBeRecent && 
          Date.now() - candidate.storedAt > this.thresholds.temporalWindow) {
        return false;
      }
      
      if (requirements.mustBeFromInfluencer && 
          !this.isInfluencer(candidate.author)) {
        return false;
      }
      
      if (requirements.minimumEngagement &&
          (candidate.engagementMetrics?.likes || 0) < requirements.minimumEngagement) {
        return false;
      }
      
      // Pass contextual score threshold
      return candidate.contextualScore.finalScore >= this.thresholds.contextRelevance;
    });
  }

  // Contextual re-ranking
  contextualReranking(candidates, context) {
    // Group by context type
    const groups = {
      conversational: [],
      temporal: [],
      topical: [],
      social: []
    };
    
    candidates.forEach(candidate => {
      const scores = candidate.contextualScore.scores;
      const dominantContext = Object.entries(scores)
        .filter(([key]) => key !== 'semantic')
        .sort((a, b) => b[1] - a[1])[0][0];
      
      groups[dominantContext].push(candidate);
    });
    
    // Interleave groups for diversity
    const reranked = [];
    const maxLength = Math.max(...Object.values(groups).map(g => g.length));
    
    for (let i = 0; i < maxLength; i++) {
      Object.values(groups).forEach(group => {
        if (i < group.length) {
          reranked.push(group[i]);
        }
      });
    }
    
    // Final adjustment based on query intent
    return this.adjustForQueryIntent(reranked, context.query.intent);
  }

  // Helper methods
  identifyActivityPeriods(timeline) {
    const periods = [];
    let currentPeriod = null;
    
    timeline.forEach((event, index) => {
      if (index === 0) {
        currentPeriod = { start: event.timestamp, end: event.timestamp, count: 1 };
      } else {
        const gap = event.timestamp - timeline[index - 1].timestamp;
        if (gap > 3600000) { // 1 hour gap
          periods.push(currentPeriod);
          currentPeriod = { start: event.timestamp, end: event.timestamp, count: 1 };
        } else {
          currentPeriod.end = event.timestamp;
          currentPeriod.count++;
        }
      }
    });
    
    if (currentPeriod) periods.push(currentPeriod);
    
    return periods;
  }

  detectTemporalTrends(timeline) {
    const trends = [];
    
    if (timeline.length < 10) return trends;
    
    // Sentiment trend
    const sentimentTrend = this.calculateTrend(
      timeline.map(t => ({ x: t.timestamp, y: t.sentiment }))
    );
    if (Math.abs(sentimentTrend.slope) > 0.001) {
      trends.push({
        type: 'sentiment',
        direction: sentimentTrend.slope > 0 ? 'improving' : 'declining',
        strength: Math.abs(sentimentTrend.slope)
      });
    }
    
    // Engagement trend
    const engagementTrend = this.calculateTrend(
      timeline.map(t => ({ x: t.timestamp, y: t.engagement }))
    );
    if (Math.abs(engagementTrend.slope) > 0.1) {
      trends.push({
        type: 'engagement',
        direction: engagementTrend.slope > 0 ? 'increasing' : 'decreasing',
        strength: Math.abs(engagementTrend.slope)
      });
    }
    
    return trends;
  }

  calculateTrend(points) {
    // Simple linear regression
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    points.forEach(point => {
      sumX += point.x;
      sumY += point.y;
      sumXY += point.x * point.y;
      sumX2 += point.x * point.x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }

  identifyConversationThreads(comments) {
    const threads = [];
    const processed = new Set();
    
    comments.forEach(comment => {
      if (processed.has(comment.commentId)) return;
      
      // Find related comments (simplified - in production use reply data)
      const thread = [comment];
      processed.add(comment.commentId);
      
      comments.forEach(other => {
        if (processed.has(other.commentId)) return;
        
        // Check if comments are related
        if (this.areCommentsRelated(comment, other)) {
          thread.push(other);
          processed.add(other.commentId);
        }
      });
      
      if (thread.length > 1) {
        threads.push({
          id: `thread_${threads.length}`,
          comments: thread,
          topic: this.extractThreadTopic(thread)
        });
      }
    });
    
    return threads;
  }

  areCommentsRelated(comment1, comment2) {
    // Check author interaction
    if (comment1.text.includes(`@${comment2.author}`) ||
        comment2.text.includes(`@${comment1.author}`)) {
      return true;
    }
    
    // Check semantic similarity
    if (comment1.embedding && comment2.embedding) {
      const similarity = this.cosineSimilarity(comment1.embedding, comment2.embedding);
      return similarity > 0.85;
    }
    
    // Check temporal proximity
    const timeDiff = Math.abs((comment1.storedAt || 0) - (comment2.storedAt || 0));
    return timeDiff < 300000; // 5 minutes
  }

  extractThreadTopic(thread) {
    // Extract most common meaningful words
    const words = thread.flatMap(c => 
      c.text.toLowerCase().split(/\s+/)
        .filter(w => w.length > 4 && !this.isStopWord(w))
    );
    
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word)
      .join(' ');
  }

  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (norm1 * norm2);
  }

  isStopWord(word) {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are',
      'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);
    return stopWords.has(word);
  }

  // Initialize context models
  initializeTemporalModel() {
    return {
      patterns: new Map(),
      predictions: new Map()
    };
  }

  initializeConversationalModel() {
    return {
      threadPatterns: new Map(),
      replyChains: new Map()
    };
  }

  initializeTopicalModel() {
    return {
      topics: new Map(),
      relationships: new Map()
    };
  }

  initializeSocialModel() {
    return {
      authorProfiles: new Map(),
      communities: new Map()
    };
  }
}

// Export for Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContextMatchingSystem;
} else {
  window.ContextMatchingSystem = ContextMatchingSystem;
}