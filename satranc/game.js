// ================================================
// SATRANÇ - OYUN MOTORU
// Kralların Oyunu
// ================================================

// --- TAŞ TANIMLARI ---
const PIECES = {
    // Beyaz
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    // Siyah
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

const PIECE_VALUES = {
    'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100
};

// --- DOM ELEMENTLERİ ---
const boardEl = document.getElementById('chessBoard');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('resetGameBtn');
const whitePlayerBox = document.getElementById('whitePlayer');
const blackPlayerBox = document.getElementById('blackPlayer');
const whiteName = document.getElementById('whiteName');
const blackName = document.getElementById('blackName');
const whiteCaptures = document.getElementById('whiteCaptures');
const blackCaptures = document.getElementById('blackCaptures');
const movesList = document.getElementById('movesList');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverMessage = document.getElementById('gameOverMessage');
const gameOverReason = document.getElementById('gameOverReason');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitBtn = document.getElementById('exitBtn');
const rulesModal = document.getElementById('rulesModal');
const closeRulesBtn = document.getElementById('closeRulesBtn');
const promotionModal = document.getElementById('promotionModal');
const promotionOptions = document.getElementById('promotionOptions');

// --- OYUN DEĞİŞKENLERİ ---
let player1Name = 'Oyuncu';
let player2Name = 'Bilgisayar';
let isSinglePlayer = true;
let aiDifficulty = 'medium';
let playerColor = 'white';

let board = [];
let currentTurn = 'white';
let selectedSquare = null;
let validMoves = [];
let moveHistory = [];
let capturedPieces = { white: [], black: [] };
let gameOver = false;

// Özel hamle durumları
let castlingRights = {
    white: { kingSide: true, queenSide: true },
    black: { kingSide: true, queenSide: true }
};
let enPassantSquare = null;
let lastMove = null;
let halfMoveClock = 0;
let fullMoveNumber = 1;

// Piyon terfi için
let pendingPromotion = null;

// ================================================
// BAŞLATMA
// ================================================

function init() {
    const params = new URLSearchParams(window.location.search);
    player1Name = params.get('p1') || 'Oyuncu';
    player2Name = params.get('p2') || 'Bilgisayar';
    isSinglePlayer = params.get('mode') === 'ai';
    aiDifficulty = params.get('diff') || 'medium';
    playerColor = params.get('color') || 'white';

    whiteName.textContent = playerColor === 'white' ? player1Name : player2Name;
    blackName.textContent = playerColor === 'black' ? player1Name : player2Name;

    resetGame();
    rulesModal.classList.remove('hidden');
}

function resetGame() {
    board = createInitialBoard();
    currentTurn = 'white';
    selectedSquare = null;
    validMoves = [];
    moveHistory = [];
    capturedPieces = { white: [], black: [] };
    gameOver = false;
    castlingRights = {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true }
    };
    enPassantSquare = null;
    lastMove = null;
    halfMoveClock = 0;
    fullMoveNumber = 1;
    pendingPromotion = null;

    renderBoard();
    updateUI();
    gameOverModal.classList.add('hidden');
}

function createInitialBoard() {
    return [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
}

// ================================================
// RENDER
// ================================================

function renderBoard() {
    boardEl.innerHTML = '';

    const isFlipped = playerColor === 'black';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const actualRow = isFlipped ? 7 - row : row;
            const actualCol = isFlipped ? 7 - col : col;

            const square = document.createElement('div');
            square.className = 'square';
            square.classList.add((actualRow + actualCol) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = actualRow;
            square.dataset.col = actualCol;

            // Seçili kare
            if (selectedSquare && selectedSquare.row === actualRow && selectedSquare.col === actualCol) {
                square.classList.add('selected');
            }

            // Geçerli hamle
            const isValidMove = validMoves.some(m => m.row === actualRow && m.col === actualCol);
            if (isValidMove) {
                if (board[actualRow][actualCol]) {
                    square.classList.add('valid-capture');
                } else {
                    square.classList.add('valid-move');
                }
            }

            // Son hamle
            if (lastMove) {
                if ((lastMove.from.row === actualRow && lastMove.from.col === actualCol) ||
                    (lastMove.to.row === actualRow && lastMove.to.col === actualCol)) {
                    square.classList.add('last-move');
                }
            }

            // Şah durumu
            const piece = board[actualRow][actualCol];
            if (piece && (piece === 'K' || piece === 'k')) {
                const pieceColor = piece === piece.toUpperCase() ? 'white' : 'black';
                if (isInCheck(pieceColor)) {
                    square.classList.add('check');
                }
            }

            // Taş
            if (piece) {
                const pieceSpan = document.createElement('span');
                pieceSpan.className = 'piece';
                pieceSpan.textContent = PIECES[piece];
                square.appendChild(pieceSpan);
            }

            square.addEventListener('click', () => handleSquareClick(actualRow, actualCol));
            boardEl.appendChild(square);
        }
    }
}

