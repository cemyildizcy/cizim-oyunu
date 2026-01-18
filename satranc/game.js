// ================================================
// SATRANÇ - CHESS.COM KALİTESİNDE OYUN MOTORU
// Animasyonlar, Ses Efektleri, Drag & Drop
// ================================================

// --- TAŞ TANIMLARI ---
const PIECES = {
    // Beyaz
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    // Siyah
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

const PIECE_VALUES = {
    'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
};

// --- DOM ELEMENTLERİ ---
const boardEl = document.getElementById('chessBoard');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('resetGameBtn');
const topPlayerBox = document.getElementById('topPlayer');
const bottomPlayerBox = document.getElementById('bottomPlayer');
const topName = document.getElementById('topName');
const bottomName = document.getElementById('bottomName');
const topIcon = document.getElementById('topIcon');
const bottomIcon = document.getElementById('bottomIcon');
const topCaptures = document.getElementById('topCaptures');
const bottomCaptures = document.getElementById('bottomCaptures');
const topAdvantage = document.getElementById('topAdvantage');
const bottomAdvantage = document.getElementById('bottomAdvantage');
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
const flipBoardBtn = document.getElementById('flipBoardBtn');
const soundToggle = document.getElementById('soundToggle');
const resignBtn = document.getElementById('resignBtn');
const rankCoords = document.getElementById('rankCoords');
const fileCoords = document.getElementById('fileCoords');

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

// UI durumu
let pendingPromotion = null;
let isFlipped = false;
let soundEnabled = true;

// Drag & Drop
let isDragging = false;
let draggedPiece = null;
let draggedFrom = null;
let dragElement = null;

// Ses Efektleri (Web Audio API)
let audioContext = null;

// ================================================
// SES SİSTEMİ
// ================================================

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API desteklenmiyor');
    }
}

function playSound(type) {
    if (!soundEnabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.value = 0.1;

    switch (type) {
        case 'move':
            oscillator.frequency.value = 400;
            oscillator.type = 'sine';
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            break;
        case 'capture':
            oscillator.frequency.value = 300;
            oscillator.type = 'square';
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            break;
        case 'check':
            oscillator.frequency.value = 600;
            oscillator.type = 'sawtooth';
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            break;
        case 'castle':
            oscillator.frequency.value = 350;
            oscillator.type = 'triangle';
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            break;
        case 'gameEnd':
            oscillator.frequency.value = 523;
            oscillator.type = 'sine';
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            break;
    }

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

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

    isFlipped = playerColor === 'black';

    // Oyuncu isimlerini ayarla
    if (isFlipped) {
        bottomName.textContent = player1Name;
        topName.textContent = player2Name;
        bottomIcon.textContent = '♟️';
        topIcon.textContent = '♙';
    } else {
        bottomName.textContent = player1Name;
        topName.textContent = player2Name;
        bottomIcon.textContent = '♙';
        topIcon.textContent = '♟️';
    }

    initAudio();
    resetGame();
    renderCoordinates();
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
// KOORDİNATLAR
// ================================================

function renderCoordinates() {
    const files = isFlipped ? 'hgfedcba' : 'abcdefgh';
    const ranks = isFlipped ? '12345678' : '87654321';

    fileCoords.innerHTML = files.split('').map(f => `<span class="coord">${f}</span>`).join('');
    rankCoords.innerHTML = ranks.split('').map(r => `<span class="coord">${r}</span>`).join('');
}

// ================================================
// RENDER
// ================================================

function renderBoard() {
    boardEl.innerHTML = '';

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
                } else if (enPassantSquare && actualRow === enPassantSquare.row && actualCol === enPassantSquare.col) {
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
                pieceSpan.dataset.piece = piece;
                pieceSpan.dataset.row = actualRow;
                pieceSpan.dataset.col = actualCol;

                // Drag events
                pieceSpan.addEventListener('mousedown', (e) => startDrag(e, actualRow, actualCol));
                pieceSpan.addEventListener('touchstart', (e) => startDrag(e, actualRow, actualCol), { passive: false });

                square.appendChild(pieceSpan);
            }

            square.addEventListener('click', () => handleSquareClick(actualRow, actualCol));
            square.addEventListener('mouseup', () => handleSquareDrop(actualRow, actualCol));
            square.addEventListener('touchend', (e) => {
                e.preventDefault();
                handleSquareDrop(actualRow, actualCol);
            });

            boardEl.appendChild(square);
        }
    }
}

