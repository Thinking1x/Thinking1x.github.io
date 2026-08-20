// ==========================================
// PLAYER.JS — Audio Engine & Visualizer
// ==========================================

// ==========================================
// 1. GLOBAL VARIABLES & MEMORY
// ==========================================
let userWantsVisualizer = localStorage.getItem('visState') === null ? true : (localStorage.getItem('visState') === 'true');
let userWantsUIGlow = localStorage.getItem('glowState') === null ? true : (localStorage.getItem('glowState') === 'true');
let showWaveform = true; 
let isSwitchingTrack = false;
let isSeeking = false;
let showParticles = true;
let showCinematicBg = true;

let audioCtx, analyser, dataArray;
let isVisualizerRunning = false;
let colorHue = 0; 

let snowCtx, canvasW, canvasH;
let particles = [];
const MAX_PARTICLES = 200; 

let waveCtx, waveCanvasW, waveCanvasH;

// Default dummy lyrics until a real track loads
let currentLyrics = [
    { time: 5.0, text: "System online..." },
    { time: 10.5, text: "Establishing connection to the main server." },
    { time: 18.0, text: "The signal is breaking through." },
    { time: 26.2, text: "Synchronizing visual data." },
    { time: 35.0, text: "Audio stream stabilized." }
];

// ==========================================
// 2. TRACK LOADING & LYRICS PARSING
// ==========================================
function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const parsedLyrics = [];
    const timeRegEx = /\[(\d{2}):(\d{2})\.(\d{1,3})\]/;
    const timeOffset = 0.0; 

    lines.forEach(line => {
        const match = timeRegEx.exec(line);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const rawMilli = match[3];
            
            const milliseconds = parseInt(rawMilli.padEnd(3, '0'), 10);
            
            let timeInSeconds = (minutes * 60) + seconds + (milliseconds / 1000) + timeOffset;
            if (timeInSeconds < 0) timeInSeconds = 0;

            const text = line.replace(timeRegEx, '').trim();
            if (text) {
                parsedLyrics.push({ time: timeInSeconds, text: text });
            }
        }
    });
    return parsedLyrics;
}

async function loadTrack(i, autoplay = false) {
    const audioEl = document.getElementById('audio');
    if (!audioEl) return;
    
    if (typeof allTracks === 'undefined' || !allTracks || i < 0 || i >= allTracks.length) return;
    
    currentTrackIndex = i;
    const track = allTracks[i];

    const npTitle = document.getElementById('npTitle');
    const npArtist = document.getElementById('npArtist');
    if (npTitle) npTitle.innerText = track.name || 'Unknown Track';
    if (npArtist) npArtist.innerText = track.artist || 'Unknown Artist';

    let cleanUrl = track.file || ""; 
    if (cleanUrl.includes('&jwt=')) cleanUrl = cleanUrl.split('&jwt=')[0];
    if (cleanUrl.includes('?jwt=')) cleanUrl = cleanUrl.split('?jwt=')[0];

    audioEl.crossOrigin = "anonymous";
    audioEl.src = cleanUrl;
    audioEl.preload = 'auto'; 
    audioEl.load(); 

    const totalTimeEl = document.getElementById('totalTime');
    const currentTimeEl = document.getElementById('currentTime');
    const seekbarEl = document.getElementById('seekbar');
    if (totalTimeEl) totalTimeEl.innerText = "--:--";
    if (currentTimeEl) currentTimeEl.innerText = "0:00";
    if (seekbarEl) seekbarEl.value = 0;

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

    // LYRICS INJECTION ENGINE
    if (track.rawLrcText && track.rawLrcText.trim() !== "") {
        currentLyrics = parseLRC(track.rawLrcText);
    } else {
        currentLyrics = [{ time: 0, text: "No lyrics detected in database." }];
    }

    const lyricsContent = document.getElementById('lyrics-content');
    if (lyricsContent) {
        lyricsContent.dataset.activeIndex = "-1";
        lyricsContent.innerHTML = ""; 
    }

    if (typeof renderTrackList === 'function') renderTrackList(); 

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.name,
            artist: track.artist,
            artwork: [{ src: track.cover, sizes: '600x600', type: 'image/jpeg' }]
        });
    }

    const playIcon = document.getElementById('playIcon');
    if (autoplay) {
        if (userWantsVisualizer) {
            setupVisualizer();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }

        if (playIcon) playIcon.className = 'fas fa-spinner fa-spin'; 

        try {
            const playPromise = audioEl.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    if (error.name !== 'AbortError' && playIcon) {
                        playIcon.className = 'fas fa-play';
                    }
                });
            }
        } catch (e) {
            if (playIcon) playIcon.className = 'fas fa-play';
        }
    } else {
        if (playIcon) playIcon.className = 'fas fa-play';
    }
}

