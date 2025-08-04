# Vibelytics - YouTube Comment Insights Engine

## What it does
Vibelytics is a Chrome extension that transforms YouTube comment sections into powerful insight engines. It analyzes comments on YouTube videos to extract valuable data including sentiment analysis, business opportunities, frequently asked questions, and engagement metrics. The extension provides actionable insights that content creators and marketers can use to understand their audience better.

## Key Features
- **Comment Analysis**: Fetches and analyzes all comments using YouTube Data API v3
- **Sentiment Analysis**: Categorizes comments as positive, negative, or neutral
- **Insight Generation**: Identifies video ideas, business opportunities, frequent questions, and areas for improvement
- **Engagement Metrics**: Tracks top engaged users, most liked comments, and comment patterns
- **Export Capabilities**: Export insights as CSV files for further analysis
- **Email Reports**: Send beautifully formatted HTML insight reports via email using Resend API
- **Real-time Analysis**: Works directly on YouTube pages with a floating control panel
- **Caching System**: Stores analyzed data to prevent redundant API calls

## How it's built
- **Frontend**: Pure JavaScript content script injected into YouTube pages
- **Background Service**: Chrome extension service worker for handling API calls
- **UI Components**: Custom floating control panel with analyze, export, and email buttons
- **Data Processing**: Client-side analysis using regular expressions and keyword matching
- **Storage**: Chrome storage API for caching analyzed data and API keys
- **Architecture**: Event-driven design with observers for YouTube's dynamic content

## How Resend is used
Vibelytics integrates Resend API to send professional email reports:
1. **Email Generation**: Creates comprehensive HTML email reports with all insights
2. **API Integration**: Background script handles Resend API calls to avoid CORS issues
3. **Email Features**:
   - Sends from `onboarding@resend.dev` domain
   - Includes formatted insights with emojis and sections
   - Contains video metadata and analysis timestamp
   - Professional HTML template with responsive design
4. **Implementation**: Uses Resend's `/emails` endpoint with Bearer token authentication
5. **User Flow**: One-click email sending with recipient prompt and success confirmation