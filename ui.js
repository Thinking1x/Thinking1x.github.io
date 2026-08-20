// ==========================================
// UI.JS — Render Functions, Views & Search
// ==========================================
// Depends on: config.js, data.js (fetchPlaylists), player.js (loadTrack)

// ==========================================
// UI — VIEWS & NAVIGATION
// ==========================================

window.switchView = function(viewName) {
    const homeView = document.getElementById('homeView');
    const databaseView = document.getElementById('databaseView');
    const nowPlayingView = document.getElementById('nowPlayingView'); // NEW: Soundwave view
    const viewTitle = document.getElementById('viewTitle');
    
    const navHome = document.getElementById('navHome');
    const navAllTracks = document.getElementById('navAllTracks');
    const navNowPlaying = document.getElementById('navNowPlaying'); // NEW: Nav button

    // 1. Hide all views
    if (homeView) homeView.style.display = 'none';
    if (databaseView) databaseView.style.display = 'none';
    if (nowPlayingView) nowPlayingView.style.display = 'none';

    // 2. Remove active state from all sidebar navigation items
    document.querySelectorAll('.nav-links .nav-item').forEach(el => el.classList.remove('active'));

    // 3. Route to the requested view
    if (viewName === 'home') {
        if (homeView) homeView.style.display = 'block';
        if (navHome) navHome.classList.add('active');
        if (viewTitle) viewTitle.innerText = "Discover Signals"; 
        
    } else if (viewName === 'database') {
        if (databaseView) databaseView.style.display = 'block';
        
        // Only highlight the main database button if we aren't looking at a specific playlist
        if (currentViewPlaylistIndex === -1 && navAllTracks) {
            navAllTracks.classList.add('active');
            if (viewTitle) viewTitle.innerText = "All Tracks";
        }
        
    } else if (viewName === 'nowPlaying') {
        if (nowPlayingView) nowPlayingView.style.display = 'block';
        if (navNowPlaying) navNowPlaying.classList.add('active');
        if (viewTitle) viewTitle.innerText = "Now Playing";
        
        // CRITICAL: The canvas will render at 0px width if it is drawn while hidden (display: none).
        // This forces the soundwave to recalculate its width the moment the view becomes visible.
        const waveCanvas = document.getElementById('soundwave-canvas');
        if (typeof resizeWaveCanvas === 'function' && waveCanvas) {
            resizeWaveCanvas(waveCanvas);
        }
    }
};

// ==========================================
// PLAYLIST RENDERING & COVERS
// ==========================================

function getPlaylistCover(playlist) {
    const plTracks = allTracks.filter(track => playlist.ids.includes(track.id));
    
    // Default backup image link
    const defaultImg = "https://i.imgur.com/YourCustomImage.png"; 

    if (plTracks.length > 0) {
        // Use the first song's cover, scaled down perfectly for the sidebar
        const singleCover = plTracks[0].cover && !plTracks[0].cover.includes('placeholder') ? plTracks[0].cover : defaultImg;
        return `<img src="${singleCover}" style="width:24px; height:24px; border-radius:4px; object-fit:cover; flex-shrink:0;">`;
    } else {
        // Empty playlist cover (Small CSS Icon)
        return `
            <div style="width:24px; height:24px; border-radius:4px; background:#1a1b26; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.05); flex-shrink:0;">
                <i class="fas fa-music" style="color:var(--text-sub); font-size: 0.7rem;"></i>
            </div>
        `;
    }
}

function renderPlaylists() {
    const container = document.getElementById('playlists');
    if (!container) return;
    container.innerHTML = '';

    userPlaylists.forEach((pl, index) => {
        const div = document.createElement('div');
        div.className = `playlist-item ${currentViewPlaylistIndex === index ? 'active' : ''}`;
        
        const coverArtHTML = getPlaylistCover(pl);
        const isMine = (pl.owner === currentUser);

        if (isMine) {
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; width:100%;">
                    ${coverArtHTML}
                    <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${pl.name}</span>
                </div>
            `;
        } else {
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; width:100%;">
                     ${coverArtHTML}
                    <i class="fas fa-lock" style="color: var(--error); font-size: 0.85rem;"></i> 
                    <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pl.name}</span>
                    <span style="font-size: 0.7rem; color: var(--text-sub); font-weight: bold; text-transform: uppercase;">${pl.owner}</span>
                </div>
            `;
        }

        div.onclick = () => loadPlaylist(index);
        container.appendChild(div);
    });
}

