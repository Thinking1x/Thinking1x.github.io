// ==========================================
// PLAYER.JS — Audio Engine & Visualizer
// ==========================================

// ==========================================
// 1. GLOBAL VARIABLES & MEMORY
// ==========================================
// Default visual settings
let userWantsVisualizer = true;
let userWantsUIGlow = true;

// CRITICAL FIX: Define DOM elements at the very top so loadTrack can access them!
const audio = document.getElementById('audio');
const seekbar = document.getElementById('seekbar');
const volumebar = document.getElementById('volumebar');

let audioCtx, analyser, dataArray;
let isVisualizerRunning = false;
let colorHue = 0; 

// Particle System
let snowCtx, canvasW, canvasH;
let particles = [];
const MAX_PARTICLES = 200; 

// Soundwave System
let waveCtx, waveCanvasW, waveCanvasH;

let isSwitchingTrack = false; // Debounce lock to prevent UI thread freezing

// Dummy Lyrics Data
let currentLyrics = [
    { time: 5.0, text: "System online..." },
    { time: 10.5, text: "Establishing connection to the main server." },
    { time: 18.0, text: "The signal is breaking through." },
    { time: 26.2, text: "Synchronizing visual data." },
    { time: 35.0, text: "Audio stream stabilized." }
];

// ==========================================
// 2. TRACK LOADING & PLAYBACK CONTROLS
// ==========================================
async function loadTrack(i, autoplay = false) {
    if (i < 0 || i >= allTracks.length) return;
    currentTrackIndex = i;
    const track = allTracks[i];

    // 1. Update UI Text immediately
    const npTitle = document.getElementById('npTitle');
    const npArtist = document.getElementById('npArtist');
    if (npTitle) npTitle.innerText = track.name || 'Unknown Track';
    if (npArtist) npArtist.innerText = track.artist || 'Unknown Artist';

    // 2. CLEAN THE URL
    let cleanUrl = track.file; 
    if (cleanUrl.includes('&jwt=')) cleanUrl = cleanUrl.split('&jwt=')[0];
    if (cleanUrl.includes('?jwt=')) cleanUrl = cleanUrl.split('?jwt=')[0];

    // 3. DIRECT STREAMING & PRELOAD
    audio.src = cleanUrl;
    audio.preload = 'auto'; 
    audio.load(); 

    // 4. INSTANT UI RESET
    const totalTimeEl = document.getElementById('totalTime');
    const currentTimeEl = document.getElementById('currentTime');
    if (totalTimeEl) totalTimeEl.innerText = "--:--";
    if (currentTimeEl) currentTimeEl.innerText = "0:00";
    if (seekbar) seekbar.value = 0;

    // 5. Update tiny cover art
    const coverArtEl = document.getElementById('npCover');
    if (coverArtEl) {
        if (track.cover && !track.cover.includes('placeholder') && track.cover !== 'NULL') {
            coverArtEl.style.backgroundImage = `url('${track.cover}')`;
            coverArtEl.style.backgroundSize = 'cover';
            coverArtEl.style.backgroundPosition = 'center';
            coverArtEl.innerHTML = ''; 
        } else {
            coverArtEl.style.backgroundImage = 'none';
            coverArtEl.innerHTML = '<i class="fas fa-music" style="color:rgba(255,255,255,0.2); font-size: 1.2rem;"></i>';
        }
    }

    // 6. Update massive background and Now Playing background
    const bgImage = document.getElementById('cover-bg-image');
    if (bgImage) {
        bgImage.src = track.cover; 
        bgImage.onerror = () => { bgImage.src = ""; };
    }

    const npBg = document.getElementById('np-background');
    if (npBg) {
        npBg.src = track.cover;
        npBg.onerror = () => { npBg.src = ""; };
    }

    if (typeof renderTrackList === 'function') renderTrackList(); 

    // 7. Update Hardware Metadata
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.name,
            artist: track.artist,
            artwork: [{ src: track.cover, sizes: '600x600', type: 'image/jpeg' }]
        });
    }

    // 8. Smart Autoplay
    if (autoplay) {
        if (userWantsVisualizer) {
            setupVisualizer();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }

        const playIcon = document.getElementById('playIcon');
        if (playIcon) playIcon.className = 'fas fa-spinner fa-spin'; 

        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    if (error.name !== 'AbortError' && playIcon) {
                        console.error('Playback failed:', error);
                        playIcon.className = 'fas fa-play';
                    }
                });
            }
        } catch (e) {
            console.error('Audio subsystem error:', e);
            if (playIcon) playIcon.className = 'fas fa-play';
        }
    } else {
        const playIcon = document.getElementById('playIcon');
        if (playIcon) playIcon.className = 'fas fa-play';
    }
}

