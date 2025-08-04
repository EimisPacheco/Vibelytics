// Vibelytics Content Script - YouTube Insights Engine
class YouTubeCommentReader {
  constructor() {
    this.comments = [];
    this.apiKey = 'AIzaSyB9jxCpFclGwigqmjBZkam0OfRipy8x5sw';
    this.loadAPIKey(); // Load saved API key if available
    
    // Initialize cache cleanup
    this.cleanExpiredCache();
    
    // Suppress third-party storage access errors (not related to extension)
    this.suppressStorageErrors();
    
    // Analytics data
    this.insights = {
      sentiment: { positive: 0, negative: 0, neutral: 0 },
      topInfluentialComments: [],
      videoIdeas: [],
      commentTopics: [],
      topEngagedUsers: {},
      businessOpportunities: [],
      frequentQuestions: [],
      bestFeatures: [],
      areasForImprovement: [],
      mostInterestingComments: [],
      wordFrequency: {}
    };
    
    this.init();
  }

  init() {
    // Wait for YouTube to load
    this.waitForYouTubeLoad().then(() => {
      this.addControlUI();
      this.observePageChanges();
    });
  }

  waitForYouTubeLoad() {
    return new Promise((resolve) => {
      const checkForComments = () => {
        const commentsSection = document.querySelector('#comments');
        if (commentsSection) {
          resolve();
        } else {
          setTimeout(checkForComments, 1000);
        }
      };
      checkForComments();
    });
  }

  addControlUI() {
    // Remove existing controls if they exist
    const existingControls = document.querySelector('#vibelytics-controls');
    if (existingControls) {
      existingControls.remove();
    }

    // Create control panel
    const controls = document.createElement('div');
    controls.id = 'vibelytics-controls';
    controls.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #0f0f0f;
      border: 1px solid #303030;
      border-radius: 8px;
      padding: 15px;
      z-index: 9999;
      color: white;
      font-family: 'Roboto', sans-serif;
      font-size: 14px;
      min-width: 250px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    `;

    const title = document.createElement('h3');
    title.textContent = 'Vibelytics';
    title.style.cssText = 'margin: 0 0 10px 0; color: #fff; font-size: 16px;';

    const analyzeButton = document.createElement('button');
    analyzeButton.textContent = 'Analyze Comments';
    analyzeButton.style.cssText = `
      background: #ff0000;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 8px;
      font-size: 14px;
      font-weight: bold;
    `;
    analyzeButton.addEventListener('click', () => this.fetchAPIComments());

    const showInsightsButton = document.createElement('button');
    showInsightsButton.textContent = 'Show Insights';
    showInsightsButton.style.cssText = `
      background: #9c27b0;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 8px;
      font-size: 12px;
      display: none;
    `;
    showInsightsButton.addEventListener('click', () => {
      if (this.comments.length > 0 && Object.keys(this.insights.topEngagedUsers).length > 0) {
        this.displayInsights();
        showInsightsButton.style.display = 'none';
      } else {
        alert('No insights available. Please analyze comments first.');
      }
    });
    
    // Store reference to show insights button
    this.showInsightsButton = showInsightsButton;

    const exportButton = document.createElement('button');
    exportButton.textContent = '📤 Export/Email';
    exportButton.style.cssText = `
      background: #065fd4;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-right: 8px;
    `;
    exportButton.addEventListener('click', () => {
      // Show options: Export CSV or Email
      const choice = confirm('Click OK to Email Insights\nClick Cancel to Export as CSV');
      if (choice) {
        this.emailInsights();
      } else {
        this.exportComments();
      }
    });

    const emailButton = document.createElement('button');
    emailButton.textContent = '📧 Email Insights';
    emailButton.title = 'Email Insights';
    emailButton.style.cssText = `
      background: #E91E63;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-right: 8px;
      display: none;
    `;
    emailButton.addEventListener('click', () => this.emailInsights());

    const configButton = document.createElement('button');
    configButton.textContent = '⚙️';
    configButton.title = 'Configure API Key';
    configButton.style.cssText = `
      background: #666;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    configButton.addEventListener('click', () => this.configureAPIKey());

    const status = document.createElement('div');
    status.id = 'comment-reader-status';
    status.style.cssText = 'margin-top: 10px; font-size: 12px; color: #aaa;';
    status.textContent = 'Click "Analyze Comments" to start';

    const commentCount = document.createElement('div');
    commentCount.id = 'comment-count';
    commentCount.style.cssText = 'margin-top: 5px; font-size: 12px; color: #fff;';
    commentCount.textContent = 'Comments found: 0';

    const statsDisplay = document.createElement('div');
    statsDisplay.id = 'comment-stats';
    statsDisplay.style.cssText = 'margin-top: 5px; font-size: 11px; color: #aaa;';
    statsDisplay.textContent = 'Total likes: 0 | Total replies: 0';

    controls.appendChild(title);
    controls.appendChild(analyzeButton);
    controls.appendChild(showInsightsButton);
    // Export button moved to insights panel
    // controls.appendChild(exportButton);
    // controls.appendChild(emailButton);
    controls.appendChild(configButton);
    controls.appendChild(status);
    controls.appendChild(commentCount);
    controls.appendChild(statsDisplay);
    
    // Store email button reference
    this.emailButton = emailButton;

    document.body.appendChild(controls);
  }