function updateUI() {
    // Sıra göstergesi
    whitePlayerBox.classList.toggle('active', currentTurn === 'white');
    blackPlayerBox.classList.toggle('active', currentTurn === 'black');

    // Durum
    if (gameOver) {
        statusDiv.textContent = 'Oyun Bitti';
    } else {
        const turnName = currentTurn === 'white' ? whiteName.textContent : blackName.textContent;
        let statusText = `Sıra: ${turnName}`;
        if (isInCheck(currentTurn)) {
            statusText += ' ⚠️ ŞAH!';
        }
        statusDiv.textContent = statusText;
    }

    // Alınan taşlar
    whiteCaptures.textContent = capturedPieces.white.map(p => PIECES[p]).join('');
    blackCaptures.textContent = capturedPieces.black.map(p => PIECES[p]).join('');

    // Hamle geçmişi
    renderMoveHistory();
}

function renderMoveHistory() {
    movesList.innerHTML = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const pair = document.createElement('span');
        pair.className = 'move-pair';
        pair.innerHTML = `<span class="move-number">${moveNum}.</span> ${moveHistory[i]}`;
        if (moveHistory[i + 1]) {
            pair.innerHTML += ` ${moveHistory[i + 1]}`;
        }
        movesList.appendChild(pair);
    }
    movesList.scrollTop = movesList.scrollHeight;
}

// ================================================
// OYUN MEKANİĞİ
// ================================================

function handleSquareClick(row, col) {
    if (gameOver || pendingPromotion) return;

    // AI sırası
    if (isSinglePlayer && currentTurn !== playerColor) return;

    const piece = board[row][col];
    const pieceColor = piece ? (piece === piece.toUpperCase() ? 'white' : 'black') : null;

    // Geçerli hamle yapma
    if (selectedSquare && validMoves.some(m => m.row === row && m.col === col)) {
        makeMove(selectedSquare.row, selectedSquare.col, row, col);
        selectedSquare = null;
        validMoves = [];
        renderBoard();
        return;
    }

    // Taş seçme
    if (piece && pieceColor === currentTurn) {
        selectedSquare = { row, col };
        validMoves = getValidMoves(row, col);
        renderBoard();
    } else {
        selectedSquare = null;
        validMoves = [];
        renderBoard();
    }
}

function makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    const piece = board[fromRow][fromCol];
    const captured = board[toRow][toCol];
    const pieceType = piece.toLowerCase();
    const color = piece === piece.toUpperCase() ? 'white' : 'black';

    // Piyon terfi kontrolü
    if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
        if (!promotionPiece) {
            pendingPromotion = { fromRow, fromCol, toRow, toCol };
            showPromotionModal(color);
            return;
        }
    }

    // Hamleyi kaydet (notasyon için)
    const notation = getMoveNotation(fromRow, fromCol, toRow, toCol, piece, captured);

    // Geçerken alma
    if (pieceType === 'p' && enPassantSquare && toRow === enPassantSquare.row && toCol === enPassantSquare.col) {
        const capturedPawnRow = color === 'white' ? toRow + 1 : toRow - 1;
        const capturedPawn = board[capturedPawnRow][toCol];
        capturedPieces[color].push(capturedPawn);
        board[capturedPawnRow][toCol] = null;
    }

    // Rok
    if (pieceType === 'k' && Math.abs(toCol - fromCol) === 2) {
        if (toCol > fromCol) {
            // Kısa rok
            board[fromRow][5] = board[fromRow][7];
            board[fromRow][7] = null;
        } else {
            // Uzun rok
            board[fromRow][3] = board[fromRow][0];
            board[fromRow][0] = null;
        }
    }

    // Alınan taşı kaydet
    if (captured) {
        capturedPieces[color].push(captured);
    }

    // Hamleyi yap
    board[toRow][toCol] = promotionPiece || piece;
    board[fromRow][fromCol] = null;

    // Rok haklarını güncelle
    updateCastlingRights(piece, fromRow, fromCol);

    // En passant karesini güncelle
    if (pieceType === 'p' && Math.abs(toRow - fromRow) === 2) {
        enPassantSquare = { row: (fromRow + toRow) / 2, col: toCol };
    } else {
        enPassantSquare = null;
    }

    // Son hamleyi kaydet
    lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };

    // Hamle geçmişine ekle
    moveHistory.push(notation);

    // Sıra değiştir
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    if (currentTurn === 'white') fullMoveNumber++;

    // Oyun sonu kontrolü
    checkGameEnd();

    renderBoard();
    updateUI();

    // AI hamlesi
    if (!gameOver && isSinglePlayer && currentTurn !== playerColor) {
        setTimeout(makeAIMove, getAIDelay());
    }
}

