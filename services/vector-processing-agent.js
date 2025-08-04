// Vector Processing Agent
// Replaces Google's embedding-001 with TiDB-compatible vector generation

class VectorProcessingAgent {
  constructor(storageAdapter, embeddingConfig = {}) {
    this.storageAdapter = storageAdapter;
    this.embeddingDimension = embeddingConfig.dimension || 768; // Standard dimension
    this.batchSize = 50;
    
    // Initialize embedding service based on config
    this.initializeEmbeddingService(embeddingConfig);
    
    // Initialize pattern embeddings
    this.initializePatterns();
  }

  initializeEmbeddingService(config) {
    const provider = config.provider || 'local'; // 'openai', 'google', 'local'
    
    switch (provider) {
      case 'openai':
        if (typeof OpenAIEmbeddingService !== 'undefined' && config.apiKey) {
          this.embeddingService = new OpenAIEmbeddingService(config.apiKey);
          this.embeddingDimension = 768; // We'll reduce OpenAI's 1536 to 768
          console.log('🤖 Using OpenAI embeddings');
        } else {
          console.warn('⚠️ OpenAI service not available, using local embeddings');
          this.embeddingService = null;
        }
        break;
        
      case 'google':
        // Future: Add Google embedding-001 service
        console.log('🔍 Google embeddings not yet implemented, using local');
        this.embeddingService = null;
        break;
        
      default:
        console.log('💾 Using local embeddings');
        this.embeddingService = null;
    }
  }

  async initializePatterns() {
    console.log('🎯 Initializing pattern embeddings...');
    
    const patterns = {
      business_opportunity: [
        "I would pay for this",
        "Please create a course on this topic",
        "Where can I buy this product",
        "Is this available for purchase",
        "I need this for my business",
        "Can you offer this as a service"
      ],
      feature_request: [
        "It would be great if you could add",
        "Can you please include",
        "Feature request",
        "Would love to see",
        "Please consider adding",
        "This needs"
      ],
      complaint: [
        "This doesn't work",
        "I'm disappointed",
        "Very poor quality",
        "Waste of time",
        "Not as advertised",
        "Terrible experience"
      ],
      praise: [
        "Amazing content",
        "This helped me so much",
        "Best explanation ever",
        "Thank you for this",
        "Incredible work",
        "Life changing"
      ],
      question: [
        "How do you",
        "Can you explain",
        "What is the",
        "Where can I find",
        "Why does this",
        "When should I"
      ],
      controversy: [
        "I disagree with",
        "This is wrong",
        "Actually, the correct",
        "You're mistaken about",
        "This is misleading",
        "Facts are different"
      ]
    };

    // Generate and store pattern embeddings
    for (const [type, examples] of Object.entries(patterns)) {
      const embedding = await this.generatePatternEmbedding(examples);
      await this.tidbService.storePatternEmbedding(type, embedding, examples);
    }
  }

