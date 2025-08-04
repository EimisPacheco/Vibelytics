# TiDB 2025 Hackathon: YouTube Comment Analytics with Vector Search

## Project Overview
Transform the YouTube Comment Analytics Chrome Extension into a powerful multi-agent system using TiDB's vector search capabilities to analyze comments semantically, detect patterns, and provide business insights through AI-powered embeddings.

## Key Innovation
Replace Google's embedding-001 API with TiDB's native vector search capabilities for semantic comment analysis, pattern detection, and business opportunity identification.

## Hackathon Requirements Alignment
- ✅ **TiDB Serverless with Vector Search**: Core database for comment embeddings and analysis
- ✅ **Multi-step AI Agent Workflows**: 4-agent system for comment processing
- ✅ **Agent Chain**: Comment ingestion → Vector indexing → Semantic analysis → Insight generation

## Technical Architecture

### 1. TiDB Vector Database Schema
```sql
-- YouTube comment embeddings table
CREATE TABLE youtube_comment_embeddings (
    id VARCHAR(255) PRIMARY KEY,
    video_id VARCHAR(255),
    comment_id VARCHAR(255) UNIQUE,
    comment_text TEXT,
    author VARCHAR(255),
    embedding VECTOR(768),  -- For semantic similarity search
    sentiment_score FLOAT,
    engagement_metrics JSON,
    detected_patterns JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_video_id (video_id),
    INDEX idx_author (author),
    VECTOR INDEX idx_comment_embedding (embedding) WITH (type = 'IVF_FLAT', lists = 100)
);

-- Comment patterns and insights table
CREATE TABLE comment_patterns (
    id VARCHAR(255) PRIMARY KEY,
    pattern_type VARCHAR(100), -- 'business_opportunity', 'feature_request', 'complaint', etc.
    pattern_embedding VECTOR(768),
    example_comments JSON,
    detection_keywords TEXT,
    confidence_threshold FLOAT,
    VECTOR INDEX idx_pattern_embedding (pattern_embedding) WITH (type = 'IVF_FLAT', lists = 50)
);

-- Cached analysis results
CREATE TABLE analysis_cache (
    video_id VARCHAR(255) PRIMARY KEY,
    analysis_data JSON,
    comment_count INT,
    last_analyzed TIMESTAMP,
    cache_expiry TIMESTAMP,
    INDEX idx_cache_expiry (cache_expiry)
);

-- Business opportunities tracking
CREATE TABLE business_opportunities (
    id VARCHAR(255) PRIMARY KEY,
    video_id VARCHAR(255),
    opportunity_type VARCHAR(100),
    comment_embeddings JSON, -- Array of related comment IDs
    confidence_score FLOAT,
    example_comments JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_video_opportunity (video_id, opportunity_type)
);
```

### 2. Multi-Agent System Architecture

#### **Agent 1: Comment Ingestion Agent**
```javascript
class CommentIngestionAgent {
  constructor(tidbService, youtubeAPI) {
    this.tidbService = tidbService;
    this.youtubeAPI = youtubeAPI;
  }

  async ingestComments(videoId) {
    // Fetch comments from YouTube API
    const comments = await this.youtubeAPI.getComments(videoId);
    
    // Process in batches for efficiency
    const batchSize = 100;
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      
      // Prepare for TiDB storage
      const preparedComments = batch.map(comment => ({
        videoId,
        commentId: comment.id,
        text: comment.snippet.textDisplay,
        author: comment.snippet.authorDisplayName,
        likes: comment.snippet.likeCount,
        publishedAt: comment.snippet.publishedAt
      }));
      
      // Send to Vector Processing Agent
      await this.sendToVectorAgent(preparedComments);
    }
  }
}
```

#### **Agent 2: Vector Processing Agent (Replacing embedding-001)**
```javascript
class VectorProcessingAgent {
  constructor(tidbService, embeddingModel) {
    this.tidbService = tidbService;
    this.embeddingModel = embeddingModel; // Open-source model or TiDB's built-in
  }

  async processCommentBatch(comments) {
    // Generate embeddings using open-source models compatible with TiDB
    const embeddings = await Promise.all(
      comments.map(async (comment) => {
        // Use TiDB-compatible embedding generation
        const embedding = await this.generateEmbedding(comment.text);
        
        return {
          ...comment,
          embedding: embedding
        };
      })
    );

    // Store in TiDB with vector indexes
    await this.tidbService.batchInsertCommentEmbeddings(embeddings);
    
    // Trigger pattern detection
    await this.sendToPatternAgent(embeddings);
  }

  async generateEmbedding(text) {
    // Options for TiDB-compatible embeddings:
    // 1. Use TiDB's built-in text embedding functions
    // 2. Use open-source models like Sentence-BERT
    // 3. Use TiDB ML functions
    
    // Example using TiDB's hypothetical built-in function
    const result = await this.tidbService.query(
      "SELECT GENERATE_TEXT_EMBEDDING(?) as embedding",
      [text]
    );
    
    return result[0].embedding;
  }
}
```

