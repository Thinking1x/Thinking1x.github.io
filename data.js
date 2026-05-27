// ==========================================
// DATA.JS — Appwrite Fetching, Playlists, Upload & Admin
// ==========================================



async function fetchTracks() {
    try {
        let jwtToken = '';
        try {
            const jwt = await account.createJWT();
            jwtToken = jwt.jwt;
        } catch (jwtError) {
            console.warn('JWT generation failed:', jwtError.message);
        }

        const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
            Query.orderAsc("$createdAt"),
            Query.limit(500)
        ]);

        allTracks = response.documents.map(doc => ({
            id: doc.$id,
            name: doc.name,
            artist: doc.artist,
            genre: doc.genre,
            file: jwtToken ? `${doc.fileUrl}&jwt=${jwtToken}` : doc.fileUrl,
            cover: doc.coverUrl || "https://i.ebayimg.com/images/g/JKAAAeSwqtZpbYnr/s-l1200.jpg"
        }));

        if (allTracks.length > 0 && !audio.src) {
            if (typeof loadTrack === 'function') loadTrack(0, false);
        }

        if (currentViewPlaylistIndex === -1) {
            currentPlaylistTracks = [...allTracks];
        } else {
            if (typeof loadPlaylist === 'function') loadPlaylist(currentViewPlaylistIndex);
        }

        if (typeof renderTrackList === 'function') renderTrackList();

        // ✅ NOW render genre shelves — tracks are ready
        if (typeof renderGenreShelves === 'function') renderGenreShelves();

        // ✅ NOW fetch playlists — allTracks is populated so covers will work
        await fetchPlaylists();

    } catch (error) {
        console.error("Appwrite Fetch Error:", error);
    }
if (typeof renderGenreShelves === 'function') renderGenreShelves();
await fetchPlaylists();
}
async function fetchPlaylists() {
    try {
        let queries = [];
        if (currentUserRole !== 'admin') {
            queries.push(Query.equal("owner", currentUser));
        }

        const response = await databases.listDocuments(DATABASE_ID, PLAYLIST_COLLECTION_ID, queries);

        userPlaylists = response.documents.map(doc => ({
            id: doc.$id, name: doc.name, ids: doc.trackIds, owner: doc.owner || 'unknown'
        }));

        if (typeof renderPlaylists === 'function') renderPlaylists();
    } catch (error) {
        console.error("Playlist Fetch Error:", error);
    }
}

// ==========================================
// PLAYLIST MODAL LOGIC
// ==========================================

function openPlaylistModal() {
    document.getElementById('modalTitle').innerText = 'CREATE NEW PLAYLIST';
    document.getElementById('newPlaylistName').value = '';
    document.getElementById('editPlaylistIndex').value = -1;
    buildModalTrackList([]);
    document.getElementById('playlistModal').classList.remove('hidden');
}

function openEditModal() {
    if (currentViewPlaylistIndex === -1) return alert("Please select a collection first.");
    const pl = userPlaylists[currentViewPlaylistIndex];
    document.getElementById('modalTitle').innerText = `EDITING: ${pl.name.toUpperCase()}`;
    document.getElementById('newPlaylistName').value = pl.name;
    document.getElementById('editPlaylistIndex').value = currentViewPlaylistIndex;
    buildModalTrackList(pl.ids);
    document.getElementById('playlistModal').classList.remove('hidden');
}

function buildModalTrackList(selectedIds) {
    const trackArea = document.getElementById('modalTrackSelection');
    if (!trackArea) return;
    trackArea.innerHTML = '';
    allTracks.forEach((track) => {
        const isChecked = selectedIds.includes(track.id) ? 'checked' : '';
        const label = document.createElement('label');
        label.className = 'track-checkbox-item';
        label.innerHTML = `
      <input type="checkbox" class="playlist-checkbox" value="${track.id}" ${isChecked}>
      <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${track.name}</span>
      <span class="track-genre">${track.genre}</span>
    `;
        trackArea.appendChild(label);
    });
}

function closePlaylistModal() {
    document.getElementById('playlistModal').classList.add('hidden');
}

