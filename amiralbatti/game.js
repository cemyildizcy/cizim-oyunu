// ================================================
// AMİRAL BATTI - OYUN MOTORU
// Klasik Deniz Savaşı
// ================================================

// --- GEMİ TANIMLARI ---
const SHIPS = [
    { id: 'carrier', name: 'Amiral Gemisi', size: 5, emoji: '🚢' },
    { id: 'battleship', name: 'Savaş Gemisi', size: 4, emoji: '⛵' },
    { id: 'cruiser', name: 'Kruvazör', size: 3, emoji: '🛥️' },
    { id: 'submarine', name: 'Denizaltı', size: 3, emoji: '🚤' },
    { id: 'destroyer', name: 'Muhrip', size: 2, emoji: '⛵' }
];

// --- DOM ELEMENTLERİ ---
const playerBoardEl = document.getElementById('playerBoard');
const enemyBoardEl = document.getElementById('enemyBoard');
const enemyBoardSection = document.getElementById('enemyBoardSection');
const shipsPanelEl = document.getElementById('shipsPanel');
const phaseInfoEl = document.getElementById('phaseInfo');
const rotateContainer = document.getElementById('rotateContainer');
const rotateBtn = document.getElementById('rotateBtn');
const statusDiv = document.getElementById('status');
const boardSizeDisplay = document.getElementById('boardSizeDisplay');
const playerBoardTitle = document.getElementById('playerBoardTitle');
const statsPanel = document.getElementById('statsPanel');
const playerShipsLeftEl = document.getElementById('playerShipsLeft');
const enemyShipsLeftEl = document.getElementById('enemyShipsLeft');
const resetBtn = document.getElementById('resetGameBtn');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverMessage = document.getElementById('gameOverMessage');
const gameOverStats = document.getElementById('gameOverStats');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitBtn = document.getElementById('exitBtn');
const rulesModal = document.getElementById('rulesModal');
const closeRulesBtn = document.getElementById('closeRulesBtn');

// --- OYUN DEĞİŞKENLERİ ---
let boardSize = 10;
let player1Name = 'Amiral';
let player2Name = 'Bilgisayar';
let isSinglePlayer = true;
let aiDifficulty = 'medium';

// Oyun durumu
let gamePhase = 'placement'; // 'placement', 'battle', 'gameover'
let currentPlayer = 1; // 1 veya 2
let isHorizontal = true;
let selectedShipIndex = 0;

// Tahta verileri
let playerBoard = [];
let enemyBoard = [];
let playerShips = [];
let enemyShips = [];

// AI için
let aiHits = [];
let aiLastHit = null;
let aiHuntMode = false;
let aiHuntQueue = [];

// ================================================
// BAŞLATMA
// ================================================

function init() {
    const params = new URLSearchParams(window.location.search);
    boardSize = parseInt(params.get('size')) || 10;
    player1Name = params.get('p1') || 'Amiral';
    player2Name = params.get('p2') || 'Bilgisayar';
    isSinglePlayer = params.get('mode') === 'ai';
    aiDifficulty = params.get('diff') || 'medium';

    boardSizeDisplay.textContent = `${boardSize}×${boardSize}`;

    resetGame();
    rulesModal.classList.remove('hidden');
}

function resetGame() {
    // Tahtaları sıfırla
    playerBoard = createEmptyBoard();
    enemyBoard = createEmptyBoard();
    playerShips = SHIPS.map(s => ({ ...s, placed: false, hits: 0, sunk: false, cells: [] }));
    enemyShips = SHIPS.map(s => ({ ...s, placed: false, hits: 0, sunk: false, cells: [] }));

    // Durumu sıfırla
    gamePhase = 'placement';
    currentPlayer = 1;
    isHorizontal = true;
    selectedShipIndex = 0;

    // AI sıfırla
    aiHits = [];
    aiLastHit = null;
    aiHuntMode = false;
    aiHuntQueue = [];

    // UI güncelle
    renderPlayerBoard();
    renderShipsPanel();
    updatePhaseInfo();

    enemyBoardSection.style.display = 'none';
    rotateContainer.style.display = 'block';
    statsPanel.style.display = 'none';
    shipsPanelEl.style.display = 'flex';
    gameOverModal.classList.add('hidden');
}

