const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('resetGameBtn');
const gridSizeDisplay = document.getElementById('gridSizeDisplay');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverMessage = document.getElementById('gameOverMessage');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitBtn = document.getElementById('exitBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const scoreboard = document.getElementById('scoreboard');
const p1ScoreDisplay = document.getElementById('p1Score');
const p2ScoreDisplay = document.getElementById('p2Score');

// Yeni kural modalı elementleri
const rulesModal = document.getElementById('rulesModal');
const rulesTitle = document.getElementById('rulesTitle');
const rulesContent = document.getElementById('rulesContent');
const closeRulesBtn = document.getElementById('closeRulesBtn');

// Bug 2: Add gameTitle element reference
const gameTitle = document.getElementById('gameTitle'); // Assuming game.html will have <h2 id="gameTitle">

let N = 5;
let player1Name = 'Kullanıcı 1';
let player2Name = 'Kullanıcı 2';
let isSinglePlayer = false;
let gameType = 'path'; // 'path' or 'square'
let player1Score = 0;
let player2Score = 0;
let squares = []; // For square closing game
let step = 120;
let edgesSet = new Set();
let edgesList = [];
let visited = new Set();
let activeEndpoint = null;
let turn = 1;
let gameOver = false;
let turnTimer = null;
let countdownInterval = null;
let timeLeft = 3;

(function initSizeFromUrl() {
	const params = new URLSearchParams(window.location.search);
	const s = parseInt(params.get('size'));
	if (s && s >= 3 && s <= 20) N = s;

	player1Name = params.get('p1') || 'Kullanıcı 1';
	player2Name = params.get('p2') || 'Kullanıcı 2';
	isSinglePlayer = params.get('mode') === 'single';
	gameType = params.get('type') || 'path';

	if (gridSizeDisplay) gridSizeDisplay.textContent = `${N} × ${N} Kare`;
	if (gameType === 'square') {
		scoreboard.classList.remove('hidden');
	}
    // Bug 2: Update game title
    if (gameTitle) {
        gameTitle.textContent = `${gameType === 'square' ? 'Kare Kapatma' : 'Yol Çizme'} — Çizgi Savaşları`;
    }
})();

function resizeCanvasAndSetStep() {
	const margin = 80;
	const maxSize = Math.min(window.innerWidth - margin, window.innerHeight - margin - 80, 1000);
	const sizePx = Math.max(200, maxSize);
	const dpr = window.devicePixelRatio || 1;
	canvas.style.width = sizePx + 'px';
	canvas.style.height = sizePx + 'px';
	canvas.width = Math.floor(sizePx * dpr);
	canvas.height = Math.floor(sizePx * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	step = sizePx / N;
	draw();
}

function keyForEdge(a, b) {
	const s1 = `${a.x},${a.y}`;
	const s2 = `${b.x},${b.y}`;
	return s1 < s2 ? `${s1}-${s2}` : `${s2}-${s1}`;
}

function keyForPoint(p) {
	return `${p.x},${p.y}`;
}

function showGameOverScreen(losingPlayer) {
    gameOver = true;
    clearTimeout(turnTimer);
    clearInterval(countdownInterval);
    
    let message = '';
    if (gameType === 'square') {
        const scoreText = `(${player1Score} - ${player2Score})`;
        if (player1Score > player2Score) message = `${player1Name} Kazandı! ${scoreText}`;
        else if (player2Score > player1Score) message = `${player2Name} Kazandı! ${scoreText}`;
        else message = `Oyun Berabere! ${scoreText}`;
        statusDiv.textContent = `Oyun Bitti! Skor: ${player1Score} - ${player2Score}`;
    } else {
        const losingPlayerName = losingPlayer === 1 ? player1Name : player2Name;
        const winningPlayerName = losingPlayer === 1 ? player2Name : player1Name;
        message = `${losingPlayerName} Kaybetti!`;
        statusDiv.textContent = `Oyun Bitti! Kazanan: ${winningPlayerName}`;
    }
    gameOverMessage.textContent = message;
    gameOverModal.classList.remove('hidden');
}

function displayRules() {
    rulesModal.classList.remove('hidden');
    if (gameType === 'path') {
        rulesTitle.textContent = "Yol Çizme Oyunu Kuralları";
        rulesContent.innerHTML = `
            <ul>
                <li>Oyun ızgara üzerinde oynanır.</li>
                <li>İlk oyuncu herhangi bir kare kenarını çizerek başlar.</li>
                <li>İkinci oyuncu, ilk çizginin iki ucundan birine bağlı yeni bir çizgi çizer.</li>
                <li>Sonraki turlarda, oyuncular sırayla en son çizilen çizginin bitiş noktasından (aktif uç) yeni bir çizgi çekerler.</li>
                <li>Çizgiler sadece yukarı, aşağı, sağa veya sola doğru, bir kare kenarı uzunluğunda çekilebilir.</li>
                <li>Aynı çizginin üzerinden tekrar çizilemez.</li>
                <li>Çizilen çizgiler ızgaranın kenarlarına değemez veya daha önce ziyaret edilmiş bir noktayı tekrar kullanamaz.</li>
                <li>Bu kuralları ihlal eden (sınıra değen veya ziyaret edilmiş noktayı kullanan) oyuncu oyunu kaybeder.</li>
                <li>Her oyuncunun hamle yapmak için <strong>3 saniyesi</strong> vardır. Süre dolarsa rastgele bir hamle yapılır.</li>
            </ul>
        `;
    } else if (gameType === 'square') {
        rulesTitle.textContent = "Kare Kapatma Oyunu Kuralları";
        rulesContent.innerHTML = `
            <ul>
                <li>Oyun ızgara üzerinde oynanır. Amaç, kareleri kapatarak puan toplamaktır.</li>
                <li>Oyuncular sırayla ızgaradaki boş bir kare kenarını çizerler.</li>
                <li>Bir oyuncu, bir kareyi tamamlayan son çizgiyi çizdiğinde o kareyi kazanır ve <strong>bir hamle hakkı daha</strong> elde eder.</li>
                <li>Kazanılan kareler oyuncunun rengiyle işaretlenir ve skor tablosuna eklenir.</li>
                <li>Tüm kareler kapatıldığında oyun sona erer.</li>
                <li>En çok kareyi kapatan oyuncu oyunu kazanır.</li>
                <li>Her oyuncunun hamle yapmak için <strong>5 saniyesi</strong> vardır. Süre dolarsa rastgele bir hamle yapılır.</li>
            </ul>
        `;
    }
}

function startGame() {
	edgesSet.clear();
	edgesList = [];
	visited.clear();
	activeEndpoint = null;
	turn = 1;
	gameOver = false;
	player1Score = 0;
	player2Score = 0;
	squares = Array(N).fill(0).map(() => Array(N).fill(0));
	updateScoreDisplay();
	if (gameOverModal) gameOverModal.classList.add('hidden');
    if (rulesModal) rulesModal.classList.add('hidden'); // Önceki kural modalını gizle
	statusDiv.textContent = `Sıra: ${player1Name} — İlk hamleyi yapın.`;
	resizeCanvasAndSetStep();
	// startTurnTimer(); // İlk hamle için zamanlayıcı başlamaz
    displayRules(); // Oyun başladığında kuralları göster
}

function updateStatus(message) {
    const baseMessage = message.split(' (')[0];
    const timerText = gameOver ? '' : ` (Kalan süre: ${timeLeft}s)`;
    statusDiv.textContent = baseMessage + timerText;
}

function updateScoreDisplay() {
	if (gameType !== 'square') return;
	p1ScoreDisplay.textContent = `${player1Name}: ${player1Score}`;
	p2ScoreDisplay.textContent = `${player2Name}: ${player2Score}`;
}

function startTurnTimer() {
    if (gameOver || (isSinglePlayer && turn === 2)) {
        clearTimeout(turnTimer);
        clearInterval(countdownInterval);
        return;
    }

    clearTimeout(turnTimer);
    clearInterval(countdownInterval);
    
    timeLeft = gameType === 'square' ? 5 : 3; // Kare modunda 5 sn, diğerinde 3 sn
    updateStatus(statusDiv.textContent);

    countdownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft < 0) timeLeft = 0;
        updateStatus(statusDiv.textContent);
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);

    const timeoutFunction = gameType === 'square' ? makeRandomSquareMove : makeRandomMove;
    turnTimer = setTimeout(timeoutFunction, timeLeft * 1000); // Süreyi dinamik olarak ayarla
}

