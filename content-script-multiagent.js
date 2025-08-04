// YouTube Comment Analytics with TiDB Multi-Agent System
// This is the enhanced version using vector search and semantic analysis

console.log('🚀 YouTube Comment Analytics (Multi-Agent Version) loaded');

// Global variables
let agentCoordinator = null;
let isMultiAgentEnabled = true; // Feature flag
let currentVideoId = null;

// Initialize multi-agent system when page loads
async function initializeExtension() {
  try {
    // Load agent system
    if (window.YouTubeCommentMultiAgent) {
      console.log('🤖 Initializing multi-agent system...');
      
      // Initialize coordinator (config is already in agent-loader.js)
      agentCoordinator = await window.YouTubeCommentMultiAgent.initializeMultiAgentSystem();
      
      // Set up progress monitoring
      agentCoordinator.onProgress((state) => {
        console.log(`📊 Processing: ${state.stage} (${state.progress}%)`);
        updateUIProgress(state);
      });
      
      // Show storage mode in UI
      const storageType = agentCoordinator.storageAdapter.getStorageType();
      console.log(`✅ Multi-agent system initialized with ${storageType} storage`);
      
      // Add storage indicator to UI
      showStorageIndicator(storageType);
    }
  } catch (error) {
    console.error('❌ Failed to initialize multi-agent system:', error);
    isMultiAgentEnabled = false;
  }
}

// Show storage mode indicator
function showStorageIndicator(storageType) {
  const indicator = document.createElement('div');
  indicator.id = 'storage-mode-indicator';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${storageType === 'tidb' ? '#4CAF50' : '#2196F3'};
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  indicator.innerHTML = `
    <span style="margin-right: 5px">${storageType === 'tidb' ? '🚀' : '💾'}</span>
    ${storageType === 'tidb' ? 'TiDB Vector Search' : 'Local Storage'}
  `;
  
  document.body.appendChild(indicator);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    indicator.style.opacity = '0.3';
    indicator.style.transition = 'opacity 0.5s';
  }, 5000);
}

// Enhanced analyze function using multi-agent system
async function analyzeCommentsWithAgents(videoId, comments) {
  if (!agentCoordinator || !isMultiAgentEnabled) {
    console.log('⚠️ Multi-agent system not available, falling back to legacy analysis');
    return null;
  }
  
  try {
    console.log(`🎬 Starting multi-agent analysis for video ${videoId}`);
    
    // Show loading state
    showAnalysisProgress();
    
    // Run multi-agent analysis
    const results = await agentCoordinator.analyzeVideo(videoId, comments);
    
    // Format results for UI
    const formattedResults = agentCoordinator.formatForUI(results);
    
    console.log('✅ Multi-agent analysis completed');
    return formattedResults;
    
  } catch (error) {
    console.error('❌ Multi-agent analysis failed:', error);
    return null;
  }
}

// Update UI with multi-agent results
function displayMultiAgentResults(results) {
  const container = document.getElementById('comment-insights-container');
  if (!container) return;
  
  // Clear existing content
  container.innerHTML = '';
  
  // Create enhanced UI sections
  const sections = [
    createExecutiveSummarySection(results.header, results.insights),
    createSentimentSection(results.sections.sentiment),
    createTopicsSection(results.insights.topTopics),
    createBusinessOpportunitiesSection(results.insights.businessOpportunities),
    createControversialSection(results.sections.controversial),
    createQualitySection(results.sections.quality),
    createAudienceSection(results.sections.audience),
    createRecommendationsSection(results.insights.recommendations)
  ];
  
  sections.forEach(section => {
    if (section) container.appendChild(section);
  });
}

// UI Section Creators
function createExecutiveSummarySection(header, insights) {
  const section = document.createElement('div');
  section.className = 'insight-section executive-summary';
  
  section.innerHTML = `
    <h3>📊 Executive Summary</h3>
    <div class="summary-stats">
      <div class="stat-item">
        <span class="stat-label">Total Comments</span>
        <span class="stat-value">${header.totalComments.toLocaleString()}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Overall Sentiment</span>
        <span class="stat-value sentiment-${header.sentiment.toLowerCase()}">${header.sentiment}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Engagement</span>
        <span class="stat-value">${header.engagementLevel}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Controversy</span>
        <span class="stat-value controversy-${header.controversyLevel.toLowerCase()}">${header.controversyLevel}</span>
      </div>
    </div>
    <div class="highlights">
      ${insights.executiveSummary.map(h => `<div class="highlight">• ${h}</div>`).join('')}
    </div>
  `;
  
  return section;
}

