# Vibelytics - YouTube Insights Chrome Extension

Feel the vibe. Follow the insights. Vibelytics turns your YouTube comment section into a powerful insight engine. Instantly see audience sentiment, top comments, most engaged fans, content ideas, common questions, and business opportunities—all in one simple, creator-friendly dashboard.

## Features

- 💡 **Audience Sentiment Analysis**: Instantly understand how your audience feels about your content
- 🔥 **Top 5 Influential Comments**: Identify comments with the most replies and engagement
- 💭 **Video Creation Ideas**: Extract content suggestions from your audience
- 🏷️ **Comment Topics**: AI-powered grouping of comments by themes
- 👥 **Top 5 Engaged Users**: Discover your most active community members
- 💼 **Business Opportunities**: Spot sponsorships, collaborations, and monetization chances
- ❓ **Frequently Asked Questions**: Find common questions to address
- ⭐ **Best Features**: See what viewers love about your content
- 📈 **Areas for Improvement**: Get constructive feedback insights
- 📊 **Creator Dashboard**: All insights in one intuitive interface
- 💾 **Export Reports**: Download comprehensive insight reports

## Installation

### Method 1: Load as Unpacked Extension (Developer Mode)

1. **Download or Clone**: Get the extension files to your local machine
2. **Open Chrome**: Launch Google Chrome browser
3. **Access Extensions Page**: 
   - Type `chrome://extensions/` in the address bar, or
   - Go to Chrome Menu > More Tools > Extensions
4. **Enable Developer Mode**: Toggle the "Developer mode" switch in the top-right corner
5. **Load Extension**: Click "Load unpacked" and select the `vibelytics` folder
6. **Confirm Installation**: The extension icon should appear in your Chrome toolbar

### Method 2: Create Extension Package

1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Click "Pack extension"
4. Select the `vibelytics` folder
5. Install the generated `.crx` file

## Usage

### Quick Start

1. **Navigate to YouTube**: Go to any YouTube video page
2. **Find Control Panel**: Look for the "Vibelytics" control panel on the right side of the page
3. **Configure API Key**: Click the ⚙️ button to set up your YouTube API key (first time only)
4. **Analyze Comments**: Click "Analyze Comments" to fetch and analyze all comments
5. **View Insights**: Review the comprehensive insights dashboard that appears
6. **Export Data**: Click "Export Insights" to download a full report

### Control Panel Features

Vibelytics adds a floating control panel with the following features:

- **Analyze Comments**: Fetches all comments via YouTube API and generates comprehensive insights
- **Export Insights**: Downloads a detailed report with all analytics and raw comment data
- **Configure (⚙️)**: Set up or update your YouTube API key

### Status Information

The control panel displays:
- Analysis status
- Number of comments analyzed
- Total engagement metrics (likes and replies)
- Real-time progress updates

### Export Format

Insights are exported as CSV with the following columns:
- **Author**: Commenter's name (potential superfan or influencer)
- **Timestamp**: When the comment was posted
- **Likes**: Engagement level indicator
- **Replies**: Community interaction metric
- **Source**: Whether from DOM or API
- **IsReply**: Comment thread analysis
- **Comment**: The full text for sentiment and idea extraction

## Technical Details

### Browser Compatibility

- **Chrome**: Version 88+ (Manifest V3 support required)
- **Edge**: Chromium-based versions

### Permissions

The extension requires minimal permissions:
- `storage`: To temporarily store comment data
- Content script access to `https://www.youtube.com/*` and `https://youtube.com/*`

### How It Works

Vibelytics uses the YouTube Data API v3 to:
- Fetch all comments and replies from any YouTube video
- Analyze sentiment using keyword matching
- Extract actionable insights for content creators
- Present data in an intuitive dashboard format

### API Configuration

To use Vibelytics, you need a YouTube Data API v3 key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3
4. Go to Credentials > Create Credentials > API Key
5. Copy the API key and paste it in Vibelytics when prompted

## Troubleshooting

### API Issues

1. **API Key Not Working**: Ensure you've enabled YouTube Data API v3 in Google Cloud Console
2. **Quota Exceeded**: Check your API quota in Google Cloud Console
3. **Comments Disabled**: Some videos have comments disabled
4. **Invalid Key**: Regenerate your API key if needed

### Export Issues

1. **Browser Downloads**: Check your browser's download settings
2. **File Permissions**: Ensure your browser can download text files
3. **No Data**: Make sure you've analyzed comments before exporting

### Control Panel Missing

1. **Page Navigation**: The panel may disappear during YouTube navigation - refresh the page
2. **Z-Index Issues**: Try scrolling or clicking elsewhere on the page
3. **Extension Status**: Check if the extension is enabled in `chrome://extensions/`

## Development

### Project Structure

```
vibelytics/
├── manifest.json          # Extension configuration
├── content-script.js      # Vibelytics insight engine
├── popup.html            # Extension popup interface
├── icons/                # Extension icons
├── README.md            # This file
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### Key Implementation Patterns

Based on Chrome Extension samples:
- **DOM Manipulation**: Following patterns from `cookbook.sidepanel-open`
- **Content Reading**: Inspired by `tutorial.reading-time`
- **Element Creation**: Using techniques from `web-accessible-resources`

### Code Architecture

- **Class-based Design**: `YouTubeCommentReader` main class
- **Promise-based Loading**: Waits for YouTube content to load
- **Observer Pattern**: Monitors page navigation changes
- **Interval-based Scrolling**: Controlled auto-scroll mechanism

## Privacy & Ethics

- **Creator-First Privacy**: Your audience data stays with you
- **No Data Collection**: All insights are processed locally in your browser
- **No Server Communication**: Vibelytics never sends your data anywhere
- **Full Control**: Start, stop, and export insights on your terms
- **Respectful Analysis**: Uses YouTube-friendly practices

## Contributing

Vibelytics is built for creators, by creators. To contribute:

1. Follow the existing code patterns
2. Test thoroughly on different YouTube video types
3. Ensure compatibility with YouTube's dynamic DOM structure
4. Maintain the privacy-first approach

## License

Vibelytics follows the same licensing as the Chrome Extension samples it's based on.

## Changelog

### Version 1.0 - Vibelytics Launch
- Audience sentiment analysis
- Top comment identification
- Fan engagement tracking
- Content idea extraction
- Business opportunity detection
- CSV export with full insights
- YouTube API integration

---

**Note**: Vibelytics is designed to help creators understand their audience better. Please respect YouTube's terms of service and your audience's privacy. 