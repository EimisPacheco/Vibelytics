// Insight Generation Agent
// Generates human-readable insights from semantic analysis using TiDB data

class InsightGenerationAgent {
  constructor(tidbService) {
    this.tidbService = tidbService;
  }

  async generateInsights(videoId, analysisResults) {
    console.log('💡 Insight Generation Agent: Creating insights for video', videoId);
    
    try {
      // Generate various types of insights
      const insights = {
        executiveSummary: await this.generateExecutiveSummary(videoId, analysisResults),
        audienceInsights: await this.generateAudienceInsights(videoId, analysisResults),
        contentRecommendations: await this.generateContentRecommendations(analysisResults),
        engagementAnalysis: await this.generateEngagementAnalysis(videoId),
        actionableItems: await this.generateActionableItems(analysisResults),
        trendAnalysis: await this.generateTrendAnalysis(videoId),
        bestFeatures: await this.identifyBestFeatures(videoId, analysisResults),
        areasForImprovement: await this.identifyAreasForImprovement(videoId, analysisResults)
      };

      // Cache the insights
      await this.tidbService.cacheAnalysis(videoId, {
        ...analysisResults,
        insights,
        generatedAt: new Date().toISOString()
      });

      console.log('✅ Insights generated successfully');
      return insights;

    } catch (error) {
      console.error('❌ Insight generation failed:', error);
      throw error;
    }
  }

  async generateExecutiveSummary(videoId, analysis) {
    const { patterns, topics, sentiment, controversial, opportunities } = analysis;
    
    // Get total comment count
    const countQuery = `SELECT COUNT(*) as total FROM youtube_comment_embeddings WHERE video_id = ?`;
    const [{ total }] = await this.tidbService.query(countQuery, [videoId]);
    
    const summary = {
      totalComments: total,
      overallSentiment: sentiment.overall.label,
      sentimentScore: (sentiment.overall.score * 100).toFixed(1) + '%',
      mainTopics: topics.slice(0, 3).map(t => ({
        topic: t.label,
        coverage: t.percentage.toFixed(1) + '%'
      })),
      keyMetrics: {
        engagementLevel: this.calculateEngagementLevel(total, analysis),
        controversyLevel: controversial.length > 10 ? 'High' : controversial.length > 5 ? 'Medium' : 'Low',
        opportunityScore: opportunities.total > 10 ? 'High' : opportunities.total > 5 ? 'Medium' : 'Low'
      },
      highlights: this.generateHighlights(analysis)
    };
    
    return summary;
  }

  async generateAudienceInsights(videoId, analysis) {
    // Query for audience behavior patterns
    const query = `
      SELECT 
        COUNT(DISTINCT author) as unique_commenters,
        AVG(JSON_EXTRACT(engagement_metrics, '$.textComplexity')) as avg_complexity,
        SUM(CASE WHEN sentiment_score > 0.5 THEN 1 ELSE 0 END) as highly_positive,
        SUM(CASE WHEN sentiment_score < -0.5 THEN 1 ELSE 0 END) as highly_negative,
        AVG(likes) as avg_likes
      FROM youtube_comment_embeddings
      WHERE video_id = ?
    `;
    
    const [audienceData] = await this.tidbService.query(query, [videoId]);
    
    return {
      demographics: {
        uniqueCommenters: audienceData.unique_commenters,
        averageEngagement: audienceData.avg_likes.toFixed(1),
        sentimentDistribution: {
          highlyPositive: audienceData.highly_positive,
          highlyNegative: audienceData.highly_negative
        }
      },
      behavior: {
        discussionTopics: analysis.topics.slice(0, 5).map(t => t.label),
        questionTypes: this.categorizeQuestions(analysis.patterns.question),
        engagementPatterns: this.analyzeEngagementPatterns(analysis)
      },
      interests: this.extractAudienceInterests(analysis)
    };
  }