function createSentimentSection(sentiment) {
  const section = document.createElement('div');
  section.className = 'insight-section sentiment-analysis';
  
  const distribution = sentiment.distribution.map(d => `
    <div class="sentiment-bar">
      <span class="sentiment-label">${d.label}</span>
      <div class="bar-container">
        <div class="bar sentiment-${d.label.toLowerCase().replace(' ', '-')}" style="width: ${d.percentage}"></div>
      </div>
      <span class="sentiment-percentage">${d.percentage}</span>
    </div>
  `).join('');
  
  section.innerHTML = `
    <h3>😊 ${sentiment.title}</h3>
    <div class="sentiment-overall">
      Overall: <strong>${sentiment.overall.label}</strong> (${(sentiment.overall.score * 100).toFixed(1)}%)
    </div>
    <div class="sentiment-distribution">
      ${distribution}
    </div>
  `;
  
  return section;
}

function createTopicsSection(topics) {
  const section = document.createElement('div');
  section.className = 'insight-section topics';
  
  const topicHtml = topics.map((topic, index) => `
    <div class="topic-item">
      <span class="topic-rank">#${index + 1}</span>
      <span class="topic-label">${topic.label}</span>
      <span class="topic-percentage">${topic.percentage}%</span>
    </div>
  `).join('');
  
  section.innerHTML = `
    <h3>🏷️ Main Discussion Topics</h3>
    <div class="topics-list">
      ${topicHtml}
    </div>
  `;
  
  return section;
}

function createBusinessOpportunitiesSection(opportunities) {
  if (!opportunities || opportunities.length === 0) return null;
  
  const section = document.createElement('div');
  section.className = 'insight-section business-opportunities';
  
  const oppHtml = opportunities.map(opp => `
    <div class="opportunity-item">
      <div class="opportunity-type">${opp.type}</div>
      <div class="opportunity-text">"${opp.text}"</div>
      <div class="opportunity-meta">
        <span class="author">- ${opp.author}</span>
        <span class="confidence">Confidence: ${(opp.confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  `).join('');
  
  section.innerHTML = `
    <h3>💼 Business Opportunities</h3>
    <div class="opportunities-list">
      ${oppHtml}
    </div>
  `;
  
  return section;
}

function createControversialSection(controversial) {
  if (!controversial.items || controversial.items.length === 0) return null;
  
  const section = document.createElement('div');
  section.className = 'insight-section controversial';
  
  const itemsHtml = controversial.items.map(item => `
    <div class="controversial-item severity-${item.severity}">
      <div class="controversial-text">"${item.text}"</div>
      <div class="controversial-meta">
        <span class="author">- ${item.author}</span>
        <span class="score">Controversy Score: ${item.score}</span>
      </div>
    </div>
  `).join('');
  
  section.innerHTML = `
    <h3>🔥 ${controversial.title}</h3>
    <div class="controversial-list">
      ${itemsHtml}
    </div>
  `;
  
  return section;
}

function createQualitySection(quality) {
  const section = document.createElement('div');
  section.className = 'insight-section quality';
  
  const bestHtml = quality.bestFeatures.map(f => `
    <div class="feature-item">
      <span class="feature-name">${f.feature}</span>
      <span class="feature-mentions">${f.mentions} mentions</span>
    </div>
  `).join('');
  
  const improvementHtml = quality.improvements.map(i => `
    <div class="improvement-item">
      <span class="improvement-area">${i.area}</span>
      <span class="improvement-mentions">${i.mentions} suggestions</span>
    </div>
  `).join('');
  
  section.innerHTML = `
    <h3>📈 ${quality.title}</h3>
    <div class="quality-columns">
      <div class="quality-column">
        <h4>✨ Best Features</h4>
        ${bestHtml || '<p>No specific features identified</p>'}
      </div>
      <div class="quality-column">
        <h4>🔧 Areas for Improvement</h4>
        ${improvementHtml || '<p>No improvement areas identified</p>'}
      </div>
    </div>
  `;
  
  return section;
}

function createAudienceSection(audience) {
  const section = document.createElement('div');
  section.className = 'insight-section audience';
  
  const interestsHtml = audience.interests.slice(0, 8).map(i => 
    `<span class="interest-tag">${i}</span>`
  ).join('');
  
  section.innerHTML = `
    <h3>👥 ${audience.title}</h3>
    <div class="audience-stats">
      <div class="stat">
        <span class="label">Unique Commenters:</span>
        <span class="value">${audience.demographics.uniqueCommenters.toLocaleString()}</span>
      </div>
      <div class="stat">
        <span class="label">Average Engagement:</span>
        <span class="value">${audience.demographics.averageEngagement} likes/comment</span>
      </div>
    </div>
    <div class="audience-interests">
      <h4>Key Interests</h4>
      <div class="interest-tags">
        ${interestsHtml}
      </div>
    </div>
  `;
  
  return section;
}

