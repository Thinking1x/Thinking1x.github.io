// ==========================================
// YOUTUBE API ENGINE & GRID CONTROLLER
// ==========================================

const YOUTUBE_API_KEY = 'AIzaSyDjezSoagwe3_uQbA-PeN_H5fDKDNyoaWU';

const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const videoGrid = document.getElementById('videoGrid');
const sectionTitle = document.getElementById('sectionTitle');

// ==========================================
// 1. RENDER ENGINE (Builds the HTML cards)
// ==========================================
function renderVideoGrid(items, isSearch = false) {
    videoGrid.innerHTML = ''; // Wipes the grid clean

    items.forEach(item => {
        const title = item.snippet.title;
        const channel = item.snippet.channelTitle;
        const thumb = item.snippet.thumbnails.medium.url;
        
        // The API packages IDs differently for Search vs Recommendations
        const vidId = isSearch ? item.id.videoId : item.id;

        // Skip any search results that are Channels or Playlists (we only want Videos)
        if (isSearch && !vidId) return;

        // Build the HTML Card
        const card = document.createElement('a');
        card.href = `https://www.youtube.com/watch?v=${vidId}`;
        card.target = "_blank"; // Opens video in a new tab
        card.className = 'video-card';
        card.innerHTML = `
            <img src="${thumb}" alt="Thumbnail">
            <div class="video-card-info">
                <h3 class="video-card-title">${title}</h3>
                <p class="video-card-channel">${channel}</p>
            </div>
        `;
        
        // Push the card into the grid
        videoGrid.appendChild(card);
    });
}

// ==========================================
// 2. HOMEPAGE RECOMMENDATIONS (Runs on load)
// ==========================================
async function loadRecommendations() {
    sectionTitle.innerText = "Recommended";
    videoGrid.innerHTML = '<p style="color: #aaaaaa;">Loading signals...</p>';

    // Pulls the top 12 trending videos in Vietnam (VN) for just 1 quota unit!
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&maxResults=12&regionCode=VN&key=${YOUTUBE_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items) {
            renderVideoGrid(data.items, false);
        } else {
            videoGrid.innerHTML = '<p style="color: #ff4444;">Failed to load recommendations.</p>';
        }
    } catch (error) {
        console.error(error);
    }
}

// ==========================================
// 3. SEARCH ENGINE (Runs on click)
// ==========================================
async function searchYouTube(query) {
    sectionTitle.innerText = `Search results for "${query}"`;
    videoGrid.innerHTML = '<p style="color: #aaaaaa;">Scanning database...</p>';

    const safeQuery = encodeURIComponent(query);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${safeQuery}&type=video&key=${YOUTUBE_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.items) {
            renderVideoGrid(data.items, true);
        } else {
            videoGrid.innerHTML = '<p style="color: #ff4444;">No signals found.</p>';
        }
    } catch (error) {
        console.error(error);
    }
}

// ==========================================
// 4. EVENT LISTENERS
// ==========================================
searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) searchYouTube(query);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});

// Boot up the recommendations immediately when the script loads!
loadRecommendations();