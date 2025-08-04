// Comment Ingestion Agent
// Responsible for fetching and preparing YouTube comments for vector processing

class CommentIngestionAgent {
  constructor(tidbService) {
    this.tidbService = tidbService;
    this.batchSize = 100;
    this.maxCommentsPerVideo = 10000; // Limit for performance
  }

  async ingestComments(videoId, existingComments = []) {
    console.log('📥 Comment Ingestion Agent: Starting ingestion for video', videoId);
    
    try {
      // If we already have comments from the YouTube API, use them
      if (existingComments && existingComments.length > 0) {
        console.log(`📊 Processing ${existingComments.length} existing comments`);
        return await this.processComments(videoId, existingComments);
      }
      
      // Otherwise, we would fetch from YouTube API (already handled in content-script)
      console.log('⚠️ No comments provided, expecting pre-fetched data');
      return { success: false, message: 'Comments should be pre-fetched by content script' };
      
    } catch (error) {
      console.error('❌ Comment ingestion failed:', error);
      return { success: false, error: error.message };
    }
  }

  async processComments(videoId, comments) {
    // Prepare comments for vector processing
    const processedComments = [];
    const stats = {
      total: comments.length,
      processed: 0,
      batches: 0,
      errors: 0
    };

    // Process in batches
    for (let i = 0; i < comments.length; i += this.batchSize) {
      const batch = comments.slice(i, Math.min(i + this.batchSize, comments.length));
      
      try {
        const preparedBatch = this.prepareBatch(videoId, batch);
        processedComments.push(...preparedBatch);
        
        // Send batch to vector processing agent
        await this.sendToVectorProcessing(preparedBatch);
        
        stats.processed += batch.length;
        stats.batches++;
        
        console.log(`📦 Processed batch ${stats.batches}: ${stats.processed}/${stats.total} comments`);
        
      } catch (error) {
        console.error('❌ Batch processing error:', error);
        stats.errors += batch.length;
      }
    }

    console.log('✅ Comment ingestion complete:', stats);
    return {
      success: true,
      stats,
      processedComments: processedComments.slice(0, 100) // Return sample for verification
    };
  }

  prepareBatch(videoId, comments) {
    return comments.map(comment => {
      // Extract relevant data from YouTube comment structure
      const snippet = comment.snippet || comment;
      
      return {
        videoId,
        commentId: comment.id || this.generateCommentId(snippet),
        text: this.cleanCommentText(snippet.textDisplay || snippet.textOriginal || ''),
        author: snippet.authorDisplayName || 'Unknown',
        authorChannelId: snippet.authorChannelId?.value || null,
        likes: snippet.likeCount || 0,
        publishedAt: snippet.publishedAt || new Date().toISOString(),
        isReply: !!snippet.parentId,
        // Additional metadata for analysis
        metadata: {
          canRate: snippet.canRate,
          viewerRating: snippet.viewerRating,
          totalReplyCount: comment.totalReplyCount || 0,
          hasReplies: (comment.replies?.comments?.length || 0) > 0
        },
        // Initial analysis flags
        analysis: {
          length: (snippet.textDisplay || '').length,
          hasEmojis: this.containsEmojis(snippet.textDisplay || ''),
          hasUrls: this.containsUrls(snippet.textDisplay || ''),
          hasMentions: this.containsMentions(snippet.textDisplay || ''),
          language: this.detectLanguage(snippet.textDisplay || '')
        }
      };
    });
  }

  cleanCommentText(text) {
    // Clean and normalize comment text
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  containsEmojis(text) {
    // Check for emoji patterns
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return emojiRegex.test(text);
  }

  containsUrls(text) {
    // Check for URL patterns
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([^\s]+\.(com|org|net|io|co|tv)[^\s]*)/gi;
    return urlRegex.test(text);
  }

  containsMentions(text) {
    // Check for @mentions
    return /@[\w]+/.test(text);
  }

  detectLanguage(text) {
    // Simple language detection based on character sets
    const hasNonAscii = /[^\x00-\x7F]/.test(text);
    const hasCyrillic = /[\u0400-\u04FF]/.test(text);
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    const hasChinese = /[\u4E00-\u9FFF]/.test(text);
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
    
    if (hasCyrillic) return 'ru';
    if (hasArabic) return 'ar';
    if (hasChinese) return 'zh';
    if (hasJapanese) return 'ja';
    if (!hasNonAscii) return 'en';
    return 'other';
  }

  generateCommentId(snippet) {
    // Generate unique ID if not provided
    const text = snippet.textDisplay || snippet.textOriginal || '';
    const author = snippet.authorDisplayName || 'unknown';
    const timestamp = snippet.publishedAt || Date.now();
    
    return `${author}_${timestamp}_${text.substring(0, 20).replace(/\s/g, '_')}`;
  }

  async sendToVectorProcessing(comments) {
    // In a real implementation, this would send to the Vector Processing Agent
    // For now, we'll store a placeholder
    console.log(`🚀 Sending ${comments.length} comments to Vector Processing Agent`);
    
    // Simulate async processing
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ sent: comments.length });
      }, 100);
    });
  }

  // Extract key phrases for initial analysis
  extractKeyPhrases(text) {
    const phrases = [];
    
    // Business opportunity patterns
    const businessPatterns = [
      /i would pay for/gi,
      /please create a course/gi,
      /can you make a tutorial/gi,
      /where can i buy/gi,
      /is this available for purchase/gi
    ];
    
    businessPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        phrases.push({ type: 'business_opportunity', phrase: matches[0] });
      }
    });
    
    // Feature request patterns
    const featurePatterns = [
      /it would be (great|nice|awesome) if/gi,
      /can you add/gi,
      /please include/gi,
      /feature request/gi
    ];
    
    featurePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        phrases.push({ type: 'feature_request', phrase: matches[0] });
      }
    });
    
    return phrases;
  }

  // Analyze engagement metrics
  analyzeEngagement(comment) {
    const engagementScore = {
      likes: comment.likes || 0,
      hasReplies: comment.metadata.hasReplies,
      replyCount: comment.metadata.totalReplyCount || 0,
      isVerified: comment.authorChannelId !== null,
      textLength: comment.analysis.length,
      hasMedia: comment.analysis.hasUrls || comment.analysis.hasEmojis
    };
    
    // Calculate engagement level
    let level = 'low';
    if (engagementScore.likes > 100 || engagementScore.replyCount > 10) {
      level = 'high';
    } else if (engagementScore.likes > 10 || engagementScore.replyCount > 3) {
      level = 'medium';
    }
    
    return { ...engagementScore, level };
  }
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CommentIngestionAgent;
}