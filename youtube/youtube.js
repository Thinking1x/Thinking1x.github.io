// ==========================================
// YOUTUBE API INTEGRATION ENGINE
// ==========================================

// 1. Paste your newly generated API key inside these quotes
const YOUTUBE_API_KEY = 'AIzaSyDjezSoagwe3_uQbA-PeN_H5fDKDNyoaWU';

/**
 * Searches YouTube for a track and returns the top result data.
 * @param {string} searchQuery - The name of the song or artist you want to find.
 */
async function searchYouTubeTrack(searchQuery) {
    // encodeURIComponent safely formats spaces and symbols (e.g., "Daoko Fireworks" -> "Daoko%20Fireworks")
    const safeQuery = encodeURIComponent(searchQuery);

    // This URL asks YouTube for the top 1 video result matching your search
    const endpointUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${safeQuery}&type=video&key=${YOUTUBE_API_KEY}`;

    try {
        console.log(`📡 Sending signal to YouTube for: "${searchQuery}"...`);

        // Wait for Google's servers to respond
        const response = await fetch(endpointUrl);
        const data = await response.json();

        // Safety Check: Did YouTube reject our key or send an error?
        if (data.error) {
            console.error("❌ YouTube API Error:", data.error.message);
            return null;
        }

        // Success! Grab the top result
        if (data.items && data.items.length > 0) {
            const topResult = data.items[0];
            
            // Extract the exact data we care about
            const trackData = {
                title: topResult.snippet.title,
                videoId: topResult.id.videoId,
                coverArt: topResult.snippet.thumbnails.high.url,
                channel: topResult.snippet.channelTitle
            };

            console.log("✅ Match Found System:", trackData);
            
            // Returns the data so your player.js can eventually use it!
            return trackData; 
        } else {
            console.warn("⚠️ No signals found on YouTube for that search.");
            return null;
        }

    } catch (networkError) {
        console.error("💥 Critical Failure: Could not reach YouTube servers.", networkError);
    }
}