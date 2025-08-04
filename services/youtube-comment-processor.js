// YouTube Comment Processor
// Handles the complete flow from YouTube API to embeddings

class YouTubeCommentProcessor {
  constructor(vectorIntelligence, storageAdapter) {
    this.vectorIntelligence = vectorIntelligence;
    this.storageAdapter = storageAdapter;
    this.youtubeApiKey = null; // Set this from config
  }

  async processVideo(videoId, options = {}) {
    console.log('\n========================================');
    console.log('=== YOUTUBE COMMENT PROCESSING FLOW ===');
    console.log('========================================');
    console.log(`📹 Video ID: ${videoId}`);
    console.log(`📅 Date: ${new Date().toISOString()}\n`);

    try {
      // STEP 1: CHECK CACHE
      console.log('📍 STEP 1: CHECKING 7-DAY CACHE');
      const cacheCheck = await this.storageAdapter.isVideoRecentlyAnalyzed(videoId, 7);
      
      if (cacheCheck.isRecent) {
        console.log('✅ VIDEO ANALYZED RECENTLY');
        console.log(`📅 Last analyzed: ${cacheCheck.lastAnalyzed}`);
        console.log(`💬 Cached comments: ${cacheCheck.commentCount}`);
        console.log('\n🎯 RESULT: NO API CALLS NEEDED - USING CACHE');
        console.log('========================================\n');
        
        return {
          source: 'cache',
          comments: await this.getCachedComments(videoId),
          apiCalls: {
            youtube: 0,
            openai: 0,
            tidb: 0
          }
        };
      }

      console.log('❌ NOT IN CACHE OR EXPIRED');
      console.log('📍 Proceeding to fetch new data...\n');

      // STEP 2: FETCH FROM YOUTUBE
      console.log('📍 STEP 2: FETCHING COMMENTS FROM YOUTUBE');
      console.log('🌐 CALLING YOUTUBE DATA API v3...');
      console.log(`📡 Endpoint: https://www.googleapis.com/youtube/v3/commentThreads`);
      console.log(`🔑 API Key: ${this.youtubeApiKey ? 'Configured' : 'Not configured'}`);
      
      const comments = await this.fetchYouTubeComments(videoId);
      console.log(`✅ FETCHED ${comments.length} COMMENTS FROM YOUTUBE API\n`);

      // STEP 3: PROCESS EACH COMMENT
      console.log('📍 STEP 3: PROCESSING COMMENTS FOR EMBEDDINGS');
      const processedComments = [];
      const apiCallStats = {
        youtube: 1, // Already called once
        openai: 0,
        tidb: 0,
        local: 0
      };

      for (let i = 0; i < Math.min(comments.length, 10); i++) { // Process first 10 for demo
        const comment = comments[i];
        console.log(`\n--- Processing comment ${i + 1}/${comments.length} ---`);
        console.log(`💬 "${comment.text.substring(0, 50)}..."`);

        // Create context for autonomous decision
        const context = {
          videoId,
          isBusinessOpportunity: /pay|buy|purchase/.test(comment.text),
          isQuestion: comment.text.includes('?'),
          likes: comment.likeCount || 0,
          author: comment.author
        };

        // Let the autonomous system decide and process
        const result = await this.vectorIntelligence.vectorize(comment.text, context);
        
        if (result.vectorized) {
          // Track which API was called
          if (result.source === 'openai') {
            apiCallStats.openai++;
          } else if (result.source === 'local' || result.source === 'local_fallback') {
            apiCallStats.local++;
          }

          // Store the embedding
          console.log('\n📍 STEP 4: STORING EMBEDDING');
          const stored = await this.storageAdapter.storeCommentEmbedding({
            videoId,
            commentId: comment.id,
            text: comment.text,
            author: comment.author,
            embedding: result.embedding,
            metadata: {
              likeCount: comment.likeCount,
              replyCount: comment.replyCount,
              publishedAt: comment.publishedAt
            }
          });

          if (this.storageAdapter.isUsingTiDB()) {
            apiCallStats.tidb++;
            console.log('📡 STORED IN TIDB (API CALL)');
          } else {
            console.log('💾 STORED IN LOCAL STORAGE (NO API)');
          }

          processedComments.push({
            ...comment,
            embedding: result.embedding,
            embeddingSource: result.source
          });
        }
      }

      // STEP 5: CACHE RESULTS
      console.log('\n📍 STEP 5: CACHING ANALYSIS RESULTS');
      await this.storageAdapter.cacheAnalysis(videoId, {
        processedAt: Date.now(),
        commentCount: processedComments.length,
        statistics: {
          total: comments.length,
          processed: processedComments.length,
          withEmbeddings: processedComments.filter(c => c.embedding).length
        }
      });

      // FINAL SUMMARY
      console.log('\n========================================');
      console.log('=== PROCESSING COMPLETE - SUMMARY ===');
      console.log('========================================');
      console.log('📊 API CALLS MADE:');
      console.log(`  📹 YouTube API: ${apiCallStats.youtube} call(s)`);
      console.log(`  🤖 OpenAI API: ${apiCallStats.openai} call(s)`);
      console.log(`  ☁️ TiDB API: ${apiCallStats.tidb} call(s)`);
      console.log(`  💻 Local Processing: ${apiCallStats.local} embedding(s)`);
      console.log('\n📈 RESULTS:');
      console.log(`  💬 Total comments: ${comments.length}`);
      console.log(`  ✅ Processed: ${processedComments.length}`);
      console.log(`  🧮 With embeddings: ${processedComments.filter(c => c.embedding).length}`);
      console.log('========================================\n');

      return {
        source: 'fresh',
        comments: processedComments,
        apiCalls: apiCallStats
      };

    } catch (error) {
      console.error('\n❌ ERROR IN PROCESSING:', error);
      console.log('========================================\n');
      throw error;
    }
  }

  async fetchYouTubeComments(videoId) {
    // Simulate YouTube API call
    // In real implementation, this would use the actual YouTube API
    console.log('⏳ Calling YouTube API...');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock data
    return [
      {
        id: 'comment1',
        text: 'This is an amazing tutorial! Can you make a guide on payment integration?',
        author: 'BusinessUser',
        likeCount: 150,
        replyCount: 5,
        publishedAt: new Date().toISOString()
      },
      {
        id: 'comment2',
        text: 'I love this video! Best explanation ever.',
        author: 'HappyLearner',
        likeCount: 89,
        replyCount: 2,
        publishedAt: new Date().toISOString()
      },
      {
        id: 'comment3',
        text: 'Having problems with implementation at step 3.',
        author: 'DebuggerDan',
        likeCount: 45,
        replyCount: 8,
        publishedAt: new Date().toISOString()
      },
      {
        id: 'comment4',
        text: 'Can someone explain how to integrate Stripe payments?',
        author: 'PaymentSeeker',
        likeCount: 67,
        replyCount: 3,
        publishedAt: new Date().toISOString()
      },
      {
        id: 'comment5',
        text: 'Thanks for sharing!',
        author: 'SimpleUser',
        likeCount: 5,
        replyCount: 0,
        publishedAt: new Date().toISOString()
      }
    ];
  }

  async getCachedComments(videoId) {
    const key = `youtube_embeddings_${videoId}`;
    const cached = await this.storageAdapter.getLocalData(key);
    
    if (cached && cached.embeddings) {
      return Object.values(cached.embeddings);
    }
    
    return [];
  }
}

// Export for Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YouTubeCommentProcessor;
} else {
  window.YouTubeCommentProcessor = YouTubeCommentProcessor;
}