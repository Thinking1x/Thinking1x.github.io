// ==========================================
// PLAYER.JS — The Ultimate Audio Engine
// ==========================================

// ==========================================
// 1. GLOBAL VARIABLES & MEMORY
// ==========================================
const savedState = localStorage.getItem('visualizerState');
let userWantsVisualizer = localStorage.getItem('visState') === null ? true : (localStorage.getItem('visState') === 'true');
let userWantsUIGlow = localStorage.getItem('glowState') === null ? true : (localStorage.getItem('glowState') === 'true');
let userWantsLaunchpad = localStorage.getItem('padState') === null ? true : (localStorage.getItem('padState') === 'true');
let userWantsTransparent = localStorage.getItem('transState') === 'true';
let userWantsHyperGlow = localStorage.getItem('hyperState') === 'true';

let audioCtx, analyser, dataArray;
let isVisualizerRunning = false;
let colorHue = 0; 
let lastBeatTime=0; // Launchpad debouncer
let currentPadIndex = 0; // Remembers the Waterfall position

let snowCtx, canvasW, canvasH;
let particles = [];
const MAX_PARTICLES = 200; 

// ==========================================
// 2. TRACK LOADING & PLAYBACK CONTROLS
// ==========================================
async function loadTrack(i, autoplay = false) {
    if (i < 0 || i >= allTracks.length) return;
    currentTrackIndex = i;
    const track = allTracks[i];

    // 1. Update UI Text immediately
    document.getElementById('npTitle').innerText = track.name || 'Unknown Track';
    document.getElementById('npArtist').innerText = track.artist || 'Unknown Artist';

    // 2. CLEAN THE URL (The Bouncer)
    // Strips out any leftover Appwrite JWT tokens that cause 404 errors in Cloudflare
    let cleanUrl = track.file; 
    if (cleanUrl.includes('&jwt=')) cleanUrl = cleanUrl.split('&jwt=')[0];
    if (cleanUrl.includes('?jwt=')) cleanUrl = cleanUrl.split('?jwt=')[0];

    // 3. DIRECT STREAMING (The New Method)
    // Completely bypasses the fetch/blob CORS headache. Streams straight from R2.
    audio.src = cleanUrl;

    // 4. Update the tiny cover art in the player bar
    const coverArtEl = document.getElementById('npCover');
    if (coverArtEl) {
        coverArtEl.src = track.cover;
        coverArtEl.onerror = () => {
            coverArtEl.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%231a1a36'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='24' fill='%2300E5FF'%3E♪%3C/text%3E%3C/svg%3E`;
        };
    }

    // 5. Update the massive background image
    const bgImage = document.getElementById('cover-bg-image');
    if (bgImage) {
        bgImage.src = track.cover; 
        bgImage.onerror = () => {
            bgImage.src = ""; // Clears to dark if no artwork exists
        };
    }

    renderTrackList(); // Highlight active track in the UI

    // 6. Handle Autoplay & Visualizer
    if (autoplay) {
        try {
            await audio.play();
            playIcon.className = 'fas fa-pause';
            
            if (typeof userWantsVisualizer !== 'undefined' && userWantsVisualizer) {
                if (typeof setupVisualizer === 'function') setupVisualizer();
                if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
                if (typeof startVisualizer === 'function') startVisualizer();
            }
        } catch (e) {
            console.error('Playback failed. Browser might require user interaction first:', e);
            playIcon.className = 'fas fa-play';
        }
    } else {
        playIcon.className = 'fas fa-play';
    }

    // 7. Media Session API (Hardware media keys / Lock screen controls)
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.name,
            artist: track.artist,
            artwork: [{ src: track.cover, sizes: '600x600', type: 'image/jpeg' }]
        });
        
        // Make sure you have a togglePlay() function defined elsewhere in your code!
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
        navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(false));
    }
}