function nextTrack(isAutoAdvance = false) {
    if (isSwitchingTrack) return; 
    isSwitchingTrack = true;
    setTimeout(() => isSwitchingTrack = false, 150); 

    if (typeof repeatMode !== 'undefined' && repeatMode === 2 && isAutoAdvance) {
        audio.currentTime = 0; 
        audio.play().catch(e => { if(e.name !== 'AbortError') console.error(e) }); 
        return;
    }
    
    if (typeof currentPlaylistTracks === 'undefined' || typeof currentTrackIndex === 'undefined') return;

    const currentIndexInPlaylist = currentPlaylistTracks.findIndex(t => t.id === allTracks[currentTrackIndex]?.id);
    let nextIndexInPlaylist;

    if (typeof isShuffle !== 'undefined' && isShuffle && currentPlaylistTracks.length > 1) {
        do { 
            nextIndexInPlaylist = Math.floor(Math.random() * currentPlaylistTracks.length); 
        } while (nextIndexInPlaylist === currentIndexInPlaylist);
    } else {
        nextIndexInPlaylist = currentIndexInPlaylist + 1;
        if (nextIndexInPlaylist >= currentPlaylistTracks.length) {
            if (typeof repeatMode !== 'undefined' && repeatMode === 1) {
                nextIndexInPlaylist = 0;
            } else { 
                audio.pause(); 
                const playIcon = document.getElementById('playIcon');
                if (playIcon) playIcon.className = 'fas fa-play'; 
                return; 
            }
        }
    }
    
    const originalIndex = allTracks.findIndex(t => t.id === currentPlaylistTracks[nextIndexInPlaylist].id);
    loadTrack(originalIndex, true);
}

function prevTrack() {
    if (isSwitchingTrack) return;
    isSwitchingTrack = true;
    setTimeout(() => isSwitchingTrack = false, 150);

    if (audio.currentTime > 3) { 
        audio.currentTime = 0; 
        return; 
    }
    
    if (typeof currentPlaylistTracks === 'undefined' || typeof currentTrackIndex === 'undefined') return;

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
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                if (e.name !== 'AbortError') console.error('Play toggled failed:', e);
            });
        }
    } else {
        audio.pause();
    }
}

// ==========================================
// 3. TIMELINE & EVENT LISTENERS
// ==========================================

audio.addEventListener('waiting', () => {
    const playIcon = document.getElementById('playIcon');
    if (playIcon) playIcon.className = 'fas fa-spinner fa-spin';
});

audio.addEventListener('playing', () => {
    const playIcon = document.getElementById('playIcon');
    if (playIcon) playIcon.className = 'fas fa-pause';
    if (userWantsVisualizer) startVisualizer(); 
});

audio.addEventListener('pause', () => {
    if (audio.readyState >= 3) {
        const playIcon = document.getElementById('playIcon');
        if (playIcon) playIcon.className = 'fas fa-play';
    }
});

audio.addEventListener('ended', () => nextTrack(true));

audio.addEventListener('loadedmetadata', () => { 
    const totalTimeEl = document.getElementById('totalTime');
    if (totalTimeEl) totalTimeEl.innerText = formatTime(audio.duration); 
});

let isSeeking = false;

if (seekbar) {
    seekbar.addEventListener('input', () => {
        isSeeking = true;
        if (audio.duration) {
            const currentTimeEl = document.getElementById('currentTime');
            if (currentTimeEl) currentTimeEl.innerText = formatTime((seekbar.value / 100) * audio.duration);
        }
    });

    seekbar.addEventListener('change', () => {
        if (audio.duration) audio.currentTime = (seekbar.value / 100) * audio.duration;
        isSeeking = false;
    });
}

audio.addEventListener('timeupdate', () => {
    if (audio.duration && !isSeeking) {
        if (seekbar) seekbar.value = (audio.currentTime / audio.duration) * 100;
        
        const currentTimeEl = document.getElementById('currentTime');
        if (currentTimeEl) currentTimeEl.innerText = formatTime(audio.currentTime);
        
        syncLyrics(audio.currentTime); 
    }
});

if (volumebar) {
    volumebar.addEventListener('input', () => {
        audio.volume = volumebar.value / 100;
        localStorage.setItem('userVolume', audio.volume);
    });
}

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
// 4. REAL-TIME AUDIO VISUALIZER ENGINES
// ==========================================
function setupVisualizer() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024; 
    
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

    const wCanvas = document.getElementById('soundwave-canvas');
    if (wCanvas) {
        waveCtx = wCanvas.getContext('2d');
        resizeWaveCanvas(wCanvas);
        window.addEventListener('resize', () => resizeWaveCanvas(wCanvas));
    }
}

function resizeCanvas(canvas) {
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    canvas.width = canvasW;
    canvas.height = canvasH;
}

function resizeWaveCanvas(canvas) {
    if (!canvas.parentElement) return;
    waveCanvasW = canvas.parentElement.clientWidth;
    waveCanvasH = canvas.parentElement.clientHeight;
    canvas.width = waveCanvasW;
    canvas.height = waveCanvasH;
}

function startVisualizer() {
    if (!isVisualizerRunning) {
        isVisualizerRunning = true;
        const snow = document.getElementById('snow-canvas');
        if (snow) snow.style.opacity = '1';
        renderFrame();
    }
}

