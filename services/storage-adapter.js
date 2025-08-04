// Storage Adapter
// Provides unified interface for TiDB and local browser storage

class StorageAdapter {
  constructor(config = {}) {
    this.mode = config.mode || 'auto'; // 'tidb', 'local', or 'auto'
    this.tidbService = null;
    this.isConnected = false;
    this.storageType = 'local'; // Default to local
    
    // Local storage keys
    this.STORAGE_KEYS = {
      EMBEDDINGS: 'youtube_embeddings',
      PATTERNS: 'comment_patterns',
      CACHE: 'analysis_cache',
      OPPORTUNITIES: 'business_opportunities',
      CONFIG: 'storage_config'
    };
    
    this.initialize(config);
  }

  async initialize(config) {
    console.log('\n=== INITIALIZING STORAGE SYSTEM ===');
    console.log(`📍 Requested Mode: ${this.mode.toUpperCase()}`);
    
    if (this.mode === 'local') {
      console.log('\n📍 STEP 1: CONFIGURING LOCAL STORAGE');
      this.storageType = 'local';
      console.log('💾 Storage Type: LOCAL BROWSER STORAGE');
      console.log('📦 Location: Browser localStorage');
      console.log('⚡ API Calls: NONE for storage operations');
      console.log('🔒 Persistence: Until manually cleared');
      console.log('✅ LOCAL STORAGE READY\n');
      return;
    }
    
    if (this.mode === 'tidb' || this.mode === 'auto') {
      try {
        // Try to initialize TiDB
        if (typeof TiDBService !== 'undefined') {
          console.log('\n📍 STEP 1: CONNECTING TO TIDB');
          console.log('🌐 CALLING TIDB CONNECTION API...');
          console.log('🔗 Endpoint: gateway01.us-east-1.prod.aws.tidbcloud.com');
          console.log('🔐 Database: youtube-comments-analytics');
          
          this.tidbService = new TiDBService(config.tidb || {});
          await this.tidbService.connect();
          
          this.isConnected = true;
          this.storageType = 'tidb';
          console.log('✅ TIDB CONNECTION SUCCESSFUL');
          console.log('☁️ Storage Type: TIDB CLOUD DATABASE');
          console.log('🚀 Features: Native vector search, unlimited storage');
          console.log('📡 All storage operations will use TIDB API\n');
        } else {
          throw new Error('TiDB service not available');
        }
      } catch (error) {
        console.log('\n❌ TIDB CONNECTION FAILED');
        console.log(`📍 Error: ${error.message}`);
        console.log('\n📍 STEP 2: FALLBACK TO LOCAL STORAGE');
        this.storageType = 'local';
        this.isConnected = false;
        console.log('💾 Storage Type: LOCAL BROWSER STORAGE (FALLBACK)');
        console.log('📦 Location: Browser localStorage');
        console.log('⚠️ Limitation: ~5MB storage capacity');
        console.log('✅ FALLBACK COMPLETE - USING LOCAL STORAGE\n');
      }
    }
  }

  // Unified storage methods
  async storeCommentEmbedding(comment, embedding) {
    console.log(`💾 Storing embedding for comment: "${comment.text?.substring(0, 30)}..."`);
    
    if (this.storageType === 'tidb' && this.tidbService) {
      console.log('☁️ Storing in TiDB cloud database...');
      const result = await this.tidbService.storeCommentEmbedding(comment, embedding);
      console.log('✅ Stored in TiDB successfully');
      return result;
    } else {
      console.log('📦 Storing in LOCAL browser storage...');
      const result = await this.storeCommentEmbeddingLocal(comment, embedding);
      console.log('✅ Stored in localStorage successfully');
      return result;
    }
  }