function nextTrack(isAutoAdvance = false) {
    if (repeatMode === 2 && isAutoAdvance) {
        audio.currentTime = 0; 
        audio.play(); 
        return;
    }
    
    const currentIndexInPlaylist = currentPlaylistTracks.findIndex(t => t.id === allTracks[currentTrackIndex]?.id);
    let nextIndexInPlaylist;

    if (isShuffle && currentPlaylistTracks.length > 1) {
        do { 
            nextIndexInPlaylist = Math.floor(Math.random() * currentPlaylistTracks.length); 
        } while (nextIndexInPlaylist === currentIndexInPlaylist);
    } else {
        nextIndexInPlaylist = currentIndexInPlaylist + 1;
        if (nextIndexInPlaylist >= currentPlaylistTracks.length) {
            if (repeatMode === 1) {
                nextIndexInPlaylist = 0;
            } else { 
                audio.pause(); 
                playIcon.className = 'fas fa-play'; 
                return; 
            }
        }
    }
    
    const originalIndex = allTracks.findIndex(t => t.id === currentPlaylistTracks[nextIndexInPlaylist].id);
    loadTrack(originalIndex, true);
}

function prevTrack() {
    // If the song is more than 3 seconds in, restart it instead of skipping back
    if (audio.currentTime > 3) { 
        audio.currentTime = 0; 
        return; 
    }
    
    const currentIndexInPlaylist = currentPlaylistTracks.findIndex(t => t.id === allTracks[currentTrackIndex]?.id);
    const prevIndexInPlaylist = (currentIndexInPlaylist - 1 + currentPlaylistTracks.length) % currentPlaylistTracks.length;
    const originalIndex = allTracks.findIndex(t => t.id === currentPlaylistTracks[prevIndexInPlaylist].id);
    
    loadTrack(originalIndex, true);
}

function togglePlay() {
    if (!audio.src) return;

    setupVisualizer();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if (audio.paused) {
        audio.play();
        document.getElementById('playIcon').classList.replace('fa-play', 'fa-pause');
        if (userWantsVisualizer) startVisualizer(); 
    } else {
        audio.pause();
        document.getElementById('playIcon').classList.replace('fa-pause', 'fa-play');
    }
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    const btn = document.getElementById('shuffleBtn');
    if (isShuffle) {
        btn.classList.add('active');
        btn.style.color = 'var(--accent, #00ffcc)';
        btn.style.textShadow = '0 0 8px var(--accent, #00ffcc)';
    } else {
        btn.classList.remove('active');
        btn.style.color = '';
        btn.style.textShadow = '';
    }
}

function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    const btn = document.getElementById('repeatBtn');
    const icon = btn.querySelector('i');

    btn.classList.remove('active');
    btn.removeAttribute('data-repeat-one');
    btn.style.color = '';
    btn.style.textShadow = '';

    if (repeatMode === 1) {
        btn.classList.add('active');
        icon.className = 'fas fa-redo-alt';
        btn.style.color = 'var(--accent)';
    } else if (repeatMode === 2) {
        btn.classList.add('active');
        icon.className = 'fas fa-redo-alt';
        btn.setAttribute('data-repeat-one', 'true');
        btn.style.color = 'var(--success)';
    } else {
        icon.className = 'fas fa-redo-alt';
        btn.style.color = 'var(--text-sub)';
    }
}





// ==========================================
// 3. TIMELINE & EVENT LISTENERS
// ==========================================
audio.addEventListener('ended', () => nextTrack(true));
audio.addEventListener('loadedmetadata', () => { document.getElementById('totalTime').innerText = formatTime(audio.duration); });

seekbar.addEventListener('input', () => {
    isSeeking = true;
    if (audio.duration) document.getElementById('currentTime').innerText = formatTime((seekbar.value / 100) * audio.duration);
});

seekbar.addEventListener('change', () => {
    if (audio.duration) audio.currentTime = (seekbar.value / 100) * audio.duration;
    isSeeking = false;
});

audio.addEventListener('timeupdate', () => {
    if (audio.duration && !isSeeking) {
        seekbar.value = (audio.currentTime / audio.duration) * 100;
        document.getElementById('currentTime').innerText = formatTime(audio.currentTime);
    }
});