function renderFrame() {
    const root = document.documentElement; 

    if (!isVisualizerRunning || audio.paused) {
        isVisualizerRunning = false;
        const bg = document.getElementById('reactive-bg');
        if (bg) bg.style.boxShadow = 'none';
        
        const snow = document.getElementById('snow-canvas');
        if (snow) snow.style.opacity = '0';
        
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

    colorHue += 0.2 + (overallAverage / 40);
    if (colorHue > 360) colorHue -= 360;

    const bg = document.getElementById('reactive-bg');
    
    if (bassAverage > 180) {
        const intensity = (bassAverage - 180) / 75;
        const blurSize = 150 + (intensity * 150); 
        const spreadSize = 20 + (intensity * 40); 
        
        if (bg) bg.style.boxShadow = `inset 0 0 ${blurSize}px ${spreadSize}px hsla(${colorHue}, 100%, 55%, ${0.15 + (intensity * 0.2)})`;
        root.style.setProperty('--track-beat-alpha', 0.2 + (intensity * 0.6));
        
        if (userWantsUIGlow) {
            root.style.setProperty('--beat-glow-spread', `${12 + (intensity * 20)}px`);
            root.style.setProperty('--beat-glow-alpha', 0.6 + (intensity * 0.4));
            root.style.setProperty('--beat-hue', colorHue);
            root.style.setProperty('--cover-scale', 1.08 + (intensity * 0.1)); 
        }
    } else {
        const chillLevel = Math.max(overallAverage, 1) / 120;
        const blurSize = 100 + (chillLevel * 100);
        const spreadSize = 10 + (chillLevel * 20);
        
        if (bg) bg.style.boxShadow = `inset 0 0 ${blurSize}px ${spreadSize}px hsla(${colorHue}, 100%, 50%, ${0.05 + (chillLevel * 0.1)})`;
        root.style.setProperty('--track-beat-alpha', 0.05 + (chillLevel * 0.15));
        
        if (userWantsUIGlow) {
            root.style.setProperty('--beat-glow-spread', `${2 + (chillLevel * 6)}px`);
            root.style.setProperty('--beat-glow-alpha', 0.1 + (chillLevel * 0.3));
            root.style.setProperty('--beat-hue', colorHue);
            root.style.setProperty('--cover-scale', 1 + (chillLevel * 0.02)); 
        }
    }

    drawParticles(colorHue, overallAverage);
    drawSoundwave(dataArray, colorHue);
}

// ==========================================
// 5. DRAWING ROUTINES
// ==========================================
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

function drawSoundwave(dataArray, currentHue) {
    if (!waveCtx) return;
    
    waveCtx.clearRect(0, 0, waveCanvasW, waveCanvasH);
    
    const bufferLength = analyser.frequencyBinCount;
    const barCount = 120; 
    const barWidth = (waveCanvasW / barCount) * 1.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * (bufferLength / barCount));
        barHeight = dataArray[dataIndex] * 1.2; 

        const gradient = waveCtx.createLinearGradient(0, waveCanvasH - barHeight, 0, waveCanvasH);
        gradient.addColorStop(0, `hsla(${currentHue}, 100%, 60%, 1)`);
        gradient.addColorStop(1, `hsla(${currentHue}, 80%, 20%, 0.1)`);

        waveCtx.fillStyle = gradient;
        
        waveCtx.beginPath();
        waveCtx.roundRect(x, waveCanvasH - barHeight, barWidth - 2, barHeight, [5, 5, 0, 0]);
        waveCtx.fill();

        x += barWidth;
    }
}

// ==========================================
// 6. LYRICS ENGINE
// ==========================================
function syncLyrics(currentTime) {
    const lyricsContent = document.getElementById('lyrics-content');
    if (!lyricsContent || currentLyrics.length === 0) return;

    let activeIndex = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentTime >= currentLyrics[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }

    let html = '';
    currentLyrics.forEach((lyric, index) => {
        if (index === activeIndex) {
            html += `<div style="color: #fff; font-size: 2rem; font-weight: bold; text-shadow: 0 0 10px var(--accent); transition: 0.3s; transform: scale(1.05);">${lyric.text}</div>`;
        } else {
            html += `<div style="transition: 0.3s; opacity: 0.5;">${lyric.text}</div>`;
        }
    });

    if (lyricsContent.dataset.activeIndex !== activeIndex.toString()) {
        lyricsContent.innerHTML = html;
        lyricsContent.dataset.activeIndex = activeIndex;
        
        const container = document.getElementById('lyrics-container');
        const activeElement = lyricsContent.children[activeIndex];
        if (activeElement && container) {
            container.scrollTo({
                top: activeElement.offsetTop - (container.clientHeight / 2) + (activeElement.clientHeight / 2),
                behavior: 'smooth'
            });
        }
    }
}

// ==========================================
// 7. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
        navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(false));
    }
});