function createRecommendationsSection(recommendations) {
  if (!recommendations || recommendations.length === 0) return null;
  
  const section = document.createElement('div');
  section.className = 'insight-section recommendations';
  
  const recsHtml = recommendations.map(rec => `
    <div class="recommendation-item priority-${rec.priority}">
      <div class="rec-header">
        <span class="rec-type">${rec.type}</span>
        <span class="rec-priority">${rec.priority} priority</span>
      </div>
      <div class="rec-suggestion">${rec.suggestion}</div>
      ${rec.topics ? `<div class="rec-topics">Topics: ${rec.topics.join(', ')}</div>` : ''}
    </div>
  `).join('');
  
  section.innerHTML = `
    <h3>💡 Content Recommendations</h3>
    <div class="recommendations-list">
      ${recsHtml}
    </div>
  `;
  
  return section;
}

// Progress UI
function showAnalysisProgress() {
  const container = document.getElementById('comment-insights-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="analysis-progress">
      <h3>🤖 Multi-Agent Analysis in Progress</h3>
      <div class="progress-bar-container">
        <div class="progress-bar" id="analysis-progress-bar" style="width: 0%"></div>
      </div>
      <div class="progress-stage" id="progress-stage">Initializing...</div>
      <div class="agent-status">
        <div class="agent-item" id="agent-ingestion">📥 Ingestion Agent: <span>Waiting</span></div>
        <div class="agent-item" id="agent-vector">🔢 Vector Agent: <span>Waiting</span></div>
        <div class="agent-item" id="agent-semantic">🧠 Semantic Agent: <span>Waiting</span></div>
        <div class="agent-item" id="agent-insight">💡 Insight Agent: <span>Waiting</span></div>
      </div>
    </div>
  `;
}

function updateUIProgress(state) {
  const progressBar = document.getElementById('analysis-progress-bar');
  const progressStage = document.getElementById('progress-stage');
  
  if (progressBar) {
    progressBar.style.width = `${state.progress}%`;
  }
  
  if (progressStage) {
    const stageLabels = {
      'checking_cache': 'Checking cache...',
      'ingesting_comments': 'Ingesting comments...',
      'generating_vectors': 'Generating embeddings...',
      'analyzing_semantics': 'Analyzing semantics...',
      'generating_insights': 'Generating insights...',
      'finalizing': 'Finalizing results...',
      'done': 'Analysis complete!'
    };
    progressStage.textContent = stageLabels[state.stage] || state.stage;
  }
  
  // Update agent status
  const agentStages = {
    'ingesting_comments': 'agent-ingestion',
    'generating_vectors': 'agent-vector',
    'analyzing_semantics': 'agent-semantic',
    'generating_insights': 'agent-insight'
  };
  
  const currentAgent = agentStages[state.stage];
  if (currentAgent) {
    const agentElement = document.getElementById(currentAgent);
    if (agentElement) {
      agentElement.querySelector('span').textContent = 'Active';
      agentElement.classList.add('active');
    }
  }
}

// Enhanced styles for multi-agent UI
const multiAgentStyles = `
  .analysis-progress {
    padding: 20px;
    background: #f5f5f5;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  
  .progress-bar-container {
    width: 100%;
    height: 20px;
    background: #e0e0e0;
    border-radius: 10px;
    overflow: hidden;
    margin: 10px 0;
  }
  
  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #4CAF50, #8BC34A);
    transition: width 0.3s ease;
  }
  
  .progress-stage {
    text-align: center;
    color: #666;
    margin: 10px 0;
  }
  
  .agent-status {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 15px;
  }
  
  .agent-item {
    padding: 8px;
    background: white;
    border-radius: 4px;
    font-size: 12px;
  }
  
  .agent-item.active {
    background: #E8F5E9;
    border: 1px solid #4CAF50;
  }
  
  .summary-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px;
    margin: 15px 0;
  }
  
  .stat-item {
    text-align: center;
    padding: 10px;
    background: #f9f9f9;
    border-radius: 4px;
  }
  
  .stat-label {
    display: block;
    font-size: 12px;
    color: #666;
  }
  
  .stat-value {
    display: block;
    font-size: 20px;
    font-weight: bold;
    margin-top: 5px;
  }
  
  .sentiment-very-positive { color: #2E7D32; }
  .sentiment-positive { color: #66BB6A; }
  .sentiment-neutral { color: #757575; }
  .sentiment-negative { color: #F57C00; }
  .sentiment-very-negative { color: #D32F2F; }
  
  .controversy-high { color: #D32F2F; }
  .controversy-medium { color: #F57C00; }
  .controversy-low { color: #66BB6A; }
  
  .topic-item {
    display: flex;
    align-items: center;
    padding: 8px;
    margin: 5px 0;
    background: #f5f5f5;
    border-radius: 4px;
  }
  
  .topic-rank {
    font-weight: bold;
    margin-right: 10px;
    color: #666;
  }
  
  .topic-label {
    flex: 1;
  }
  
  .topic-percentage {
    font-weight: bold;
    color: #4CAF50;
  }
  
  .opportunity-item {
    padding: 12px;
    margin: 8px 0;
    background: #FFF3E0;
    border-left: 4px solid #FF9800;
    border-radius: 4px;
  }
  
  .opportunity-type {
    font-weight: bold;
    color: #E65100;
    margin-bottom: 5px;
  }
  
  .quality-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 15px;
  }
  
  .interest-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  
  .interest-tag {
    padding: 4px 8px;
    background: #E3F2FD;
    border-radius: 12px;
    font-size: 12px;
    color: #1976D2;
  }
  
  .recommendation-item {
    padding: 12px;
    margin: 8px 0;
    border-radius: 4px;
    border-left: 4px solid;
  }
  
  .recommendation-item.priority-high {
    background: #FFEBEE;
    border-left-color: #D32F2F;
  }
  
  .recommendation-item.priority-medium {
    background: #FFF3E0;
    border-left-color: #F57C00;
  }
  
  .recommendation-item.priority-low {
    background: #E8F5E9;
    border-left-color: #388E3C;
  }
`;

// Inject multi-agent styles
const styleElement = document.createElement('style');
styleElement.textContent = multiAgentStyles;
document.head.appendChild(styleElement);

// Override the main analyze function to use multi-agent system
const originalAnalyzeComments = window.analyzeComments;
window.analyzeComments = async function(videoId, videoTitle) {
  try {
    // Check if we need to fetch new comments
    let shouldFetchComments = true;
    let comments = null;
    
    if (agentCoordinator && agentCoordinator.storageAdapter) {
      // Check if video was recently analyzed
      const recentCheck = await agentCoordinator.storageAdapter.isVideoRecentlyAnalyzed(videoId, 7);
      
      if (recentCheck.isRecent) {
        console.log(`♻️ Using stored data from ${recentCheck.lastAnalyzed} (${recentCheck.commentCount} comments)`);
        console.log('✅ Skipping YouTube API call - data is less than 7 days old');
        shouldFetchComments = false;
        
        // Show indicator
        showCacheIndicator(recentCheck);
      }
    }
    
    // Only fetch comments if needed
    if (shouldFetchComments) {
      console.log('📥 Fetching fresh comments from YouTube API');
      comments = await window.getAllComments(videoId);
      
      if (!comments || comments.length === 0) {
        console.log('No comments found');
        return;
      }
    }
    
    // Try multi-agent analysis (will use cached data if available)
    const multiAgentResults = await analyzeCommentsWithAgents(videoId, comments);
    
    if (multiAgentResults) {
      // Display multi-agent results
      displayMultiAgentResults(multiAgentResults);
    } else {
      // Fall back to original analysis
      console.log('Falling back to legacy analysis');
      originalAnalyzeComments.call(this, videoId, videoTitle);
    }
    
  } catch (error) {
    console.error('Analysis error:', error);
    // Fall back to original analysis
    originalAnalyzeComments.call(this, videoId, videoTitle);
  }
};

// Show cache usage indicator
function showCacheIndicator(recentCheck) {
  const indicator = document.createElement('div');
  indicator.id = 'cache-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 70px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
  `;
  
  const daysAgo = Math.floor((Date.now() - new Date(recentCheck.lastAnalyzed)) / (1000 * 60 * 60 * 24));
  const timeText = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;
  
  indicator.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 20px;">♻️</span>
      <div>
        <div style="font-weight: bold;">Using Cached Data</div>
        <div style="font-size: 12px; opacity: 0.9;">
          ${recentCheck.commentCount} comments from ${timeText}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(indicator);
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    indicator.style.transition = 'opacity 0.5s';
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 500);
  }, 5000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

console.log('✅ Multi-agent enhancement loaded');