async function savePlaylist() {
    const nameInput = document.getElementById('newPlaylistName').value.trim();
    const editIndex = parseInt(document.getElementById('editPlaylistIndex').value);
    const checkboxes = document.querySelectorAll('.playlist-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    if (!nameInput) return alert("Collection name is required.");
    if (selectedIds.length === 0) return alert("Please select at least one signal.");

    try {
        const btn = document.getElementById('modalSaveBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerText = "SAVING...";
        }

        if (editIndex > -1) {
            const playlistId = userPlaylists[editIndex].id;
            await databases.updateDocument(DATABASE_ID, PLAYLIST_COLLECTION_ID, playlistId, {
                name: nameInput, trackIds: selectedIds
            });
        } else {
            await databases.createDocument(DATABASE_ID, PLAYLIST_COLLECTION_ID, ID.unique(), {
                name: nameInput, trackIds: selectedIds, owner: currentUser
            });
        }

        closePlaylistModal();
        await fetchPlaylists();
        if (editIndex > -1 && typeof loadPlaylist === 'function') loadPlaylist(editIndex);

        if (btn) {
            btn.disabled = false;
            btn.innerText = "Save Playlist";
        }
    } catch (error) {
        alert("Database Error: " + error.message);
        const btn = document.getElementById('modalSaveBtn');
        if (btn) btn.disabled = false;
    }
}

// ==========================================
// UPLOAD LOGIC
// ==========================================

function openUploadModal() {
    document.getElementById('uploadModal').classList.remove('hidden');
    
    const status = document.getElementById('uploadStatus');
    if (status) status.innerText = "";
    
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if (fileNameDisplay) fileNameDisplay.innerText = "";
    
    const fileInput = document.getElementById('uploadFileInput');
    if (fileInput) fileInput.value = "";
    
    const trackInput = document.getElementById('uploadTrackName');
    if (trackInput) trackInput.value = "";
    
    const artistInput = document.getElementById('uploadArtistName');
    if (artistInput) artistInput.value = "";
    
    const genreInput = document.getElementById('uploadGenre');
    if (genreInput) genreInput.value = "J-POP";
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const uploadFileInput = document.getElementById('uploadFileInput');

    if (dropZone && uploadFileInput) {
        dropZone.addEventListener('click', () => uploadFileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                uploadFileInput.files = e.dataTransfer.files;
                handleFileSelection();
            }
        });
        uploadFileInput.addEventListener('change', handleFileSelection);
    }
});

function handleFileSelection() {
    const uploadFileInput = document.getElementById('uploadFileInput');
    if (!uploadFileInput) return;
    
    const files = uploadFileInput.files;
    
    if (files.length > 0) {
        const fileNameDisplay = document.getElementById('fileNameDisplay');
        const trackNameInput = document.getElementById('uploadTrackName');

        // 1. Update the Drop Zone text (Handles single vs batch)
        if (fileNameDisplay) {
            if (files.length === 1) {
                fileNameDisplay.innerText = files[0].name;
            } else {
                fileNameDisplay.innerText = `${files.length} signals ready for upload`;
                fileNameDisplay.style.color = "var(--accent)"; // Give it a nice glow!
            }
        }
        
        // 2. Auto-fill the custom track name
        if (trackNameInput && trackNameInput.value === "") {
            if (files.length === 1) {
                // Strips ANY extension (.mp3, .flac, .wav) using Regex!
                trackNameInput.value = files[0].name.replace(/\.[^/.]+$/, "");
            } else {
                // If it's a batch upload, we shouldn't force them all to have the same name.
                // The triggerUpload loop will automatically use their individual file names.
                trackNameInput.value = ""; 
                trackNameInput.placeholder = "Auto-naming from files...";
            }
        }
    }
}