function createEmptyBoard() {
    return Array(boardSize).fill(null).map(() =>
        Array(boardSize).fill(null).map(() => ({ ship: null, hit: false }))
    );
}

// ================================================
// RENDER
// ================================================

function renderPlayerBoard() {
    playerBoardEl.innerHTML = '';
    playerBoardEl.style.gridTemplateColumns = `repeat(${boardSize}, 32px)`;

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;

            const data = playerBoard[y][x];
            if (data.ship) {
                if (data.hit) {
                    cell.classList.add(data.ship.sunk ? 'sunk' : 'hit');
                } else {
                    cell.classList.add('ship');
                }
            } else if (data.hit) {
                cell.classList.add('miss');
            }

            if (gamePhase === 'placement') {
                cell.addEventListener('mouseenter', () => showPlacementPreview(x, y));
                cell.addEventListener('mouseleave', clearPlacementPreview);
                cell.addEventListener('click', () => placeShip(x, y));
            }

            playerBoardEl.appendChild(cell);
        }
    }
}

function renderEnemyBoard() {
    enemyBoardEl.innerHTML = '';
    enemyBoardEl.style.gridTemplateColumns = `repeat(${boardSize}, 32px)`;

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;

            const data = enemyBoard[y][x];
            if (data.hit) {
                if (data.ship) {
                    cell.classList.add(data.ship.sunk ? 'sunk' : 'hit');
                } else {
                    cell.classList.add('miss');
                }
            }

            if (gamePhase === 'battle' && currentPlayer === 1 && !data.hit) {
                cell.addEventListener('click', () => playerFire(x, y));
            }

            enemyBoardEl.appendChild(cell);
        }
    }
}

function renderShipsPanel() {
    shipsPanelEl.innerHTML = '';

    playerShips.forEach((ship, index) => {
        const card = document.createElement('div');
        card.className = 'ship-card';
        if (ship.placed) card.classList.add('placed');
        if (index === selectedShipIndex && !ship.placed) card.classList.add('active');

        card.innerHTML = `
			<div class="ship-name">${ship.emoji} ${ship.name}</div>
			<div class="ship-size">${ship.size} hücre</div>
		`;

        if (!ship.placed) {
            card.addEventListener('click', () => {
                selectedShipIndex = index;
                renderShipsPanel();
            });
        }

        shipsPanelEl.appendChild(card);
    });
}

function updatePhaseInfo() {
    if (gamePhase === 'placement') {
        const remaining = playerShips.filter(s => !s.placed).length;
        phaseInfoEl.querySelector('.phase-title').textContent = 'Gemileri Yerleştir';
        phaseInfoEl.querySelector('.phase-desc').textContent =
            remaining > 0
                ? `${remaining} gemi kaldı. Bir gemi seç ve tahtaya yerleştirmek için tıkla.`
                : 'Tüm gemiler yerleştirildi!';
    } else if (gamePhase === 'battle') {
        const currentName = currentPlayer === 1 ? player1Name : player2Name;
        phaseInfoEl.querySelector('.phase-title').textContent = 'Savaş!';
        phaseInfoEl.querySelector('.phase-desc').textContent = `Sıra: ${currentName}`;
    }
}

function updateStats() {
    const playerAlive = playerShips.filter(s => !s.sunk).length;
    const enemyAlive = enemyShips.filter(s => !s.sunk).length;
    playerShipsLeftEl.textContent = playerAlive;
    enemyShipsLeftEl.textContent = enemyAlive;
}

// ================================================
// GEMİ YERLEŞTİRME
// ================================================