  async storeCommentEmbeddingLocal(comment, embedding) {
    try {
      const key = `${this.STORAGE_KEYS.EMBEDDINGS}_${comment.videoId}`;
      const stored = await this.getLocalData(key) || { embeddings: {} };
      
      const embeddingId = `${comment.videoId}_${comment.commentId}`;
      stored.embeddings[embeddingId] = {
        ...comment,
        embedding: Array.from(embedding), // Ensure it's an array
        storedAt: Date.now()
      };
      
      // Limit storage size (keep last 1000 embeddings per video)
      const embeddingKeys = Object.keys(stored.embeddings);
      if (embeddingKeys.length > 1000) {
        const sortedKeys = embeddingKeys.sort((a, b) => 
          stored.embeddings[a].storedAt - stored.embeddings[b].storedAt
        );
        const toRemove = sortedKeys.slice(0, embeddingKeys.length - 1000);
        toRemove.forEach(key => delete stored.embeddings[key]);
      }
      
      await this.setLocalData(key, stored);
      return { success: true };
    } catch (error) {
      console.error('Local storage error:', error);
      return { success: false, error: error.message };
    }
  }

  async batchInsertCommentEmbeddings(comments) {
    if (this.storageType === 'tidb' && this.tidbService) {
      return await this.tidbService.batchInsertCommentEmbeddings(comments);
    } else {
      // Local storage batch insert
      const results = await Promise.all(
        comments.map(comment => 
          this.storeCommentEmbeddingLocal(comment, comment.embedding)
        )
      );
      return { 
        success: results.every(r => r.success),
        stored: results.filter(r => r.success).length 
      };
    }
  }

  async searchSimilarComments(embedding, videoId, threshold = 0.8, limit = 10) {
    if (this.storageType === 'tidb' && this.tidbService) {
      return await this.tidbService.searchSimilarComments(embedding, videoId, threshold, limit);
    } else {
      return await this.searchSimilarCommentsLocal(embedding, videoId, threshold, limit);
    }
  }