function updateUI() {
    // Sıra göstergesi
    const isWhiteTurn = currentTurn === 'white';
    const topIsBlack = !isFlipped;

    if (topIsBlack) {
        topPlayerBox.classList.toggle('active', !isWhiteTurn);
        bottomPlayerBox.classList.toggle('active', isWhiteTurn);
    } else {
        topPlayerBox.classList.toggle('active', isWhiteTurn);
        bottomPlayerBox.classList.toggle('active', !isWhiteTurn);
    }

    // Durum
    if (gameOver) {
        statusDiv.textContent = 'Oyun Bitti';
    } else {
        const turnName = currentTurn === 'white'
            ? (playerColor === 'white' ? player1Name : player2Name)
            : (playerColor === 'black' ? player1Name : player2Name);
        let statusText = `Sıra: ${turnName}`;
        if (isInCheck(currentTurn)) {
            statusText += ' ⚠️ ŞAH!';
        }
        statusDiv.textContent = statusText;
    }

    // Alınan taşlar ve materyal avantajı
    updateCapturesDisplay();

    // Hamle geçmişi
    renderMoveHistory();

    // Ses butonu
    soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    soundToggle.classList.toggle('sound-on', soundEnabled);
}

function updateCapturesDisplay() {
    const whiteCaptures = capturedPieces.white.map(p => PIECES[p]).join('');
    const blackCaptures = capturedPieces.black.map(p => PIECES[p]).join('');

    // Materyal hesapla
    let whiteMaterial = 0, blackMaterial = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const p = board[row][col];
            if (p) {
                const val = PIECE_VALUES[p.toLowerCase()];
                if (p === p.toUpperCase()) whiteMaterial += val;
                else blackMaterial += val;
            }
        }
    }

    const advantage = whiteMaterial - blackMaterial;

    if (isFlipped) {
        // Bottom = Black, Top = White
        bottomCaptures.textContent = blackCaptures;
        topCaptures.textContent = whiteCaptures;
        bottomAdvantage.textContent = advantage < 0 ? `+${Math.abs(advantage)}` : '';
        topAdvantage.textContent = advantage > 0 ? `+${advantage}` : '';
    } else {
        // Bottom = White, Top = Black
        bottomCaptures.textContent = whiteCaptures;
        topCaptures.textContent = blackCaptures;
        bottomAdvantage.textContent = advantage > 0 ? `+${advantage}` : '';
        topAdvantage.textContent = advantage < 0 ? `+${Math.abs(advantage)}` : '';
    }
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
// DRAG & DROP
// ================================================

function startDrag(e, row, col) {
    if (gameOver || pendingPromotion) return;
    if (isSinglePlayer && currentTurn !== playerColor) return;

    const piece = board[row][col];
    if (!piece) return;

    const pieceColor = piece === piece.toUpperCase() ? 'white' : 'black';
    if (pieceColor !== currentTurn) return;

    e.preventDefault();

    isDragging = true;
    draggedPiece = piece;
    draggedFrom = { row, col };

    // Seç ve geçerli hamleleri göster
    selectedSquare = { row, col };
    validMoves = getValidMoves(row, col);

    // Sürükleme elementi oluştur
    dragElement = document.createElement('span');
    dragElement.className = 'piece dragging';
    dragElement.textContent = PIECES[piece];
    document.body.appendChild(dragElement);

    // Pozisyonu ayarla
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    updateDragPosition(clientX, clientY);

    // Original taşı gizle
    renderBoard();

    const originalPiece = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"] .piece`);
    if (originalPiece) originalPiece.style.opacity = '0.3';

    // Mouse/Touch move events
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
}

function onDragMove(e) {
    if (!isDragging || !dragElement) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    updateDragPosition(clientX, clientY);
}

function updateDragPosition(x, y) {
    if (!dragElement) return;
    dragElement.style.left = (x - 25) + 'px';
    dragElement.style.top = (y - 25) + 'px';
}

function onDragEnd(e) {
    if (!isDragging) return;

    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);

    // Bırakılan kare
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    const element = document.elementFromPoint(clientX, clientY);
    const square = element?.closest('.square');

    if (square) {
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        handleSquareDrop(row, col);
    }

    // Temizle
    if (dragElement) {
        dragElement.remove();
        dragElement = null;
    }

    isDragging = false;
    draggedPiece = null;
    draggedFrom = null;

    renderBoard();
}

