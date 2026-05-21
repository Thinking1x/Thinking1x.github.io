const game = new Chess();
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

// New Revert Elements
const revertBtn = document.getElementById('revertBtn');
const whiteRevertsEl = document.getElementById('whiteReverts');
const blackRevertsEl = document.getElementById('blackReverts');

// State trackers
let reverts = { w: 2, b: 2 }; // White and Black start with 2 reverts

// Modal Elements
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
const revertSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/notify.mp3'); // Sound for undo

function onDragStart(source, piece) {
    if (game.game_over()) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
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
}

function onSnapEnd() {
    board.position(game.fen());
}

// ==========================================
// REVERT LOGIC
// ==========================================
function updateRevertsUI() {
    whiteRevertsEl.innerText = reverts.w;
    blackRevertsEl.innerText = reverts.b;

    // You can't revert if no moves have been made
    if (game.history().length === 0) {
        revertBtn.disabled = true;
        return;
    }

    // The person who just moved is the one who needs the revert
    // (If it's Black's turn, it means White just moved)
    const lastMoveColor = game.turn() === 'w' ? 'b' : 'w';

    if (reverts[lastMoveColor] > 0 && !game.game_over()) {
        revertBtn.disabled = false;
    } else {
        revertBtn.disabled = true; // Lock button if they are out of reverts
    }
}

revertBtn.addEventListener('click', () => {
    if (game.history().length === 0) return;

    const lastMoveColor = game.turn() === 'w' ? 'b' : 'w';

    if (reverts[lastMoveColor] > 0) {
        game.undo(); // Erase the last move
        reverts[lastMoveColor]--; // Deduct 1 revert token
        
        board.position(game.fen()); // Snap board back visually
        $('.square-55d63').removeClass('highlight-square'); // Clear highlights
        
        revertSound.play();
        updateStatus();
    }
});

// ==========================================
// THE CASUALTY CALCULATOR
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
    updateRevertsUI(); // Check if revert button should be on/off
}

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
    
    // Reset revert tokens
    reverts = { w: 2, b: 2 };
    
    $('.square-55d63').removeClass('highlight-square');
    document.getElementById('myBoard').classList.remove('game-over-flash');
    modal.classList.add('hidden');
    updateStatus();
}

resetBtn.addEventListener('click', resetGame);
playAgainBtn.addEventListener('click', resetGame);

updateStatus();