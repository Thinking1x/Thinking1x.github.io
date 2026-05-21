// ==========================================
// 1. APPWRITE CONFIGURATION
// ==========================================
const { Client, Databases, ID, Query } = Appwrite;
const client = new Client()
    .setEndpoint('https://sgp.cloud.appwrite.io/v1')
    .setProject('6a0eba1a001e0c61b69a'); 

const databases = new Databases(client);
const DB_ID = '6a0eba6b002840ded885';
const MATCHES_COL = 'matches';
const PLAYERS_COL = 'players'; 

let currentMatchId = new URLSearchParams(window.location.search).get('match');

// ==========================================
// 2. PLAYER IDENTITY & LOGIN
// ==========================================
let myUsername = '';
let myPlayerDocId = ''; 
let whitePlayerName = 'WAITING...';
let blackPlayerName = 'WAITING...';

const loginModal = document.getElementById('loginModal');
const usernameInput = document.getElementById('usernameInput');
const loginBtn = document.getElementById('loginBtn');

loginBtn.addEventListener('click', async () => {
    const user = usernameInput.value.trim().toUpperCase();
    if (!user) return;
    
    loginBtn.innerText = "AUTHENTICATING...";
    try {
        const search = await databases.listDocuments(DB_ID, PLAYERS_COL, [ Query.equal('username', user) ]);
        if (search.total > 0) {
            myPlayerDocId = search.documents[0].$id;
        } else {
            const newDoc = await databases.createDocument(DB_ID, PLAYERS_COL, ID.unique(), {
                username: user, wins: 0, played: 0
            });
            myPlayerDocId = newDoc.$id;
        }
        myUsername = user;
        loginModal.classList.add('hidden');
        if (currentMatchId) initMultiplayer();
    } catch (error) {
        console.error("Login Error:", error);
        alert("Failed to connect to Player Database.");
        loginBtn.innerText = "AUTHENTICATE";
    }
});

// ==========================================
// 3. TERMINAL RADIO (MUSIC SYSTEM)
// ==========================================
const bgm = new Audio();
bgm.loop = true;
bgm.volume = 0.3; // Default starting volume matching the slider

const trackSelect = document.getElementById('trackSelect');
const volumeSlider = document.getElementById('volumeSlider');

// The Restructured Track Library (Swapped Lo-Fi to a highly reliable developer audio asset)
const trackLibrary = {
    "": "", // Offline mode
    "chill": "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    "intense": "https://cdn.pixabay.com/download/audio/2021/11/25/audio_91b32e02f9.mp3",
    "lofi": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", // Highly stable chill-ambient track
    "epic": "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3" 
};

// Tracks which style is currently active
let currentTrackType = "";

// Listen for dropdown changes
trackSelect.addEventListener('change', (e) => {
    currentTrackType = e.target.value;
    const selectedUrl = trackLibrary[currentTrackType];
    
    if (!selectedUrl) {
        bgm.pause(); // Shut off audio if [ OFFLINE ] is pulled
    } else {
        bgm.src = selectedUrl;
        adjustBalancedVolume(); // Calculate safe volume boundaries before playback
        bgm.play().catch(err => console.log("Audio blocked by browser auto-play rules."));
    }
});

// Listen for volume slider changes in real-time
volumeSlider.addEventListener('input', () => {
    adjustBalancedVolume();
});

// 🚀 NEW: THE AUTOMATIC AUDIO BALANCER
// This automatically down-scales the Epic track to 35% power so it never blasts your ears!
function adjustBalancedVolume() {
    const currentSliderVal = parseFloat(volumeSlider.value);
    
    if (currentTrackType === "epic") {
        bgm.volume = currentSliderVal * 0.35; // Cap its maximum output safely
    } else {
        bgm.volume = currentSliderVal; // Full slider power for calm/lofi tracks
    }
}


