// ================================================
// DAMA - CHECKERS OYUN MOTORU
// ================================================

const boardEl = document.getElementById('board');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('resetGameBtn');
const redPlayerBox = document.getElementById('redPlayer');
const whitePlayerBox = document.getElementById('whitePlayer');
const redName = document.getElementById('redName');
const whiteName = document.getElementById('whiteName');
const redCount = document.getElementById('redCount');
const whiteCount = document.getElementById('whiteCount');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverMessage = document.getElementById('gameOverMessage');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitBtn = document.getElementById('exitBtn');
const rulesModal = document.getElementById('rulesModal');
const closeRulesBtn = document.getElementById('closeRulesBtn');

// Oyun değişkenleri
let player1NameStr = 'Oyuncu';
let player2NameStr = 'Bilgisayar';
let isSinglePlayer = true;
let aiDifficulty = 'medium';

let board = [];
let currentTurn = 'red'; // Kırmızı başlar
let selectedPiece = null;
let validMoves = [];
let mustCapture = false;
let multiCapture = null;
let gameOver = false;

// Taş sayıları
let pieceCount = { red: 12, white: 12 };

// ================================================
// BAŞLATMA
// ================================================

function init() {
    const params = new URLSearchParams(window.location.search);
    player1NameStr = params.get('p1') || 'Oyuncu';
    player2NameStr = params.get('p2') || 'Bilgisayar';
    isSinglePlayer = params.get('mode') === 'ai';
    aiDifficulty = params.get('diff') || 'medium';

    redName.textContent = player1NameStr;
    whiteName.textContent = player2NameStr;

    resetGame();
    rulesModal.classList.remove('hidden');
}

function resetGame() {
    board = createInitialBoard();
    currentTurn = 'red';
    selectedPiece = null;
    validMoves = [];
    mustCapture = false;
    multiCapture = null;
    gameOver = false;
    pieceCount = { red: 12, white: 12 };

    renderBoard();
    updateUI();
    gameOverModal.classList.add('hidden');
}

function createInitialBoard() {
    const b = Array(8).fill(null).map(() => Array(8).fill(null));

    // Beyaz taşlar (üst 3 sıra)
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
                b[row][col] = { color: 'white', king: false };
            }
        }
    }

    // Kırmızı taşlar (alt 3 sıra)
    for (let row = 5; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
                b[row][col] = { color: 'red', king: false };
            }
        }
    }

    return b;
}

// ================================================
// RENDER
// ================================================

function renderBoard() {
    boardEl.innerHTML = '';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = 'square';
            square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = row;
            square.dataset.col = col;

            // Seçili kare
            if (selectedPiece && selectedPiece.row === row && selectedPiece.col === col) {
                square.classList.add('selected');
            }

            // Geçerli hamle
            const validMove = validMoves.find(m => m.row === row && m.col === col);
            if (validMove) {
                if (validMove.capture) {
                    square.classList.add('valid-capture');
                } else {
                    square.classList.add('valid-move');
                }
            }

            // Taş
            const piece = board[row][col];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = `piece ${piece.color}`;
                if (piece.king) pieceEl.classList.add('king');
                square.appendChild(pieceEl);
            }

            square.addEventListener('click', () => handleSquareClick(row, col));
            boardEl.appendChild(square);
        }
    }
}

function updateUI() {
    // Sıra göstergesi
    redPlayerBox.classList.toggle('active', currentTurn === 'red');
    whitePlayerBox.classList.toggle('active', currentTurn === 'white');

    // Taş sayıları
    redCount.textContent = `${pieceCount.red} taş`;
    whiteCount.textContent = `${pieceCount.white} taş`;

    // Durum
    if (gameOver) {
        statusDiv.textContent = 'Oyun Bitti';
    } else {
        const turnName = currentTurn === 'red' ? player1NameStr : player2NameStr;
        statusDiv.textContent = `Sıra: ${turnName}`;
        if (mustCapture) {
            statusDiv.textContent += ' (Yemeli!)';
        }
    }
}

// ================================================
// OYUN MEKANİĞİ
// ================================================

