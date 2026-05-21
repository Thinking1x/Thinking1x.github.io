// ==========================================
// 1. APPWRITE CONFIGURATION
// ==========================================
const { Client, Databases, ID, Query } = Appwrite; // 🚀 Added Query
const client = new Client()
    .setEndpoint('https://sgp.cloud.appwrite.io/v1')
    .setProject('6a0eba1a001e0c61b69a');

const databases = new Databases(client);
const DB_ID = '6a0eba6b002840ded885';
const MATCHES_COL = 'matches';
const PLAYERS_COL = 'players'; // 🚀 The new collection!

let currentMatchId = new URLSearchParams(window.location.search).get('match');

// ==========================================
// 2. PLAYER IDENTITY & LOGIN
// ==========================================
let myUsername = '';
let myPlayerDocId = ''; // Saves your ID so we can update your wins later

const loginModal = document.getElementById('loginModal');
const usernameInput = document.getElementById('usernameInput');
const loginBtn = document.getElementById('loginBtn');
const whitePlayerDisplay = document.getElementById('whitePlayerDisplay');
const blackPlayerDisplay = document.getElementById('blackPlayerDisplay');

loginBtn.addEventListener('click', async () => {
    const user = usernameInput.value.trim().toUpperCase();
    if (!user) return;
    
    loginBtn.innerText = "AUTHENTICATING...";
    
    try {
        // 1. Check if username exists in database
        const search = await databases.listDocuments(DB_ID, PLAYERS_COL, [
            Query.equal('username', user)
        ]);

        if (search.total > 0) {
            // Player returning!
            myPlayerDocId = search.documents[0].$id;
            console.log(`Welcome back ${user}. Wins: ${search.documents[0].wins}`);
        } else {
            // New Player! Create their record.
            const newDoc = await databases.createDocument(DB_ID, PLAYERS_COL, ID.unique(), {
                username: user,
                wins: 0,
                played: 0
            });
            myPlayerDocId = newDoc.$id;
        }

        myUsername = user;
        loginModal.classList.add('hidden');
        
        // If they were invited via link, boot up the match
        if (currentMatchId) initMultiplayer();
        
    } catch (error) {
        console.error("Login Error:", error);
        alert("Failed to connect to Player Database.");
        loginBtn.innerText = "AUTHENTICATE";
    }
});


// ==========================================
// 3. CHESS ENGINE & HTML ELEMENTS
// ==========================================
const game = new Chess();
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const revertBtn = document.getElementById('revertBtn');
const whiteRevertsEl = document.getElementById('whiteReverts');
const blackRevertsEl = document.getElementById('blackReverts');
let reverts = { w: 2, b: 2 };

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
// 4. MULTIPLAYER LOGIC
// ==========================================
const createMatchBtn = document.getElementById('createMatchBtn');
const inviteLinkArea = document.getElementById('inviteLinkArea');
const inviteLinkInput = document.getElementById('inviteLinkInput');

inviteLinkInput.addEventListener('click', () => {
    inviteLinkInput.select();
    document.execCommand('copy');
    alert("Link copied! Send it to your opponent.");
});