function showPlacementPreview(x, y) {
    if (gamePhase !== 'placement') return;

    const ship = playerShips[selectedShipIndex];
    if (!ship || ship.placed) return;

    clearPlacementPreview();

    const cells = getShipCells(x, y, ship.size, isHorizontal);
    const isValid = canPlaceShip(playerBoard, cells);

    cells.forEach(([cx, cy]) => {
        if (cx >= 0 && cx < boardSize && cy >= 0 && cy < boardSize) {
            const cellEl = playerBoardEl.querySelector(`[data-x="${cx}"][data-y="${cy}"]`);
            if (cellEl) {
                cellEl.classList.add(isValid ? 'preview' : 'invalid');
            }
        }
    });
}

function clearPlacementPreview() {
    playerBoardEl.querySelectorAll('.preview, .invalid').forEach(cell => {
        cell.classList.remove('preview', 'invalid');
    });
}

function getShipCells(x, y, size, horizontal) {
    const cells = [];
    for (let i = 0; i < size; i++) {
        if (horizontal) {
            cells.push([x + i, y]);
        } else {
            cells.push([x, y + i]);
        }
    }
    return cells;
}

function canPlaceShip(board, cells) {
    return cells.every(([x, y]) => {
        if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return false;
        if (board[y][x].ship) return false;
        return true;
    });
}

function placeShip(x, y) {
    if (gamePhase !== 'placement') return;

    const ship = playerShips[selectedShipIndex];
    if (!ship || ship.placed) return;

    const cells = getShipCells(x, y, ship.size, isHorizontal);
    if (!canPlaceShip(playerBoard, cells)) return;

    // Gemiyi yerleştir
    cells.forEach(([cx, cy]) => {
        playerBoard[cy][cx].ship = ship;
    });
    ship.placed = true;
    ship.cells = cells;

    // Sonraki gemi
    const nextIndex = playerShips.findIndex(s => !s.placed);
    if (nextIndex !== -1) {
        selectedShipIndex = nextIndex;
    }

    renderPlayerBoard();
    renderShipsPanel();
    updatePhaseInfo();

    // Tüm gemiler yerleştirildi mi?
    if (playerShips.every(s => s.placed)) {
        startBattle();
    }
}

function rotateShip() {
    isHorizontal = !isHorizontal;
    rotateBtn.textContent = isHorizontal ? '🔄 Döndür (R) - Yatay' : '🔄 Döndür (R) - Dikey';
}

// ================================================
// SAVAŞ
// ================================================

function startBattle() {
    gamePhase = 'battle';
    currentPlayer = 1;

    // AI gemilerini yerleştir
    placeAIShips();

    // UI güncelle
    rotateContainer.style.display = 'none';
    shipsPanelEl.style.display = 'none';
    enemyBoardSection.style.display = 'block';
    statsPanel.style.display = 'flex';

    renderEnemyBoard();
    updatePhaseInfo();
    updateStats();

    statusDiv.textContent = `Sıra: ${player1Name}`;
}

function placeAIShips() {
    enemyShips.forEach(ship => {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
            const horizontal = Math.random() > 0.5;
            const x = Math.floor(Math.random() * boardSize);
            const y = Math.floor(Math.random() * boardSize);
            const cells = getShipCells(x, y, ship.size, horizontal);

            if (canPlaceShip(enemyBoard, cells)) {
                cells.forEach(([cx, cy]) => {
                    enemyBoard[cy][cx].ship = ship;
                });
                ship.placed = true;
                ship.cells = cells;
                placed = true;
            }
            attempts++;
        }
    });
}

function playerFire(x, y) {
    if (gamePhase !== 'battle' || currentPlayer !== 1) return;

    const cell = enemyBoard[y][x];
    if (cell.hit) return;

    cell.hit = true;

    if (cell.ship) {
        cell.ship.hits++;
        statusDiv.textContent = 'İsabet! 🎯';

        if (cell.ship.hits === cell.ship.size) {
            cell.ship.sunk = true;
            statusDiv.textContent = `${cell.ship.name} battı! 💥`;
        }

        renderEnemyBoard();
        updateStats();

        // Kazandık mı?
        if (enemyShips.every(s => s.sunk)) {
            endGame(1);
            return;
        }

        // Tekrar ateş et
        return;
    } else {
        statusDiv.textContent = 'Iskaladın! 💨';
    }

    renderEnemyBoard();

    // AI sırası
    if (isSinglePlayer) {
        currentPlayer = 2;
        updatePhaseInfo();
        setTimeout(aiFire, 800);
    }
}

