# Embedding Providers Comparison

## Overview
The YouTube Comment Analytics extension now supports multiple embedding providers for semantic search, even in local storage mode.

## Available Providers

### 1. **Local Embeddings (Default)**
- **Cost**: Free
- **Speed**: Instant
- **Quality**: Basic
- **Dimensions**: 768
- **Method**: Feature extraction + hashing

```javascript
// Automatically used when no API key configured
{
  provider: 'local',
  dimension: 768
}
```

### 2. **OpenAI Embeddings**
- **Model**: text-embedding-ada-002
- **Cost**: $0.0001 per 1k tokens
- **Speed**: ~200ms per request
- **Quality**: Excellent
- **Native Dimensions**: 1536
- **Reduced to**: 768 (for compatibility)

```javascript
// Configure in settings
{
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'text-embedding-ada-002'
}
```

### 3. **Google Embeddings** (Coming Soon)
- **Model**: embedding-001
- **Cost**: Variable
- **Speed**: Fast
- **Quality**: Very Good
- **Dimensions**: 768

## Performance Comparison

| Feature | Local | OpenAI | Google |
|---------|-------|---------|---------|
| **Semantic Quality** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Speed** | ⚡⚡⚡⚡⚡ | ⚡⚡⚡ | ⚡⚡⚡⚡ |
| **Cost** | Free | $0.10/1M chars | Variable |
| **Offline** | ✅ | ❌ | ❌ |
| **Rate Limits** | None | 3000/min | Variable |

## How It Works

### With Local Storage + OpenAI
1. Comments are fetched (once per 7 days)
2. OpenAI generates high-quality embeddings
3. Embeddings stored locally (up to 1000 per video)
4. Semantic search runs on cached embeddings
5. No repeated API calls for same comments

### Example Results

**Query**: "tutorial request"

**Local Embeddings Find**:
- "tutorial" (exact match)
- "Tutorial please" (case variation)
- "tutoril" (typo - might miss)

**OpenAI Embeddings Find**:
- "tutorial" ✓
- "please make a guide" ✓
- "can you teach this" ✓
- "I'd love to learn how" ✓
- "educational content needed" ✓

## Setup Instructions

### 1. **Get OpenAI API Key**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create account
3. Go to API Keys
4. Create new key

### 2. **Configure Extension**
1. Click extension icon
2. Go to Settings
3. Select "OpenAI" as provider
4. Enter API key
5. Save

### 3. **Verify It's Working**
Check console for:
```
🤖 Using OpenAI embeddings
✅ OpenAI embedding generated successfully
```

## Cost Estimation

| Usage | Comments/Month | Tokens | Cost |
|-------|----------------|--------|------|
| Light | 10,000 | ~100k | $0.01 |
| Medium | 100,000 | ~1M | $0.10 |
| Heavy | 1,000,000 | ~10M | $1.00 |

## Fallback Behavior

If OpenAI fails:
1. Automatically falls back to local embeddings
2. Shows warning in console
3. Continues working with reduced quality
4. Retries OpenAI on next analysis

## Privacy & Security

- API keys stored locally in Chrome
- Never sent to any server except OpenAI
- Embeddings cached locally
- Original text not stored after embedding

## Switching Providers

Change anytime in settings:
- **Local**: Free, instant, basic quality
- **OpenAI**: Paid, slower, excellent quality
- **Auto**: Uses OpenAI if configured, else local

## FAQ

**Q: Do I need OpenAI for TiDB mode?**
A: No, TiDB can use any embedding provider or generate its own.

**Q: Will it work offline with OpenAI?**
A: No, but cached embeddings work offline.

**Q: How many API calls?**
A: Only for new comments (respects 7-day cache).

**Q: Can I use both?**
A: Yes, it automatically falls back if OpenAI fails.