volumebar.addEventListener('input', () => {
    audio.volume = volumebar.value / 100;
    localStorage.setItem('userVolume', audio.volume);
});

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

document.addEventListener('keydown', function (event) {
    const activeTag = document.activeElement.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    switch (event.code) {
        case 'Space': event.preventDefault(); togglePlay(); break;
        case 'ArrowRight': event.preventDefault(); if (audio.duration) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration); break;
        case 'ArrowLeft': event.preventDefault(); if (audio.src) audio.currentTime = Math.max(audio.currentTime - 5, 0); break;
    }
});

// ==========================================
// 4. REAL-TIME AUDIO VISUALIZER (STARFIELD + MATH)
// ==========================================
function setupVisualizer() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512; 
    
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    const canvas = document.getElementById('snow-canvas');
    if (canvas) {
        snowCtx = canvas.getContext('2d');
        resizeCanvas(canvas);
        window.addEventListener('resize', () => resizeCanvas(canvas));
        for(let i = 0; i < MAX_PARTICLES; i++) {
            particles.push({
                x: Math.random() * canvasW,
                y: Math.random() * canvasH,
                size: Math.random() * 1.5 + 0.5, 
                sway: Math.random() * Math.PI * 2,
                life: Math.random() 
            });
        }
    }
}

function resizeCanvas(canvas) {
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    canvas.width = canvasW;
    canvas.height = canvasH;
}

function startVisualizer() {
    if (!isVisualizerRunning) {
        isVisualizerRunning = true;
        document.getElementById('snow-canvas').style.opacity = '1';
        renderFrame();
    }
}