// Helper function to get all currently available (undrawn) edges on the grid
function getAllAvailableEdges() {
    const available = [];
    for (let y = 0; y <= N; y++) {
        for (let x = 0; x <= N; x++) {
            // Horizontal edges
            if (x < N) {
                const edge = { a: {x, y}, b: {x: x + 1, y} };
                if (!edgesSet.has(keyForEdge(edge.a, edge.b))) {
                    available.push(edge);
                }
            }
            // Vertical edges
            if (y < N) {
                const edge = { a: {x, y}, b: {x, y: y + 1} };
                if (!edgesSet.has(keyForEdge(edge.a, edge.b))) {
                    available.push(edge);
                }
            }
        }
    }
    return available;
}

function makeRandomMove() { // For path drawing when human player times out
    const availableEdges = getAllAvailableEdges();
    let validMoves = [];

    if (edgesList.length === 0) { // First move: any random edge
        validMoves = availableEdges;
    } else if (edgesList.length === 1) { // Second move: connected to first edge
        const firstEdge = edgesList[0];
        for (const edge of availableEdges) {
            if (pointEquals(edge.a, firstEdge.a) || pointEquals(edge.a, firstEdge.b) ||
                pointEquals(edge.b, firstEdge.a) || pointEquals(edge.b, firstEdge.b)) {
                validMoves.push(edge);
            }
        }
    } else { // Subsequent moves: connected to activeEndpoint
        const p = activeEndpoint;
        for (const edge of availableEdges) {
            if (pointEquals(edge.a, p) || pointEquals(edge.b, p)) {
                validMoves.push(edge);
            }
        }
    }

    if (validMoves.length > 0) {
        const move = validMoves[Math.floor(Math.random() * validMoves.length)];
        processMove(move.a, move.b);
    } else {
        // Should not happen if game is not over, but as a fallback
        showGameOverScreen(turn);
    }
}