  observePageChanges() {
    // Observe URL changes for single-page app navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.comments = [];
        this.updateUI();
        // Wait for new page to load
        setTimeout(() => {
          this.waitForYouTubeLoad().then(() => {
            this.addControlUI();
          });
        }, 2000);
      }
    }).observe(document, { subtree: true, childList: true });
  }


  updateStatus(message) {
    const statusElement = document.querySelector('#comment-reader-status');
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  updateUI() {
    const countElement = document.querySelector('#comment-count');
    if (countElement) {
      countElement.textContent = `Comments found: ${this.comments.length}`;
    }

    const statsElement = document.querySelector('#comment-stats');
    if (statsElement) {
      // Calculate total likes and replies
      const totalLikes = this.comments.reduce((sum, comment) => {
        const likes = parseInt(comment.likes) || 0;
        return sum + likes;
      }, 0);

      const totalReplies = this.comments.reduce((sum, comment) => {
        const replies = parseInt(comment.replies) || 0;
        return sum + replies;
      }, 0);

      statsElement.textContent = `Total likes: ${totalLikes.toLocaleString()} | Total replies: ${totalReplies.toLocaleString()}`;
    }
  }

  exportComments() {
    if (this.comments.length === 0) {
      alert('No comments to export. Start reading comments first.');
      return;
    }

    // Create comprehensive export content
    let exportContent = '=== VIBELYTICS INSIGHTS REPORT ===\n\n';
    exportContent += `Video URL: ${window.location.href}\n`;
    exportContent += `Analysis Date: ${new Date().toLocaleString()}\n`;
    exportContent += `Total Comments Analyzed: ${this.comments.length}\n\n`;

    // Add sentiment analysis
    exportContent += '=== AUDIENCE SENTIMENT ===\n';
    const total = this.comments.length;
    exportContent += `Positive: ${this.insights.sentiment.positive} (${(this.insights.sentiment.positive/total*100).toFixed(1)}%)\n`;
    exportContent += `Neutral: ${this.insights.sentiment.neutral} (${(this.insights.sentiment.neutral/total*100).toFixed(1)}%)\n`;
    exportContent += `Negative: ${this.insights.sentiment.negative} (${(this.insights.sentiment.negative/total*100).toFixed(1)}%)\n\n`;

    // Add top influential comments
    exportContent += '=== TOP 5 INFLUENTIAL COMMENTS ===\n';
    this.insights.topInfluentialComments.forEach((comment, index) => {
      exportContent += `${index + 1}. ${comment.author || 'Unknown'} (${comment.replies || 0} replies)\n`;
      exportContent += `   "${comment.text || ''}"\n\n`;
    });

    // Add video ideas
    if (this.insights.videoIdeas.length > 0) {
      exportContent += '=== TOP 5 VIDEO IDEAS FOR NEXT VIDEO ===\n';
      this.insights.videoIdeas.forEach((idea, index) => {
        exportContent += `\n${index + 1}. ${idea.idea}\n`;
        exportContent += `   Category: ${idea.category.toUpperCase()}\n`;
        exportContent += `   Mentions: ${idea.mentions} | Engagement: ${idea.totalEngagement} | Sentiment: ${idea.sentiment}\n`;
        if (idea.examples && idea.examples.length > 0) {
          exportContent += `   Suggested by: ${idea.examples.map(e => e.author).join(', ')}\n`;
        }
      });
      exportContent += '\n';
    }

    // Add comment topics
    exportContent += '=== COMMENT TOPICS (AI-POWERED) ===\n';
    if (this.comments.length < 20) {
      exportContent += 'Topic grouping requires at least 20 comments.\n';
      exportContent += `Currently analyzing ${this.comments.length} comments.\n\n`;
    } else if (this.insights.commentTopics.length === 0) {
      exportContent += 'No distinct topics detected. Comments may be too diverse to group into themes.\n\n';
    } else {
      exportContent += 'Similar to YouTube\'s AI comment grouping:\n\n';
      this.insights.commentTopics.forEach(topic => {
        exportContent += `${topic.topic}: ${topic.count} comments (${topic.percentage}%)\n`;
        if (topic.examples && topic.examples.length > 0) {
          exportContent += '  Example comments:\n';
          topic.examples.forEach(ex => {
            const shortText = ex.text.length > 100 ? ex.text.substring(0, 100) + '...' : ex.text;
            exportContent += `  - "${shortText}" - ${ex.author}\n`;
          });
        }
        exportContent += '\n';
      });
    }

    // Add top engaged users
    exportContent += '=== TOP 5 ENGAGED USERS ===\n';
    this.insights.topEngagedUsers.forEach((user, index) => {
      exportContent += `${index + 1}. ${user.author}: ${user.commentCount} comments, ${user.totalLikes} total likes\n`;
    });
    exportContent += '\n';

    // Add business opportunities
    exportContent += '=== SALES & BUSINESS OPPORTUNITIES ===\n';
    if (this.insights.businessOpportunities.length === 0) {
      exportContent += 'No specific business opportunities detected in the comments.\n';
      exportContent += 'Keep creating great content and opportunities will emerge!\n\n';
    } else {
      this.insights.businessOpportunities.forEach(opp => {
        exportContent += `\n[${opp.type}] - ${opp.recommendation.priority} Priority\n`;
        exportContent += `Mentions: ${opp.count} | Total Engagement: ${opp.engagement}\n`;
        exportContent += `\nRecommendation: ${opp.recommendation.action}\n`;
        exportContent += `${opp.recommendation.details}\n`;
        if (opp.examples && opp.examples.length > 0) {
          exportContent += `\nExample comments:\n`;
          opp.examples.forEach(ex => {
            exportContent += `- "${ex.comment}" - ${ex.author}\n`;
          });
        }
        exportContent += '\n';
      });
    }

    // Add frequent questions
    exportContent += '=== CREATOR-DIRECTED QUESTIONS ===\n';
    if (this.insights.frequentQuestions.length === 0) {
      exportContent += 'No direct questions to the creator found.\n';
      exportContent += 'Viewers may be engaging through statements rather than questions.\n\n';
    } else {
      exportContent += 'Questions specifically directed at you:\n\n';
      this.insights.frequentQuestions.forEach((q, index) => {
        exportContent += `${index + 1}. [${q.category}] "${q.question}"\n`;
        exportContent += `   Asked by: ${q.author} (${q.likes} likes)\n\n`;
      });
      exportContent += 'Pro tip: Consider answering these in a Q&A video or pinned comment!\n\n';
    }

    // Add best features
    exportContent += '=== BEST VIDEO FEATURES ===\n';
    if (this.insights.bestFeatures.length === 0) {
      exportContent += 'No specific features praised in comments yet.\n\n';
    } else {
      exportContent += 'Features viewers loved:\n';
      this.insights.bestFeatures.forEach((feature, index) => {
        exportContent += `• ${feature.tag}\n`;
        exportContent += `  (From: "${feature.originalText}" - ${feature.author})\n`;
      });
      exportContent += '\n';
    }

    // Add areas for improvement
    exportContent += '=== AREAS FOR IMPROVEMENT ===\n';
    if (this.insights.areasForImprovement.length === 0) {
      exportContent += 'No constructive criticism found. Keep up the great work!\n\n';
    } else {
      exportContent += 'Constructive feedback from viewers:\n';
      this.insights.areasForImprovement.forEach((imp, index) => {
        exportContent += `• ${imp.tag}\n`;
        exportContent += `  (From: "${imp.originalText}" - ${imp.author})\n`;
      });
      exportContent += '\n';
    }

    // Add raw comments data
    exportContent += '\n=== RAW COMMENT DATA ===\n';
    const csvContent = [
      ['Author', 'Timestamp', 'Likes', 'Replies', 'Sentiment', 'Source', 'IsReply', 'Comment'], // Header
      ...this.comments.map(comment => [
        comment.author || 'Unknown',
        comment.timestamp || '',
        comment.likes || '0',
        comment.replies || '0',
        comment.sentiment || 'N/A',
        comment.element ? 'DOM' : 'API', // Indicate source
        comment.isReply ? 'Yes' : 'No', // Indicate if it's a reply
        (comment.text || '').replace(/"/g, '""') // Escape quotes for CSV
      ])
    ].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    exportContent += csvContent;

    // Create and download file
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vibelytics-insights-${Date.now()}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.updateStatus(`Exported insights for ${this.comments.length} comments`);
  }

  getVideoIdFromUrl() {
    // Extract video ID from current YouTube URL
    const url = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v') || null;
  }

  async fetchAPIComments() {
    const videoId = this.getVideoIdFromUrl();
    if (!videoId) {
      alert('Could not extract video ID from current URL');
      return;
    }

    // Check cache first
    console.log('\n=== YOUTUBE COMMENT FETCHING ===');
    console.log(`📹 Video ID: ${videoId}`);
    console.log('📍 STEP 1: CHECKING 7-DAY CACHE...');
    
    const cacheKey = `vibelytics_cache_${videoId}`;
    const cachedData = this.getCachedData(cacheKey);
    
    if (cachedData) {
      console.log('✅ CACHE FOUND - NO API CALLS NEEDED');
      console.log(`📅 Cached on: ${new Date(cachedData.fetchedAt).toLocaleDateString()}`);
      console.log(`💬 Comments in cache: ${cachedData.comments?.length || 0}`);
      console.log('🚫 SKIPPING YOUTUBE API CALL - Using cached data');
      
      // Check cache version and structure
      if (cachedData.version === '2.0' && cachedData.insights) {
        // New cache format: Load both comments AND pre-analyzed insights
        this.updateStatus(`Loading ${cachedData.comments.length} cached comments with insights...`);
        
        this.comments = cachedData.comments;
        this.insights = cachedData.insights; // Restore complete analysis
        
        console.log('📊 Loaded cached analysis insights:', {
          sentiment: this.insights.sentiment,
          businessOpportunities: this.insights.businessOpportunities?.length || 0,
          bestFeatures: this.insights.bestFeatures?.length || 0,
          areasForImprovement: this.insights.areasForImprovement?.length || 0,
          trollDetection: this.insights.trollDetection?.suspiciousBehaviors?.length || 0
        });
        
        // Update UI with cached insights immediately
        this.updateUI();
        this.displayInsights(); // Show insights right away
        
        this.updateStatus(`✅ Loaded ${cachedData.comments.length} comments with cached insights`);
      } else {
        // Old cache format: Only comments, need to re-analyze
        this.updateStatus(`Loading ${cachedData.comments.length} cached comments (re-analyzing)...`);
        
        this.comments = cachedData.comments;
        this.updateUI();
        
        if (this.comments.length === 0) {
          alert('No comments found in cache. This video might have comments disabled.');
          return;
        }
        
        // Re-analyze for old cache format
        this.analyzeComments();
      }
      return;
    }

    console.log('❌ NO CACHE FOUND');
    console.log('📍 STEP 2: PREPARING TO CALL YOUTUBE API...');

    // Check if API key is properly configured
    if (!this.apiKey || this.apiKey === 'YOUR_API_KEY_HERE') {
      const configureKey = confirm('YouTube API key not configured.\n\nWould you like to configure it now?');
      if (configureKey) {
        this.configureAPIKey();
      }
      return;
    }

    console.log('🌐 CALLING YOUTUBE DATA API v3...');
    console.log('📡 Endpoint: https://www.googleapis.com/youtube/v3/commentThreads');
    console.log(`🔑 API Key: ${this.apiKey ? 'Configured (' + this.apiKey.substring(0, 10) + '...)' : 'Not configured'}`);
    
    this.updateStatus('💰 Fetching ALL comments via YouTube API (no limits)...');
    
    try {
      // Clear existing comments and insights for fresh analysis
      this.comments = [];
      this.insights = {
        sentiment: { positive: 0, negative: 0, neutral: 0 },
        topInfluentialComments: [],
        videoIdeas: [],
        commentTopics: [],
        topEngagedUsers: {},
        businessOpportunities: [],
        frequentQuestions: [],
        bestFeatures: [],
        areasForImprovement: [],
        mostInterestingComments: [],
        wordFrequency: {}
      };
      this.updateUI();
      
      const allComments = await this.fetchAllCommentThreads(videoId);
      
      // Convert API response to our comment format
      this.processAPIComments(allComments);
      
      this.updateStatus(`✅ API fetch complete: ${this.comments.length} comments loaded - Analyzing...`);
      
      // Analyze comments after API fetch
      if (this.comments.length > 0) {
        this.analyzeComments();
        
        // Cache BOTH comments AND analysis results for 7 days
        this.cacheData(cacheKey, {
          comments: this.comments,
          insights: this.insights, // Cache the complete analysis results
          videoId: videoId,
          fetchedAt: new Date().toISOString(),
          analyzedAt: new Date().toISOString(),
          totalComments: this.comments.length,
          url: window.location.href,
          version: '2.0' // Version to handle cache format changes
        });
        
        console.log('💾 Cached comments AND analysis insights for 7 days');
      }
      
    } catch (error) {
      console.error('API Error:', error);
      this.updateStatus(`API Error: ${error.message}`);
      
      // Provide specific guidance based on error type
      let errorMessage = `YouTube API Error: ${error.message}\n\n`;
      
      if (error.message.includes('not been used in project') || error.message.includes('disabled')) {
        errorMessage += 'SOLUTION:\n1. Visit: https://console.cloud.google.com/apis/library/youtube.googleapis.com\n2. Enable the YouTube Data API v3\n3. Wait 2-3 minutes and try again';
      } else if (error.message.includes('quota')) {
        errorMessage += 'SOLUTION:\nAPI quota exceeded. Try again tomorrow or upgrade your quota.';
      } else if (error.message.includes('disabled')) {
        errorMessage += 'SOLUTION:\nComments may be disabled for this video.';
      } else {
        errorMessage += 'SOLUTION:\nCheck your API key configuration and try again.';
      }
      
      alert(errorMessage);
    }
  }

  async fetchCommentThreads(videoId, pageToken = '') {
    const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
    const params = {
      part: 'snippet,replies',
      videoId: videoId,
      maxResults: 100, // Maximum allowed per request
      key: this.apiKey,
      order: 'time' // Get newest first
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }

    url.search = new URLSearchParams(params).toString();

    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message || 'API request failed');
    }
    
    return response.json();
  }

  async fetchAllCommentThreads(videoId) {
    let allComments = [];
    let nextPageToken = '';
    let pageCount = 0;
    const maxPages = 1000; // No limit - get ALL comments (optimization: cache will prevent excessive API usage)

    this.updateStatus('Fetching comments from YouTube API...');

    do {
      try {
        console.log(`📄 Fetching page ${pageCount + 1} from YouTube API...`);
        this.updateStatus(`Fetching API page ${pageCount + 1}...`);
        
        const data = await this.fetchCommentThreads(videoId, nextPageToken);
        console.log(`✅ Page ${pageCount + 1}: Found ${data.items?.length || 0} comment threads`);
        allComments = allComments.concat(data.items || []);
        nextPageToken = data.nextPageToken || '';
        pageCount++;
        
        // Update progress
        this.updateStatus(`API Progress: ${allComments.length} comments (page ${pageCount})`);
        
        // Small delay to be nice to the API
        if (nextPageToken) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error('Error fetching page:', error);
        break;
      }
    } while (nextPageToken && pageCount < maxPages);

    console.log('\n📊 YOUTUBE API FETCH COMPLETE:');
    console.log(`✅ Total pages fetched: ${pageCount}`);
    console.log(`✅ Total comment threads: ${allComments.length}`);
    console.log(`💰 API quota used: ${pageCount} requests`);
    console.log('=== END YOUTUBE API CALLS ===\n');

    return allComments;
  }

  processAPIComments(commentThreads) {
    commentThreads.forEach(thread => {
      try {
        // Add defensive checks for thread structure
        if (!thread || !thread.snippet || !thread.snippet.topLevelComment) {
          console.warn('Skipping malformed thread:', thread);
          return;
        }
        
        const topComment = thread.snippet.topLevelComment.snippet;
        
        // Process top-level comment
        this.addAPIComment(topComment, thread.snippet.totalReplyCount || 0);
        
        // Process replies if they exist
        if (thread.replies && thread.replies.comments) {
          thread.replies.comments.forEach(reply => {
            if (reply && reply.snippet) {
              this.addAPIComment(reply.snippet, 0, true);
            }
          });
        }
      } catch (error) {
        console.warn('Error processing thread:', error, thread);
      }
    });
    
    this.updateUI();
  }

  addAPIComment(commentData, replyCount = 0, isReply = false) {
    // Add defensive checks for missing data
    if (!commentData) {
      console.warn('Skipping null comment data');
      return;
    }
    
    const safeText = commentData.textDisplay || commentData.textOriginal || '';
    const safeAuthor = commentData.authorDisplayName || 'Unknown';
    
    const comment = {
      id: this.comments.length,
      author: safeAuthor,
      text: safeText,
      timestamp: this.formatAPIDate(commentData.publishedAt),
      likes: (commentData.likeCount || 0).toString(),
      replies: replyCount.toString(),
      isReply: isReply,
      element: null, // No DOM element for API comments
      uniqueKey: `${safeAuthor}-${safeText.substring(0, 50)}`
    };
    
    // Avoid duplicates
    if (!this.comments.some(c => c.uniqueKey === comment.uniqueKey)) {
      this.comments.push(comment);
    }
  }

  formatAPIDate(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return '1 day ago';
      if (diffDays < 30) return `${diffDays} days ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch (error) {
      return dateString;
    }
  }

  configureAPIKey() {
    const newKey = prompt(
      'Enter your YouTube Data API v3 key:\n\n' +
      'To get an API key:\n' +
      '1. Go to: https://console.cloud.google.com/\n' +
      '2. Create/select a project\n' +
      '3. Enable YouTube Data API v3\n' +
      '4. Go to Credentials > Create Credentials > API Key\n' +
      '5. Copy the key and paste it here',
      this.apiKey
    );

    if (newKey && newKey.trim() !== '') {
      this.apiKey = newKey.trim();
      // Store in local storage for persistence
      localStorage.setItem('youtube-comment-reader-api-key', this.apiKey);
      alert('API key updated successfully!');
      this.updateStatus('API key configured');
    }
  }

  loadAPIKey() {
    // Try to load API key from local storage
    const storedKey = localStorage.getItem('youtube-comment-reader-api-key');
    if (storedKey) {
      this.apiKey = storedKey;
    }
  }

  // Cache management methods
  cacheData(key, data) {
    const cacheItem = {
      data: data,
      timestamp: Date.now(),
      expiry: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    try {
      localStorage.setItem(key, JSON.stringify(cacheItem));
      console.log(`Cached data for ${key}, expires in 7 days`);
    } catch (e) {
      console.warn('Cache storage failed:', e.message);
      // If storage is full, try to clean old cache first
      this.cleanExpiredCache();
      try {
        localStorage.setItem(key, JSON.stringify(cacheItem));
      } catch (e2) {
        console.warn('Cache storage failed even after cleanup:', e2.message);
      }
    }
  }

  getCachedData(key) {
    console.log(`🔍 Checking cache for key: ${key}`);
    
    try {
      const cacheItem = localStorage.getItem(key);
      if (!cacheItem) {
        console.log('❌ No cache found in localStorage');
        return null;
      }
      
      console.log('📦 Cache found, checking expiry...');
      const parsed = JSON.parse(cacheItem);
      
      // Check if cache has expired
      const now = Date.now();
      const expiryDate = new Date(parsed.expiry);
      const cacheAge = (now - parsed.timestamp) / (1000 * 60 * 60 * 24); // in days
      
      console.log(`📅 Cache created: ${new Date(parsed.timestamp).toLocaleDateString()}`);
      console.log(`📅 Cache expires: ${expiryDate.toLocaleDateString()}`);
      console.log(`⏰ Cache age: ${cacheAge.toFixed(1)} days`);
      
      if (now > parsed.expiry) {
        localStorage.removeItem(key);
        console.log(`❌ Cache EXPIRED (older than 7 days), removed`);
        return null;
      }
      
      const daysRemaining = (parsed.expiry - now) / (24 * 60 * 60 * 1000);
      console.log(`✅ Cache VALID - ${Math.round(daysRemaining)} days remaining`);
      console.log(`💬 Cached comments: ${parsed.data?.comments?.length || 0}`);
      
      return parsed.data;
    } catch (e) {
      console.warn('❌ Cache read failed:', e.message);
      localStorage.removeItem(key);
      return null;
    }
  }

  cleanExpiredCache() {
    const keysToRemove = [];
    const now = Date.now();
    
    // Check all localStorage keys for expired Vibelytics cache
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vibelytics_cache_')) {
        try {
          const cacheItem = JSON.parse(localStorage.getItem(key));
          if (cacheItem.expiry && now > cacheItem.expiry) {
            keysToRemove.push(key);
          }
        } catch (e) {
          // Invalid cache item, mark for removal
          keysToRemove.push(key);
        }
      }
    }
    
    // Remove expired cache items
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`Removed expired cache: ${key}`);
    });
    
    if (keysToRemove.length > 0) {
      console.log(`Cleaned ${keysToRemove.length} expired cache items`);
    }
  }

  suppressStorageErrors() {
    // Override console.error temporarily to filter out storage access errors
    const originalError = console.error;
    console.error = function(...args) {
      // Filter out third-party storage access errors (not related to extension)
      const errorString = args.join(' ');
      if (errorString.includes('requestStorageAccessFor') || 
          errorString.includes('requestStorageAccess') ||
          errorString.includes('Storage access') ||
          errorString.includes('third-party cookies')) {
        // Silently ignore these errors as they don't affect the extension
        return;
      }
      // Pass through all other errors
      originalError.apply(console, args);
    };
  }

  // ANALYTICS FUNCTIONS

  analyzeComments() {
    // Reset insights
    this.insights = {
      sentiment: { positive: 0, negative: 0, neutral: 0 },
      topInfluentialComments: [],
      videoIdeas: [],
      commentTopics: [],
      topEngagedUsers: {},
      businessOpportunities: [],
      frequentQuestions: [],
      bestFeatures: [],
      areasForImprovement: [],
      mostInterestingComments: [],
      wordFrequency: {},
      inappropriateUsers: {},
      toxicityLevels: { toxic: 0, inappropriate: 0, offensive: 0, spam: 0 },
      overallToxicity: 0,
      narrativeSummary: '',
      generalSummary: '',
      // New advanced features
      timeBasedAnalysis: {
        commentTimeline: [],
        peakEngagementWindows: [],
        sentimentEvolution: []
      },
      trollDetection: {
        suspiciousBehaviors: [],
        repeatOffenders: []
      },
      engagementQuality: {
        overallScore: 0,
        meaningfulComments: 0,
        threadParticipation: 0,
        questionsAsked: 0,
        topicRelevance: 0,
        meaningfulnessIndex: 0,
        depthAnalysis: []
      },
      monetizationIntelligence: {
        monetizationPotential: 0,
        revenueOpportunities: [],
        audienceValue: [],
        productMentions: [],
        brandOpportunities: [],
        merchandiseDemand: [],
        courseInterest: []
      },
      seriesPlanner: {
        seriesIdeas: [],
        continuationSuggestions: [],
        multiPartRequests: [],
        continuationDemand: [],
        formatPreferences: []
      },
      smartNotifications: {
        urgentNotifications: [],
        generalNotifications: [],
        crisisAlerts: [],
        viralMoments: [],
        questionOverflow: [],
        trendingComments: []
      },
      threadAnalysis: {
        conversationThreads: [],
        topDiscussions: [],
        influenceMapping: [],
        discussionLeaders: []
      },
      communityLeaders: {
        influentialUsers: [],
        helpfulContributors: [],
        superfans: [],
        influentialCommenters: [],
        engagementDrivers: []
      },
      contentFatigue: {
        fatigueLevel: 0,
        fatigueIndicators: [],
        suggestions: [],
        fatigueWarnings: [],
        topicSaturation: [],
        freshnessSuggestions: []
      },
      controversialComments: {
        debates: [],
        polarizingTopics: [],
        highEngagementDisputes: []
      }
    };

    // Analyze ALL comments - no limits for comprehensive insights
    const commentsToAnalyze = this.comments;
    const isHighVolume = this.comments.length > 1000;
    
    if (isHighVolume) {
      console.log(`High-volume video detected. Analyzing all ${this.comments.length} comments for comprehensive insights.`);
      this.updateStatus(`Analyzing all ${this.comments.length} comments...`);
    }
    
    // Debug counters
    let debugCounters = {
      totalComments: commentsToAnalyze.length,
      positiveComments: 0,
      negativeComments: 0,
      neutralComments: 0,
      featuresFound: 0,
      improvementsFound: 0
    };
    
    // Analyze each comment
    commentsToAnalyze.forEach((comment, index) => {
      // Skip comments with missing critical data
      if (!comment || !comment.text) {
        console.warn('Skipping comment with missing data:', comment);
        return;
      }
      
      // Update progress for high-volume videos
      if (isHighVolume && index % 200 === 0 && index > 0) {
        this.updateStatus(`Analyzing comments... ${Math.floor((index / commentsToAnalyze.length) * 100)}%`);
      }
      
      this.analyzeSentiment(comment);
      
      // Track sentiment distribution
      if (comment.sentiment === 'positive') debugCounters.positiveComments++;
      else if (comment.sentiment === 'negative') debugCounters.negativeComments++;
      else debugCounters.neutralComments++;
      
      this.analyzeToxicity(comment);
      this.extractVideoIdeas(comment);
      this.findBusinessOpportunities(comment);
      this.extractQuestions(comment);
      
      // Track features and improvements before and after
      const featuresBefore = this.insights.bestFeatures.length;
      const improvementsBefore = this.insights.areasForImprovement.length;
      
      this.findBestFeatures(comment);
      this.findAreasForImprovement(comment);
      
      if (this.insights.bestFeatures.length > featuresBefore) debugCounters.featuresFound++;
      if (this.insights.areasForImprovement.length > improvementsBefore) debugCounters.improvementsFound++;
      this.trackUserEngagement(comment);
      this.scoreInterestingComment(comment);
      this.analyzeWordFrequency(comment);
      // New advanced analysis
      this.analyzeTimeBasedPatterns(comment);
      this.detectTrollBehavior(comment);
      this.assessEngagementQuality(comment);
      this.trackMonetizationOpportunities(comment);
      this.identifySeriesOpportunities(comment);
      this.analyzeThreadPatterns(comment);
      this.detectControversialComment(comment);
    });

    // Log debug information
    console.log('🔍 Comment Analysis Debug:', debugCounters);
    console.log('📊 Sentiment Distribution:', {
      positive: `${(debugCounters.positiveComments / debugCounters.totalComments * 100).toFixed(1)}%`,
      negative: `${(debugCounters.negativeComments / debugCounters.totalComments * 100).toFixed(1)}%`,
      neutral: `${(debugCounters.neutralComments / debugCounters.totalComments * 100).toFixed(1)}%`
    });
    console.log('✨ Features found during analysis:', debugCounters.featuresFound);
    console.log('🔧 Improvements found during analysis:', debugCounters.improvementsFound);

    // Post-processing
    this.findTopInfluentialComments();
    this.calculateTopEngagedUsers();
    this.groupCommentTopics();
    this.processVideoIdeas();
    this.processBusinessOpportunities();
    this.selectMostInterestingComments();
    this.processFrequentQuestions();
    this.processBestFeatures();
    this.processAreasForImprovement();
    this.calculateTopInappropriateUsers();
    this.calculateOverallToxicity();
    this.generateNarrativeSummary();
    this.generateGeneralSummary();
    // New advanced post-processing
    this.processTimeBasedAnalysis();
    this.processTrollDetection();
    this.calculateEngagementQuality();
    this.processMonetizationIntel();
    this.processSeriesPlanning();
    this.generateSmartNotifications();
    this.processThreadAnalysis();
    this.identifyCommunityLeaders();
    this.assessContentFatigue();
    this.processControversialComments();
    
    // Update UI with insights
    this.displayInsights();
    
    // Hide the "Show Insights" button since panel is now visible
    if (this.showInsightsButton) {
      this.showInsightsButton.style.display = 'none';
    }
    
    // Show the email button after analysis
    if (this.emailButton) {
      this.emailButton.style.display = 'inline-block';
    } else {
      // If emailButton reference is lost, find it by ID
      const emailBtn = document.querySelector('button[title="Email Insights"]');
      if (emailBtn) {
        emailBtn.style.display = 'inline-block';
      }
    }
  }

  analyzeSentiment(comment) {
    const text = (comment.text || '').toLowerCase();
    
    // Positive indicators
    const positiveWords = ['love', 'amazing', 'awesome', 'great', 'excellent', 'fantastic', 
                          'wonderful', 'best', 'perfect', 'brilliant', 'outstanding', 'helpful',
                          'thank', 'appreciate', 'favorite', 'enjoy', 'good', 'nice', 'cool',
                          'impressive', 'useful', 'valuable', '❤️', '😍', '👍', '🔥', '💯'];
    
    // Negative indicators
    const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'bad', 'disappointing',
                          'boring', 'waste', 'sucks', 'stupid', 'dumb', 'annoying', 'frustrated',
                          'confusing', 'unclear', 'difficult', 'problem', 'issue', 'wrong',
                          'misleading', 'clickbait', '👎', '😠', '😡', '💔'];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    positiveWords.forEach(word => {
      if (text.includes(word)) positiveScore++;
    });
    
    negativeWords.forEach(word => {
      if (text.includes(word)) negativeScore++;
    });
    
    // Classify sentiment
    if (positiveScore > negativeScore) {
      this.insights.sentiment.positive++;
      comment.sentiment = 'positive';
    } else if (negativeScore > positiveScore) {
      this.insights.sentiment.negative++;
      comment.sentiment = 'negative';
    } else {
      this.insights.sentiment.neutral++;
      comment.sentiment = 'neutral';
    }
  }

  analyzeToxicity(comment) {
    const text = (comment.text || '').toLowerCase();
    
    // Toxicity indicators
    const toxicityPatterns = {
      toxic: [
        // Strong profanity and slurs
        'fuck', 'shit', 'bitch', 'asshole', 'dick', 'bastard', 'damn',
        'wtf', 'stfu', 'fck', 'fking', 'f*ck', 'sh*t', 'b*tch',
        // Hate speech indicators
        'kill yourself', 'kys', 'go die', 'hope you die', 'kill you',
        'retard', 'retarded', 'gay', 'fag', 'faggot', 'nigga', 'nigger'
      ],
      inappropriate: [
        // Sexual content
        'sex', 'porn', 'nude', 'naked', 'boobs', 'tits', 'ass', 'pussy',
        'dick', 'cock', 'penis', 'vagina', 'horny', 'sexy', 'hot',
        // Mild profanity
        'crap', 'piss', 'hell', 'idiot', 'moron', 'dumbass'
      ],
      offensive: [
        // Personal attacks
        'you suck', 'you\'re stupid', 'you\'re dumb', 'you\'re an idiot',
        'trash', 'garbage', 'pathetic', 'loser', 'ugly', 'fat',
        'disgusting', 'gross', 'nasty', 'worthless'
      ],
      spam: [
        // Spam patterns
        'check my channel', 'sub to me', 'subscribe to my', 'click here',
        'bit.ly', 'tinyurl', 'free money', 'earn money', 'work from home',
        'check out my', 'visit my', 'follow me', 'dm me', 'text me'
      ]
    };
    
    let toxicityDetected = false;
    
    // Check each pattern category
    Object.entries(toxicityPatterns).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        if (text.includes(pattern)) {
          this.insights.toxicityLevels[category]++;
          toxicityDetected = true;
          
          // Track user's inappropriate comments
          const author = comment.author || 'Unknown';
          if (!this.insights.inappropriateUsers[author]) {
            this.insights.inappropriateUsers[author] = {
              count: 0,
              comments: [],
              categories: new Set()
            };
          }
          
          this.insights.inappropriateUsers[author].count++;
          this.insights.inappropriateUsers[author].comments.push({
            text: comment.text || '',
            category: category,
            likes: comment.likes || '0'
          });
          this.insights.inappropriateUsers[author].categories.add(category);
        }
      });
    });
    
    comment.isToxic = toxicityDetected;
  }

  // NEW ADVANCED ANALYSIS METHODS

  analyzeTimeBasedPatterns(comment) {
    // Extract timestamp if available or use relative time
    const timeData = {
      comment: comment,
      relativeTime: comment.timestamp || comment.time || 'Recent',
      sentiment: comment.sentiment,
      engagement: parseInt(comment.likes || 0) + parseInt(comment.replies || 0)
    };
    
    this.insights.timeBasedAnalysis.commentTimeline.push(timeData);
  }

  detectTrollBehavior(comment) {
    const text = (comment.text || '').toLowerCase();
    const author = comment.author || 'Unknown';
    
    // Troll behavior patterns
    const trollIndicators = {
      excessive_caps: text && text.length > 0 ? (text.match(/[A-Z]/g) || []).length / text.length > 0.5 : false,
      excessive_punctuation: /[!?]{3,}/.test(text),
      flame_baiting: /triggered|mad|angry|cry|cope|seething/i.test(text),
      off_topic_spam: /first|like if you|sub to me|check my channel/i.test(text),
      hate_speech: author && this.insights.inappropriateUsers[author]?.categories?.has('toxic'),
      short_aggressive: text.length < 50 && /stupid|dumb|trash|garbage|sucks/i.test(text)
    };
    
    const trollScore = Object.values(trollIndicators).filter(Boolean).length;
    
    if (trollScore >= 2) {
      this.insights.trollDetection.suspiciousBehaviors.push({
        author: author,
        comment: comment.text,
        indicators: Object.keys(trollIndicators).filter(key => trollIndicators[key]),
        severity: trollScore >= 4 ? 'high' : trollScore >= 3 ? 'medium' : 'low'
      });
    }
  }

  assessEngagementQuality(comment) {
    const text = (comment.text || '').toLowerCase();
    const originalText = comment.text || '';
    let qualityScore = 3; // Start with baseline score of 3
    const qualityFactors = [];
    
    // Length-based scoring (more nuanced)
    if (originalText.length > 200) { 
      qualityScore += 3; qualityFactors.push('very_detailed'); 
    } else if (originalText.length > 100) { 
      qualityScore += 2; qualityFactors.push('detailed'); 
    } else if (originalText.length > 50) { 
      qualityScore += 1; qualityFactors.push('moderate'); 
    } else if (originalText.length < 20) { 
      qualityScore -= 2; qualityFactors.push('very_brief'); 
    }
    
    // High-value content indicators
    if (/because|since|therefore|however|although|while|despite|unless|whereas/i.test(text)) { 
      qualityScore += 3; qualityFactors.push('reasoned_thinking'); 
    }
    if (/\?/.test(originalText)) { 
      qualityScore += 2; qualityFactors.push('inquisitive'); 
    }
    if (/thank|appreciate|helpful|learned|educational|informative/i.test(text)) { 
      qualityScore += 2; qualityFactors.push('grateful_positive'); 
    }
    if (/suggest|recommend|idea|improvement|would be better|could improve/i.test(text)) { 
      qualityScore += 3; qualityFactors.push('constructive_feedback'); 
    }
    if (/experience|story|happened to me|when i|personal/i.test(text)) { 
      qualityScore += 2; qualityFactors.push('personal_experience'); 
    }
    if (/agree|disagree|perspective|opinion|think that|believe/i.test(text)) { 
      qualityScore += 1; qualityFactors.push('thoughtful_opinion'); 
    }
    
    // Engagement indicators
    const likes = parseInt(comment.likes) || 0;
    const replies = parseInt(comment.replies) || 0;
    if (likes > 10) { qualityScore += 2; qualityFactors.push('popular'); }
    if (replies > 5) { qualityScore += 2; qualityFactors.push('discussion_starter'); }
    
    // Timestamp or specific references
    if (/\d{1,2}:\d{2}|\d+%|minute|second|part|section/i.test(originalText)) {
      qualityScore += 2; qualityFactors.push('specific_reference');
    }
    
    // Negative quality indicators
    if (/^(first|early|here before)/i.test(text)) { 
      qualityScore -= 4; qualityFactors.push('notification_squad'); 
    }
    if (/like if you|sub to me|check my channel|follow me/i.test(text)) { 
      qualityScore -= 5; qualityFactors.push('self_promotion'); 
    }
    if (originalText === originalText.toUpperCase() && originalText.length > 10) { 
      qualityScore -= 2; qualityFactors.push('excessive_caps'); 
    }
    if (/copy|paste|copypasta/i.test(text) || originalText.includes('░') || originalText.includes('▓')) {
      qualityScore -= 3; qualityFactors.push('spam_copypasta');
    }
    if (/cringe|toxic|trash|garbage|sucks|worst|hate/i.test(text)) {
      qualityScore -= 1; qualityFactors.push('negative_tone');
    }
    
    // Final score bounds (0-10 scale)
    comment.qualityScore = Math.max(0, Math.min(10, qualityScore));
    comment.qualityFactors = qualityFactors;
    
    this.insights.engagementQuality.depthAnalysis.push({
      author: comment.author,
      score: comment.qualityScore,
      factors: qualityFactors,
      text: originalText.substring(0, 100),
      likes: likes,
      replies: replies
    });
  }

  trackMonetizationOpportunities(comment) {
    const text = (comment.text || '').toLowerCase();
    
    // Product/gear mentions
    const productPatterns = [
      /what camera|which camera|camera you use|what mic|microphone|equipment|gear/i,
      /where did you buy|link to|affiliate|discount code/i,
      /what software|editing software|which editor/i
    ];
    
    productPatterns.forEach(pattern => {
      if (pattern.test(text)) {
        this.insights.monetizationIntelligence.productMentions.push({
          author: comment.author,
          text: comment.text,
          type: 'gear_inquiry',
          engagement: parseInt(comment.likes || 0)
        });
      }
    });
    
    // Brand collaboration opportunities
    if (/sponsor|brand|partnership|collaborate|work with/i.test(text)) {
      this.insights.monetizationIntelligence.brandOpportunities.push({
        author: comment.author,
        text: comment.text,
        type: 'collaboration_interest'
      });
    }
    
    // Merchandise demand
    if (/merch|t-shirt|hoodie|sticker|buy your|sell/i.test(text)) {
      this.insights.monetizationIntelligence.merchandiseDemand.push({
        author: comment.author,
        text: comment.text,
        type: 'merchandise_interest'
      });
    }
    
    // Course/educational content interest
    if (/course|tutorial|teach|learn|class|workshop|masterclass/i.test(text)) {
      this.insights.monetizationIntelligence.courseInterest.push({
        author: comment.author,
        text: comment.text,
        type: 'educational_interest'
      });
    }
  }

  identifySeriesOpportunities(comment) {
    const text = (comment.text || '').toLowerCase();
    
    // Multi-part content requests
    const seriesPatterns = [
      /part 2|part two|next part|continue|sequel|follow up/i,
      /series|episode|season|more episodes/i,
      /deep dive|detailed|more about|expand on/i
    ];
    
    seriesPatterns.forEach(pattern => {
      if (pattern.test(text)) {
        this.insights.seriesPlanner.multiPartRequests.push({
          author: comment.author,
          text: comment.text,
          type: 'continuation_request',
          engagement: parseInt(comment.likes || 0)
        });
      }
    });
    
    // Format preferences
    if (/long form|longer video|short|quick|brief/i.test(text)) {
      this.insights.seriesPlanner.formatPreferences.push({
        author: comment.author,
        preference: /long|longer/.test(text) ? 'long_form' : 'short_form',
        text: comment.text
      });
    }
  }

  analyzeThreadPatterns(comment) {
    // Only track comments with meaningful discussion
    const replyCount = parseInt(comment.replies || 0);
    
    // Track comments that generate significant discussion (3+ replies)
    if (!comment.isReply && replyCount >= 3) {
      this.insights.threadAnalysis.discussionLeaders.push({
        author: comment.author,
        text: comment.text,
        replies: replyCount,
        engagement: parseInt(comment.likes || 0)
      });
    }
    
    // For now, we'll process actual threads in the post-processing phase
    // This prevents creating too many thread entries for videos with few comments
  }

  detectControversialComment(comment) {
    const text = (comment.text || '').toLowerCase();
    const likes = parseInt(comment.likes) || 0;
    const replies = parseInt(comment.replies) || 0;
    
    // Controversy indicators
    const controversyScore = {
      hasDebateTerms: false,
      hasPolarizingLanguage: false,
      highEngagementRatio: false,
      hasDisagreement: false,
      hasOpinionDividers: false,
      score: 0
    };
    
    // Debate-triggering terms
    const debateTerms = [
      'disagree', 'wrong', 'actually', 'but', 'however', 'no,', 'yes,',
      'debate', 'argue', 'discussion', 'controversial', 'unpopular opinion',
      'hot take', 'am i the only one', 'change my mind', 'prove me wrong',
      'fight me', 'come at me', 'tbh', 'honestly', 'real talk'
    ];
    
    // Polarizing topics and language
    const polarizingTerms = [
      'overrated', 'underrated', 'worst', 'best', 'terrible', 'amazing',
      'trash', 'goat', 'mid', 'cringe', 'based', 'cancel', 'toxic',
      'stan', 'hater', 'fanboy', 'shill', 'sellout', 'fake', 'real'
    ];
    
    // Opinion dividers
    const opinionDividers = [
      'vs', 'versus', 'better than', 'worse than', 'superior', 'inferior',
      'prefer', 'rather', 'instead of', 'compared to', 'or', 'team'
    ];
    
    // Check for debate terms
    debateTerms.forEach(term => {
      if (text.includes(term)) {
        controversyScore.hasDebateTerms = true;
        controversyScore.score += 1;
      }
    });
    
    // Check for polarizing language
    polarizingTerms.forEach(term => {
      if (text.includes(term)) {
        controversyScore.hasPolarizingLanguage = true;
        controversyScore.score += 2;
      }
    });
    
    // Check for opinion dividers
    opinionDividers.forEach(term => {
      if (text.includes(term)) {
        controversyScore.hasOpinionDividers = true;
        controversyScore.score += 1;
      }
    });
    
    // High engagement ratio (lots of replies relative to likes)
    if (replies > 0 && likes > 0) {
      const replyToLikeRatio = replies / likes;
      if (replyToLikeRatio > 0.1) { // More than 10% reply rate
        controversyScore.highEngagementRatio = true;
        controversyScore.score += 3;
      }
    }
    
    // Check for disagreement patterns
    const disagreementPatterns = [
      /^no[,.]?\s/i, /^yes[,.]?\s/i, /^wrong/i, /^right/i,
      /i disagree/i, /i agree/i, /you're wrong/i, /you're right/i
    ];
    
    disagreementPatterns.forEach(pattern => {
      if (pattern.test(text)) {
        controversyScore.hasDisagreement = true;
        controversyScore.score += 2;
      }
    });
    
    // Determine if comment is controversial (score > 3)
    if (controversyScore.score >= 3) {
      // Categorize the controversial comment
      const category = this.categorizeControversialComment(text);
      
      const controversialComment = {
        author: comment.author || 'Unknown',
        text: comment.text,
        likes: likes,
        replies: replies,
        controversyScore: controversyScore.score,
        category: category,
        reasons: [],
        triggers: [],
        engagement: likes + (replies * 3), // Weight replies more heavily
        sentiment: comment.sentiment
      };
      
      // Add reasons and triggers
      if (controversyScore.hasDebateTerms) {
        controversialComment.reasons.push('Contains debate-triggering language');
        controversialComment.triggers.push('High reply-to-like ratio');
      }
      if (controversyScore.hasPolarizingLanguage) {
        controversialComment.reasons.push('Uses polarizing terms');
        controversialComment.triggers.push('Uses polarizing terms');
      }
      if (controversyScore.highEngagementRatio) {
        controversialComment.reasons.push('High reply-to-like ratio');
        controversialComment.triggers.push('High reply-to-like ratio');
      }
      if (controversyScore.hasDisagreement) {
        controversialComment.reasons.push('Expresses disagreement');
        controversialComment.triggers.push('Compares or divides opinions');
      }
      if (controversyScore.hasOpinionDividers) {
        controversialComment.reasons.push('Compares or divides opinions');
        controversialComment.triggers.push('Compares or divides opinions');
      }
      
      this.insights.controversialComments.debates.push(controversialComment);
    }
  }
  
  categorizeControversialComment(text) {
    const lowerText = text.toLowerCase();
    
    // Category patterns - more specific matching
    const categories = {
      'Fan culture': [
        'stan', 'stans', 'fanboy', 'fangirl', 'hater', 'haters', 'fandom', 
        'ship', 'shipping', 'bias', 'biased', 'bandwagon', 'mainstream'
      ],
      'Authenticity debates': [
        'fake', 'real', 'authentic', 'staged', 'scripted', 'acting', 'pretending',
        'genuine', 'honest', 'lies', 'lying', 'truth', 'sellout', 'shill'
      ],
      'Cancel culture': [
        'cancel', 'cancelled', 'problematic', 'toxic', 'accountability',
        'called out', 'exposed', 'controversy', 'drama', 'scandal'
      ],
      'Quality debates': [
        'overrated', 'underrated', 'goat', 'best', 'worst', 'trash', 'mid',
        'masterpiece', 'terrible', 'amazing', 'peak', 'flop'
      ],
      'Comparison wars': [
        'vs', 'versus', 'better than', 'worse than', 'superior', 'inferior',
        'compare', 'comparison', 'which is better', 'team'
      ],
      'Generational debates': [
        'gen z', 'millennial', 'boomer', 'generation', 'old school', 'new school',
        'back in my day', 'kids today', 'young people', 'older generation'
      ]
    };
    
    // Check each category
    for (const [category, keywords] of Object.entries(categories)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return category;
        }
      }
    }
    
    // Default category if no specific match
    return 'General controversy';
  }

  findTopInfluentialComments() {
    // Sort by reply count and get top 5
    const sortedByReplies = [...this.comments]
      .filter(c => !c.isReply) // Only top-level comments
      .sort((a, b) => parseInt(b.replies) - parseInt(a.replies))
      .slice(0, 5);
    
    this.insights.topInfluentialComments = sortedByReplies;
  }

  extractVideoIdeas(comment) {
    const text = (comment.text || '').toLowerCase();
    const originalText = comment.text;
    
    // Expanded phrases for better idea detection
    const ideaPhrases = {
      'tutorial': ['tutorial on', 'tutorial about', 'how to', 'teach us', 'show us how', 'guide on', 'walkthrough'],
      'series': ['part 2', 'part two', 'next part', 'series on', 'continue this', 'more episodes', 'next episode'],
      'topic': ['video on', 'video about', 'cover', 'talk about', 'discuss', 'explain', 'deep dive', 'more about'],
      'comparison': ['vs', 'versus', 'compare', 'comparison', 'which is better', 'difference between'],
      'reaction': ['react to', 'reaction video', 'watch', 'review', 'thoughts on', 'opinion on'],
      'collaboration': ['collab with', 'collaborate', 'video with', 'feature', 'bring', 'invite'],
      'request': ['please make', 'please do', 'would love', 'can you', 'could you', 'you should', 'request', 'suggestion'],
      'content_type': ['vlog', 'behind the scenes', 'q&a', 'live stream', 'podcast', 'interview']
    };
    
    Object.entries(ideaPhrases).forEach(([category, phrases]) => {
      phrases.forEach(phrase => {
        if (text.includes(phrase)) {
          // Extract more context - look for the full sentence or up to 150 characters
          let ideaText = '';
          const phraseIndex = originalText.toLowerCase().indexOf(phrase);
          
          if (phraseIndex !== -1) {
            // Find sentence boundaries
            let start = phraseIndex;
            let end = phraseIndex + phrase.length;
            
            // Look backwards for sentence start
            for (let i = phraseIndex - 1; i >= 0 && i > phraseIndex - 100; i--) {
              if (originalText[i] === '.' || originalText[i] === '!' || originalText[i] === '?' || i === 0) {
                start = i === 0 ? 0 : i + 1;
                break;
              }
            }
            
            // Look forward for sentence end or 150 chars
            for (let i = end; i < originalText.length && i < start + 200; i++) {
              if (originalText[i] === '.' || originalText[i] === '!' || originalText[i] === '?') {
                end = i + 1;
                break;
              }
            }
            
            ideaText = originalText.substring(start, end).trim();
            
            // Clean up the text
            ideaText = ideaText.replace(/^\W+/, ''); // Remove leading non-word characters
            
            if (ideaText.length > 20) { // Only add substantial ideas
              this.insights.videoIdeas.push({
                idea: ideaText,
                category: category,
                author: comment.author,
                likes: parseInt(comment.likes) || 0,
                replies: parseInt(comment.replies) || 0,
                engagement: (parseInt(comment.likes) || 0) + (parseInt(comment.replies) || 0) * 2,
                sentiment: comment.sentiment || 'neutral'
              });
            }
          }
        }
      });
    });
  }

  findBusinessOpportunities(comment) {
    const text = (comment.text || '').toLowerCase();
    const originalText = comment.text;
    
    // More specific business opportunity patterns
    const businessPatterns = {
      'Product Inquiry': {
        keywords: ['where can i buy', 'where to buy', 'where did you get', 'link to', 'what brand', 
                   'which product', 'where to purchase', 'where is this from', 'what are you using'],
        validate: (text) => text.length > 20 && (text.includes('?') || text.includes('buy') || text.includes('get'))
      },
      'Sponsorship Interest': {
        keywords: ['sponsor', 'sponsorship', 'brand deal', 'partnership', 'collaborate with my brand',
                   'represent our', 'ambassador', 'work with us'],
        validate: (text) => text.includes('sponsor') || text.includes('partner')
      },
      'Service Request': {
        keywords: ['hire you', 'freelance', 'commission', 'pay you', 'how much for', 'your services',
                   'work for us', 'available for', 'do you offer'],
        validate: (text) => text.includes('hire') || text.includes('pay') || text.includes('service')
      },
      'Course/Education': {
        keywords: ['course', 'workshop', 'masterclass', 'teach', 'training', 'tutorial series',
                   'paid course', 'learn from you', 'mentorship', 'coaching'],
        validate: (text) => text.includes('course') || text.includes('teach') || text.includes('workshop')
      },
      'Merchandise': {
        keywords: ['merch', 'merchandise', 't-shirt', 'clothing', 'your merch', 'sell shirts',
                   'buy your merch', 'merch drop', 'merch store'],
        validate: (text) => text.includes('merch')
      },
      'Affiliate Marketing': {
        keywords: ['affiliate', 'discount code', 'promo code', 'coupon', 'referral',
                   'commission', 'link in description'],
        validate: (text) => text.includes('affiliate') || text.includes('code') || text.includes('discount')
      }
    };
    
    let foundOpportunity = false;
    
    Object.entries(businessPatterns).forEach(([type, pattern]) => {
      pattern.keywords.forEach(keyword => {
        if (text.includes(keyword) && pattern.validate(text)) {
          foundOpportunity = true;
          
          // Extract context around the keyword
          const keywordIndex = text.indexOf(keyword);
          const start = Math.max(0, originalText.lastIndexOf('.', keywordIndex) + 1);
          const end = Math.min(originalText.length, originalText.indexOf('.', keywordIndex + keyword.length) + 1);
          const context = originalText.substring(start, end).trim() || originalText;
          
          this.insights.businessOpportunities.push({
            type: type,
            comment: context,
            fullComment: originalText,
            author: comment.author,
            likes: parseInt(comment.likes) || 0,
            keyword: keyword,
            confidence: this.calculateOpportunityConfidence(text, type, pattern)
          });
        }
      });
    });
  }

  calculateOpportunityConfidence(text, type, pattern) {
    let confidence = 'Low';
    const matchCount = pattern.keywords.filter(k => text.includes(k)).length;
    
    // High confidence if multiple keywords match or specific strong indicators
    if (matchCount >= 2) confidence = 'High';
    else if (text.includes('?') && matchCount >= 1) confidence = 'Medium';
    else if (text.includes('please') || text.includes('want')) confidence = 'Medium';
    
    return confidence;
  }

  extractQuestions(comment) {
    const text = comment.text || '';
    const lowerText = text.toLowerCase();
    
    // Only extract questions directed at the creator
    const creatorDirectedPatterns = [
      // Direct address patterns
      /\b(you|your|you're|yours|yourself)\b.*\?/i,
      /^(can you|could you|would you|will you|do you|are you|have you|did you)/i,
      /^(what|how|why|when|where|which).*(you|your)/i,
      /^(please|pls).*(tell|explain|show|share)/i,
      
      // Creator-specific questions
      /(what|which).*(use|using|used|camera|equipment|software|gear)/i,
      /(how|where).*(make|create|edit|film|record)/i,
      /(when|why).*(start|begin|decide)/i,
      /tutorial|guide|teach|explain.*\?/i,
      /next video|next time|future|upcoming/i,
      /collab|collaboration|work with/i
    ];
    
    // Check if it's a question
    const isQuestion = text && (text.includes('?') || 
                      text.match(/^(what|how|why|when|where|who|which|can|could|would|should|will|do|does|are|is)/i));
    
    if (!isQuestion) return;
    
    // Check if it's directed at creator
    let isCreatorDirected = false;
    for (const pattern of creatorDirectedPatterns) {
      if (pattern.test(text)) {
        isCreatorDirected = true;
        break;
      }
    }
    
    // Additional validation - exclude general discussion questions
    const generalQuestionPatterns = [
      /anyone (else|know|think)/i,
      /does anyone/i,
      /who else/i,
      /am i the only/i,
      /is it just me/i,
      /anybody/i,
      /someone/i,
      /\?{2,}/, // Multiple question marks (usually rhetorical)
      /lol\?|lmao\?|wtf\?/i // Casual/rhetorical
    ];
    
    for (const pattern of generalQuestionPatterns) {
      if (pattern.test(text)) {
        isCreatorDirected = false;
        break;
      }
    }
    
    if (isCreatorDirected) {
      this.insights.frequentQuestions.push({
        question: text,
        author: comment.author,
        likes: parseInt(comment.likes) || 0,
        category: this.categorizeQuestion(text)
      });
    }
  }
  
  categorizeQuestion(text) {
    const lowerText = (text || '').toLowerCase();
    
    if (lowerText.includes('equipment') || lowerText.includes('gear') || lowerText.includes('camera') || 
        lowerText.includes('software') || lowerText.includes('use') || lowerText.includes('using')) {
      return 'Equipment/Tools';
    }
    if (lowerText.includes('how') && (lowerText.includes('make') || lowerText.includes('create') || 
        lowerText.includes('edit') || lowerText.includes('do'))) {
      return 'How-To/Process';
    }
    if (lowerText.includes('when') || lowerText.includes('next') || lowerText.includes('upload')) {
      return 'Schedule/Timing';
    }
    if (lowerText.includes('why') || lowerText.includes('reason') || lowerText.includes('decision')) {
      return 'Motivation/Why';
    }
    if (lowerText.includes('where') || lowerText.includes('location') || lowerText.includes('place')) {
      return 'Location/Where';
    }
    if (lowerText.includes('collab') || lowerText.includes('work with') || lowerText.includes('feature')) {
      return 'Collaboration';
    }
    
    return 'General';
  }

  findBestFeatures(comment) {
    const text = (comment.text || '').toLowerCase();
    const originalText = comment.text || '';
    
    // Skip very short comments
    if (originalText.length < 5) return;
    
    // Expanded and more flexible praise detection
    const praiseIndicators = [
      // Explicit praise
      'best part', 'favorite part', 'loved when', 'amazing how', 'really liked', 'appreciated',
      'highlight was', 'stood out', 'particularly good', 'especially', 'the way you',
      // General positive expressions
      'love how', 'love the', 'love when', 'love this', 'love it', 'amazing', 'incredible', 'awesome',
      'fantastic', 'brilliant', 'perfect', 'excellent', 'outstanding', 'impressive',
      'hilarious', 'funny', 'genius', 'clever', 'cool', 'epic', 'fire', 'goat', 'great',
      // Specific appreciations
      'editing is', 'music is', 'sound is', 'quality is', 'production is',
      'storytelling', 'narrative', 'pacing', 'timing', 'cinematography',
      // Emotional responses
      'made me laugh', 'made me cry', 'gave me chills', 'so emotional',
      'touched my heart', 'inspiring', 'motivational', 'uplifting',
      // Superlatives
      'one of the best', 'favorite video', 'best video', 'masterpiece',
      'work of art', 'next level', 'top tier', 'peak content', 'banger', '10/10'
    ];
    
    let foundFeature = false;
    
    // Check for explicit praise indicators
    for (const indicator of praiseIndicators) {
      if (text.includes(indicator)) {
        foundFeature = true;
        const tag = this.extractFeatureTag(originalText);
        if (tag && tag.length > 2) {
          this.insights.bestFeatures.push({
            tag: tag,
            originalText: originalText.length > 150 ? originalText.substring(0, 150) + '...' : originalText,
            author: comment.author,
            sentiment: comment.sentiment || 'positive',
            likes: parseInt(comment.likes) || 0
          });
          break; // Only add once per comment
        }
      }
    }
    
    // Also check emojis and simple positive comments
    if (!foundFeature && comment.sentiment === 'positive') {
      const positiveEmojis = ['❤', '😍', '🔥', '💯', '👏', '😂', '🤣', '💪', '🎉', '⭐'];
      const hasPositiveEmoji = positiveEmojis.some(emoji => originalText.includes(emoji));
      
      if (hasPositiveEmoji || (text.includes('good') && originalText.length > 15)) {
        const tag = this.extractFeatureTag(originalText);
        if (tag && tag.length > 2) {
          this.insights.bestFeatures.push({
            tag: tag,
            originalText: originalText.length > 150 ? originalText.substring(0, 150) + '...' : originalText,
            author: comment.author,
            sentiment: 'positive',
            likes: parseInt(comment.likes) || 0
          });
        }
      }
    }
    
    // Final catch-all: If it's a positive comment with decent likes, include it
    if (!foundFeature && comment.sentiment === 'positive' && originalText.length > 20) {
      const likes = parseInt(comment.likes) || 0;
      if (likes > 5 || originalText.length > 50) {
        const tag = this.extractFeatureTag(originalText) || 'General praise';
        this.insights.bestFeatures.push({
          tag: tag,
          originalText: originalText.length > 150 ? originalText.substring(0, 150) + '...' : originalText,
          author: comment.author,
          sentiment: 'positive',
          likes: likes
        });
      }
    }
  }

  findAreasForImprovement(comment) {
    const text = (comment.text || '').toLowerCase();
    const originalText = comment.text || '';
    
    // Expanded improvement detection patterns
    const improvementIndicators = [
      // Direct suggestions
      'could be better', 'suggestion', 'improvement', 'next time', 'would be nice if',
      'missing', 'should have', 'needs', 'should add', 'should include', 'recommend',
      // Problems/Issues
      'confusing', 'unclear', 'hard to', 'difficult to', 'problem with', 'issue with',
      'trouble with', 'struggle with', 'hate when', 'annoying when', 'frustrating',
      // Constructive criticism
      'but', 'however', 'although', 'wish you', 'hope you', 'please', 'maybe',
      'consider', 'try', 'perhaps', 'what if', 'how about', 'why not',
      // Specific issues
      'too long', 'too short', 'too fast', 'too slow', 'too quiet', 'too loud',
      'cant hear', "can't see", 'low quality', 'bad audio', 'poor sound',
      'repetitive', 'boring', 'dragging', 'rushed', 'poorly explained'
    ];
    
    // Quality/technical issues
    const technicalIssues = [
      'audio', 'sound', 'volume', 'music', 'microphone', 'quality',
      'video', 'resolution', 'blurry', 'dark', 'bright', 'lighting',
      'editing', 'cuts', 'transitions', 'pacing', 'timing'
    ];
    
    let foundImprovement = false;
    
    // Check for improvement indicators
    improvementIndicators.forEach(indicator => {
      if (text.includes(indicator)) {
        foundImprovement = true;
        const tag = this.extractImprovementTag(originalText);
        if (tag) {
          this.insights.areasForImprovement.push({
            tag: tag,
            originalText: originalText.length > 150 ? originalText.substring(0, 150) + '...' : originalText,
            author: comment.author,
            sentiment: comment.sentiment || 'neutral',
            likes: parseInt(comment.likes) || 0
          });
        }
      }
    });
    
    // Check for negative sentiment with technical issues
    if (!foundImprovement && (comment.sentiment === 'negative' || comment.sentiment === 'neutral')) {
      technicalIssues.forEach(issue => {
        if (text.includes(issue) && originalText.length > 15) {
          const tag = this.extractImprovementTag(originalText);
          if (tag) {
            this.insights.areasForImprovement.push({
              tag: tag,
              originalText: originalText.length > 150 ? originalText.substring(0, 150) + '...' : originalText,
              author: comment.author,
              sentiment: comment.sentiment,
              likes: parseInt(comment.likes) || 0
            });
          }
        }
      });
    }
    
    // Also capture constructive questions as potential improvements
    if (!foundImprovement && originalText.includes('?') && originalText.length > 20) {
      const constructiveQuestions = [
        'why', 'how', 'what if', 'could you', 'would you', 'can you explain',
        'whats the', "what's the", 'how do you', 'why did you', 'why didnt you'
      ];
      
      constructiveQuestions.forEach(pattern => {
        if (text.includes(pattern)) {
          const tag = this.extractImprovementTag(originalText);
          if (tag) {
            this.insights.areasForImprovement.push({
              tag: tag,
              originalText: originalText.length > 150 ? originalText.substring(0, 150) + '...' : originalText,
              author: comment.author,
              sentiment: comment.sentiment,
              likes: parseInt(comment.likes) || 0
            });
          }
        }
      });
    }
    
    // Final catch-all: Negative or neutral comments with suggestions
    if (!foundImprovement && (comment.sentiment === 'negative' || comment.sentiment === 'neutral')) {
      const likes = parseInt(comment.likes) || 0;
      if (originalText.length > 30 && (likes > 3 || originalText.length > 60)) {
        const tag = this.extractImprovementTag(originalText) || 'General feedback';
        this.insights.areasForImprovement.push({
          tag: tag,
          originalText: originalText.length > 150 ? originalText.substring(0, 150) + '...' : originalText,
          author: comment.author,
          sentiment: comment.sentiment,
          likes: likes
        });
      }
    }
  }

  extractFeatureTag(text) {
    if (!text) return null;
    
    // Common feature categories to extract
    const featureKeywords = {
      'editing': ['editing', 'edit', 'cuts', 'transitions', 'effects'],
      'music': ['music', 'song', 'soundtrack', 'audio', 'sound', 'beat'],
      'humor': ['funny', 'hilarious', 'humor', 'joke', 'comedy', 'laugh'],
      'story': ['story', 'storytelling', 'narrative', 'plot'],
      'production': ['production', 'quality', 'cinematography', 'camera', 'visual'],
      'content': ['content', 'video', 'episode', 'show'],
      'personality': ['personality', 'energy', 'charisma', 'vibe', 'attitude'],
      'information': ['explanation', 'tutorial', 'educational', 'informative', 'helpful']
    };
    
    const lowerText = text.toLowerCase();
    
    // Check for specific feature keywords
    for (const [category, keywords] of Object.entries(featureKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return category.charAt(0).toUpperCase() + category.slice(1);
        }
      }
    }
    
    // Extract first meaningful phrase
    const phrases = text.match(/[a-zA-Z\s]{3,}/g);
    if (phrases && phrases.length > 0) {
      const firstPhrase = phrases[0].trim();
      if (firstPhrase.length > 3 && firstPhrase.length < 30) {
        return firstPhrase;
      }
    }
    
    // Fallback: extract first few words
    const words = text.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      return words.slice(0, 3).join(' ').substring(0, 25);
    }
    
    return null;
  }
  
  extractImprovementTag(text) {
    // Remove the indicator phrase and extract the core issue
    const cleanText = text
      .replace(/^(could be better|suggestion|improvement|next time|would be nice if|missing|should have|needs|confusing|unclear|hard to|difficult to|problem with|issue with)\s*/i, '')
      .replace(/[.!?]$/g, '')
      .trim();
    
    // Extract key nouns/phrases
    const keywords = cleanText
      .replace(/\b(the|was|is|are|were|your|you|a|an|to|if)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit to first few words for tag
    const words = keywords.split(' ').filter(w => w.length > 2);
    if (words.length > 4) {
      return words.slice(0, 4).join(' ');
    }
    
    return keywords || cleanText.substring(0, 30);
  }

  trackUserEngagement(comment) {
    const author = comment.author || 'Unknown';
    if (!this.insights.topEngagedUsers[author]) {
      this.insights.topEngagedUsers[author] = {
        commentCount: 0,
        totalLikes: 0,
        comments: []
      };
    }
    
    this.insights.topEngagedUsers[author].commentCount++;
    this.insights.topEngagedUsers[author].totalLikes += parseInt(comment.likes) || 0;
    this.insights.topEngagedUsers[author].comments.push(comment.text || '');
  }

  calculateTopEngagedUsers() {
    // Convert to array and sort by comment count
    const usersArray = Object.entries(this.insights.topEngagedUsers)
      .map(([author, data]) => ({ author, ...data }))
      .sort((a, b) => b.commentCount - a.commentCount)
      .slice(0, 5);
    
    this.insights.topEngagedUsers = usersArray;
  }

  scoreInterestingComment(comment) {
    let interestScore = 0;
    const text = (comment.text || '').toLowerCase();
    
    // Factors that make a comment interesting:
    
    // 1. Length (not too short, not too long)
    const wordCount = comment.text.split(/\s+/).length;
    if (wordCount >= 20 && wordCount <= 200) {
      interestScore += 2;
    }
    
    // 2. Has questions
    if (text.includes('?')) {
      interestScore += 3;
    }
    
    // 3. Has specific details (numbers, timestamps)
    if (/\d+:\d+|\d+%|\$\d+/.test(comment.text)) {
      interestScore += 4;
    }
    
    // 4. Personal story indicators
    const storyWords = ['i remember', 'when i', 'my experience', 'personally', 'in my case', 'happened to me'];
    storyWords.forEach(word => {
      if (text.includes(word)) interestScore += 5;
    });
    
    // 5. Unique perspective indicators
    const perspectiveWords = ['actually', 'however', 'on the other hand', 'interesting point', 'never thought'];
    perspectiveWords.forEach(word => {
      if (text.includes(word)) interestScore += 3;
    });
    
    // 6. Engagement level
    interestScore += Math.min(5, parseInt(comment.likes) / 10);
    interestScore += Math.min(5, parseInt(comment.replies) * 2);
    
    // 7. Mixed sentiment (more nuanced)
    if (comment.sentiment === 'neutral') {
      interestScore += 2;
    }
    
    // Store comment with score
    if (interestScore > 5) {
      this.insights.mostInterestingComments.push({
        ...comment,
        interestScore
      });
    }
  }

  analyzeWordFrequency(comment) {
    // Extract meaningful words for word cloud
    const stopWords = new Set([
      // English stop words
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
      'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
      'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
      'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
      'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'getting', 'made', 'find', 'where', 'much', 'too',
      'very', 'still', 'being', 'going', 'why', 'really', 'dont', 'im', 'got', 'here', 'thing', 'things', 'youre', 'yes', 'thats', 'let', 'put', 'maybe',
      'something', 'nothing', 'everything', 'always', 'never', 'every', 'those', 'same', 'another', 'such', 'own', 'through', 'should', 'each', 'before',
      'does', 'done', 'doing', 'having', 'once', 'more', 'less', 'least', 'almost', 'enough', 'though', 'either', 'while', 'since', 'both', 'between',
      'under', 'until', 'again', 'further', 'against', 'during', 'without', 'within', 'around', 'above', 'below', 'off', 'away', 'down', 'yet', 'however',
      'else', 'everywhere', 'although', 'whether', 'whole', 'whose', 'whom', 'cannot', 'might', 'must', 'need', 'shall', 'towards', 'behind', 'beyond',
      'few', 'many', 'lot', 'bit', 'definitely', 'actually', 'literally', 'basically', 'honestly', 'seriously', 'truly', 'simply', 'especially',
      'probably', 'possibly', 'perhaps', 'sure', 'certain', 'obviously', 'clearly', 'ah', 'oh', 'wow', 'hey', 'hi', 'hello', 'thanks', 'thank',
      'please', 'sorry', 'excuse', 'pardon', 'okay', 'ok', 'alright', 'fine', 'right', 'wrong', 'true', 'false', 'yeah', 'yep', 'nope', 'uh', 'um',
      'etc', 'eg', 'ie', 'vs', 'via', 'per', 'lol', 'lmao', 'omg', 'btw', 'fyi', 'imo', 'tbh', 'idk', 'afaik',
      // Spanish stop words
      'el', 'la', 'de', 'que', 'y', 'en', 'un', 'ser', 'se', 'no', 'haber', 'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le', 'lo',
      'todo', 'pero', 'más', 'hacer', 'o', 'poder', 'decir', 'este', 'ir', 'otro', 'ese', 'si', 'ya', 'ver', 'porque', 'dar', 'cuando',
      'muy', 'sin', 'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno', 'mismo', 'también', 'hasta', 'año', 'dos', 'querer', 'entre',
      'así', 'primero', 'desde', 'grande', 'eso', 'ni', 'nos', 'llegar', 'pasar', 'tiempo', 'ella', 'sí', 'día', 'uno', 'bien', 'poco',
      'deber', 'entonces', 'poner', 'cosa', 'tanto', 'hombre', 'parecer', 'nuestro', 'tan', 'donde', 'ahora', 'parte', 'después', 'vida',
      'quedar', 'siempre', 'creer', 'hablar', 'llevar', 'dejar', 'nada', 'cada', 'seguir', 'menos', 'nuevo', 'encontrar',
      // Common meaningless words
      'video', 'youtube', 'channel', 'subscribe', 'comment', 'comments', 'like', 'likes', 'share', 'watch', 'watching', 'watched', 'viewer', 'viewers',
      'click', 'clicked', 'link', 'description', 'notification', 'notifications', 'bell', 'update', 'updates', 'content', 'creator', 'creators',
      'guy', 'guys', 'girl', 'girls', 'dude', 'bro', 'man', 'woman', 'person', 'people', 'anyone', 'someone', 'everyone', 'nobody', 'somebody',
      'today', 'tomorrow', 'yesterday', 'week', 'month', 'year', 'minute', 'minutes', 'hour', 'hours', 'second', 'seconds',
      'gonna', 'gotta', 'wanna', 'kinda', 'sorta', 'dunno', 'cant', 'wont', 'dont', 'didnt', 'doesnt', 'isnt', 'arent', 'wasnt', 'werent',
      'hasnt', 'havent', 'hadnt', 'shouldnt', 'wouldnt', 'couldnt', 'mightnt', 'mustnt', 'neednt', 'shant', 'theres', 'heres', 'wheres',
      'whens', 'whys', 'hows', 'whats', 'whos', 'whichs', 'thiss', 'thats', 'theses', 'thoses'
    ]);
    
    // Clean and tokenize
    const words = (comment.text || '')
      .toLowerCase()
      .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/g, ' ') // Include accented characters
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && // Increase minimum length
        word.length < 20 && // Add maximum length
        !stopWords.has(word) && 
        !/^\d+$/.test(word) && // No pure numbers
        !/^[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+$/.test(word) // Must contain letters
      );
    
    // Count frequency
    words.forEach(word => {
      this.insights.wordFrequency[word] = (this.insights.wordFrequency[word] || 0) + 1;
    });
  }

  groupCommentTopics() {
    // Only group topics if we have enough comments (similar to YouTube's threshold)
    if (this.comments.length < 20) {
      this.insights.commentTopics = [];
      return;
    }
    
    // Advanced topic detection including timestamps and video-specific themes
    const topicGroups = new Map();
    const timestampComments = [];
    
    this.comments.forEach(comment => {
      const text = comment.text || '';
      const lowerText = text.toLowerCase();
      
      // 1. Detect timestamp references (e.g., "2:35", "10:20")
      const timestampPattern = /\b(\d{1,2}:\d{2})\b/g;
      const timestamps = text ? text.match(timestampPattern) : null;
      if (timestamps) {
        timestamps.forEach(timestamp => {
          timestampComments.push({
            timestamp: timestamp,
            comment: comment,
            text: text
          });
        });
      }
      
      // 2. Scene/moment detection
      const sceneKeywords = {
        'intro': ['intro', 'beginning', 'start', 'opening'],
        'ending': ['ending', 'end', 'outro', 'conclusion'],
        'favorite_moment': ['favorite part', 'best part', 'loved when', 'favorite moment', 'best moment'],
        'specific_scene': ['when you', 'the part where', 'that moment', 'the scene', 'at the part']
      };
      
      Object.entries(sceneKeywords).forEach(([theme, keywords]) => {
        keywords.forEach(keyword => {
          if (lowerText.includes(keyword)) {
            if (!topicGroups.has(theme)) {
              topicGroups.set(theme, []);
            }
            topicGroups.get(theme).push(comment);
          }
        });
      });
      
      // 3. Content-specific themes
      const contentThemes = {
        'music_audio': ['music', 'song', 'soundtrack', 'audio', 'sound', 'beat', 'track'],
        'visuals_editing': ['editing', 'effects', 'transition', 'camera', 'cinematography', 'visual', 'graphics'],
        'information': ['information', 'facts', 'data', 'research', 'source', 'reference'],
        'storytelling': ['story', 'narrative', 'plot', 'character', 'storytelling'],
        'technique': ['technique', 'method', 'approach', 'style', 'way you'],
        'emotion': ['emotional', 'touching', 'moved', 'inspired', 'motivated', 'feeling']
      };
      
      Object.entries(contentThemes).forEach(([theme, keywords]) => {
        keywords.forEach(keyword => {
          if (lowerText.includes(keyword)) {
            if (!topicGroups.has(theme)) {
              topicGroups.set(theme, []);
            }
            topicGroups.get(theme).push(comment);
          }
        });
      });
    });
    
    // Process timestamp comments into scene discussions
    if (timestampComments.length > 0) {
      // Group similar timestamps
      const timestampGroups = this.groupTimestamps(timestampComments);
      timestampGroups.forEach((group, timestamp) => {
        if (group.length >= 3) { // Only include if multiple people mention same timestamp
          // Deduplicate comments in the group
          const uniqueComments = [];
          const seen = new Set();
          
          group.forEach(g => {
            const key = `${g.comment.author || 'Unknown'}-${(g.comment.text || '').substring(0, 50)}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueComments.push(g.comment);
            }
          });
          
          if (uniqueComments.length >= 3) { // Still need at least 3 unique comments
            topicGroups.set(`Scene at ${timestamp}`, uniqueComments);
          }
        }
      });
    }
    
    // Convert to final format with better naming
    const finalTopics = [];
    const topicNames = {
      'intro': '🎬 Introduction/Opening',
      'ending': '🎭 Ending/Conclusion',
      'favorite_moment': '⭐ Favorite Moments',
      'specific_scene': '🎥 Specific Scenes',
      'music_audio': '🎵 Music & Audio',
      'visuals_editing': '🎨 Visuals & Editing',
      'information': '📊 Information & Facts',
      'storytelling': '📖 Story & Narrative',
      'technique': '🛠️ Technique & Style',
      'emotion': '💝 Emotional Impact'
    };
    
    topicGroups.forEach((comments, topic) => {
      if (comments.length >= 5) { // Only show topics with significant discussion
        const topicName = topicNames[topic] || topic;
        
        // Deduplicate comments based on text and author
        const uniqueComments = [];
        const seen = new Set();
        
        comments.forEach(comment => {
          // Create a unique key using author and first 50 chars of text
          const key = `${comment.author || 'Unknown'}-${(comment.text || '').substring(0, 50)}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueComments.push(comment);
          }
        });
        
        finalTopics.push({
          topic: topicName,
          count: uniqueComments.length,
          percentage: Math.round((uniqueComments.length / this.comments.length) * 100),
          examples: uniqueComments.slice(0, 5) // Keep top 5 unique examples
        });
      }
    });
    
    // Sort by count and limit to top topics
    this.insights.commentTopics = finalTopics
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // YouTube typically shows 5-8 topics
  }
  
  groupTimestamps(timestampComments) {
    const groups = new Map();
    
    timestampComments.forEach(item => {
      const time = this.parseTimestamp(item.timestamp);
      let grouped = false;
      
      // Check if this timestamp is close to an existing group (within 5 seconds)
      groups.forEach((value, key) => {
        const keyTime = this.parseTimestamp(key);
        if (Math.abs(time - keyTime) <= 5) {
          value.push(item);
          grouped = true;
        }
      });
      
      if (!grouped) {
        groups.set(item.timestamp, [item]);
      }
    });
    
    return groups;
  }
  
  parseTimestamp(timestamp) {
    const [minutes, seconds] = timestamp.split(':').map(Number);
    return minutes * 60 + seconds;
  }

  selectMostInterestingComments() {
    // Sort by interest score and select top 5
    this.insights.mostInterestingComments = this.insights.mostInterestingComments
      .sort((a, b) => b.interestScore - a.interestScore)
      .slice(0, 5);
  }

  processVideoIdeas() {
    // Group similar ideas together
    const ideaGroups = new Map();
    
    this.insights.videoIdeas.forEach(idea => {
      // Create a simplified key for grouping similar ideas
      const key = this.simplifyIdea(idea.idea);
      
      if (!ideaGroups.has(key)) {
        ideaGroups.set(key, {
          mainIdea: idea.idea,
          category: idea.category,
          mentions: [],
          totalEngagement: 0,
          averageSentiment: 0
        });
      }
      
      const group = ideaGroups.get(key);
      group.mentions.push({
        author: idea.author,
        text: idea.idea,
        likes: idea.likes,
        sentiment: idea.sentiment
      });
      group.totalEngagement += idea.engagement;
    });
    
    // Calculate scores and rank ideas
    const rankedIdeas = Array.from(ideaGroups.values()).map(group => {
      // Calculate sentiment score
      const sentimentScores = { positive: 1, neutral: 0, negative: -1 };
      const avgSentiment = group.mentions.reduce((sum, m) => 
        sum + (sentimentScores[m.sentiment] || 0), 0) / group.mentions.length;
      
      // Calculate final score based on mentions, engagement, and sentiment
      const score = (group.mentions.length * 10) + 
                   (group.totalEngagement * 2) + 
                   (avgSentiment * 5);
      
      return {
        idea: group.mainIdea,
        category: group.category,
        mentions: group.mentions.length,
        totalEngagement: group.totalEngagement,
        sentiment: avgSentiment > 0.3 ? 'positive' : avgSentiment < -0.3 ? 'negative' : 'neutral',
        score: score,
        examples: group.mentions.slice(0, 3) // Keep top 3 examples
      };
    });
    
    // Sort by score and keep top 5
    this.insights.videoIdeas = rankedIdeas
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  simplifyIdea(idea) {
    // Remove common words and create a simplified version for grouping
    const stopWords = ['a', 'an', 'the', 'on', 'about', 'how', 'to', 'please', 'can', 'you', 'could', 'would', 'should', 'make', 'do', 'video'];
    const words = idea.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => !stopWords.includes(word) && word.length > 2);
    
    // Return first 3-4 meaningful words as key
    return words.slice(0, 4).join(' ');
  }

  processBusinessOpportunities() {
    // Group opportunities by type and generate recommendations
    const opportunityGroups = {};
    
    this.insights.businessOpportunities.forEach(opp => {
      if (!opportunityGroups[opp.type]) {
        opportunityGroups[opp.type] = {
          opportunities: [],
          totalEngagement: 0,
          highConfidenceCount: 0
        };
      }
      
      opportunityGroups[opp.type].opportunities.push(opp);
      opportunityGroups[opp.type].totalEngagement += opp.likes;
      if (opp.confidence === 'High') {
        opportunityGroups[opp.type].highConfidenceCount++;
      }
    });
    
    // Generate recommendations for each opportunity type
    const recommendations = [];
    
    Object.entries(opportunityGroups).forEach(([type, group]) => {
      const recommendation = {
        type: type,
        count: group.opportunities.length,
        engagement: group.totalEngagement,
        confidence: group.highConfidenceCount > 0 ? 'High' : 'Medium',
        examples: group.opportunities.slice(0, 5),
        recommendation: this.generateBusinessRecommendation(type, group)
      };
      
      recommendations.push(recommendation);
    });
    
    // Sort by potential impact (count * engagement)
    recommendations.sort((a, b) => (b.count * b.engagement) - (a.count * a.engagement));
    
    // Keep only validated opportunities
    this.insights.businessOpportunities = recommendations;
  }

  processFrequentQuestions() {
    // Group similar questions
    const questionGroups = {};
    
    this.insights.frequentQuestions.forEach(q => {
      if (!questionGroups[q.category]) {
        questionGroups[q.category] = [];
      }
      questionGroups[q.category].push(q);
    });
    
    // Process each category and find most frequent questions
    const processedQuestions = [];
    
    Object.entries(questionGroups).forEach(([category, questions]) => {
      // Sort by engagement (likes) and take top questions
      const topQuestions = questions
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 3); // Top 3 per category
      
      topQuestions.forEach(q => {
        processedQuestions.push({
          ...q,
          category: category
        });
      });
    });
    
    // Sort all questions by likes and take top 5
    this.insights.frequentQuestions = processedQuestions
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);
  }

  processBestFeatures() {
    console.log('Processing best features, found:', this.insights.bestFeatures.length);
    
    // Remove duplicates based on similar tags
    const uniqueFeatures = new Map();
    
    this.insights.bestFeatures.forEach(feature => {
      // Use the tag as key for deduplication
      const key = feature.tag.toLowerCase();
      
      // Keep the feature with highest likes
      if (!uniqueFeatures.has(key) || feature.likes > uniqueFeatures.get(key).likes) {
        uniqueFeatures.set(key, feature);
      }
    });
    
    // Convert to array, sort by likes, and limit to top features
    this.insights.bestFeatures = Array.from(uniqueFeatures.values())
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 10); // Keep top 10 features
    
    console.log('Best features after processing:', this.insights.bestFeatures);
  }
  
  processAreasForImprovement() {
    console.log('Processing areas for improvement, found:', this.insights.areasForImprovement.length);
    
    // Remove duplicates based on similar tags
    const uniqueImprovements = new Map();
    
    this.insights.areasForImprovement.forEach(improvement => {
      // Use the tag as key for deduplication
      const key = improvement.tag.toLowerCase();
      
      // Keep the improvement with highest likes
      if (!uniqueImprovements.has(key) || improvement.likes > uniqueImprovements.get(key).likes) {
        uniqueImprovements.set(key, improvement);
      }
    });
    
    // Convert to array, sort by likes, and limit to top improvements
    this.insights.areasForImprovement = Array.from(uniqueImprovements.values())
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 10); // Keep top 10 improvements
    
    console.log('Areas for improvement after processing:', this.insights.areasForImprovement);
  }
  
  extractFeatureTag(text) {
    // Extract the key positive aspect mentioned
    const patterns = [
      /best part(?:\s+was)?[:\s]+([^.!?]+)/i,
      /loved(?:\s+the)?[:\s]+([^.!?]+)/i,
      /amazing[:\s]+([^.!?]+)/i,
      /favorite(?:\s+was)?[:\s]+([^.!?]+)/i,
      /really liked[:\s]+([^.!?]+)/i,
      /appreciated[:\s]+([^.!?]+)/i,
      /the ([^.!?]+) was (great|amazing|perfect|excellent)/i,
      /great ([^.!?]+)/i,
      /excellent ([^.!?]+)/i,
      /perfect ([^.!?]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text ? text.match(pattern) : null;
      if (match) {
        return this.cleanFeatureText(match[1]);
      }
    }
    
    // Fallback: extract key phrases
    const keyPhrases = ['editing', 'music', 'explanation', 'tutorial', 'content', 'quality', 
                       'production', 'humor', 'storytelling', 'cinematography', 'information'];
    for (const phrase of keyPhrases) {
      if ((text || '').toLowerCase().includes(phrase)) {
        return this.cleanFeatureText(phrase);
      }
    }
    
    return null;
  }
  
  extractImprovementTag(text) {
    // Extract the key improvement suggestion
    const patterns = [
      /could be better[:\s]+([^.!?]+)/i,
      /needs?[:\s]+([^.!?]+)/i,
      /should have[:\s]+([^.!?]+)/i,
      /would be nice if[:\s]+([^.!?]+)/i,
      /improvement[:\s]+([^.!?]+)/i,
      /missing[:\s]+([^.!?]+)/i,
      /problem with[:\s]+([^.!?]+)/i,
      /issue with[:\s]+([^.!?]+)/i,
      /confusing[:\s]+([^.!?]+)/i,
      /hard to[:\s]+([^.!?]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text ? text.match(pattern) : null;
      if (match) {
        return this.cleanImprovementText(match[1]);
      }
    }
    
    // Fallback: extract key issues
    const keyIssues = ['audio', 'volume', 'music', 'speed', 'length', 'explanation', 
                      'clarity', 'lighting', 'editing', 'subtitle', 'quality'];
    for (const issue of keyIssues) {
      if ((text || '').toLowerCase().includes(issue)) {
        return this.cleanImprovementText(issue + ' issues');
      }
    }
    
    return null;
  }
  
  cleanFeatureText(text) {
    return text
      .trim()
      .replace(/^(the|your|this)\s+/i, '')
      .replace(/\s+/g, ' ')
      .substring(0, 40)
      .replace(/[.!?,]+$/, '');
  }
  
  cleanImprovementText(text) {
    return text
      .trim()
      .replace(/^(the|your|this|more|better)\s+/i, '')
      .replace(/\s+/g, ' ')
      .substring(0, 40)
      .replace(/[.!?,]+$/, '');
  }

  generateBusinessRecommendation(type, group) {
    const count = group.opportunities.length;
    const engagement = group.totalEngagement;
    const highConfidence = group.highConfidenceCount;
    
    // Extract specific products/brands mentioned
    const specificMentions = group.opportunities
      .map(opp => opp.comment)
      .filter(comment => comment.length > 20)
      .slice(0, 3);
    
    const recommendations = {
      'Product Inquiry': {
        action: 'Create Product Links & Affiliate Strategy',
        details: `${count} viewers are asking about specific products (${engagement} total likes):
        • Most asked about: ${specificMentions.length > 0 ? '"' + specificMentions[0].substring(0, 60) + '..."' : 'equipment and tools'}
        • Potential revenue: $${Math.round(count * 25)}-${Math.round(count * 75)}/month
        • Setup affiliate links in descriptions (Amazon Associates, etc.)
        • Create dedicated "gear" videos featuring your tools`,
        priority: count > 8 ? 'High' : count > 3 ? 'Medium' : 'Low'
      },
      'Sponsorship Interest': {
        action: 'Explore Brand Partnerships',
        details: `${count} brand partnership inquiries detected (${engagement} engagement):
        • Estimated value: $${Math.round(count * 500)}-${Math.round(count * 2000)} per deal
        • High confidence leads: ${highConfidence}
        • Create media kit with current analytics
        • Set up partnerships@yourdomain.com email`,
        priority: count > 2 ? 'High' : 'Medium'
      },
      'Service Request': {
        action: 'Monetize Your Expertise',
        details: `${count} service requests with ${engagement} combined likes:
        • Potential hourly rate: $${Math.round(75 + (engagement * 2))}-${Math.round(150 + (engagement * 4))}
        • Services mentioned: ${specificMentions.length > 0 ? specificMentions[0].substring(0, 50) + '...' : 'consulting and expertise'}
        • Setup booking system (Calendly) and pricing page
        • Consider packaging services into fixed-price offerings`,
        priority: count > 5 ? 'High' : count > 2 ? 'Medium' : 'Low'
      },
      'Course/Education': {
        action: 'Develop Educational Products',
        details: `${count} requests for educational content (${engagement} likes):
        • Course potential: $${Math.round(count * 50)}-${Math.round(count * 200)} revenue
        • Topics requested: ${specificMentions.length > 0 ? '"' + specificMentions[0].substring(0, 50) + '..."' : 'your expertise area'}
        • Consider Udemy, Teachable, or own platform
        • Start with free mini-course to test demand`,
        priority: count > 6 ? 'High' : count > 3 ? 'Medium' : 'Low'
      },
      'Merchandise': {
        action: 'Launch Merchandise Line',
        details: `${count} merch requests with ${engagement} total engagement:
        • Estimated monthly sales: ${Math.round(count * 15)}-${Math.round(count * 45)} units
        • Revenue potential: $${Math.round(count * 300)}-${Math.round(count * 900)}/month
        • Fan quotes: ${specificMentions.length > 0 ? '"' + specificMentions[0].substring(0, 40) + '..."' : 'branded merchandise'}
        • Start with print-on-demand (no upfront costs)`,
        priority: count > 12 ? 'High' : count > 6 ? 'Medium' : 'Low'
      },
      'Affiliate Marketing': {
        action: 'Implement Affiliate Strategy',
        details: `${count} affiliate opportunities identified (${engagement} likes):
        • Monthly potential: $${Math.round(count * 40)}-${Math.round(count * 120)}
        • Popular requests: ${specificMentions.length > 0 ? specificMentions[0].substring(0, 50) + '...' : 'product recommendations'}
        • Join Amazon Associates and relevant programs
        • Create honest product reviews
        • Add disclosure statements
        • Track performance with UTM codes`,
        priority: 'Medium'
      }
    };
    
    return recommendations[type] || {
      action: 'Explore Opportunity',
      details: 'Review these comments for potential business opportunities',
      priority: 'Low'
    };
  }

  calculateTopInappropriateUsers() {
    // Convert inappropriateUsers object to array and sort by count
    const usersList = Object.entries(this.insights.inappropriateUsers).map(([username, data]) => ({
      username,
      count: data.count,
      comments: data.comments,
      categories: Array.from(data.categories)
    }));
    
    // Sort by count of inappropriate comments and get top 10
    this.insights.topInappropriateUsers = usersList
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
  
  calculateOverallToxicity() {
    const totalComments = this.comments.length;
    if (totalComments === 0) {
      this.insights.overallToxicity = 0;
      return;
    }
    
    // Calculate weighted toxicity score
    const weights = {
      toxic: 3,      // Most severe
      offensive: 2,  // Medium severity
      inappropriate: 1.5,
      spam: 0.5     // Least severe
    };
    
    let toxicityScore = 0;
    Object.entries(this.insights.toxicityLevels).forEach(([category, count]) => {
      toxicityScore += count * (weights[category] || 1);
    });
    
    // Normalize to 0-100 scale
    // Max possible score would be if every comment had all toxicity types
    const maxPossibleScore = totalComments * (weights.toxic + weights.offensive + weights.inappropriate + weights.spam);
    this.insights.overallToxicity = Math.min(100, (toxicityScore / maxPossibleScore) * 100 * 10); // Multiply by 10 to make scale more sensitive
  }
  
  generateNarrativeSummary() {
    if (this.comments.length === 0) {
      this.insights.narrativeSummary = 'No comments to analyze.';
      return;
    }
    
    // Get comment samples for analysis
    const positiveComments = this.comments.filter(c => c.sentiment === 'positive');
    const negativeComments = this.comments.filter(c => c.sentiment === 'negative');
    const neutralComments = this.comments.filter(c => c.sentiment === 'neutral');
    const allComments = this.comments;
    
    // Build a 5-line summary
    let summaryLines = [];
    
    // Line 1: Overall viewer reaction and comment volume
    const totalComments = this.comments.length;
    const sentimentRatio = this.insights.sentiment;
    let overallTone = '';
    
    if (sentimentRatio.positive > sentimentRatio.negative * 2) {
      overallTone = 'overwhelmingly positive';
    } else if (sentimentRatio.negative > sentimentRatio.positive * 2) {
      overallTone = 'largely critical';
    } else if (Math.abs(sentimentRatio.positive - sentimentRatio.negative) < 10) {
      overallTone = 'mixed';
    } else if (sentimentRatio.positive > sentimentRatio.negative) {
      overallTone = 'mostly positive';
    } else {
      overallTone = 'mostly negative';
    }
    
    summaryLines.push(`Viewers express ${overallTone} reactions across ${totalComments} comments, showing ${totalComments > 100 ? 'high engagement' : totalComments > 50 ? 'moderate engagement' : 'growing interest'} with the content.`);
    
    // Line 2: What viewers specifically appreciate
    const positivePhrases = this.extractSpecificPhrases(positiveComments.slice(0, 30), 'positive');
    const positiveAttributes = this.extractDetailedAttributes(positiveComments.slice(0, 30));
    const topFeatures = this.insights.bestFeatures.slice(0, 3).map(f => f.tag.toLowerCase());
    
    if (positivePhrases.length > 0 || positiveAttributes.length > 0 || topFeatures.length > 0) {
      const allPositives = [...new Set([...positivePhrases, ...positiveAttributes, ...topFeatures])].slice(0, 4);
      summaryLines.push(`Positive feedback highlights ${this.naturalJoin(allPositives)}, with many viewers expressing appreciation for these aspects.`);
    } else if (positiveComments.length > 0) {
      summaryLines.push(`Viewers appreciate the content, with ${positiveComments.length} positive comments praising various aspects of the video.`);
    } else {
      summaryLines.push(`Limited positive feedback suggests viewers are looking for improvements or have specific expectations not fully met.`);
    }
    
    // Line 3: Concerns, criticisms, or areas for improvement
    const negativePhrases = this.extractSpecificPhrases(negativeComments.slice(0, 20), 'negative');
    const improvements = this.insights.areasForImprovement.slice(0, 3).map(i => i.tag.toLowerCase());
    
    if (negativePhrases.length > 0 || improvements.length > 0) {
      const allNegatives = [...new Set([...negativePhrases, ...improvements])].slice(0, 3);
      summaryLines.push(`Some viewers mention concerns about ${this.naturalJoin(allNegatives)}, suggesting areas for potential improvement.`);
    } else if (negativeComments.length > 5) {
      summaryLines.push(`A portion of viewers (${negativeComments.length} comments) express criticism, though specific concerns vary across different aspects.`);
    } else {
      summaryLines.push(`Minimal criticism indicates general satisfaction, with most viewers focusing on positive aspects rather than complaints.`);
    }
    
    // Line 4: Questions, requests, and future content ideas
    const questions = this.insights.frequentQuestions.slice(0, 3);
    const videoIdeas = this.insights.videoIdeas.slice(0, 3);
    const businessOps = this.insights.businessOpportunities.slice(0, 2);
    
    if (questions.length > 0 || videoIdeas.length > 0) {
      const questionTopics = questions.map(q => (q.category || 'general').toLowerCase());
      const ideaTopics = videoIdeas.map(v => (v.idea || '').toLowerCase().substring(0, 30));
      const allRequests = [...new Set([...questionTopics, ...ideaTopics])].slice(0, 3);
      
      if (allRequests.length > 0) {
        summaryLines.push(`Viewers actively request content about ${this.naturalJoin(allRequests)}, showing strong interest in follow-up material.`);
      } else {
        summaryLines.push(`The community shows curiosity with ${questions.length} questions, indicating engagement and desire for deeper understanding.`);
      }
    } else if (businessOps.length > 0) {
      summaryLines.push(`Commercial interest is evident with viewers asking about products, services, or collaboration opportunities.`);
    } else {
      summaryLines.push(`Viewers engage primarily through reactions and opinions rather than specific questions or content requests.`);
    }
    
    // Line 5: Community dynamics and overall engagement quality
    const avgLikes = allComments.reduce((sum, c) => sum + parseInt(c.likes || 0), 0) / allComments.length;
    const engagementQuality = this.insights.engagementQuality.overallScore || 0;
    const toxicityLevel = this.insights.overallToxicity;
    
    if (toxicityLevel > 20) {
      summaryLines.push(`Despite some heated discussions or inappropriate comments (${toxicityLevel.toFixed(0)}% toxicity), the core community remains engaged and constructive.`);
    } else if (avgLikes > 50 || engagementQuality > 70) {
      summaryLines.push(`High-quality engagement with ${avgLikes.toFixed(0)} average likes per comment demonstrates an invested, supportive community.`);
    } else if (this.insights.threadAnalysis.conversationThreads.length > 5) {
      summaryLines.push(`Active discussions and conversation threads show viewers are deeply engaged, creating meaningful dialogue around the content.`);
    } else {
      summaryLines.push(`The comment section reflects a ${avgLikes > 10 ? 'moderately engaged' : 'casually interested'} audience with ${avgLikes > 10 ? 'supportive' : 'varied'} responses to the content.`);
    }
    
    // Join all lines
    this.insights.narrativeSummary = summaryLines.join(' ');
  }
  
  extractSpecificPhrases(comments, sentiment) {
    const phrases = new Set();
    const patterns = sentiment === 'positive' ? [
      /love (?:the |your )?(.+?)(?:\.|!|,|$)/i,
      /(?:really |so )?(?:great|amazing|awesome|excellent) (.+?)(?:\.|!|,|$)/i,
      /appreciate (?:the |your )?(.+?)(?:\.|!|,|$)/i,
      /(?:the |your )?(.+?) (?:is|was|are|were) (?:perfect|great|amazing|helpful)/i
    ] : [
      /(?:don't like|hate|dislike) (?:the |your )?(.+?)(?:\.|!|,|$)/i,
      /(?:the |your )?(.+?) (?:is|was|are|were) (?:confusing|bad|terrible|disappointing)/i,
      /(?:too much|not enough) (.+?)(?:\.|!|,|$)/i,
      /problem with (?:the |your )?(.+?)(?:\.|!|,|$)/i
    ];
    
    comments.forEach(comment => {
      patterns.forEach(pattern => {
        const match = comment.text ? comment.text.match(pattern) : null;
        if (match && match[1]) {
          const phrase = match[1].trim().toLowerCase();
          // Clean up common words
          const cleaned = phrase.replace(/^(the |your |this |that |a |an )/g, '');
          if (cleaned.length > 3 && cleaned.length < 30 && !cleaned.includes('video')) {
            phrases.add(cleaned);
          }
        }
      });
    });
    
    return Array.from(phrases).slice(0, 3);
  }
  
  extractDetailedAttributes(comments) {
    const attributes = new Set();
    const attributePatterns = [
      /(?:it's|its|it is) (.+?)(?:\.|!|,|$)/i,
      /(?:for being|for its) (.+?)(?:\.|!|,|$)/i,
      /(?:the|your) (.+?) quality/i,
      /(?:very|so|really) (.+?)(?:\.|!|,|$)/i
    ];
    
    comments.forEach(comment => {
      attributePatterns.forEach(pattern => {
        const match = comment.text ? comment.text.match(pattern) : null;
        if (match && match[1]) {
          const attr = match[1].trim().toLowerCase();
          if (attr.length > 3 && attr.length < 25 && !attr.includes('video')) {
            attributes.add(attr);
          }
        }
      });
    });
    
    return Array.from(attributes).slice(0, 3);
  }
  
  naturalJoin(items) {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }
  
  extractContentThemes(comments) {
    const themes = [];
    const patterns = {
      'the editing': /edit|editing|cuts|transitions|effects/i,
      'the music': /music|song|soundtrack|beat|audio/i,
      'the information': /information|info|facts|research|data/i,
      'the presentation': /presentation|explaining|teaching|delivery/i,
      'the humor': /funny|hilarious|laugh|humor|joke/i,
      'the quality': /quality|production|professional|high.?quality/i,
      'the topic': /topic|subject|content|video/i,
      'the storytelling': /story|storytelling|narrative/i
    };
    
    for (const [theme, pattern] of Object.entries(patterns)) {
      const count = comments.filter(c => pattern.test(c.text)).length;
      if (count > 2) themes.push(theme);
    }
    
    return themes.slice(0, 3);
  }
  
  extractEmotionalTone(comments) {
    const emotions = [];
    const emotionPatterns = {
      'enthusiastic': /amazing|awesome|incredible|fantastic|wow|mind.?blown/i,
      'grateful': /thank|appreciate|grateful|helped/i,
      'curious': /question|wondering|how|why|what|where/i,
      'supportive': /keep it up|great work|love your|support/i,
      'critical': /but|however|should|could|problem|issue/i
    };
    
    const emotionCounts = {};
    for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
      emotionCounts[emotion] = comments.filter(c => pattern.test(c.text)).length;
    }
    
    return Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 2)
      .slice(0, 3)
      .map(([emotion]) => emotion);
  }
  
  extractKeyRequests(comments) {
    const requests = [];
    const requestPatterns = [
      { pattern: /more videos? (?:on|about) (.+?)(?:\.|!|$)/i, type: 'topic' },
      { pattern: /(?:make|do|create) (?:a )?(.+?)(?:\.|!|$)/i, type: 'content' },
      { pattern: /(?:please|could you|can you) (.+?)(?:\.|!|\?|$)/i, type: 'request' },
      { pattern: /tutorial (?:on|about|for) (.+?)(?:\.|!|$)/i, type: 'tutorial' }
    ];
    
    comments.forEach(comment => {
      requestPatterns.forEach(({ pattern }) => {
        const match = comment.text ? comment.text.match(pattern) : null;
        if (match && match[1]) {
          const request = match[1].trim().toLowerCase();
          if (request.length > 5 && request.length < 50) {
            requests.push(request);
          }
        }
      });
    });
    
    // Deduplicate and return most common
    const uniqueRequests = [...new Set(requests)];
    return uniqueRequests.slice(0, 5);
  }
  
  extractKeyPhrases(comments) {
    const phrases = [];
    const commonWords = ['the', 'this', 'that', 'your', 'video', 'content'];
    
    comments.forEach(comment => {
      // Extract phrases after positive/negative indicators
      const patterns = [
        /(?:love|loved|loving|great|amazing|awesome) (.+?)(?:\.|!|,|$)/i,
        /(?:hate|dislike|don't like|problem with) (.+?)(?:\.|!|,|$)/i,
        /the (.+?) (?:is|was|were) (?:great|amazing|terrible|bad)/i
      ];
      
      patterns.forEach(pattern => {
        const match = comment.text ? comment.text.match(pattern) : null;
        if (match && match[1]) {
          const phrase = match[1].trim().toLowerCase();
          if (phrase.length > 3 && phrase.length < 30 && !commonWords.includes(phrase)) {
            phrases.push(phrase);
          }
        }
      });
    });
    
    // Get unique phrases and limit
    return [...new Set(phrases)].slice(0, 3);
  }
  
  extractPositiveAttributes(comments) {
    const attributes = [];
    const attributePatterns = {
      'expertise': /expert|knowledge|skilled|professional/i,
      'creativity': /creative|unique|original|innovative/i,
      'clarity': /clear|understand|explain|easy to follow/i,
      'personality': /personality|charisma|entertaining|engaging/i,
      'effort': /effort|work|dedication|quality/i
    };
    
    for (const [attribute, pattern] of Object.entries(attributePatterns)) {
      if (comments.some(c => pattern.test(c.text))) {
        attributes.push(attribute);
      }
    }
    
    return attributes.slice(0, 2);
  }
  
  calculateEngagementLevel() {
    const avgLikes = this.comments.reduce((sum, c) => sum + parseInt(c.likes || 0), 0) / this.comments.length;
    const questionRate = (this.insights.frequentQuestions.length / this.comments.length) * 100;
    
    if (avgLikes > 50 || questionRate > 20) return 'high';
    if (avgLikes > 20 || questionRate > 10) return 'medium';
    return 'low';
  }
  
  getMostActiveDiscussion() {
    if (this.insights.frequentQuestions.length > 10) {
      return 'questions and answers';
    }
    if (this.insights.videoIdeas.length > 5) {
      return 'content suggestions';
    }
    if (this.insights.bestFeatures.length > this.insights.areasForImprovement.length) {
      return 'praise and appreciation';
    }
    return 'general discussion';
  }
  
  getOverallMood() {
    const ratio = this.insights.sentiment.positive / (this.insights.sentiment.negative || 1);
    if (ratio > 3) return 'an overwhelmingly positive atmosphere';
    if (ratio > 1.5) return 'a generally positive mood';
    if (ratio < 0.5) return 'a critical atmosphere';
    return 'a balanced mix of opinions';
  }
  
  getMainActivity() {
    const activities = [];
    if (this.insights.frequentQuestions.length > 5) activities.push('asking questions');
    if (this.insights.videoIdeas.length > 3) activities.push('suggesting new content');
    if (this.insights.bestFeatures.length > 5) activities.push('praising specific elements');
    if (this.insights.businessOpportunities.length > 0) activities.push('showing commercial interest');
    
    return activities.length > 0 ? activities.slice(0, 2).join(' and ') : 'sharing their thoughts';
  }
  
  generateGeneralSummary() {
    if (this.comments.length === 0) {
      this.insights.generalSummary = 'No comments to analyze.';
      return;
    }
    
    // Get representative comments and themes
    const positiveComments = this.comments.filter(c => c.sentiment === 'positive');
    const negativeComments = this.comments.filter(c => c.sentiment === 'negative');
    const topWords = Object.entries(this.insights.wordFrequency)
      .filter(([word, freq]) => freq > 2 && word.length > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
    
    // Extract key themes from comment topics
    let mainThemes = [];
    if (this.insights.commentTopics.length > 0) {
      mainThemes = this.insights.commentTopics.slice(0, 3).map(topic => {
        // Clean up topic names for narrative
        let cleanTopic = topic.topic || 'general discussion';
        cleanTopic = cleanTopic.replace(/🎬|🎭|⭐|🎥|🎵|🎨|📊|📖|🛠️|💝/g, '').trim();
        return cleanTopic.toLowerCase();
      });
    }
    
    // Get sample positive and negative sentiments
    let positiveThemes = [];
    let negativeThemes = [];
    
    if (positiveComments.length > 0) {
      const positiveSample = positiveComments.slice(0, 10);
      positiveThemes = this.extractThemesFromComments(positiveSample);
    }
    
    if (negativeComments.length > 0) {
      const negativeSample = negativeComments.slice(0, 5);
      negativeThemes = this.extractThemesFromComments(negativeSample);
    }
    
    // Get video ideas and questions themes
    let contentSuggestions = [];
    if (this.insights.videoIdeas.length > 0) {
      contentSuggestions = this.insights.videoIdeas.slice(0, 3).map(idea => 
        idea.idea.substring(0, 50).replace(/[.!?]+$/, '')
      );
    }
    
    // Generate narrative summary
    let summary = [];
    
    // Line 1: Overall reception and main sentiment
    const positivePercent = Math.round((this.insights.sentiment.positive / this.comments.length) * 100);
    const negativePercent = Math.round((this.insights.sentiment.negative / this.comments.length) * 100);
    
    if (positivePercent > 70) {
      summary.push(`Viewers are overwhelmingly enthusiastic about this content, with ${positivePercent}% expressing positive reactions and appreciation.`);
    } else if (positivePercent > 50) {
      summary.push(`The audience shows strong approval for this content, with ${positivePercent}% positive responses outweighing ${negativePercent}% negative feedback.`);
    } else if (negativePercent > 50) {
      summary.push(`Viewers have mixed to negative reactions, with ${negativePercent}% expressing criticism or disappointment compared to ${positivePercent}% positive responses.`);
    } else {
      summary.push(`The audience reaction is balanced, with ${positivePercent}% positive and ${negativePercent}% negative responses creating diverse discussion.`);
    }
    
    // Line 2: Main topics and themes discussed
    if (mainThemes.length > 0) {
      summary.push(`The conversation centers around ${mainThemes.slice(0, 2).join(' and ')}, with viewers actively discussing these key aspects of the content.`);
    } else if (topWords.length > 0) {
      summary.push(`Discussion revolves around key themes including ${topWords.slice(0, 3).join(', ')}, reflecting the main focus areas that resonated with viewers.`);
    } else {
      summary.push(`Viewers engage in general discussion about the content, sharing personal reactions and thoughts about the video.`);
    }
    
    // Line 3: Positive feedback themes
    if (positiveThemes.length > 0) {
      summary.push(`Positive feedback highlights ${positiveThemes.slice(0, 2).join(' and ')}, with viewers expressing appreciation and satisfaction.`);
    } else if (this.insights.bestFeatures.length > 0) {
      const features = this.insights.bestFeatures.slice(0, 2).map(f => f.tag).join(' and ');
      summary.push(`Viewers particularly praise ${features}, showing strong appreciation for these standout elements.`);
    } else {
      summary.push(`Positive commenters express general satisfaction and enjoyment, contributing to an encouraging atmosphere.`);
    }
    
    // Line 4: Criticisms, suggestions, or requests
    if (negativeThemes.length > 0) {
      summary.push(`Some viewers raise concerns about ${negativeThemes[0]}, while others suggest improvements and alternative approaches.`);
    } else if (contentSuggestions.length > 0) {
      summary.push(`The community actively requests future content including ${contentSuggestions[0]}, showing engagement and investment in upcoming videos.`);
    } else if (this.insights.areasForImprovement.length > 0) {
      const improvements = this.insights.areasForImprovement.slice(0, 2).map(imp => imp.tag).join(' and ');
      summary.push(`Constructive feedback focuses on ${improvements}, with viewers offering helpful suggestions for enhancement.`);
    } else {
      summary.push(`The community maintains constructive dialogue, with minimal criticism and focus on positive engagement.`);
    }
    
    // Line 5: Community engagement and overall atmosphere
    const avgLikes = Math.round(this.comments.reduce((sum, c) => sum + parseInt(c.likes || 0), 0) / this.comments.length);
    if (this.insights.overallToxicity > 30) {
      summary.push(`The comment section shows high activity but requires moderation, with some inappropriate content affecting the overall discussion quality.`);
    } else if (avgLikes > 20) {
      summary.push(`High community engagement with strong like-to-comment ratios demonstrates an actively invested and supportive audience.`);
    } else if (this.insights.frequentQuestions.length > 0) {
      summary.push(`Viewers actively seek further information and clarification, indicating deep interest and engagement with the content topic.`);
    } else {
      summary.push(`The community creates a respectful environment for discussion, with viewers contributing meaningfully to the conversation.`);
    }
    
    this.insights.generalSummary = summary.join(' ');
  }
  
  extractThemesFromComments(comments) {
    const themes = [];
    const commonPatterns = [
      { pattern: /love|amazing|awesome|great|excellent|fantastic|perfect|brilliant/i, theme: 'exceptional quality' },
      { pattern: /helpful|useful|informative|learned|educational/i, theme: 'educational value' },
      { pattern: /funny|hilarious|entertaining|humor|laugh/i, theme: 'entertainment and humor' },
      { pattern: /editing|production|quality|visual|audio/i, theme: 'production quality' },
      { pattern: /music|sound|soundtrack|beat/i, theme: 'audio and music' },
      { pattern: /story|narrative|plot|character/i, theme: 'storytelling' },
      { pattern: /confusing|unclear|difficult|hard to understand/i, theme: 'clarity issues' },
      { pattern: /boring|slow|long|tedious/i, theme: 'pacing concerns' },
      { pattern: /volume|too quiet|too loud|audio/i, theme: 'audio technical issues' },
      { pattern: /thumbnail|title|clickbait|misleading/i, theme: 'presentation concerns' }
    ];
    
    comments.forEach(comment => {
      const text = (comment.text || '').toLowerCase();
      commonPatterns.forEach(({ pattern, theme }) => {
        if (pattern.test(text) && !themes.includes(theme)) {
          themes.push(theme);
        }
      });
    });
    
    return themes.slice(0, 3); // Return top 3 themes
  }

  // NEW ADVANCED POST-PROCESSING METHODS

  processTimeBasedAnalysis() {
    const timeline = this.insights.timeBasedAnalysis.commentTimeline;
    
    if (timeline.length === 0) {
      return;
    }
    
    // Group comments by time periods for analysis
    const timeGroups = {};
    
    // Group comments by actual time periods
    // First, let's determine the age of the oldest comment to create appropriate periods
    let oldestTimeInDays = 0;
    timeline.forEach(item => {
      const time = item.relativeTime || 'Recent';
      // Try to extract days from various formats
      if (time && typeof time === 'string') {
        if (time.includes('month')) {
          const months = parseInt(time.match(/(\d+)\s*months?/)?.[1] || '1');
          oldestTimeInDays = Math.max(oldestTimeInDays, months * 30);
        } else if (time.includes('week')) {
          const weeks = parseInt(time.match(/(\d+)\s*weeks?/)?.[1] || '1');
          oldestTimeInDays = Math.max(oldestTimeInDays, weeks * 7);
        } else if (time.includes('day')) {
          const days = parseInt(time.match(/(\d+)\s*days?/)?.[1] || '1');
          oldestTimeInDays = Math.max(oldestTimeInDays, days);
        } else if (time.includes('year')) {
          const years = parseInt(time.match(/(\d+)\s*years?/)?.[1] || '1');
          oldestTimeInDays = Math.max(oldestTimeInDays, years * 365);
        }
      }
    });
    
    // Create appropriate time categories based on video age
    const timeCategories = {};
    if (oldestTimeInDays <= 1) {
      timeCategories['Last 24 hours'] = [];
    } else if (oldestTimeInDays <= 7) {
      timeCategories['Last 24 hours'] = [];
      timeCategories['2-7 days ago'] = [];
    } else if (oldestTimeInDays <= 30) {
      timeCategories['Last 24 hours'] = [];
      timeCategories['Last week'] = [];
      timeCategories['Last month'] = [];
    } else if (oldestTimeInDays <= 90) {
      timeCategories['Last week'] = [];
      timeCategories['Last month'] = [];
      timeCategories['1-2 months ago'] = [];
      timeCategories['2-3 months ago'] = [];
    } else {
      timeCategories['Last month'] = [];
      timeCategories['1-3 months ago'] = [];
      timeCategories['3-6 months ago'] = [];
      timeCategories['Older than 6 months'] = [];
    }
    
    timeline.forEach(item => {
      const time = item.relativeTime || 'Recent';
      let categorized = false;
      
      // Calculate days ago for proper categorization
      let daysAgo = 0;
      if (time && typeof time === 'string') {
        if (time.includes('hour') || time.includes('minute') || time === 'Recent') {
          daysAgo = 0;
        } else if (time.includes('day')) {
          daysAgo = parseInt(time.match(/(\d+)\s*days?/)?.[1] || '1');
        } else if (time.includes('week')) {
          const weeks = parseInt(time.match(/(\d+)\s*weeks?/)?.[1] || '1');
          daysAgo = weeks * 7;
        } else if (time.includes('month')) {
          const months = parseInt(time.match(/(\d+)\s*months?/)?.[1] || '1');
          daysAgo = months * 30;
        } else if (time.includes('year')) {
          const years = parseInt(time.match(/(\d+)\s*years?/)?.[1] || '1');
          daysAgo = years * 365;
        }
      }
      
      // Place in appropriate category based on video age
      if (oldestTimeInDays <= 7) {
        if (daysAgo <= 1 && timeCategories['Last 24 hours']) {
          timeCategories['Last 24 hours'].push(item);
        } else if (timeCategories['2-7 days ago']) {
          timeCategories['2-7 days ago'].push(item);
        }
      } else if (oldestTimeInDays <= 30) {
        if (daysAgo <= 1 && timeCategories['Last 24 hours']) {
          timeCategories['Last 24 hours'].push(item);
        } else if (daysAgo <= 7 && timeCategories['Last week']) {
          timeCategories['Last week'].push(item);
        } else if (timeCategories['Last month']) {
          timeCategories['Last month'].push(item);
        }
      } else if (oldestTimeInDays <= 90) {
        if (daysAgo <= 7 && timeCategories['Last week']) {
          timeCategories['Last week'].push(item);
        } else if (daysAgo <= 30 && timeCategories['Last month']) {
          timeCategories['Last month'].push(item);
        } else if (daysAgo <= 60 && timeCategories['1-2 months ago']) {
          timeCategories['1-2 months ago'].push(item);
        } else if (timeCategories['2-3 months ago']) {
          timeCategories['2-3 months ago'].push(item);
        }
      } else {
        if (daysAgo <= 30 && timeCategories['Last month']) {
          timeCategories['Last month'].push(item);
        } else if (daysAgo <= 90 && timeCategories['1-3 months ago']) {
          timeCategories['1-3 months ago'].push(item);
        } else if (daysAgo <= 180 && timeCategories['3-6 months ago']) {
          timeCategories['3-6 months ago'].push(item);
        } else if (timeCategories['Older than 6 months']) {
          timeCategories['Older than 6 months'].push(item);
        }
      }
    });
    
    // Only include non-empty time periods
    Object.entries(timeCategories).forEach(([period, comments]) => {
      if (comments.length > 0) {
        const periodName = `${period}`;
        timeGroups[periodName] = comments;
      }
    });
    
    // Identify peak engagement windows
    Object.entries(timeGroups).forEach(([time, comments]) => {
      const avgEngagement = comments.reduce((sum, c) => sum + c.engagement, 0) / comments.length;
      if (comments.length > 5 && avgEngagement > 10) {
        this.insights.timeBasedAnalysis.peakEngagementWindows.push({
          timeWindow: time,
          commentCount: comments.length,
          avgEngagement: avgEngagement.toFixed(1),
          dominantSentiment: this.calculateDominantSentiment(comments)
        });
      }
    });
    
    // Track sentiment evolution
    const sentimentByTime = {};
    Object.entries(timeGroups).forEach(([periodName, comments]) => {
      sentimentByTime[periodName] = { positive: 0, negative: 0, neutral: 0, total: 0 };
      
      comments.forEach(item => {
        if (item.sentiment) {
          sentimentByTime[periodName][item.sentiment]++;
          sentimentByTime[periodName].total++;
        }
      });
    });
    
    this.insights.timeBasedAnalysis.sentimentEvolution = Object.entries(sentimentByTime)
      .map(([time, sentiment]) => {
        // Get the time range for this period
        const periodComments = timeGroups[time] || [];
        const timestamps = periodComments
          .map(c => c.relativeTime)
          .filter(t => t && t !== 'Recent');
        
        let timeRange = '';
        if (timestamps.length > 0) {
          const firstTime = timestamps[0];
          const lastTime = timestamps[timestamps.length - 1];
          if (firstTime !== lastTime) {
            timeRange = `${firstTime} - ${lastTime}`;
          } else {
            timeRange = firstTime;
          }
        }
        
        return {
          time,
          timeRange,
          positivePercent: sentiment.total > 0 ? Math.round((sentiment.positive / sentiment.total) * 100) : 0,
          negativePercent: sentiment.total > 0 ? Math.round((sentiment.negative / sentiment.total) * 100) : 0,
          neutralPercent: sentiment.total > 0 ? Math.round((sentiment.neutral / sentiment.total) * 100) : 0,
          total: sentiment.total
        };
      })
      .filter(item => item.total > 0)
      .slice(0, 5);
  }

  processTrollDetection() {
    const behaviors = this.insights.trollDetection.suspiciousBehaviors;
    
    // Identify repeat offenders
    const authorCounts = {};
    behaviors.forEach(behavior => {
      const author = behavior.author || 'Unknown';
      authorCounts[author] = (authorCounts[author] || 0) + 1;
    });
    
    this.insights.trollDetection.repeatOffenders = Object.entries(authorCounts)
      .filter(([author, count]) => count > 1)
      .map(([author, count]) => {
        const userBehaviors = behaviors.filter(b => (b.author || 'Unknown') === author);
        // Flatten all indicators from all behaviors
        const allIndicators = userBehaviors.reduce((acc, b) => {
          return acc.concat(b.indicators || []);
        }, []);
        const offenseTypes = [...new Set(allIndicators)];
        
        return {
          username: author,
          offenseCount: count,
          offenseTypes: offenseTypes,
          behaviors: userBehaviors,
          riskLevel: count > 3 ? 'high' : count > 2 ? 'medium' : 'low'
        };
      })
      .sort((a, b) => b.offenseCount - a.offenseCount)
      .slice(0, 10);
  }

  calculateEngagementQuality() {
    const analysis = this.insights.engagementQuality.depthAnalysis;
    const totalComments = this.comments.length;
    
    if (analysis.length === 0 || totalComments === 0) {
      this.insights.engagementQuality.overallScore = 0;
      this.insights.engagementQuality.meaningfulnessIndex = 0;
      this.insights.engagementQuality.meaningfulComments = 0;
      this.insights.engagementQuality.threadParticipation = 0;
      this.insights.engagementQuality.questionsAsked = 0;
      this.insights.engagementQuality.topicRelevance = 0;
      return;
    }
    
    // Calculate meaningful comments percentage
    const meaningfulCount = analysis.filter(item => item.score > 3).length;
    const meaningfulnessIndex = (meaningfulCount / analysis.length) * 100;
    
    // Calculate thread participation (comments that are replies)
    const replyCount = this.comments.filter(c => c.isReply).length;
    const threadParticipation = (replyCount / totalComments) * 100;
    
    // Count questions asked to creator
    const questionsAsked = this.insights.frequentQuestions.length;
    
    // Calculate topic relevance (comments with quality score > 2)
    const relevantCount = analysis.filter(item => item.score > 2).length;
    const topicRelevance = (relevantCount / analysis.length) * 100;
    
    // Calculate average quality score (0-10 scale)
    const totalScore = analysis.reduce((sum, item) => sum + item.score, 0);
    const avgQualityScore = totalScore / analysis.length;
    
    // Calculate overall engagement quality score (0-100)
    // Weighted formula considering multiple factors
    const weights = {
      avgQuality: 0.3,      // 30% - Average comment quality
      meaningful: 0.25,     // 25% - Meaningful comments percentage  
      threadPart: 0.15,     // 15% - Thread participation
      topicRel: 0.15,       // 15% - Topic relevance
      questions: 0.15       // 15% - Creator-directed questions
    };
    
    // Normalize question count (cap at 20 questions = 100%)
    const normalizedQuestions = Math.min(questionsAsked / 20 * 100, 100);
    
    const overallScore = Math.round(
      (avgQualityScore * 10 * weights.avgQuality) +       // Quality score out of 100
      (meaningfulnessIndex * weights.meaningful) +        // Meaningful percentage
      (threadParticipation * weights.threadPart) +        // Thread participation percentage
      (topicRelevance * weights.topicRel) +              // Topic relevance percentage
      (normalizedQuestions * weights.questions)           // Questions percentage
    );
    
    // Set all values
    this.insights.engagementQuality.overallScore = Math.min(overallScore, 100); // Cap at 100
    this.insights.engagementQuality.meaningfulnessIndex = Math.round(meaningfulnessIndex);
    this.insights.engagementQuality.meaningfulComments = Math.round(meaningfulnessIndex);
    this.insights.engagementQuality.threadParticipation = Math.round(threadParticipation);
    this.insights.engagementQuality.questionsAsked = questionsAsked;
    this.insights.engagementQuality.topicRelevance = Math.round(topicRelevance);
    
    // Keep top quality comments for display
    this.insights.engagementQuality.topQualityComments = analysis
      .filter(item => item.score > 4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
      
    // Debug logging (remove in production)
    console.log('Engagement Quality Debug:', {
      totalComments,
      analysisLength: analysis.length,
      avgQualityScore: avgQualityScore.toFixed(2),
      meaningfulnessIndex: meaningfulnessIndex.toFixed(1),
      threadParticipation: threadParticipation.toFixed(1),
      questionsAsked,
      topicRelevance: topicRelevance.toFixed(1),
      overallScore
    });
  }

  processMonetizationIntel() {
    const intel = this.insights.monetizationIntelligence;
    
    // Rank product mentions by engagement
    intel.productMentions.sort((a, b) => b.engagement - a.engagement);
    intel.productMentions = intel.productMentions.slice(0, 10);
    
    // Process brand opportunities
    intel.brandOpportunities = intel.brandOpportunities.slice(0, 5);
    
    // Calculate merchandise demand level
    if (intel.merchandiseDemand.length > 0) {
      intel.merchandiseDemandLevel = intel.merchandiseDemand.length > 10 ? 'high' : 
                                   intel.merchandiseDemand.length > 5 ? 'medium' : 'low';
    }
    
    // Calculate course interest level
    if (intel.courseInterest.length > 0) {
      intel.courseInterestLevel = intel.courseInterest.length > 15 ? 'high' : 
                                intel.courseInterest.length > 8 ? 'medium' : 'low';
    }
    
    // Generate revenue opportunities
    intel.revenueOpportunities = [];
    
    if (intel.productMentions.length > 5) {
      intel.revenueOpportunities.push({
        type: 'Affiliate Marketing',
        priority: 'High',
        description: `${intel.productMentions.length} viewers asking about products/gear you use`,
        potential: `$${Math.round(intel.productMentions.length * 50)}-${Math.round(intel.productMentions.length * 150)}/month`
      });
    }
    
    if (intel.brandOpportunities.length > 0) {
      intel.revenueOpportunities.push({
        type: 'Brand Sponsorships',
        priority: intel.brandOpportunities.length > 3 ? 'High' : 'Medium',
        description: `${intel.brandOpportunities.length} potential brand collaboration interests`,
        potential: `$${Math.round(intel.brandOpportunities.length * 1000)}-${Math.round(intel.brandOpportunities.length * 5000)}/video`
      });
    }
    
    if (intel.merchandiseDemand.length > 5) {
      intel.revenueOpportunities.push({
        type: 'Merchandise',
        priority: intel.merchandiseDemand.length > 10 ? 'High' : 'Medium',
        description: `${intel.merchandiseDemand.length} viewers interested in merchandise`,
        potential: `$${Math.round(intel.merchandiseDemand.length * 20)}-${Math.round(intel.merchandiseDemand.length * 100)}/month`
      });
    }
    
    if (intel.courseInterest.length > 5) {
      intel.revenueOpportunities.push({
        type: 'Educational Content',
        priority: intel.courseInterest.length > 10 ? 'High' : 'Medium',
        description: `${intel.courseInterest.length} viewers interested in courses/tutorials`,
        potential: `$${Math.round(intel.courseInterest.length * 100)}-${Math.round(intel.courseInterest.length * 500)}/month`
      });
    }
    
    // Calculate audience value indicators
    const totalEngagement = this.comments.reduce((sum, c) => sum + parseInt(c.likes || 0), 0);
    const avgEngagement = this.comments.length > 0 ? totalEngagement / this.comments.length : 0;
    
    intel.audienceValue = [
      {
        type: 'Engagement Rate',
        value: `${avgEngagement.toFixed(1)} avg likes/comment`
      },
      {
        type: 'Monetization Interest',
        value: `${intel.productMentions.length + intel.brandOpportunities.length + intel.merchandiseDemand.length + intel.courseInterest.length} monetization-related comments`
      },
      {
        type: 'Audience Size',
        value: `${this.comments.length} active commenters`
      }
    ];
    
    // Calculate overall monetization potential
    const inquiryCount = intel.productMentions.length + intel.brandOpportunities.length + 
                        intel.merchandiseDemand.length + intel.courseInterest.length;
    const inquiryRate = this.comments.length > 0 ? (inquiryCount / this.comments.length) * 100 : 0;
    
    if (inquiryRate > 10) {
      intel.monetizationPotential = 90;
    } else if (inquiryRate > 5) {
      intel.monetizationPotential = 70;
    } else if (inquiryRate > 2) {
      intel.monetizationPotential = 50;
    } else if (inquiryRate > 1) {
      intel.monetizationPotential = 30;
    } else {
      intel.monetizationPotential = 10;
    }
  }

  processSeriesPlanning() {
    const planner = this.insights.seriesPlanner;
    
    // Rank continuation requests by engagement
    planner.multiPartRequests.sort((a, b) => b.engagement - a.engagement);
    planner.multiPartRequests = planner.multiPartRequests.slice(0, 10);
    
    // Calculate continuation demand level
    if (planner.multiPartRequests.length > 0) {
      planner.continuationDemand = planner.multiPartRequests.length > 20 ? 'very high' :
                                 planner.multiPartRequests.length > 10 ? 'high' :
                                 planner.multiPartRequests.length > 5 ? 'medium' : 'low';
    }
    
    // Analyze format preferences
    const formatCounts = { long_form: 0, short_form: 0 };
    planner.formatPreferences.forEach(pref => {
      formatCounts[pref.preference]++;
    });
    
    planner.formatPreference = formatCounts.long_form > formatCounts.short_form ? 'long_form' :
                              formatCounts.short_form > formatCounts.long_form ? 'short_form' : 'mixed';
  }

  generateSmartNotifications() {
    const notifications = this.insights.smartNotifications;
    
    // Crisis alerts (sudden negative sentiment spikes)
    const negativePercent = (this.insights.sentiment.negative / this.comments.length) * 100;
    if (negativePercent > 40) {
      notifications.crisisAlerts.push({
        type: 'high_negativity',
        severity: negativePercent > 60 ? 'critical' : 'warning',
        message: `${negativePercent.toFixed(1)}% negative sentiment detected`,
        recommendation: 'Consider addressing concerns in a follow-up video or community post'
      });
    }
    
    // Viral moment detection (unusually high engagement)
    const avgLikes = this.comments.reduce((sum, c) => sum + parseInt(c.likes || 0), 0) / this.comments.length;
    if (avgLikes > 50) {
      notifications.viralMoments.push({
        type: 'high_engagement',
        message: `Exceptional engagement detected (${avgLikes.toFixed(1)} avg likes per comment)`,
        recommendation: 'Consider creating similar content or capitalizing on this momentum'
      });
    }
    
    // Question overflow detection
    if (this.insights.frequentQuestions.length > 10) {
      notifications.questionOverflow.push({
        type: 'high_question_volume',
        count: this.insights.frequentQuestions.length,
        message: `${this.insights.frequentQuestions.length} creator-directed questions found`,
        recommendation: 'Consider creating a Q&A video or addressing these in your next video'
      });
    }
    
    // Trending comment detection (comments with unusually high likes)
    const highLikeComments = this.comments.filter(c => parseInt(c.likes || 0) > avgLikes * 3);
    if (highLikeComments.length > 0) {
      notifications.trendingComments = highLikeComments.slice(0, 3).map(comment => ({
        author: comment.author,
        text: comment.text.substring(0, 100),
        likes: comment.likes,
        reason: 'Unusually high engagement'
      }));
    }
  }

  processThreadAnalysis() {
    const threads = this.insights.threadAnalysis;
    
    // Clear processed threads
    threads.topDiscussions = [];
    
    // Only process if we have meaningful thread data
    if (threads.conversationThreads.length === 0 && threads.discussionLeaders.length === 0) {
      return;
    }
    
    // Sort discussion leaders by reply count
    threads.discussionLeaders.sort((a, b) => b.replies - a.replies);
    threads.discussionLeaders = threads.discussionLeaders.slice(0, 10);
    
    // Group conversation threads by topic similarity
    const threadGroups = {};
    const MIN_THREAD_SIZE = 3; // Minimum messages to consider a thread
    
    // Process discussion leaders into meaningful threads
    threads.discussionLeaders.forEach(leader => {
      if (leader.replies >= MIN_THREAD_SIZE) {
        // Extract topic from comment text
        const topic = this.extractThreadTopic(leader.text);
        
        if (!threadGroups[topic]) {
          threadGroups[topic] = {
            topic: topic,
            participants: new Set([leader.author]),
            messages: leader.replies + 1, // Include original comment
            sentiment: leader.text.includes('?') ? 0 : this.getSimpleSentiment(leader.text),
            originalComment: leader.text.substring(0, 100)
          };
        } else {
          threadGroups[topic].participants.add(leader.author);
          threadGroups[topic].messages += leader.replies;
        }
      }
    });
    
    // Add reply threads to groups
    threads.conversationThreads.forEach(thread => {
      const topic = this.extractThreadTopic(thread.text);
      if (threadGroups[topic]) {
        threadGroups[topic].participants.add(thread.author);
        threadGroups[topic].messages++;
      }
    });
    
    // Convert thread groups to array and filter
    const meaningfulThreads = Object.values(threadGroups)
      .map(group => ({
        topic: group.topic,
        participants: group.participants.size,
        messages: group.messages,
        sentiment: group.sentiment,
        originalComment: group.originalComment
      }))
      .filter(thread => thread.messages >= MIN_THREAD_SIZE)
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 10); // Top 10 threads
    
    // Replace raw threads with processed ones
    threads.conversationThreads = meaningfulThreads;
    
    // Create top discussions summary
    threads.topDiscussions = meaningfulThreads.slice(0, 5).map(thread => ({
      topic: thread.topic,
      engagement: thread.messages * 10 // Estimate engagement score
    }));
    
    // Analyze conversation patterns
    const replyAuthors = threads.conversationThreads.map(t => t.participants || 0);
    const totalParticipants = replyAuthors.reduce((sum, count) => sum + count, 0);
    
    // Store thread summary
    threads.threadSummary = {
      totalThreads: meaningfulThreads.length,
      totalParticipants: totalParticipants,
      avgMessagesPerThread: meaningfulThreads.length > 0 ? 
        (meaningfulThreads.reduce((sum, t) => sum + t.messages, 0) / meaningfulThreads.length).toFixed(1) : 0
    };
  }
  
  extractThreadTopic(text) {
    // Extract meaningful topic from comment text
    const cleanText = (text || '').toLowerCase().trim();
    
    // Common discussion topics
    const topicPatterns = [
      { pattern: /tutorial|how to|guide|learn/i, topic: 'Tutorial Discussion' },
      { pattern: /problem|issue|bug|error/i, topic: 'Problem Resolution' },
      { pattern: /suggestion|idea|should|could/i, topic: 'Feature Suggestions' },
      { pattern: /thank|appreciate|helpful|great/i, topic: 'Appreciation Thread' },
      { pattern: /question|why|what|how|when/i, topic: 'Q&A Discussion' },
      { pattern: /disagree|wrong|actually|but/i, topic: 'Debate Thread' },
      { pattern: /price|cost|money|buy|purchase/i, topic: 'Pricing Discussion' },
      { pattern: /update|new|version|release/i, topic: 'Updates Discussion' }
    ];
    
    // Check for pattern matches
    for (const { pattern, topic } of topicPatterns) {
      if (pattern.test(cleanText)) {
        return topic;
      }
    }
    
    // Extract key phrase from beginning of comment
    const firstWords = cleanText.split(/[.!?]/)[0];
    if (firstWords && firstWords.length > 10 && firstWords.length < 50) {
      return firstWords.substring(0, 40) + '...';
    }
    
    return 'General Discussion';
  }
  
  getSimpleSentiment(text) {
    const positive = /good|great|love|thank|appreciate|helpful|awesome|excellent/i;
    const negative = /bad|hate|problem|issue|wrong|terrible|awful|disappointed/i;
    
    if (positive.test(text)) return 1;
    if (negative.test(text)) return -1;
    return 0;
  }

  identifyCommunityLeaders() {
    const leaders = this.insights.communityLeaders;
    
    // Identify superfans (high engagement, positive sentiment)
    const superfanCandidates = this.insights.topEngagedUsers.filter(user => {
      const userComments = this.comments.filter(c => c.author === user.author);
      const positiveComments = userComments.filter(c => c.sentiment === 'positive').length;
      return (positiveComments / userComments.length) > 0.7 && user.commentCount > 2;
    });
    
    leaders.superfans = superfanCandidates.slice(0, 5);
    
    // Identify influential commenters (high reply generation)
    const influentialUsers = this.insights.threadAnalysis.discussionLeaders
      .map(leader => ({
        author: leader.author,
        discussionPower: leader.replies,
        sampleComment: leader.text.substring(0, 100)
      }))
      .slice(0, 5);
    
    leaders.influentialCommenters = influentialUsers;
    
    // Identify engagement drivers (comments that spark conversation)
    const engagementDrivers = this.comments
      .filter(c => parseInt(c.replies || 0) > 3 && parseInt(c.likes || 0) > 5)
      .map(c => ({
        author: c.author,
        text: c.text.substring(0, 100),
        totalEngagement: parseInt(c.likes || 0) + parseInt(c.replies || 0)
      }))
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, 5);
    
    leaders.engagementDrivers = engagementDrivers;
  }

  assessContentFatigue() {
    const fatigue = this.insights.contentFatigue;
    
    // Analyze word frequency for overused terms
    const topWords = Object.entries(this.insights.wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    // Check for topic saturation
    const saturatedTopics = topWords.filter(([word, freq]) => 
      freq > this.comments.length * 0.3 // Mentioned in >30% of comments
    );
    
    if (saturatedTopics.length > 0) {
      fatigue.topicSaturation = saturatedTopics.map(([word, freq]) => ({
        topic: word,
        frequency: freq,
        saturationLevel: Math.round((freq / this.comments.length) * 100) + '%'
      }));
    }
    
    // Generate freshness suggestions
    if (this.insights.videoIdeas.length > 0) {
      const uniqueCategories = [...new Set(this.insights.videoIdeas.map(idea => idea.category))];
      fatigue.freshnessSuggestions = uniqueCategories.slice(0, 5).map(category => ({
        category,
        reason: 'Audience-requested content category',
        priority: 'medium'
      }));
    }
    
    // Fatigue warnings based on sentiment and engagement
    const avgQuality = this.insights.engagementQuality.overallScore;
    if (avgQuality < 30 && this.insights.sentiment.neutral / this.comments.length > 0.6) {
      fatigue.fatigueWarnings.push({
        type: 'engagement_decline',
        severity: 'medium',
        message: 'Comments show neutral sentiment and low engagement quality',
        suggestion: 'Consider introducing new content formats or topics'
      });
    }
  }

  processControversialComments() {
    const controversial = this.insights.controversialComments;
    
    // Sort debates by engagement and controversy score
    controversial.debates.sort((a, b) => {
      const scoreA = a.controversyScore + (a.engagement / 100);
      const scoreB = b.controversyScore + (b.engagement / 100);
      return scoreB - scoreA;
    });
    
    // Keep top 10 controversial comments
    controversial.debates = controversial.debates.slice(0, 10);
    
    // Identify polarizing topics from controversial comments
    const topicCounts = {};
    controversial.debates.forEach(comment => {
      // Extract key topics from the comment
      const topics = this.extractControversialTopics(comment.text);
      topics.forEach(topic => {
        if (!topicCounts[topic]) {
          topicCounts[topic] = { count: 0, comments: [] };
        }
        topicCounts[topic].count++;
        topicCounts[topic].comments.push(comment);
      });
    });
    
    // Convert to array and sort by frequency
    controversial.polarizingTopics = Object.entries(topicCounts)
      .map(([topic, data]) => ({
        topic: topic,
        frequency: data.count,
        comments: data.comments.slice(0, 3) // Keep top 3 examples
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
    
    // Identify high-engagement disputes (controversial + high engagement)
    controversial.highEngagementDisputes = controversial.debates
      .filter(comment => comment.engagement > 100 && comment.replies > 5)
      .slice(0, 5);
  }

  extractControversialTopics(text) {
    const topics = [];
    const lowerText = text.toLowerCase();
    
    // Common controversial topic patterns
    const topicPatterns = [
      { pattern: /overrated|underrated/i, topic: 'Rating debates' },
      { pattern: /better than|worse than|vs\.|versus/i, topic: 'Comparisons' },
      { pattern: /fake|real|authentic|staged/i, topic: 'Authenticity debates' },
      { pattern: /political|politics|left|right|liberal|conservative/i, topic: 'Political discussions' },
      { pattern: /money|price|expensive|cheap|worth/i, topic: 'Value/Money debates' },
      { pattern: /old|new|original|remake|reboot/i, topic: 'Old vs New' },
      { pattern: /best|worst|goat|trash/i, topic: 'Quality extremes' },
      { pattern: /cancel|toxic|problematic/i, topic: 'Cancel culture' },
      { pattern: /gen z|millennial|boomer/i, topic: 'Generational debates' },
      { pattern: /stan|hater|fanboy|shill/i, topic: 'Fan culture' }
    ];
    
    topicPatterns.forEach(({ pattern, topic }) => {
      if (pattern.test(lowerText)) {
        topics.push(topic);
      }
    });
    
    return topics.length > 0 ? topics : ['General controversy'];
  }

  calculateDominantSentiment(comments) {
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    comments.forEach(c => sentimentCounts[c.sentiment]++);
    return Object.keys(sentimentCounts).reduce((a, b) => 
      sentimentCounts[a] > sentimentCounts[b] ? a : b
    );
  }

  displayInsights() {
    // Remove existing insights panel if present
    const existingPanel = document.querySelector('#vibelytics-insights-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    // Get saved width or use default
    const savedWidth = localStorage.getItem('vibelytics-panel-width') || '400';

    // Create insights panel
    const insightsPanel = document.createElement('div');
    insightsPanel.id = 'vibelytics-insights-panel';
    insightsPanel.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: ${savedWidth}px;
      height: 100vh;
      background: #0f0f0f;
      border-left: 1px solid #303030;
      padding: 0;
      z-index: 9999;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      overflow: hidden;
      box-shadow: -4px 0 20px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      min-width: 350px;
      max-width: 800px;
    `;

    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 10px;
      height: 100%;
      cursor: ew-resize;
      background: transparent;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Add grip indicator
    const gripIndicator = document.createElement('div');
    gripIndicator.style.cssText = `
      width: 4px;
      height: 40px;
      background: rgba(255,255,255,0.2);
      border-radius: 2px;
      transition: background 0.2s;
    `;
    resizeHandle.appendChild(gripIndicator);
    
    resizeHandle.onmouseover = () => {
      resizeHandle.style.background = 'rgba(255,255,255,0.1)';
      gripIndicator.style.background = 'rgba(255,255,255,0.4)';
    };
    resizeHandle.onmouseout = () => {
      resizeHandle.style.background = 'transparent';
      gripIndicator.style.background = 'rgba(255,255,255,0.2)';
    };

    // Add resize functionality
    let isResizing = false;
    let startX = 0;
    let startWidth = parseInt(savedWidth);

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(insightsPanel.style.width);
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const deltaX = startX - e.clientX; // Reversed because panel is on the right
      const newWidth = Math.min(800, Math.max(350, startWidth + deltaX));
      insightsPanel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        // Save the new width
        localStorage.setItem('vibelytics-panel-width', insightsPanel.style.width.replace('px', ''));
      }
    });

    insightsPanel.appendChild(resizeHandle);

    // Create header with title, export/email button and close button
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 30px;
      background: #1a1a1a;
      border-bottom: 1px solid #303030;
      flex-shrink: 0;
      gap: 10px;
    `;
    
    const title = document.createElement('h2');
    title.textContent = 'Vibelytics Insights Dashboard';
    title.style.cssText = 'margin: 0; color: #fff; font-size: 20px; flex-grow: 1;';
    
    // Create Export/Email button for the panel
    const panelExportButton = document.createElement('button');
    panelExportButton.textContent = '📤 Export/Email';
    panelExportButton.style.cssText = `
      background: #E91E63;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;
    `;
    panelExportButton.onmouseover = () => {
      panelExportButton.style.background = '#C2185B';
    };
    panelExportButton.onmouseout = () => {
      panelExportButton.style.background = '#E91E63';
    };
    panelExportButton.onclick = () => {
      const choice = confirm('Click OK to Email Insights\nClick Cancel to Export as CSV');
      if (choice) {
        this.emailInsights();
      } else {
        this.exportComments();
      }
    };
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      background: transparent;
      border: none;
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
    `;
    closeButton.onmouseover = () => {
      closeButton.style.background = 'rgba(255,255,255,0.1)';
    };
    closeButton.onmouseout = () => {
      closeButton.style.background = 'transparent';
    };
    closeButton.onclick = () => {
      insightsPanel.remove();
      // Show the "Show Insights" button
      if (this.showInsightsButton) {
        this.showInsightsButton.style.display = 'inline-block';
      }
    };
    
    header.appendChild(title);
    header.appendChild(panelExportButton);
    header.appendChild(closeButton);
    insightsPanel.appendChild(header);

    // Create scrollable content container
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px 30px;
      background: #0f0f0f;
      scrollbar-width: thin;
      scrollbar-color: #303030 transparent;
    `;
    
    // Add webkit scrollbar styling
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.textContent = `
      #vibelytics-insights-panel div::-webkit-scrollbar {
        width: 8px;
      }
      #vibelytics-insights-panel div::-webkit-scrollbar-track {
        background: transparent;
      }
      #vibelytics-insights-panel div::-webkit-scrollbar-thumb {
        background: #303030;
        border-radius: 4px;
      }
      #vibelytics-insights-panel div::-webkit-scrollbar-thumb:hover {
        background: #404040;
      }
    `;
    document.head.appendChild(scrollbarStyle);

    // ===== GROUP 1: OVERVIEW & SUMMARY =====
    // Narrative Summary - What viewers are saying
    const narrativeSummarySection = this.createInsightSection('Viewers Say', 
      this.formatNarrativeSummary());
    contentContainer.appendChild(narrativeSummarySection);
    
    // Reviews General Summary
    const summarySection = this.createInsightSection('Reviews General Summary', 
      this.formatGeneralSummary());
    contentContainer.appendChild(summarySection);
    
    // Word Cloud
    const wordCloudSection = this.createInsightSection('Comment Word Cloud',
      this.formatWordCloud());
    contentContainer.appendChild(wordCloudSection);

    // Sentiment Analysis
    const sentimentSection = this.createInsightSection('Audience Sentiment', 
      this.formatSentiment());
    contentContainer.appendChild(sentimentSection);

    // ===== GROUP 2: ENGAGEMENT & PERFORMANCE =====
    // Engagement Quality Score
    const engagementQualitySection = this.createInsightSection('⭐ Engagement Quality Score',
      this.formatEngagementQuality());
    contentContainer.appendChild(engagementQualitySection);

    // Top Influential Comments
    const influentialSection = this.createInsightSection('Top 5 Influential Comments',
      this.formatInfluentialComments());
    contentContainer.appendChild(influentialSection);

    // Most Interesting Comments
    const interestingSection = this.createInsightSection('Top 5 Most Interesting Comments',
      this.formatInterestingComments());
    contentContainer.appendChild(interestingSection);

    // Time-Based Analysis
    if (this.insights.timeBasedAnalysis.peakEngagementWindows.length > 0 || this.insights.timeBasedAnalysis.sentimentEvolution.length > 0) {
      const timeAnalysisSection = this.createInsightSection('📈 Time-Based Analysis',
        this.formatTimeBasedAnalysis());
      contentContainer.appendChild(timeAnalysisSection);
    }

    // Top Engaged Users
    const engagedSection = this.createInsightSection('Top 5 Engaged Users',
      this.formatEngagedUsers());
    contentContainer.appendChild(engagedSection);

    // ===== GROUP 3: CONTENT CREATION INSIGHTS =====
    // Video Ideas
    if (this.insights.videoIdeas.length > 0) {
      const ideasSection = this.createInsightSection('Top 5 Video Ideas for Next Video',
        this.formatVideoIdeas());
      contentContainer.appendChild(ideasSection);
    }

    // Comment Topics
    const topicsSection = this.createInsightSection('Comment Topics (AI-Powered)',
      this.formatCommentTopics());
    contentContainer.appendChild(topicsSection);

    // Frequent Questions
    const questionsSection = this.createInsightSection('Creator-Directed Questions',
      this.formatQuestions());
    contentContainer.appendChild(questionsSection);

    // Best Features
    const featuresSection = this.createInsightSection('Best Video Features',
      this.formatBestFeatures());
    contentContainer.appendChild(featuresSection);

    // Areas for Improvement
    const improvementSection = this.createInsightSection('Areas for Improvement',
      this.formatImprovements());
    contentContainer.appendChild(improvementSection);

    // Series Planner
    if (this.insights.seriesPlanner.seriesIdeas.length > 0) {
      const seriesSection = this.createInsightSection('🎬 Series Planner',
        this.formatSeriesPlanner());
      contentContainer.appendChild(seriesSection);
    }

    // ===== GROUP 4: BUSINESS & MONETIZATION =====
    // Business Opportunities
    const businessSection = this.createInsightSection('Sales & Business Opportunities',
      this.formatBusinessOpportunities());
    contentContainer.appendChild(businessSection);

    // Monetization Intelligence
    if (this.insights.monetizationIntelligence.monetizationPotential > 0) {
      const monetizationSection = this.createInsightSection('💰 Monetization Intelligence',
        this.formatMonetizationIntelligence());
      contentContainer.appendChild(monetizationSection);
    }

    // ===== GROUP 5: COMMUNITY MANAGEMENT =====
    // Community Leaders
    if (this.insights.communityLeaders.influentialUsers.length > 0) {
      const leadersSection = this.createInsightSection('👑 Community Leaders',
        this.formatCommunityLeaders());
      contentContainer.appendChild(leadersSection);
    }

    // Thread Analysis
    if (this.insights.threadAnalysis.conversationThreads.length > 0 || 
        this.insights.threadAnalysis.discussionLeaders.length > 0) {
      const threadSection = this.createInsightSection('🧵 Thread Analysis',
        this.formatThreadAnalysis());
      contentContainer.appendChild(threadSection);
    }

    // Smart Notifications
    if (this.insights.smartNotifications.urgentNotifications.length > 0 || this.insights.smartNotifications.generalNotifications.length > 0) {
      const notificationsSection = this.createInsightSection('🔔 Smart Notifications',
        this.formatSmartNotifications());
      contentContainer.appendChild(notificationsSection);
    }

    // ===== GROUP 6: MODERATION & SAFETY =====
    // Toxicity Thermometer
    const toxicitySection = this.createInsightSection('Toxicity Thermometer',
      this.formatToxicityThermometer());
    contentContainer.appendChild(toxicitySection);
    
    // Top Inappropriate Users
    if (this.insights.topInappropriateUsers && this.insights.topInappropriateUsers.length > 0) {
      const inappropriateUsersSection = this.createInsightSection('Top 10 Users with Inappropriate Comments',
        this.formatInappropriateUsers());
      contentContainer.appendChild(inappropriateUsersSection);
    }
    
    // Troll Detection (always show)
    const trollSection = this.createInsightSection('🚨 Troll Detection',
      this.formatTrollDetection());
    contentContainer.appendChild(trollSection);

    // Content Fatigue Warning
    if (this.insights.contentFatigue.fatigueLevel > 0) {
      const fatigueSection = this.createInsightSection('⚠️ Content Fatigue Warning',
        this.formatContentFatigue());
      contentContainer.appendChild(fatigueSection);
    }

    // Controversial Comments
    if (this.insights.controversialComments.debates.length > 0) {
      const controversialSection = this.createInsightSection('🔥 Controversial Comments',
        this.formatControversialComments());
      contentContainer.appendChild(controversialSection);
    }

    // Mobile App Download Section - Added as last item in content container
    const mobileAppSection = document.createElement('div');
    mobileAppSection.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin-top: 20px;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    `;
    
    mobileAppSection.innerHTML = `
      <div style="color: white; font-size: 16px; font-weight: bold; margin-bottom: 8px;">
        📱 Get Vibelytics Mobile App
      </div>
      <div style="color: rgba(255, 255, 255, 0.9); font-size: 13px; margin-bottom: 12px;">
        Analyze YouTube comments on the go!
      </div>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <a href="https://apps.apple.com/app/vibelytics" target="_blank" style="text-decoration: none;">
          <button style="
            background: black;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.3s;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            🍎 App Store
          </button>
        </a>
        <a href="https://play.google.com/store/apps/details?id=com.vibelytics" target="_blank" style="text-decoration: none;">
          <button style="
            background: #00875A;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.3s;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            🤖 Google Play
          </button>
        </a>
      </div>
    `;
    
    contentContainer.appendChild(mobileAppSection);
    
    // Add content container to panel
    insightsPanel.appendChild(contentContainer);
    document.body.appendChild(insightsPanel);
  }

  createInsightSection(title, content) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 20px; padding: 15px; background: #1a1a1a; border-radius: 6px;';
    
    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = title;
    sectionTitle.style.cssText = 'margin: 0 0 10px 0; color: #fff; font-size: 16px;';
    
    section.appendChild(sectionTitle);
    section.appendChild(content);
    
    return section;
  }

  formatSentiment() {
    const container = document.createElement('div');
    const total = this.comments.length;
    
    const sentimentBar = document.createElement('div');
    sentimentBar.style.cssText = 'display: flex; height: 30px; border-radius: 4px; overflow: hidden; margin-bottom: 10px;';
    
    const positive = (this.insights.sentiment.positive / total * 100).toFixed(1);
    const negative = (this.insights.sentiment.negative / total * 100).toFixed(1);
    const neutral = (this.insights.sentiment.neutral / total * 100).toFixed(1);
    
    sentimentBar.innerHTML = `
      <div style="background: #4CAF50; width: ${positive}%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
        ${positive}%
      </div>
      <div style="background: #FFC107; width: ${neutral}%; display: flex; align-items: center; justify-content: center; color: black; font-size: 12px;">
        ${neutral}%
      </div>
      <div style="background: #F44336; width: ${negative}%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
        ${negative}%
      </div>
    `;
    
    const legend = document.createElement('div');
    legend.style.cssText = 'display: flex; justify-content: space-around; font-size: 12px;';
    legend.innerHTML = `
      <span><span style="color: #4CAF50;">●</span> Positive: ${this.insights.sentiment.positive}</span>
      <span><span style="color: #FFC107;">●</span> Neutral: ${this.insights.sentiment.neutral}</span>
      <span><span style="color: #F44336;">●</span> Negative: ${this.insights.sentiment.negative}</span>
    `;
    
    container.appendChild(sentimentBar);
    container.appendChild(legend);
    
    return container;
  }

  formatInfluentialComments() {
    const container = document.createElement('div');
    
    this.insights.topInfluentialComments.forEach((comment, index) => {
      const commentDiv = document.createElement('div');
      commentDiv.style.cssText = 'margin-bottom: 10px; padding: 10px; background: #262626; border-radius: 4px;';
      commentDiv.innerHTML = `
        <div style="font-weight: bold; color: #4CAF50; margin-bottom: 5px;">
          ${index + 1}. ${comment.author || 'Unknown'} (${comment.replies || 0} replies)
        </div>
        <div style="font-size: 12px; color: #ccc;">
          ${comment.text.substring(0, 100)}${comment.text.length > 100 ? '...' : ''}
        </div>
      `;
      container.appendChild(commentDiv);
    });
    
    return container;
  }

  formatVideoIdeas() {
    const container = document.createElement('div');
    
    this.insights.videoIdeas.forEach((idea, index) => {
      const ideaDiv = document.createElement('div');
      ideaDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #262626; border-radius: 6px; border-left: 3px solid #4CAF50;';
      
      // Category badge
      const categoryColors = {
        'tutorial': '#2196F3',
        'series': '#9C27B0',
        'topic': '#4CAF50',
        'comparison': '#FF9800',
        'reaction': '#F44336',
        'collaboration': '#00BCD4',
        'request': '#FFC107',
        'content_type': '#795548'
      };
      
      const categoryBadge = `
        <span style="
          background: ${categoryColors[idea.category] || '#666'};
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          margin-left: 8px;
        ">${idea.category}</span>
      `;
      
      // Engagement metrics
      const engagementInfo = `
        <div style="font-size: 11px; color: #888; margin-top: 4px;">
          <span style="color: #4CAF50;">📊 ${idea.mentions} mentions</span> | 
          <span style="color: #2196F3;">👍 ${idea.totalEngagement} engagement</span> | 
          <span style="color: ${idea.sentiment === 'positive' ? '#4CAF50' : idea.sentiment === 'negative' ? '#F44336' : '#FFC107'};">
            ${idea.sentiment === 'positive' ? '😊' : idea.sentiment === 'negative' ? '😕' : '😐'} ${idea.sentiment}
          </span>
        </div>
      `;
      
      ideaDiv.innerHTML = `
        <div style="display: flex; align-items: start; justify-content: space-between;">
          <div style="flex-grow: 1;">
            <div style="font-weight: bold; color: #fff; margin-bottom: 6px;">
              ${index + 1}. ${idea.idea}
              ${categoryBadge}
            </div>
            ${engagementInfo}
          </div>
        </div>
      `;
      
      // Add example mentions if available
      if (idea.examples && idea.examples.length > 0) {
        const examplesDiv = document.createElement('div');
        examplesDiv.style.cssText = 'margin-top: 8px; padding-top: 8px; border-top: 1px solid #333;';
        
        const exampleText = document.createElement('div');
        exampleText.style.cssText = 'font-size: 11px; color: #666; margin-bottom: 4px;';
        exampleText.textContent = 'Mentioned by:';
        examplesDiv.appendChild(exampleText);
        
        idea.examples.forEach(example => {
          const mentionDiv = document.createElement('div');
          mentionDiv.style.cssText = 'font-size: 11px; color: #aaa; margin-left: 12px; margin-bottom: 2px;';
          mentionDiv.innerHTML = `• ${example.author} ${example.likes > 0 ? `(${example.likes} likes)` : ''}`;
          examplesDiv.appendChild(mentionDiv);
        });
        
        ideaDiv.appendChild(examplesDiv);
      }
      
      container.appendChild(ideaDiv);
    });
    
    return container;
  }

  formatCommentTopics() {
    const container = document.createElement('div');
    
    if (this.comments.length < 20) {
      const minCommentsDiv = document.createElement('div');
      minCommentsDiv.style.cssText = 'padding: 20px; background: #1a1a1a; border-radius: 6px; text-align: center;';
      minCommentsDiv.innerHTML = `
        <div style="color: #666; font-size: 14px;">
          <div style="font-size: 24px; margin-bottom: 10px;">🏷️</div>
          Topic grouping requires at least 20 comments.
          <div style="margin-top: 10px; font-size: 12px;">
            Currently analyzing ${this.comments.length} comments.
          </div>
        </div>
      `;
      container.appendChild(minCommentsDiv);
      return container;
    }
    
    if (this.insights.commentTopics.length === 0) {
      const noTopicsDiv = document.createElement('div');
      noTopicsDiv.style.cssText = 'padding: 20px; background: #1a1a1a; border-radius: 6px; text-align: center;';
      noTopicsDiv.innerHTML = `
        <div style="color: #666; font-size: 14px;">
          <div style="font-size: 24px; margin-bottom: 10px;">🤖</div>
          No distinct topics detected.
          <div style="margin-top: 10px; font-size: 12px;">
            Comments may be too diverse to group into themes.
          </div>
        </div>
      `;
      container.appendChild(noTopicsDiv);
      return container;
    }
    
    // Header note
    const noteDiv = document.createElement('div');
    noteDiv.style.cssText = 'margin-bottom: 12px; padding: 10px; background: #1a1a1a; border-radius: 4px; font-size: 12px; color: #888;';
    noteDiv.innerHTML = `
      <span style="color: #4CAF50;">🤖 AI-Grouped Topics</span> - Similar to YouTube's comment grouping
    `;
    container.appendChild(noteDiv);
    
    this.insights.commentTopics.forEach((topic) => {
      const topicDiv = document.createElement('div');
      topicDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #262626; border-radius: 6px; cursor: pointer; transition: all 0.2s;';
      
      // Make it expandable
      topicDiv.onmouseover = () => {
        topicDiv.style.background = '#2e2e2e';
      };
      topicDiv.onmouseout = () => {
        topicDiv.style.background = '#262626';
      };
      
      // Header with topic and metrics
      const headerDiv = document.createElement('div');
      headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
      headerDiv.innerHTML = `
        <span style="font-weight: bold; color: #fff; font-size: 14px;">${topic.topic}</span>
        <div style="font-size: 12px; color: #888;">
          <span style="color: #4CAF50;">${topic.count} comments</span>
          <span style="color: #666; margin-left: 8px;">(${topic.percentage}%)</span>
        </div>
      `;
      topicDiv.appendChild(headerDiv);
      
      // Progress bar
      const progressBar = document.createElement('div');
      progressBar.style.cssText = 'width: 100%; height: 4px; background: #333; border-radius: 2px; margin-bottom: 8px;';
      const progress = document.createElement('div');
      progress.style.cssText = `width: ${topic.percentage}%; height: 100%; background: #4CAF50; border-radius: 2px; transition: width 0.3s;`;
      progressBar.appendChild(progress);
      topicDiv.appendChild(progressBar);
      
      // Example comments (collapsed by default)
      if (topic.examples && topic.examples.length > 0) {
        const examplesDiv = document.createElement('div');
        examplesDiv.style.cssText = 'margin-top: 8px; font-size: 11px; color: #999;';
        examplesDiv.style.display = 'none'; // Hidden by default
        
        topic.examples.forEach(example => {
          const exDiv = document.createElement('div');
          exDiv.style.cssText = 'margin-bottom: 4px; padding-left: 12px; opacity: 0.8;';
          const shortText = example.text.length > 80 ? example.text.substring(0, 80) + '...' : example.text;
          exDiv.innerHTML = `• "${shortText}" - ${example.author}`;
          examplesDiv.appendChild(exDiv);
        });
        
        topicDiv.appendChild(examplesDiv);
        
        // Toggle examples on click
        let expanded = false;
        topicDiv.onclick = () => {
          expanded = !expanded;
          examplesDiv.style.display = expanded ? 'block' : 'none';
          topicDiv.style.background = expanded ? '#2e2e2e' : '#262626';
        };
        
        // Add expand indicator
        const expandIndicator = document.createElement('div');
        expandIndicator.style.cssText = 'text-align: center; font-size: 10px; color: #666; margin-top: 4px;';
        expandIndicator.textContent = 'Click to see examples ▼';
        topicDiv.appendChild(expandIndicator);
      }
      
      container.appendChild(topicDiv);
    });
    
    return container;
  }

  formatEngagedUsers() {
    const container = document.createElement('div');
    
    this.insights.topEngagedUsers.forEach((user, index) => {
      const userDiv = document.createElement('div');
      userDiv.style.cssText = 'margin-bottom: 8px; padding: 8px; background: #262626; border-radius: 4px;';
      userDiv.innerHTML = `
        <div style="font-weight: bold; color: #4CAF50;">
          ${index + 1}. ${user.author}
        </div>
        <div style="font-size: 12px; color: #ccc;">
          ${user.commentCount} comments | ${user.totalLikes} total likes
        </div>
      `;
      container.appendChild(userDiv);
    });
    
    return container;
  }

  formatBusinessOpportunities() {
    const container = document.createElement('div');
    
    if (this.insights.businessOpportunities.length === 0) {
      const noOppsDiv = document.createElement('div');
      noOppsDiv.style.cssText = 'padding: 20px; background: #1a1a1a; border-radius: 6px; text-align: center;';
      noOppsDiv.innerHTML = `
        <div style="color: #666; font-size: 14px;">
          <div style="font-size: 24px; margin-bottom: 10px;">💼</div>
          No specific business opportunities detected in the comments.
          <div style="margin-top: 10px; font-size: 12px;">
            Keep creating great content and opportunities will emerge!
          </div>
        </div>
      `;
      container.appendChild(noOppsDiv);
      return container;
    }
    
    this.insights.businessOpportunities.forEach((opp) => {
      const oppDiv = document.createElement('div');
      oppDiv.style.cssText = 'margin-bottom: 16px; padding: 16px; background: #262626; border-radius: 6px; border-left: 3px solid ' + 
        (opp.recommendation.priority === 'High' ? '#F44336' : 
         opp.recommendation.priority === 'Medium' ? '#FF9800' : '#FFC107');
      
      // Header with type and metrics
      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
      header.innerHTML = `
        <div>
          <span style="color: #FFC107; font-weight: bold; font-size: 16px;">${opp.type}</span>
          <span style="
            background: ${opp.recommendation.priority === 'High' ? '#F44336' : 
                         opp.recommendation.priority === 'Medium' ? '#FF9800' : '#FFC107'};
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            margin-left: 8px;
          ">${opp.recommendation.priority} Priority</span>
        </div>
        <div style="font-size: 12px; color: #888;">
          ${opp.count} mentions | ${opp.engagement} likes
        </div>
      `;
      oppDiv.appendChild(header);
      
      // Recommendation
      const recDiv = document.createElement('div');
      recDiv.style.cssText = 'margin-bottom: 12px;';
      recDiv.innerHTML = `
        <div style="color: #4CAF50; font-weight: bold; margin-bottom: 8px;">
          💡 ${opp.recommendation.action}
        </div>
        <div style="font-size: 13px; color: #ccc; line-height: 1.5; white-space: pre-wrap;">
          ${opp.recommendation.details}
        </div>
      `;
      oppDiv.appendChild(recDiv);
      
      // Example comments
      if (opp.examples && opp.examples.length > 0) {
        const examplesDiv = document.createElement('div');
        examplesDiv.style.cssText = 'margin-top: 12px; padding-top: 12px; border-top: 1px solid #333;';
        
        const exampleHeader = document.createElement('div');
        exampleHeader.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 8px;';
        exampleHeader.textContent = 'Example comments:';
        examplesDiv.appendChild(exampleHeader);
        
        opp.examples.forEach(ex => {
          const exDiv = document.createElement('div');
          exDiv.style.cssText = 'font-size: 11px; color: #999; margin-bottom: 4px; padding-left: 12px;';
          exDiv.innerHTML = `"${ex.comment.substring(0, 100)}${ex.comment.length > 100 ? '...' : ''}" - ${ex.author}`;
          examplesDiv.appendChild(exDiv);
        });
        
        oppDiv.appendChild(examplesDiv);
      }
      
      container.appendChild(oppDiv);
    });
    
    return container;
  }

  formatQuestions() {
    const container = document.createElement('div');
    
    if (this.insights.frequentQuestions.length === 0) {
      const noQuestionsDiv = document.createElement('div');
      noQuestionsDiv.style.cssText = 'padding: 20px; background: #1a1a1a; border-radius: 6px; text-align: center;';
      noQuestionsDiv.innerHTML = `
        <div style="color: #666; font-size: 14px;">
          <div style="font-size: 24px; margin-bottom: 10px;">❓</div>
          No direct questions to the creator found.
          <div style="margin-top: 10px; font-size: 12px;">
            Viewers may be engaging through statements rather than questions.
          </div>
        </div>
      `;
      container.appendChild(noQuestionsDiv);
      return container;
    }
    
    this.insights.frequentQuestions.forEach((q, index) => {
      const qDiv = document.createElement('div');
      qDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #262626; border-radius: 6px; border-left: 3px solid #2196F3;';
      
      // Category badge
      const categoryColors = {
        'Equipment/Tools': '#FF9800',
        'How-To/Process': '#4CAF50',
        'Schedule/Timing': '#9C27B0',
        'Motivation/Why': '#F44336',
        'Location/Where': '#00BCD4',
        'Collaboration': '#FFC107',
        'General': '#607D8B'
      };
      
      const categoryBadge = `
        <span style="
          background: ${categoryColors[q.category] || '#607D8B'};
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
          margin-left: 8px;
        ">${q.category}</span>
      `;
      
      qDiv.innerHTML = `
        <div style="margin-bottom: 6px;">
          <span style="color: #2196F3; font-weight: bold;">${index + 1}.</span>
          ${categoryBadge}
        </div>
        <div style="color: #fff; margin-bottom: 6px; line-height: 1.4;">
          "${q.question}"
        </div>
        <div style="font-size: 11px; color: #888;">
          Asked by ${q.author} ${q.likes > 0 ? `• ${q.likes} likes` : ''}
        </div>
      `;
      container.appendChild(qDiv);
    });
    
    // Add a note about answering questions
    const noteDiv = document.createElement('div');
    noteDiv.style.cssText = 'margin-top: 12px; padding: 10px; background: #1a1a1a; border-radius: 4px; font-size: 12px; color: #888;';
    noteDiv.innerHTML = `
      💡 <strong>Pro tip:</strong> Consider answering these in a Q&A video or pinned comment!
    `;
    container.appendChild(noteDiv);
    
    return container;
  }

  formatBestFeatures() {
    const container = document.createElement('div');
    
    if (this.insights.bestFeatures.length === 0) {
      const noFeaturesDiv = document.createElement('div');
      noFeaturesDiv.style.cssText = 'padding: 20px; background: #1a1a1a; border-radius: 6px; text-align: center;';
      noFeaturesDiv.innerHTML = `
        <div style="color: #666; font-size: 14px;">
          No specific features praised in comments yet.
        </div>
      `;
      container.appendChild(noFeaturesDiv);
      return container;
    }
    
    // Create tag container
    const tagContainer = document.createElement('div');
    tagContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';
    
    this.insights.bestFeatures.forEach((feature) => {
      const featureTag = document.createElement('div');
      featureTag.style.cssText = `
        display: inline-flex;
        align-items: center;
        background: rgba(129, 230, 217, 0.2);
        color: #81e6d9;
        padding: 6px 14px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 400;
        position: relative;
        cursor: help;
        transition: all 0.2s ease;
      `;
      
      featureTag.innerHTML = `
        <span style="margin-right: 5px; font-size: 12px;">⭐</span>
        ${feature.tag}
      `;
      
      // Add hover effect
      featureTag.onmouseover = () => {
        featureTag.style.background = 'rgba(129, 230, 217, 0.3)';
        featureTag.style.transform = 'translateY(-1px)';
      };
      featureTag.onmouseout = () => {
        featureTag.style.background = 'rgba(129, 230, 217, 0.2)';
        featureTag.style.transform = 'translateY(0)';
      };
      
      // Add tooltip with full comment on hover
      featureTag.title = `"${feature.originalText}" - ${feature.author}`;
      
      tagContainer.appendChild(featureTag);
    });
    
    container.appendChild(tagContainer);
    
    return container;
  }

  formatImprovements() {
    const container = document.createElement('div');
    
    if (this.insights.areasForImprovement.length === 0) {
      const noImprovementsDiv = document.createElement('div');
      noImprovementsDiv.style.cssText = 'padding: 20px; background: #1a1a1a; border-radius: 6px; text-align: center;';
      noImprovementsDiv.innerHTML = `
        <div style="color: #666; font-size: 14px;">
          No constructive criticism found. Keep up the great work!
        </div>
      `;
      container.appendChild(noImprovementsDiv);
      return container;
    }
    
    // Create tag container
    const tagContainer = document.createElement('div');
    tagContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';
    
    this.insights.areasForImprovement.forEach((improvement) => {
      const improvementTag = document.createElement('div');
      improvementTag.style.cssText = `
        display: inline-flex;
        align-items: center;
        background: rgba(251, 211, 141, 0.2);
        color: #fbd38d;
        padding: 6px 14px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 400;
        position: relative;
        cursor: help;
        transition: all 0.2s ease;
      `;
      
      improvementTag.innerHTML = `
        <span style="margin-right: 5px; font-size: 12px;">🔧</span>
        ${improvement.tag}
      `;
      
      // Add hover effect
      improvementTag.onmouseover = () => {
        improvementTag.style.background = 'rgba(251, 211, 141, 0.3)';
        improvementTag.style.transform = 'translateY(-1px)';
      };
      improvementTag.onmouseout = () => {
        improvementTag.style.background = 'rgba(251, 211, 141, 0.2)';
        improvementTag.style.transform = 'translateY(0)';
      };
      
      // Add tooltip with full comment on hover
      improvementTag.title = `"${improvement.originalText}" - ${improvement.author}`;
      
      tagContainer.appendChild(improvementTag);
    });
    
    container.appendChild(tagContainer);
    
    return container;
  }

  formatInterestingComments() {
    const container = document.createElement('div');
    
    if (this.insights.mostInterestingComments.length === 0) {
      const noCommentsDiv = document.createElement('div');
      noCommentsDiv.style.cssText = 'padding: 20px; background: #1a1a1a; border-radius: 6px; text-align: center;';
      noCommentsDiv.innerHTML = `
        <div style="color: #666; font-size: 14px;">
          No particularly interesting comments found yet.
        </div>
      `;
      container.appendChild(noCommentsDiv);
      return container;
    }
    
    this.insights.mostInterestingComments.forEach((comment, index) => {
      const commentDiv = document.createElement('div');
      commentDiv.style.cssText = 'margin-bottom: 15px; padding: 15px; background: #262626; border-radius: 8px; border-left: 3px solid #E91E63;';
      
      // Interest score badge
      const scoreBadge = `
        <span style="
          background: #E91E63;
          color: white;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          float: right;
        ">Interest Score: ${comment.interestScore}</span>
      `;
      
      commentDiv.innerHTML = `
        <div style="margin-bottom: 10px;">
          <span style="color: #E91E63; font-weight: bold;">${index + 1}.</span>
          <span style="color: #81e6d9; margin-left: 8px;">${comment.author}</span>
          ${scoreBadge}
        </div>
        <div style="color: #fff; font-size: 14px; line-height: 1.5; margin-bottom: 10px;">
          "${comment.text}"
        </div>
        <div style="font-size: 12px; color: #888;">
          <span style="color: #4CAF50;">👍 ${comment.likes} likes</span> | 
          <span style="color: #2196F3;">💬 ${comment.replies} replies</span> | 
          <span style="color: ${comment.sentiment === 'positive' ? '#4CAF50' : comment.sentiment === 'negative' ? '#F44336' : '#FFC107'};">
            ${comment.sentiment} sentiment
          </span>
        </div>
      `;
      container.appendChild(commentDiv);
    });
    
    return container;
  }

  formatWordCloud() {
    const container = document.createElement('div');
    
    // Filter out words that appear only once or twice for cleaner cloud
    const meaningfulWords = Object.entries(this.insights.wordFrequency)
      .filter(([, freq]) => freq > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40); // Top 40 most meaningful words
    
    if (meaningfulWords.length < 5) {
      const noWordsDiv = document.createElement('div');
      noWordsDiv.style.cssText = 'padding: 20px; background: #1a1a1a; border-radius: 6px; text-align: center;';
      noWordsDiv.innerHTML = `
        <div style="color: #666; font-size: 14px;">
          Not enough meaningful words to generate word cloud.
        </div>
      `;
      container.appendChild(noWordsDiv);
      return container;
    }
    
    // Create word cloud container with better spacing
    const cloudContainer = document.createElement('div');
    cloudContainer.style.cssText = `
      padding: 30px 20px;
      background: #1a1a1a;
      border-radius: 8px;
      text-align: center;
      min-height: 200px;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 12px;
    `;
    
    // Color palette for variety
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#96CEB4', // Green
      '#FECA57', // Yellow
      '#DDA0DD', // Plum
      '#98D8C8', // Mint
      '#F7DC6F', // Gold
      '#BB8FCE', // Purple
      '#85C1E2', // Sky blue
      '#F8B739', // Orange
      '#52D3D8', // Cyan
    ];
    
    // Calculate more dramatic font size differences
    const maxFreq = meaningfulWords[0][1];
    const minFreq = meaningfulWords[meaningfulWords.length - 1][1];
    
    // Shuffle words for more organic layout
    const shuffled = [...meaningfulWords].sort(() => Math.random() - 0.5);
    
    shuffled.forEach(([word, freq]) => {
      // More dramatic size scaling
      const normalizedFreq = (freq - minFreq) / (maxFreq - minFreq || 1);
      const fontSize = Math.floor(16 + normalizedFreq * 40); // 16px to 56px range
      
      // Pick color based on frequency tier
      const colorIndex = Math.floor((1 - normalizedFreq) * (colors.length - 1));
      const color = colors[colorIndex];
      
      const wordSpan = document.createElement('span');
      wordSpan.style.cssText = `
        display: inline-block;
        padding: 4px 12px;
        font-size: ${fontSize}px;
        color: ${color};
        font-weight: ${fontSize > 30 ? 'bold' : fontSize > 22 ? '600' : 'normal'};
        cursor: pointer;
        transition: all 0.3s ease;
        opacity: ${0.8 + normalizedFreq * 0.2};
        text-transform: ${fontSize > 35 ? 'uppercase' : 'none'};
        letter-spacing: ${fontSize > 35 ? '1px' : '0'};
        line-height: 1.2;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      wordSpan.textContent = word;
      wordSpan.title = `"${word}" appears ${freq} times`;
      
      // Add more interactive hover effect
      wordSpan.onmouseover = () => {
        wordSpan.style.transform = 'scale(1.2) rotate(-2deg)';
        wordSpan.style.opacity = '1';
        wordSpan.style.textShadow = '0 0 20px ' + color;
      };
      wordSpan.onmouseout = () => {
        wordSpan.style.transform = 'scale(1) rotate(0deg)';
        wordSpan.style.opacity = (0.8 + normalizedFreq * 0.2).toString();
        wordSpan.style.textShadow = 'none';
      };
      
      cloudContainer.appendChild(wordSpan);
    });
    
    container.appendChild(cloudContainer);
    
    // Add improved statistics
    const topWords = meaningfulWords.slice(0, 3);
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = 'margin-top: 15px; padding: 12px; background: #262626; border-radius: 6px; font-size: 13px; color: #aaa;';
    statsDiv.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong style="color: #fff;">📊 Key Topics:</strong> 
        ${topWords.map(([word, freq]) => `<span style="color: #81e6d9; font-weight: 600;">${word}</span> (${freq})`).join(', ')}
      </div>
      <div style="font-size: 12px; color: #888;">
        Analyzed ${Object.keys(this.insights.wordFrequency).length} unique words from ${this.comments.length} comments
      </div>
    `;
    container.appendChild(statsDiv);
    
    return container;
  }

  formatInappropriateUsers() {
    const container = document.createElement('div');
    
    if (!this.insights.topInappropriateUsers || this.insights.topInappropriateUsers.length === 0) {
      const noUsersDiv = document.createElement('div');
      noUsersDiv.style.cssText = 'padding: 20px; background: #262626; border-radius: 6px; text-align: center;';
      noUsersDiv.innerHTML = `
        <div style="color: #4CAF50; font-size: 14px;">
          ✅ No users with inappropriate comments detected! This is a healthy community.
        </div>
      `;
      container.appendChild(noUsersDiv);
      return container;
    }
    
    this.insights.topInappropriateUsers.forEach((user, index) => {
      const userDiv = document.createElement('div');
      userDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #262626; border-radius: 6px; border-left: 3px solid #F44336;';
      
      const categoryBadges = user.categories.map(cat => {
        const colors = {
          'toxic': '#F44336',
          'offensive': '#FF9800',
          'inappropriate': '#FFC107',
          'spam': '#9E9E9E'
        };
        return `<span style="background: ${colors[cat] || '#666'}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 4px;">${cat}</span>`;
      }).join('');
      
      userDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <span style="color: #F44336; font-weight: bold;">${index + 1}.</span>
            <span style="color: #ff7979; margin-left: 8px; font-weight: 600;">${user.username}</span>
          </div>
          <span style="background: #F44336; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
            ${user.count} violation${user.count > 1 ? 's' : ''}
          </span>
        </div>
        <div style="margin-bottom: 8px;">
          ${categoryBadges}
        </div>
        <div style="font-size: 12px; color: #888;">
          <details style="cursor: pointer;">
            <summary>View example comment</summary>
            <div style="margin-top: 8px; padding: 8px; background: #1a1a1a; border-radius: 4px; font-style: italic; color: #aaa;">
              "${user.comments[0].text.substring(0, 100)}${user.comments[0].text.length > 100 ? '...' : ''}"
            </div>
          </details>
        </div>
      `;
      container.appendChild(userDiv);
    });
    
    return container;
  }
  
  formatToxicityThermometer() {
    const container = document.createElement('div');
    
    // Calculate toxicity level
    const toxicityLevel = this.insights.overallToxicity;
    
    // Determine color and description based on toxicity level
    let color, description, emoji;
    if (toxicityLevel < 5) {
      color = '#4CAF50';
      description = 'Excellent community! Very minimal toxicity detected. The comment section is overwhelmingly positive and constructive.';
      emoji = '😊';
    } else if (toxicityLevel < 15) {
      color = '#8BC34A';
      description = 'Healthy community with occasional inappropriate comments. Most discussions remain respectful and on-topic.';
      emoji = '🙂';
    } else if (toxicityLevel < 30) {
      color = '#FFC107';
      description = 'Moderate toxicity levels. Some negative behavior present but manageable. Consider community guidelines reminders.';
      emoji = '😐';
    } else if (toxicityLevel < 50) {
      color = '#FF9800';
      description = 'High toxicity detected. Significant inappropriate content that may affect viewer experience. Active moderation recommended.';
      emoji = '😟';
    } else {
      color = '#F44336';
      description = 'Very high toxicity! The comment section contains substantial inappropriate content. Immediate moderation action advised.';
      emoji = '😡';
    }
    
    // Create thermometer visualization
    const thermometerContainer = document.createElement('div');
    thermometerContainer.style.cssText = 'display: flex; align-items: center; gap: 20px; margin-bottom: 20px;';
    
    // Thermometer bulb and tube
    const thermometer = document.createElement('div');
    thermometer.style.cssText = 'position: relative; width: 60px; height: 200px;';
    
    // Tube background
    const tube = document.createElement('div');
    tube.style.cssText = `
      position: absolute;
      top: 0;
      left: 20px;
      width: 20px;
      height: 170px;
      background: #333;
      border-radius: 10px 10px 0 0;
      border: 2px solid #555;
    `;
    
    // Mercury fill
    const mercury = document.createElement('div');
    mercury.style.cssText = `
      position: absolute;
      bottom: 30px;
      left: 22px;
      width: 16px;
      height: ${Math.min(140, toxicityLevel * 1.4)}px;
      background: linear-gradient(to top, ${color}, ${color}dd);
      border-radius: 8px 8px 0 0;
      transition: height 0.5s ease;
    `;
    
    // Bulb at bottom
    const bulb = document.createElement('div');
    bulb.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 10px;
      width: 40px;
      height: 40px;
      background: ${color};
      border-radius: 50%;
      border: 2px solid #555;
      box-shadow: 0 0 20px ${color}66;
    `;
    
    thermometer.appendChild(tube);
    thermometer.appendChild(mercury);
    thermometer.appendChild(bulb);
    
    // Scale markers
    const scale = document.createElement('div');
    scale.style.cssText = 'position: relative; height: 170px; display: flex; flex-direction: column; justify-content: space-between; margin-left: 10px;';
    
    const levels = [
      { value: 100, label: 'Toxic', color: '#F44336' },
      { value: 75, label: 'High', color: '#FF9800' },
      { value: 50, label: 'Moderate', color: '#FFC107' },
      { value: 25, label: 'Low', color: '#8BC34A' },
      { value: 0, label: 'Healthy', color: '#4CAF50' }
    ];
    
    levels.forEach(level => {
      const marker = document.createElement('div');
      marker.style.cssText = `
        display: flex;
        align-items: center;
        font-size: 11px;
        color: ${level.color};
      `;
      marker.innerHTML = `
        <span style="width: 10px; height: 2px; background: ${level.color}; margin-right: 5px;"></span>
        ${level.label}
      `;
      scale.appendChild(marker);
    });
    
    thermometerContainer.appendChild(thermometer);
    thermometerContainer.appendChild(scale);
    
    // Info section
    const infoSection = document.createElement('div');
    infoSection.style.cssText = 'flex: 1;';
    
    const levelDisplay = document.createElement('div');
    levelDisplay.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 10px;';
    levelDisplay.innerHTML = `
      <span style="font-size: 36px;">${emoji}</span>
      <div>
        <div style="font-size: 24px; font-weight: bold; color: ${color};">${toxicityLevel.toFixed(1)}%</div>
        <div style="font-size: 12px; color: #888;">Toxicity Level</div>
      </div>
    `;
    
    const descriptionDiv = document.createElement('div');
    descriptionDiv.style.cssText = 'margin-top: 15px; padding: 12px; background: #262626; border-radius: 6px; font-size: 13px; line-height: 1.6;';
    descriptionDiv.innerHTML = `<p style="margin: 0; color: #ccc;">${description}</p>`;
    
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: #1a1a1a; border-radius: 4px; font-size: 12px;';
    
    const totalToxic = Object.values(this.insights.toxicityLevels).reduce((sum, count) => sum + count, 0);
    const toxicityPercent = this.comments.length > 0 ? ((totalToxic / this.comments.length) * 100).toFixed(1) : 0;
    
    statsDiv.innerHTML = `
      <div style="color: #888; margin-bottom: 8px;">📊 Breakdown:</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
        <span style="color: #F44336;">🚫 Toxic: ${this.insights.toxicityLevels.toxic}</span>
        <span style="color: #FF9800;">⚠️ Offensive: ${this.insights.toxicityLevels.offensive}</span>
        <span style="color: #FFC107;">⚡ Inappropriate: ${this.insights.toxicityLevels.inappropriate}</span>
        <span style="color: #9E9E9E;">📧 Spam: ${this.insights.toxicityLevels.spam}</span>
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #333; color: #aaa;">
        ${toxicityPercent}% of comments contain inappropriate content
      </div>
    `;
    
    infoSection.appendChild(levelDisplay);
    infoSection.appendChild(descriptionDiv);
    infoSection.appendChild(statsDiv);
    
    container.appendChild(thermometerContainer);
    container.appendChild(infoSection);
    
    return container;
  }

  formatNarrativeSummary() {
    const container = document.createElement('div');
    
    if (!this.insights.narrativeSummary) {
      container.innerHTML = '<div style="color: #666;">No narrative summary available.</div>';
      return container;
    }
    
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = 'background: #2a2a2a; padding: 20px; border-radius: 8px; border-left: 4px solid #00d2ff;';
    
    // Format as a single paragraph with proper styling
    const summaryText = this.insights.narrativeSummary.replace(/\n/g, '<br>');
    summaryDiv.innerHTML = `
      <div style="color: #e8e8e8; line-height: 1.8; font-size: 14px;">
        ${summaryText}
      </div>
    `;
    
    container.appendChild(summaryDiv);
    
    return container;
  }
  
  formatGeneralSummary() {
    const container = document.createElement('div');
    
    if (!this.insights.generalSummary) {
      container.innerHTML = '<p style="color: #666;">No summary available.</p>';
      return container;
    }
    
    // Split the summary into individual lines for better formatting
    const summaryLines = this.insights.generalSummary.split('. ').map(line => {
      // Add the period back if it was removed by splitting
      return line.endsWith('.') ? line : line + '.';
    });
    
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = `
      padding: 15px;
      background: #262626;
      border-radius: 6px;
      line-height: 1.6;
      font-size: 14px;
      color: #ccc;
    `;
    
    // Create formatted summary with bullet points for better readability
    summaryDiv.innerHTML = summaryLines.map(line => 
      `<div style="margin-bottom: 8px; padding-left: 20px; position: relative;">
        <span style="position: absolute; left: 0; color: #81e6d9;">•</span>
        ${line.trim()}
      </div>`
    ).join('');
    
    container.appendChild(summaryDiv);
    
    // Add quick stats
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = `
      margin-top: 12px;
      padding: 10px;
      background: #1a1a1a;
      border-radius: 4px;
      font-size: 12px;
      color: #888;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    `;
    
    const totalComments = this.comments.length;
    const totalLikes = this.comments.reduce((sum, c) => sum + parseInt(c.likes || 0), 0);
    const totalReplies = this.comments.reduce((sum, c) => sum + parseInt(c.replies || 0), 0);
    
    statsDiv.innerHTML = `
      <span><strong style="color: #fff;">${totalComments}</strong> total comments</span>
      <span><strong style="color: #fff;">${totalLikes}</strong> total likes</span>
      <span><strong style="color: #fff;">${totalReplies}</strong> total replies</span>
      <span><strong style="color: #fff;">${this.insights.videoIdeas.length}</strong> video ideas</span>
      <span><strong style="color: #fff;">${this.insights.businessOpportunities.length}</strong> opportunities</span>
    `;
    
    container.appendChild(statsDiv);
    
    return container;
  }

  async emailInsights() {
    if (this.comments.length === 0 || !this.insights) {
      alert('No insights to email. Please analyze comments first.');
      return;
    }
    
    // Get email address
    const recipientEmail = prompt('Enter email address to send insights:', 'eimispacheco@gmail.com');
    if (!recipientEmail) return;
    
    // Show loading status
    this.updateStatus('Sending email...');
    
    const emailHTML = this.generateEmailHTML();
    const videoTitle = document.querySelector('#title h1')?.textContent || 'YouTube Video';
    // Clean the video title - remove newlines and extra spaces
    const cleanTitle = videoTitle.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    try {
      console.log('Content Script: Sending email to:', recipientEmail);
      
      // Send email via background script to avoid CORS
      chrome.runtime.sendMessage({
        action: 'sendEmail',
        to: recipientEmail,
        subject: `Vibelytics Insights Report - ${cleanTitle}`,
        html: emailHTML
      }, (response) => {
        console.log('Content Script: Received response:', response);
        
        if (chrome.runtime.lastError) {
          console.error('Content Script: Chrome runtime error:', chrome.runtime.lastError);
          alert(`❌ Extension error: ${chrome.runtime.lastError.message}`);
          this.updateStatus('Email error');
          return;
        }
        
        if (response && response.success) {
          alert(`✅ Email sent successfully to ${recipientEmail}!\n\nEmail ID: ${response.data?.id || 'Unknown'}`);
          this.updateStatus('Email sent successfully');
        } else {
          alert(`❌ Failed to send email: ${response?.error || 'Unknown error'}`);
          this.updateStatus('Email failed');
        }
      });
    } catch (error) {
      console.error('Content Script: Error in emailInsights:', error);
      alert(`❌ Error sending email: ${error.message}`);
      this.updateStatus('Email error');
    }
  }

  generateEmailHTML() {
    const videoTitle = document.querySelector('#title h1')?.textContent || 'YouTube Video';
    const channelName = document.querySelector('#owner #channel-name')?.textContent || 'Unknown Channel';
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vibelytics Insights Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #0f0f0f;
      color: white;
      margin: 0;
      padding: 0;
      font-size: 14px;
    }
    
    .email-container {
      background: #0f0f0f;
      min-height: 100vh;
      padding: 20px;
    }
    
    .panel {
      max-width: 800px;
      margin: 0 auto;
      background: #0f0f0f;
      border: 1px solid #303030;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    
    .header {
      padding: 20px 30px;
      border-bottom: 1px solid #303030;
      background: #0f0f0f;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .header h1 {
      color: #81e6d9;
      font-size: 24px;
      font-weight: 600;
      margin: 0;
    }
    
    .header .subtitle {
      color: #666;
      font-size: 12px;
      margin-top: 4px;
    }
    
    .content-container {
      padding: 20px 30px;
      background: #0f0f0f;
    }
    
    .video-info {
      background: #1a1a1a;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #ccc;
    }
    
    .video-info h3 {
      color: #fff;
      font-size: 16px;
      margin-bottom: 10px;
    }
    
    .video-info p {
      margin: 5px 0;
      color: #aaa;
    }
    
    .section {
      margin-bottom: 20px;
      padding: 15px;
      background: #1a1a1a;
      border-radius: 6px;
    }
    
    .section h2 {
      margin: 0 0 10px 0;
      color: #fff;
      font-size: 16px;
    }
    
    /* Sentiment Analysis Styling */
    .sentiment-container {
      background: #1a1a1a;
      border-radius: 6px;
      padding: 0;
    }
    
    .sentiment-bar {
      display: flex;
      height: 30px;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    
    .sentiment-positive {
      background: #4CAF50;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    
    .sentiment-neutral {
      background: #FFC107;
      color: black;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    
    .sentiment-negative {
      background: #F44336;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    
    .sentiment-legend {
      display: flex;
      justify-content: space-around;
      font-size: 12px;
      color: #aaa;
    }
    
    /* Comment Items Styling */
    .comment-item {
      margin-bottom: 10px;
      padding: 10px;
      background: #262626;
      border-radius: 4px;
      border-left: 3px solid #4CAF50;
      font-size: 12px;
    }
    
    .comment-item strong {
      color: #4CAF50;
      font-weight: 600;
    }
    
    .comment-item p {
      color: #ccc;
      margin: 5px 0;
      line-height: 1.4;
    }
    
    /* Tags Styling */
    .tag {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 12px;
      margin: 4px;
      font-weight: 500;
    }
    
    .tag-feature {
      background: rgba(129, 230, 217, 0.2);
      color: #81e6d9;
    }
    
    .tag-improvement {
      background: rgba(251, 211, 141, 0.2);
      color: #fbd38d;
    }
    
    /* Word Cloud Styling */
    .word-cloud-container {
      padding: 30px 20px;
      background: #1a1a1a;
      border-radius: 8px;
      text-align: center;
      min-height: 200px;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 12px;
    }
    
    .word-cloud-container span {
      display: inline-block;
      padding: 4px 12px;
      cursor: default;
      opacity: 0.9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    /* Stats Styling */
    .stats {
      margin-top: 15px;
      padding: 12px;
      background: #262626;
      border-radius: 6px;
      font-size: 13px;
      color: #aaa;
    }
    
    .stats strong {
      color: #fff;
    }
    
    /* Toxicity Thermometer Styling */
    .thermometer-container {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .thermometer {
      position: relative;
      width: 60px;
      height: 200px;
    }
    
    .thermometer-tube {
      position: absolute;
      top: 0;
      left: 20px;
      width: 20px;
      height: 170px;
      background: #333;
      border-radius: 10px 10px 0 0;
      border: 2px solid #555;
    }
    
    .thermometer-mercury {
      position: absolute;
      bottom: 30px;
      left: 22px;
      width: 16px;
      border-radius: 8px 8px 0 0;
    }
    
    .thermometer-bulb {
      position: absolute;
      bottom: 0;
      left: 10px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid #555;
    }
    
    .scale {
      height: 170px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      margin-left: 10px;
    }
    
    .scale-marker {
      display: flex;
      align-items: center;
      font-size: 11px;
    }
    
    .scale-line {
      width: 10px;
      height: 2px;
      margin-right: 5px;
    }
    
    .toxicity-info {
      flex: 1;
    }
    
    .toxicity-level {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    
    .toxicity-emoji {
      font-size: 36px;
    }
    
    .toxicity-score {
      font-size: 24px;
      font-weight: bold;
    }
    
    .toxicity-label {
      font-size: 12px;
      color: #888;
    }
    
    .toxicity-description {
      margin-top: 15px;
      padding: 12px;
      background: #262626;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.6;
      color: #ccc;
    }
    
    .toxicity-stats {
      margin-top: 10px;
      padding: 10px;
      background: #1a1a1a;
      border-radius: 4px;
      font-size: 12px;
    }
    
    .toxicity-breakdown {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      margin-top: 8px;
    }
    
    .toxicity-breakdown span {
      color: #aaa;
    }
    
    .toxicity-summary {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #333;
      color: #aaa;
    }
    
    /* Inappropriate Users Styling */
    .user-violation {
      margin-bottom: 12px;
      padding: 12px;
      background: #262626;
      border-radius: 6px;
      border-left: 3px solid #F44336;
    }
    
    .user-violation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .user-violation-name {
      color: #ff7979;
      font-weight: 600;
    }
    
    .violation-count {
      background: #F44336;
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
    
    .violation-categories {
      margin-bottom: 8px;
    }
    
    .violation-category {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      margin-right: 4px;
      color: white;
    }
    
    .violation-example {
      font-size: 12px;
      color: #888;
    }
    
    .violation-example-text {
      margin-top: 8px;
      padding: 8px;
      background: #1a1a1a;
      border-radius: 4px;
      font-style: italic;
      color: #aaa;
    }
    
    /* Video Ideas Styling */
    .idea-item {
      margin-bottom: 12px;
      padding: 12px;
      background: #262626;
      border-radius: 6px;
      border-left: 3px solid #4CAF50;
    }
    
    .idea-category {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      color: white;
      margin-bottom: 8px;
    }
    
    .idea-content {
      margin-bottom: 8px;
      line-height: 1.4;
    }
    
    .idea-stats {
      font-size: 12px;
      color: #888;
    }
    
    /* Business Opportunities Styling */
    .opportunity-recommendation {
      background: #262626;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    
    .opportunity-action {
      color: #81e6d9;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .opportunity-details {
      font-size: 12px;
      color: #ccc;
      line-height: 1.5;
      white-space: pre-line;
    }
    
    .opportunity-priority {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-top: 8px;
      font-weight: 600;
    }
    
    .priority-high {
      background: #F44336;
      color: white;
    }
    
    .priority-medium {
      background: #FF9800;
      color: white;
    }
    
    .priority-low {
      background: #4CAF50;
      color: white;
    }
    
    /* Footer */
    .footer {
      margin-top: 40px;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
      border-top: 1px solid #303030;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="panel">
      <div class="header">
        <div>
          <h1>📊 Vibelytics</h1>
          <div class="subtitle">Feel the vibe. Follow the insights.</div>
        </div>
      </div>
      
      <div class="content-container">
        <div class="video-info">
          <h3>${videoTitle}</h3>
          <p>Channel: ${channelName}</p>
          <p>Total Comments Analyzed: ${this.comments.length}</p>
          <p>Report Generated: ${new Date().toLocaleString()}</p>
        </div>
    
        ${this.generateEmailSection('Viewers Say', this.generateEmailNarrativeSummaryHTML())}
        ${this.generateEmailSection('Reviews General Summary', this.generateEmailGeneralSummaryHTML())}
        ${this.generateEmailSection('Audience Sentiment', this.generateEmailSentimentHTML())}
        ${this.generateEmailSection('Top 5 Influential Comments', this.generateEmailInfluentialHTML())}
        ${this.insights.videoIdeas.length > 0 ? this.generateEmailSection('Top 5 Video Ideas for Next Video', this.generateEmailVideoIdeasHTML()) : ''}
        ${this.generateEmailSection('Comment Topics (AI-Powered)', this.generateEmailTopicsHTML())}
        ${this.generateEmailSection('Top 5 Engaged Users', this.generateEmailEngagedUsersHTML())}
        ${this.generateEmailSection('Sales & Business Opportunities', this.generateEmailBusinessHTML())}
        ${this.generateEmailSection('Creator-Directed Questions', this.generateEmailQuestionsHTML())}
        ${this.generateEmailSection('Best Video Features', this.generateEmailFeaturesHTML())}
        ${this.generateEmailSection('Areas for Improvement', this.generateEmailImprovementsHTML())}
        ${this.generateEmailSection('Top 5 Most Interesting Comments', this.generateEmailInterestingHTML())}
        ${this.generateEmailSection('Comment Word Cloud', this.generateEmailWordCloudHTML())}
        ${this.insights.topInappropriateUsers && this.insights.topInappropriateUsers.length > 0 ? 
          this.generateEmailSection('Top 10 Users with Inappropriate Comments', this.generateEmailInappropriateUsersHTML()) : ''}
        ${this.generateEmailSection('Toxicity Thermometer', this.generateEmailToxicityHTML())}
        
        <!-- NEW ADVANCED FEATURES SECTIONS -->
        ${this.insights.timeBasedAnalysis.peakEngagementWindows.length > 0 || this.insights.timeBasedAnalysis.sentimentEvolution.length > 0 ? 
          this.generateEmailSection('📈 Time-Based Analysis', this.generateEmailTimeBasedHTML()) : ''}
        ${this.generateEmailSection('🚨 Troll Detection', this.generateEmailTrollDetectionHTML())}
        ${this.generateEmailSection('⭐ Engagement Quality Score', this.generateEmailEngagementQualityHTML())}
        ${this.insights.monetizationIntelligence.monetizationPotential > 0 ? 
          this.generateEmailSection('💰 Monetization Intelligence', this.generateEmailMonetizationHTML()) : ''}
        ${this.insights.seriesPlanner.seriesIdeas.length > 0 ? 
          this.generateEmailSection('🎬 Series Planner', this.generateEmailSeriesPlannerHTML()) : ''}
        ${this.insights.smartNotifications.urgentNotifications.length > 0 || this.insights.smartNotifications.generalNotifications.length > 0 ? 
          this.generateEmailSection('🔔 Smart Notifications', this.generateEmailSmartNotificationsHTML()) : ''}
        ${(this.insights.threadAnalysis.conversationThreads.length > 0 || 
           this.insights.threadAnalysis.discussionLeaders.length > 0) ? 
          this.generateEmailSection('🧵 Thread Analysis', this.generateEmailThreadAnalysisHTML()) : ''}
        ${this.insights.communityLeaders.influentialUsers.length > 0 ? 
          this.generateEmailSection('👑 Community Leaders', this.generateEmailCommunityLeadersHTML()) : ''}
        ${this.insights.contentFatigue.fatigueLevel > 0 ? 
          this.generateEmailSection('⚠️ Content Fatigue Warning', this.generateEmailContentFatigueHTML()) : ''}
        ${this.insights.controversialComments.debates.length > 0 ? 
          this.generateEmailSection('🔥 Controversial Comments', this.generateEmailControversialHTML()) : ''}
        
        <div class="footer">
          <p>Generated by Vibelytics - YouTube Comment Analytics</p>
          <p>Feel the vibe. Follow the insights.</p>
          
          <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); border-radius: 8px;">
            <h3 style="color: white; margin-bottom: 10px; font-size: 18px;">📱 Get Vibelytics Mobile App</h3>
            <p style="color: white; margin-bottom: 15px; opacity: 0.9; font-size: 14px;">
              Take your YouTube analytics anywhere. Track your channel's performance on the go!
            </p>
            <div style="text-align: center;">
              <a href="#" style="display: inline-block; margin: 0 10px; padding: 10px 20px; background: rgba(0,0,0,0.3); color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                📲 App Store
              </a>
              <a href="#" style="display: inline-block; margin: 0 10px; padding: 10px 20px; background: rgba(0,0,0,0.3); color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                🤖 Google Play
              </a>
            </div>
            <p style="color: white; margin-top: 15px; text-align: center; opacity: 0.8; font-size: 12px;">
              Coming soon! Be the first to know when we launch.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  generateEmailSection(title, content) {
    return `
    <div class="section">
      <h3 style="margin: 0 0 10px 0; color: #fff; font-size: 16px;">${title}</h3>
      ${content}
    </div>`;
  }

  generateEmailSentimentHTML() {
    const total = this.comments.length;
    const positive = ((this.insights.sentiment.positive / total) * 100).toFixed(1);
    const neutral = ((this.insights.sentiment.neutral / total) * 100).toFixed(1);
    const negative = ((this.insights.sentiment.negative / total) * 100).toFixed(1);
    
    return `
    <div class="sentiment-container">
      <div class="sentiment-bar">
        <div class="sentiment-positive" style="width: ${positive}%">${positive}%</div>
        <div class="sentiment-neutral" style="width: ${neutral}%">${neutral}%</div>
        <div class="sentiment-negative" style="width: ${negative}%">${negative}%</div>
      </div>
      <div class="sentiment-legend">
        <span><span style="color: #4CAF50;">●</span> Positive: ${this.insights.sentiment.positive}</span>
        <span><span style="color: #FFC107;">●</span> Neutral: ${this.insights.sentiment.neutral}</span>
        <span><span style="color: #F44336;">●</span> Negative: ${this.insights.sentiment.negative}</span>
      </div>
    </div>`;
  }

  generateEmailInfluentialHTML() {
    return this.insights.topInfluentialComments
      .map((comment, i) => `
        <div class="comment-item">
          <div style="font-weight: bold; color: #4CAF50; margin-bottom: 5px;">
            ${i + 1}. ${comment.author || 'Unknown'} (${comment.replies || 0} replies)
          </div>
          <div style="font-size: 12px; color: #ccc;">
            ${comment.text.substring(0, 100)}${comment.text.length > 100 ? '...' : ''}
          </div>
        </div>`)
      .join('');
  }

  generateEmailVideoIdeasHTML() {
    const categoryColors = {
      'tutorial': '#2196F3',
      'series': '#9C27B0',
      'topic': '#4CAF50',
      'comparison': '#FF9800',
      'reaction': '#F44336',
      'collaboration': '#00BCD4',
      'request': '#FFC107',
      'content_type': '#795548'
    };
    
    return this.insights.videoIdeas
      .map((idea, i) => `
        <div class="idea-item">
          <span class="idea-category" style="background: ${categoryColors[idea.category] || '#666'};">
            ${idea.category}
          </span>
          <div class="idea-content">
            <strong style="color: #4CAF50;">${i + 1}.</strong> ${idea.idea}
          </div>
          <div class="idea-stats">
            📈 ${idea.mentions || 1} mentions | 💬 ${idea.totalEngagement} engagement | 
            <span style="color: ${idea.sentiment === 'positive' ? '#4CAF50' : idea.sentiment === 'negative' ? '#F44336' : '#FFC107'};">
              ${idea.sentiment} sentiment
            </span>
          </div>
        </div>`)
      .join('');
  }

  generateEmailTopicsHTML() {
    if (this.insights.commentTopics.length === 0) {
      return '<p style="color: #666;">Not enough comments to generate topics (minimum 20 required)</p>';
    }
    return this.insights.commentTopics
      .map(topic => `
        <div class="comment-item">
          <strong>${topic.topic || topic.name || 'Unknown Topic'}</strong> (${topic.count} comments)
          ${topic.percentage ? `<span style="color: #666;"> - ${topic.percentage}%</span>` : ''}
          ${topic.exampleComments && topic.exampleComments.length > 0 ? 
            `<br><span style="font-size: 12px; color: #888;">Example: "${topic.exampleComments[0].text.substring(0, 100)}..."</span>` : ''}
        </div>`)
      .join('');
  }

  generateEmailEngagedUsersHTML() {
    return this.insights.topEngagedUsers
      .map((user, i) => `
        <div class="comment-item">
          <strong>${i + 1}. ${user.author}</strong>
          <br>Comments: ${user.commentCount} | Total Likes: ${user.totalLikes}
        </div>`)
      .join('');
  }

  generateEmailBusinessHTML() {
    if (this.insights.businessOpportunities.length === 0) {
      return '<p style="color: #666;">No specific business opportunities detected in comments.</p>';
    }
    
    return this.insights.businessOpportunities.map(opp => {
      const priorityClass = opp.recommendation?.priority?.toLowerCase() || 'low';
      return `
        <div class="opportunity-recommendation">
          <div class="opportunity-action">${opp.recommendation?.action || opp.type}</div>
          <div class="opportunity-details">${opp.recommendation?.details || opp.description}</div>
          <span class="opportunity-priority priority-${priorityClass}">
            ${opp.recommendation?.priority || 'Low'} Priority
          </span>
        </div>`;
    }).join('');
  }

  generateEmailQuestionsHTML() {
    if (this.insights.frequentQuestions.length === 0) {
      return '<p style="color: #666;">No creator-directed questions found.</p>';
    }
    return this.insights.frequentQuestions
      .map((q, i) => `
        <div class="comment-item">
          <strong>${i + 1}. ${q.question}</strong>
          <br>Category: ${q.category} | Asked by: ${q.author}
        </div>`)
      .join('');
  }

  generateEmailFeaturesHTML() {
    if (this.insights.bestFeatures.length === 0) {
      return '<p style="color: #666;">No specific features praised in comments yet.</p>';
    }
    return '<div style="display: flex; flex-wrap: wrap; gap: 8px;">' + 
      this.insights.bestFeatures
        .map(feature => `<span class="tag tag-feature">⭐ ${feature.tag}</span>`)
        .join('') + 
      '</div>';
  }

  generateEmailImprovementsHTML() {
    if (this.insights.areasForImprovement.length === 0) {
      return '<p style="color: #666;">No constructive criticism found.</p>';
    }
    return '<div style="display: flex; flex-wrap: wrap; gap: 8px;">' + 
      this.insights.areasForImprovement
        .map(imp => `<span class="tag tag-improvement">🔧 ${imp.tag}</span>`)
        .join('') + 
      '</div>';
  }

  generateEmailInterestingHTML() {
    if (this.insights.mostInterestingComments.length === 0) {
      return '<p style="color: #666;">No particularly interesting comments found.</p>';
    }
    return this.insights.mostInterestingComments
      .map((comment, i) => `
        <div style="margin-bottom: 12px; padding: 12px; background: #262626; border-radius: 6px; border-left: 3px solid #E91E63;">
          <div style="margin-bottom: 10px;">
            <span style="color: #E91E63; font-weight: bold;">${i + 1}.</span>
            <span style="color: #81e6d9; margin-left: 8px;">${comment.author}</span>
            <span style="background: #E91E63; color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; float: right;">
              Interest Score: ${comment.interestScore}
            </span>
          </div>
          <div style="color: #fff; font-size: 14px; line-height: 1.5; margin-bottom: 10px;">
            "${comment.text}"
          </div>
          <div style="font-size: 12px; color: #888;">
            <span style="color: #4CAF50;">👍 ${comment.likes} likes</span> | 
            <span style="color: #2196F3;">💬 ${comment.replies} replies</span> | 
            <span style="color: ${comment.sentiment === 'positive' ? '#4CAF50' : comment.sentiment === 'negative' ? '#F44336' : '#FFC107'};">
              ${comment.sentiment} sentiment
            </span>
          </div>
        </div>`)
      .join('');
  }

  generateEmailWordCloudHTML() {
    const topWords = Object.entries(this.insights.wordFrequency)
      .filter(([, freq]) => freq > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);
    
    if (topWords.length < 5) {
      const noWordsDiv = `
        <div style="padding: 20px; background: #1a1a1a; border-radius: 6px; text-align: center;">
          <div style="color: #666; font-size: 14px;">
            Not enough meaningful words to generate word cloud.
          </div>
        </div>`;
      return noWordsDiv;
    }
    
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#DDA0DD',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52D3D8'
    ];
    
    const maxFreq = topWords[0][1];
    const minFreq = topWords[topWords.length - 1][1];
    
    const shuffled = [...topWords].sort(() => Math.random() - 0.5);
    
    const wordHTML = shuffled.map(([word, freq]) => {
      const normalizedFreq = (freq - minFreq) / (maxFreq - minFreq || 1);
      const fontSize = Math.floor(16 + normalizedFreq * 40);
      const colorIndex = Math.floor((1 - normalizedFreq) * (colors.length - 1));
      const color = colors[colorIndex];
      
      return `<span style="
        font-size: ${fontSize}px;
        color: ${color};
        font-weight: ${fontSize > 30 ? 'bold' : fontSize > 22 ? '600' : 'normal'};
        opacity: ${0.8 + normalizedFreq * 0.2};
        text-transform: ${fontSize > 35 ? 'uppercase' : 'none'};
        letter-spacing: ${fontSize > 35 ? '1px' : '0'};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      " title="${word} appears ${freq} times">${word}</span>`;
    }).join(' ');
    
    return `
      <div class="word-cloud-container">${wordHTML}</div>
      <div class="stats">
        <div style="margin-bottom: 8px;">
          <strong style="color: #fff;">📊 Key Topics:</strong> 
          ${topWords.slice(0, 3).map(([word, freq]) => `<span style="color: #81e6d9; font-weight: 600;">${word}</span> (${freq})`).join(', ')}
        </div>
        <div style="font-size: 12px; color: #888;">
          Analyzed ${Object.keys(this.insights.wordFrequency).length} unique words from ${this.comments.length} comments
        </div>
      </div>`;
  }
  
  generateEmailNarrativeSummaryHTML() {
    if (!this.insights.narrativeSummary) {
      return '<div style="color: #888;">No narrative summary available.</div>';
    }
    
    const summaryText = this.insights.narrativeSummary.replace(/\n/g, '<br>');
    
    return `
      <div style="background: #2a2a2a; padding: 20px; border-radius: 8px; border-left: 4px solid #00d2ff;">
        <div style="color: #e8e8e8; line-height: 1.8; font-size: 14px;">
          ${summaryText}
        </div>
      </div>
    `;
  }
  
  generateEmailGeneralSummaryHTML() {
    if (!this.insights.generalSummary) {
      return '<p style="color: #666;">No summary available.</p>';
    }
    
    // Split the summary into individual lines for better formatting
    const summaryLines = this.insights.generalSummary.split('. ').map(line => {
      return line.endsWith('.') ? line : line + '.';
    });
    
    const summaryHTML = summaryLines.map(line => 
      `<div style="margin-bottom: 12px; padding-left: 20px; position: relative; line-height: 1.6;">
        <span style="position: absolute; left: 0; color: #81e6d9; font-weight: bold;">•</span>
        <span style="color: #ccc;">${line.trim()}</span>
      </div>`
    ).join('');
    
    const totalComments = this.comments.length;
    const totalLikes = this.comments.reduce((sum, c) => sum + parseInt(c.likes || 0), 0);
    const totalReplies = this.comments.reduce((sum, c) => sum + parseInt(c.replies || 0), 0);
    
    return `
      <div style="padding: 15px; background: #262626; border-radius: 6px;">
        ${summaryHTML}
      </div>
      <div style="margin-top: 12px; padding: 10px; background: #1a1a1a; border-radius: 4px; font-size: 12px; color: #888; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <span><strong style="color: #fff;">${totalComments}</strong> total comments</span>
        <span><strong style="color: #fff;">${totalLikes}</strong> total likes</span>
        <span><strong style="color: #fff;">${totalReplies}</strong> total replies</span>
        <span><strong style="color: #fff;">${this.insights.videoIdeas.length}</strong> video ideas</span>
        <span><strong style="color: #fff;">${this.insights.businessOpportunities.length}</strong> opportunities</span>
      </div>`;
  }
  
  generateEmailInappropriateUsersHTML() {
    if (!this.insights.topInappropriateUsers || this.insights.topInappropriateUsers.length === 0) {
      const noUsersDiv = `
        <div style="padding: 20px; background: #262626; border-radius: 6px; text-align: center;">
          <div style="color: #4CAF50; font-size: 14px;">
            ✅ No users with inappropriate comments detected! This is a healthy community.
          </div>
        </div>`;
      return noUsersDiv;
    }
    
    return this.insights.topInappropriateUsers
      .map((user, i) => {
        const categoryColors = {
          'toxic': '#F44336',
          'offensive': '#FF9800',
          'inappropriate': '#FFC107',
          'spam': '#9E9E9E'
        };
        
        const categoryBadges = user.categories.map(cat => 
          `<span class="violation-category" style="background: ${categoryColors[cat] || '#666'};">${cat}</span>`
        ).join('');
        
        return `
          <div class="user-violation">
            <div class="user-violation-header">
              <div>
                <span style="color: #F44336; font-weight: bold;">${i + 1}.</span>
                <span class="user-violation-name">${user.username}</span>
              </div>
              <span class="violation-count">
                ${user.count} violation${user.count > 1 ? 's' : ''}
              </span>
            </div>
            <div class="violation-categories">
              ${categoryBadges}
            </div>
            <div class="violation-example">
              <details style="cursor: pointer;">
                <summary>View example comment</summary>
                <div class="violation-example-text">
                  "${user.comments[0].text.substring(0, 100)}${user.comments[0].text.length > 100 ? '...' : ''}"
                </div>
              </details>
            </div>
          </div>`;
      })
      .join('');
  }
  
  generateEmailToxicityHTML() {
    const toxicityLevel = this.insights.overallToxicity;
    const totalToxic = Object.values(this.insights.toxicityLevels).reduce((sum, count) => sum + count, 0);
    const toxicityPercent = this.comments.length > 0 ? ((totalToxic / this.comments.length) * 100).toFixed(1) : 0;
    
    let color, description, emoji;
    if (toxicityLevel < 5) {
      color = '#4CAF50';
      description = 'Excellent community! Very minimal toxicity detected. The comment section is overwhelmingly positive and constructive.';
      emoji = '😊';
    } else if (toxicityLevel < 15) {
      color = '#8BC34A';
      description = 'Healthy community with occasional inappropriate comments. Most discussions remain respectful and on-topic.';
      emoji = '🙂';
    } else if (toxicityLevel < 30) {
      color = '#FFC107';
      description = 'Moderate toxicity levels. Some negative behavior present but manageable. Consider community guidelines reminders.';
      emoji = '😐';
    } else if (toxicityLevel < 50) {
      color = '#FF9800';
      description = 'High toxicity detected. Significant inappropriate content that may affect viewer experience. Active moderation recommended.';
      emoji = '😟';
    } else {
      color = '#F44336';
      description = 'Very high toxicity! The comment section contains substantial inappropriate content. Immediate moderation action advised.';
      emoji = '😡';
    }
    
    const levels = [
      { value: 100, label: 'Toxic', color: '#F44336' },
      { value: 75, label: 'High', color: '#FF9800' },
      { value: 50, label: 'Moderate', color: '#FFC107' },
      { value: 25, label: 'Low', color: '#8BC34A' },
      { value: 0, label: 'Healthy', color: '#4CAF50' }
    ];
    
    const scaleHTML = levels.map(level => `
      <div class="scale-marker" style="color: ${level.color};">
        <span class="scale-line" style="background: ${level.color};"></span>
        ${level.label}
      </div>
    `).join('');
    
    return `
      <div class="thermometer-container">
        <div class="thermometer">
          <div class="thermometer-tube"></div>
          <div class="thermometer-mercury" style="height: ${Math.min(140, toxicityLevel * 1.4)}px; background: linear-gradient(to top, ${color}, ${color}dd);"></div>
          <div class="thermometer-bulb" style="background: ${color}; box-shadow: 0 0 20px ${color}66;"></div>
        </div>
        <div class="scale">
          ${scaleHTML}
        </div>
        <div class="toxicity-info">
          <div class="toxicity-level">
            <span class="toxicity-emoji">${emoji}</span>
            <div>
              <div class="toxicity-score" style="color: ${color};">${toxicityLevel.toFixed(1)}%</div>
              <div class="toxicity-label">Toxicity Level</div>
            </div>
          </div>
          <div class="toxicity-description">
            <p style="margin: 0; color: #ccc;">${description}</p>
          </div>
          <div class="toxicity-stats">
            <div style="color: #888; margin-bottom: 8px;">📊 Breakdown:</div>
            <div class="toxicity-breakdown">
              <span style="color: #F44336;">🚫 Toxic: ${this.insights.toxicityLevels.toxic}</span>
              <span style="color: #FF9800;">⚠️ Offensive: ${this.insights.toxicityLevels.offensive}</span>
              <span style="color: #FFC107;">⚡ Inappropriate: ${this.insights.toxicityLevels.inappropriate}</span>
              <span style="color: #9E9E9E;">📧 Spam: ${this.insights.toxicityLevels.spam}</span>
            </div>
            <div class="toxicity-summary">
              ${toxicityPercent}% of comments contain inappropriate content
            </div>
          </div>
        </div>
      </div>`;
  }

  // FORMATTING FUNCTIONS FOR NEW ADVANCED FEATURES

  formatTimeBasedAnalysis() {
    const analysis = this.insights.timeBasedAnalysis;
    const container = document.createElement('div');
    container.className = 'time-analysis-container';
    
    // Peak Engagement Windows
    if (analysis.peakEngagementWindows.length > 0) {
      const peakSection = document.createElement('div');
      peakSection.className = 'time-section';
      
      const peakTitle = document.createElement('h4');
      peakTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      peakTitle.textContent = '🕐 Peak Engagement Windows';
      peakSection.appendChild(peakTitle);
      
      analysis.peakEngagementWindows.forEach(window => {
        const windowDiv = document.createElement('div');
        windowDiv.style.cssText = 'background: #252525; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #00d2ff;';
        
        const sentimentIcon = window.dominantSentiment === 'positive' ? '📈' : 
                             window.dominantSentiment === 'negative' ? '📉' : '➡️';
        const sentimentText = window.dominantSentiment ? 
          window.dominantSentiment.charAt(0).toUpperCase() + window.dominantSentiment.slice(1) : 'Neutral';
        
        windowDiv.innerHTML = `
          <strong>${window.timeWindow}</strong> - ${window.avgEngagement} avg interactions per comment
          <div style="color: #aaa; font-size: 12px;">
            ${window.commentCount} comments • Average Sentiment: ${sentimentIcon} ${sentimentText}
          </div>
        `;
        peakSection.appendChild(windowDiv);
      });
      
      container.appendChild(peakSection);
    }
    
    // Sentiment Evolution
    if (analysis.sentimentEvolution.length > 0) {
      const sentimentSection = document.createElement('div');
      sentimentSection.className = 'time-section';
      sentimentSection.style.cssText = 'margin-top: 15px;';
      
      const sentimentTitle = document.createElement('h4');
      sentimentTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      sentimentTitle.textContent = '📊 Sentiment Evolution Over Time';
      sentimentSection.appendChild(sentimentTitle);
      
      // Add explanation of periods
      const explanationDiv = document.createElement('div');
      explanationDiv.style.cssText = 'color: #888; font-size: 12px; margin-bottom: 10px; font-style: italic;';
      const totalComments = analysis.sentimentEvolution.reduce((sum, point) => sum + (point.total || 0), 0);
      explanationDiv.textContent = `${totalComments} comments grouped by time periods`;
      sentimentSection.appendChild(explanationDiv);
      
      // Create line graph
      const graphContainer = document.createElement('div');
      graphContainer.style.cssText = 'background: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 15px; position: relative; height: 200px;';
      
      // Create SVG for the line graph
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.cssText = 'width: 100%; height: 100%;';
      svg.setAttribute('viewBox', '0 0 400 150');
      
      // Calculate graph points
      const maxPercent = 100;
      const graphWidth = 380;
      const graphHeight = 130;
      const xStep = graphWidth / (analysis.sentimentEvolution.length - 1 || 1);
      
      // Create lines for each sentiment type
      const createPath = (data, color) => {
        const points = data.map((value, index) => ({
          x: 10 + index * xStep,
          y: 140 - (value / maxPercent) * graphHeight
        }));
        
        const pathData = points.map((point, index) => 
          `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
        ).join(' ');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '2');
        
        // Add dots at data points
        points.forEach(point => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', point.x);
          circle.setAttribute('cy', point.y);
          circle.setAttribute('r', '4');
          circle.setAttribute('fill', color);
          svg.appendChild(circle);
        });
        
        return path;
      };
      
      // Add grid lines
      for (let i = 0; i <= 4; i++) {
        const y = 10 + (i * graphHeight / 4);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '10');
        line.setAttribute('x2', '390');
        line.setAttribute('y1', y);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', '#333');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '2,2');
        svg.appendChild(line);
        
        // Add percentage labels
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '5');
        text.setAttribute('y', y + 5);
        text.setAttribute('fill', '#666');
        text.setAttribute('font-size', '10');
        text.setAttribute('text-anchor', 'end');
        text.textContent = `${100 - (i * 25)}%`;
        svg.appendChild(text);
      }
      
      // Add period labels
      analysis.sentimentEvolution.forEach((point, index) => {
        const x = 10 + index * xStep;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', '148');
        text.setAttribute('fill', '#666');
        text.setAttribute('font-size', '9');
        text.setAttribute('text-anchor', 'middle');
        
        // Shorten period names for graph
        let shortLabel = point.time;
        if (point.time.includes('24 hours')) shortLabel = '24h';
        else if (point.time === 'Last week') shortLabel = '1w';
        else if (point.time === 'Last month') shortLabel = '1m';
        else if (point.time === '2-7 days ago') shortLabel = '2-7d';
        else if (point.time === '1-2 months ago') shortLabel = '1-2m';
        else if (point.time === '2-3 months ago') shortLabel = '2-3m';
        else if (point.time === '1-3 months ago') shortLabel = '1-3m';
        else if (point.time === '3-6 months ago') shortLabel = '3-6m';
        else if (point.time.includes('Older')) shortLabel = 'Older';
        else shortLabel = point.time.substring(0, 5);
        
        text.textContent = shortLabel;
        svg.appendChild(text);
      });
      
      // Draw the lines
      const positiveData = analysis.sentimentEvolution.map(p => p.positivePercent || 0);
      const neutralData = analysis.sentimentEvolution.map(p => p.neutralPercent || 0);
      const negativeData = analysis.sentimentEvolution.map(p => p.negativePercent || 0);
      
      svg.appendChild(createPath(positiveData, '#4CAF50'));
      svg.appendChild(createPath(neutralData, '#9E9E9E'));
      svg.appendChild(createPath(negativeData, '#F44336'));
      
      graphContainer.appendChild(svg);
      
      // Add legend
      const legendDiv = document.createElement('div');
      legendDiv.style.cssText = 'display: flex; justify-content: center; gap: 20px; margin-top: 10px;';
      legendDiv.innerHTML = `
        <span style="display: flex; align-items: center; gap: 5px;">
          <span style="width: 12px; height: 12px; background: #4CAF50; border-radius: 50%;"></span>
          <span style="color: #aaa; font-size: 11px;">Positive</span>
        </span>
        <span style="display: flex; align-items: center; gap: 5px;">
          <span style="width: 12px; height: 12px; background: #9E9E9E; border-radius: 50%;"></span>
          <span style="color: #aaa; font-size: 11px;">Neutral</span>
        </span>
        <span style="display: flex; align-items: center; gap: 5px;">
          <span style="width: 12px; height: 12px; background: #F44336; border-radius: 50%;"></span>
          <span style="color: #aaa; font-size: 11px;">Negative</span>
        </span>
      `;
      graphContainer.appendChild(legendDiv);
      
      sentimentSection.appendChild(graphContainer);
      
      // Add detailed period breakdown
      const detailsTitle = document.createElement('h5');
      detailsTitle.style.cssText = 'color: #00d2ff; margin: 15px 0 10px 0; font-size: 13px;';
      detailsTitle.textContent = 'Period Details:';
      sentimentSection.appendChild(detailsTitle);
      
      analysis.sentimentEvolution.forEach((point, index) => {
        // Determine sentiment based on percentages
        let dominantSentiment = 'Neutral';
        let sentimentColor = '#9E9E9E';
        if (point.positivePercent > point.negativePercent && point.positivePercent > point.neutralPercent) {
          dominantSentiment = 'Positive';
          sentimentColor = '#4CAF50';
        } else if (point.negativePercent > point.positivePercent && point.negativePercent > point.neutralPercent) {
          dominantSentiment = 'Negative';
          sentimentColor = '#F44336';
        }
        
        // Determine trend by comparing with previous point
        let trendIcon = '➡️';
        if (index > 0) {
          const prevPoint = analysis.sentimentEvolution[index - 1];
          if (point.positivePercent > prevPoint.positivePercent) {
            trendIcon = '📈';
          } else if (point.positivePercent < prevPoint.positivePercent) {
            trendIcon = '📉';
          }
        }
        
        const pointDiv = document.createElement('div');
        pointDiv.style.cssText = 'background: #252525; padding: 10px; margin: 5px 0; border-radius: 4px;';
        
        let periodInfo = `<strong>${point.time}</strong>`;
        
        pointDiv.innerHTML = `
          ${trendIcon} ${periodInfo}: <span style="color: ${sentimentColor};">${dominantSentiment}</span>
          <div style="color: #888; font-size: 12px; margin-top: 4px;">
            ${point.total || 0} comments - ${point.positivePercent || 0}% positive, ${point.neutralPercent || 0}% neutral, ${point.negativePercent || 0}% negative
          </div>
        `;
        sentimentSection.appendChild(pointDiv);
      });
      
      container.appendChild(sentimentSection);
    }
    
    return container;
  }

  formatTrollDetection() {
    const detection = this.insights.trollDetection;
    const container = document.createElement('div');
    container.className = 'troll-detection-container';
    
    // Check if there are no trolls found
    if (detection.suspiciousBehaviors.length === 0 && detection.repeatOffenders.length === 0) {
      const noTrollsDiv = document.createElement('div');
      noTrollsDiv.style.cssText = 'text-align: center; padding: 20px; background: #252525; border-radius: 8px;';
      noTrollsDiv.innerHTML = `
        <div style="color: #4CAF50; font-size: 18px; margin-bottom: 10px;">✅ No Trolls Found</div>
        <div style="color: #ccc;">Great news! No suspicious troll behaviors or repeat offenders detected in the comments.</div>
      `;
      container.appendChild(noTrollsDiv);
      return container;
    }
    
    // Suspicious Behaviors
    if (detection.suspiciousBehaviors.length > 0) {
      const behaviorSection = document.createElement('div');
      behaviorSection.className = 'troll-section';
      
      const behaviorTitle = document.createElement('h4');
      behaviorTitle.style.cssText = 'color: #ff6b6b; margin: 0 0 10px 0;';
      behaviorTitle.textContent = '⚠️ Suspicious Behaviors Detected';
      behaviorSection.appendChild(behaviorTitle);
      
      detection.suspiciousBehaviors.forEach(behavior => {
        const behaviorDiv = document.createElement('div');
        const riskLevel = behavior.severity === 'high' ? 'High' : behavior.severity === 'medium' ? 'Medium' : 'Low';
        const riskColor = riskLevel === 'High' ? '#ff4757' : riskLevel === 'Medium' ? '#ffa502' : '#ff6348';
        
        behaviorDiv.style.cssText = `background: #252525; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid ${riskColor};`;
        
        const shortComment = behavior.comment.length > 100 ? 
          behavior.comment.substring(0, 100) + '...' : behavior.comment;
        
        behaviorDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: #00d2ff;">@${behavior.author}</strong>
            <span style="color: ${riskColor}; font-weight: bold;">Risk: ${riskLevel}</span>
          </div>
          <div style="color: #ddd; margin: 5px 0; font-style: italic;">"${shortComment}"</div>
          <div style="color: #ffa500; font-size: 12px;">
            Troll indicators: ${behavior.indicators.join(', ').replace(/_/g, ' ')}
          </div>
        `;
        behaviorSection.appendChild(behaviorDiv);
      });
      
      container.appendChild(behaviorSection);
    }
    
    // Repeat Offenders
    if (detection.repeatOffenders.length > 0) {
      const offendersSection = document.createElement('div');
      offendersSection.className = 'troll-section';
      offendersSection.style.cssText = 'margin-top: 15px;';
      
      const offendersTitle = document.createElement('h4');
      offendersTitle.style.cssText = 'color: #ff6b6b; margin: 0 0 10px 0;';
      offendersTitle.textContent = '🚨 Repeat Offenders';
      offendersSection.appendChild(offendersTitle);
      
      detection.repeatOffenders.forEach(offender => {
        const offenderDiv = document.createElement('div');
        offenderDiv.style.cssText = 'background: #252525; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #ff4757;';
        offenderDiv.innerHTML = `
          <strong>@${offender.username}</strong> - ${offender.offenseCount} violations
          <div style="color: #888; font-size: 12px;">Types: ${(offender.offenseTypes || []).join(', ')}</div>
        `;
        offendersSection.appendChild(offenderDiv);
      });
      
      container.appendChild(offendersSection);
    }
    
    return container;
  }

  formatEngagementQuality() {
    const quality = this.insights.engagementQuality;
    const container = document.createElement('div');
    container.className = 'engagement-quality-container';
    
    // Determine quality level and color
    let qualityLevel, color, description;
    if (quality.overallScore >= 80) {
      qualityLevel = 'Excellent';
      color = '#4CAF50';
      description = 'Outstanding engagement! Your audience is highly invested and interactive.';
    } else if (quality.overallScore >= 60) {
      qualityLevel = 'Good';
      color = '#8BC34A';
      description = 'Good engagement quality with room for improvement.';
    } else if (quality.overallScore >= 40) {
      qualityLevel = 'Average';
      color = '#FFC107';
      description = 'Average engagement. Consider strategies to boost meaningful interactions.';
    } else {
      qualityLevel = 'Needs Improvement';
      color = '#FF9800';
      description = 'Low engagement quality. Focus on creating more interactive content.';
    }
    
    // Score display
    const scoreDiv = document.createElement('div');
    scoreDiv.style.cssText = 'text-align: center; margin-bottom: 15px;';
    
    const scoreCircle = document.createElement('div');
    scoreCircle.style.cssText = `display: inline-block; width: 100px; height: 100px; border: 3px solid ${color}; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1a1a1a;`;
    
    const scoreNumber = document.createElement('span');
    scoreNumber.style.cssText = `color: ${color}; font-size: 28px; font-weight: bold;`;
    scoreNumber.textContent = quality.overallScore;
    
    const scoreLabel = document.createElement('span');
    scoreLabel.style.cssText = 'color: #888; font-size: 12px;';
    scoreLabel.textContent = 'Quality Score';
    
    scoreCircle.appendChild(scoreNumber);
    scoreCircle.appendChild(scoreLabel);
    scoreDiv.appendChild(scoreCircle);
    
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'text-align: center; margin-top: 10px;';
    
    const levelDiv = document.createElement('div');
    levelDiv.style.cssText = `color: ${color}; font-weight: bold; margin-bottom: 5px;`;
    levelDiv.textContent = qualityLevel;
    
    const descDiv = document.createElement('div');
    descDiv.style.cssText = 'color: #ccc; font-size: 14px;';
    descDiv.textContent = description;
    
    infoDiv.appendChild(levelDiv);
    infoDiv.appendChild(descDiv);
    scoreDiv.appendChild(infoDiv);
    
    container.appendChild(scoreDiv);
    
    // Metrics
    const metricsDiv = document.createElement('div');
    metricsDiv.style.cssText = 'background: #252525; padding: 15px; border-radius: 8px;';
    
    const metrics = [
      { label: '💬 Meaningful Comments:', value: quality.meaningfulComments + '%' },
      { label: '🔄 Thread Participation:', value: quality.threadParticipation + '%' },
      { label: '❓ Questions Asked:', value: quality.questionsAsked },
      { label: '🎯 Topic Relevance:', value: quality.topicRelevance + '%' }
    ];
    
    metrics.forEach(metric => {
      const metricDiv = document.createElement('div');
      metricDiv.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 10px;';
      metricDiv.innerHTML = `<span>${metric.label}</span><span style="color: #00d2ff;">${metric.value}</span>`;
      metricsDiv.appendChild(metricDiv);
    });
    
    container.appendChild(metricsDiv);
    
    return container;
  }

  formatMonetizationIntelligence() {
    const monetization = this.insights.monetizationIntelligence;
    const container = document.createElement('div');
    container.className = 'monetization-container';
    
    // Determine potential level
    let potentialLevel, color;
    if (monetization.monetizationPotential >= 80) {
      potentialLevel = 'Very High';
      color = '#4CAF50';
    } else if (monetization.monetizationPotential >= 60) {
      potentialLevel = 'High';
      color = '#8BC34A';
    } else if (monetization.monetizationPotential >= 40) {
      potentialLevel = 'Moderate';
      color = '#FFC107';
    } else {
      potentialLevel = 'Low';
      color = '#FF9800';
    }
    
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'text-align: center; margin-bottom: 15px; padding: 15px; background: #252525; border-radius: 8px;';
    
    const scoreDiv = document.createElement('div');
    scoreDiv.style.cssText = `color: ${color}; font-size: 18px; font-weight: bold;`;
    scoreDiv.textContent = `${monetization.monetizationPotential}% ${potentialLevel} Potential`;
    headerDiv.appendChild(scoreDiv);
    container.appendChild(headerDiv);
    
    // Revenue Opportunities
    if (monetization.revenueOpportunities.length > 0) {
      const revenueSection = document.createElement('div');
      revenueSection.className = 'revenue-section';
      revenueSection.style.cssText = 'margin-bottom: 15px;';
      
      const revenueTitle = document.createElement('h4');
      revenueTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      revenueTitle.textContent = '💰 Revenue Opportunities';
      revenueSection.appendChild(revenueTitle);
      
      monetization.revenueOpportunities.forEach(opportunity => {
        const oppDiv = document.createElement('div');
        const priorityColor = opportunity.priority === 'High' ? '#ff6b6b' : opportunity.priority === 'Medium' ? '#ffa502' : '#74b9ff';
        oppDiv.style.cssText = `background: #252525; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid ${priorityColor};`;
        oppDiv.innerHTML = `
          <strong>${opportunity.type}</strong> - <span style="color: ${priorityColor};">${opportunity.priority} Priority</span>
          <div style="color: #ccc; margin: 5px 0;">${opportunity.description}</div>
          <div style="color: #888; font-size: 12px;">Potential: ${opportunity.potential}</div>
        `;
        revenueSection.appendChild(oppDiv);
      });
      
      container.appendChild(revenueSection);
    }
    
    // Audience Value
    if (monetization.audienceValue.length > 0) {
      const valueSection = document.createElement('div');
      valueSection.className = 'value-section';
      
      const valueTitle = document.createElement('h4');
      valueTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      valueTitle.textContent = '👥 Audience Value Indicators';
      valueSection.appendChild(valueTitle);
      
      monetization.audienceValue.forEach(indicator => {
        const indicatorDiv = document.createElement('div');
        indicatorDiv.style.cssText = 'background: #252525; padding: 8px; margin: 3px 0; border-radius: 4px; display: flex; justify-content: space-between;';
        
        // Make monetization interest clickable to show details
        if (indicator.type === 'Monetization Interest') {
          indicatorDiv.style.cssText += ' cursor: pointer; transition: all 0.2s;';
          indicatorDiv.onmouseover = () => { indicatorDiv.style.background = '#2a2a2a'; };
          indicatorDiv.onmouseout = () => { indicatorDiv.style.background = '#252525'; };
          
          indicatorDiv.innerHTML = `
            <span>${indicator.type}:</span>
            <span style="color: #00d2ff;">${indicator.value} <span style="font-size: 10px;">▼</span></span>
          `;
          
          // Add click handler to show/hide details
          indicatorDiv.onclick = () => {
            const detailsId = 'monetization-details';
            let detailsDiv = document.getElementById(detailsId);
            
            if (detailsDiv) {
              detailsDiv.remove();
            } else {
              detailsDiv = document.createElement('div');
              detailsDiv.id = detailsId;
              detailsDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: #1a1a1a; border-radius: 6px; border-left: 3px solid #00d2ff;';
              
              // Collect all monetization comments
              const allMonetizationComments = [
                ...monetization.productMentions.map(c => ({ ...c, category: 'Product/Gear Inquiry' })),
                ...monetization.brandOpportunities.map(c => ({ ...c, category: 'Brand/Sponsorship Interest' })),
                ...monetization.merchandiseDemand.map(c => ({ ...c, category: 'Merchandise Request' })),
                ...monetization.courseInterest.map(c => ({ ...c, category: 'Course/Tutorial Interest' }))
              ];
              
              if (allMonetizationComments.length === 0) {
                detailsDiv.innerHTML = '<p style="color: #888; font-style: italic;">No monetization-related comments found.</p>';
              } else {
                const detailsTitle = document.createElement('h5');
                detailsTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0; font-size: 13px;';
                detailsTitle.textContent = '💬 Monetization-Related Comments:';
                detailsDiv.appendChild(detailsTitle);
                
                allMonetizationComments.forEach(comment => {
                  const commentDiv = document.createElement('div');
                  commentDiv.style.cssText = 'background: #252525; padding: 10px; margin: 8px 0; border-radius: 4px;';
                  
                  const categoryColor = {
                    'Product/Gear Inquiry': '#4CAF50',
                    'Brand/Sponsorship Interest': '#FF9800',
                    'Merchandise Request': '#E91E63',
                    'Course/Tutorial Interest': '#9C27B0'
                  }[comment.category] || '#00d2ff';
                  
                  commentDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                      <span style="color: ${categoryColor}; font-size: 11px; font-weight: bold;">${comment.category}</span>
                      <span style="color: #666; font-size: 11px;">@${comment.author}</span>
                    </div>
                    <div style="color: #ddd; font-size: 12px; line-height: 1.4;">${comment.text}</div>
                    ${comment.engagement ? `<div style="color: #666; font-size: 11px; margin-top: 5px;">👍 ${comment.engagement} likes</div>` : ''}
                  `;
                  detailsDiv.appendChild(commentDiv);
                });
              }
              
              indicatorDiv.parentNode.insertBefore(detailsDiv, indicatorDiv.nextSibling);
            }
          };
        } else {
          indicatorDiv.innerHTML = `
            <span>${indicator.type}:</span>
            <span style="color: #00d2ff;">${indicator.value}</span>
          `;
        }
        
        valueSection.appendChild(indicatorDiv);
      });
      
      container.appendChild(valueSection);
    }
    
    return container;
  }

  formatSeriesPlanner() {
    const series = this.insights.seriesPlanner;
    const container = document.createElement('div');
    container.className = 'series-planner-container';
    
    if (series.seriesIdeas.length > 0) {
      const ideasSection = document.createElement('div');
      ideasSection.className = 'series-section';
      
      const ideasTitle = document.createElement('h4');
      ideasTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      ideasTitle.textContent = '🎬 Series Ideas';
      ideasSection.appendChild(ideasTitle);
      
      series.seriesIdeas.forEach(idea => {
        const ideaDiv = document.createElement('div');
        ideaDiv.style.cssText = 'background: #252525; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #00d2ff;';
        ideaDiv.innerHTML = `
          <strong>${idea.title}</strong> - ${idea.episodes} episodes
          <div style="color: #ccc; margin: 5px 0;">${idea.description}</div>
          <div style="color: #888; font-size: 12px;">Expected Engagement: ${idea.expectedEngagement}</div>
        `;
        ideasSection.appendChild(ideaDiv);
      });
      
      container.appendChild(ideasSection);
    }
    
    if (series.continuationSuggestions.length > 0) {
      const contSection = document.createElement('div');
      contSection.className = 'continuation-section';
      contSection.style.cssText = 'margin-top: 15px;';
      
      const contTitle = document.createElement('h4');
      contTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      contTitle.textContent = '➡️ Continuation Suggestions';
      contSection.appendChild(contTitle);
      
      series.continuationSuggestions.forEach(suggestion => {
        const suggDiv = document.createElement('div');
        suggDiv.style.cssText = 'background: #252525; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #74b9ff;';
        suggDiv.innerHTML = `
          <strong>${suggestion.topic}</strong>
          <div style="color: #888; font-size: 12px;">${suggestion.reason}</div>
        `;
        contSection.appendChild(suggDiv);
      });
      
      container.appendChild(contSection);
    }
    
    return container;
  }

  formatSmartNotifications() {
    const notifications = this.insights.smartNotifications;
    const container = document.createElement('div');
    container.className = 'notifications-container';
    
    // Urgent Notifications
    if (notifications.urgentNotifications.length > 0) {
      const urgentSection = document.createElement('div');
      urgentSection.className = 'urgent-section';
      
      const urgentTitle = document.createElement('h4');
      urgentTitle.style.cssText = 'color: #ff6b6b; margin: 0 0 10px 0;';
      urgentTitle.textContent = '🚨 Urgent Notifications';
      urgentSection.appendChild(urgentTitle);
      
      notifications.urgentNotifications.forEach(notification => {
        const notifDiv = document.createElement('div');
        const priorityColor = notification.priority === 'High' ? '#ff4757' : notification.priority === 'Medium' ? '#ffa502' : '#ff6348';
        notifDiv.style.cssText = `background: #252525; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid ${priorityColor};`;
        notifDiv.innerHTML = `
          <strong>${notification.type}</strong> - <span style="color: ${priorityColor};">${notification.priority}</span>
          <div style="color: #ccc; margin: 5px 0;">${notification.message}</div>
          <div style="color: #888; font-size: 12px;">Action: ${notification.actionRequired}</div>
        `;
        urgentSection.appendChild(notifDiv);
      });
      
      container.appendChild(urgentSection);
    }
    
    // General Notifications
    if (notifications.generalNotifications.length > 0) {
      const generalSection = document.createElement('div');
      generalSection.className = 'general-section';
      generalSection.style.cssText = 'margin-top: 15px;';
      
      const generalTitle = document.createElement('h4');
      generalTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      generalTitle.textContent = '📢 General Notifications';
      generalSection.appendChild(generalTitle);
      
      notifications.generalNotifications.forEach(notification => {
        const notifDiv = document.createElement('div');
        notifDiv.style.cssText = 'background: #252525; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #74b9ff;';
        notifDiv.innerHTML = `
          <strong>${notification.type}</strong>
          <div style="color: #888; font-size: 12px;">${notification.message}</div>
        `;
        generalSection.appendChild(notifDiv);
      });
      
      container.appendChild(generalSection);
    }
    
    return container;
  }

  formatThreadAnalysis() {
    const threads = this.insights.threadAnalysis;
    const container = document.createElement('div');
    container.className = 'thread-analysis-container';
    
    // Check if we have meaningful threads
    if (!threads.conversationThreads || threads.conversationThreads.length === 0) {
      const noThreadsDiv = document.createElement('div');
      noThreadsDiv.style.cssText = 'color: #888; font-style: italic; padding: 10px;';
      noThreadsDiv.textContent = 'No significant conversation threads detected. This typically happens when comments have few replies or limited back-and-forth discussion.';
      container.appendChild(noThreadsDiv);
      return container;
    }
    
    if (threads.conversationThreads.length > 0) {
      const threadsSection = document.createElement('div');
      threadsSection.className = 'threads-section';
      
      const threadsTitle = document.createElement('h4');
      threadsTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      threadsTitle.textContent = '🧵 Active Conversation Threads';
      threadsSection.appendChild(threadsTitle);
      
      // Add summary if available
      if (threads.threadSummary) {
        const summaryDiv = document.createElement('div');
        summaryDiv.style.cssText = 'color: #aaa; font-size: 12px; margin-bottom: 10px;';
        summaryDiv.textContent = `${threads.threadSummary.totalThreads} threads • ${threads.threadSummary.totalParticipants} participants • Avg ${threads.threadSummary.avgMessagesPerThread} messages per thread`;
        threadsSection.appendChild(summaryDiv);
      }
      
      threads.conversationThreads.forEach(thread => {
        const threadDiv = document.createElement('div');
        const sentimentColor = thread.sentiment > 0 ? '#4CAF50' : thread.sentiment < 0 ? '#F44336' : '#9E9E9E';
        threadDiv.style.cssText = 'background: #252525; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #00d2ff;';
        threadDiv.innerHTML = `
          <strong>${thread.topic || 'General Discussion'}</strong>
          <div style="color: #ccc; margin: 5px 0;">${thread.participants || 0} participants, ${thread.messages || 0} messages</div>
          <div style="color: ${sentimentColor}; font-size: 12px;">Sentiment: ${thread.sentiment > 0 ? 'Positive' : thread.sentiment < 0 ? 'Negative' : 'Neutral'}</div>
        `;
        threadsSection.appendChild(threadDiv);
      });
      
      container.appendChild(threadsSection);
    }
    
    if (threads.topDiscussions.length > 0) {
      const discussSection = document.createElement('div');
      discussSection.className = 'discussions-section';
      discussSection.style.cssText = 'margin-top: 15px;';
      
      const discussTitle = document.createElement('h4');
      discussTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      discussTitle.textContent = '🔥 Top Discussions';
      discussSection.appendChild(discussTitle);
      
      threads.topDiscussions.forEach(discussion => {
        const discussDiv = document.createElement('div');
        discussDiv.style.cssText = 'background: #252525; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #ff6b6b;';
        discussDiv.innerHTML = `
          <strong>${discussion.topic}</strong>
          <div style="color: #888; font-size: 12px;">${discussion.engagement} total engagement</div>
        `;
        discussSection.appendChild(discussDiv);
      });
      
      container.appendChild(discussSection);
    }
    
    return container;
  }

  formatCommunityLeaders() {
    const leaders = this.insights.communityLeaders;
    const container = document.createElement('div');
    container.className = 'community-leaders-container';
    
    if (leaders.influentialUsers.length > 0) {
      const leadersSection = document.createElement('div');
      leadersSection.className = 'leaders-section';
      
      const leadersTitle = document.createElement('h4');
      leadersTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      leadersTitle.textContent = '👑 Influential Community Members';
      leadersSection.appendChild(leadersTitle);
      
      leaders.influentialUsers.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.style.cssText = 'background: #252525; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #ffd700;';
        userDiv.innerHTML = `
          <strong>@${user.username}</strong> - ${user.influence} influence
          <div style="color: #ccc; margin: 5px 0;">${user.followers} followers, ${user.engagement} engagement</div>
          <div style="color: #888; font-size: 12px;">Contributions: ${user.contributions}</div>
        `;
        leadersSection.appendChild(userDiv);
      });
      
      container.appendChild(leadersSection);
    }
    
    if (leaders.helpfulContributors.length > 0) {
      const contribSection = document.createElement('div');
      contribSection.className = 'contributors-section';
      contribSection.style.cssText = 'margin-top: 15px;';
      
      const contribTitle = document.createElement('h4');
      contribTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      contribTitle.textContent = '🌟 Helpful Contributors';
      contribSection.appendChild(contribTitle);
      
      leaders.helpfulContributors.forEach(contributor => {
        const contribDiv = document.createElement('div');
        contribDiv.style.cssText = 'background: #252525; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #74b9ff;';
        contribDiv.innerHTML = `
          <strong>@${contributor.username}</strong>
          <div style="color: #ccc;">Specialty: ${contributor.contributionType}</div>
          <div style="color: #888; font-size: 12px;">Helpfulness Score: ${contributor.helpfulnessScore}</div>
        `;
        contribSection.appendChild(contribDiv);
      });
      
      container.appendChild(contribSection);
    }
    
    return container;
  }

  formatContentFatigue() {
    const fatigue = this.insights.contentFatigue;
    const container = document.createElement('div');
    container.className = 'fatigue-container';
    
    // Determine fatigue level and color
    let fatigueDescription, color, recommendations;
    if (fatigue.fatigueLevel < 20) {
      fatigueDescription = 'Low Fatigue - Fresh Content';
      color = '#4CAF50';
      recommendations = 'Great! Your content feels fresh and engaging.';
    } else if (fatigue.fatigueLevel < 40) {
      fatigueDescription = 'Mild Fatigue';
      color = '#8BC34A';
      recommendations = 'Consider varying your content slightly to maintain freshness.';
    } else if (fatigue.fatigueLevel < 60) {
      fatigueDescription = 'Moderate Fatigue';
      color = '#FFC107';
      recommendations = 'Time to mix things up! Try new formats or topics.';
    } else if (fatigue.fatigueLevel < 80) {
      fatigueDescription = 'High Fatigue';
      color = '#FF9800';
      recommendations = 'Audience showing fatigue signs. Consider a content refresh.';
    } else {
      fatigueDescription = 'Very High Fatigue';
      color = '#F44336';
      recommendations = 'Strong fatigue signals. Major content changes recommended.';
    }
    
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'text-align: center; margin-bottom: 15px; padding: 15px; background: #252525; border-radius: 8px;';
    
    const levelDiv = document.createElement('div');
    levelDiv.style.cssText = `color: ${color}; font-size: 18px; font-weight: bold; margin-bottom: 10px;`;
    levelDiv.textContent = `${fatigue.fatigueLevel}% - ${fatigueDescription}`;
    
    const recDiv = document.createElement('div');
    recDiv.style.cssText = 'color: #ccc;';
    recDiv.textContent = recommendations;
    
    headerDiv.appendChild(levelDiv);
    headerDiv.appendChild(recDiv);
    container.appendChild(headerDiv);
    
    // Fatigue Indicators
    if (fatigue.fatigueIndicators.length > 0) {
      const indicatorsSection = document.createElement('div');
      indicatorsSection.className = 'indicators-section';
      indicatorsSection.style.cssText = 'margin-bottom: 15px;';
      
      const indicatorsTitle = document.createElement('h4');
      indicatorsTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      indicatorsTitle.textContent = '📊 Fatigue Indicators';
      indicatorsSection.appendChild(indicatorsTitle);
      
      fatigue.fatigueIndicators.forEach(indicator => {
        const indicatorDiv = document.createElement('div');
        indicatorDiv.style.cssText = 'background: #252525; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #FF9800;';
        indicatorDiv.innerHTML = `
          <strong>${indicator.type}:</strong> ${indicator.description}
          <div style="color: #888; font-size: 12px;">Impact: ${indicator.impact}</div>
        `;
        indicatorsSection.appendChild(indicatorDiv);
      });
      
      container.appendChild(indicatorsSection);
    }
    
    // Suggestions
    if (fatigue.suggestions.length > 0) {
      const suggestionsSection = document.createElement('div');
      suggestionsSection.className = 'suggestions-section';
      
      const suggestionsTitle = document.createElement('h4');
      suggestionsTitle.style.cssText = 'color: #00d2ff; margin: 0 0 10px 0;';
      suggestionsTitle.textContent = '💡 Improvement Suggestions';
      suggestionsSection.appendChild(suggestionsTitle);
      
      fatigue.suggestions.forEach(suggestion => {
        const suggestionDiv = document.createElement('div');
        suggestionDiv.style.cssText = 'background: #252525; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #74b9ff;';
        suggestionDiv.innerHTML = `
          <strong>${suggestion.category}:</strong> ${suggestion.suggestion}
        `;
        suggestionsSection.appendChild(suggestionDiv);
      });
      
      container.appendChild(suggestionsSection);
    }
    
    return container;
  }

  formatControversialComments() {
    const controversial = this.insights.controversialComments;
    const container = document.createElement('div');
    container.className = 'controversial-container';
    
    // Header with summary
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'text-align: center; margin-bottom: 15px; padding: 15px; background: #252525; border-radius: 8px;';
    
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'color: #ff6b6b; font-size: 18px; font-weight: bold; margin-bottom: 10px;';
    titleDiv.textContent = `${controversial.debates.length} Controversial Comments Detected`;
    
    const descDiv = document.createElement('div');
    descDiv.style.cssText = 'color: #ccc; font-size: 14px;';
    descDiv.textContent = 'Comments that sparked debates, disagreements, or polarizing discussions';
    
    headerDiv.appendChild(titleDiv);
    headerDiv.appendChild(descDiv);
    container.appendChild(headerDiv);
    
    // Polarizing Topics Summary
    if (controversial.polarizingTopics.length > 0) {
      const topicsSection = document.createElement('div');
      topicsSection.style.cssText = 'margin-bottom: 20px;';
      
      const topicsTitle = document.createElement('h4');
      topicsTitle.style.cssText = 'color: #ffa500; margin: 0 0 10px 0;';
      topicsTitle.textContent = '🎯 Hot Topics';
      topicsSection.appendChild(topicsTitle);
      
      const topicsGrid = document.createElement('div');
      topicsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;';
      
      controversial.polarizingTopics.forEach(topic => {
        const topicDiv = document.createElement('div');
        topicDiv.style.cssText = 'background: #303030; padding: 8px; border-radius: 6px; text-align: center;';
        topicDiv.innerHTML = `
          <div style="color: #ff6b6b; font-weight: bold;">${topic.topic}</div>
          <div style="color: #888; font-size: 12px;">${topic.frequency} mentions</div>
        `;
        topicsGrid.appendChild(topicDiv);
      });
      
      topicsSection.appendChild(topicsGrid);
      container.appendChild(topicsSection);
    }
    
    // Top Controversial Comments
    const commentsSection = document.createElement('div');
    commentsSection.style.cssText = 'margin-top: 20px;';
    
    const commentsTitle = document.createElement('h4');
    commentsTitle.style.cssText = 'color: #ff6b6b; margin: 0 0 15px 0;';
    commentsTitle.textContent = '🔥 Most Controversial Comments';
    commentsSection.appendChild(commentsTitle);
    
    // Show top 5 controversial comments
    controversial.debates.slice(0, 5).forEach((comment, index) => {
      const commentDiv = document.createElement('div');
      commentDiv.style.cssText = 'background: #252525; padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid #ff6b6b;';
      
      // Comment header with category
      const headerDiv = document.createElement('div');
      headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';
      
      const authorCategoryDiv = document.createElement('div');
      authorCategoryDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';
      
      // Category badge
      const categoryColors = {
        'Fan culture': '#e91e63',
        'Authenticity debates': '#ff9800', 
        'Cancel culture': '#f44336',
        'Quality debates': '#9c27b0',
        'Comparison wars': '#3f51b5',
        'Generational debates': '#009688',
        'General controversy': '#607d8b'
      };
      
      const categoryColor = categoryColors[comment.category] || '#607d8b';
      
      authorCategoryDiv.innerHTML = `
        <span style="color: #00d2ff; font-weight: bold;">${comment.author}</span>
        <span style="
          background: ${categoryColor}; 
          color: white; 
          padding: 2px 8px; 
          border-radius: 12px; 
          font-size: 10px; 
          font-weight: bold;
        ">${comment.category}</span>
      `;
      
      const statsDiv = document.createElement('div');
      statsDiv.style.cssText = 'color: #888; font-size: 12px;';
      statsDiv.innerHTML = `
        👍 ${comment.likes} | 💬 ${comment.replies} replies | 
        <span style="color: #ff6b6b;">Controversy Score: ${comment.controversyScore}</span>
      `;
      
      headerDiv.appendChild(authorCategoryDiv);
      headerDiv.appendChild(statsDiv);
      
      // Comment text
      const textDiv = document.createElement('div');
      textDiv.style.cssText = 'color: #ddd; margin-bottom: 10px; line-height: 1.4;';
      textDiv.textContent = comment.text.length > 200 ? 
        comment.text.substring(0, 200) + '...' : comment.text;
      
      // Reasons
      const reasonsDiv = document.createElement('div');
      reasonsDiv.style.cssText = 'margin-top: 8px;';
      reasonsDiv.innerHTML = `
        <span style="color: #888; font-size: 12px;">Controversy triggers: </span>
        <span style="color: #ffa500; font-size: 12px;">${comment.reasons.join(' • ')}</span>
      `;
      
      commentDiv.appendChild(headerDiv);
      commentDiv.appendChild(textDiv);
      commentDiv.appendChild(reasonsDiv);
      commentsSection.appendChild(commentDiv);
    });
    
    container.appendChild(commentsSection);
    
    // High-Engagement Disputes
    if (controversial.highEngagementDisputes.length > 0) {
      const disputesSection = document.createElement('div');
      disputesSection.style.cssText = 'margin-top: 20px; padding: 15px; background: #303030; border-radius: 8px;';
      
      const disputesTitle = document.createElement('h4');
      disputesTitle.style.cssText = 'color: #ffd700; margin: 0 0 10px 0;';
      disputesTitle.textContent = '⚡ High-Engagement Disputes';
      disputesSection.appendChild(disputesTitle);
      
      const disputesDesc = document.createElement('div');
      disputesDesc.style.cssText = 'color: #ccc; font-size: 12px; margin-bottom: 10px;';
      disputesDesc.textContent = 'Controversial comments with exceptional engagement (100+ interactions, 5+ replies)';
      disputesSection.appendChild(disputesDesc);
      
      const disputesList = document.createElement('div');
      controversial.highEngagementDisputes.forEach((dispute, index) => {
        const disputeDiv = document.createElement('div');
        disputeDiv.style.cssText = 'color: #ddd; font-size: 13px; margin: 5px 0;';
        disputeDiv.innerHTML = `
          ${index + 1}. <span style="color: #00d2ff;">${dispute.author}</span> - 
          <span style="color: #ffd700;">${dispute.engagement} total interactions</span>
        `;
        disputesList.appendChild(disputeDiv);
      });
      
      disputesSection.appendChild(disputesList);
      container.appendChild(disputesSection);
    }
    
    return container;
  }

  // EMAIL GENERATION FUNCTIONS FOR NEW ADVANCED FEATURES

  generateEmailTimeBasedHTML() {
    const analysis = this.insights.timeBasedAnalysis;
    
    let html = '<div style="color: #e8e8e8;">';
    
    // Peak Engagement Windows
    if (analysis.peakEngagementWindows.length > 0) {
      html += '<div style="margin-bottom: 15px;"><h4 style="color: #00d2ff; margin: 0 0 10px 0;">🕐 Peak Engagement Windows</h4>';
      analysis.peakEngagementWindows.forEach(window => {
        const sentimentIcon = window.dominantSentiment === 'positive' ? '📈' : 
                             window.dominantSentiment === 'negative' ? '📉' : '➡️';
        const sentimentText = window.dominantSentiment ? 
          window.dominantSentiment.charAt(0).toUpperCase() + window.dominantSentiment.slice(1) : 'Neutral';
        
        html += `
          <div style="background: #2a2a2a; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #00d2ff;">
            <strong style="color: #fff;">${window.timeWindow}</strong> - ${window.avgEngagement} avg interactions per comment<br>
            <small style="color: #aaa;">${window.commentCount} comments • Average Sentiment: ${sentimentIcon} ${sentimentText}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    // Sentiment Evolution
    if (analysis.sentimentEvolution.length > 0) {
      html += '<div><h4 style="color: #00d2ff; margin: 0 0 10px 0;">📊 Sentiment Evolution</h4>';
      analysis.sentimentEvolution.forEach((point, index) => {
        // Determine sentiment based on percentages
        let dominantSentiment = 'Neutral';
        let sentimentColor = '#9E9E9E';
        if (point.positivePercent > point.negativePercent && point.positivePercent > point.neutralPercent) {
          dominantSentiment = 'Positive';
          sentimentColor = '#4CAF50';
        } else if (point.negativePercent > point.positivePercent && point.negativePercent > point.neutralPercent) {
          dominantSentiment = 'Negative';
          sentimentColor = '#F44336';
        }
        
        // Determine trend by comparing with previous point
        let trendIcon = '➡️';
        if (index > 0) {
          const prevPoint = analysis.sentimentEvolution[index - 1];
          if (point.positivePercent > prevPoint.positivePercent) {
            trendIcon = '📈';
          } else if (point.positivePercent < prevPoint.positivePercent) {
            trendIcon = '📉';
          }
        }
        
        html += `
          <div style="background: #2a2a2a; padding: 8px; margin: 3px 0; border-radius: 4px;">
            ${trendIcon} <strong style="color: #fff;">${point.time}</strong>: <span style="color: ${sentimentColor};">${dominantSentiment}</span>
            <span style="color: #aaa; font-size: 11px;">(${point.total || 0} comments - ${point.positivePercent || 0}% positive, ${point.neutralPercent || 0}% neutral, ${point.negativePercent || 0}% negative)</span>
          </div>
        `;
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  generateEmailTrollDetectionHTML() {
    const detection = this.insights.trollDetection;
    
    let html = '<div style="color: #e8e8e8;">';
    
    // Check if there are no trolls found
    if (detection.suspiciousBehaviors.length === 0 && detection.repeatOffenders.length === 0) {
      html += `
        <div style="text-align: center; padding: 20px; background: #2a2a2a; border-radius: 8px;">
          <div style="color: #4CAF50; font-size: 18px; margin-bottom: 10px;">✅ No Trolls Found</div>
          <div style="color: #ccc;">Great news! No suspicious troll behaviors or repeat offenders detected in the comments.</div>
        </div>
      `;
      html += '</div>';
      return html;
    }
    
    // Suspicious Behaviors
    if (detection.suspiciousBehaviors.length > 0) {
      html += '<div style="margin-bottom: 15px;"><h4 style="color: #ff6b6b; margin: 0 0 10px 0;">⚠️ Suspicious Behaviors Detected</h4>';
      detection.suspiciousBehaviors.forEach(behavior => {
        const riskColor = behavior.riskLevel === 'High' ? '#ff4757' : behavior.riskLevel === 'Medium' ? '#ffa502' : '#ff6348';
        html += `
          <div style="background: #2a2a2a; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid ${riskColor};">
            <strong style="color: #fff;">${behavior.type}</strong> - Risk Level: <span style="color: ${riskColor};">${behavior.riskLevel}</span><br>
            <div style="color: #ccc; margin: 5px 0;">${behavior.description}</div>
            <small style="color: #aaa;">Detected ${behavior.count} times</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    // Repeat Offenders
    if (detection.repeatOffenders.length > 0) {
      html += '<div><h4 style="color: #ff6b6b; margin: 0 0 10px 0;">🚨 Repeat Offenders</h4>';
      detection.repeatOffenders.forEach(offender => {
        html += `
          <div style="background: #2a2a2a; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #ff4757;">
            <strong style="color: #fff;">@${offender.username}</strong> - ${offender.offenseCount} violations<br>
            <small style="color: #aaa;">Types: ${(offender.offenseTypes || []).join(', ')}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  generateEmailEngagementQualityHTML() {
    const quality = this.insights.engagementQuality;
    
    // Determine quality level and color
    let qualityLevel, color, description;
    if (quality.overallScore >= 80) {
      qualityLevel = 'Excellent';
      color = '#4CAF50';
      description = 'Outstanding engagement! Your audience is highly invested and interactive.';
    } else if (quality.overallScore >= 60) {
      qualityLevel = 'Good';
      color = '#8BC34A';
      description = 'Good engagement quality with room for improvement.';
    } else if (quality.overallScore >= 40) {
      qualityLevel = 'Average';
      color = '#FFC107';
      description = 'Average engagement. Consider strategies to boost meaningful interactions.';
    } else {
      qualityLevel = 'Needs Improvement';
      color = '#FF9800';
      description = 'Low engagement quality. Focus on creating more interactive content.';
    }
    
    return `
      <div style="color: #e8e8e8;">
        <div style="background: #2a2a2a; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 15px;">
          <div style="display: inline-block; background: #1a1a1a; padding: 20px; border-radius: 50%; border: 3px solid ${color}; margin-bottom: 10px;">
            <span style="color: ${color}; font-size: 24px; font-weight: bold;">${quality.overallScore}</span>
          </div>
          <div style="color: ${color}; font-weight: bold; margin-bottom: 5px;">${qualityLevel}</div>
          <div style="color: #ccc; font-size: 14px;">${description}</div>
        </div>
        
        <div style="background: #2a2a2a; padding: 15px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>💬 Meaningful Comments:</span>
            <span style="color: #00d2ff;">${quality.meaningfulComments}%</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>🔄 Thread Participation:</span>
            <span style="color: #00d2ff;">${quality.threadParticipation}%</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>❓ Questions Asked:</span>
            <span style="color: #00d2ff;">${quality.questionsAsked}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>🎯 Topic Relevance:</span>
            <span style="color: #00d2ff;">${quality.topicRelevance}%</span>
          </div>
        </div>
      </div>
    `;
  }

  generateEmailMonetizationHTML() {
    const monetization = this.insights.monetizationIntelligence;
    
    // Determine potential level
    let potentialLevel, color;
    if (monetization.monetizationPotential >= 80) {
      potentialLevel = 'Very High';
      color = '#4CAF50';
    } else if (monetization.monetizationPotential >= 60) {
      potentialLevel = 'High';
      color = '#8BC34A';
    } else if (monetization.monetizationPotential >= 40) {
      potentialLevel = 'Moderate';
      color = '#FFC107';
    } else {
      potentialLevel = 'Low';
      color = '#FF9800';
    }
    
    let html = `
      <div style="color: #e8e8e8;">
        <div style="background: #2a2a2a; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 15px;">
          <div style="color: ${color}; font-size: 18px; font-weight: bold;">
            ${monetization.monetizationPotential}% ${potentialLevel} Potential
          </div>
        </div>
    `;
    
    // Revenue Opportunities
    if (monetization.revenueOpportunities.length > 0) {
      html += '<div style="margin-bottom: 15px;"><h4 style="color: #00d2ff; margin: 0 0 10px 0;">💰 Revenue Opportunities</h4>';
      monetization.revenueOpportunities.forEach(opportunity => {
        const priorityColor = opportunity.priority === 'High' ? '#ff6b6b' : opportunity.priority === 'Medium' ? '#ffa502' : '#74b9ff';
        html += `
          <div style="background: #2a2a2a; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid ${priorityColor};">
            <strong style="color: #fff;">${opportunity.type}</strong> - <span style="color: ${priorityColor};">${opportunity.priority} Priority</span><br>
            <div style="color: #ccc; margin: 5px 0;">${opportunity.description}</div>
            <small style="color: #aaa;">Potential: ${opportunity.potential}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    // Audience Value
    if (monetization.audienceValue.length > 0) {
      html += '<div><h4 style="color: #00d2ff; margin: 0 0 10px 0;">👥 Audience Value Indicators</h4>';
      monetization.audienceValue.forEach(indicator => {
        html += `
          <div style="background: #2a2a2a; padding: 8px; margin: 3px 0; border-radius: 4px; display: flex; justify-content: space-between;">
            <span>${indicator.type}:</span>
            <span style="color: #00d2ff;">${indicator.value}</span>
          </div>
        `;
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  generateEmailSeriesPlannerHTML() {
    const series = this.insights.seriesPlanner;
    
    let html = '<div style="color: #e8e8e8;">';
    
    if (series.seriesIdeas.length > 0) {
      html += '<div style="margin-bottom: 15px;"><h4 style="color: #00d2ff; margin: 0 0 10px 0;">🎬 Series Ideas</h4>';
      series.seriesIdeas.forEach(idea => {
        html += `
          <div style="background: #2a2a2a; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #00d2ff;">
            <strong style="color: #fff;">${idea.title}</strong> - ${idea.episodes} episodes<br>
            <div style="color: #ccc; margin: 5px 0;">${idea.description}</div>
            <small style="color: #aaa;">Expected Engagement: ${idea.expectedEngagement}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    if (series.continuationSuggestions.length > 0) {
      html += '<div><h4 style="color: #00d2ff; margin: 0 0 10px 0;">➡️ Continuation Suggestions</h4>';
      series.continuationSuggestions.forEach(suggestion => {
        html += `
          <div style="background: #2a2a2a; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #74b9ff;">
            <strong style="color: #fff;">${suggestion.topic}</strong><br>
            <small style="color: #ccc;">${suggestion.reason}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  generateEmailSmartNotificationsHTML() {
    const notifications = this.insights.smartNotifications;
    
    let html = '<div style="color: #e8e8e8;">';
    
    // Urgent Notifications
    if (notifications.urgentNotifications.length > 0) {
      html += '<div style="margin-bottom: 15px;"><h4 style="color: #ff6b6b; margin: 0 0 10px 0;">🚨 Urgent Notifications</h4>';
      notifications.urgentNotifications.forEach(notification => {
        const priorityColor = notification.priority === 'High' ? '#ff4757' : notification.priority === 'Medium' ? '#ffa502' : '#ff6348';
        html += `
          <div style="background: #2a2a2a; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid ${priorityColor};">
            <strong style="color: #fff;">${notification.type}</strong> - <span style="color: ${priorityColor};">${notification.priority}</span><br>
            <div style="color: #ccc; margin: 5px 0;">${notification.message}</div>
            <small style="color: #aaa;">Action: ${notification.actionRequired}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    // General Notifications
    if (notifications.generalNotifications.length > 0) {
      html += '<div><h4 style="color: #00d2ff; margin: 0 0 10px 0;">📢 General Notifications</h4>';
      notifications.generalNotifications.forEach(notification => {
        html += `
          <div style="background: #2a2a2a; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #74b9ff;">
            <strong style="color: #fff;">${notification.type}</strong><br>
            <small style="color: #ccc;">${notification.message}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  generateEmailThreadAnalysisHTML() {
    const threads = this.insights.threadAnalysis;
    
    let html = '<div style="color: #e8e8e8;">';
    
    // Check if we have meaningful threads
    if (!threads.conversationThreads || threads.conversationThreads.length === 0) {
      html += '<p style="color: #888; font-style: italic;">No significant conversation threads detected.</p>';
      html += '</div>';
      return html;
    }
    
    if (threads.conversationThreads.length > 0) {
      html += '<div style="margin-bottom: 15px;"><h4 style="color: #00d2ff; margin: 0 0 10px 0;">🧵 Active Conversation Threads</h4>';
      
      // Add summary if available
      if (threads.threadSummary) {
        html += `<p style="color: #aaa; font-size: 12px; margin-bottom: 10px;">${threads.threadSummary.totalThreads} threads • ${threads.threadSummary.totalParticipants} participants • Avg ${threads.threadSummary.avgMessagesPerThread} messages per thread</p>`;
      }
      
      threads.conversationThreads.forEach(thread => {
        const sentimentColor = thread.sentiment > 0 ? '#4CAF50' : thread.sentiment < 0 ? '#F44336' : '#9E9E9E';
        html += `
          <div style="background: #2a2a2a; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #00d2ff;">
            <strong style="color: #fff;">${thread.topic || 'General Discussion'}</strong><br>
            <div style="color: #ccc; margin: 5px 0;">${thread.participants || 0} participants, ${thread.messages || 0} messages</div>
            <small style="color: ${sentimentColor};">Sentiment: ${thread.sentiment > 0 ? 'Positive' : thread.sentiment < 0 ? 'Negative' : 'Neutral'}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    if (threads.topDiscussions.length > 0) {
      html += '<div><h4 style="color: #00d2ff; margin: 0 0 10px 0;">🔥 Top Discussions</h4>';
      threads.topDiscussions.forEach(discussion => {
        html += `
          <div style="background: #2a2a2a; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #ff6b6b;">
            <strong style="color: #fff;">${discussion.topic}</strong><br>
            <small style="color: #aaa;">${discussion.engagement} total engagement</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  generateEmailCommunityLeadersHTML() {
    const leaders = this.insights.communityLeaders;
    
    let html = '<div style="color: #e8e8e8;">';
    
    if (leaders.influentialUsers.length > 0) {
      html += '<div style="margin-bottom: 15px;"><h4 style="color: #00d2ff; margin: 0 0 10px 0;">👑 Influential Community Members</h4>';
      leaders.influentialUsers.forEach(user => {
        html += `
          <div style="background: #2a2a2a; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #ffd700;">
            <strong style="color: #fff;">@${user.username}</strong> - ${user.influence} influence<br>
            <div style="color: #ccc; margin: 5px 0;">${user.followers} followers, ${user.engagement} engagement</div>
            <small style="color: #aaa;">Contributions: ${user.contributions}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    if (leaders.helpfulContributors.length > 0) {
      html += '<div><h4 style="color: #00d2ff; margin: 0 0 10px 0;">🌟 Helpful Contributors</h4>';
      leaders.helpfulContributors.forEach(contributor => {
        html += `
          <div style="background: #2a2a2a; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #74b9ff;">
            <strong style="color: #fff;">@${contributor.username}</strong><br>
            <div style="color: #ccc;">Specialty: ${contributor.contributionType}</div>
            <small style="color: #aaa;">Helpfulness Score: ${contributor.helpfulnessScore}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  generateEmailContentFatigueHTML() {
    const fatigue = this.insights.contentFatigue;
    
    // Determine fatigue level and color
    let fatigueDescription, color, recommendations;
    if (fatigue.fatigueLevel < 20) {
      fatigueDescription = 'Low Fatigue - Fresh Content';
      color = '#4CAF50';
      recommendations = 'Great! Your content feels fresh and engaging.';
    } else if (fatigue.fatigueLevel < 40) {
      fatigueDescription = 'Mild Fatigue';
      color = '#8BC34A';
      recommendations = 'Consider varying your content slightly to maintain freshness.';
    } else if (fatigue.fatigueLevel < 60) {
      fatigueDescription = 'Moderate Fatigue';
      color = '#FFC107';
      recommendations = 'Time to mix things up! Try new formats or topics.';
    } else if (fatigue.fatigueLevel < 80) {
      fatigueDescription = 'High Fatigue';
      color = '#FF9800';
      recommendations = 'Audience showing fatigue signs. Consider a content refresh.';
    } else {
      fatigueDescription = 'Very High Fatigue';
      color = '#F44336';
      recommendations = 'Strong fatigue signals. Major content changes recommended.';
    }
    
    let html = `
      <div style="color: #e8e8e8;">
        <div style="background: #2a2a2a; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 15px;">
          <div style="color: ${color}; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
            ${fatigue.fatigueLevel}% - ${fatigueDescription}
          </div>
          <div style="color: #ccc;">${recommendations}</div>
        </div>
    `;
    
    // Fatigue Indicators
    if (fatigue.fatigueIndicators.length > 0) {
      html += '<div style="margin-bottom: 15px;"><h4 style="color: #00d2ff; margin: 0 0 10px 0;">📊 Fatigue Indicators</h4>';
      fatigue.fatigueIndicators.forEach(indicator => {
        html += `
          <div style="background: #2a2a2a; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #FF9800;">
            <strong style="color: #fff;">${indicator.type}:</strong> ${indicator.description}<br>
            <small style="color: #aaa;">Impact: ${indicator.impact}</small>
          </div>
        `;
      });
      html += '</div>';
    }
    
    // Suggestions
    if (fatigue.suggestions.length > 0) {
      html += '<div><h4 style="color: #00d2ff; margin: 0 0 10px 0;">💡 Improvement Suggestions</h4>';
      fatigue.suggestions.forEach(suggestion => {
        html += `
          <div style="background: #2a2a2a; padding: 8px; margin: 3px 0; border-radius: 4px; border-left: 3px solid #74b9ff;">
            <strong style="color: #fff;">${suggestion.category}:</strong> ${suggestion.suggestion}
          </div>
        `;
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  generateEmailControversialHTML() {
    const controversial = this.insights.controversialComments;
    
    let html = '<div style="color: #e8e8e8;">';
    
    // Header
    html += `
      <div style="background: #2a2a2a; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 15px;">
        <div style="color: #ff6b6b; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
          ${controversial.debates.length} Controversial Comments Detected
        </div>
        <div style="color: #ccc;">Comments that sparked debates, disagreements, or polarizing discussions</div>
      </div>
    `;
    
    // Polarizing Topics
    if (controversial.polarizingTopics.length > 0) {
      html += '<div style="margin-bottom: 20px;">';
      html += '<h4 style="color: #ffa500; margin: 0 0 10px 0;">🎯 Hot Topics</h4>';
      html += '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
      
      controversial.polarizingTopics.forEach(topic => {
        html += `
          <div style="background: #303030; padding: 8px 12px; border-radius: 6px; display: inline-block;">
            <span style="color: #ff6b6b; font-weight: bold;">${topic.topic}</span>
            <span style="color: #888; font-size: 12px; margin-left: 8px;">${topic.frequency} mentions</span>
          </div>
        `;
      });
      
      html += '</div></div>';
    }
    
    // Top Controversial Comments
    html += '<div style="margin-top: 20px;">';
    html += '<h4 style="color: #ff6b6b; margin: 0 0 15px 0;">🔥 Most Controversial Comments</h4>';
    
    controversial.debates.slice(0, 5).forEach((comment, index) => {
      html += `
        <div style="background: #2a2a2a; padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid #ff6b6b;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #00d2ff; font-weight: bold;">${comment.author}</span>
            <span style="color: #888; font-size: 12px;">
              👍 ${comment.likes} | 💬 ${comment.replies} replies | 
              <span style="color: #ff6b6b;">Score: ${comment.controversyScore}</span>
            </span>
          </div>
          <div style="color: #ddd; margin-bottom: 10px; line-height: 1.4;">
            ${comment.text.length > 200 ? comment.text.substring(0, 200) + '...' : comment.text}
          </div>
          <div style="margin-top: 8px;">
            <span style="color: #888; font-size: 12px;">Controversy triggers: </span>
            <span style="color: #ffa500; font-size: 12px;">${comment.reasons.join(' • ')}</span>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    // High-Engagement Disputes
    if (controversial.highEngagementDisputes.length > 0) {
      html += `
        <div style="margin-top: 20px; padding: 15px; background: #303030; border-radius: 8px;">
          <h4 style="color: #ffd700; margin: 0 0 10px 0;">⚡ High-Engagement Disputes</h4>
          <div style="color: #ccc; font-size: 12px; margin-bottom: 10px;">
            Controversial comments with exceptional engagement (100+ interactions, 5+ replies)
          </div>
      `;
      
      controversial.highEngagementDisputes.forEach((dispute, index) => {
        html += `
          <div style="color: #ddd; font-size: 13px; margin: 5px 0;">
            ${index + 1}. <span style="color: #00d2ff;">${dispute.author}</span> - 
            <span style="color: #ffd700;">${dispute.engagement} total interactions</span>
          </div>
        `;
      });
      
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }
}

// Initialize Vibelytics when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeCommentReader();
  });
} else {
  new YouTubeCommentReader();
} 