function handleSquareClick(row, col) {
    if (gameOver) return;
    if (isSinglePlayer && currentTurn === 'white') return;

    const piece = board[row][col];

    // Çoklu yeme devam ediyorsa sadece o taşla devam et
    if (multiCapture) {
        const validMove = validMoves.find(m => m.row === row && m.col === col);
        if (validMove) {
            makeMove(multiCapture.row, multiCapture.col, row, col, validMove);
        }
        return;
    }

    // Geçerli hamle
    if (selectedPiece && validMoves.find(m => m.row === row && m.col === col)) {
        const move = validMoves.find(m => m.row === row && m.col === col);
        makeMove(selectedPiece.row, selectedPiece.col, row, col, move);
        return;
    }

    // Taş seçme
    if (piece && piece.color === currentTurn) {
        // Yeme zorunluluğu varsa sadece yeme yapabilen taşları seç
        const allCaptures = getAllCaptures(currentTurn);
        if (allCaptures.length > 0) {
            const canCapture = allCaptures.some(c => c.fromRow === row && c.fromCol === col);
            if (!canCapture) {
                statusDiv.textContent = 'Yeme zorunlu!';
                return;
            }
            mustCapture = true;
        }

        selectedPiece = { row, col };
        validMoves = getValidMoves(row, col);
        renderBoard();
    } else {
        selectedPiece = null;
        validMoves = [];
        renderBoard();
    }
}

function makeMove(fromRow, fromCol, toRow, toCol, moveInfo) {
    const piece = board[fromRow][fromCol];

    // Taşı hareket ettir
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;

    // Yenen taşı kaldır
    if (moveInfo.capture) {
        const midRow = (fromRow + toRow) / 2;
        const midCol = (fromCol + toCol) / 2;
        const capturedPiece = board[midRow][midCol];
        board[midRow][midCol] = null;
        pieceCount[capturedPiece.color]--;
    }

    // Dama olma kontrolü
    if (!piece.king) {
        if ((piece.color === 'red' && toRow === 0) || (piece.color === 'white' && toRow === 7)) {
            piece.king = true;
        }
    }

    // Çoklu yeme kontrolü
    if (moveInfo.capture) {
        const furtherCaptures = getCaptures(toRow, toCol);
        if (furtherCaptures.length > 0) {
            multiCapture = { row: toRow, col: toCol };
            selectedPiece = null;
            validMoves = furtherCaptures;
            renderBoard();
            updateUI();
            return;
        }
    }

    // Sıra değiştir
    multiCapture = null;
    selectedPiece = null;
    validMoves = [];
    mustCapture = false;
    currentTurn = currentTurn === 'red' ? 'white' : 'red';

    renderBoard();
    updateUI();
    checkGameEnd();

    // AI hamlesi
    if (!gameOver && isSinglePlayer && currentTurn === 'white') {
        setTimeout(makeAIMove, getAIDelay());
    }
}

// ================================================
// HAMLE HESAPLAMA
// ================================================

function getValidMoves(row, col) {
    const piece = board[row][col];
    if (!piece || piece.color !== currentTurn) return [];

    // Yeme zorunluluğu kontrolü
    const allCaptures = getAllCaptures(currentTurn);
    if (allCaptures.length > 0) {
        return getCaptures(row, col);
    }

    return getSimpleMoves(row, col).concat(getCaptures(row, col));
}

function getSimpleMoves(row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    const moves = [];
    const directions = piece.king
        ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : piece.color === 'red'
            ? [[-1, -1], [-1, 1]]
            : [[1, -1], [1, 1]];

    for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;

        if (isValidSquare(newRow, newCol) && !board[newRow][newCol]) {
            moves.push({ row: newRow, col: newCol, capture: false });
        }
    }

    return moves;
}

function getCaptures(row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    const captures = [];
    const directions = piece.king
        ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : piece.color === 'red'
            ? [[-1, -1], [-1, 1]]
            : [[1, -1], [1, 1]];

    for (const [dr, dc] of directions) {
        const midRow = row + dr;
        const midCol = col + dc;
        const landRow = row + 2 * dr;
        const landCol = col + 2 * dc;

        if (isValidSquare(landRow, landCol)) {
            const midPiece = board[midRow][midCol];
            const landPiece = board[landRow][landCol];

            if (midPiece && midPiece.color !== piece.color && !landPiece) {
                captures.push({ row: landRow, col: landCol, capture: true });
            }
        }
    }

    return captures;
}