// ==========================================
// BULLETPROOF UPLOAD FUNCTION (NO TIMERS)
// ==========================================
async function triggerUpload() {
    const btn = document.getElementById('startUploadBtn');
    if (btn) btn.disabled = true;

    const fileInput = document.getElementById('uploadFileInput');
    const files = fileInput ? fileInput.files : [];
    
    const artistInput = document.getElementById('uploadArtistName');
    const artistName = artistInput && artistInput.value.trim() !== "" ? artistInput.value.trim() : "Unknown Artist";
    
    const genreInput = document.getElementById('uploadGenre');
    const genre = genreInput ? genreInput.value : "J-POP";
    
    const trackInput = document.getElementById('uploadTrackName');
    const customTrackName = trackInput ? trackInput.value.trim() : "";

    const status = document.getElementById('uploadStatus');

    if (files.length === 0) {
        alert("Please select at least one file.");
        if (btn) btn.disabled = false;
        return;
    }

    try {
        let successCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            let trackName;
            if (files.length === 1 && customTrackName !== "") {
                trackName = customTrackName;
            } else {
                trackName = file.name.replace(/\.[^/.]+$/, "");
            }

            if(status) {
                status.innerText = `UPLOADING [${i + 1}/${files.length}]: ${trackName}...`;
                status.style.color = "var(--accent)";
            }

            const uploadedFile = await storage.createFile(BUCKET_ID, ID.unique(), file);
            const fileResult = storage.getFileView(BUCKET_ID, uploadedFile.$id);

            if(status) status.innerText = `MATCHING ARTWORK [${i + 1}/${files.length}]: ${trackName}...`;
            let fetchedCover = await fetchCoverArt(trackName, artistName);

            if (!fetchedCover) {
                fetchedCover = "https://via.placeholder.com/600x600/0f172a/00ffcc?text=NO+COVER+DETECTED";
            }

            if(status) status.innerText = `SYNCING [${i + 1}/${files.length}]: ${trackName}...`;
            
            // Send the data to Appwrite without any expiration time
            await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
                name: trackName,
                artist: artistName,
                genre: genre,
                fileUrl: fileResult.href,
                coverUrl: fetchedCover
            });

            successCount++;
        }

        if(status) {
            status.innerText = `TRANSMISSION COMPLETE. ${successCount} signals added.`;
            status.style.color = "var(--success)";
        }

        setTimeout(() => {
            closeUploadModal();
            fetchTracks(); 
            
            if (btn) btn.disabled = false;
            
            if (fileInput) fileInput.value = "";
            if (trackInput) trackInput.value = ""; 
        }, 2000);

    } catch (error) {
        console.error("BATCH UPLOAD ERROR:", error);
        if(status) {
            status.innerText = "FAILED: " + (error.message || "Connection Lost");
            status.style.color = "var(--error)";
        }
        if (btn) btn.disabled = false;
    }
}


// ==========================================
// iTUNES API ARTWORK MATCHER (SUPER SMART VERSION)
// ==========================================

async function fetchCoverArt(trackName, artistName) {
    try {
        // 1. Basic Scrubbing
        let searchArtist = artistName.toLowerCase().includes('unknown') ? '' : artistName;
        let searchTrack = trackName.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/-\d+/g, '').trim();

        // --- ATTEMPT 1: Exact Match ---
        let rawQuery1 = `${searchTrack} ${searchArtist}`.trim();
        console.log(`🔍 iTunes Attempt 1: "${rawQuery1}"`); 
        
        let res1 = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(rawQuery1)}&entity=song&limit=1`);
        let data1 = await res1.json();

        if (data1.results && data1.results.length > 0) {
            return data1.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
        }

        // --- ATTEMPT 2: Relaxed Match (Drop the feature artists) ---
        // Apple HATES "&", "feat.", or "x". Let's grab just the primary artist.
        let primaryArtist = searchArtist.split(/&|feat\.?|ft\.?| x |,/i)[0].trim();
        
        // Only try again if chopping the artist name actually changed something
        if (primaryArtist !== searchArtist && primaryArtist.length > 0) {
            let rawQuery2 = `${searchTrack} ${primaryArtist}`.trim();
            console.log(`⚠️ Attempt 1 failed. iTunes Attempt 2 (Relaxed): "${rawQuery2}"`);
            
            let res2 = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(rawQuery2)}&entity=song&limit=1`);
            let data2 = await res2.json();

            if (data2.results && data2.results.length > 0) {
                return data2.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
            }
        }

        return null; // iTunes officially doesn't have it
    } catch (error) {
        console.error("iTunes Match Failed:", error);
        return null;
    }
}

