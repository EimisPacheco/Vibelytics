// Semantic Analysis Agent
// Uses TiDB vector search to analyze comment patterns and extract insights

class SemanticAnalysisAgent {
  constructor(tidbService) {
    this.tidbService = tidbService;
    this.analysisThreshold = 0.7; // Similarity threshold for pattern matching
  }

  async analyzeComments(videoId, options = {}) {
    console.log('🧠 Semantic Analysis Agent: Starting analysis for video', videoId);
    
    try {
      // Perform multiple types of semantic analysis
      const [
        patternAnalysis,
        topicClusters,
        sentimentDistribution,
        controversialComments,
        businessOpportunities
      ] = await Promise.all([
        this.analyzePatterns(videoId),
        this.clusterTopics(videoId, options.numClusters || 5),
        this.analyzeSentimentDistribution(videoId),
        this.findControversialComments(videoId),
        this.detectBusinessOpportunities(videoId)
      ]);

      // Combine all analyses
      const analysis = {
        patterns: patternAnalysis,
        topics: topicClusters,
        sentiment: sentimentDistribution,
        controversial: controversialComments,
        opportunities: businessOpportunities,
        summary: this.generateSummary({
          patternAnalysis,
          topicClusters,
          sentimentDistribution,
          controversialComments,
          businessOpportunities
        })
      };

      console.log('✅ Semantic analysis complete');
      return analysis;

    } catch (error) {
      console.error('❌ Semantic analysis failed:', error);
      throw error;
    }
  }

  async analyzePatterns(videoId) {
    console.log('🔍 Analyzing comment patterns...');
    
    // Query TiDB for pattern matches using vector similarity
    const patternTypes = [
      'business_opportunity',
      'feature_request',
      'complaint',
      'praise',
      'question',
      'controversy'
    ];

    const patternResults = {};

    for (const patternType of patternTypes) {
      const matches = await this.tidbService.findPatternMatches(videoId, patternType);
      
      if (matches && matches.length > 0) {
        patternResults[patternType] = {
          count: matches.length,
          examples: matches.slice(0, 5).map(match => ({
            text: match.comment_text,
            author: match.author,
            similarity: 1 - match.pattern_similarity // Convert distance to similarity
          })),
          averageSimilarity: matches.reduce((sum, m) => sum + (1 - m.pattern_similarity), 0) / matches.length
        };
      }
    }

    return patternResults;
  }

  async clusterTopics(videoId, numClusters) {
    console.log(`📊 Clustering comments into ${numClusters} topics...`);
    
    // Get clustered comments from TiDB
    const clusters = await this.tidbService.clusterComments(videoId, numClusters);
    
    // Enhance clusters with topic labels
    const enhancedClusters = clusters.map((cluster, index) => {
      const topicLabel = this.generateTopicLabel(cluster.examples);
      
      return {
        id: cluster.cluster_id,
        label: topicLabel,
        size: cluster.size,
        percentage: (cluster.size / clusters.reduce((sum, c) => sum + c.size, 0)) * 100,
        examples: cluster.examples,
        keywords: this.extractKeywords(cluster.examples)
      };
    });

    // Sort by size
    return enhancedClusters.sort((a, b) => b.size - a.size);
  }

  async analyzeSentimentDistribution(videoId) {
    console.log('😊 Analyzing sentiment distribution...');
    
    // Query sentiment scores from TiDB
    const query = `
      SELECT 
        CASE 
          WHEN sentiment_score >= 0.5 THEN 'very_positive'
          WHEN sentiment_score >= 0.1 THEN 'positive'
          WHEN sentiment_score >= -0.1 THEN 'neutral'
          WHEN sentiment_score >= -0.5 THEN 'negative'
          ELSE 'very_negative'
        END as sentiment_category,
        COUNT(*) as count,
        AVG(sentiment_score) as avg_score,
        MAX(sentiment_score) as max_score,
        MIN(sentiment_score) as min_score
      FROM youtube_comment_embeddings
      WHERE video_id = ?
      GROUP BY sentiment_category
    `;
    
    const results = await this.tidbService.query(query, [videoId]);
    
    // Calculate overall sentiment
    const totalComments = results.reduce((sum, r) => sum + r.count, 0);
    const weightedScore = results.reduce((sum, r) => sum + (r.avg_score * r.count), 0) / totalComments;
    
    return {
      distribution: results.map(r => ({
        category: r.sentiment_category,
        count: r.count,
        percentage: (r.count / totalComments) * 100,
        averageScore: r.avg_score
      })),
      overall: {
        score: weightedScore,
        label: this.getSentimentLabel(weightedScore),
        totalComments
      }
    };
  }

  async findControversialComments(videoId) {
    console.log('🔥 Finding controversial comments...');
    
    // Use TiDB vector search to find controversial patterns
    const controversial = await this.tidbService.findControversialComments(videoId);
    
    // Enhance with controversy scores
    return controversial.map(comment => ({
      commentId: comment.comment1_id,
      text: comment.comment1_text,
      author: comment.author1,
      controversyScore: this.calculateControversyScore({
        debateCount: comment.debate_count,
        oppositionScore: comment.avg_opposition_score
      }),
      metrics: {
        debateCount: comment.debate_count,
        averageOpposition: comment.avg_opposition_score,
        severity: this.getControversySeverity(comment.debate_count, comment.avg_opposition_score)
      }
    }));
  }