function makeRandomSquareMove() { // For square closing when human player times out
    const allPossibleMoves = getAllAvailableEdges();
    if (allPossibleMoves.length > 0) {
        const move = allPossibleMoves[Math.floor(Math.random() * allPossibleMoves.length)];
        processMove(move.a, move.b);
    } else {
        // Should not happen if game is not over
        showGameOverScreen(turn);
    }
}

function makeIntelligentAIMove() { // For AI's turn in path drawing
    if (gameType === 'square') {
        makeSquareClosingAIMove(); // AI for square closing is handled separately
        return;
    }

    const availableEdges = getAllAvailableEdges();
    let validMoves = [];

    if (edgesList.length === 0) { // First move: random but not on border
        const nonBorderEdges = availableEdges.filter(edge => 
            !isBorderPoint(edge.a) && !isBorderPoint(edge.b)
        );
        if (nonBorderEdges.length > 0) {
            const move = nonBorderEdges[Math.floor(Math.random() * nonBorderEdges.length)];
            processMove(move.a, move.b);
        } else { // Fallback if only border edges left
            const move = availableEdges[Math.floor(Math.random() * availableEdges.length)];
            processMove(move.a, move.b);
        }
        return;
    } else if (edgesList.length === 1) { // Second move: connected to first edge
        const firstEdge = edgesList[0];
        for (const edge of availableEdges) {
            if (pointEquals(edge.a, firstEdge.a) || pointEquals(edge.a, firstEdge.b) ||
                pointEquals(edge.b, firstEdge.a) || pointEquals(edge.b, firstEdge.b)) {
                validMoves.push({ from: edge.a, to: edge.b });
            }
        }
    } else { // Subsequent moves: connected to activeEndpoint
        const p = activeEndpoint;
        for (const edge of availableEdges) {
            if (pointEquals(edge.a, p) || pointEquals(edge.b, p)) {
                validMoves.push({ from: edge.a, to: edge.b });
            }
        }
    }

    if (validMoves.length === 0) {
        showGameOverScreen(turn); // AI has no valid moves, it loses
        return;
    }

    const safeMoves = [];
    const losingMoves = [];
    for (const move of validMoves) {
        // Determine the 'other' endpoint for the path
        let otherEndpoint = null;
        if (edgesList.length === 1) { // Second move
            const firstEdge = edgesList[0];
            if (pointEquals(move.from, firstEdge.a) || pointEquals(move.from, firstEdge.b)) otherEndpoint = move.to;
            else if (pointEquals(move.to, firstEdge.a) || pointEquals(move.to, firstEdge.b)) otherEndpoint = move.from;
        } else { // Subsequent moves
            if (pointEquals(move.from, activeEndpoint)) otherEndpoint = move.to;
            else if (pointEquals(move.to, activeEndpoint)) otherEndpoint = move.from;
        }

        if (otherEndpoint && (isBorderPoint(otherEndpoint) || pointVisited(otherEndpoint))) {
            losingMoves.push(move);
        } else {
            safeMoves.push(move);
        }
    }

    const movesToEvaluate = safeMoves.length > 0 ? safeMoves : losingMoves;
    
    let bestMoves = [];
    let minOpponentMoves = Infinity;

    for (const move of movesToEvaluate) {
        // Determine the 'new active endpoint' for the opponent
        let newActiveEndpoint = null;
        if (edgesList.length === 1) { // Second move
            const firstEdge = edgesList[0];
            if (pointEquals(move.from, firstEdge.a) || pointEquals(move.from, firstEdge.b)) newActiveEndpoint = move.to;
            else if (pointEquals(move.to, firstEdge.a) || pointEquals(move.to, firstEdge.b)) newActiveEndpoint = move.from;
        } else { // Subsequent moves
            if (pointEquals(move.from, activeEndpoint)) newActiveEndpoint = move.to;
            else if (pointEquals(move.to, activeEndpoint)) newActiveEndpoint = move.from;
        }

        if (!newActiveEndpoint) continue; // Should not happen with valid moves

        // Simulate adding this edge and its new active endpoint
        const tempVisited = new Set(visited);
        tempVisited.add(keyForPoint(newActiveEndpoint));
        const tempEdgesSet = new Set(edgesSet); // Simulate adding the edge
        tempEdgesSet.add(keyForEdge(move.from, move.to));

        let opponentMovesCount = 0;
        const opponentNeighbors = [
            { x: newActiveEndpoint.x + 1, y: newActiveEndpoint.y }, { x: newActiveEndpoint.x - 1, y: newActiveEndpoint.y },
            { x: newActiveEndpoint.x, y: newActiveEndpoint.y + 1 }, { x: newActiveEndpoint.x, y: newActiveEndpoint.y - 1 },
        ];
        for (const n of opponentNeighbors) {
            if (n.x >= 0 && n.x <= N && n.y >= 0 && n.y <= N && !tempEdgesSet.has(keyForEdge(newActiveEndpoint, n))) {
                if (!isBorderPoint(n) && !tempVisited.has(keyForPoint(n))) {
                    opponentMovesCount++;
                }
            }
        }
        
        if (opponentMovesCount < minOpponentMoves) {
            minOpponentMoves = opponentMovesCount;
            bestMoves = [move];
        } else if (opponentMovesCount === minOpponentMoves) {
            bestMoves.push(move);
        }
    }

    const chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    processMove(chosenMove.from, chosenMove.to);
}

