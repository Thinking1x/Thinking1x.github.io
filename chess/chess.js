// Initialize the invisible rules engine
const game = new Chess();

// Grab HTML elements
const statusElement = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

// ==========================================
// DRAG AND DROP LOGIC
// ==========================================

// 1. Only allow dragging if the game isn't over, and it's the correct player's turn
function onDragStart (source, piece, position, orientation) {
  if (game.game_over()) return false;

  // Prevent white from dragging black pieces, and vice versa
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false;
  }
}

// 2. When you drop a piece, ask the engine if it's legal
function onDrop (source, target) {
  // See if the move is legal
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q' // NOTE: always promote to a queen for simplicity
  });

  // If illegal move, snap the piece back!
  if (move === null) return 'snapback';

  updateStatus();
}

// 3. Update the board graphics after castling or en passant
function onSnapEnd () {
  board.position(game.fen());
}

// ==========================================
// GAME STATUS LOGIC
// ==========================================
function updateStatus () {
  let statusHTML = '';

  let moveColor = 'White';
  if (game.turn() === 'b') {
    moveColor = 'Black';
  }

  // Checkmate?
  if (game.in_checkmate()) {
    statusHTML = `Game over, ${moveColor} is in checkmate.`;
  }
  // Draw?
  else if (game.in_draw()) {
    statusHTML = 'Game over, drawn position';
  }
  // Game still on
  else {
    statusHTML = `${moveColor} to move`;
    
    // Are they in check?
    if (game.in_check()) {
      statusHTML += ', ' + moveColor + ' is in check!';
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
  onSnapEnd: onSnapEnd
};

// Create the board using the config above
const board = Chessboard('myBoard', config);

// Reset button listener
resetBtn.addEventListener('click', () => {
    game.reset();
    board.start();
    updateStatus();
});

// Run once on load
updateStatus();