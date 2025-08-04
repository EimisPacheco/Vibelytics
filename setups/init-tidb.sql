-- TiDB Setup Script for YouTube Comments Analytics
-- Run this script in your TiDB cluster to create all required tables

-- Switch to the correct database
USE `youtube-comments-analytics`;

-- Drop existing tables if needed (BE CAREFUL - this will delete all data!)
-- Uncomment these lines only if you want to reset everything
-- DROP TABLE IF EXISTS business_opportunities;
-- DROP TABLE IF EXISTS analysis_cache;
-- DROP TABLE IF EXISTS comment_patterns;
-- DROP TABLE IF EXISTS youtube_comment_embeddings;

-- Create main comment embeddings table
CREATE TABLE IF NOT EXISTS youtube_comment_embeddings (
    id VARCHAR(255) PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL,
    comment_id VARCHAR(255) UNIQUE NOT NULL,
    comment_text TEXT,
    author VARCHAR(255),
    embedding VECTOR(768),  -- 768-dimensional vector for embeddings
    sentiment_score FLOAT DEFAULT 0,
    engagement_metrics JSON,
    detected_patterns JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_video_id (video_id),
    INDEX idx_author (author),
    INDEX idx_created_at (created_at)
);

-- Add vector index for similarity search (HNSW is recommended for TiDB)
ALTER TABLE youtube_comment_embeddings 
ADD VECTOR INDEX vec_idx_embedding(embedding) 
USING HNSW 
WITH (M = 16, EFCONSTRUCTION = 200);

-- Create pattern embeddings table for classification
CREATE TABLE IF NOT EXISTS comment_patterns (
    id VARCHAR(255) PRIMARY KEY,
    pattern_type VARCHAR(100) NOT NULL,
    pattern_embedding VECTOR(768),
    example_comments JSON,
    detection_keywords TEXT,
    confidence_threshold FLOAT DEFAULT 0.7,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pattern_type (pattern_type)
);

-- Add vector index for pattern matching
ALTER TABLE comment_patterns 
ADD VECTOR INDEX vec_idx_pattern(pattern_embedding) 
USING HNSW
WITH (M = 16, EFCONSTRUCTION = 200);

-- Create analysis cache table
CREATE TABLE IF NOT EXISTS analysis_cache (
    video_id VARCHAR(255) PRIMARY KEY,
    analysis_data JSON,
    comment_count INT DEFAULT 0,
    last_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cache_expiry TIMESTAMP,
    INDEX idx_cache_expiry (cache_expiry)
);

-- Create business opportunities tracking table
CREATE TABLE IF NOT EXISTS business_opportunities (
    id VARCHAR(255) PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL,
    opportunity_type VARCHAR(100),
    comment_embeddings JSON,
    confidence_score FLOAT DEFAULT 0,
    example_comments JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_video_opportunity (video_id, opportunity_type),
    INDEX idx_confidence (confidence_score DESC)
);

-- Create a table for storing video metadata
CREATE TABLE IF NOT EXISTS video_metadata (
    video_id VARCHAR(255) PRIMARY KEY,
    video_title TEXT,
    channel_name VARCHAR(255),
    total_comments INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_channel (channel_name),
    INDEX idx_last_updated (last_updated)
);

-- Create a table for tracking processing status
CREATE TABLE IF NOT EXISTS processing_status (
    id VARCHAR(255) PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    progress INT DEFAULT 0,
    stage VARCHAR(100),
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_video_status (video_id, status),
    INDEX idx_started (started_at)
);

-- Insert default pattern types
INSERT INTO comment_patterns (id, pattern_type, confidence_threshold) VALUES
    ('pattern_business_opportunity', 'business_opportunity', 0.8),
    ('pattern_feature_request', 'feature_request', 0.7),
    ('pattern_complaint', 'complaint', 0.7),
    ('pattern_praise', 'praise', 0.7),
    ('pattern_question', 'question', 0.6),
    ('pattern_controversy', 'controversy', 0.75)
ON DUPLICATE KEY UPDATE confidence_threshold = VALUES(confidence_threshold);

-- Create a view for quick stats
CREATE OR REPLACE VIEW video_stats AS
SELECT 
    v.video_id,
    v.video_title,
    v.channel_name,
    v.total_comments,
    COUNT(DISTINCT c.author) as unique_authors,
    AVG(c.sentiment_score) as avg_sentiment,
    MAX(c.created_at) as latest_comment,
    v.last_updated
FROM video_metadata v
LEFT JOIN youtube_comment_embeddings c ON v.video_id = c.video_id
GROUP BY v.video_id, v.video_title, v.channel_name, v.total_comments, v.last_updated;

-- Test the setup
SELECT 'Setup completed successfully!' as status;

-- Verify tables were created
SHOW TABLES;

-- Check vector indexes
SHOW INDEXES FROM youtube_comment_embeddings WHERE Key_name LIKE 'vec_%';
SHOW INDEXES FROM comment_patterns WHERE Key_name LIKE 'vec_%';