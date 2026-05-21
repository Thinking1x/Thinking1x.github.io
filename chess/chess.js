// ==========================================
// 1. APPWRITE CONFIGURATION
// ==========================================
const { Client, Databases, ID } = Appwrite;
const client = new Client()
    .setEndpoint('https://sgp.cloud.appwrite.io/v1')
    .setProject('6a0eba1a001e0c61b69a'); // Your Singapore Project ID

const databases = new Databases(client);
const DB_ID = '6a0eba6b002840ded885';
const COL_ID = 'matches';

let currentMatchId = new URLSearchParams(window.location.search).get('match');

// ==========================================
// 2. CHESS ENGINE & HTML ELEMENTS
// ==========================================
const game = new Chess();
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const revertBtn = document.getElementById('revertBtn');
const whiteRevertsEl = document.getElementById('whiteReverts');
const blackRevertsEl = document.getElementById('blackReverts');
let reverts = { w: 2, b: 2 };

// Role Locking Variables
let myColor = null; // 'w' for White, 'b' for Black
const roleModal = document.getElementById('roleModal');
const roleText = document.getElementById('roleText');
document.getElementById('closeRoleBtn').addEventListener('click', () => roleModal.classList.add('hidden'));

// Game Over Modal Elements
const modal = document.getElementById('gameOverModal');
const modalTitle = document.getElementById('modalTitle');
const modalResult = document.getElementById('modalResult');
const moveCountEl = document.getElementById('moveCount');
const missingWhiteEl = document.getElementById('missingWhite');
const missingBlackEl = document.getElementById('missingBlack');
const playAgainBtn = document.getElementById('playAgainBtn');

// Audio
const moveSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3');
const captureSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3');
const checkSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3');
const gameOverSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3');
const revertSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/notify.mp3');

// ==========================================
// 3. MULTIPLAYER LOGIC
// ==========================================
const createMatchBtn = document.getElementById('createMatchBtn');
const inviteLinkArea = document.getElementById('inviteLinkArea');
const inviteLinkInput = document.getElementById('inviteLinkInput');

// Click to copy the link easily
inviteLinkInput.addEventListener('click', () => {
    inviteLinkInput.select();
    document.execCommand('copy');
    alert("Link copied! Send it to your opponent.");
});

