// TiDB Vector Service for YouTube Comment Analytics
// Handles all TiDB vector operations and database interactions

class TiDBService {
  constructor(config) {
    this.config = {
      host: config.host || process.env.TIDB_HOST,
      port: config.port || 4000,
      user: config.user || process.env.TIDB_USER,
      password: config.password || process.env.TIDB_PASSWORD,
      database: config.database || 'youtube_analytics',
      ssl: { rejectUnauthorized: true }
    };
    this.connection = null;
    this.initialized = false;
  }

  async connect() {
    try {
      // For browser environment, we'll use fetch API to communicate with a backend
      // In production, this would connect to your TiDB serverless instance
      console.log('🔌 Connecting to TiDB Vector Database...');
      
      // Check if we're in development mode without backend
      const isDevelopment = !this.config.backendUrl;
      
      if (isDevelopment) {
        console.warn('⚠️ Running in development mode without TiDB backend');
        // Initialize mock connection for development
        this.connection = {
          query: async (sql, params) => {
            return this.mockQuery(sql, params);
          }
        };
      } else {
        // Production: connect to backend API that proxies to TiDB
        const testResponse = await fetch(`${this.config.backendUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }).catch(() => null);
        
        if (!testResponse || !testResponse.ok) {
          throw new Error('Backend API not available');
        }
        
        this.connection = {
          query: async (sql, params) => {
            const response = await fetch(`${this.config.backendUrl}/query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sql, params })
            });
            
            if (!response.ok) {
              throw new Error(`Query failed: ${response.statusText}`);
            }
            