function handleSquareDrop(row, col) {
    if (!isDragging || !draggedFrom) return;

    if (validMoves.some(m => m.row === row && m.col === col)) {
        makeMove(draggedFrom.row, draggedFrom.col, row, col);
    }

    selectedSquare = null;
    validMoves = [];
}

// ================================================
// OYUN MEKANİĞİ
// ================================================

function handleSquareClick(row, col) {
    if (gameOver || pendingPromotion || isDragging) return;

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

    // Ses tipi belirle
    let soundType = 'move';
    if (captured) soundType = 'capture';

    // Hamleyi kaydet (notasyon için)
    const notation = getMoveNotation(fromRow, fromCol, toRow, toCol, piece, captured);

    // Geçerken alma
    let enPassantCapture = false;
    if (pieceType === 'p' && enPassantSquare && toRow === enPassantSquare.row && toCol === enPassantSquare.col) {
        const capturedPawnRow = color === 'white' ? toRow + 1 : toRow - 1;
        const capturedPawn = board[capturedPawnRow][toCol];
        capturedPieces[color].push(capturedPawn);
        board[capturedPawnRow][toCol] = null;
        soundType = 'capture';
        enPassantCapture = true;
    }

    // Rok
    let isCastling = false;
    if (pieceType === 'k' && Math.abs(toCol - fromCol) === 2) {
        isCastling = true;
        soundType = 'castle';
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
    updateCastlingRights(piece, fromRow, fromCol, toRow, toCol, captured);

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

    // Şah kontrolü
    if (isInCheck(currentTurn)) {
        soundType = 'check';
    }

    // Ses çal
    playSound(soundType);

    // Oyun sonu kontrolü
    checkGameEnd();

    renderBoard();
    updateUI();

    // AI hamlesi
    if (!gameOver && isSinglePlayer && currentTurn !== playerColor) {
        setTimeout(makeAIMove, getAIDelay());
    }
}

function updateCastlingRights(piece, fromRow, fromCol, toRow, toCol, captured) {
    const pieceType = piece.toLowerCase();
    const color = piece === piece.toUpperCase() ? 'white' : 'black';

    // Şah hareket etti
    if (pieceType === 'k') {
        castlingRights[color].kingSide = false;
        castlingRights[color].queenSide = false;
    }

    // Kale hareket etti veya alındı
    if (pieceType === 'r') {
        if (fromCol === 0) castlingRights[color].queenSide = false;
        if (fromCol === 7) castlingRights[color].kingSide = false;
    }

    // Rakip kale alındı
    if (captured) {
        const capturedType = captured.toLowerCase();
        if (capturedType === 'r') {
            const capturedColor = captured === captured.toUpperCase() ? 'white' : 'black';
            if (toCol === 0) castlingRights[capturedColor].queenSide = false;
            if (toCol === 7) castlingRights[capturedColor].kingSide = false;
        }
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

    // Kaynak (belirsizlik için)
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

    const moves = getPseudoLegalMoves(row, col, true);
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

    // Rok - özyineleme önleme için includeCastling parametresi
    if (includeCastling && !isInCheck(color)) {
        const kingRow = color === 'white' ? 7 : 0;

        // Kısa rok
        if (castlingRights[color].kingSide && board[kingRow][7]) {
            if (!board[kingRow][5] && !board[kingRow][6] &&
                !isSquareAttacked(kingRow, 5, color) && !isSquareAttacked(kingRow, 6, color)) {
                moves.push({ row: kingRow, col: 6 });
            }
        }

        // Uzun rok
        if (castlingRights[color].queenSide && board[kingRow][0]) {
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
        playSound('gameEnd');

        if (isInCheck(currentTurn)) {
            // Mat
            const winner = currentTurn === 'white'
                ? (playerColor === 'black' ? player1Name : player2Name)
                : (playerColor === 'white' ? player1Name : player2Name);
            showCheckmateAnimation(winner);
        } else {
            // Pat
            gameOverMessage.textContent = '🤝 Berabere!';
            gameOverReason.textContent = 'Pat - Yapılacak hamle yok';
            gameOverModal.classList.remove('hidden');
        }
    }
}

function showCheckmateAnimation(winner) {
    // Confetti efekti
    createConfetti();

    setTimeout(() => {
        gameOverMessage.textContent = `🏆 ${winner} Kazandı!`;
        gameOverReason.textContent = '♔ ŞAH MAT!';
        gameOverModal.classList.remove('hidden');
    }, 500);
}

function createConfetti() {
    const colors = ['#ff2d95', '#00f0ff', '#a855f7', '#22c55e', '#f59e0b'];
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
            document.body.appendChild(confetti);

            setTimeout(() => confetti.remove(), 4000);
        }, i * 30);
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
// YAPAY ZEKA - ELO BAZLI SİSTEM
// Kolay: 0-500 ELO, Orta: 500-1500 ELO, Zor: 1500+ ELO
// ================================================

// Piece-Square Tablolar (Taş konumlandırma değerleri)
const PAWN_TABLE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0]
];

