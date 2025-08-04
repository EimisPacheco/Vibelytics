#!/usr/bin/env node

// Simple script to fetch YouTube comments and save to files
// Requires Node.js 18+ for native fetch support

const fs = require('fs').promises;

const API_KEY = 'AIzaSyB9jxCpFclGwigqmjBZkam0OfRipy8x5sw';
const VIDEO_ID = 'pzBi1nwDn8U';
const VIDEO_URL = 'https://www.youtube.com/watch?v=pzBi1nwDn8U';

async function fetchYouTubeComments() {
    console.log('Fetching comments for video:', VIDEO_URL);
    
    // Build the API request
    const params = new URLSearchParams({
        part: 'snippet,replies',
        videoId: VIDEO_ID,
        maxResults: 50, // Get more comments
        order: 'relevance',
        key: API_KEY
    });

    const apiUrl = `https://youtube.googleapis.com/youtube/v3/commentThreads?${params.toString()}`;
    
    // Prepare request details
    const requestDetails = {
        method: 'GET',
        url: apiUrl,
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'YouTubeCommentFetcher/1.0'
        },
        parameters: Object.fromEntries(params),
        timestamp: new Date().toISOString(),
        videoUrl: VIDEO_URL,
        videoId: VIDEO_ID
    };

    try {
        // Save request details
        await fs.writeFile(
            'youtube-api-request.json', 
            JSON.stringify(requestDetails, null, 2)
        );
        console.log('✓ Request details saved to: youtube-api-request.json');

        // Make the API call
        console.log('\nMaking API call...');
        const response = await fetch(apiUrl);
        const data = await response.json();

        // Save the full response
        await fs.writeFile(
            'youtube-api-response.json',
            JSON.stringify(data, null, 2)
        );
        console.log('✓ Response saved to: youtube-api-response.json');

        // Create a summary
        if (data.items && data.items.length > 0) {
            console.log('\n=== Response Summary ===');
            console.log('Status: Success');
            console.log('Total Comments:', data.pageInfo.totalResults);
            console.log('Comments Retrieved:', data.items.length);
            console.log('Has More Pages:', !!data.nextPageToken);
            
            // Extract and save just the comments in a simpler format
            const simplifiedComments = data.items.map(item => {
                const topComment = item.snippet.topLevelComment.snippet;
                return {
                    author: topComment.authorDisplayName,
                    text: topComment.textDisplay,
                    likes: topComment.likeCount,
                    publishedAt: topComment.publishedAt,
                    replyCount: item.snippet.totalReplyCount,
                    replies: item.replies ? item.replies.comments.map(reply => ({
                        author: reply.snippet.authorDisplayName,
                        text: reply.snippet.textDisplay,
                        likes: reply.snippet.likeCount,
                        publishedAt: reply.snippet.publishedAt
                    })) : []
                };
            });

            await fs.writeFile(
                'youtube-comments-simplified.json',
                JSON.stringify(simplifiedComments, null, 2)
            );
            console.log('✓ Simplified comments saved to: youtube-comments-simplified.json');

            // Show first few comments
            console.log('\n=== First 3 Comments ===');
            simplifiedComments.slice(0, 3).forEach((comment, index) => {
                console.log(`\n${index + 1}. ${comment.author}`);
                console.log(`   "${comment.text.substring(0, 100)}..."`);
                console.log(`   Likes: ${comment.likes}, Replies: ${comment.replyCount}`);
            });
        } else if (data.error) {
            console.error('\n=== API Error ===');
            console.error('Error:', data.error.message);
            console.error('Code:', data.error.code);
            console.error('Details:', JSON.stringify(data.error.errors, null, 2));
        } else {
            console.log('\nNo comments found for this video.');
        }

    } catch (error) {
        console.error('\n=== Error ===');
        console.error('Failed to fetch comments:', error.message);
        
        // Save error details
        await fs.writeFile(
            'youtube-api-error.json',
            JSON.stringify({
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            }, null, 2)
        );
    }
}

// Run the script
fetchYouTubeComments().then(() => {
    console.log('\nDone! Check the generated JSON files for details.');
}).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});