// ==========================================
// TRACK LIST RENDERING
// ==========================================

function showAllTracks() {
    currentViewPlaylistIndex = -1;
    switchView('database'); // Force view switch
    
    const editBtn = document.getElementById('editPlaylistBtn');
    if (editBtn) editBtn.classList.add('hidden');
    
    currentPlaylistTracks = [...allTracks];
    renderPlaylists();
    renderTrackList();
}

function loadPlaylist(index) {
    currentViewPlaylistIndex = index;
    const pl = userPlaylists[index];
    
    switchView('database'); // Force view switch
    
    const viewTitle = document.getElementById('viewTitle');
    if (viewTitle) viewTitle.innerText = pl.name;

    const editBtn = document.getElementById('editPlaylistBtn');
    if (editBtn) {
        if (pl.owner === currentUser) {
            editBtn.classList.remove('hidden');
        } else {
            editBtn.classList.add('hidden');
        }
    }

    currentPlaylistTracks = allTracks.filter(track => pl.ids.includes(track.id));
    renderPlaylists();
    renderTrackList();
}

function renderTrackList() {
    const list = document.getElementById('trackList');
    if (!list) return;
    list.innerHTML = '';

    if (currentPlaylistTracks.length === 0) {
        list.innerHTML = '<div style="color:var(--text-sub); padding:16px;">No signals detected.</div>';
        return;
    }

    currentPlaylistTracks.forEach((track, index) => {
        const div = document.createElement('div');
        div.className = 'track';

        // Check if this track is the one currently playing
        const isPlaying = allTracks[currentTrackIndex] && allTracks[currentTrackIndex].id === track.id;
        if (isPlaying) div.classList.add('active');

        const adminDeleteBtn = (currentUserRole === 'admin')
            ? `<button onclick="event.stopPropagation(); deleteTrack('${track.id}', '${track.name}')"
                       style="background:none; border:none; color:#ef4444; cursor:pointer; padding:5px; margin-left:10px;"
                       title="Permanently Delete Signal">
                   <i class="fas fa-trash-alt"></i>
               </button>`
            : '';

        div.innerHTML = `
            <div class="track-num">${isPlaying ? '<i class="fas fa-volume-up"></i>' : index + 1}</div>
            <div class="track-info">
                <span class="track-title">${track.name}</span>
                <span class="track-meta">${track.artist}</span>
            </div>
            <div class="track-action">
                ${adminDeleteBtn}
            </div>
        `;

        const originalIndex = allTracks.findIndex(t => t.id === track.id);
        div.onclick = () => loadTrack(originalIndex, true);
        list.appendChild(div);
    });
}

// ==========================================
// DYNAMIC GENRE SHELVES (HUD)
// ==========================================

