// ================================================
// GO (BADUK) - OYUN MOTORU
// Klasik • Strateji • Minimalist
// ================================================

// --- DOM Elementleri ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('resetGameBtn');
const passBtn = document.getElementById('passBtn');
const boardSizeDisplay = document.getElementById('boardSizeDisplay');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverMessage = document.getElementById('gameOverMessage');
const finalScores = document.getElementById('finalScores');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitBtn = document.getElementById('exitBtn');
const rulesModal = document.getElementById('rulesModal');
const closeRulesBtn = document.getElementById('closeRulesBtn');
const blackCaptures = document.getElementById('blackCaptures');
const whiteCaptures = document.getElementById('whiteCaptures');
const blackScoreBox = document.getElementById('blackScore');
const whiteScoreBox = document.getElementById('whiteScore');
const blackNameEl = document.getElementById('blackName');
const whiteNameEl = document.getElementById('whiteName');

// --- Oyun Değişkenleri ---
let boardSize = 9;
let cellSize = 40;
let padding = 20;
let board = []; // 0=boş, 1=siyah, 2=beyaz
let currentPlayer = 1; // 1=siyah, 2=beyaz
let captures = { 1: 0, 2: 0 };
let passCount = 0;
let gameOver = false;
let lastBoardState = null; // Ko kuralı için
let isSinglePlayer = false;
let aiDifficulty = 'easy';
let player1Name = 'Siyah';
let player2Name = 'Beyaz';

// --- Renk Paleti ---
const COLORS = {
    board: '#DEB887',
    gridLine: '#8B7355',
    black: '#1a1a1a',
    white: '#f5f5f5',
    blackShadow: '#000000',
    whiteShadow: '#cccccc',
    starPoint: '#5D4E37',
    lastMove: '#ef4444'
};

// ================================================
// BAŞLATMA
// ================================================

function init() {
    const params = new URLSearchParams(window.location.search);
    boardSize = parseInt(params.get('size')) || 9;
    player1Name = params.get('p1') || 'Siyah';
    player2Name = params.get('p2') || 'Beyaz';
    isSinglePlayer = params.get('mode') === 'ai';
    aiDifficulty = params.get('diff') || 'easy';

    blackNameEl.textContent = player1Name;
    whiteNameEl.textContent = player2Name;
    boardSizeDisplay.textContent = `${boardSize}×${boardSize}`;

    resizeCanvas();
    resetGame();

    rulesModal.classList.remove('hidden');
}

function resizeCanvas() {
    const container = canvas.parentElement;
    const maxWidth = Math.min(container.clientWidth - 32, 500);
    cellSize = Math.floor((maxWidth - padding * 2) / (boardSize - 1));
    const canvasSize = cellSize * (boardSize - 1) + padding * 2;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
}

function resetGame() {
    board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(0));
    currentPlayer = 1;
    captures = { 1: 0, 2: 0 };
    passCount = 0;
    gameOver = false;
    lastBoardState = null;
    updateUI();
    draw();
}

// ================================================
// ÇİZİM
// ================================================

function draw() {
    ctx.fillStyle = COLORS.board;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Izgara çizgileri
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;

    for (let i = 0; i < boardSize; i++) {
        const pos = padding + i * cellSize;
        // Yatay
        ctx.beginPath();
        ctx.moveTo(padding, pos);
        ctx.lineTo(padding + (boardSize - 1) * cellSize, pos);
        ctx.stroke();
        // Dikey
        ctx.beginPath();
        ctx.moveTo(pos, padding);
        ctx.lineTo(pos, padding + (boardSize - 1) * cellSize);
        ctx.stroke();
    }

    // Yıldız noktaları (hoshi)
    drawStarPoints();

    // Taşlar
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (board[y][x] !== 0) {
                drawStone(x, y, board[y][x]);
            }
        }
    }
}