function makeSquareClosingAIMove() { // For AI's turn in square closing (stabilized)
	// Disable input while AI "düşünüyor"
	canvas.style.pointerEvents = 'none';

	// Build list of all undrawn edges reliably
	const all = [];
	for (let y = 0; y <= N; y++) {
		for (let x = 0; x <= N; x++) {
			// horizontal
			if (x < N) {
				const a = { x, y };
				const b = { x: x + 1, y };
				const k = keyForEdge(a, b);
				if (!edgesSet.has(k)) all.push({ a, b, horiz: true });
			}
			// vertical
			if (y < N) {
				const a = { x, y };
				const b = { x, y: y + 1 };
				const k = keyForEdge(a, b);
				if (!edgesSet.has(k)) all.push({ a, b, horiz: false });
			}
		}
	}

	if (all.length === 0) {
		// hiçbir hamle yoksa oyun bitti demektir
		canvas.style.pointerEvents = 'auto';
		showGameOverScreen(turn);
		return;
	}

	// Eğer çok erken aşama ise, rastgele güvenilir hamle
	if (edgesList.length <= 1) {
		const choice = all[Math.floor(Math.random() * all.length)];
		setTimeout(() => { processMove(choice.a, choice.b); canvas.style.pointerEvents = 'auto'; }, 400);
		return;
	}

	const winning = [];
	const safe = [];
	const risky = [];

	// Evaluate each possible move
	for (const e of all) {
		const a = e.a, b = e.b;
		// geçici olarak kenarı ekle
		edgesSet.add(keyForEdge(a, b));

		let completes = false;
		// yatay ise kareleri a.x,a.y-1 ve a.x,a.y kontrol et
		if (a.y === b.y) {
			if (a.y > 0 && squares[a.y - 1][a.x] === 0 && countSides(a.x, a.y - 1) === 4) completes = true;
			if (a.y < N && squares[a.y][a.x] === 0 && countSides(a.x, a.y) === 4) completes = true;
		} else { // dikey
			if (a.x > 0 && squares[a.y][a.x - 1] === 0 && countSides(a.x - 1, a.y) === 4) completes = true;
			if (a.x < N && squares[a.y][a.x] === 0 && countSides(a.x, a.y) === 4) completes = true;
		}

		if (completes) {
			winning.push(e);
			edgesSet.delete(keyForEdge(a, b));
			continue;
		}

		// oluşturacağı 3 kenarlı kare var mı kontrol et
		let createsThird = false;
		if (a.y === b.y) {
			if (a.y > 0 && squares[a.y - 1][a.x] === 0 && countSides(a.x, a.y - 1) === 3) createsThird = true;
			if (a.y < N && squares[a.y][a.x] === 0 && countSides(a.x, a.y) === 3) createsThird = true;
		} else {
			if (a.x > 0 && squares[a.y][a.x - 1] === 0 && countSides(a.x - 1, a.y) === 3) createsThird = true;
			if (a.x < N && squares[a.y][a.x] === 0 && countSides(a.x, a.y) === 3) createsThird = true;
		}

		if (createsThird) risky.push(e);
		else safe.push(e);

		// temizle
		edgesSet.delete(keyForEdge(a, b));
	}

	let chosen;
	if (winning.length > 0) chosen = winning[Math.floor(Math.random() * winning.length)];
	else if (safe.length > 0) chosen = safe[Math.floor(Math.random() * safe.length)];
	else chosen = risky[Math.floor(Math.random() * risky.length)];

	// küçük gecikme ile hamleyi uygula
	setTimeout(() => {
		processMove(chosen.a, chosen.b);
		// AI işleminden sonra input'u yeniden aç ProcessMove veya sonrasında gameOver kontrolü yapılıyor
		if (!gameOver) canvas.style.pointerEvents = 'auto';
	}, 400);
}