function updateCastlingRights(piece, fromRow, fromCol) {
    const pieceType = piece.toLowerCase();
    const color = piece === piece.toUpperCase() ? 'white' : 'black';

    if (pieceType === 'k') {
        castlingRights[color].kingSide = false;
        castlingRights[color].queenSide = false;
    } else if (pieceType === 'r') {
        if (fromCol === 0) castlingRights[color].queenSide = false;
        if (fromCol === 7) castlingRights[color].kingSide = false;
    }
}

function getMoveNotation(fromRow, fromCol, toRow, toCol, piece, captured) {
    const pieceType = piece.toLowerCase();
    const files = 'abcdefgh';
    const ranks = '87654321';

    let notation = '';

    // Rok
    if (pieceType === 'k' && Math.abs(toCol - fromCol) === 2) {
        return toCol > fromCol ? 'O-O' : 'O-O-O';
    }

    // Taş harfi (piyon hariç)
    if (pieceType !== 'p') {
        notation += pieceType.toUpperCase();
    }

    // Kaynak (belirsizlik varsa)
    notation += files[fromCol];

    // Alma
    if (captured || (pieceType === 'p' && fromCol !== toCol)) {
        notation += 'x';
    }

    // Hedef kare
    notation += files[toCol] + ranks[toRow];

    return notation;
}

// ================================================
// HAMLE HESAPLAMA
// ================================================

function getValidMoves(row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    const moves = getPseudoLegalMoves(row, col);
    const color = piece === piece.toUpperCase() ? 'white' : 'black';

    // Şahı tehlikeye atan hamleleri filtrele
    return moves.filter(move => {
        const tempBoard = board.map(r => [...r]);
        const tempEnPassant = enPassantSquare;

        // Geçerken alma
        if (piece.toLowerCase() === 'p' && enPassantSquare &&
            move.row === enPassantSquare.row && move.col === enPassantSquare.col) {
            const capturedRow = color === 'white' ? move.row + 1 : move.row - 1;
            board[capturedRow][move.col] = null;
        }

        board[move.row][move.col] = piece;
        board[row][col] = null;

        const inCheck = isInCheck(color);

        board = tempBoard;
        enPassantSquare = tempEnPassant;

        return !inCheck;
    });
}

function getPseudoLegalMoves(row, col, includeCastling = true) {
    const piece = board[row][col];
    if (!piece) return [];

    const pieceType = piece.toLowerCase();
    const color = piece === piece.toUpperCase() ? 'white' : 'black';

    switch (pieceType) {
        case 'p': return getPawnMoves(row, col, color);
        case 'n': return getKnightMoves(row, col, color);
        case 'b': return getBishopMoves(row, col, color);
        case 'r': return getRookMoves(row, col, color);
        case 'q': return getQueenMoves(row, col, color);
        case 'k': return getKingMoves(row, col, color, includeCastling);
        default: return [];
    }
}