function drawStarPoints() {
    ctx.fillStyle = COLORS.starPoint;
    let points = [];

    if (boardSize === 9) {
        points = [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]];
    } else if (boardSize === 13) {
        points = [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]];
    } else if (boardSize === 19) {
        points = [
            [3, 3], [9, 3], [15, 3],
            [3, 9], [9, 9], [15, 9],
            [3, 15], [9, 15], [15, 15]
        ];
    }

    for (const [x, y] of points) {
        const px = padding + x * cellSize;
        const py = padding + y * cellSize;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawStone(x, y, player) {
    const px = padding + x * cellSize;
    const py = padding + y * cellSize;
    const radius = cellSize * 0.42;

    // Gölge
    ctx.beginPath();
    ctx.arc(px + 2, py + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = player === 1 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)';
    ctx.fill();

    // Taş
    const gradient = ctx.createRadialGradient(
        px - radius * 0.3, py - radius * 0.3, 0,
        px, py, radius
    );

    if (player === 1) {
        gradient.addColorStop(0, '#4a4a4a');
        gradient.addColorStop(1, COLORS.black);
    } else {
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, '#e0e0e0');
    }

    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Parlaklık
    ctx.beginPath();
    ctx.arc(px - radius * 0.25, py - radius * 0.25, radius * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = player === 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)';
    ctx.fill();
}

// ================================================
// OYUN MEKANİĞİ
// ================================================

function getNeighbors(x, y) {
    const neighbors = [];
    if (x > 0) neighbors.push([x - 1, y]);
    if (x < boardSize - 1) neighbors.push([x + 1, y]);
    if (y > 0) neighbors.push([x, y - 1]);
    if (y < boardSize - 1) neighbors.push([x, y + 1]);
    return neighbors;
}

function getGroup(x, y, visited = new Set()) {
    const key = `${x},${y}`;
    if (visited.has(key)) return [];
    visited.add(key);

    const player = board[y][x];
    if (player === 0) return [];

    const group = [[x, y]];
    for (const [nx, ny] of getNeighbors(x, y)) {
        if (board[ny][nx] === player) {
            group.push(...getGroup(nx, ny, visited));
        }
    }
    return group;
}

function getLiberties(group) {
    const liberties = new Set();
    for (const [x, y] of group) {
        for (const [nx, ny] of getNeighbors(x, y)) {
            if (board[ny][nx] === 0) {
                liberties.add(`${nx},${ny}`);
            }
        }
    }
    return liberties.size;
}

function removeGroup(group) {
    for (const [x, y] of group) {
        board[y][x] = 0;
    }
    return group.length;
}

function boardToString() {
    return board.map(row => row.join('')).join('|');
}

function isValidMove(x, y) {
    if (board[y][x] !== 0) return false;

    // Geçici olarak taşı koy
    const tempBoard = board.map(row => [...row]);
    board[y][x] = currentPlayer;

    // Rakip taşları kontrol et ve esir al
    const opponent = currentPlayer === 1 ? 2 : 1;
    let captured = 0;
    const visited = new Set();

    for (const [nx, ny] of getNeighbors(x, y)) {
        if (board[ny][nx] === opponent) {
            const group = getGroup(nx, ny, new Set());
            if (getLiberties(group) === 0) {
                captured += group.length;
            }
        }
    }

    // Kendi grubumuzu kontrol et
    const myGroup = getGroup(x, y, new Set());
    const myLiberties = getLiberties(myGroup);

    // İntihar hamlesi mi? (Rakip taş almadan ve kendi özgürlüğü olmadan)
    if (myLiberties === 0 && captured === 0) {
        board = tempBoard;
        return false;
    }

    // Ko kuralı kontrolü
    if (captured === 1) {
        // Tekrar eski pozisyona dönecek mi kontrol et
        const afterCapture = board.map(row => [...row]);
        // Esir alma simülasyonu
        for (const [nx, ny] of getNeighbors(x, y)) {
            if (tempBoard[ny][nx] === opponent) {
                const group = getGroup(nx, ny, new Set());
                if (getLiberties(group) === 0) {
                    for (const [gx, gy] of group) {
                        afterCapture[gy][gx] = 0;
                    }
                }
            }
        }

        if (lastBoardState && boardToString() === lastBoardState) {
            board = tempBoard;
            return false;
        }
    }

    board = tempBoard;
    return true;
}

function makeMove(x, y) {
    if (gameOver) return false;
    if (!isValidMove(x, y)) return false;

    lastBoardState = boardToString();
    board[y][x] = currentPlayer;
    passCount = 0;

    // Esir alma
    const opponent = currentPlayer === 1 ? 2 : 1;
    for (const [nx, ny] of getNeighbors(x, y)) {
        if (board[ny][nx] === opponent) {
            const group = getGroup(nx, ny, new Set());
            if (getLiberties(group) === 0) {
                captures[currentPlayer] += removeGroup(group);
            }
        }
    }

    // Sıra değiştir
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateUI();
    draw();

    // AI sırası
    if (isSinglePlayer && currentPlayer === 2 && !gameOver) {
        setTimeout(makeAIMove, 500);
    }

    return true;
}