// ==========================================
// ADMIN FUNCTIONS (Security Clearance)
// ==========================================

async function fetchUsersForAdmin() {
    if (currentUserRole !== 'admin') return [];
    try {
        const response = await databases.listDocuments(DATABASE_ID, USERS_COLLECTION_ID);
        return response.documents; 
    } catch (error) {
        console.error("Admin Fetch Error:", error);
        return [];
    }
}

async function grantTemporaryUpload(targetUserId, hours) {
    try {
        const expirationTime = Date.now() + (hours * 60 * 60 * 1000);
        await databases.updateDocument(DATABASE_ID, USERS_COLLECTION_ID, targetUserId, {
            uploadAccessUntil: expirationTime
        });
        alert("Clearance granted for " + hours + " hours.");
    } catch (error) {
        console.error("Grant Access Error:", error);
        alert("Failed to grant clearance. Check console.");
    }
}
// ==========================================
// ADMIN: PERMANENTLY DELETE TRACK
// ==========================================
async function deleteTrack(trackId, trackName) {
    // 1. Security Check: Only admins can do this
    if (currentUserRole !== 'admin') return alert("Security Clearance Required.");
    
    // 2. Final Warning Check
    if (!confirm(`CRITICAL WARNING: Are you absolutely sure you want to PERMANENTLY delete "${trackName}" from the database? This cannot be undone.`)) return;

    try {
        // 3. Vaporize the document from the Appwrite Database
        await databases.deleteDocument(DATABASE_ID, COLLECTION_ID, trackId);
        
        // 4. Refresh the track list so it vanishes from the screen
        fetchTracks(); 
        
        // Optional: Let the admin know it worked
        console.log(`[SYSTEM] Signal "${trackName}" permanently erased.`);
    } catch (error) {
        console.error("Delete Error:", error);
        alert("Failed to delete signal. Check console.");
    }
}
async function getFileUrl(fileId) {
    const jwt = await account.createJWT();
    return `https://sgp.cloud.appwrite.io/v1/storage/buckets/6a05cdb0000bc961b45f/files/${fileId}/view?project=6a05cc27002debbf6591&jwt=${jwt.jwt}`;
}
// ==========================================
// ONE-TIME ITUNES AUTO-PATCHER
// ==========================================
async function patchMissingCovers() {
    // 1. Security check
    if (currentUserRole !== 'admin') {
        return alert("Security Clearance Required.");
    }

    console.log("🚀 Starting iTunes Auto-Patcher...");
    let successCount = 0;

    for (let i = 0; i < allTracks.length; i++) {
        let track = allTracks[i];

        // 2. Look for tracks with broken placeholder images
        if (!track.cover || track.cover.includes('placeholder')) {
            console.log(`Searching iTunes for [${i+1}/${allTracks.length}]: ${track.name} by ${track.artist}`);

            // 3. Ask iTunes for the cover art
            let newCover = await fetchCoverArt(track.name, track.artist);

            if (newCover) {
                console.log(`✅ Found! Saving to database...`);
                try {
                    // 4. Permanently update the document in Appwrite
                    await databases.updateDocument(DATABASE_ID, COLLECTION_ID, track.id, {
                        coverUrl: newCover
                    });
                    successCount++;
                } catch (error) {
                    console.error("Failed to save to Appwrite:", error);
                }
            } else {
                console.log(`❌ No artwork found on iTunes for this track.`);
            }

            // 5. CRITICAL: Wait 2 seconds before the next search so Apple doesn't block us!
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`🎉 Auto-Patcher Finished! Successfully fixed ${successCount} signals.`);
    alert(`Patcher finished. Fixed ${successCount} signals. Refreshing database...`);
    
    // Refresh the screen to show the new artwork
    fetchTracks(); 
}