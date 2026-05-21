const game = new Chess();
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

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
// THE CASUALTY CALCULATOR
// ==========================================
function calculatePostGameStats() {
    // 1. Calculate Total Moves (plies / 2)
    const totalMoves = Math.ceil(game.history().length / 2);
    
    // 2. What pieces did we start with?
    const startCounts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    
    // 3. What pieces are still alive?
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

    // 4. Format the casualties into symbols
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

    // 5. Inject the data into the HTML Modal
    moveCountEl.innerText = totalMoves;
    missingWhiteEl.innerHTML = wCasualties || 'None (Flawless)';
    missingBlackEl.innerHTML = bCasualties || 'None (Flawless)';
}

function updateStatus() {
    let statusHTML = '';
    let moveColor = game.turn() === 'b' ? 'Black' : 'White';

    if (game.game_over()) {
        // Trigger the red pulse effect
        document.getElementById('myBoard').classList.add('game-over-flash');
        
        if (game.in_checkmate()) {
            modalTitle.innerText = "CRITICAL FAILURE";
            modalResult.innerText = `${moveColor} was checkmated.`;
        } else {
            modalTitle.innerText = "STALEMATE";
            modalResult.innerText = "Match ended in a draw.";
        }
        
        // Calculate the math and show the pop-up!
        calculatePostGameStats();
        setTimeout(() => modal.classList.remove('hidden'), 1000); // Wait 1 second for drama
        
    } else {
        statusHTML = `${moveColor} to move`;
        if (game.in_check()) statusHTML += ' <span style="color: #ff4444;">(IN CHECK!)</span>';
    }

    statusElement.innerHTML = statusHTML;
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
    $('.square-55d63').removeClass('highlight-square');
    document.getElementById('myBoard').classList.remove('game-over-flash');
    modal.classList.add('hidden');
    updateStatus();
}

resetBtn.addEventListener('click', resetGame);
playAgainBtn.addEventListener('click', resetGame);

updateStatus();