// ==========================================
// 4. CHESS ENGINE & ELEMENTS
// ==========================================
const game = new Chess();
const statusElement = document.getElementById('status');
const revertBtn = document.getElementById('revertBtn');
const forfeitBtn = document.getElementById('forfeitBtn'); 
const whiteRevertsEl = document.getElementById('whiteReverts');
const blackRevertsEl = document.getElementById('blackReverts');
let reverts = { w: 2, b: 2 };
let isGameOver = false; 

let myColor = null; 
const roleModal = document.getElementById('roleModal');
const roleText = document.getElementById('roleText');
document.getElementById('closeRoleBtn').addEventListener('click', () => roleModal.classList.add('hidden'));

const modal = document.getElementById('gameOverModal');
const modalTitle = document.getElementById('modalTitle');
const modalResult = document.getElementById('modalResult');
const moveCountEl = document.getElementById('moveCount');
const missingWhiteEl = document.getElementById('missingWhite');
const missingBlackEl = document.getElementById('missingBlack');
const playAgainBtn = document.getElementById('playAgainBtn');

const moveSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3');
const captureSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3');
const checkSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3');
const gameOverSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3');
const revertSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/notify.mp3');

// ==========================================
// 5. LIVE PLAYER HUD & SCORE TRACKER
// ==========================================
function updateLiveHUD() {
    // 1. Calculate Pieces on Board
    const startCounts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const currentCounts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    const boardState = game.board();
    
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            if (boardState[i][j] && boardState[i][j].type !== 'k') {
                currentCounts[boardState[i][j].color][boardState[i][j].type]++;
            }
        }
    }

    // 2. Determine captured pieces (What is missing from the board)
    const symbols = { w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' }, b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' } };
    let capturedByWhite = ''; // White captured black pieces
    let capturedByBlack = ''; // Black captured white pieces
    
    for (let type in startCounts) {
        let bMissing = startCounts[type] - currentCounts.b[type]; // Black pieces missing
        let wMissing = startCounts[type] - currentCounts.w[type]; // White pieces missing
        
        for(let i=0; i<bMissing; i++) capturedByWhite += symbols.b[type];
        for(let i=0; i<wMissing; i++) capturedByBlack += symbols.w[type];
    }

    // 3. Calculate Traditional Material Score (p:1, n:3, b:3, r:5, q:9)
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    let wScore = 0, bScore = 0;
    
    for (let type in pieceValues) {
        wScore += currentCounts.w[type] * pieceValues[type];
        bScore += currentCounts.b[type] * pieceValues[type];
    }

    let wAdvantage = wScore > bScore ? `+${wScore - bScore}` : '';
    let bAdvantage = bScore > wScore ? `+${bScore - wScore}` : '';

    // 4. Update the HUD DOM based on Orientation (Top is opponent, Bottom is you)
    const topName = document.getElementById('topHudName');
    const topCap = document.getElementById('topHudCaptured');
    const topScore = document.getElementById('topHudScore');
    
    const botName = document.getElementById('bottomHudName');
    const botCap = document.getElementById('bottomHudCaptured');
    const botScore = document.getElementById('bottomHudScore');

    if (myColor === 'b') { // If you are black, White is on top
        topName.innerText = whitePlayerName;
        topCap.innerHTML = capturedByWhite;
        topScore.innerText = wAdvantage;
        
        botName.innerText = blackPlayerName || myUsername;
        botCap.innerHTML = capturedByBlack;
        botScore.innerText = bAdvantage;
    } else { // If you are white (or observing), Black is on top
        topName.innerText = blackPlayerName;
        topCap.innerHTML = capturedByBlack;
        topScore.innerText = bAdvantage;
        
        botName.innerText = whitePlayerName || myUsername;
        botCap.innerHTML = capturedByWhite;
        botScore.innerText = wAdvantage;
    }
}

// ==========================================
// 6. MULTIPLAYER LOGIC
// ==========================================
const createMatchBtn = document.getElementById('createMatchBtn');
const inviteLinkArea = document.getElementById('inviteLinkArea');
const inviteLinkInput = document.getElementById('inviteLinkInput');