// A. Create a new match in Appwrite (Host is always WHITE)
createMatchBtn.addEventListener('click', async () => {
    createMatchBtn.innerText = "INITIALIZING SECURE UPLINK...";
    try {
        const doc = await databases.createDocument(DB_ID, COL_ID, ID.unique(), { 
            fen: game.fen() 
        });
        
        currentMatchId = doc.$id;

        // 🚀 NEW: Lock the host as White
        myColor = 'w';
        roleText.innerText = "You are playing as WHITE";
        roleText.style.color = "#00E5FF";
        roleModal.classList.remove('hidden');
        
        // Change the URL so they can share it
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?match=${currentMatchId}`;
        window.history.pushState({path:newUrl}, '', newUrl);
        
        setupMultiplayerUI(newUrl);
        subscribeToMatch();
    } catch (error) {
        console.error("Appwrite Error:", error);
        alert("Failed to create match. Did you set permissions to 'Any'?");
        createMatchBtn.innerText = "CREATE MULTIPLAYER MATCH";
    }
});

// B. Join an existing match if URL has ?match=... (Guest is always BLACK)
async function initMultiplayer() {
    if (currentMatchId) {
        try {
            const doc = await databases.getDocument(DB_ID, COL_ID, currentMatchId);
            game.load(doc.fen);
            
            // 🚀 NEW: Lock the guest as Black and flip the board
            myColor = 'b';
            board.orientation('black');
            roleText.innerText = "You are playing as BLACK";
            roleText.style.color = "#ff003c";
            roleModal.classList.remove('hidden');

            setupMultiplayerUI(window.location.href);
            subscribeToMatch();
        } catch (error) {
            console.error(error);
            alert("Match not found or expired.");
        }
    }
}

function setupMultiplayerUI(url) {
    createMatchBtn.classList.add('hidden');
    inviteLinkArea.classList.remove('hidden');
    inviteLinkInput.value = url;
}

// C. The Realtime Listener (Listens for opponent moves)
function subscribeToMatch() {
    client.subscribe(`databases.${DB_ID}.collections.${COL_ID}.documents.${currentMatchId}`, response => {
        const newFen = response.payload.fen;
        
        if (newFen && newFen !== game.fen()) {
            game.load(newFen);
            board.position(newFen);
            
            if (game.in_check()) { checkSound.play(); } 
            else { moveSound.play(); }
            
            updateStatus();
        }
    });
}

// ==========================================
// 4. GAMEPLAY LOGIC (Drag & Drop)
// ==========================================
function onDragStart(source, piece) {
    if (game.game_over()) return false;

    // 🚀 NEW: You cannot touch pieces that don't belong to your locked color
    if (myColor && piece.charAt(0) !== myColor) {
        return false;
    }

    // 🚀 NEW: You cannot move if it is not your turn
    if (game.turn() !== piece.charAt(0)) {
        return false;
    }
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

    // Push move to Appwrite
    if (currentMatchId) {
        databases.updateDocument(DB_ID, COL_ID, currentMatchId, { fen: game.fen() })
            .catch(err => console.error("Sync Error:", err));
    }
}

function onSnapEnd() {
    board.position(game.fen());
}

// ==========================================
// 5. REVERTS & UI UPDATES
// ==========================================
function updateRevertsUI() {
    whiteRevertsEl.innerText = reverts.w;
    blackRevertsEl.innerText = reverts.b;

    if (game.history().length === 0) {
        revertBtn.disabled = true;
        return;
    }

    const lastMoveColor = game.turn() === 'w' ? 'b' : 'w';
    if (reverts[lastMoveColor] > 0 && !game.game_over()) {
        revertBtn.disabled = false;
    } else {
        revertBtn.disabled = true;
    }
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
        
        // Sync Revert
        if (currentMatchId) {
            databases.updateDocument(DB_ID, COL_ID, currentMatchId, { fen: game.fen() });
        }
    }
});

// ==========================================
// 6. CASUALTY CALCULATOR
// ==========================================
function calculatePostGameStats() {
    const totalMoves = Math.ceil(game.history().length / 2);
    const startCounts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const currentCounts = {
        w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
        b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
    };

    const currentBoard = game.board();
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            if (currentBoard[i][j] && currentBoard[i][j].type !== 'k') {
                currentCounts[currentBoard[i][j].color][currentBoard[i][j].type]++;
            }
        }
    }

    const symbols = {
        w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
        b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' }
    };

    let wCasualties = '';
    let bCasualties = '';

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
        setTimeout(() => modal.classList.remove('hidden'), 1000); 
    } else {
        statusHTML = `${moveColor} to move`;
        if (game.in_check()) statusHTML += ' <span style="color: #ff4444;">(IN CHECK!)</span>';
    }

    statusElement.innerHTML = statusHTML;
    updateRevertsUI();
}

// Initialize Board
const config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};
const board = Chessboard('myBoard', config);

// Reset / Play Again logic
function resetGame() {
    game.reset();
    board.start();
    reverts = { w: 2, b: 2 };
    
    $('.square-55d63').removeClass('highlight-square');
    document.getElementById('myBoard').classList.remove('game-over-flash');
    modal.classList.add('hidden');
    updateStatus();

    if (currentMatchId) {
        databases.updateDocument(DB_ID, COL_ID, currentMatchId, { fen: game.fen() });
    }
}

resetBtn.addEventListener('click', resetGame);
playAgainBtn.addEventListener('click', resetGame);

// Run initialization
updateStatus();
initMultiplayer(); // Boot up network if URL has a match ID