function pass() {
    if (gameOver) return;

    passCount++;
    lastBoardState = null;

    if (passCount >= 2) {
        endGame();
    } else {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        updateUI();

        if (isSinglePlayer && currentPlayer === 2 && !gameOver) {
            setTimeout(makeAIMove, 500);
        }
    }
}

// ================================================
// YAPAY ZEKA
// ================================================

function makeAIMove() {
    if (gameOver) return;

    const validMoves = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (isValidMove(x, y)) {
                validMoves.push([x, y]);
            }
        }
    }

    if (validMoves.length === 0) {
        pass();
        return;
    }

    let move;
    if (aiDifficulty === 'easy') {
        // Rastgele hamle
        move = validMoves[Math.floor(Math.random() * validMoves.length)];
    } else {
        // Orta: Esir alma veya rastgele
        move = findCapturingMove(validMoves) || validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    makeMove(move[0], move[1]);
}

function findCapturingMove(moves) {
    for (const [x, y] of moves) {
        const tempBoard = board.map(row => [...row]);
        board[y][x] = currentPlayer;

        const opponent = currentPlayer === 1 ? 2 : 1;
        for (const [nx, ny] of getNeighbors(x, y)) {
            if (board[ny][nx] === opponent) {
                const group = getGroup(nx, ny, new Set());
                if (getLiberties(group) === 0) {
                    board = tempBoard;
                    return [x, y];
                }
            }
        }
        board = tempBoard;
    }
    return null;
}

// ================================================
// SKOR VE OYUN SONU
// ================================================

function calculateScore() {
    // Basit alan hesaplama (Chinese rules benzeri)
    const territory = { 1: 0, 2: 0 };
    const visited = new Set();

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (board[y][x] !== 0 || visited.has(`${x},${y}`)) continue;

            const region = [];
            const borders = new Set();
            const stack = [[x, y]];

            while (stack.length > 0) {
                const [cx, cy] = stack.pop();
                const key = `${cx},${cy}`;
                if (visited.has(key)) continue;
                visited.add(key);

                if (board[cy][cx] === 0) {
                    region.push([cx, cy]);
                    for (const [nx, ny] of getNeighbors(cx, cy)) {
                        stack.push([nx, ny]);
                    }
                } else {
                    borders.add(board[cy][cx]);
                }
            }

            if (borders.size === 1) {
                const owner = [...borders][0];
                territory[owner] += region.length;
            }
        }
    }

    // Tahtadaki taşlar + alan + esirler
    let blackStones = 0, whiteStones = 0;
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (board[y][x] === 1) blackStones++;
            if (board[y][x] === 2) whiteStones++;
        }
    }

    return {
        black: blackStones + territory[1] + captures[1],
        white: whiteStones + territory[2] + captures[2] + 6.5 // Komi
    };
}

function endGame() {
    gameOver = true;
    const scores = calculateScore();

    const winner = scores.black > scores.white ? player1Name : player2Name;
    gameOverMessage.textContent = `🏆 ${winner} Kazandı!`;
    finalScores.innerHTML = `
		<div>${player1Name} (Siyah): ${scores.black.toFixed(1)} puan</div>
		<div>${player2Name} (Beyaz): ${scores.white.toFixed(1)} puan</div>
	`;
    gameOverModal.classList.remove('hidden');
}

// ================================================
// UI
// ================================================

function updateUI() {
    const currentName = currentPlayer === 1 ? player1Name : player2Name;
    const color = currentPlayer === 1 ? 'Siyah' : 'Beyaz';
    statusDiv.textContent = `Sıra: ${currentName} (${color})`;

    blackCaptures.textContent = captures[1];
    whiteCaptures.textContent = captures[2];

    blackScoreBox.classList.toggle('active', currentPlayer === 1);
    whiteScoreBox.classList.toggle('active', currentPlayer === 2);
}

// ================================================
// EVENT LISTENERS
// ================================================

canvas.addEventListener('click', (e) => {
    if (gameOver) return;
    if (isSinglePlayer && currentPlayer === 2) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const x = Math.round((mx - padding) / cellSize);
    const y = Math.round((my - padding) / cellSize);

    if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
        makeMove(x, y);
    }
});

passBtn.addEventListener('click', () => {
    if (isSinglePlayer && currentPlayer === 2) return;
    pass();
});

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

window.addEventListener('resize', () => {
    resizeCanvas();
    draw();
});

// Başlat
init();