// ==========================================
// 3. SMART PLAYER CONTROLS
// ==========================================
function togglePlay() {
    const audioEl = document.getElementById('audio');
    if (!audioEl) return;

    const isIdle = !audioEl.src || audioEl.src === window.location.href || audioEl.currentSrc === "";
    if (isIdle) {
        if (typeof currentPlaylistTracks !== 'undefined' && currentPlaylistTracks.length > 0) {
            const firstTrackIndex = allTracks.findIndex(t => t.id === currentPlaylistTracks[0].id);
            loadTrack(firstTrackIndex > -1 ? firstTrackIndex : 0, true);
        } else if (typeof allTracks !== 'undefined' && allTracks.length > 0) {
            loadTrack(0, true);
        }
        return;
    }

    setupVisualizer();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if (audioEl.paused) {
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.log("Play interrupted: ", e));
        }
    } else {
        audioEl.pause();
    }
}

function nextTrack(isAutoAdvance = false) {
    if (isSwitchingTrack) return; 
    isSwitchingTrack = true;
    setTimeout(() => isSwitchingTrack = false, 150); 

    const audioEl = document.getElementById('audio');
    const isIdle = !audioEl || !audioEl.src || audioEl.src === window.location.href || audioEl.currentSrc === "";
    
    if (isIdle) {
        togglePlay(); 
        return;
    }

    if (typeof repeatMode !== 'undefined' && repeatMode === 2 && isAutoAdvance && audioEl) {
        audioEl.currentTime = 0; 
        audioEl.play().catch(e => {}); 
        return;
    }
    
    if (typeof currentPlaylistTracks === 'undefined' || currentPlaylistTracks.length === 0) return;

    let currentIndexInPlaylist = currentPlaylistTracks.findIndex(t => t.id === allTracks[currentTrackIndex]?.id);
    if (currentIndexInPlaylist === -1) currentIndexInPlaylist = 0;

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
                if (audioEl) audioEl.pause(); 
                const playIcon = document.getElementById('playIcon');
                if (playIcon) playIcon.className = 'fas fa-play'; 
                return; 
            }
        }
    }
    
    const originalIndex = allTracks.findIndex(t => t.id === currentPlaylistTracks[nextIndexInPlaylist].id);
    if (originalIndex !== -1) loadTrack(originalIndex, true);
}

function prevTrack() {
    if (isSwitchingTrack) return;
    isSwitchingTrack = true;
    setTimeout(() => isSwitchingTrack = false, 150);

    const audioEl = document.getElementById('audio');
    const isIdle = !audioEl || !audioEl.src || audioEl.src === window.location.href || audioEl.currentSrc === "";
    
    if (isIdle) {
        togglePlay(); 
        return;
    }

    if (audioEl && audioEl.currentTime > 3) { 
        audioEl.currentTime = 0; 
        return; 
    }
    
    if (typeof currentPlaylistTracks === 'undefined' || currentPlaylistTracks.length === 0) return;

    let currentIndexInPlaylist = currentPlaylistTracks.findIndex(t => t.id === allTracks[currentTrackIndex]?.id);
    if (currentIndexInPlaylist === -1) currentIndexInPlaylist = 0;

    let prevIndexInPlaylist;

    if (typeof isShuffle !== 'undefined' && isShuffle && currentPlaylistTracks.length > 1) {
        do { 
            prevIndexInPlaylist = Math.floor(Math.random() * currentPlaylistTracks.length); 
        } while (prevIndexInPlaylist === currentIndexInPlaylist);
    } else {
        prevIndexInPlaylist = (currentIndexInPlaylist - 1 + currentPlaylistTracks.length) % currentPlaylistTracks.length;
    }
    
    const originalIndex = allTracks.findIndex(t => t.id === currentPlaylistTracks[prevIndexInPlaylist].id);
    if (originalIndex !== -1) loadTrack(originalIndex, true);
}

