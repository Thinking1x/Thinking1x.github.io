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
// DYNAMIC GENRE SHELVES (UPGRADED)
// ==========================================
function renderGenreShelves() {
    const canvas = document.querySelector('.hud-feed-canvas');
    if (!canvas) return;

    // Remove old dynamic shelves
    document.querySelectorAll('.dynamic-shelf').forEach(shelf => shelf.remove());

    if (!allTracks || allTracks.length === 0) {
        console.log("No tracks available to build shelves.");
        return;
    }

    // 1. Automatically find all unique genres that actually exist in your database!
    const uniqueGenres = [...new Set(allTracks.map(track => {
        // Standardize the text: make it uppercase and handle empty genres
        return track.genre ? track.genre.trim().toUpperCase() : 'UNCATEGORIZED';
    }))];

    console.log("Detected Genres in Database:", uniqueGenres);

    // 2. Build a shelf for every genre found
    uniqueGenres.forEach(genre => {
        
        // Filter tracks matching this genre (case-insensitive)
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
            
            // Bulletproof Cover Art Fallback
            const coverArtHTML = track.cover && !track.cover.includes('placeholder')
                ? `<img src="${track.cover}" alt="Cover" class="card-cover">`
                : `<div class="card-cover" style="display:flex; justify-content:center; align-items:center; background:#1a1b26; border:1px solid rgba(255,255,255,0.05);"><i class="fas fa-music" style="font-size:2rem; color:rgba(255,255,255,0.2);"></i></div>`;

            cardsHTML += `
                <div class="music-card" onclick="loadTrack(${globalIndex}, true)">
                    <div class="card-cover-wrapper">
                        https://ui-avatars.com/api/?name=User&background=00e5ff&color=000
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
// Example logic for your renderPlaylists() function:
// Add this helper function to ui.js
function getPlaylistCover(playlist) {
    const plTracks = allTracks.filter(track => playlist.ids.includes(track.id));
    
    const fallback = (letter) => 
        `https://i.ebayimg.com/images/g/JKAAAeSwqtZpbYnr/s-l1200.jpg`;

    if (plTracks.length >= 4) {
        const imgs = plTracks.slice(0, 4).map((t, i) => 
            `<img src="${t.cover || fallback(i+1)}" 
                  style="width:20px; height:20px; object-fit:cover; display:block;"
                  onerror="this.src='${fallback(i+1)}'">` 
        ).join('');
        
        return `
            <div style="
                display:grid; 
                grid-template-columns:1fr 1fr; 
                width:40px; height:40px; 
                border-radius:4px; 
                overflow:hidden; 
                flex-shrink:0;">
                ${imgs}
            </div>`;

    } else if (plTracks.length > 0) {
        const cover = plTracks[0].cover || fallback('♪');
        return `<img src="${cover}" 
                     style="width:40px; height:40px; border-radius:4px; object-fit:cover; flex-shrink:0;"
                     onerror="this.src='${fallback('♪')}'">`;
    } else {
        return `<img src="${fallback('?')}" 
                     style="width:40px; height:40px; border-radius:4px; object-fit:cover; flex-shrink:0;">`;
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