  async searchSimilarCommentsLocal(targetEmbedding, videoId, threshold = 0.8, limit = 10) {
    try {
      const key = `${this.STORAGE_KEYS.EMBEDDINGS}_${videoId}`;
      const stored = await this.getLocalData(key);
      
      if (!stored || !stored.embeddings) {
        return [];
      }
      
      // Calculate similarities
      const results = [];
      for (const [id, data] of Object.entries(stored.embeddings)) {
        if (data.embedding && Array.isArray(data.embedding)) {
          const similarity = this.cosineSimilarity(targetEmbedding, data.embedding);
          if (similarity >= threshold) {
            results.push({
              comment_id: data.commentId,
              comment_text: data.text,
              author: data.author,
              similarity_score: similarity,
              sentiment_score: data.sentimentScore || 0,
              engagement_metrics: data.engagementMetrics || {}
            });
          }
        }
      }
      
      // Sort by similarity and limit
      return results
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit);
      
    } catch (error) {
      console.error('Local search error:', error);
      return [];
    }
  }

  async storePatternEmbedding(patternType, embedding, examples) {
    if (this.storageType === 'tidb' && this.tidbService) {
      return await this.tidbService.storePatternEmbedding(patternType, embedding, examples);
    } else {
      return await this.storePatternEmbeddingLocal(patternType, embedding, examples);
    }
  }

  async storePatternEmbeddingLocal(patternType, embedding, examples) {
    try {
      const patterns = await this.getLocalData(this.STORAGE_KEYS.PATTERNS) || {};
      
      patterns[patternType] = {
        embedding: Array.from(embedding),
        examples: examples,
        updatedAt: Date.now()
      };
      
      await this.setLocalData(this.STORAGE_KEYS.PATTERNS, patterns);
      return { success: true };
    } catch (error) {
      console.error('Pattern storage error:', error);
      return { success: false, error: error.message };
    }
  }

  async findPatternMatches(videoId, patternType) {
    if (this.storageType === 'tidb' && this.tidbService) {
      return await this.tidbService.findPatternMatches(videoId, patternType);
    } else {
      return await this.findPatternMatchesLocal(videoId, patternType);
    }
  }

  async findPatternMatchesLocal(videoId, patternType) {
    try {
      // Get pattern embedding
      const patterns = await this.getLocalData(this.STORAGE_KEYS.PATTERNS) || {};
      const pattern = patterns[patternType];
      
      if (!pattern || !pattern.embedding) {
        return [];
      }
      
      // Search for similar comments
      return await this.searchSimilarCommentsLocal(
        pattern.embedding, 
        videoId, 
        0.7, // Lower threshold for pattern matching
        20
      );
      
    } catch (error) {
      console.error('Pattern match error:', error);
      return [];
    }
  }

  async cacheAnalysis(videoId, analysisData) {
    if (this.storageType === 'tidb' && this.tidbService) {
      return await this.tidbService.cacheAnalysis(videoId, analysisData);
    } else {
      return await this.cacheAnalysisLocal(videoId, analysisData);
    }
  }

  async cacheAnalysisLocal(videoId, analysisData) {
    try {
      const cache = await this.getLocalData(this.STORAGE_KEYS.CACHE) || {};
      
      cache[videoId] = {
        data: analysisData,
        cachedAt: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
      };
      
      // Clean expired entries
      const now = Date.now();
      Object.keys(cache).forEach(key => {
        if (cache[key].expiresAt < now) {
          delete cache[key];
        }
      });
      
      await this.setLocalData(this.STORAGE_KEYS.CACHE, cache);
      return { success: true };
    } catch (error) {
      console.error('Cache storage error:', error);
      return { success: false, error: error.message };
    }
  }

  async getCachedAnalysis(videoId) {
    if (this.storageType === 'tidb' && this.tidbService) {
      return await this.tidbService.getCachedAnalysis(videoId);
    } else {
      return await this.getCachedAnalysisLocal(videoId);
    }
  }

  async isVideoRecentlyAnalyzed(videoId, dayThreshold = 7) {
    console.log(`🔍 Checking if video ${videoId} was analyzed in last ${dayThreshold} days...`);
    
    if (this.storageType === 'tidb' && this.tidbService) {
      const result = await this.tidbService.isVideoRecentlyAnalyzed(videoId, dayThreshold);
      if (result.isRecent) {
        console.log(`✅ Video WAS analyzed recently (${result.lastAnalyzed})`);
        console.log(`🚫 NO API CALLS NEEDED - Using cached data with ${result.commentCount} comments`);
      } else {
        console.log(`❌ Video NOT analyzed recently - Will fetch new data`);
        console.log(`🌐 API CALLS WILL BE MADE to YouTube and embedding service`);
      }
      return result;
    } else {
      const result = await this.isVideoRecentlyAnalyzedLocal(videoId, dayThreshold);
      if (result.isRecent) {
        console.log(`✅ Video WAS analyzed recently (${result.lastAnalyzed})`);
        console.log(`🚫 NO API CALLS NEEDED - Using cached data with ${result.commentCount} comments`);
      } else {
        console.log(`❌ Video NOT analyzed recently - Will fetch new data`);
        console.log(`🌐 YouTube API WILL BE CALLED to fetch comments`);
      }
      return result;
    }
  }

  async isVideoRecentlyAnalyzedLocal(videoId, dayThreshold = 7) {
    try {
      // Check in cache
      const cache = await this.getLocalData(this.STORAGE_KEYS.CACHE) || {};
      const cached = cache[videoId];
      
      if (cached) {
        const daysSinceAnalysis = (Date.now() - cached.cachedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceAnalysis < dayThreshold) {
          return {
            isRecent: true,
            lastAnalyzed: new Date(cached.cachedAt),
            commentCount: cached.data?.statistics?.totalComments || 0
          };
        }
      }
      
      // Also check embeddings storage
      const embeddingsKey = `${this.STORAGE_KEYS.EMBEDDINGS}_${videoId}`;
      const embeddings = await this.getLocalData(embeddingsKey);
      
      if (embeddings && embeddings.embeddings) {
        const embeddingValues = Object.values(embeddings.embeddings);
        if (embeddingValues.length > 0) {
          const latestTimestamp = Math.max(...embeddingValues.map(e => e.storedAt || 0));
          const daysSinceStorage = (Date.now() - latestTimestamp) / (1000 * 60 * 60 * 24);
          
          if (daysSinceStorage < dayThreshold) {
            return {
              isRecent: true,
              lastAnalyzed: new Date(latestTimestamp),
              commentCount: embeddingValues.length
            };
          }
        }
      }
      
      return { isRecent: false };
    } catch (error) {
      console.error('Error checking recent analysis:', error);
      return { isRecent: false };
    }
  }

  async hasRecentComments(videoId, dayThreshold = 7) {
    if (this.storageType === 'tidb' && this.tidbService) {
      return await this.tidbService.hasRecentComments(videoId, dayThreshold);
    } else {
      // For local storage, use the same check as isVideoRecentlyAnalyzed
      const result = await this.isVideoRecentlyAnalyzedLocal(videoId, dayThreshold);
      return {
        hasComments: result.isRecent,
        commentCount: result.commentCount || 0,
        latestComment: result.lastAnalyzed
      };
    }
  }

  async getCachedAnalysisLocal(videoId) {
    try {
      const cache = await this.getLocalData(this.STORAGE_KEYS.CACHE) || {};
      const cached = cache[videoId];
      
      if (!cached || cached.expiresAt < Date.now()) {
        return null;
      }
      
      return {
        analysis_data: cached.data,
        cache_expiry: new Date(cached.expiresAt)
      };
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  async clusterComments(videoId, numClusters = 5) {
    if (this.storageType === 'tidb' && this.tidbService) {
      return await this.tidbService.clusterComments(videoId, numClusters);
    } else {
      return await this.clusterCommentsLocal(videoId, numClusters);
    }
  }

  async clusterCommentsLocal(videoId, numClusters = 5) {
    try {
      const key = `${this.STORAGE_KEYS.EMBEDDINGS}_${videoId}`;
      const stored = await this.getLocalData(key);
      
      if (!stored || !stored.embeddings) {
        return [];
      }
      
      // Simple k-means clustering
      const embeddings = Object.entries(stored.embeddings)
        .filter(([_, data]) => data.embedding && Array.isArray(data.embedding))
        .map(([id, data]) => ({
          id,
          embedding: data.embedding,
          text: data.text
        }));
      
      if (embeddings.length < numClusters) {
        return [{
          cluster_id: 0,
          size: embeddings.length,
          examples: embeddings.slice(0, 3).map(e => e.text)
        }];
      }
      
      // Simplified clustering (random assignment for demo)
      const clusters = Array(numClusters).fill(null).map(() => []);
      embeddings.forEach((item, index) => {
        clusters[index % numClusters].push(item);
      });
      
      return clusters.map((cluster, index) => ({
        cluster_id: index,
        size: cluster.length,
        examples: cluster.slice(0, 3).map(c => c.text)
      }));
      
    } catch (error) {
      console.error('Clustering error:', error);
      return [];
    }
  }

  async findControversialComments(videoId) {
    if (this.storageType === 'tidb' && this.tidbService) {
      return await this.tidbService.findControversialComments(videoId);
    } else {
      // Simplified local version
      return await this.findControversialCommentsLocal(videoId);
    }
  }

  async findControversialCommentsLocal(videoId) {
    try {
      const key = `${this.STORAGE_KEYS.EMBEDDINGS}_${videoId}`;
      const stored = await this.getLocalData(key);
      
      if (!stored || !stored.embeddings) {
        return [];
      }
      
      // Find comments with negative sentiment and high engagement
      const controversial = [];
      for (const [id, data] of Object.entries(stored.embeddings)) {
        if (data.sentimentScore < -0.3 && data.engagementMetrics?.replyCount > 3) {
          controversial.push({
            comment1_id: data.commentId,
            comment1_text: data.text,
            author1: data.author,
            debate_count: data.engagementMetrics.replyCount || 0,
            avg_opposition_score: Math.abs(data.sentimentScore)
          });
        }
      }
      
      return controversial
        .sort((a, b) => b.debate_count - a.debate_count)
        .slice(0, 10);
      
    } catch (error) {
      console.error('Controversial detection error:', error);
      return [];
    }
  }

  // Browser storage helpers
  async getLocalData(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  async setLocalData(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Utility functions
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

  // Status methods
  getStorageType() {
    return this.storageType;
  }

  isUsingTiDB() {
    return this.storageType === 'tidb' && this.isConnected;
  }

  async getStorageStats() {
    if (this.storageType === 'local') {
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      
      return {
        type: 'local',
        usage: usage,
        quota: quota,
        percentUsed: ((usage / quota) * 100).toFixed(2) + '%'
      };
    } else {
      return {
        type: 'tidb',
        connected: this.isConnected,
        host: this.tidbService?.config?.host
      };
    }
  }

  // Cleanup expired data
  async cleanupExpiredData(daysToKeep = 7) {
    if (this.storageType === 'tidb' && this.tidbService) {
      return await this.cleanupExpiredDataTiDB(daysToKeep);
    } else {
      return await this.cleanupExpiredDataLocal(daysToKeep);
    }
  }

  async cleanupExpiredDataTiDB(daysToKeep) {
    try {
      // Clean expired cache
      const cleanCacheQuery = `
        DELETE FROM analysis_cache 
        WHERE cache_expiry < NOW() 
        OR last_analyzed < DATE_SUB(NOW(), INTERVAL ? DAY)
      `;
      await this.tidbService.query(cleanCacheQuery, [daysToKeep]);
      
      // Clean old embeddings
      const cleanEmbeddingsQuery = `
        DELETE FROM youtube_comment_embeddings 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `;
      await this.tidbService.query(cleanEmbeddingsQuery, [daysToKeep * 2]); // Keep embeddings longer
      
      console.log('✅ TiDB cleanup completed');
      return { success: true };
    } catch (error) {
      console.error('TiDB cleanup error:', error);
      return { success: false, error: error.message };
    }
  }

  async cleanupExpiredDataLocal(daysToKeep) {
    try {
      const now = Date.now();
      const expiryTime = daysToKeep * 24 * 60 * 60 * 1000;
      let cleanedCount = 0;
      
      // Clean cache
      const cache = await this.getLocalData(this.STORAGE_KEYS.CACHE) || {};
      Object.keys(cache).forEach(videoId => {
        if (now - cache[videoId].cachedAt > expiryTime) {
          delete cache[videoId];
          cleanedCount++;
        }
      });
      await this.setLocalData(this.STORAGE_KEYS.CACHE, cache);
      
      // Clean old embeddings
      const allKeys = await new Promise(resolve => {
        chrome.storage.local.get(null, items => resolve(Object.keys(items)));
      });
      
      const embeddingKeys = allKeys.filter(key => key.startsWith(this.STORAGE_KEYS.EMBEDDINGS));
      for (const key of embeddingKeys) {
        const data = await this.getLocalData(key);
        if (data && data.embeddings) {
          let hasOldData = false;
          Object.keys(data.embeddings).forEach(id => {
            if (now - (data.embeddings[id].storedAt || 0) > expiryTime) {
              delete data.embeddings[id];
              hasOldData = true;
            }
          });
          
          if (hasOldData) {
            if (Object.keys(data.embeddings).length === 0) {
              // Remove entire key if no embeddings left
              await new Promise(resolve => {
                chrome.storage.local.remove(key, resolve);
              });
              cleanedCount++;
            } else {
              await this.setLocalData(key, data);
            }
          }
        }
      }
      
      console.log(`✅ Local cleanup completed: ${cleanedCount} items removed`);
      return { success: true, cleaned: cleanedCount };
    } catch (error) {
      console.error('Local cleanup error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export for Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageAdapter;
} else {
  window.StorageAdapter = StorageAdapter;
}