  async generateContentRecommendations(analysis) {
    const recommendations = [];
    
    // Based on business opportunities
    if (analysis.opportunities.total > 5) {
      const topCategory = analysis.opportunities.categories[0];
      recommendations.push({
        type: 'monetization',
        priority: 'high',
        suggestion: `Consider creating ${topCategory.category.toLowerCase()} content - ${topCategory.count} viewers expressed interest`,
        examples: topCategory.examples.slice(0, 2).map(e => e.comment_text)
      });
    }
    
    // Based on questions
    if (analysis.patterns.question && analysis.patterns.question.count > 10) {
      recommendations.push({
        type: 'educational',
        priority: 'medium',
        suggestion: 'Create follow-up content addressing common questions',
        topics: this.extractQuestionTopics(analysis.patterns.question.examples)
      });
    }
    
    // Based on complaints
    if (analysis.patterns.complaint && analysis.patterns.complaint.count > 5) {
      recommendations.push({
        type: 'improvement',
        priority: 'high',
        suggestion: 'Address viewer concerns in future content',
        areas: this.extractComplaintThemes(analysis.patterns.complaint.examples)
      });
    }
    
    // Based on topic clusters
    const underservedTopics = analysis.topics
      .filter(t => t.percentage < 10 && t.percentage > 2)
      .map(t => t.label);
    
    if (underservedTopics.length > 0) {
      recommendations.push({
        type: 'expansion',
        priority: 'low',
        suggestion: 'Expand coverage on niche topics with engaged audiences',
        topics: underservedTopics
      });
    }
    
    return recommendations;
  }

  async generateEngagementAnalysis(videoId) {
    // Analyze engagement patterns using TiDB
    const query = `
      SELECT 
        CASE 
          WHEN likes > 100 THEN 'viral'
          WHEN likes > 50 THEN 'high'
          WHEN likes > 10 THEN 'medium'
          ELSE 'low'
        END as engagement_tier,
        COUNT(*) as count,
        AVG(likes) as avg_likes,
        MAX(likes) as max_likes,
        AVG(JSON_EXTRACT(engagement_metrics, '$.replyCount')) as avg_replies
      FROM youtube_comment_embeddings
      WHERE video_id = ?
      GROUP BY engagement_tier
    `;
    
    const engagementData = await this.tidbService.query(query, [videoId]);
    
    // Find most engaging comments
    const topCommentsQuery = `
      SELECT comment_text, author, likes
      FROM youtube_comment_embeddings
      WHERE video_id = ?
      ORDER BY likes DESC
      LIMIT 5
    `;
    
    const topComments = await this.tidbService.query(topCommentsQuery, [videoId]);
    
    return {
      distribution: engagementData.map(tier => ({
        tier: tier.engagement_tier,
        count: tier.count,
        averageLikes: tier.avg_likes.toFixed(1),
        averageReplies: tier.avg_replies.toFixed(1)
      })),
      topPerformers: topComments.map(c => ({
        text: c.comment_text.substring(0, 100) + '...',
        author: c.author,
        likes: c.likes
      })),
      insights: this.generateEngagementInsights(engagementData)
    };
  }