#### **Agent 3: Semantic Analysis Agent**
```javascript
class SemanticAnalysisAgent {
  constructor(tidbService) {
    this.tidbService = tidbService;
    this.initializePatterns();
  }

  async initializePatterns() {
    // Define pattern embeddings for different categories
    const patterns = [
      { type: 'business_opportunity', examples: ['I would pay for...', 'Please create a course on...'] },
      { type: 'feature_request', examples: ['It would be great if...', 'Can you add...'] },
      { type: 'complaint', examples: ['This doesn\'t work...', 'I\'m disappointed...'] },
      { type: 'praise', examples: ['Amazing content!', 'This helped me so much...'] }
    ];

    // Generate and store pattern embeddings in TiDB
    for (const pattern of patterns) {
      const embeddings = await this.generatePatternEmbeddings(pattern.examples);
      await this.tidbService.storePatternEmbedding(pattern.type, embeddings);
    }
  }

  async analyzeComments(videoId) {
    // Use TiDB vector search to find similar comments
    const query = `
      WITH pattern_matches AS (
        SELECT 
          c.comment_id,
          c.comment_text,
          c.embedding,
          p.pattern_type,
          COSINE_DISTANCE(c.embedding, p.pattern_embedding) as similarity
        FROM youtube_comment_embeddings c
        CROSS JOIN comment_patterns p
        WHERE c.video_id = ?
          AND COSINE_DISTANCE(c.embedding, p.pattern_embedding) < 0.3
      )
      SELECT 
        pattern_type,
        comment_id,
        comment_text,
        similarity,
        COUNT(*) OVER (PARTITION BY pattern_type) as pattern_count
      FROM pattern_matches
      ORDER BY pattern_type, similarity ASC
    `;

    const results = await this.tidbService.query(query, [videoId]);
    
    // Group and analyze results
    return this.groupAnalysisResults(results);
  }

  async detectBusinessOpportunities(videoId) {
    // Advanced vector search for business-related patterns
    const query = `
      SELECT 
        c.comment_text,
        c.author,
        c.embedding,
        MAX(CASE 
          WHEN c.comment_text LIKE '%pay%' THEN 0.3
          WHEN c.comment_text LIKE '%course%' THEN 0.3
          WHEN c.comment_text LIKE '%tutorial%' THEN 0.2
          ELSE 0
        END) as keyword_score,
        (
          SELECT MIN(COSINE_DISTANCE(c.embedding, p.pattern_embedding))
          FROM comment_patterns p
          WHERE p.pattern_type = 'business_opportunity'
        ) as semantic_score
      FROM youtube_comment_embeddings c
      WHERE c.video_id = ?
      HAVING (keyword_score + (1 - semantic_score)) > 0.7
      ORDER BY (keyword_score + (1 - semantic_score)) DESC
      LIMIT 10
    `;

    return await this.tidbService.query(query, [videoId]);
  }
}
```

#### **Agent 4: Insight Generation Agent**
```javascript
class InsightGenerationAgent {
  constructor(tidbService, llmService) {
    this.tidbService = tidbService;
    this.llmService = llmService; // For generating human-readable insights
  }

  async generateInsights(videoId, analysisResults) {
    const insights = {
      sentimentAnalysis: await this.analyzeSentiment(videoId),
      topicClusters: await this.clusterTopics(videoId),
      businessOpportunities: await this.identifyOpportunities(analysisResults),
      engagementPatterns: await this.analyzeEngagement(videoId),
      controversialTopics: await this.findControversies(videoId)
    };

    // Cache results in TiDB
    await this.cacheInsights(videoId, insights);
    
    return insights;
  }

  async clusterTopics(videoId) {
    // Use TiDB's vector clustering capabilities
    const query = `
      WITH comment_clusters AS (
        SELECT 
          comment_id,
          comment_text,
          embedding,
          CLUSTER_BY_VECTOR(embedding, 5) as cluster_id
        FROM youtube_comment_embeddings
        WHERE video_id = ?
      )
      SELECT 
        cluster_id,
        COUNT(*) as cluster_size,
        ARRAY_AGG(comment_text ORDER BY RANDOM() LIMIT 3) as example_comments
      FROM comment_clusters
      GROUP BY cluster_id
      ORDER BY cluster_size DESC
    `;

    return await this.tidbService.query(query, [videoId]);
  }

  async findControversies(videoId) {
    // Detect controversial comments using vector similarity to debate patterns
    const query = `
      WITH controversy_scores AS (
        SELECT 
          c1.comment_id,
          c1.comment_text,
          c1.author,
          AVG(COSINE_DISTANCE(c1.embedding, c2.embedding)) as avg_distance,
          COUNT(DISTINCT c2.author) as unique_responders
        FROM youtube_comment_embeddings c1
        JOIN youtube_comment_embeddings c2 
          ON c1.video_id = c2.video_id 
          AND c1.comment_id != c2.comment_id
        WHERE c1.video_id = ?
          AND COSINE_DISTANCE(c1.embedding, c2.embedding) BETWEEN 0.4 AND 0.7
        GROUP BY c1.comment_id, c1.comment_text, c1.author
      )
      SELECT *
      FROM controversy_scores
      WHERE unique_responders > 3
      ORDER BY unique_responders DESC, avg_distance DESC
      LIMIT 10
    `;

    return await this.tidbService.query(query, [videoId]);
  }
}
```