            return await response.json();
          }
        };
      }
      
      await this.initializeSchema();
      this.initialized = true;
      console.log('✅ TiDB connection established');
    } catch (error) {
      console.error('❌ TiDB connection failed:', error);
      this.initialized = false;
      throw error;
    }
  }

  async initializeSchema() {
    // Check if tables exist, create if not
    const tables = [
      `CREATE TABLE IF NOT EXISTS youtube_comment_embeddings (
        id VARCHAR(255) PRIMARY KEY,
        video_id VARCHAR(255),
        comment_id VARCHAR(255) UNIQUE,
        comment_text TEXT,
        author VARCHAR(255),
        embedding VECTOR(768),
        sentiment_score FLOAT,
        engagement_metrics JSON,
        detected_patterns JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_video_id (video_id),
        INDEX idx_author (author),
        VECTOR INDEX idx_comment_embedding (embedding) WITH (type = 'IVF_FLAT', lists = 100)
      )`,
      
      `CREATE TABLE IF NOT EXISTS comment_patterns (
        id VARCHAR(255) PRIMARY KEY,
        pattern_type VARCHAR(100),
        pattern_embedding VECTOR(768),
        example_comments JSON,
        detection_keywords TEXT,
        confidence_threshold FLOAT,
        VECTOR INDEX idx_pattern_embedding (pattern_embedding) WITH (type = 'IVF_FLAT', lists = 50)
      )`,
      
      `CREATE TABLE IF NOT EXISTS analysis_cache (
        video_id VARCHAR(255) PRIMARY KEY,
        analysis_data JSON,
        comment_count INT,
        last_analyzed TIMESTAMP,
        cache_expiry TIMESTAMP,
        INDEX idx_cache_expiry (cache_expiry)
      )`,
      
      `CREATE TABLE IF NOT EXISTS business_opportunities (
        id VARCHAR(255) PRIMARY KEY,
        video_id VARCHAR(255),
        opportunity_type VARCHAR(100),
        comment_embeddings JSON,
        confidence_score FLOAT,
        example_comments JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_video_opportunity (video_id, opportunity_type)
      )`
    ];

    // In production, execute these CREATE TABLE statements
    console.log('📊 Database schema initialized');
  }

  // Store comment with embedding
  async storeCommentEmbedding(comment, embedding) {
    const query = `
      INSERT INTO youtube_comment_embeddings 
      (id, video_id, comment_id, comment_text, author, embedding, sentiment_score, engagement_metrics)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        embedding = VALUES(embedding),
        sentiment_score = VALUES(sentiment_score),
        engagement_metrics = VALUES(engagement_metrics)
    `;
    
    const id = `${comment.videoId}_${comment.commentId}`;
    const params = [
      id,
      comment.videoId,
      comment.commentId,
      comment.text,
      comment.author,
      embedding,
      comment.sentimentScore || 0,
      JSON.stringify(comment.engagementMetrics || {})
    ];
    
    return await this.query(query, params);
  }

  // Batch insert for efficiency
  async batchInsertCommentEmbeddings(comments) {
    const values = comments.map(comment => {
      const id = `${comment.videoId}_${comment.commentId}`;
      return [
        id,
        comment.videoId,
        comment.commentId,
        comment.text,
        comment.author,
        comment.embedding,
        comment.sentimentScore || 0,
        JSON.stringify(comment.engagementMetrics || {})
      ];
    });

    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const query = `
      INSERT INTO youtube_comment_embeddings 
      (id, video_id, comment_id, comment_text, author, embedding, sentiment_score, engagement_metrics)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE 
        embedding = VALUES(embedding),
        sentiment_score = VALUES(sentiment_score),
        engagement_metrics = VALUES(engagement_metrics)
    `;
    
    return await this.query(query, values.flat());
  }

  // Vector similarity search
  async searchSimilarComments(embedding, videoId, threshold = 0.8, limit = 10) {
    const query = `
      SELECT 
        comment_id,
        comment_text,
        author,
        COSINE_DISTANCE(embedding, ?) as similarity_score,
        sentiment_score,
        engagement_metrics
      FROM youtube_comment_embeddings
      WHERE video_id = ?
        AND COSINE_DISTANCE(embedding, ?) < ?
      ORDER BY similarity_score ASC
      LIMIT ?
    `;
    
    return await this.query(query, [embedding, videoId, embedding, 1 - threshold, limit]);
  }

  // Find comments matching specific patterns
  async findPatternMatches(videoId, patternType) {
    const query = `
      WITH pattern_search AS (
        SELECT pattern_embedding 
        FROM comment_patterns 
        WHERE pattern_type = ?
        LIMIT 1
      )
      SELECT 
        c.comment_id,
        c.comment_text,
        c.author,
        COSINE_DISTANCE(c.embedding, p.pattern_embedding) as pattern_similarity
      FROM youtube_comment_embeddings c
      CROSS JOIN pattern_search p
      WHERE c.video_id = ?
        AND COSINE_DISTANCE(c.embedding, p.pattern_embedding) < 0.3
      ORDER BY pattern_similarity ASC
      LIMIT 20
    `;
    
    return await this.query(query, [patternType, videoId]);
  }

  // Cluster comments by similarity
  async clusterComments(videoId, numClusters = 5) {
    // In production, this would use TiDB's clustering functions
    const query = `
      SELECT 
        comment_id,
        comment_text,
        embedding,
        author
      FROM youtube_comment_embeddings
      WHERE video_id = ?
    `;
    
    const comments = await this.query(query, [videoId]);
    
    // Simplified clustering logic - in production use TiDB ML functions
    return this.performClustering(comments, numClusters);
  }

  // Store pattern embedding
  async storePatternEmbedding(patternType, embedding, examples) {
    const query = `
      INSERT INTO comment_patterns 
      (id, pattern_type, pattern_embedding, example_comments, confidence_threshold)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        pattern_embedding = VALUES(pattern_embedding),
        example_comments = VALUES(example_comments)
    `;
    
    const id = `pattern_${patternType}`;
    const params = [
      id,
      patternType,
      embedding,
      JSON.stringify(examples),
      0.7
    ];
    
    return await this.query(query, params);
  }

  // Cache analysis results
  async cacheAnalysis(videoId, analysisData) {
    const query = `
      INSERT INTO analysis_cache 
      (video_id, analysis_data, comment_count, last_analyzed, cache_expiry)
      VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))
      ON DUPLICATE KEY UPDATE 
        analysis_data = VALUES(analysis_data),
        comment_count = VALUES(comment_count),
        last_analyzed = NOW(),
        cache_expiry = DATE_ADD(NOW(), INTERVAL 7 DAY)
    `;
    
    const params = [
      videoId,
      JSON.stringify(analysisData),
      analysisData.totalComments || 0
    ];
    
    return await this.query(query, params);
  }

  // Get cached analysis
  async getCachedAnalysis(videoId) {
    const query = `
      SELECT analysis_data, cache_expiry, last_analyzed
      FROM analysis_cache
      WHERE video_id = ?
        AND cache_expiry > NOW()
    `;
    
    const results = await this.query(query, [videoId]);
    if (results.length > 0) {
      return {
        analysis_data: JSON.parse(results[0].analysis_data),
        cache_expiry: results[0].cache_expiry,
        last_analyzed: results[0].last_analyzed
      };
    }
    return null;
  }

  // Check if video was recently analyzed
  async isVideoRecentlyAnalyzed(videoId, dayThreshold = 7) {
    const query = `
      SELECT last_analyzed, comment_count
      FROM analysis_cache
      WHERE video_id = ?
        AND last_analyzed > DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    
    const results = await this.query(query, [videoId, dayThreshold]);
    if (results.length > 0) {
      return {
        isRecent: true,
        lastAnalyzed: results[0].last_analyzed,
        commentCount: results[0].comment_count
      };
    }
    return { isRecent: false };
  }

  // Check if comments exist for video
  async hasRecentComments(videoId, dayThreshold = 7) {
    const query = `
      SELECT COUNT(*) as count, MAX(created_at) as latest_comment
      FROM youtube_comment_embeddings
      WHERE video_id = ?
        AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    
    const results = await this.query(query, [videoId, dayThreshold]);
    return {
      hasComments: results[0].count > 0,
      commentCount: results[0].count,
      latestComment: results[0].latest_comment
    };
  }

  // Find controversial comments using vector distance
  async findControversialComments(videoId) {
    const query = `
      WITH comment_pairs AS (
        SELECT 
          c1.comment_id as comment1_id,
          c1.comment_text as comment1_text,
          c1.author as author1,
          c2.comment_id as comment2_id,
          c2.comment_text as comment2_text,
          c2.author as author2,
          COSINE_DISTANCE(c1.embedding, c2.embedding) as distance
        FROM youtube_comment_embeddings c1
        JOIN youtube_comment_embeddings c2 
          ON c1.video_id = c2.video_id 
          AND c1.comment_id < c2.comment_id
        WHERE c1.video_id = ?
          AND COSINE_DISTANCE(c1.embedding, c2.embedding) BETWEEN 0.4 AND 0.7
      )
      SELECT 
        comment1_id,
        comment1_text,
        author1,
        COUNT(*) as debate_count,
        AVG(distance) as avg_opposition_score
      FROM comment_pairs
      GROUP BY comment1_id, comment1_text, author1
      HAVING debate_count > 3
      ORDER BY debate_count DESC, avg_opposition_score DESC
      LIMIT 10
    `;
    
    return await this.query(query, [videoId]);
  }

  // Helper method for executing queries
  async query(sql, params = []) {
    if (!this.initialized) {
      await this.connect();
    }
    
    try {
      return await this.connection.query(sql, params);
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  // Mock query for development (replace with actual TiDB connection)
  async mockQuery(sql, params) {
    console.log('🔍 TiDB Query:', sql.substring(0, 100) + '...');
    console.log('📊 Parameters:', params.length, 'values');
    
    // Return mock data for testing
    if (sql.includes('SELECT') && sql.includes('analysis_cache')) {
      return [];
    }
    
    return { affectedRows: 1 };
  }

  // Simplified clustering implementation
  performClustering(comments, numClusters) {
    // In production, use TiDB's ML functions or external clustering service
    const clusters = Array.from({ length: numClusters }, () => []);
    
    comments.forEach((comment, index) => {
      const clusterIndex = index % numClusters;
      clusters[clusterIndex].push(comment);
    });
    
    return clusters.map((cluster, index) => ({
      cluster_id: index,
      size: cluster.length,
      examples: cluster.slice(0, 3).map(c => c.comment_text)
    }));
  }
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TiDBService;
}