function renderFrame() {
    const root = document.documentElement; 

    if (!isVisualizerRunning || audio.paused) {
        isVisualizerRunning = false;
        document.getElementById('reactive-bg').style.boxShadow = 'none';
        document.getElementById('snow-canvas').style.opacity = '0';
        
        // Failsafe: Turn everything off when paused
        root.style.setProperty('--beat-glow-alpha', '0');
        root.style.setProperty('--cover-scale', '1');
        return;
    }

    requestAnimationFrame(renderFrame);
    analyser.getByteFrequencyData(dataArray);

    let bassSum = 0;
    for (let i = 0; i < 12; i++) bassSum += dataArray[i];
    const bassAverage = bassSum / 12;

    let totalSum = 0;
    for (let i = 0; i < dataArray.length; i++) totalSum += dataArray[i];
    const overallAverage = totalSum / dataArray.length;

    // Keeps calculating the color even if effects are turned off
    colorHue += 0.2 + (overallAverage / 40);
    if (colorHue > 360) colorHue -= 360;

    const bg = document.getElementById('reactive-bg');
    const now = Date.now();

    // ==========================================
    // 1. UI GLOW LOGIC (Breathing vs Flashing)
    // ==========================================
    if (bassAverage > 180) {
        // 🔥 INTENSE BASS DROP
        const intensity = (bassAverage - 180) / 75;
        const blurSize = 150 + (intensity * 150); 
        const spreadSize = 20 + (intensity * 40); 
        
        // Background always runs if visualizer is on
        bg.style.boxShadow = `inset 0 0 ${blurSize}px ${spreadSize}px hsla(${colorHue}, 100%, 55%, ${0.15 + (intensity * 0.2)})`;
        root.style.setProperty('--track-beat-alpha', 0.2 + (intensity * 0.6));
        
        // 🎚️ THE TOGGLE CHECK
        if (userWantsUIGlow) {
            root.style.setProperty('--beat-glow-spread', `${12 + (intensity * 20)}px`);
            root.style.setProperty('--beat-glow-alpha', 0.6 + (intensity * 0.4));
            root.style.setProperty('--beat-hue', colorHue);
            root.style.setProperty('--cover-scale', 1.08 + (intensity * 0.1)); 
        } else {
            // Disappear instantly when tag is unchecked!
            root.style.setProperty('--beat-glow-alpha', '0');
            root.style.setProperty('--cover-scale', '1');
        }

    } else {
        // ❄️ CHILL BEAT
        const chillLevel = Math.max(overallAverage, 1) / 120;
        const blurSize = 100 + (chillLevel * 100);
        const spreadSize = 10 + (chillLevel * 20);
        
        // Background always runs if visualizer is on
        bg.style.boxShadow = `inset 0 0 ${blurSize}px ${spreadSize}px hsla(${colorHue}, 100%, 50%, ${0.05 + (chillLevel * 0.1)})`;
        root.style.setProperty('--track-beat-alpha', 0.05 + (chillLevel * 0.15));
        
        // 🎚️ THE TOGGLE CHECK
        if (userWantsUIGlow) {
            root.style.setProperty('--beat-glow-spread', `${2 + (chillLevel * 6)}px`);
            root.style.setProperty('--beat-glow-alpha', 0.1 + (chillLevel * 0.3));
            root.style.setProperty('--beat-hue', colorHue);
            root.style.setProperty('--cover-scale', 1 + (chillLevel * 0.02)); 
        } else {
            // Disappear instantly when tag is unchecked!
            root.style.setProperty('--beat-glow-alpha', '0');
            root.style.setProperty('--cover-scale', '1');
        }
    }

    // ==========================================
    // 2. THE DYNAMIC LAUNCHPAD TRIGGER
    // ==========================================
    if (bassAverage > 140 && (now - lastBeatTime > 90)) {
        lastBeatTime = now;
        
        // 🎚️ ONLY fire if the Launchpad switch is checked
        if (typeof userWantsLaunchpad !== 'undefined' && userWantsLaunchpad) {
            triggerDynamicLaunchpad(bassAverage); 
        }
    }

    drawParticles(colorHue, overallAverage);
}
function drawParticles(currentHue, overallAverage) {
    if (!snowCtx) return;
    snowCtx.clearRect(0, 0, canvasW, canvasH);
    const pulse = overallAverage / 255; 

    for(let i = 0; i < MAX_PARTICLES; i++) {
        let p = particles[i];
        snowCtx.beginPath();
        const responsiveSize = p.size + (pulse * 2.5); 
        const speed = 0.3 + (pulse * 0.8); 
        const alpha = 0.15 + (pulse * 0.3); 
        
        snowCtx.fillStyle = `hsla(${currentHue}, 80%, 75%, ${alpha})`;
        snowCtx.arc(p.x, p.y, responsiveSize, 0, Math.PI * 2);
        
        p.y -= speed; 
        p.x += Math.sin(p.sway) * 0.3; 
        p.sway += 0.015;
        
        if (p.y < -10) {
            p.y = canvasH + 10;
            p.x = Math.random() * canvasW;
        }
        snowCtx.fill();
    }
}

// Add this right above the function to act as a metronome switch
let isEvenBeat = true;