// A. Create Match (Host is White)
createMatchBtn.addEventListener('click', async () => {
    createMatchBtn.innerText = "INITIALIZING SECURE UPLINK...";
    try {
        const doc = await databases.createDocument(DB_ID, MATCHES_COL, ID.unique(), { 
            fen: game.fen(),
            whiteName: myUsername // 🚀 Save Host Name
        });
        
        currentMatchId = doc.$id;
        myColor = 'w';
        
        roleText.innerText = "You are playing as WHITE";
        roleText.style.color = "#00E5FF";
        roleModal.classList.remove('hidden');
        
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?match=${currentMatchId}`;
        window.history.pushState({path:newUrl}, '', newUrl);
        
        setupMultiplayerUI(newUrl);
        subscribeToMatch();
    } catch (error) {
        console.error("Match Error:", error);
        createMatchBtn.innerText = "CREATE MULTIPLAYER MATCH";
    }
});

// B. Join Match (Guest is Black)
async function initMultiplayer() {
    try {
        const doc = await databases.getDocument(DB_ID, MATCHES_COL, currentMatchId);
        game.load(doc.fen);
        
        myColor = 'b';
        board.orientation('black');
        roleText.innerText = "You are playing as BLACK";
        roleText.style.color = "#ff003c";
        roleModal.classList.remove('hidden');

        // 🚀 Add Guest Name to Database
        await databases.updateDocument(DB_ID, MATCHES_COL, currentMatchId, {
            blackName: myUsername
        });

        setupMultiplayerUI(window.location.href);
        subscribeToMatch();
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

// C. The Realtime Listener
function subscribeToMatch() {
    client.subscribe(`databases.${DB_ID}.collections.${MATCHES_COL}.documents.${currentMatchId}`, response => {
        const data = response.payload;
        
        // 🚀 Update the Scoreboard Names
        if (data.whiteName) whitePlayerDisplay.innerText = data.whiteName;
        if (data.blackName) blackPlayerDisplay.innerText = data.blackName;

        if (data.fen && data.fen !== game.fen()) {
            game.load(data.fen);
            board.position(data.fen);
            if (game.in_check()) { checkSound.play(); } else { moveSound.play(); }
            updateStatus();
        }
    });
}

// ==========================================
// 5. GAMEPLAY LOGIC (Drag & Drop)
// ==========================================
function onDragStart(source, piece) {
    if (game.game_over()) return false;
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

    if (currentMatchId) {
        databases.updateDocument(DB_ID, MATCHES_COL, currentMatchId, { fen: game.fen() });
    }
}

function onSnapEnd() {
    board.position(game.fen());
}

// ==========================================
// 6. REVERTS & UI UPDATES
// ==========================================
function updateRevertsUI() {
    whiteRevertsEl.innerText = reverts.w;
    blackRevertsEl.innerText = reverts.b;
    if (game.history().length === 0) {
        revertBtn.disabled = true;
        return;
    }
    const lastMoveColor = game.turn() === 'w' ? 'b' : 'w';
    revertBtn.disabled = (reverts[lastMoveColor] > 0 && !game.game_over()) ? false : true;
}

revertBtn.addEventListener('click', () => {
    if (game.history().length === 0) return;
    const lastMoveColor = game.turn() === 'w' ? 'b' : 'w';

    if (reverts[lastMoveColor] > 0) {
        game.undo();
        reverts[lastMoveColor]--;
        board.position(game.fen());
        $('.square-55d63').removeClass('highlight-square');
        revertSound.play();
        updateStatus();
        if (currentMatchId) {
            databases.updateDocument(DB_ID, MATCHES_COL, currentMatchId, { fen: game.fen() });
        }
    }
});

// ==========================================
// 7. CASUALTY CALCULATOR & WIN TRACKER
// ==========================================
async function recordGameStats() {
    // 🚀 Only update stats if we have a profile ID
    if (!myPlayerDocId) return;

    try {
        // Fetch your current stats from the database
        const profile = await databases.getDocument(DB_ID, PLAYERS_COL, myPlayerDocId);
        let currentWins = profile.wins;
        let currentPlayed = profile.played;

        currentPlayed++; // Always add 1 to matches played

        // Did you win?
        if (game.in_checkmate()) {
            const winnerColor = game.turn() === 'w' ? 'b' : 'w';
            if (myColor === winnerColor) {
                currentWins++; // Add 1 to wins if you were the winner
                console.log("VICTORY RECORDED!");
            }
        }

        // Push new stats to database
        await databases.updateDocument(DB_ID, PLAYERS_COL, myPlayerDocId, {
            wins: currentWins,
            played: currentPlayed
        });

    } catch (error) {
        console.error("Failed to record stats", error);
    }
}

function calculatePostGameStats() {
    const totalMoves = Math.ceil(game.history().length / 2);
    const startCounts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const currentCounts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };

    const currentBoard = game.board();
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            if (currentBoard[i][j] && currentBoard[i][j].type !== 'k') {
                currentCounts[currentBoard[i][j].color][currentBoard[i][j].type]++;
            }
        }
    }
    const symbols = { w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' }, b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' } };
    let wCasualties = '', bCasualties = '';
    for (let type in startCounts) {
        let wMissing = startCounts[type] - currentCounts.w[type];
        let bMissing = startCounts[type] - currentCounts.b[type];
        if (wMissing > 0) wCasualties += `${symbols.w[type]} x${wMissing} &nbsp;&nbsp;`;
        if (bMissing > 0) bCasualties += `${symbols.b[type]} x${bMissing} &nbsp;&nbsp;`;
    }
    moveCountEl.innerText = totalMoves;
    missingWhiteEl.innerHTML = wCasualties || 'None (Flawless)';
    missingBlackEl.innerHTML = bCasualties || 'None (Flawless)';
}

function updateStatus() {
    let statusHTML = '';
    let moveColor = game.turn() === 'b' ? 'Black' : 'White';

    if (game.game_over()) {
        document.getElementById('myBoard').classList.add('game-over-flash');
        if (game.in_checkmate()) {
            modalTitle.innerText = "CRITICAL FAILURE";
            modalResult.innerText = `${moveColor} was checkmated.`;
        } else {
            modalTitle.innerText = "STALEMATE";
            modalResult.innerText = "Match ended in a draw.";
        }
        
        calculatePostGameStats();
        recordGameStats(); // 🚀 Push stats to Appwrite Cloud

        setTimeout(() => modal.classList.remove('hidden'), 1000); 
    } else {
        statusHTML = `${moveColor} to move`;
        if (game.in_check()) statusHTML += ' <span style="color: #ff4444;">(IN CHECK!)</span>';
    }
    statusElement.innerHTML = statusHTML;
    updateRevertsUI();
}

const config = { draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd, pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png' };
const board = Chessboard('myBoard', config);

function resetGame() {
    game.reset();
    board.start();
    reverts = { w: 2, b: 2 };
    $('.square-55d63').removeClass('highlight-square');
    document.getElementById('myBoard').classList.remove('game-over-flash');
    modal.classList.add('hidden');
    updateStatus();
    if (currentMatchId) databases.updateDocument(DB_ID, MATCHES_COL, currentMatchId, { fen: game.fen() });
}

resetBtn.addEventListener('click', resetGame);
playAgainBtn.addEventListener('click', resetGame);

updateStatus();
// Note: We removed initMultiplayer() from down here, it now waits for the Login button to be clicked!