function toggleShuffle() {
    if (typeof isShuffle !== 'undefined') {
        isShuffle = !isShuffle;
        const btn = document.getElementById('shuffleBtn');
        if (btn) {
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
    }
}

function toggleRepeat() {
    if (typeof repeatMode !== 'undefined') {
        repeatMode = (repeatMode + 1) % 3;
        const btn = document.getElementById('repeatBtn');
        if (!btn) return;
        const icon = btn.querySelector('i');

        btn.classList.remove('active');
        btn.removeAttribute('data-repeat-one');
        btn.style.color = '';
        btn.style.textShadow = '';

        if (repeatMode === 1) {
            btn.classList.add('active');
            if (icon) icon.className = 'fas fa-redo-alt';
            btn.style.color = 'var(--accent, #00ffcc)';
        } else if (repeatMode === 2) {
            btn.classList.add('active');
            if (icon) icon.className = 'fas fa-redo-alt';
            btn.setAttribute('data-repeat-one', 'true');
            btn.style.color = 'var(--success, #00e676)';
        } else {
            if (icon) icon.className = 'fas fa-redo-alt';
            btn.style.color = 'var(--text-sub, #a7a7a7)';
        }
    }
}

// ==========================================
// 4. TIMELINE & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const audioEl = document.getElementById('audio');
    const seekbarEl = document.getElementById('seekbar');
    const volumebarEl = document.getElementById('volumebar');
    const playIcon = document.getElementById('playIcon');

    if (audioEl) {
        audioEl.addEventListener('waiting', () => {
            if (playIcon) playIcon.className = 'fas fa-spinner fa-spin';
        });

        audioEl.addEventListener('playing', () => {
            if (playIcon) playIcon.className = 'fas fa-pause';
            if (userWantsVisualizer) startVisualizer(); 
        });

        audioEl.addEventListener('pause', () => {
            if (audioEl.readyState >= 3 && playIcon) {
                playIcon.className = 'fas fa-play';
            }
        });

        audioEl.addEventListener('ended', () => nextTrack(true));

        audioEl.addEventListener('loadedmetadata', () => { 
            const totalTimeEl = document.getElementById('totalTime');
            if (totalTimeEl) totalTimeEl.innerText = formatTime(audioEl.duration); 
        });

        audioEl.addEventListener('timeupdate', () => {
            if (audioEl.duration && !isSeeking) {
                if (seekbarEl) seekbarEl.value = (audioEl.currentTime / audioEl.duration) * 100;
                
                const currentTimeEl = document.getElementById('currentTime');
                if (currentTimeEl) currentTimeEl.innerText = formatTime(audioEl.currentTime);
                
                syncLyrics(audioEl.currentTime); 
            }
        });
    }

    if (seekbarEl) {
        seekbarEl.addEventListener('input', () => {
            isSeeking = true;
            if (audioEl && audioEl.duration) {
                const currentTimeEl = document.getElementById('currentTime');
                if (currentTimeEl) currentTimeEl.innerText = formatTime((seekbarEl.value / 100) * audioEl.duration);
            }
        });

        seekbarEl.addEventListener('change', () => {
            if (audioEl && audioEl.duration) {
                audioEl.currentTime = (seekbarEl.value / 100) * audioEl.duration;
            }
            isSeeking = false;
        });
    }

    if (volumebarEl && audioEl) {
        volumebarEl.addEventListener('input', () => {
            audioEl.volume = volumebarEl.value / 100;
            localStorage.setItem('userVolume', audioEl.volume);
        });
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
        navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(false));
    }
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
    const audioEl = document.getElementById('audio');

    switch (event.code) {
        case 'Space': event.preventDefault(); togglePlay(); break;
        case 'ArrowRight': event.preventDefault(); if (audioEl && audioEl.duration) audioEl.currentTime = Math.min(audioEl.currentTime + 5, audioEl.duration); break;
        case 'ArrowLeft': event.preventDefault(); if (audioEl && audioEl.src) audioEl.currentTime = Math.max(audioEl.currentTime - 5, 0); break;
    }
});