function getPawnMoves(row, col, color) {
    const moves = [];
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;

    // İleri
    if (isValidSquare(row + direction, col) && !board[row + direction][col]) {
        moves.push({ row: row + direction, col });

        // İlk hamlede 2 kare
        if (row === startRow && !board[row + 2 * direction][col]) {
            moves.push({ row: row + 2 * direction, col });
        }
    }

    // Çapraz alma
    for (const dc of [-1, 1]) {
        const newRow = row + direction;
        const newCol = col + dc;
        if (isValidSquare(newRow, newCol)) {
            const target = board[newRow][newCol];
            if (target && isEnemyPiece(target, color)) {
                moves.push({ row: newRow, col: newCol });
            }
            // Geçerken alma
            if (enPassantSquare && newRow === enPassantSquare.row && newCol === enPassantSquare.col) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }

    return moves;
}

function getKnightMoves(row, col, color) {
    const moves = [];
    const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

    for (const [dr, dc] of offsets) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (isValidSquare(newRow, newCol)) {
            const target = board[newRow][newCol];
            if (!target || isEnemyPiece(target, color)) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }

    return moves;
}

function getBishopMoves(row, col, color) {
    return getSlidingMoves(row, col, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
}

function getRookMoves(row, col, color) {
    return getSlidingMoves(row, col, color, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
}

function getQueenMoves(row, col, color) {
    return getSlidingMoves(row, col, color, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);
}

function getSlidingMoves(row, col, color, directions) {
    const moves = [];

    for (const [dr, dc] of directions) {
        let newRow = row + dr;
        let newCol = col + dc;

        while (isValidSquare(newRow, newCol)) {
            const target = board[newRow][newCol];
            if (!target) {
                moves.push({ row: newRow, col: newCol });
            } else {
                if (isEnemyPiece(target, color)) {
                    moves.push({ row: newRow, col: newCol });
                }
                break;
            }
            newRow += dr;
            newCol += dc;
        }
    }

    return moves;
}

function getKingMoves(row, col, color, includeCastling = true) {
    const moves = [];
    const offsets = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

    for (const [dr, dc] of offsets) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (isValidSquare(newRow, newCol)) {
            const target = board[newRow][newCol];
            if (!target || isEnemyPiece(target, color)) {
                moves.push({ row: newRow, col: newCol });
            }
        }
    }

    // Rok - sadece includeCastling true ise kontrol et (özyineleme önleme)
    if (includeCastling && !isInCheck(color)) {
        const kingRow = color === 'white' ? 7 : 0;

        // Kısa rok
        if (castlingRights[color].kingSide) {
            if (!board[kingRow][5] && !board[kingRow][6] &&
                !isSquareAttacked(kingRow, 5, color) && !isSquareAttacked(kingRow, 6, color)) {
                moves.push({ row: kingRow, col: 6 });
            }
        }

        // Uzun rok
        if (castlingRights[color].queenSide) {
            if (!board[kingRow][1] && !board[kingRow][2] && !board[kingRow][3] &&
                !isSquareAttacked(kingRow, 2, color) && !isSquareAttacked(kingRow, 3, color)) {
                moves.push({ row: kingRow, col: 2 });
            }
        }
    }

    return moves;
}

// ================================================
// YARDIMCI FONKSİYONLAR
// ================================================

function isValidSquare(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function isEnemyPiece(piece, color) {
    if (!piece) return false;
    const pieceColor = piece === piece.toUpperCase() ? 'white' : 'black';
    return pieceColor !== color;
}

function findKing(color) {
    const king = color === 'white' ? 'K' : 'k';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === king) {
                return { row, col };
            }
        }
    }
    return null;
}

function isInCheck(color) {
    const king = findKing(color);
    if (!king) return false;
    return isSquareAttacked(king.row, king.col, color);
}

function isSquareAttacked(row, col, byColor) {
    const enemyColor = byColor === 'white' ? 'black' : 'white';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;

            const pieceColor = piece === piece.toUpperCase() ? 'white' : 'black';
            if (pieceColor !== enemyColor) continue;

            // includeCastling = false ile çağır, özyinelemeyi önle
            const moves = getPseudoLegalMoves(r, c, false);
            if (moves.some(m => m.row === row && m.col === col)) {
                return true;
            }
        }
    }
    return false;
}

function hasLegalMoves(color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            const pieceColor = piece === piece.toUpperCase() ? 'white' : 'black';
            if (pieceColor !== color) continue;

            if (getValidMoves(row, col).length > 0) {
                return true;
            }
        }
    }
    return false;
}

function checkGameEnd() {
    if (!hasLegalMoves(currentTurn)) {
        gameOver = true;
        if (isInCheck(currentTurn)) {
            // Mat
            const winner = currentTurn === 'white' ? blackName.textContent : whiteName.textContent;
            gameOverMessage.textContent = `🏆 ${winner} Kazandı!`;
            gameOverReason.textContent = 'Şah Mat!';
        } else {
            // Pat
            gameOverMessage.textContent = 'Berabere!';
            gameOverReason.textContent = 'Pat - Hamle yapılamıyor';
        }
        gameOverModal.classList.remove('hidden');
    }
}