function getAllCaptures(color) {
    const captures = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === color) {
                const pieceCaptures = getCaptures(row, col);
                for (const c of pieceCaptures) {
                    captures.push({ fromRow: row, fromCol: col, ...c });
                }
            }
        }
    }

    return captures;
}

function isValidSquare(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

// ================================================
// OYUN SONU
// ================================================

function checkGameEnd() {
    if (pieceCount.red === 0) {
        endGame('white');
    } else if (pieceCount.white === 0) {
        endGame('red');
    } else if (!hasValidMoves(currentTurn)) {
        const winner = currentTurn === 'red' ? 'white' : 'red';
        endGame(winner);
    }
}

function hasValidMoves(color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === color) {
                if (getSimpleMoves(row, col).length > 0 || getCaptures(row, col).length > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

function endGame(winner) {
    gameOver = true;
    const winnerName = winner === 'red' ? player1NameStr : player2NameStr;
    gameOverMessage.textContent = `🏆 ${winnerName} Kazandı!`;
    gameOverModal.classList.remove('hidden');
}

// ================================================
// YAPAY ZEKA
// ================================================

function getAIDelay() {
    if (aiDifficulty === 'easy') return 1200;
    if (aiDifficulty === 'medium') return 700;
    return 400;
}

function makeAIMove() {
    if (gameOver) return;

    const allCaptures = getAllCaptures('white');
    let moves = [];

    if (allCaptures.length > 0) {
        moves = allCaptures.map(c => ({
            from: { row: c.fromRow, col: c.fromCol },
            to: { row: c.row, col: c.col },
            capture: true
        }));
    } else {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && piece.color === 'white') {
                    const simpleMoves = getSimpleMoves(row, col);
                    for (const m of simpleMoves) {
                        moves.push({
                            from: { row, col },
                            to: { row: m.row, col: m.col },
                            capture: false
                        });
                    }
                }
            }
        }
    }

    if (moves.length === 0) return;

    let selectedMove;

    if (aiDifficulty === 'easy') {
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
    } else if (aiDifficulty === 'medium') {
        // Yeme varsa yemeyi tercih et, yoksa ilerleme yap
        const captureMoves = moves.filter(m => m.capture);
        if (captureMoves.length > 0) {
            selectedMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
        } else {
            // İlerlemeyi tercih et
            moves.sort((a, b) => b.to.row - a.to.row);
            selectedMove = Math.random() < 0.7 ? moves[0] : moves[Math.floor(Math.random() * moves.length)];
        }
    } else {
        // Zor - en iyi hamle
        selectedMove = getBestMove(moves);
    }

    const moveInfo = { row: selectedMove.to.row, col: selectedMove.to.col, capture: selectedMove.capture };
    makeMove(selectedMove.from.row, selectedMove.from.col, selectedMove.to.row, selectedMove.to.col, moveInfo);
}

function getBestMove(moves) {
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
        let score = 0;

        // Yeme bonusu
        if (move.capture) score += 50;

        // İlerleme bonusu
        score += move.to.row * 5;

        // Kenar cezası
        if (move.to.col === 0 || move.to.col === 7) score -= 5;

        // Dama olma bonusu
        if (move.to.row === 7) score += 100;

        // Koruma - çapraz taşlar
        const leftDiag = board[move.to.row - 1]?.[move.to.col - 1];
        const rightDiag = board[move.to.row - 1]?.[move.to.col + 1];
        if (leftDiag?.color === 'white') score += 10;
        if (rightDiag?.color === 'white') score += 10;

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

// ================================================
// EVENT LISTENERS
// ================================================

resetBtn.addEventListener('click', resetGame);

closeRulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
});

playAgainBtn.addEventListener('click', () => {
    gameOverModal.classList.add('hidden');
    resetGame();
});

exitBtn.addEventListener('click', () => {
    location.href = 'index.html';
});

// Başlat
init();