### 3. Integration with Chrome Extension

#### Updated content-script.js Structure
```javascript
// Initialize TiDB-based multi-agent system
class YouTubeCommentAnalyzer {
  constructor() {
    this.tidbService = new TiDBService(config);
    this.ingestionAgent = new CommentIngestionAgent(this.tidbService);
    this.vectorAgent = new VectorProcessingAgent(this.tidbService);
    this.analysisAgent = new SemanticAnalysisAgent(this.tidbService);
    this.insightAgent = new InsightGenerationAgent(this.tidbService);
  }

  async analyzeVideo(videoId) {
    // Check cache first
    const cached = await this.tidbService.getCachedAnalysis(videoId);
    if (cached && !this.isCacheExpired(cached)) {
      return cached.analysis_data;
    }

    // Multi-agent processing pipeline
    console.log('🚀 Starting multi-agent analysis...');
    
    // Step 1: Ingest comments
    await this.ingestionAgent.ingestComments(videoId);
    
    // Step 2: Generate vectors (automated by Agent 2)
    // Step 3: Semantic analysis
    const analysisResults = await this.analysisAgent.analyzeComments(videoId);
    
    // Step 4: Generate insights
    const insights = await this.insightAgent.generateInsights(videoId, analysisResults);
    
    // Cache results
    await this.tidbService.cacheAnalysis(videoId, insights);
    
    return insights;
  }
}
```

### 4. Key Improvements Over Current Extension

1. **Semantic Understanding**: Instead of keyword matching, uses vector embeddings to understand comment meaning
2. **Pattern Learning**: TiDB stores and learns from comment patterns across videos
3. **Scalability**: TiDB's distributed architecture handles millions of comments efficiently
4. **Real-time Analysis**: Vector indexes enable fast similarity searches
5. **Richer Insights**: Semantic clustering reveals hidden patterns and opportunities

### 5. Example Use Cases

#### Business Opportunity Detection
```javascript
// Find comments expressing willingness to pay or requesting products
const opportunities = await tidb.query(`
  SELECT 
    c.comment_text,
    c.author,
    VECTOR_SIMILARITY(c.embedding, 
      (SELECT pattern_embedding 
       FROM comment_patterns 
       WHERE pattern_type = 'monetization_intent')
    ) as opportunity_score
  FROM youtube_comment_embeddings c
  WHERE c.video_id = ?
    AND opportunity_score > 0.8
  ORDER BY opportunity_score DESC
  LIMIT 5
`, [videoId]);
```

#### Sentiment Trend Analysis
```javascript
// Analyze sentiment patterns over time
const sentimentTrends = await tidb.query(`
  SELECT 
    DATE(created_at) as comment_date,
    AVG(sentiment_score) as avg_sentiment,
    COUNT(*) as comment_count,
    VECTOR_CENTROID(embedding) as daily_embedding
  FROM youtube_comment_embeddings
  WHERE video_id = ?
  GROUP BY DATE(created_at)
  ORDER BY comment_date
`, [videoId]);
```

### 6. Implementation Timeline

1. **Week 1**: Set up TiDB instance and create schema
2. **Week 2**: Implement multi-agent architecture
3. **Week 3**: Develop vector processing and analysis agents
4. **Week 4**: Integrate with Chrome extension and test
5. **Week 5**: Optimize performance and add advanced features

This approach transforms your YouTube Comment Analytics extension into a powerful AI-driven tool that leverages TiDB's vector search capabilities for deep semantic understanding of comments, providing far richer insights than traditional keyword-based analysis.