function renderGenreShelves() {
    const canvas = document.querySelector('.hud-feed-canvas');
    if (!canvas) return;

    // Remove old dynamic shelves
    document.querySelectorAll('.hud-shelf').forEach(shelf => shelf.remove());

    if (!allTracks || allTracks.length === 0) return;

    // --- 1. RECENTLY TRANSMITTED SHELF ---
    const recentTracks = [...allTracks].reverse().slice(0, 6);

    if (recentTracks.length > 0) {
        const recentShelf = document.createElement('section');
        recentShelf.className = 'hud-shelf dynamic-shelf';
        
        let recentHTML = '';
        recentTracks.forEach(track => {
            const globalIndex = allTracks.findIndex(t => t.id === track.id);
            const hasCover = track.cover && !track.cover.includes('placeholder') && track.cover !== 'NULL';
            
            let coverArtHTML = hasCover 
                ? `<img src="${track.cover}" alt="Cover" class="card-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="card-cover" style="display:none; justify-content:center; align-items:center; background:#1a1a1a; border: 1px solid #333; width: 100%; height: 100%;">
                       <i class="fas fa-compact-disc" style="font-size:2.5rem; color:rgba(255,255,255,0.15);"></i>
                   </div>`
                : `<div class="card-cover" style="display:flex; justify-content:center; align-items:center; background:#1a1a1a; border: 1px solid #333; width: 100%; height: 100%;">
                       <i class="fas fa-compact-disc" style="font-size:2.5rem; color:rgba(255,255,255,0.15);"></i>
                   </div>`;

            recentHTML += `
                <div class="music-card" onclick="loadTrack(${globalIndex}, true)">
                    <div class="card-cover-wrapper">
                        ${coverArtHTML}
                        <button class="card-play-btn"><i class="fas fa-play"></i></button>
                    </div>
                    <div class="card-meta">
                        <span class="card-title">${track.name}</span>
                        <span class="card-subtitle">${track.artist}</span>
                    </div>
                </div>
            `;
        });

        recentShelf.innerHTML = `
            <div class="shelf-header">
                <h2>Recently Transmitted</h2>
                <a href="#" class="view-all" onclick="showAllTracks()">View Database</a>
            </div>
            <div class="shelf-grid">
                ${recentHTML}
            </div>
        `;
        canvas.appendChild(recentShelf);
    }

    // --- 2. DYNAMIC GENRE SHELVES ---
    const uniqueGenres = [...new Set(allTracks.map(track => {
        return track.genre ? track.genre.trim().toUpperCase() : 'UNCATEGORIZED';
    }))];

    uniqueGenres.forEach(genre => {
        const genreTracks = allTracks.filter(track => {
            const trackG = track.genre ? track.genre.trim().toUpperCase() : 'UNCATEGORIZED';
            return trackG === genre;
        });
        
        if (genreTracks.length === 0) return;

        const shelf = document.createElement('section');
        shelf.className = 'hud-shelf dynamic-shelf';
        
        let cardsHTML = '';
        
        genreTracks.forEach(track => {
            const globalIndex = allTracks.findIndex(t => t.id === track.id);
            const hasCover = track.cover && !track.cover.includes('placeholder') && track.cover !== 'NULL';
            
            let coverArtHTML = hasCover 
                ? `<img src="${track.cover}" alt="Cover" class="card-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="card-cover" style="display:none; justify-content:center; align-items:center; background:#1a1a1a; border: 1px solid #333; width: 100%; height: 100%;">
                       <i class="fas fa-compact-disc" style="font-size:2.5rem; color:rgba(255,255,255,0.15);"></i>
                   </div>`
                : `<div class="card-cover" style="display:flex; justify-content:center; align-items:center; background:#1a1a1a; border: 1px solid #333; width: 100%; height: 100%;">
                       <i class="fas fa-compact-disc" style="font-size:2.5rem; color:rgba(255,255,255,0.15);"></i>
                   </div>`;

            cardsHTML += `
                <div class="music-card" onclick="loadTrack(${globalIndex}, true)">
                    <div class="card-cover-wrapper">
                        ${coverArtHTML}
                        <button class="card-play-btn"><i class="fas fa-play"></i></button>
                    </div>
                    <div class="card-meta">
                        <span class="card-title">${track.name}</span>
                        <span class="card-subtitle">${track.artist}</span>
                    </div>
                </div>
            `;
        });

        shelf.innerHTML = `
            <div class="shelf-header">
                <h2>${genre} Signals</h2>
                <a href="#" class="view-all" onclick="showAllTracks()">View Database</a>
            </div>
            <div class="shelf-grid">
                ${cardsHTML}
            </div>
        `;

        canvas.appendChild(shelf);
    });
}

// ==========================================
// INSTANT SEARCH ENGINE
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');

    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase().trim();

            if (query === "") {
                showAllTracks(); 
                return;
            }

            // Force the view to global search database
            currentViewPlaylistIndex = -1;
            switchView('database');
            
            const viewTitle = document.getElementById('viewTitle');
            if (viewTitle) viewTitle.innerText = `Search Results: "${query}"`;
            
            const editBtn = document.getElementById('editPlaylistBtn');
            if (editBtn) editBtn.classList.add('hidden');
            
            // Filter the tracks
            currentPlaylistTracks = allTracks.filter(track => {
                const matchName = track.name.toLowerCase().includes(query);
                const matchArtist = track.artist.toLowerCase().includes(query);
                return matchName || matchArtist;
            });

            // Re-render the UI
            renderPlaylists(); 
            renderTrackList(); 
        });
    }
});

// ==========================================
// ADMIN PANEL UI LOGIC
// ==========================================

