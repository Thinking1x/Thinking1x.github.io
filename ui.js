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
    const viewTitle = document.getElementById('viewTitle');
    const navHome = document.getElementById('navHome');
    const navAllTracks = document.getElementById('navAllTracks');

    // Failsafe checks
    if (!homeView || !databaseView) return;

    // Remove active classes
    if (navHome) navHome.classList.remove('active');
    if (navAllTracks) navAllTracks.classList.remove('active');

    if (viewName === 'home') {
        // Show Home HUD
        homeView.style.display = 'block';
        databaseView.style.display = 'none';
        
        if (navHome) navHome.classList.add('active');
        if (viewTitle) viewTitle.innerText = "Discover Signals"; 
        
    } else if (viewName === 'database') {
        // Show Database List
        homeView.style.display = 'none';
        databaseView.style.display = 'block';
        
        // Only highlight the main database button if we aren't looking at a specific playlist
        if (currentViewPlaylistIndex === -1 && navAllTracks) {
            navAllTracks.classList.add('active');
            if (viewTitle) viewTitle.innerText = "All Tracks";
        }
    }
};

function renderPlaylists() {
    const container = document.getElementById('playlists');
    if (!container) return;
    container.innerHTML = '';

    userPlaylists.forEach((pl, index) => {
        const div = document.createElement('div');
        div.className = `playlist-item ${currentViewPlaylistIndex === index ? 'active' : ''}`;

        const isMine = (pl.owner === currentUser);

        if (isMine) {
            div.innerHTML = `<i class="fas fa-folder-open"></i> ${pl.name}`;
        } else {
            div.innerHTML = `
                <i class="fas fa-lock" style="color: var(--error); font-size: 0.85rem;"></i> 
                <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pl.name}</span>
                <span style="font-size: 0.7rem; color: var(--text-sub); font-weight: bold; text-transform: uppercase;">${pl.owner}</span>
            `;
        }

        div.onclick = () => loadPlaylist(index);
        container.appendChild(div);
    });
}

function showAllTracks() {
    currentViewPlaylistIndex = -1;
    
    // Force the view to switch to the database screen
    switchView('database');
    
    const editBtn = document.getElementById('editPlaylistBtn');
    if (editBtn) editBtn.classList.add('hidden');
    
    currentPlaylistTracks = [...allTracks];
    renderPlaylists();
    renderTrackList();
}

function loadPlaylist(index) {
    currentViewPlaylistIndex = index;
    const pl = userPlaylists[index];
    
    // Force the view to switch to the database screen
    switchView('database');
    
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

        // Note: The adminDeleteBtn code safely lives HERE inside the loop where "track" exists!
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
// DYNAMIC GENRE SHELVES
// ==========================================
function renderGenreShelves() {
    // 1. Find the main canvas where shelves live
    const canvas = document.querySelector('.hud-feed-canvas');
    if (!canvas) return;

    // 2. Clear out any old dynamic shelves first (so they don't duplicate)
    document.querySelectorAll('.dynamic-shelf').forEach(shelf => shelf.remove());

    // 3. Define the categories you want to generate shelves for
    const targetGenres = ['J-POP', 'US-UK', 'OST', 'Other'];

    targetGenres.forEach(genre => {
        // Filter tracks that match this specific genre
        const genreTracks = allTracks.filter(track => track.genre === genre);
        
        // If there are no songs in this category yet, skip building the shelf
        if (genreTracks.length === 0) return;

        // Build the shelf HTML
        const shelf = document.createElement('section');
        shelf.className = 'hud-shelf dynamic-shelf'; // Tagged as dynamic
        
        let cardsHTML = '';
        
        // Build a card for each track in this genre
        genreTracks.forEach(track => {
            // Find the global index so the play button works
            const globalIndex = allTracks.findIndex(t => t.id === track.id);
            
            // Fallback image if track doesn't have a specific cover
            const coverArt = track.coverUrl || `https://via.placeholder.com/180/1a1b26/00e5ff?text=${encodeURIComponent(track.name.substring(0, 3))}`;

            cardsHTML += `
                <div class="music-card" onclick="loadTrack(${globalIndex}, true)">
                    <div class="card-cover-wrapper">
                        <img src="${coverArt}" alt="Cover" class="card-cover">
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
                <a href="#" class="view-all" onclick="showAllTracks()">View All</a>
            </div>
            <div class="shelf-grid">
                ${cardsHTML}
            </div>
        `;

        canvas.appendChild(shelf);
    });
}
// Example logic for your renderPlaylists() function:
// Add this helper function to ui.js
function getPlaylistCover(playlist) {
    // Get the actual track objects for this playlist
    const plTracks = allTracks.filter(track => playlist.ids.includes(track.id));
    
    if (plTracks.length >= 4) {
        // Build the iTunes-style 4-image mosaic using placehold.co as fallbacks
        return `
            <div class="mosaic-cover" style="width:40px; height:40px; border-radius:4px; overflow:hidden;">
                <img src="${plTracks[0].cover || 'https://placehold.co/80x80/1a1b26/00e5ff?text=1'}">
                <img src="${plTracks[1].cover || 'https://placehold.co/80x80/1a1b26/00e5ff?text=2'}">
                <img src="${plTracks[2].cover || 'https://placehold.co/80x80/1a1b26/00e5ff?text=3'}">
                <img src="${plTracks[3].cover || 'https://placehold.co/80x80/1a1b26/00e5ff?text=4'}">
            </div>
        `;
    } else if (plTracks.length > 0) {
        // Just use the first song's cover if less than 4
        return `<img src="${plTracks[0].cover || 'https://placehold.co/160x160/1a1b26/00e5ff?text=Mix'}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">`;
    } else {
        // Empty playlist cover
        return `<img src="https://placehold.co/160x160/1a1b26/333?text=Empty" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">`;
    }
}

// Update your existing renderPlaylists in ui.js
function renderPlaylists() {
    const container = document.getElementById('playlists');
    if (!container) return;
    container.innerHTML = '';

    userPlaylists.forEach((pl, index) => {
        const div = document.createElement('div');
        div.className = `playlist-item ${currentViewPlaylistIndex === index ? 'active' : ''}`;
        
        // Generate the dynamic cover art!
        const coverArtHTML = getPlaylistCover(pl);

        const isMine = (pl.owner === currentUser);

        if (isMine) {
            // Using Flexbox to align the cover art and the playlist name
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