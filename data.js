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

        allTracks = response.documents.map(doc => {
            let rawCover = doc.coverUrl;
            
            // Your custom CD image fallback
            const defaultImg = "https://i.ebayimg.com/images/g/JKAAAeSwqtZpbYnr/s-l1200.jpg"; 

            // 🛡️ The NULL-Catcher: Intercepts the word 'NULL', empty fields, or placeholders
            let isBroken = false;
            if (!rawCover || rawCover === 'NULL') isBroken = true;
            else if (typeof rawCover === 'string' && rawCover.includes('placeholder')) isBroken = true;

            let finalCover = isBroken ? defaultImg : rawCover;

            return {
                id: doc.$id,
                name: doc.name,
                artist: doc.artist,
                genre: doc.genre,
                file: jwtToken ? `${doc.fileUrl}&jwt=${jwtToken}` : doc.fileUrl,
                cover: finalCover
            };
        });

        if (allTracks.length > 0 && !audio.src) {
            if (typeof loadTrack === 'function') loadTrack(0, false);
        }

        if (currentViewPlaylistIndex === -1) {
            currentPlaylistTracks = [...allTracks];
        } else {
            if (typeof loadPlaylist === 'function') loadPlaylist(currentViewPlaylistIndex);
        }

        if (typeof renderTrackList === 'function') renderTrackList();
        
        // ✅ Render genre shelves — tracks are ready
        if (typeof renderGenreShelves === 'function') renderGenreShelves();

        // ✅ Fetch playlists — allTracks is populated so covers will work
        await fetchPlaylists();

    } catch (error) {
        console.error("Appwrite Fetch Error:", error);
    }
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
// BULLETPROOF UPLOAD FUNCTION (DIRECT R2 WORKER UPLOAD)
// ==========================================
async function triggerUpload() {
    const btn = document.getElementById('startUploadBtn');
    if (btn) btn.disabled = true;

    // 1. Grab the physical file from the file input (Drop Zone)
    const fileInput = document.getElementById('uploadFileInput');
    const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;
    
    const trackInput = document.getElementById('uploadTrackName');
    const trackName = trackInput ? trackInput.value.trim() : "";

    const artistInput = document.getElementById('uploadArtistName');
    const artistName = artistInput && artistInput.value.trim() !== "" ? artistInput.value.trim() : "Unknown Artist";
    
    const genreInput = document.getElementById('uploadGenre');
    const genre = genreInput ? genreInput.value : "J-POP";
    
    const status = document.getElementById('uploadStatus');

    if (!file || !trackName) {
        alert("Please provide both an audio file and a Track Name.");
        if (btn) btn.disabled = false;
        return;
    }

    try {
        // --- STEP 1: UPLOAD PHYSICAL FILE TO CLOUDFLARE WORKER ---
        if(status) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            status.innerText = `UPLOADING TO R2 CLOUD: ${fileSizeMB}MB...`;
            status.style.color = "var(--accent)";
        }

        // ⚠️ IMPORTANT: Replace this with the URL of your deployed Cloudflare Worker!
        const workerUploadEndpoint = "https://mybucket.dinhgiathinh1234567.workers.dev";
        
        // Clean the filename
        const safeFileName = encodeURIComponent(file.name.replace(/\s+/g, '_'));

        // Send the raw file directly via PUT request (with cache buster!)
        const uploadResponse = await fetch(`${workerUploadEndpoint}/${safeFileName}?t=${Date.now()}`, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type || 'audio/mpeg'
            }
        });

        if (!uploadResponse.ok) {
            throw new Error(`Cloudflare Upload Failed: ${uploadResponse.statusText}`);
        }

        // The Worker successfully uploaded the file and returns the shiny new public URL!
        const uploadData = await uploadResponse.json();
        const r2Url = uploadData.fileUrl; 

        // --- STEP 2: FETCH ARTWORK ---
        if(status) {
            status.innerText = `MATCHING ARTWORK: ${trackName}...`;
        }
        
        let fetchedCover = await fetchCoverArt(trackName, artistName);
        if (!fetchedCover) {
            // Fallback cover if iTunes can't find it
            fetchedCover = "https://via.placeholder.com/600x600/09090e/00e5ff?text=NO+COVER+DETECTED";
        }

        // --- STEP 3: SAVE TO APPWRITE DATABASE ---
        if(status) {
            status.innerText = `SAVING TO DATABASE...`;
        }
        
        await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
            name: trackName,
            artist: artistName,
            genre: genre,
            fileUrl: r2Url, // The URL generated automatically by Cloudflare R2!
            coverUrl: fetchedCover
        });

        if(status) {
            status.innerText = `TRANSMISSION COMPLETE. Signal added.`;
            status.style.color = "var(--success)";
        }

        // --- STEP 4: CLEANUP UI ---
        setTimeout(() => {
            closeUploadModal();
            fetchTracks(); // Refresh the list so the new song appears instantly
            
            if (btn) btn.disabled = false;
            if (fileInput) fileInput.value = "";
            const fileNameDisplay = document.getElementById('fileNameDisplay');
            if (fileNameDisplay) fileNameDisplay.innerText = "Drag & Drop MP3/FLAC here or Click to Browse";
            if (trackInput) trackInput.value = ""; 
            if (artistInput) artistInput.value = ""; 
        }, 2000);

    } catch (error) {
        console.error("UPLOAD ERROR:", error);
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

// ==========================================
// iTUNES API ARTWORK MATCHER (ULTIMATE SCRUBBER)
// ==========================================

async function fetchCoverArt(trackName, artistName) {
    try {
        let searchArtist = artistName.toLowerCase().includes('unknown') ? '' : artistName;
        
        // AGGRESSIVE SCRUBBING: Remove file extensions, YT ripper tags, and underscores
        let searchTrack = trackName
            .replace(/\.[^/.]+$/, "") // Removes .mp3, .wav, etc.
            .replace(/_Audio_.*/ig, '') // Removes _Audio_128k
            .replace(/_Official.*/ig, '') // Removes _Official Music Video
            .replace(/_Visualizer.*/ig, '') // Removes _Visualizer
            .replace(/_/g, ' ') // Turns underscores into spaces
            .replace(/\(.*?\)/g, '') // Removes (slowed)
            .replace(/\[.*?\]/g, '') // Removes [lyrics]
            .replace(/-\d+/g, '') // Removes random ID numbers
            .trim();

        // --- ATTEMPT 1: Exact Match ---
        let rawQuery1 = `${searchTrack} ${searchArtist}`.trim();
        console.log(`🔍 iTunes Attempt 1: "${rawQuery1}"`); 
        
        let res1 = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(rawQuery1)}&entity=song&limit=1`);
        let data1 = await res1.json();

        if (data1.results && data1.results.length > 0) {
            return data1.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
        }

        // --- ATTEMPT 2: Relaxed Match (Drop the feature artists) ---
        let primaryArtist = searchArtist.split(/&|feat\.?|ft\.?| x |,/i)[0].trim();
        
        if (primaryArtist !== searchArtist && primaryArtist.length > 0) {
            let rawQuery2 = `${searchTrack} ${primaryArtist}`.trim();
            console.log(`⚠️ Attempt 1 failed. iTunes Attempt 2 (Relaxed): "${rawQuery2}"`);
            
            let res2 = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(rawQuery2)}&entity=song&limit=1`);
            let data2 = await res2.json();

            if (data2.results && data2.results.length > 0) {
                return data2.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
            }
        }

        return null; 
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
// ONE-TIME ITUNES AUTO-PATCHER (NULL-AWARE)
// ==========================================
async function patchMissingCovers() {
    if (currentUserRole !== 'admin') return alert("Security Clearance Required.");

    console.log("🚀 Starting iTunes Auto-Patcher (NULL-AWARE MODE)...");

    try {
        const response = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
            Appwrite.Query.limit(500)
        ]);
        const rawTracks = response.documents;
        let successCount = 0;

        for (let i = 0; i < rawTracks.length; i++) {
            let doc = rawTracks[i];
            let rawCover = doc.coverUrl;

            // 🛡️ Check if it is NULL, empty, a placeholder, or a non-Apple link
            let needsPatch = false;
            if (!rawCover || rawCover === 'NULL') needsPatch = true;
            else if (rawCover.includes('placeholder')) needsPatch = true;
            else if (!rawCover.includes('mzstatic.com')) needsPatch = true;

            if (needsPatch) {
                console.log(`[${i+1}/${rawTracks.length}] Fixing NULL/Broken Cover: ${doc.name}`);

                let newCover = await fetchCoverArt(doc.name, doc.artist);

                if (newCover) {
                    console.log(`✅ Match found! Overwriting NULL in database...`);
                    await databases.updateDocument(DATABASE_ID, COLLECTION_ID, doc.$id, {
                        coverUrl: newCover
                    });
                    successCount++;
                } else {
                    console.log(`❌ No official iTunes art exists for this track.`);
                }

                // Wait 2.5 seconds to keep Apple happy
                await new Promise(resolve => setTimeout(resolve, 2500));
            }
        }

        console.log(`🎉 Auto-Patcher Finished! Permanently fixed ${successCount} NULL signals.`);
        alert(`Patcher finished. Fixed ${successCount} signals. Refreshing...`);
        fetchTracks(); 

    } catch (error) {
        console.error("Patcher Error:", error);
    }
}