function countSides(x, y) {
    let count = 0;
    // Check if square (x,y) is within bounds
    if (x < 0 || x >= N || y < 0 || y >= N) return 0;

    if (edgesSet.has(keyForEdge({x, y}, {x: x + 1, y}))) count++; // Top edge
    if (edgesSet.has(keyForEdge({x, y: y + 1}, {x: x + 1, y: y + 1}))) count++; // Bottom edge
    if (edgesSet.has(keyForEdge({x, y}, {x, y: y + 1}))) count++; // Left edge
    if (edgesSet.has(keyForEdge({x: x + 1, y}, {x: x + 1, y: y + 1}))) count++; // Right edge
    return count;
}

function drawGrid() {
	const physicalWidth = canvas.width / (window.devicePixelRatio || 1);
	ctx.clearRect(0, 0, physicalWidth, physicalWidth);
	ctx.strokeStyle = '#e6eef6';
	ctx.lineWidth = 1;
	for (let i = 0; i <= N; i++) {
		ctx.beginPath();
		ctx.moveTo(0, i * step);
		ctx.lineTo(physicalWidth, i * step);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(i * step, 0);
		ctx.lineTo(i * step, physicalWidth);
		ctx.stroke();
	}
	ctx.fillStyle = '#7b93a7';
	for (let i = 0; i <= N; i++) {
		for (let j = 0; j <= N; j++) {
			ctx.beginPath();
			ctx.arc(i * step, j * step, 2, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}

function drawCapturedSquares() {
	if (gameType !== 'square') return;
	for (let y = 0; y < N; y++) {
		for (let x = 0; x < N; x++) {
			if (squares[y][x] !== 0) {
				ctx.fillStyle = squares[y][x] === 1 ? 'rgba(79, 70, 229, 0.3)' : 'rgba(239, 68, 68, 0.3)';
				ctx.fillRect(x * step, y * step, step, step);
			}
		}
	}
}

function drawEdges() {
	for (let i = 0; i < edgesList.length; i++) {
		const e = edgesList[i];
		const isLastMove = i === edgesList.length - 1 && !gameOver;
		
		ctx.beginPath();
		ctx.strokeStyle = e.player === 1 ? '#4f46e5' : '#ef4444';
		ctx.lineWidth = isLastMove ? 7 : 5; // Son hamle daha kalın, diğerleri de daha görünür
		ctx.moveTo(e.a.x * step, e.a.y * step);
		ctx.lineTo(e.b.x * step, e.b.y * step);
		ctx.stroke();
	}
	if (activeEndpoint && !gameOver && gameType === 'path') {
		ctx.beginPath();
		ctx.fillStyle = '#16a34a';
		ctx.arc(activeEndpoint.x * step, activeEndpoint.y * step, 6, 0, Math.PI * 2);
		ctx.fill();
	}
}

function draw() {
	drawGrid();
	drawCapturedSquares();
	drawEdges();
}

function pointEquals(p1, p2) {
	return p1.x === p2.x && p1.y === p2.y;
}

function isBorderPoint(p) {
	return p.x === 0 || p.x === N || p.y === 0 || p.y === N;
}

function pointVisited(p) {
	return visited.has(keyForPoint(p));
}

function addEdge(a, b, player) {
	const k = keyForEdge(a, b);
	edgesSet.add(k);
	edgesList.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, player });
	visited.add(keyForPoint(a));
	visited.add(keyForPoint(b));
}

function distPointToSegment(px, py, x1, y1, x2, y2) {
	const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
	const dot = A * C + B * D;
	const len_sq = C * C + D * D;
	let param = -1;
	if (len_sq !== 0) param = dot / len_sq;
	let xx, yy;
	if (param < 0) { xx = x1; yy = y1; }
	else if (param > 1) { xx = x2; yy = y2; }
	else { xx = x1 + param * C; yy = y1 + param * D; }
	const dx = px - xx;
	const dy = py - yy;
	return Math.sqrt(dx * dx + dy * dy);
}

function findClickedEdge(mx, my) {
	let best = null;
	let bestDist = Infinity;
	for (let i = 0; i <= N; i++) {
		for (let j = 0; j <= N; j++) {
			if (i < N) {
				const d = distPointToSegment(mx, my, i * step, j * step, (i + 1) * step, j * step);
				if (d < bestDist) { best = [{ x: i, y: j }, { x: i + 1, y: j }]; bestDist = d; }
			}
			if (j < N) {
				const d = distPointToSegment(mx, my, i * step, j * step, i * step, (j + 1) * step);
				if (d < bestDist) { best = [{ x: i, y: j }, { x: i, y: j + 1 }]; bestDist = d; }
			}
		}
	}
	const threshold = Math.min(20, step * 0.4);
	if (bestDist <= threshold) {
		return { a: best[0], b: best[1] };
	}
	return null;
}

function triggerAIMove() {
    canvas.style.pointerEvents = 'none';
    setTimeout(() => {
        // Bug 1: Call the correct AI function based on gameType
        if (gameType === 'square') {
            makeSquareClosingAIMove();
        } else {
            makeIntelligentAIMove();
        }
        if (!gameOver) {
            canvas.style.pointerEvents = 'auto';
        }
    }, 1000); // 1 saniye bekleme
}

function handleClick(evt) {
	if (gameOver || (isSinglePlayer && turn === 2)) return;
	const rect = canvas.getBoundingClientRect();
	const mx = evt.clientX - rect.left;
	const my = evt.clientY - rect.top;
	const edge = findClickedEdge(mx, my);
	if (!edge) return;

	processMove(edge.a, edge.b);
}

function checkCompletedSquares(p1, p2) {
    let completedCount = 0;
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);

    // Horizontal edge
    if (p1.y === p2.y) {
        // Check square above
        if (y > 0 && squares[y-1][x] === 0 && countSides(x, y - 1) === 4) {
            squares[y-1][x] = turn;
            completedCount++;
        }
        // Check square below
        if (y < N && squares[y][x] === 0 && countSides(x, y) === 4) {
            squares[y][x] = turn;
            completedCount++;
        }
    } 
    // Vertical edge
    else {
        // Check square left
        if (x > 0 && squares[y][x-1] === 0 && countSides(x - 1, y) === 4) {
            squares[y][x-1] = turn;
            completedCount++;
        }
        // Check square right
        if (x < N && squares[y][x] === 0 && countSides(x, y) === 4) {
            squares[y][x] = turn;
            completedCount++;
        }
    }
    return completedCount;
}