  async detectBusinessOpportunities(videoId) {
    console.log('💼 Detecting business opportunities...');
    
    // Complex query to find business-related comments using vector similarity
    const query = `
      WITH business_patterns AS (
        SELECT pattern_embedding 
        FROM comment_patterns 
        WHERE pattern_type = 'business_opportunity'
        LIMIT 1
      ),
      opportunity_comments AS (
        SELECT 
          c.comment_id,
          c.comment_text,
          c.author,
          c.likes,
          COSINE_DISTANCE(c.embedding, p.pattern_embedding) as similarity_score,
          c.engagement_metrics
        FROM youtube_comment_embeddings c
        CROSS JOIN business_patterns p
        WHERE c.video_id = ?
          AND COSINE_DISTANCE(c.embedding, p.pattern_embedding) < 0.3
      )
      SELECT *
      FROM opportunity_comments
      WHERE likes > 5 OR JSON_EXTRACT(engagement_metrics, '$.replyCount') > 2
      ORDER BY similarity_score ASC, likes DESC
      LIMIT 20
    `;
    
    const opportunities = await this.tidbService.query(query, [videoId]);
    
    // Categorize opportunities
    const categorized = this.categorizeOpportunities(opportunities);
    
    return {
      total: opportunities.length,
      categories: categorized,
      topOpportunities: opportunities.slice(0, 5).map(opp => ({
        text: opp.comment_text,
        author: opp.author,
        likes: opp.likes,
        confidence: 1 - opp.similarity_score,
        type: this.identifyOpportunityType(opp.comment_text)
      }))
    };
  }

  // Helper methods
  generateTopicLabel(examples) {
    // Extract common themes from example comments
    const commonWords = this.findCommonWords(examples);
    
    if (commonWords.length > 0) {
      return commonWords.slice(0, 3).join(' / ');
    }
    
    // Fallback to generic labels
    const text = examples.join(' ').toLowerCase();
    if (text.includes('tutorial') || text.includes('how')) return 'Tutorials & Guides';
    if (text.includes('love') || text.includes('amazing')) return 'Positive Feedback';
    if (text.includes('problem') || text.includes('issue')) return 'Issues & Concerns';
    if (text.includes('question') || text.includes('?')) return 'Questions & Queries';
    
    return 'General Discussion';
  }

  extractKeywords(texts) {
    const words = texts.join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
    
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  findCommonWords(texts) {
    const allWords = texts.flatMap(text => 
      text.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4)
        .filter(word => !this.isStopWord(word))
    );
    
    const wordCount = {};
    allWords.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    return Object.entries(wordCount)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }

  isStopWord(word) {
    const stopWords = [
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are',
      'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ];
    return stopWords.includes(word.toLowerCase());
  }

  getSentimentLabel(score) {
    if (score >= 0.5) return 'Very Positive';
    if (score >= 0.1) return 'Positive';
    if (score >= -0.1) return 'Neutral';
    if (score >= -0.5) return 'Negative';
    return 'Very Negative';
  }

  calculateControversyScore(metrics) {
    // Combine debate count and opposition score
    const debateWeight = Math.min(metrics.debateCount / 10, 1);
    const oppositionWeight = metrics.averageOpposition;
    
    return (debateWeight * 0.4 + oppositionWeight * 0.6) * 10;
  }

  getControversySeverity(debateCount, oppositionScore) {
    const score = this.calculateControversyScore({ debateCount, oppositionScore });
    
    if (score >= 8) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }

  categorizeOpportunities(opportunities) {
    const categories = {
      'Course/Education': [],
      'Product/Service': [],
      'Feature Request': [],
      'Collaboration': [],
      'Other': []
    };
    
    opportunities.forEach(opp => {
      const text = opp.comment_text.toLowerCase();
      
      if (text.includes('course') || text.includes('tutorial') || text.includes('teach')) {
        categories['Course/Education'].push(opp);
      } else if (text.includes('buy') || text.includes('purchase') || text.includes('product')) {
        categories['Product/Service'].push(opp);
      } else if (text.includes('feature') || text.includes('add') || text.includes('implement')) {
        categories['Feature Request'].push(opp);
      } else if (text.includes('collaborate') || text.includes('work together') || text.includes('partner')) {
        categories['Collaboration'].push(opp);
      } else {
        categories['Other'].push(opp);
      }
    });
    
    return Object.entries(categories)
      .filter(([_, items]) => items.length > 0)
      .map(([category, items]) => ({
        category,
        count: items.length,
        examples: items.slice(0, 3)
      }));
  }

  identifyOpportunityType(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('course') || lowerText.includes('tutorial')) return 'Educational Content';
    if (lowerText.includes('buy') || lowerText.includes('purchase')) return 'Product Demand';
    if (lowerText.includes('service') || lowerText.includes('help')) return 'Service Request';
    if (lowerText.includes('sponsor') || lowerText.includes('advertise')) return 'Sponsorship';
    if (lowerText.includes('collaborate') || lowerText.includes('partner')) return 'Partnership';
    
    return 'General Opportunity';
  }

  generateSummary(analyses) {
    const { patternAnalysis, topicClusters, sentimentDistribution, controversialComments, businessOpportunities } = analyses;
    
    return {
      mainTopics: topicClusters.slice(0, 3).map(t => t.label),
      overallSentiment: sentimentDistribution.overall.label,
      patternHighlights: Object.entries(patternAnalysis)
        .filter(([_, data]) => data.count > 5)
        .map(([type, data]) => ({ type, count: data.count })),
      controversyLevel: controversialComments.length > 10 ? 'high' : 
                       controversialComments.length > 5 ? 'medium' : 'low',
      opportunityScore: businessOpportunities.total > 10 ? 'high' :
                       businessOpportunities.total > 5 ? 'medium' : 'low'
    };
  }
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SemanticAnalysisAgent;
}