  async generateActionableItems(analysis) {
    const actions = [];
    
    // High-priority business opportunities
    if (analysis.opportunities.total > 0) {
      analysis.opportunities.topOpportunities.forEach(opp => {
        if (opp.confidence > 0.8) {
          actions.push({
            priority: 'high',
            category: 'business',
            action: `Respond to ${opp.author} about their ${opp.type.toLowerCase()}`,
            reason: opp.text,
            estimatedImpact: 'revenue opportunity'
          });
        }
      });
    }
    
    // Address controversial topics
    if (analysis.controversial.length > 0) {
      const topControversy = analysis.controversial[0];
      actions.push({
        priority: 'medium',
        category: 'community',
        action: 'Create clarification content about controversial topics',
        reason: `${analysis.controversial.length} comments sparked debates`,
        example: topControversy.text
      });
    }
    
    // Respond to high-engagement questions
    if (analysis.patterns.question) {
      const unansweredQuestions = analysis.patterns.question.examples
        .filter(q => q.similarity > 0.8)
        .slice(0, 3);
      
      unansweredQuestions.forEach(q => {
        actions.push({
          priority: 'medium',
          category: 'engagement',
          action: `Answer question from ${q.author}`,
          reason: q.text,
          estimatedImpact: 'improved viewer satisfaction'
        });
      });
    }
    
    return actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async generateTrendAnalysis(videoId) {
    // Analyze comment trends over time
    const query = `
      SELECT 
        DATE(created_at) as comment_date,
        COUNT(*) as daily_count,
        AVG(sentiment_score) as daily_sentiment,
        AVG(likes) as daily_avg_likes
      FROM youtube_comment_embeddings
      WHERE video_id = ?
      GROUP BY DATE(created_at)
      ORDER BY comment_date
    `;
    
    const trendData = await this.tidbService.query(query, [videoId]);
    
    return {
      timeline: trendData.map(day => ({
        date: day.comment_date,
        comments: day.daily_count,
        sentiment: day.daily_sentiment.toFixed(2),
        engagement: day.daily_avg_likes.toFixed(1)
      })),
      patterns: this.identifyTrendPatterns(trendData),
      momentum: this.calculateMomentum(trendData)
    };
  }

  async identifyBestFeatures(videoId, analysis) {
    // Find what viewers loved most
    const positivePatterns = analysis.patterns.praise || { examples: [] };
    const highEngagementPositive = await this.findHighEngagementPositive(videoId);
    
    const features = [];
    
    // Extract from positive comments
    const featurePatterns = [
      { regex: /love(?:d)?\s+(?:the\s+)?(\w+(?:\s+\w+)?)/gi, category: 'Content Element' },
      { regex: /amazing\s+(\w+(?:\s+\w+)?)/gi, category: 'Quality Aspect' },
      { regex: /best\s+(?:part\s+)?(?:was\s+)?(?:the\s+)?(\w+(?:\s+\w+)?)/gi, category: 'Highlight' },
      { regex: /perfect\s+(\w+(?:\s+\w+)?)/gi, category: 'Excellence' },
      { regex: /helpful\s+(\w+(?:\s+\w+)?)/gi, category: 'Utility' }
    ];
    
    highEngagementPositive.forEach(comment => {
      featurePatterns.forEach(pattern => {
        const matches = comment.comment_text.matchAll(pattern.regex);
        for (const match of matches) {
          features.push({
            feature: match[1],
            category: pattern.category,
            evidence: comment.comment_text,
            likes: comment.likes
          });
        }
      });
    });
    
    // Group and rank features
    const groupedFeatures = this.groupFeatures(features);
    
    return {
      topFeatures: Object.entries(groupedFeatures)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([feature, data]) => ({
          feature,
          mentions: data.count,
          category: data.category,
          examples: data.examples.slice(0, 2)
        })),
      summary: this.generateFeatureSummary(groupedFeatures)
    };
  }