function processMove(a, b) {
	if (gameOver) return;

	const edgeKey = keyForEdge(a, b);
	if (edgesSet.has(edgeKey)) {
		updateStatus('Bu kenar zaten çizilmiş.');
        console.log(`processMove: AI tried to draw existing edge: ${edgeKey}. Current turn: ${turn}`); // Debugging line
		return;
	}

	clearTimeout(turnTimer);
	clearInterval(countdownInterval);

	if (gameType === 'square') {
		addEdge(a, b, turn);
		const completedCount = checkCompletedSquares(a, b);

		if (completedCount > 0) {
			player1Score += (turn === 1 ? completedCount : 0);
			player2Score += (turn === 2 ? completedCount : 0);
			updateScoreDisplay();
			// If squares were completed, the current player gets another turn
			// No turn change here, just restart timer for same player
		} else {
			// No squares completed, switch turn
			turn = turn === 1 ? 2 : 1;
		}
		
		const totalScore = player1Score + player2Score;
		if (totalScore === N * N) {
			draw();
			showGameOverScreen(0); // Pass 0 for draw/score-based win
			return;
		}
		
		const currentPlayerName = turn === 1 ? player1Name : player2Name;
		updateStatus(`Sıra: ${currentPlayerName}`);
		draw();

		// --- Değişiklik: kare kapatma modunda AI tetiklenmesini daha güvenilir hale getir ---
		if (isSinglePlayer && turn === 2) {
			// disable input while AI "düşünüyor"
			canvas.style.pointerEvents = 'none';
			setTimeout(() => {
				try {
					makeSquareClosingAIMove();
				} finally {
					// AI hamlesinden sonra tekrar aktifleştir (oyun bitmemişse)
					if (!gameOver) canvas.style.pointerEvents = 'auto';
				}
			}, 600); // kısa gecikme AI hissi için
		} else {
			startTurnTimer(); // Human player's turn
		}
		return;
	}

	// --- Path Drawing Game Logic ---
	// 1. Hamle: Oyunun ilk çizgisi
	if (edgesList.length === 0) {
		addEdge(a, b, turn);
		turn = 2;
		updateStatus(`Sıra: ${player2Name} — İlk hamlenizi yapın.`);
		draw();
		if (isSinglePlayer) {
            triggerAIMove();
        } else {
            startTurnTimer(); // Zamanlayıcı ilk hamleden sonra başlıyor.
        }
		return;
	}

	// 2. Hamle: İlk çizgiye bağlanmalı
	if (edgesList.length === 1) {
		const firstEdge = edgesList[0];
		let shared = null, other = null;

		if (pointEquals(a, firstEdge.a)) { shared = a; other = b; }
		else if (pointEquals(b, firstEdge.a)) { shared = b; other = a; }
		else if (pointEquals(a, firstEdge.b)) { shared = a; other = b; }
		else if (pointEquals(b, firstEdge.b)) { shared = b; other = a; }
		else {
			updateStatus('İkinci hamle ilk çizgiye bağlı olmalıdır.');
			startTurnTimer();
			return;
		}

		if (pointVisited(other) || isBorderPoint(other)) {
			addEdge(shared, other, turn); 
			draw();
			showGameOverScreen(turn);
			return;
		}

		addEdge(shared, other, turn);
		activeEndpoint = other;
		turn = 1;
		updateStatus(`Sıra: ${player1Name} — Aktif uçtan devam edin.`);
		draw();
		startTurnTimer();
		return;
	}

	// Sonraki tüm hamleler: Aktif uca bağlanmalı
	if (!activeEndpoint) return;
	let shared = null, other = null;
	if (pointEquals(a, activeEndpoint)) { shared = a; other = b; }
	else if (pointEquals(b, activeEndpoint)) { shared = b; other = a; }
	else { 
		updateStatus('Sadece aktif uçtan devam edilebilir.'); 
		startTurnTimer();
		return; 
	}

	if (pointVisited(other) || isBorderPoint(other)) {
		addEdge(shared, other, turn); 
		draw();
		showGameOverScreen(turn);
		return;
	}

	addEdge(shared, other, turn);
	activeEndpoint = { x: other.x, y: other.y };
	turn = turn === 1 ? 2 : 1;
	const currentPlayerName = turn === 1 ? player1Name : player2Name;
	updateStatus(`Sıra: ${currentPlayerName} — Aktif uç: (${activeEndpoint.x}, ${activeEndpoint.y})`);
	draw();
	
	if (isSinglePlayer && turn === 2) {
        triggerAIMove();
    } else {
        startTurnTimer();
    }
}

window.addEventListener('resize', resizeCanvasAndSetStep);
canvas.addEventListener('click', handleClick);
if (resetBtn) resetBtn.addEventListener('click', startGame);
if (playAgainBtn) playAgainBtn.addEventListener('click', startGame);
if (exitBtn) exitBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});
if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
    gameOverModal.classList.add('hidden'); // Modalı gizle
});
if (closeRulesBtn) closeRulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('hidden'); // Kurallar modalını gizle
    // Kurallar kapatıldıktan sonra ilk hamle için zamanlayıcıyı başlat
    if (edgesList.length === 0 && !gameOver) {
        startTurnTimer();
    }
});

startGame();