  async processCommentBatch(comments) {
    console.log(`🔄 Vector Processing Agent: Processing ${comments.length} comments`);
    
    const processedComments = [];
    const errors = [];

    // Process in smaller batches for efficiency
    for (let i = 0; i < comments.length; i += this.batchSize) {
      const batch = comments.slice(i, Math.min(i + this.batchSize, comments.length));
      
      try {
        // Generate embeddings for batch
        const embeddings = await this.generateBatchEmbeddings(batch);
        
        // Combine comments with their embeddings
        const enhancedComments = batch.map((comment, index) => ({
          ...comment,
          embedding: embeddings[index],
          sentimentScore: this.calculateSentiment(comment.text),
          engagementMetrics: this.calculateEngagementMetrics(comment)
        }));
        
        // Store in TiDB
        await this.tidbService.batchInsertCommentEmbeddings(enhancedComments);
        
        processedComments.push(...enhancedComments);
        
        console.log(`✅ Processed batch: ${i + batch.length}/${comments.length}`);
        
      } catch (error) {
        console.error('❌ Batch processing error:', error);
        errors.push({ batch: i, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      processed: processedComments.length,
      errors: errors
    };
  }

  async generateBatchEmbeddings(comments) {
    // In production, this would use a real embedding model
    // Options for TiDB-compatible embeddings:
    // 1. TiDB ML functions
    // 2. OpenAI API
    // 3. Sentence-BERT via API
    // 4. Local ONNX model
    
    return comments.map(comment => 
      this.generateEmbedding(comment.text)
    );
  }

  async generateEmbedding(text) {
    // Use external embedding service if available
    if (this.embeddingService) {
      try {
        const embedding = await this.embeddingService.generateCompatibleEmbedding(
          text, 
          this.embeddingDimension
        );
        return embedding;
      } catch (error) {
        console.error('External embedding failed, using local fallback:', error);
      }
    }
    
    // Local embedding generation (fallback)
    // Clean and prepare text
    const cleanedText = this.preprocessText(text);
    
    // For demo: Create a deterministic pseudo-embedding based on text features
    const embedding = new Array(this.embeddingDimension).fill(0);
    
    // Simple feature extraction for demo
    const features = this.extractFeatures(cleanedText);
    
    // Map features to embedding dimensions
    features.forEach((value, index) => {
      if (index < this.embeddingDimension) {
        embedding[index] = value;
      }
    });
    
    // Normalize embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  async generatePatternEmbedding(examples) {
    // Generate a representative embedding for a pattern
    const embeddings = await Promise.all(
      examples.map(example => this.generateEmbedding(example))
    );
    
    // Average the embeddings
    const avgEmbedding = new Array(this.embeddingDimension).fill(0);
    
    embeddings.forEach(embedding => {
      embedding.forEach((val, i) => {
        avgEmbedding[i] += val / embeddings.length;
      });
    });
    
    return avgEmbedding;
  }

  preprocessText(text) {
    // Text preprocessing for better embeddings
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  extractFeatures(text) {
    // Extract numerical features from text for demo embedding
    const features = [];
    
    // Length features
    features.push(text.length / 1000); // Normalized length
    features.push(text.split(' ').length / 100); // Word count
    
    // Character type ratios
    features.push((text.match(/[A-Z]/g) || []).length / text.length); // Uppercase ratio
    features.push((text.match(/[0-9]/g) || []).length / text.length); // Digit ratio
    features.push((text.match(/[!?.,]/g) || []).length / text.length); // Punctuation ratio
    
    // Sentiment indicators
    const positiveWords = ['good', 'great', 'awesome', 'love', 'best', 'amazing'];
    const negativeWords = ['bad', 'hate', 'terrible', 'worst', 'awful', 'horrible'];
    
    const positiveCount = positiveWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;
    const negativeCount = negativeWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;
    
    features.push(positiveCount / 10);
    features.push(negativeCount / 10);
    
    // Question indicators
    features.push(text.includes('?') ? 1 : 0);
    features.push(text.toLowerCase().includes('how') ? 0.5 : 0);
    features.push(text.toLowerCase().includes('why') ? 0.5 : 0);
    features.push(text.toLowerCase().includes('what') ? 0.5 : 0);
    
    // Business indicators
    const businessTerms = ['pay', 'buy', 'purchase', 'course', 'tutorial', 'service'];
    const businessScore = businessTerms.filter(term => 
      text.toLowerCase().includes(term)
    ).length / businessTerms.length;
    features.push(businessScore);
    
    // Pad with zeros to reach embedding dimension
    while (features.length < this.embeddingDimension) {
      features.push(0);
    }
    
    return features;
  }

  calculateSentiment(text) {
    // Simple sentiment analysis
    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
      'love', 'best', 'awesome', 'perfect', 'beautiful', 'helpful'
    ];
    
    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate',
      'useless', 'waste', 'disappointed', 'boring', 'confusing', 'poor'
    ];
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 0.1;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 0.1;
    });
    
    // Emoji sentiment
    const positiveEmojis = ['😊', '😍', '👍', '❤️', '🎉', '💯'];
    const negativeEmojis = ['😠', '😡', '👎', '😢', '😭', '💔'];
    
    positiveEmojis.forEach(emoji => {
      if (text.includes(emoji)) score += 0.15;
    });
    
    negativeEmojis.forEach(emoji => {
      if (text.includes(emoji)) score -= 0.15;
    });
    
    // Normalize to -1 to 1 range
    return Math.max(-1, Math.min(1, score));
  }

  calculateEngagementMetrics(comment) {
    return {
      likeRate: comment.likes / Math.max(1, comment.metadata.totalReplyCount + 1),
      replyRate: comment.metadata.totalReplyCount / Math.max(1, comment.likes + 1),
      textComplexity: this.calculateTextComplexity(comment.text),
      hasMultimedia: comment.analysis.hasUrls || comment.analysis.hasEmojis,
      authorInfluence: comment.likes > 100 ? 'high' : comment.likes > 10 ? 'medium' : 'low'
    };
  }

  calculateTextComplexity(text) {
    const words = text.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const uniqueWords = new Set(words.map(w => w.toLowerCase())).size;
    const uniqueRatio = uniqueWords / words.length;
    
    // Simple complexity score
    if (avgWordLength > 6 && uniqueRatio > 0.7) return 'high';
    if (avgWordLength > 4 && uniqueRatio > 0.5) return 'medium';
    return 'low';
  }

  // Vector similarity calculation
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimension');
    }
    
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
}

// Export for use in Chrome extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VectorProcessingAgent;
}