  async identifyAreasForImprovement(videoId, analysis) {
    // Find areas viewers want improved
    const complaintPatterns = analysis.patterns.complaint || { examples: [] };
    const suggestions = analysis.patterns.feature_request || { examples: [] };
    
    const improvements = [];
    
    // Extract from complaints and suggestions
    const improvementPatterns = [
      { regex: /(?:should|could)\s+(?:have\s+)?(\w+(?:\s+\w+)?)/gi, category: 'Missing Element' },
      { regex: /needs?\s+(?:more\s+)?(\w+(?:\s+\w+)?)/gi, category: 'Enhancement' },
      { regex: /(?:disappointed|lacking)\s+(?:in\s+)?(\w+(?:\s+\w+)?)/gi, category: 'Weakness' },
      { regex: /improve\s+(?:the\s+)?(\w+(?:\s+\w+)?)/gi, category: 'Improvement Area' },
      { regex: /(?:wish|hope)\s+(?:you\s+)?(?:would\s+)?(\w+(?:\s+\w+)?)/gi, category: 'Viewer Wish' }
    ];
    
    [...complaintPatterns.examples, ...suggestions.examples].forEach(item => {
      improvementPatterns.forEach(pattern => {
        const matches = item.text.matchAll(pattern.regex);
        for (const match of matches) {
          improvements.push({
            area: match[1],
            category: pattern.category,
            evidence: item.text,
            author: item.author
          });
        }
      });
    });
    
    // Query for negative sentiment areas
    const negativeQuery = `
      SELECT comment_text, author
      FROM youtube_comment_embeddings
      WHERE video_id = ? AND sentiment_score < -0.3
      LIMIT 20
    `;
    
    const negativeComments = await this.tidbService.query(negativeQuery, [videoId]);
    
    // Extract improvement areas from negative comments
    negativeComments.forEach(comment => {
      improvementPatterns.forEach(pattern => {
        const matches = comment.comment_text.matchAll(pattern.regex);
        for (const match of matches) {
          improvements.push({
            area: match[1],
            category: pattern.category,
            evidence: comment.comment_text,
            author: comment.author
          });
        }
      });
    });
    
    // Group and rank improvements
    const groupedImprovements = this.groupImprovements(improvements);
    
    return {
      priorityAreas: Object.entries(groupedImprovements)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([area, data]) => ({
          area,
          mentions: data.count,
          category: data.category,
          examples: data.examples.slice(0, 2)
        })),
      summary: this.generateImprovementSummary(groupedImprovements)
    };
  }

  // Helper methods
  calculateEngagementLevel(total, analysis) {
    const factors = {
      volume: total > 1000 ? 1 : total > 100 ? 0.7 : 0.3,
      sentiment: analysis.sentiment.overall.score > 0.3 ? 0.8 : 0.5,
      controversy: analysis.controversial.length > 10 ? 0.9 : 0.4,
      opportunities: analysis.opportunities.total > 10 ? 0.9 : 0.5
    };
    
    const score = Object.values(factors).reduce((a, b) => a + b) / Object.keys(factors).length;
    
    if (score > 0.7) return 'High';
    if (score > 0.4) return 'Medium';
    return 'Low';
  }

  generateHighlights(analysis) {
    const highlights = [];
    
    if (analysis.sentiment.overall.score > 0.5) {
      highlights.push('Overwhelmingly positive audience response');
    }
    
    if (analysis.opportunities.total > 10) {
      highlights.push(`${analysis.opportunities.total} business opportunities identified`);
    }
    
    if (analysis.controversial.length > 5) {
      highlights.push('High engagement through controversial discussions');
    }
    
    if (analysis.patterns.question && analysis.patterns.question.count > 20) {
      highlights.push('Strong viewer curiosity with many questions');
    }
    
    return highlights;
  }

  categorizeQuestions(questionData) {
    if (!questionData || !questionData.examples) return [];
    
    const categories = {
      'How-to': [],
      'Why': [],
      'What': [],
      'Where': [],
      'When': [],
      'Technical': []
    };
    
    questionData.examples.forEach(q => {
      const text = q.text.toLowerCase();
      if (text.includes('how')) categories['How-to'].push(q);
      else if (text.includes('why')) categories['Why'].push(q);
      else if (text.includes('what')) categories['What'].push(q);
      else if (text.includes('where')) categories['Where'].push(q);
      else if (text.includes('when')) categories['When'].push(q);
      else categories['Technical'].push(q);
    });
    
    return Object.entries(categories)
      .filter(([_, questions]) => questions.length > 0)
      .map(([type, questions]) => ({
        type,
        count: questions.length,
        example: questions[0]?.text
      }));
  }

  analyzeEngagementPatterns(analysis) {
    const patterns = [];
    
    if (analysis.topics[0].percentage > 40) {
      patterns.push('Focused discussion on primary topic');
    }
    
    if (analysis.sentiment.distribution.find(d => d.category === 'very_positive')?.percentage > 30) {
      patterns.push('Highly enthusiastic audience');
    }
    
    if (analysis.controversial.length > 0 && analysis.sentiment.overall.score > 0) {
      patterns.push('Healthy debates with positive overall sentiment');
    }
    
    return patterns;
  }

  extractAudienceInterests(analysis) {
    const interests = new Set();
    
    // From topics
    analysis.topics.forEach(topic => {
      topic.keywords.forEach(keyword => interests.add(keyword));
    });
    
    // From opportunities
    if (analysis.opportunities.categories) {
      analysis.opportunities.categories.forEach(cat => {
        interests.add(cat.category.toLowerCase());
      });
    }
    
    return Array.from(interests).slice(0, 10);
  }

  extractQuestionTopics(questions) {
    if (!questions) return [];
    
    const topics = questions
      .map(q => {
        const words = q.text.toLowerCase().split(/\s+/);
        return words.filter(w => w.length > 4 && !this.isStopWord(w));
      })
      .flat();
    
    const topicCount = {};
    topics.forEach(topic => {
      topicCount[topic] = (topicCount[topic] || 0) + 1;
    });
    
    return Object.entries(topicCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  extractComplaintThemes(complaints) {
    if (!complaints) return [];
    
    const themes = {
      'Technical Issues': ['lag', 'bug', 'crash', 'error', 'broken'],
      'Content Quality': ['boring', 'confusing', 'unclear', 'poor'],
      'Length': ['too long', 'too short', 'dragged'],
      'Audio/Video': ['audio', 'sound', 'video', 'quality']
    };
    
    const detectedThemes = [];
    
    complaints.forEach(complaint => {
      const text = complaint.text.toLowerCase();
      Object.entries(themes).forEach(([theme, keywords]) => {
        if (keywords.some(keyword => text.includes(keyword))) {
          detectedThemes.push(theme);
        }
      });
    });
    
    return [...new Set(detectedThemes)];
  }

  generateEngagementInsights(engagementData) {
    const insights = [];
    
    const totalComments = engagementData.reduce((sum, tier) => sum + tier.count, 0);
    const viralComments = engagementData.find(t => t.engagement_tier === 'viral');
    
    if (viralComments && viralComments.count > 0) {
      insights.push(`${((viralComments.count / totalComments) * 100).toFixed(1)}% of comments went viral`);
    }
    
    const avgLikes = engagementData.reduce((sum, tier) => sum + (tier.avg_likes * tier.count), 0) / totalComments;
    insights.push(`Average engagement: ${avgLikes.toFixed(1)} likes per comment`);
    
    return insights;
  }

  identifyTrendPatterns(trendData) {
    if (trendData.length < 2) return ['Insufficient data for trend analysis'];
    
    const patterns = [];
    
    // Check for growth
    const firstDay = trendData[0].daily_count;
    const lastDay = trendData[trendData.length - 1].daily_count;
    
    if (lastDay > firstDay * 1.5) {
      patterns.push('Growing engagement over time');
    } else if (lastDay < firstDay * 0.5) {
      patterns.push('Declining engagement over time');
    }
    
    // Check sentiment trend
    const sentimentTrend = trendData.map(d => d.daily_sentiment);
    const sentimentImproving = sentimentTrend[sentimentTrend.length - 1] > sentimentTrend[0];
    
    if (sentimentImproving) {
      patterns.push('Improving sentiment over time');
    }
    
    return patterns;
  }

  calculateMomentum(trendData) {
    if (trendData.length < 2) return 'stable';
    
    const recentDays = trendData.slice(-3);
    const earlierDays = trendData.slice(0, 3);
    
    const recentAvg = recentDays.reduce((sum, d) => sum + d.daily_count, 0) / recentDays.length;
    const earlierAvg = earlierDays.reduce((sum, d) => sum + d.daily_count, 0) / earlierDays.length;
    
    if (recentAvg > earlierAvg * 1.5) return 'accelerating';
    if (recentAvg < earlierAvg * 0.5) return 'decelerating';
    return 'stable';
  }

  async findHighEngagementPositive(videoId) {
    const query = `
      SELECT comment_text, author, likes
      FROM youtube_comment_embeddings
      WHERE video_id = ? AND sentiment_score > 0.3 AND likes > 10
      ORDER BY likes DESC
      LIMIT 20
    `;
    
    return await this.tidbService.query(query, [videoId]);
  }

  groupFeatures(features) {
    const grouped = {};
    
    features.forEach(f => {
      const key = f.feature.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          count: 0,
          category: f.category,
          examples: []
        };
      }
      grouped[key].count++;
      if (grouped[key].examples.length < 3) {
        grouped[key].examples.push(f.evidence);
      }
    });
    
    return grouped;
  }

  groupImprovements(improvements) {
    const grouped = {};
    
    improvements.forEach(i => {
      const key = i.area.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          count: 0,
          category: i.category,
          examples: []
        };
      }
      grouped[key].count++;
      if (grouped[key].examples.length < 3) {
        grouped[key].examples.push(i.evidence);
      }
    });
    
    return grouped;
  }

  generateFeatureSummary(groupedFeatures) {
    const total = Object.values(groupedFeatures).reduce((sum, f) => sum + f.count, 0);
    const topFeature = Object.entries(groupedFeatures)
      .sort((a, b) => b[1].count - a[1].count)[0];
    
    return {
      totalMentions: total,
      mostLovedFeature: topFeature ? topFeature[0] : 'Not identified',
      featureCategories: [...new Set(Object.values(groupedFeatures).map(f => f.category))]
    };
  }

  generateImprovementSummary(groupedImprovements) {
    const total = Object.values(groupedImprovements).reduce((sum, i) => sum + i.count, 0);
    const topImprovement = Object.entries(groupedImprovements)
      .sort((a, b) => b[1].count - a[1].count)[0];
    
    return {
      totalSuggestions: total,
      priorityImprovement: topImprovement ? topImprovement[0] : 'Not identified',
      improvementCategories: [...new Set(Object.values(groupedImprovements).map(i => i.category))]
    };
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
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InsightGenerationAgent;
}