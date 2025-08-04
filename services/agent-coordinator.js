// Agent Coordinator
// Manages communication and workflow between all agents

class AgentCoordinator {
  constructor(config = {}) {
    // Initialize storage adapter (handles both TiDB and local storage)
    this.storageAdapter = new StorageAdapter({
      mode: config.storageMode || 'auto', // 'auto', 'tidb', or 'local'
      tidb: config.tidb || {}
    });
    
    // Initialize all agents with storage adapter
    this.agents = {
      ingestion: new CommentIngestionAgent(this.storageAdapter),
      vector: new VectorProcessingAgent(this.storageAdapter, config.embedding || {}),
      semantic: new SemanticAnalysisAgent(this.storageAdapter),
      insight: new InsightGenerationAgent(this.storageAdapter)
    };
    
    // Processing state
    this.processingState = {
      isProcessing: false,
      currentVideo: null,
      progress: 0,
      stage: 'idle'
    };
    
    // Event listeners for progress updates
    this.progressCallbacks = [];
  }

  async initialize() {
    console.log('🚀 Initializing Agent Coordinator...');
    
    try {
      // Initialize storage adapter (will connect to TiDB or use local storage)
      await this.storageAdapter.initialize();
      
      // Log storage type
      const storageType = this.storageAdapter.getStorageType();
      console.log(`📦 Using ${storageType} storage`);
      
      // Initialize vector patterns
      await this.agents.vector.initializePatterns();
      
      // Show storage stats
      const stats = await this.storageAdapter.getStorageStats();
      console.log('💾 Storage stats:', stats);
      
      console.log('✅ Agent Coordinator initialized successfully');
      
      // Schedule periodic cleanup (every 24 hours)
      this.schedulePeriodicCleanup();
      
      return true;
    } catch (error) {
      console.error('❌ Agent Coordinator initialization failed:', error);
      // Don't throw - we can still work with local storage
      console.log('⚠️ Continuing with local storage fallback');
      return true;
    }
  }

  schedulePeriodicCleanup() {
    // Run cleanup on initialization
    this.runCleanup();
    
    // Schedule cleanup every 24 hours
    setInterval(() => {
      this.runCleanup();
    }, 24 * 60 * 60 * 1000);
  }