// ================================================
// PİYON TERFİ
// ================================================

function showPromotionModal(color) {
    promotionOptions.innerHTML = '';
    const pieces = color === 'white' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];

    pieces.forEach(p => {
        const btn = document.createElement('div');
        btn.className = 'promotion-piece';
        btn.textContent = PIECES[p];
        btn.addEventListener('click', () => {
            promotionModal.classList.add('hidden');
            const { fromRow, fromCol, toRow, toCol } = pendingPromotion;
            pendingPromotion = null;
            makeMove(fromRow, fromCol, toRow, toCol, p);
        });
        promotionOptions.appendChild(btn);
    });

    promotionModal.classList.remove('hidden');
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

    const aiColor = playerColor === 'white' ? 'black' : 'white';
    const moves = getAllMoves(aiColor);

    if (moves.length === 0) return;

    let selectedMove;

    if (aiDifficulty === 'easy') {
        // %80 rastgele
        if (Math.random() < 0.8) {
            selectedMove = moves[Math.floor(Math.random() * moves.length)];
        } else {
            selectedMove = getBestMove(moves, aiColor, 1);
        }
    } else if (aiDifficulty === 'medium') {
        // %70 akıllı
        if (Math.random() < 0.7) {
            selectedMove = getBestMove(moves, aiColor, 2);
        } else {
            selectedMove = moves[Math.floor(Math.random() * moves.length)];
        }
    } else {
        // %95 akıllı
        if (Math.random() < 0.95) {
            selectedMove = getBestMove(moves, aiColor, 3);
        } else {
            selectedMove = moves[Math.floor(Math.random() * moves.length)];
        }
    }

    makeMove(selectedMove.from.row, selectedMove.from.col, selectedMove.to.row, selectedMove.to.col);
}

function getAllMoves(color) {
    const moves = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            const pieceColor = piece === piece.toUpperCase() ? 'white' : 'black';
            if (pieceColor !== color) continue;

            const validMoves = getValidMoves(row, col);
            for (const move of validMoves) {
                moves.push({ from: { row, col }, to: move });
            }
        }
    }
    return moves;
}

function getBestMove(moves, color, depth) {
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
        const score = evaluateMove(move, color, depth);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

function evaluateMove(move, color, depth) {
    const tempBoard = board.map(r => [...r]);
    const tempCastling = JSON.parse(JSON.stringify(castlingRights));
    const tempEnPassant = enPassantSquare;

    const piece = board[move.from.row][move.from.col];
    const captured = board[move.to.row][move.to.col];

    // Hamleyi uygula
    board[move.to.row][move.to.col] = piece;
    board[move.from.row][move.from.col] = null;

    let score = 0;

    // Taş alma değeri
    if (captured) {
        score += PIECE_VALUES[captured.toLowerCase()] * 10;
    }

    // Merkez kontrolü
    if (move.to.row >= 3 && move.to.row <= 4 && move.to.col >= 3 && move.to.col <= 4) {
        score += 5;
    }

    // Şah tehdidi
    const enemyColor = color === 'white' ? 'black' : 'white';
    if (isInCheck(enemyColor)) {
        score += 20;
    }

    // Mat kontrolü
    if (!hasLegalMoves(enemyColor) && isInCheck(enemyColor)) {
        score += 1000;
    }

    // Derinlik > 1 ise rakip hamlelerini değerlendir
    if (depth > 1) {
        const enemyMoves = getAllMoves(enemyColor);
        let worstEnemyResponse = 0;
        for (const em of enemyMoves.slice(0, 5)) { // Performans için sınırla
            const enemyScore = evaluateMove(em, enemyColor, depth - 1);
            worstEnemyResponse = Math.max(worstEnemyResponse, enemyScore);
        }
        score -= worstEnemyResponse * 0.8;
    }

    // Geri al
    board = tempBoard;
    castlingRights = tempCastling;
    enPassantSquare = tempEnPassant;

    return score;
}

// ================================================
// EVENT LISTENERS
// ================================================

resetBtn.addEventListener('click', resetGame);

closeRulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
    // AI siyahsa ilk hamle
    if (isSinglePlayer && playerColor === 'black') {
        setTimeout(makeAIMove, 500);
    }
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