const KNIGHT_TABLE = [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50]
];

const BISHOP_TABLE = [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20]
];

const ROOK_TABLE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0]
];

const QUEEN_TABLE = [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20]
];

const KING_MIDDLE_TABLE = [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20]
];

const KING_END_TABLE = [
    [-50, -40, -30, -20, -20, -30, -40, -50],
    [-30, -20, -10, 0, 0, -10, -20, -30],
    [-30, -10, 20, 30, 30, 20, -10, -30],
    [-30, -10, 30, 40, 40, 30, -10, -30],
    [-30, -10, 30, 40, 40, 30, -10, -30],
    [-30, -10, 20, 30, 30, 20, -10, -30],
    [-30, -30, 0, 0, 0, 0, -30, -30],
    [-50, -30, -30, -30, -30, -30, -30, -50]
];

// ELO bazlı AI ayarları
const AI_SETTINGS = {
    easy: {
        elo: 400,           // Ortalama ELO
        depth: 1,           // Arama derinliği
        blunderChance: 0.4, // %40 kötü hamle yapma şansı
        missChance: 0.3,    // %30 en iyi hamleyi kaçırma
        randomness: 50,     // Değerlendirmeye rastgelelik ekle
        usePositionTables: false,
        delay: 1500
    },
    medium: {
        elo: 1000,
        depth: 2,
        blunderChance: 0.1,
        missChance: 0.15,
        randomness: 15,
        usePositionTables: true,
        delay: 800
    },
    hard: {
        elo: 1700,
        depth: 3,
        blunderChance: 0.02,
        missChance: 0.05,
        randomness: 5,
        usePositionTables: true,
        delay: 500
    }
};

function getAIDelay() {
    return AI_SETTINGS[aiDifficulty].delay;
}

function makeAIMove() {
    if (gameOver) return;

    const settings = AI_SETTINGS[aiDifficulty];
    const aiColor = playerColor === 'white' ? 'black' : 'white';
    const moves = getAllMoves(aiColor);

    if (moves.length === 0) return;

    // Tüm hamleleri değerlendir
    const scoredMoves = moves.map(move => ({
        move,
        score: evaluateMove(move, aiColor, settings.depth, settings.usePositionTables)
    }));

    // Puana göre sırala (en iyiden en kötüye)
    scoredMoves.sort((a, b) => b.score - a.score);

    let selectedMove;

    // Blunder (çok kötü hamle) kontrolü
    if (Math.random() < settings.blunderChance && scoredMoves.length > 3) {
        // Alt yarıdan rastgele seç
        const bottomHalf = scoredMoves.slice(Math.floor(scoredMoves.length / 2));
        selectedMove = bottomHalf[Math.floor(Math.random() * bottomHalf.length)].move;
    }
    // En iyi hamleyi kaçırma
    else if (Math.random() < settings.missChance && scoredMoves.length > 1) {
        // 2. veya 3. en iyi hamleyi seç
        const index = Math.min(1 + Math.floor(Math.random() * 2), scoredMoves.length - 1);
        selectedMove = scoredMoves[index].move;
    }
    // Normal oyun
    else {
        // Rastgelelik ekle ve benzer puanlı hamleler arasından seç
        const topScore = scoredMoves[0].score;
        const threshold = topScore - settings.randomness;
        const goodMoves = scoredMoves.filter(m => m.score >= threshold);
        selectedMove = goodMoves[Math.floor(Math.random() * goodMoves.length)].move;
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
                moves.push({ from: { row, col }, to: move, piece });
            }
        }
    }
    return moves;
}