  async runCleanup() {
    try {
      console.log('🧹 Running periodic cleanup...');
      const result = await this.storageAdapter.cleanupExpiredData(7);
      if (result.success) {
        console.log('✅ Cleanup completed successfully');
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  async analyzeVideo(videoId, comments) {
    if (this.processingState.isProcessing) {
      throw new Error('Already processing a video');
    }
    
    console.log(`🎬 Starting multi-agent analysis for video ${videoId}`);
    this.updateProcessingState('processing', videoId, 0, 'checking_cache');
    
    try {
      // Step 1: Check cache
      const cached = await this.storageAdapter.getCachedAnalysis(videoId);
      if (cached && this.isCacheValid(cached)) {
        console.log('📦 Using cached analysis');
        this.updateProcessingState('completed', videoId, 100, 'cached');
        return cached.analysis_data;
      }
      
      // Step 1.5: Check if video was recently analyzed (within 7 days)
      const recentCheck = await this.storageAdapter.isVideoRecentlyAnalyzed(videoId, 7);
      if (recentCheck.isRecent) {
        console.log(`⏰ Video was recently analyzed on ${recentCheck.lastAnalyzed}`);
        console.log(`📊 Has ${recentCheck.commentCount} comments in storage`);
        
        // If we have recent data but no valid cache, regenerate analysis from stored data
        if (recentCheck.commentCount > 0) {
          console.log('♻️ Regenerating analysis from stored embeddings (no new API calls)');
          this.updateProcessingState('processing', videoId, 20, 'using_stored_data');
          
          // Skip ingestion, go directly to analysis
          const analysisResults = await this.agents.semantic.analyzeComments(videoId);
          const insights = await this.agents.insight.generateInsights(videoId, analysisResults);
          const finalResults = this.compileFinalResults(videoId, analysisResults, insights, {
            total: recentCheck.commentCount,
            processed: recentCheck.commentCount,
            fromCache: true
          });
          
          this.updateProcessingState('completed', videoId, 100, 'done');
          return finalResults;
        }
      }
      
      // Step 2: Only ingest NEW comments if not recently analyzed
      if (!comments || comments.length === 0) {
        console.log('⚠️ No comments provided and no recent analysis found');
        throw new Error('No comments available for analysis');
      }
      
      console.log('📥 Processing new comments (not recently analyzed)');
      this.updateProcessingState('processing', videoId, 10, 'ingesting_comments');
      const ingestionResult = await this.agents.ingestion.ingestComments(videoId, comments);
      
      if (!ingestionResult.success) {
        throw new Error('Comment ingestion failed');
      }
      
      // Step 3: Process vectors (handled internally by agents)
      this.updateProcessingState('processing', videoId, 30, 'generating_vectors');
      await this.waitForVectorProcessing(videoId);
      
      // Step 4: Semantic analysis
      this.updateProcessingState('processing', videoId, 50, 'analyzing_semantics');
      const analysisResults = await this.agents.semantic.analyzeComments(videoId);
      
      // Step 5: Generate insights
      this.updateProcessingState('processing', videoId, 70, 'generating_insights');
      const insights = await this.agents.insight.generateInsights(videoId, analysisResults);
      
      // Step 6: Compile final results
      this.updateProcessingState('processing', videoId, 90, 'finalizing');
      const finalResults = this.compileFinalResults(videoId, analysisResults, insights, ingestionResult.stats);
      
      // Complete
      this.updateProcessingState('completed', videoId, 100, 'done');
      
      console.log('✅ Multi-agent analysis completed successfully');
      return finalResults;
      
    } catch (error) {
      console.error('❌ Multi-agent analysis failed:', error);
      this.updateProcessingState('error', videoId, 0, 'failed');
      throw error;
    }
  }

  compileFinalResults(videoId, analysis, insights, stats) {
    return {
      videoId,
      timestamp: new Date().toISOString(),
      statistics: {
        totalComments: stats.total,
        processedComments: stats.processed,
        uniqueAuthors: insights.audienceInsights.demographics.uniqueCommenters
      },
      
      // Executive Summary
      summary: insights.executiveSummary,
      
      // Sentiment Analysis
      sentiment: {
        overall: analysis.sentiment.overall,
        distribution: analysis.sentiment.distribution,
        timeline: insights.trendAnalysis.timeline
      },
      
      // Topic Analysis
      topics: {
        mainTopics: analysis.topics,
        clusters: analysis.topics.map(t => ({
          label: t.label,
          percentage: t.percentage,
          keywords: t.keywords,
          examples: t.examples.slice(0, 3)
        }))
      },
      
      // Pattern Analysis
      patterns: {
        detected: analysis.patterns,
        summary: Object.entries(analysis.patterns).map(([type, data]) => ({
          type,
          count: data.count,
          confidence: data.averageSimilarity
        }))
      },
      
      // Business Intelligence
      businessIntelligence: {
        opportunities: analysis.opportunities,
        recommendations: insights.contentRecommendations,
        actionableItems: insights.actionableItems
      },
      
      // Engagement Analysis
      engagement: {
        analysis: insights.engagementAnalysis,
        controversial: analysis.controversial.slice(0, 10),
        topPerformers: insights.engagementAnalysis.topPerformers
      },
      
      // Content Quality
      contentQuality: {
        bestFeatures: insights.bestFeatures,
        areasForImprovement: insights.areasForImprovement
      },
      
      // Audience Insights
      audience: insights.audienceInsights,
      
      // Trends
      trends: insights.trendAnalysis,
      
      // Raw data samples (for debugging)
      samples: {
        positiveComments: this.getSampleComments(analysis.patterns.praise, 3),
        negativeComments: this.getSampleComments(analysis.patterns.complaint, 3),
        questions: this.getSampleComments(analysis.patterns.question, 3),
        opportunities: analysis.opportunities.topOpportunities.slice(0, 3)
      }
    };
  }

  getSampleComments(patternData, count) {
    if (!patternData || !patternData.examples) return [];
    
    return patternData.examples.slice(0, count).map(example => ({
      text: example.text,
      author: example.author,
      confidence: example.similarity
    }));
  }

  async waitForVectorProcessing(videoId) {
    // In a real implementation, this would monitor vector processing progress
    // For now, we'll simulate the wait
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('✅ Vector processing completed');
        resolve();
      }, 1000);
    });
  }

  isCacheValid(cached) {
    const expiry = new Date(cached.cache_expiry);
    return expiry > new Date();
  }

  updateProcessingState(status, videoId, progress, stage) {
    this.processingState = {
      isProcessing: status === 'processing',
      currentVideo: videoId,
      progress,
      stage
    };
    
    // Notify progress callbacks
    this.progressCallbacks.forEach(callback => {
      callback(this.processingState);
    });
  }

  onProgress(callback) {
    this.progressCallbacks.push(callback);
  }

  getProcessingState() {
    return { ...this.processingState };
  }

  // Helper method to format results for UI display
  formatForUI(results) {
    return {
      // Header section
      header: {
        totalComments: results.statistics.totalComments,
        sentiment: results.summary.overallSentiment,
        engagementLevel: results.summary.keyMetrics.engagementLevel,
        controversyLevel: results.summary.keyMetrics.controversyLevel
      },
      
      // Main insights
      insights: {
        executiveSummary: results.summary.highlights,
        topTopics: results.topics.mainTopics.slice(0, 5),
        businessOpportunities: results.businessIntelligence.opportunities.topOpportunities,
        recommendations: results.businessIntelligence.recommendations.slice(0, 3)
      },
      
      // Detailed sections
      sections: {
        sentiment: this.formatSentimentSection(results.sentiment),
        patterns: this.formatPatternsSection(results.patterns),
        controversial: this.formatControversialSection(results.engagement.controversial),
        quality: this.formatQualitySection(results.contentQuality),
        audience: this.formatAudienceSection(results.audience)
      }
    };
  }

  formatSentimentSection(sentiment) {
    return {
      title: 'Sentiment Analysis',
      overall: sentiment.overall,
      distribution: sentiment.distribution.map(d => ({
        label: d.category.replace('_', ' ').charAt(0).toUpperCase() + d.category.slice(1),
        percentage: d.percentage.toFixed(1) + '%',
        count: d.count
      }))
    };
  }

  formatPatternsSection(patterns) {
    return {
      title: 'Comment Patterns',
      items: patterns.summary
        .filter(p => p.count > 0)
        .map(p => ({
          type: p.type.replace('_', ' ').charAt(0).toUpperCase() + p.type.slice(1),
          count: p.count,
          confidence: (p.confidence * 100).toFixed(0) + '%'
        }))
    };
  }

  formatControversialSection(controversial) {
    return {
      title: 'Controversial Comments',
      items: controversial.map(c => ({
        text: c.text.substring(0, 150) + '...',
        author: c.author,
        score: c.controversyScore.toFixed(1),
        severity: c.metrics.severity
      }))
    };
  }

  formatQualitySection(quality) {
    return {
      title: 'Content Quality Analysis',
      bestFeatures: quality.bestFeatures.topFeatures,
      improvements: quality.areasForImprovement.priorityAreas
    };
  }

  formatAudienceSection(audience) {
    return {
      title: 'Audience Insights',
      demographics: audience.demographics,
      interests: audience.interests,
      behavior: audience.behavior
    };
  }
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentCoordinator;
}