// ================================================
// YAPAY ZEKA
// ================================================

function aiFire() {
    if (gamePhase !== 'battle' || currentPlayer !== 2) return;

    let x, y;

    if (aiDifficulty === 'hard' && aiHuntQueue.length > 0) {
        // Zor mod: Akıllı av
        [x, y] = aiHuntQueue.shift();
    } else if (aiDifficulty === 'medium' && aiHuntQueue.length > 0 && Math.random() > 0.3) {
        // Orta mod: Bazen akıllı
        [x, y] = aiHuntQueue.shift();
    } else {
        // Rastgele ateş (dama deseni)
        const available = [];
        for (let cy = 0; cy < boardSize; cy++) {
            for (let cx = 0; cx < boardSize; cx++) {
                if (!playerBoard[cy][cx].hit) {
                    // Dama deseni (daha verimli)
                    if ((cx + cy) % 2 === 0 || aiDifficulty === 'easy') {
                        available.push([cx, cy]);
                    }
                }
            }
        }
        if (available.length === 0) {
            // Tüm dama hücreleri vuruldu, geri kalanları dene
            for (let cy = 0; cy < boardSize; cy++) {
                for (let cx = 0; cx < boardSize; cx++) {
                    if (!playerBoard[cy][cx].hit) {
                        available.push([cx, cy]);
                    }
                }
            }
        }
        [x, y] = available[Math.floor(Math.random() * available.length)];
    }

    const cell = playerBoard[y][x];
    cell.hit = true;

    if (cell.ship) {
        cell.ship.hits++;
        statusDiv.textContent = `${player2Name}: İsabet! 🎯`;

        // Akıllı avlama için komşuları ekle
        if (aiDifficulty !== 'easy') {
            addHuntTargets(x, y);
        }

        if (cell.ship.hits === cell.ship.size) {
            cell.ship.sunk = true;
            statusDiv.textContent = `${player2Name}: ${cell.ship.name}'ini batırdı! 💥`;
            // Gemi battığında av kuyruğunu temizle
            aiHuntQueue = aiHuntQueue.filter(([hx, hy]) => {
                return !cell.ship.cells.some(([cx, cy]) =>
                    Math.abs(hx - cx) + Math.abs(hy - cy) === 1
                );
            });
        }

        renderPlayerBoard();
        updateStats();

        // Kaybettik mi?
        if (playerShips.every(s => s.sunk)) {
            endGame(2);
            return;
        }

        // AI tekrar ateş eder
        setTimeout(aiFire, 600);
        return;
    } else {
        statusDiv.textContent = `${player2Name}: Iskaladı! 💨`;
    }

    renderPlayerBoard();

    // Oyuncunun sırası
    currentPlayer = 1;
    updatePhaseInfo();
    statusDiv.textContent = `Sıra: ${player1Name}`;
}

function addHuntTargets(x, y) {
    const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    directions.forEach(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
            if (!playerBoard[ny][nx].hit) {
                if (!aiHuntQueue.some(([hx, hy]) => hx === nx && hy === ny)) {
                    aiHuntQueue.push([nx, ny]);
                }
            }
        }
    });
}

// ================================================
// OYUN SONU
// ================================================

function endGame(winner) {
    gamePhase = 'gameover';

    const winnerName = winner === 1 ? player1Name : player2Name;
    gameOverMessage.textContent = winner === 1 ? '🎉 Zafer!' : '💀 Yenildin!';
    gameOverStats.innerHTML = `
		<div>${winnerName} kazandı!</div>
		<div style="margin-top:8px">Kalan gemilerin: ${playerShips.filter(s => !s.sunk).length}</div>
	`;
    gameOverModal.classList.remove('hidden');
}

// ================================================
// EVENT LISTENERS
// ================================================

rotateBtn.addEventListener('click', rotateShip);
document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') rotateShip();
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

// Başlat
init();