inviteLinkInput.addEventListener('click', () => {
    inviteLinkInput.select();
    document.execCommand('copy');
    alert("Link copied! Send it to your opponent.");
});

createMatchBtn.addEventListener('click', async () => {
    createMatchBtn.innerText = "INITIALIZING SECURE UPLINK...";
    try {
        const doc = await databases.createDocument(DB_ID, MATCHES_COL, ID.unique(), { 
            fen: game.fen(), whiteName: myUsername 
        });
        
        currentMatchId = doc.$id;
        myColor = 'w';
        whitePlayerName = myUsername;
        
        roleText.innerText = "You are playing as WHITE";
        roleText.style.color = "#00E5FF";
        roleModal.classList.remove('hidden');
        
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?match=${currentMatchId}`;
        window.history.pushState({path:newUrl}, '', newUrl);
        
        setupMultiplayerUI(newUrl);
        subscribeToMatch();
        updateLiveHUD();
    } catch (error) {
        console.error("Match Error:", error);
        createMatchBtn.innerText = "CREATE MULTIPLAYER MATCH";
    }
});

async function initMultiplayer() {
    try {
        const doc = await databases.getDocument(DB_ID, MATCHES_COL, currentMatchId);
        game.load(doc.fen);
        
        myColor = 'b';
        blackPlayerName = myUsername;
        whitePlayerName = doc.whiteName || "OPPONENT";
        board.orientation('black');
        
        roleText.innerText = "You are playing as BLACK";
        roleText.style.color = "#ff003c";
        roleModal.classList.remove('hidden');

        await databases.updateDocument(DB_ID, MATCHES_COL, currentMatchId, { blackName: myUsername });

        setupMultiplayerUI(window.location.href);
        subscribeToMatch();
        updateLiveHUD();
    } catch (error) {
        console.error(error);
        alert("Match not found or expired.");
    }
}

function setupMultiplayerUI(url) {
    createMatchBtn.classList.add('hidden');
    inviteLinkArea.classList.remove('hidden');
    inviteLinkInput.value = url;
}

function subscribeToMatch() {
    client.subscribe(`databases.${DB_ID}.collections.${MATCHES_COL}.documents.${currentMatchId}`, response => {
        const data = response.payload;
        
        if (data.whiteName) whitePlayerName = data.whiteName;
        if (data.blackName) blackPlayerName = data.blackName;

        const newFen = data.fen;
        if (newFen && newFen.startsWith('FORFEIT_')) {
            triggerGameOver(newFen.split('_')[1], 'forfeit');
            return;
        }

        if (newFen && newFen !== game.fen()) {
            game.load(newFen);
            board.position(newFen);
            if (game.in_check()) { checkSound.play(); } else { moveSound.play(); }
            updateStatus();
        }
    });
}

// ==========================================
// 7. GAMEPLAY LOGIC
// ==========================================
function onDragStart(source, piece) {
    if (game.game_over() || isGameOver) return false;
    if (myColor && piece.charAt(0) !== myColor) return false;
    if (game.turn() !== piece.charAt(0)) return false;
}

function onDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    $('.square-55d63').removeClass('highlight-square');
    $('.square-' + source).addClass('highlight-square');
    $('.square-' + target).addClass('highlight-square');

    if (game.in_checkmate() || game.in_draw()) {
        gameOverSound.play();
    } else if (game.in_check()) {
        checkSound.play();
    } else if (move.flags.includes('c') || move.flags.includes('e')) {
        captureSound.play();
    } else {
        moveSound.play();
    }

    updateStatus();

    if (currentMatchId) databases.updateDocument(DB_ID, MATCHES_COL, currentMatchId, { fen: game.fen() });
}

function onSnapEnd() { board.position(game.fen()); }

// ==========================================
// 8. BUTTON CONTROLS
// ==========================================
function updateRevertsUI() {
    whiteRevertsEl.innerText = reverts.w;
    blackRevertsEl.innerText = reverts.b;
    if (game.history().length === 0 || isGameOver) { revertBtn.disabled = true; return; }
    const lastMoveColor = game.turn() === 'w' ? 'b' : 'w';
    revertBtn.disabled = (reverts[lastMoveColor] > 0 && !game.game_over()) ? false : true;
}

revertBtn.addEventListener('click', () => {
    if (game.history().length === 0 || isGameOver) return;
    const lastMoveColor = game.turn() === 'w' ? 'b' : 'w';
    if (reverts[lastMoveColor] > 0) {
        game.undo();
        reverts[lastMoveColor]--;
        board.position(game.fen());
        $('.square-55d63').removeClass('highlight-square');
        revertSound.play();
        updateStatus();
        if (currentMatchId) databases.updateDocument(DB_ID, MATCHES_COL, currentMatchId, { fen: game.fen() });
    }
});

forfeitBtn.addEventListener('click', () => {
    if (isGameOver || !myColor) return;
    if (!confirm("Are you sure you want to retreat? This counts as an automatic loss.")) return;
    if (currentMatchId) databases.updateDocument(DB_ID, MATCHES_COL, currentMatchId, { fen: `FORFEIT_${myColor}` });
    triggerGameOver(myColor, 'forfeit');
});

// ==========================================
// 9. GAME OVER & UPDATES
// ==========================================
function triggerGameOver(loserColor, reason) {
    if (isGameOver) return; 
    isGameOver = true;
    gameOverSound.play();
    
    document.getElementById('myBoard').classList.add('game-over-flash');
    const loserName = loserColor === 'w' ? whitePlayerName : blackPlayerName;
    
    if (reason === 'checkmate') {
        modalTitle.innerText = "CRITICAL FAILURE";
        modalResult.innerText = `${loserName} made a fatal error and was Checkmated.`;
    } else if (reason === 'forfeit') {
        modalTitle.innerText = "COWARD'S RETREAT";
        modalResult.innerText = `${loserName} surrendered the match.`;
    } else {
        modalTitle.innerText = "STALEMATE";
        modalResult.innerText = "Match ended in a draw.";
    }

    recordGameStats(loserColor); 
    setTimeout(() => modal.classList.remove('hidden'), 1000);
}

async function recordGameStats(loserColor) {
    if (!myPlayerDocId) return;
    try {
        const profile = await databases.getDocument(DB_ID, PLAYERS_COL, myPlayerDocId);
        let currentWins = profile.wins;
        let currentPlayed = profile.played + 1; 
        if (loserColor && loserColor !== myColor) { currentWins++; }
        await databases.updateDocument(DB_ID, PLAYERS_COL, myPlayerDocId, { wins: currentWins, played: currentPlayed });
    } catch (error) { console.error("Failed to record stats", error); }
}

function updateStatus() {
    let statusHTML = '';
    let moveColor = game.turn() === 'b' ? 'Black' : 'White';

    if (game.game_over()) {
        if (game.in_checkmate()) { triggerGameOver(game.turn(), 'checkmate'); } 
        else { triggerGameOver(null, 'draw'); }
    } else {
        statusHTML = `${moveColor} to move`;
        if (game.in_check()) statusHTML += ' <span style="color: #ff4444;">(IN CHECK!)</span>';
        statusElement.innerHTML = statusHTML;
        updateRevertsUI();
        updateLiveHUD(); // 🚀 Re-calculate HUD stats every move!
    }
}

const config = { draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd, pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png' };
const board = Chessboard('myBoard', config);

function resetGame() {
    game.reset();
    board.start();
    reverts = { w: 2, b: 2 };
    isGameOver = false; 
    $('.square-55d63').removeClass('highlight-square');
    document.getElementById('myBoard').classList.remove('game-over-flash');
    modal.classList.add('hidden');
    updateStatus();
    if (currentMatchId) databases.updateDocument(DB_ID, MATCHES_COL, currentMatchId, { fen: game.fen() });
}

playAgainBtn.addEventListener('click', resetGame);
updateStatus();