// ==========================================
// 5. REAL-TIME AUDIO VISUALIZER ENGINES
// ==========================================
function setupVisualizer() {
    if (audioCtx) return;
    const audioEl = document.getElementById('audio');
    if (!audioEl) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024; 
    
    const source = audioCtx.createMediaElementSource(audioEl);
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
    const audioEl = document.getElementById('audio');

    if (!isVisualizerRunning || !audioEl || audioEl.paused) {
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
        root.style.setProperty('--lyric-beat-state', '1');
        
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
        root.style.setProperty('--lyric-beat-state', '0');
        
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
// 6. DRAWING ROUTINES
// ==========================================
function drawParticles(currentHue, overallAverage) {
    if (!snowCtx || !showParticles) return; 
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
    if (!waveCtx || !showWaveform) return;
    
    waveCtx.clearRect(0, 0, waveCanvasW, waveCanvasH);
    
    const bufferLength = analyser.frequencyBinCount;
    const barCount = 90; 
    const spacing = 4;
    const barWidth = (waveCanvasW - (barCount * spacing)) / barCount;
    const centerY = waveCanvasH / 2; 
    let x = 0;

    waveCtx.shadowBlur = 12;
    waveCtx.shadowColor = `hsla(${currentHue}, 100%, 60%, 0.4)`;

    for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * (bufferLength / barCount) * 0.8); 
        
        const normalizedData = dataArray[dataIndex] / 255;
        let barHeight = (normalizedData * waveCanvasH * 0.8) || 4; 

        const gradient = waveCtx.createLinearGradient(0, centerY - (barHeight/2), 0, centerY + (barHeight/2));
        gradient.addColorStop(0, `hsla(${currentHue}, 100%, 80%, 0.9)`);
        gradient.addColorStop(0.5, `hsla(${currentHue}, 100%, 60%, 1)`);
        gradient.addColorStop(1, `hsla(${currentHue}, 100%, 80%, 0.9)`);

        waveCtx.fillStyle = gradient;
        
        waveCtx.beginPath();
        waveCtx.roundRect(x, centerY - (barHeight / 2), barWidth, barHeight, [20]);
        waveCtx.fill();

        x += barWidth + spacing;
    }
    
    waveCtx.shadowBlur = 0;
}

function syncLyrics(currentTime) {
    const lyricsContent = document.getElementById('lyrics-content');
    if (!lyricsContent || currentLyrics.length === 0) return;

    let activeIndex = 0;
    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentTime >= currentLyrics[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }

    let lineProgress = 100;
    const currentLyric = currentLyrics[activeIndex];
    const nextLyric = currentLyrics[activeIndex + 1];

    if (nextLyric) {
        const lineDuration = nextLyric.time - currentLyric.time;
        const elapsedInLine = currentTime - currentLyric.time;
        lineProgress = Math.max(0, Math.min(100, (elapsedInLine / lineDuration) * 100));
    }

    let html = '';
    currentLyrics.forEach((lyric, index) => {
        let className = 'lyric-line';
        let styleAttr = '';

        if (index === activeIndex) {
            className += ' active';
            styleAttr = `style="--progress: ${lineProgress}%;"`;
        }

        html += `<div class="${className}" ${styleAttr} onclick="jumpToLyric(${lyric.time})"><span>${lyric.text}</span></div>`;
    });

    if (lyricsContent.dataset.activeIndex !== activeIndex.toString()) {
        lyricsContent.innerHTML = html;
        lyricsContent.dataset.activeIndex = activeIndex.toString();
        
        const container = document.getElementById('lyrics-container');
        const activeElement = lyricsContent.children[activeIndex];
        if (activeElement && container) {
            container.scrollTo({
                top: activeElement.offsetTop - (container.clientHeight / 2) + (activeElement.clientHeight / 2),
                behavior: 'smooth'
            });
        }
    } else {
        const activeElement = lyricsContent.children[activeIndex];
        if (activeElement) {
            activeElement.style.setProperty('--progress', `${lineProgress}%`);
        }
    }
}