function evaluateMove(move, color, depth, usePositionTables) {
    const tempBoard = board.map(r => [...r]);
    const tempCastling = JSON.parse(JSON.stringify(castlingRights));
    const tempEnPassant = enPassantSquare;

    const piece = board[move.from.row][move.from.col];
    const captured = board[move.to.row][move.to.col];

    // Hamleyi uygula
    board[move.to.row][move.to.col] = piece;
    board[move.from.row][move.from.col] = null;

    let score = 0;

    // Taş alma değeri (centipawn)
    if (captured) {
        score += PIECE_VALUES[captured.toLowerCase()] * 100;
    }

    // Pozisyon değerlendirmesi
    if (usePositionTables) {
        score += getPositionScore(color);
    } else {
        // Basit merkez kontrolü
        if (move.to.row >= 3 && move.to.row <= 4 && move.to.col >= 3 && move.to.col <= 4) {
            score += 10;
        }
    }

    // Şah tehdidi
    const enemyColor = color === 'white' ? 'black' : 'white';
    if (isInCheck(enemyColor)) {
        score += 50;
    }

    // Mat kontrolü
    if (!hasLegalMoves(enemyColor) && isInCheck(enemyColor)) {
        score += 100000;
    }

    // Rok bonusu
    if (piece.toLowerCase() === 'k' && Math.abs(move.to.col - move.from.col) === 2) {
        score += 60;
    }

    // Geliştirme bonusu (açılışta)
    if (fullMoveNumber <= 10) {
        if (piece.toLowerCase() === 'n' || piece.toLowerCase() === 'b') {
            if ((color === 'white' && move.from.row === 7) ||
                (color === 'black' && move.from.row === 0)) {
                score += 30;
            }
        }
    }

    // Derinlik > 1 ise minimax
    if (depth > 1) {
        const enemyMoves = getAllMoves(enemyColor);
        let bestEnemyScore = -Infinity;

        // Performans için hamle sayısını sınırla
        const limitedMoves = enemyMoves.slice(0, depth === 3 ? 8 : 12);

        for (const em of limitedMoves) {
            const enemyScore = evaluateMove(em, enemyColor, depth - 1, usePositionTables);
            bestEnemyScore = Math.max(bestEnemyScore, enemyScore);
        }
        score -= bestEnemyScore * 0.9;
    }

    // Geri al
    board = tempBoard;
    castlingRights = tempCastling;
    enPassantSquare = tempEnPassant;

    return score;
}

function getPositionScore(color) {
    let score = 0;
    let totalPieces = 0;

    // Toplam taş sayısını hesapla (oyun sonu tespiti için)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col]) totalPieces++;
        }
    }

    const isEndgame = totalPieces <= 12;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            const pieceColor = piece === piece.toUpperCase() ? 'white' : 'black';
            const pieceType = piece.toLowerCase();
            const isWhite = pieceColor === 'white';

            // Tabloya göre satır (siyah için ters çevir)
            const tableRow = isWhite ? row : 7 - row;

            let posValue = 0;
            switch (pieceType) {
                case 'p': posValue = PAWN_TABLE[tableRow][col]; break;
                case 'n': posValue = KNIGHT_TABLE[tableRow][col]; break;
                case 'b': posValue = BISHOP_TABLE[tableRow][col]; break;
                case 'r': posValue = ROOK_TABLE[tableRow][col]; break;
                case 'q': posValue = QUEEN_TABLE[tableRow][col]; break;
                case 'k': posValue = isEndgame ? KING_END_TABLE[tableRow][col] : KING_MIDDLE_TABLE[tableRow][col]; break;
            }

            // Materyal değeri
            const materialValue = PIECE_VALUES[pieceType] * 100;

            if (pieceColor === color) {
                score += materialValue + posValue;
            } else {
                score -= materialValue + posValue;
            }
        }
    }

    return score;
}

// ================================================
// EVENT LISTENERS
// ================================================

resetBtn.addEventListener('click', resetGame);

closeRulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
    // Ses kontekstini başlat (kullanıcı etkileşimi gerekli)
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
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

flipBoardBtn.addEventListener('click', () => {
    isFlipped = !isFlipped;
    renderCoordinates();
    renderBoard();
});

soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    updateUI();
    if (soundEnabled) playSound('move');
});

resignBtn.addEventListener('click', () => {
    if (gameOver) return;
    if (confirm('Teslim olmak istediğine emin misin?')) {
        gameOver = true;
        const winner = currentTurn === playerColor ? player2Name : player1Name;
        gameOverMessage.textContent = `🏳️ ${winner} Kazandı!`;
        gameOverReason.textContent = 'Rakip teslim oldu';
        gameOverModal.classList.remove('hidden');
        playSound('gameEnd');
    }
});

// Başlat
init();