async function openAdminModal() {
    document.getElementById('adminModal').classList.remove('hidden');
    const userListDiv = document.getElementById('adminUserList');
    
    // Show a loading spinner while fetching users
    userListDiv.innerHTML = '<div style="text-align:center; color:var(--text-sub); padding:20px;"><i class="fas fa-circle-notch fa-spin"></i> Accessing User Database...</div>';

    // fetchUsersForAdmin() comes from data.js
    const users = await fetchUsersForAdmin();
    userListDiv.innerHTML = '';

    if (users.length === 0) {
        userListDiv.innerHTML = '<div style="padding:15px; color:var(--text-sub); text-align:center;">No standard users found.</div>';
        return;
    }

    users.forEach(u => {
        // Skip admins (they already have permanent upload access)
        if (u.role === 'admin') return;

        const div = document.createElement('div');
        div.className = 'user-row';
        
        // Check if their timestamp is currently valid
        const hasAccess = u.uploadAccessUntil && (Date.now() < u.uploadAccessUntil);
        const statusIndicator = hasAccess 
            ? `<span style="color:var(--success); font-size:0.75rem;"><i class="fas fa-check-circle"></i> Upload Active</span>` 
            : `<span style="color:var(--error); font-size:0.75rem;"><i class="fas fa-lock"></i> Upload Locked</span>`;

        div.innerHTML = `
            <div class="user-info-stack">
                <span class="username">${u.username}</span>
                ${statusIndicator}
            </div>
            <button class="btn-grant" onclick="handleGrantAccess('${u.$id}', this)">Grant 12H</button>
        `;
        userListDiv.appendChild(div);
    });
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.add('hidden');
}

// Triggers when you click "Grant 12H" next to a user
async function handleGrantAccess(userId, btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // grantTemporaryUpload() comes from data.js
    await grantTemporaryUpload(userId, 12);
    
    // Visually change the button to show success
    btnElement.innerHTML = "GRANTED";
    btnElement.style.background = "var(--success)";
    btnElement.style.color = "#fff";
    btnElement.style.borderColor = "var(--success)";
}
// ==========================================
// DASHBOARD RENDERING (Spotify-Style Shelves)
// ==========================================

function renderDashboard() {
    const trendingGrid = document.getElementById('trendingGrid');
    const artistsGrid = document.getElementById('artistsGrid');
    const recentGrid = document.getElementById('recentGrid');

    // 1. Render Trending Tracks (Sorted by Play Count)
    if (trendingGrid) {
        const topTracks = getTrendingTracks();
        trendingGrid.innerHTML = topTracks.map(track => {
            const originalIndex = allTracks.findIndex(t => t.id === track.id);
            return `
            <div class="music-card" onclick="loadTrack(${originalIndex}, true)">
                <div class="card-cover-wrapper">
                    <img src="${track.cover}" class="card-cover" alt="Cover">
                    <button class="card-play-btn"><i class="fas fa-play"></i></button>
                </div>
                <div class="card-meta">
                    <span class="card-title">${track.name}</span>
                    <span class="card-subtitle">${track.playCount || 0} Plays</span>
                </div>
            </div>`;
        }).join('');
    }

    // 2. Render Top Artists (Circular Avatars)
    if (artistsGrid) {
        const topArtists = getTopArtists().slice(0, 10); // Show top 10
        artistsGrid.innerHTML = topArtists.map(artist => `
            <div class="music-card" style="align-items: center; text-align: center;">
                <div class="card-cover-wrapper" style="border-radius: 50% !important; overflow: hidden; box-shadow: 0 10px 20px rgba(0,0,0,0.5);">
                    <img src="${artist.cover}" class="card-cover" alt="Artist Avatar" style="border-radius: 50% !important;">
                </div>
                <div class="card-meta" style="align-items: center;">
                    <span class="card-title" style="font-size: 0.95rem;">${artist.name}</span>
                    <span class="card-subtitle" style="color: var(--accent) !important;">${artist.totalPlays} Total Plays</span>
                </div>
            </div>`).join('');
    }

    // 3. Render Recently Transmitted
    if (recentGrid) {
        // Assuming allTracks is already ordered by upload date (newest/oldest) based on your Appwrite query
        const recentTracks = allTracks.slice(0, 10); 
        recentGrid.innerHTML = recentTracks.map(track => {
            const originalIndex = allTracks.findIndex(t => t.id === track.id);
            return `
            <div class="music-card" onclick="loadTrack(${originalIndex}, true)">
                <div class="card-cover-wrapper">
                    <img src="${track.cover}" class="card-cover" alt="Cover">
                    <button class="card-play-btn"><i class="fas fa-play"></i></button>
                </div>
                <div class="card-meta">
                    <span class="card-title">${track.name}</span>
                    <span class="card-subtitle">${track.artist}</span>
                </div>
            </div>`;
        }).join('');
    }
}