function jumpToLyric(targetTime) {
    const audioEl = document.getElementById('audio');
    if (audioEl && !isNaN(targetTime)) {
        audioEl.currentTime = targetTime;
    }
}

// ==========================================
// 8. SETTING TOGGLES
// ==========================================
function toggleWaveform() {
    showWaveform = !showWaveform;
    const btn = document.getElementById('waveToggleBtn');
    if (btn) {
        btn.style.opacity = showWaveform ? '1' : '0.4';
    }
    if (!showWaveform && waveCtx) {
        waveCtx.clearRect(0, 0, waveCanvasW, waveCanvasH);
    }
}

function toggleVisualizerMode() {
    userWantsVisualizer = document.getElementById('visualizerToggleInput').checked;
    localStorage.setItem('visState', userWantsVisualizer);

    if (userWantsVisualizer) {
        const audioEl = document.getElementById('audio');
        if (audioEl && !audioEl.paused && audioEl.src) {
            isVisualizerRunning = false;
            startVisualizer();
        }
    } else {
        isVisualizerRunning = false;
        const bg = document.getElementById('reactive-bg');
        if (bg) bg.style.boxShadow = 'none';

        const snow = document.getElementById('snow-canvas');
        if (snow) snow.style.opacity = '0';

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

function toggleTransparentMode() {
    let userWantsTransparent = document.getElementById('transparentToggleInput').checked;
    localStorage.setItem('transState', userWantsTransparent);

    if (userWantsTransparent) {
        document.body.classList.add('glass-mode');

        const smallPlayerCover = document.getElementById('npCover');
        const giantBackground = document.getElementById('cover-bg-image');

        if (smallPlayerCover && smallPlayerCover.style.backgroundImage && giantBackground) {
            const rawCssUrl = smallPlayerCover.style.backgroundImage;
            const cleanUrl = rawCssUrl.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');

            if (!cleanUrl.includes('music') && cleanUrl.length > 5) {
                giantBackground.src = cleanUrl;
            }
        }
    } else {
        document.body.classList.remove('glass-mode');
    }
}

function toggleHyperGlowMode() {
    let userWantsHyperGlow = document.getElementById('hyperGlowToggleInput').checked;
    localStorage.setItem('hyperState', userWantsHyperGlow);
}

// --- NEW NOW PLAYING DECK TOGGLES ---

function toggleParticles() {
    showParticles = !showParticles;
    const btn = document.getElementById('particleToggleBtn');
    const canvas = document.getElementById('snow-canvas');
    
    if (btn) btn.style.opacity = showParticles ? '1' : '0.4';
    
    if (!showParticles && canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function toggleCinematicBg() {
    showCinematicBg = !showCinematicBg;
    const btn = document.getElementById('bgToggleBtn');
    const npBg = document.getElementById('np-background'); 
    
    // Updates the button's visual state
    if (btn) btn.style.opacity = showCinematicBg ? '1' : '0.4';
    
    // Fades the art cover in and out smoothly
    if (npBg) {
        npBg.style.opacity = showCinematicBg ? '0.4' : '0'; 
    }
}
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}