// ==========================================
// 5. DYNAMIC SMART LAUNCHPAD
// ==========================================
function triggerDynamicLaunchpad(bassStrength) {
    const allInactiveTracks = document.querySelectorAll('.track:not(.active)');
    const visibleTracks = Array.from(allInactiveTracks).filter(track => {
        const rect = track.getBoundingClientRect();
        return (rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight));
    });

    if (visibleTracks.length === 0) return;

    // STATE 1: THE BUILDUP (Bass 150 to 175) -> Waterfall Effect
    if (bassStrength < 175) {
        if (currentPadIndex >= visibleTracks.length) currentPadIndex = 0;
        
        const targetTrack = visibleTracks[currentPadIndex];
        targetTrack.classList.add('launchpad-flash');
        setTimeout(() => targetTrack.classList.remove('launchpad-flash'), 60);
        
        currentPadIndex++;
        return; // Stop here, don't do random flashes
    }

    // STATE 2: NORMAL TO HEAVY DROP (Bass 175+) -> Random Flashes
    let numFlashes = 1; // Default for a normal beat

    if (bassStrength >= 195 && bassStrength < 210) {
        numFlashes = 2; // Heavy beat
    } else if (bassStrength >= 210) {
        // Insane Drop: The louder it is, the more it flashes (Max 5)
        numFlashes = Math.floor((bassStrength - 200) / 10) + 2; 
        numFlashes = Math.min(numFlashes, 5, visibleTracks.length); 
    }

    // Execute the random drum pads based on the math above
    for (let i = 0; i < numFlashes; i++) {
        const randomTrack = visibleTracks[Math.floor(Math.random() * visibleTracks.length)];
        
        randomTrack.classList.add('launchpad-flash');
        if (userWantsHyperGlow) randomTrack.classList.add('hyper-glow')
        setTimeout(() => {
            randomTrack.classList.remove('launchpad-flash');
            randomTrack.classList.remove('hyper-glow'); // NEW
        }, 70);
    }
}
// ==========================================
// 6. TOGGLES & INITIALIZATION
// ==========================================
function toggleVisualizerMode() {
    userWantsVisualizer = document.getElementById('visualizerToggleInput').checked;
    localStorage.setItem('visState', userWantsVisualizer);

    if (userWantsVisualizer) {
        if (!audio.paused && audio.src) {
            isVisualizerRunning = false;
            startVisualizer();
        }
    } else {
        isVisualizerRunning = false;
        document.getElementById('reactive-bg').style.boxShadow = 'none';
        document.getElementById('snow-canvas').style.opacity = '0';
        document.documentElement.style.setProperty('--beat-glow-alpha', '0');
        document.documentElement.style.setProperty('--cover-scale', '1');
    }
}

function toggleUIGlowMode() {
    userWantsUIGlow = document.getElementById('uiGlowToggleInput').checked;
    localStorage.setItem('glowState', userWantsUIGlow);
    if (!userWantsUIGlow) {
        document.documentElement.style.setProperty('--beat-glow-alpha', '0');
        document.documentElement.style.setProperty('--cover-scale', '1');
    }
}

function toggleLaunchpadMode() {
    userWantsLaunchpad = document.getElementById('launchpadToggleInput').checked;
    localStorage.setItem('padState', userWantsLaunchpad);
}
// Add these below your other toggle functions
function toggleTransparentMode() {
    userWantsTransparent = document.getElementById('transparentToggleInput').checked;
    localStorage.setItem('transState', userWantsTransparent);
    
    if (userWantsTransparent) {
        document.body.classList.add('glass-mode');
        
        // 🚀 THE CUSTOM FIX: 
        // 1. Target the exact IDs from your HTML
        const smallPlayerCover = document.getElementById('npCover');
        const giantBackground = document.getElementById('cover-bg-image');
        
        if (smallPlayerCover && smallPlayerCover.style.backgroundImage && giantBackground) {
            // 2. Extract the raw image link out of the CSS url(...) format
            const rawCssUrl = smallPlayerCover.style.backgroundImage;
            const cleanUrl = rawCssUrl.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
            
            // 3. Inject it into the giant background
            if (!cleanUrl.includes('music') && cleanUrl.length > 5) {
                giantBackground.src = cleanUrl;
            }
        }
    } else {
        document.body.classList.remove('glass-mode');
    }
}
function toggleHyperGlowMode() {
    userWantsHyperGlow = document.getElementById('hyperGlowToggleInput').checked;
    localStorage.setItem('hyperState', userWantsHyperGlow);
}

document.addEventListener('DOMContentLoaded', () => {
    // Set the physical switches to match the saved memory when the page loads
    const visInput = document.getElementById('visualizerToggleInput');
    const glowInput = document.getElementById('uiGlowToggleInput');
    const padInput = document.getElementById('launchpadToggleInput');
    const transInput = document.getElementById('transparentToggleInput');
    const hyperInput = document.getElementById('hyperGlowToggleInput');
    
    if (visInput) visInput.checked = userWantsVisualizer;
    if (glowInput) glowInput.checked = userWantsUIGlow;
    if (padInput) padInput.checked = userWantsLaunchpad;
    if (transInput) transInput.checked = userWantsTransparent;
    if (hyperInput) hyperInput.checked = userWantsHyperGlow;
    if (userWantsTransparent) document.body.classList.add('glass-mode');
});

