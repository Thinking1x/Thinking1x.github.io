// Initialize the invisible rules engine
const game = new Chess();

// Grab HTML elements
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

// ==========================================
// AUDIO SYSTEM
// ==========================================
// We pull standard chess sounds directly from the web
const moveSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3');
const captureSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3');
const checkSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3');

// ==========================================
// DRAG AND DROP LOGIC
// ==========================================

function onDragStart (source, piece, position, orientation) {
  if (game.game_over()) return false;

  // Prevent moving the wrong pieces
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false;
  }
}

function onDrop (source, target) {
  // 1. Try to make the move
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q' // Always promote to queen for simplicity
  });

  // 2. If illegal move, snap the piece back!
  if (move === null) return 'snapback';

  // 3. PLAY AUDIO & VISUAL EFFECTS
  
  // Clear old neon highlights (square-55d63 is the default class for all squares)
  $('.square-55d63').removeClass('highlight-square');
  
  // Highlight the new move
  $('.square-' + source).addClass('highlight-square');
  $('.square-' + target).addClass('highlight-square');

  // Play the correct sound based on what happened
  if (game.in_check()) {
      checkSound.play();
  } else if (move.flags.includes('c') || move.flags.includes('e')) {
      // 'c' is standard capture, 'e' is en passant capture
      captureSound.play();
  } else {
      moveSound.play();
  }

  updateStatus();
}

function onSnapEnd () {
  board.position(game.fen());
}

// ==========================================
// GAME STATUS LOGIC
// ==========================================
function updateStatus () {
  let statusHTML = '';
  let moveColor = game.turn() === 'b' ? 'Black' : 'White';

  if (game.in_checkmate()) {
    statusHTML = `Game over, ${moveColor} is in checkmate.`;
  } else if (game.in_draw()) {
    statusHTML = 'Game over, drawn position';
  } else {
    statusHTML = `${moveColor} to move`;
    if (game.in_check()) {
      statusHTML += ' <span style="color: #ff4444;">(IN CHECK!)</span>';
    }
  }

  statusElement.innerHTML = statusHTML;
}

// ==========================================
// INITIALIZE THE BOARD
// ==========================================
const config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
  
  // 🚨 THIS FIXES THE BROKEN IMAGES! 🚨
  // Tells the board to pull the images from the cloud instead of your local PC
  pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};

const board = Chessboard('myBoard', config);

// Reset button listener
resetBtn.addEventListener('click', () => {
    game.reset();
    board.start();
    $('.square-55d63').removeClass('highlight-square'); // Clear highlights on reset
    updateStatus();
});

// Run once on load
updateStatus();