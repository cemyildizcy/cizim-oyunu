// ================================================
// ÇİZGİ SAVAŞLARI - OYUN MOTORU
// Modern • Rekabetçi • Sade
// ================================================

// --- DOM Elementleri ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('resetGameBtn');
const gridSizeDisplay = document.getElementById('gridSizeDisplay');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverMessage = document.getElementById('gameOverMessage');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitBtn = document.getElementById('exitBtn');
const scoreboard = document.getElementById('scoreboard');
const p1ScoreDisplay = document.getElementById('p1Score');
const p2ScoreDisplay = document.getElementById('p2Score');
const rulesModal = document.getElementById('rulesModal');
const rulesTitle = document.getElementById('rulesTitle');
const rulesContent = document.getElementById('rulesContent');
const closeRulesBtn = document.getElementById('closeRulesBtn');
const gameTitle = document.getElementById('gameTitle');
const footerInfo = document.getElementById('footerInfo');

// --- Oyun Değişkenleri ---
let N = 5;
let myName = 'Oyuncu';
let gameType = 'path';
let step = 100;

// --- Çevrimiçi ---
let onlineRoom = null;
let playerNumber = null;
let gameRef = null;
let playersRef = null;
let myPlayerRef = null;

// --- Oyun Durumu ---
let gameState = {};
let isSinglePlayer = false;
let aiThinking = false;
let aiDifficulty = 'medium';

// --- Zamanlayıcı ---
const TURN_TIME = 5; // saniye
let turnTimer = null;
let timeRemaining = TURN_TIME;
const timerContainer = document.getElementById('timerContainer');
const timerDisplay = document.getElementById('timerDisplay');
const timerProgress = document.getElementById('timerProgress');

// --- Renk Paleti ---
const COLORS = {
	player1: '#6366f1',  // İndigo
	player2: '#f97316',  // Turuncu
	grid: '#d4d4d8',
	dot: '#71717a',
	background: '#fafafa',
	activePoint: '#22c55e'
};

// ================================================
// YARDIMCI FONKSİYONLAR
// ================================================

function keyForEdge(a, b) {
	const s1 = `${a.x},${a.y}`, s2 = `${b.x},${b.y}`;
	return s1 < s2 ? `${s1}-${s2}` : `${s2}-${s1}`;
}

function keyForPoint(p) {
	return `${p.x},${p.y}`;
}

function pointEquals(p1, p2) {
	if (!p1 || !p2) return false;
	return p1.x === p2.x && p1.y === p2.y;
}

function isBorderPoint(p) {
	if (!p) return false;
	return p.x === 0 || p.x === N || p.y === 0 || p.y === N;
}

function countSides(state, x, y) {
	let count = 0;
	const edges = new Set((state.edgesList || []).map(e => keyForEdge(e.a, e.b)));
	if (edges.has(keyForEdge({ x, y }, { x: x + 1, y }))) count++;
	if (edges.has(keyForEdge({ x, y: y + 1 }, { x: x + 1, y: y + 1 }))) count++;
	if (edges.has(keyForEdge({ x, y }, { x, y: y + 1 }))) count++;
	if (edges.has(keyForEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 }))) count++;
	return count;
}

function edgesSetFromState(state) {
	const s = new Set();
	(state.edgesList || []).forEach(e => s.add(keyForEdge(e.a, e.b)));
	return s;
}

function countSidesWithSet(edgesSet, sx, sy) {
	let c = 0;
	if (edgesSet.has(keyForEdge({ x: sx, y: sy }, { x: sx + 1, y: sy }))) c++;
	if (edgesSet.has(keyForEdge({ x: sx, y: sy + 1 }, { x: sx + 1, y: sy + 1 }))) c++;
	if (edgesSet.has(keyForEdge({ x: sx, y: sy }, { x: sx, y: sy + 1 }))) c++;
	if (edgesSet.has(keyForEdge({ x: sx + 1, y: sy }, { x: sx + 1, y: sy + 1 }))) c++;
	return c;
}

// ================================================
// ZAMANLAYICI SİSTEMİ
// ================================================

function startTimer() {
	stopTimer(); // Önceki zamanlayıcıyı temizle

	// AI sırası veya oyun bittiyse zamanlayıcı başlatma
	if (gameState.gameOver) return;
	if (!onlineRoom && isSinglePlayer && gameState.turn === 2) return;

	// İlk hamle yapılmamışsa zamanlayıcı başlatma
	if ((gameState.edgesList || []).length === 0) {
		timerContainer.classList.add('hidden');
		return;
	}

	timeRemaining = TURN_TIME;
	updateTimerDisplay();
	timerContainer.classList.remove('hidden');

	turnTimer = setInterval(() => {
		timeRemaining--;
		updateTimerDisplay();

		if (timeRemaining <= 0) {
			stopTimer();
			handleTimeUp();
		}
	}, 1000);
}

function stopTimer() {
	if (turnTimer) {
		clearInterval(turnTimer);
		turnTimer = null;
	}
}

function updateTimerDisplay() {
	if (!timerDisplay || !timerProgress) return;

	timerDisplay.textContent = Math.max(0, timeRemaining);

	// Progress bar genişliği
	const percentage = (timeRemaining / TURN_TIME) * 100;
	timerProgress.style.width = percentage + '%';

	// Renk durumu
	timerDisplay.classList.remove('warning', 'danger');
	timerProgress.classList.remove('warning', 'danger');

	if (timeRemaining <= 3) {
		timerDisplay.classList.add('danger');
		timerProgress.classList.add('danger');
	} else if (timeRemaining <= 5) {
		timerDisplay.classList.add('warning');
		timerProgress.classList.add('warning');
	}
}

function handleTimeUp() {
	// Süre doldu - rastgele hamle yap
	ensureGameStateDefaults();

	// Sadece sıra bizdeyse
	if (playerNumber !== null && playerNumber !== gameState.turn) return;
	if (!onlineRoom && isSinglePlayer && gameState.turn === 2) return;

	// Rastgele geçerli hamle bul ve yap
	let move = null;
	if (gameType === 'path') {
		if (gameState.edgesList.length === 0) {
			move = pickRandomMove(gameState);
		} else {
			const validMoves = getValidPathMoves(gameState);
			if (validMoves.length > 0) {
				move = validMoves[Math.floor(Math.random() * validMoves.length)];
			}
		}
	} else {
		const allEdges = getAllUndrawnEdges(gameState);
		if (allEdges.length > 0) {
			move = allEdges[Math.floor(Math.random() * allEdges.length)];
		}
	}

	if (move) {
		processMove(move.a, move.b);
	}
}

function ensureGameStateDefaults() {
	if (!gameState || typeof gameState !== 'object') gameState = {};
	gameState.status = gameState.status || 'waiting';
	gameState.turn = (typeof gameState.turn === 'number') ? gameState.turn : 1;
	gameState.edgesList = Array.isArray(gameState.edgesList) ? gameState.edgesList : [];
	gameState.squares = Array.isArray(gameState.squares) ? gameState.squares : Array(N).fill(0).map(() => Array(N).fill(0));
	gameState.player1Score = gameState.player1Score || 0;
	gameState.player2Score = gameState.player2Score || 0;
	gameState.activeEndpoint = gameState.activeEndpoint || null;
	gameState.gameOver = !!gameState.gameOver;
	gameState.N = gameState.N || N;
	gameState.gameType = gameState.gameType || gameType;
	gameState.players = gameState.players || {};
}

// ================================================
// CANVAS VE ÇİZİM
// ================================================

function resizeCanvasAndSetStep() {
	const margin = window.innerWidth < 640 ? 40 : 60;
	const availableWidth = Math.max(200, window.innerWidth - margin);
	const reservedVerticalSpace = window.innerWidth < 640 ? 300 : 250;
	const availableHeight = Math.max(200, window.innerHeight - reservedVerticalSpace);

	const maxSize = Math.min(availableWidth, availableHeight, 600);
	const sizePx = Math.max(200, maxSize);
	const dpr = window.devicePixelRatio || 1;

	canvas.style.width = `${sizePx}px`;
	canvas.style.height = `${sizePx}px`;
	canvas.width = Math.floor(sizePx * dpr);
	canvas.height = Math.floor(sizePx * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	step = sizePx / N;
	draw();
}

function draw() {
	if (!canvas) return;
	ensureGameStateDefaults();

	const dpr = window.devicePixelRatio || 1;
	const physicalWidth = canvas.width / dpr;
	ctx.clearRect(0, 0, physicalWidth, physicalWidth);

	// Izgara çizgileri
	ctx.strokeStyle = COLORS.grid;
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

	// Noktalar
	ctx.fillStyle = COLORS.dot;
	for (let i = 0; i <= N; i++) {
		for (let j = 0; j <= N; j++) {
			ctx.beginPath();
			ctx.arc(i * step, j * step, 3, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	const edges = Array.isArray(gameState.edgesList) ? gameState.edgesList : [];
	const squares = Array.isArray(gameState.squares) ? gameState.squares : Array(N).fill(0).map(() => Array(N).fill(0));
	const activeEP = gameState.activeEndpoint || null;
	const gameOverLocal = !!gameState.gameOver;

	// Kapatılmış kareler (Kare Kapatma modu)
	if (gameType === 'square') {
		for (let y = 0; y < N; y++) {
			for (let x = 0; x < N; x++) {
				if (squares[y][x] !== 0) {
					const color = squares[y][x] === 1 ? COLORS.player1 + '30' : COLORS.player2 + '30';
					ctx.fillStyle = color;
					ctx.fillRect(x * step, y * step, step, step);
				}
			}
		}
	}

	// Çizilmiş kenarlar
	for (let i = 0; i < edges.length; i++) {
		const e = edges[i];
		const isLast = i === edges.length - 1 && !gameOverLocal;
		const color = e.player === 1 ? COLORS.player1 : COLORS.player2;

		ctx.beginPath();
		ctx.strokeStyle = color;
		ctx.lineWidth = isLast ? 4 : 3;
		ctx.lineCap = 'round';
		ctx.moveTo(e.a.x * step, e.a.y * step);
		ctx.lineTo(e.b.x * step, e.b.y * step);
		ctx.stroke();

		// Son hamle göstergesi
		if (isLast) {
			const mx = ((e.a.x + e.b.x) / 2) * step;
			const my = ((e.a.y + e.b.y) / 2) * step;
			ctx.beginPath();
			ctx.fillStyle = color;
			ctx.arc(mx, my, 5, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// Aktif uç nokta (Yol Çizme modu)
	if (activeEP && !gameOverLocal && gameType === 'path') {
		ctx.beginPath();
		ctx.fillStyle = COLORS.activePoint;
		ctx.arc(activeEP.x * step, activeEP.y * step, 6, 0, Math.PI * 2);
		ctx.fill();
	}
}

// ================================================
// OYUN BAŞLATMA
// ================================================

(function initGameFromUrl() {
	const params = new URLSearchParams(window.location.search);
	const s = parseInt(params.get('size'));
	if (s && s >= 3 && s <= 15) N = s;

	myName = decodeURIComponent(params.get('p1') || myName);
	gameType = params.get('type') || gameType;
	onlineRoom = params.get('room') || null;

	const mode = params.get('mode') || 'local';
	const p2FromUrl = (params.get('p2') || '').toLowerCase();

	isSinglePlayer = (mode === 'single' && !onlineRoom) || p2FromUrl.includes('bilgisayar');
	aiDifficulty = params.get('difficulty') || 'medium';

	if (gridSizeDisplay) {
		gridSizeDisplay.textContent = gameType === 'square' ? `${N}×${N}` : `${N}×${N}`;
	}

	if (footerInfo) {
		footerInfo.textContent = onlineRoom ? `Oda: ${onlineRoom}` : '';
	}

	if (gameTitle) {
		gameTitle.textContent = gameType === 'square' ? 'Kare Kapatma' : 'Yol Çizme';
	}

	resizeCanvasAndSetStep();
	displayRules();

	if (onlineRoom && typeof database !== 'undefined' && database) {
		setupFirebaseConnection();
	} else {
		const isAiMode = !onlineRoom && isSinglePlayer;
		const p2NameFromUrl = decodeURIComponent(params.get('p2') || (isAiMode ? 'Bilgisayar' : 'Oyuncu 2'));
		gameState = {
			status: 'local',
			turn: 1,
			edgesList: [],
			squares: Array(N).fill(0).map(() => Array(N).fill(0)),
			player1Score: 0,
			player2Score: 0,
			activeEndpoint: null,
			gameOver: false,
			N: N,
			gameType: gameType,
			players: { p1: { name: myName }, p2: { name: p2NameFromUrl } }
		};
		playerNumber = isSinglePlayer ? 1 : null;
		ensureGameStateDefaults();
		updateLocalStateFromServer();
	}
})();

function setupFirebaseConnection() {
	if (!onlineRoom) return;
	gameRef = database.ref('games/' + onlineRoom);
	playersRef = database.ref('games/' + onlineRoom + '/players');

	isSinglePlayer = false;

	myPlayerRef = playersRef.push({ name: myName });
	myPlayerRef.onDisconnect().remove();

	playersRef.on('value', (snapshot) => {
		const players = snapshot.val() || {};
		gameState.players = players;
		ensureGameStateDefaults();
		const playerKeys = Object.keys(players);
		const myKey = myPlayerRef && myPlayerRef.key;
		const myIndex = myKey ? playerKeys.findIndex(k => k === myKey) : -1;
		if (myIndex !== -1) playerNumber = myIndex + 1;

		if (playerKeys.length === 2 && playerNumber === 1 && (!gameState.status || gameState.status === 'waiting')) {
			resetGame(true);
		}

		updateLocalStateFromServer();
	});

	gameRef.on('value', (snapshot) => {
		const newState = snapshot.val();
		if (newState) {
			gameState = newState;
			ensureGameStateDefaults();
			if (gameState.N && gameState.N !== N) {
				N = gameState.N;
				resizeCanvasAndSetStep();
			}
			updateLocalStateFromServer();
		}
	});
}

function resetGame(isOnlineP1 = false) {
	if (onlineRoom && playerNumber !== 1 && !isOnlineP1) return;

	const initialGameState = {
		status: 'game_started',
		turn: 1,
		edgesList: [],
		squares: Array(N).fill(0).map(() => Array(N).fill(0)),
		player1Score: 0,
		player2Score: 0,
		activeEndpoint: null,
		gameOver: false,
		N: N,
		gameType: gameType
	};

	if (gameRef) {
		gameRef.update(initialGameState);
	} else {
		const isAiMode = !onlineRoom && isSinglePlayer;
		const p2Name = gameState.players?.p2?.name || (isAiMode ? 'Bilgisayar' : 'Oyuncu 2');
		initialGameState.players = {
			p1: { name: myName },
			p2: { name: p2Name }
		};
		gameState = initialGameState;
		ensureGameStateDefaults();
		updateLocalStateFromServer();
	}
	displayRules();
}

// ================================================
// UI GÜNCELLEMELERİ
// ================================================

function updateStatusText() {
	ensureGameStateDefaults();
	const players = gameState.players || {};

	const keys = Object.keys(players);
	const p1Name = (players.p1?.name) || (keys[0] && players[keys[0]].name) || 'Oyuncu 1';
	const p2Name = (players.p2?.name) || (keys[1] && players[keys[1]].name) || 'Oyuncu 2';

	if (keys.length < 2 && !gameState.gameOver && gameState.status !== 'local') {
		statusDiv.textContent = 'Rakip bekleniyor...';
		updateTurnVisualIndicator();
		return;
	}

	if (gameState.gameOver) {
		statusDiv.textContent = 'Oyun Bitti';
		updateTurnVisualIndicator();
		return;
	}

	const current = gameState.turn === 1 ? p1Name : p2Name;
	let text = `Sıra: ${current}`;

	const isMyTurn = (playerNumber === gameState.turn) || (playerNumber === null && gameState.turn === 1);
	const isAiTurn = !onlineRoom && isSinglePlayer && gameState.turn === 2;

	if (isMyTurn && !isAiTurn) text += ' (Senin sıran)';
	if (isAiTurn) text += ' (Düşünüyor...)';

	statusDiv.textContent = text;
	updateTurnVisualIndicator();
}

function updateScoreDisplay() {
	if (gameType !== 'square') return;
	const players = gameState.players || {};
	const keys = Object.keys(players);
	const p1Name = (players.p1?.name) || (keys[0] && players[keys[0]].name) || 'Oyuncu 1';
	const p2Name = (players.p2?.name) || (keys[1] && players[keys[1]].name) || 'Oyuncu 2';

	p1ScoreDisplay.textContent = `${p1Name}: ${gameState.player1Score || 0}`;
	p2ScoreDisplay.textContent = `${p2Name}: ${gameState.player2Score || 0}`;
}

function updateTurnVisualIndicator() {
	ensureGameStateDefaults();
	const body = document.body;

	const isMyTurn = (playerNumber === gameState.turn) || (playerNumber === null && gameState.turn === 1);
	const isAiTurn = !onlineRoom && isSinglePlayer && gameState.turn === 2;

	body.classList.remove('my-turn', 'ai-turn');

	if (gameState.gameOver || gameState.status === 'waiting') return;

	if (isAiTurn) {
		body.classList.add('ai-turn');
	} else if (isMyTurn) {
		body.classList.add('my-turn');
	}
}

function showGameOverScreen() {
	ensureGameStateDefaults();
	const players = gameState.players || {};
	const keys = Object.keys(players);
	const p1 = (players.p1?.name) || (keys[0] && players[keys[0]].name) || 'Oyuncu 1';
	const p2 = (players.p2?.name) || (keys[1] && players[keys[1]].name) || 'Oyuncu 2';

	let message = '';
	const p1Score = gameState.player1Score || 0;
	const p2Score = gameState.player2Score || 0;

	if (gameType === 'square') {
		if (p1Score > p2Score) message = `🏆 ${p1} Kazandı! (${p1Score}-${p2Score})`;
		else if (p2Score > p1Score) message = `🏆 ${p2} Kazandı! (${p2Score}-${p1Score})`;
		else message = `Berabere! (${p1Score}-${p2Score})`;
	} else {
		const losing = gameState.losingPlayer;
		if (losing) {
			const lname = losing === 1 ? p1 : p2;
			const wname = losing === 1 ? p2 : p1;
			message = `🏆 ${wname} Kazandı!`;
		} else {
			message = 'Oyun Bitti';
		}
	}

	gameOverMessage.textContent = message;
	gameOverModal.classList.remove('hidden');
	document.body.classList.remove('my-turn', 'ai-turn');
}

function displayRules() {
	rulesModal.classList.remove('hidden');

	if (gameType === 'path') {
		rulesTitle.textContent = 'Yol Çizme';
		rulesContent.innerHTML = `
			<h3>Nasıl Oynanır?</h3>
			<ul>
				<li>Sırayla ızgara üzerinde çizgiler çizerek bir yol oluşturun</li>
				<li>Yol, ziyaret edilmemiş noktalardan geçmelidir</li>
				<li>Kenarlara veya daha önce geçilmiş noktalara gidemezsiniz</li>
			</ul>
			<h3>Kazanma Koşulu</h3>
			<ul>
				<li>Rakibinizi çıkmaza sokan kazanır!</li>
				<li>Hamle yapamayan oyuncu kaybeder</li>
			</ul>
		`;
	} else if (gameType === 'square') {
		rulesTitle.textContent = 'Kare Kapatma';
		rulesContent.innerHTML = `
			<h3>Nasıl Oynanır?</h3>
			<ul>
				<li>Sırayla iki nokta arasına çizgi çizin</li>
				<li>Bir kareyi tamamlayan o kareyi alır ve tekrar oynar</li>
			</ul>
			<h3>Kazanma Koşulu</h3>
			<ul>
				<li>En çok kareyi kapatan kazanır!</li>
			</ul>
		`;
	}
}

function updateLeaderboard(result) {
	if (!onlineRoom || !database) return;

	const pName = gameState.players?.[`p${playerNumber}`]?.name;
	if (!pName) return;

	const playerWinsRef = database.ref('leaderboard').child(pName);

	if (result === 1) {
		playerWinsRef.transaction((currentWins) => {
			return (currentWins || 0) + 1;
		});
	}
}

// ================================================
// OYUN MEKANİĞİ
// ================================================

function isValidPathMove(state, a, b) {
	// İlk hamle - herhangi bir kenar geçerli (sınırda olmayan)
	if (state.edgesList.length === 0) {
		// Her iki nokta da sınırda olmamalı
		if (isBorderPoint(a) || isBorderPoint(b)) return false;
		return true;
	}

	// Ziyaret edilmiş noktaları hesapla
	const visited = new Set();
	state.edgesList.forEach(e => {
		visited.add(keyForPoint(e.a));
		visited.add(keyForPoint(e.b));
	});

	// Bitişik noktalar arasında olmalı
	if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return false;

	// Tek kenar varsa - her iki uçtan devam edilebilir
	if (state.edgesList.length === 1) {
		const first = state.edgesList[0];
		const touchesFirst = pointEquals(a, first.a) || pointEquals(a, first.b) ||
			pointEquals(b, first.a) || pointEquals(b, first.b);

		if (!touchesFirst) return false;

		// Gidilecek nokta (ilk kenara değmeyen uç)
		const newPoint = (pointEquals(a, first.a) || pointEquals(a, first.b)) ? b : a;

		// Yeni nokta ziyaret edilmiş veya sınırda olmamalı
		if (visited.has(keyForPoint(newPoint)) || isBorderPoint(newPoint)) return false;

		return true;
	}

	// 2+ kenar varsa - aktif uçtan devam edilmeli
	if (!state.activeEndpoint) return false;

	const touchesActive = pointEquals(a, state.activeEndpoint) || pointEquals(b, state.activeEndpoint);
	if (!touchesActive) return false;

	// Gidilecek yeni nokta
	const newPoint = pointEquals(a, state.activeEndpoint) ? b : a;

	// Yeni nokta ziyaret edilmiş veya sınırda olmamalı (oyun mantığı bu durumda oyunu bitirir ama bu hareket geçerli sayılır)
	// Not: Sınıra veya ziyaret edilmiş noktaya gitmek geçerli bir hamledir, oyunu bitirir
	return true;
}

function applySquareMove(state, a, b) {
	const currentPlayer = state.turn;

	state.edgesList.push({ a, b, player: currentPlayer });
	const completed = checkCompletedSquares(state, a, b);

	let turnRemained = false;

	if (completed > 0) {
		if (currentPlayer === 1) state.player1Score += completed;
		else state.player2Score += completed;
		turnRemained = true;
	}

	if (!turnRemained) {
		state.turn = currentPlayer === 1 ? 2 : 1;
	}

	const total = (state.player1Score || 0) + (state.player2Score || 0);
	if (total === N * N) state.gameOver = true;
}

function checkCompletedSquares(state, p1, p2) {
	let completedCount = 0;
	const x = Math.min(p1.x, p2.x);
	const y = Math.min(p1.y, p2.y);

	function tryClaim(sx, sy) {
		if (sx < 0 || sx >= N || sy < 0 || sy >= N) return;
		if (!Array.isArray(state.squares) || !Array.isArray(state.squares[sy])) return;
		if (state.squares[sy][sx] !== 0) return;
		if (countSides(state, sx, sy) === 4) {
			state.squares[sy][sx] = state.turn;
			completedCount++;
		}
	}

	if (p1.y === p2.y) { tryClaim(x, y - 1); tryClaim(x, y); }
	else if (p1.x === p2.x) { tryClaim(x - 1, y); tryClaim(x, y); }
	return completedCount;
}

function applyPathMove(state, a, b) {
	const visited = new Set();
	(state.edgesList || []).forEach(e => { visited.add(keyForPoint(e.a)); visited.add(keyForPoint(e.b)); });

	const currentTurn = state.turn;

	if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return;

	// İLK HAMLE
	if ((state.edgesList || []).length === 0) {
		state.edgesList.push({ a, b, player: currentTurn });
		// İlk hamlede henüz tek bir uç yok, her iki nokta da potansiyel uç
		// İkinci hamle için her iki noktadan devam edilebilir
		state.activeEndpoint = null; // İkinci hamlede belirlenir
		state.turn = currentTurn === 1 ? 2 : 1;
		return;
	}

	let shared = null, other = null;

	// İKİNCİ HAMLE - ilk kenarın uçlarından birine bağlanmalı
	if ((state.edgesList || []).length === 1) {
		const first = state.edgesList[0];
		// Hangi uçtan devam ediliyor?
		if (pointEquals(a, first.a)) { shared = a; other = b; }
		else if (pointEquals(b, first.a)) { shared = b; other = a; }
		else if (pointEquals(a, first.b)) { shared = a; other = b; }
		else if (pointEquals(b, first.b)) { shared = b; other = a; }
		else return;

		// İkinci hamlede, zincirin sabit ucu belirlenir (bağlanmayan uç)
		// Aktif uç ise yeni eklenen other noktası olur
	} else {
		// 3+ HAMLE - sadece aktif uçtan devam edilebilir
		if (!state.activeEndpoint) return;
		if (pointEquals(a, state.activeEndpoint)) { shared = a; other = b; }
		else if (pointEquals(b, state.activeEndpoint)) { shared = b; other = a; }
		else return;
	}

	if (!other) return;

	// Sınıra veya ziyaret edilmiş noktaya gidilirse oyun biter
	if (isBorderPoint(other) || visited.has(keyForPoint(other))) {
		state.edgesList.push({ a, b, player: currentTurn });
		state.activeEndpoint = other;
		state.gameOver = true;
		state.losingPlayer = currentTurn;
		return;
	}

	state.edgesList.push({ a, b, player: currentTurn });
	state.activeEndpoint = other;
	state.turn = currentTurn === 1 ? 2 : 1;

	// Sıradaki oyuncunun hamle yapıp yapamayacağını kontrol et
	const nextPlayer = state.turn;
	const nextState = JSON.parse(JSON.stringify(state));
	const tempVisited = new Set(visited);
	tempVisited.add(keyForPoint(other));

	if (getValidPathMoves(nextState, tempVisited).length === 0) {
		state.gameOver = true;
		state.losingPlayer = nextPlayer;
	}
}

function getValidPathMoves(state, currentVisited = null) {
	if (!Array.isArray(state.edgesList)) return [];

	const gridN = state.N;
	const visited = currentVisited || new Set();
	if (!currentVisited) state.edgesList.forEach(e => { visited.add(keyForPoint(e.a)); visited.add(keyForPoint(e.b)); });
	const edgesSet = new Set(state.edgesList.map(e => keyForEdge(e.a, e.b)));

	// İlk hamle henüz yapılmadıysa
	if (state.edgesList.length === 0) return [];

	// Tek kenar varsa - her iki uçtan da devam edilebilir
	if (state.edgesList.length === 1 || !state.activeEndpoint) {
		const first = state.edgesList[0];
		const endpoints = [first.a, first.b];
		const moves = [];

		for (const ep of endpoints) {
			const neighbors = [
				{ x: ep.x + 1, y: ep.y },
				{ x: ep.x - 1, y: ep.y },
				{ x: ep.x, y: ep.y + 1 },
				{ x: ep.x, y: ep.y - 1 }
			];

			for (const n of neighbors) {
				if (n.x < 0 || n.x > gridN || n.y < 0 || n.y > gridN) continue;
				const k = keyForEdge(ep, n);
				if (edgesSet.has(k)) continue;
				if (isBorderPoint(n)) continue;
				if (visited.has(keyForPoint(n))) continue;

				moves.push({ a: ep, b: n });
			}
		}
		return moves;
	}

	// Aktif uç varsa - sadece oradan devam edilebilir
	const activeP = state.activeEndpoint;
	const neighbors = [
		{ x: activeP.x + 1, y: activeP.y },
		{ x: activeP.x - 1, y: activeP.y },
		{ x: activeP.x, y: activeP.y + 1 },
		{ x: activeP.x, y: activeP.y - 1 }
	];
	const moves = [];

	for (const n of neighbors) {
		if (n.x < 0 || n.x > gridN || n.y < 0 || n.y > gridN) continue;
		const k = keyForEdge(activeP, n);
		if (edgesSet.has(k)) continue;
		if (isBorderPoint(n)) continue;
		if (visited.has(keyForPoint(n))) continue;

		moves.push({ a: activeP, b: n });
	}

	return moves;
}

function processMove(a, b) {
	ensureGameStateDefaults();
	const newState = JSON.parse(JSON.stringify(gameState));
	const edgeKey = keyForEdge(a, b);
	if ((newState.edgesList || []).some(e => keyForEdge(e.a, e.b) === edgeKey)) return;

	if (gameType === 'square') {
		applySquareMove(newState, a, b);
	} else {
		const valid = isValidPathMove(newState, a, b);
		if (!valid) return;
		applyPathMove(newState, a, b);
	}

	if (gameRef) {
		newState.aiThinking = aiThinking;
		try { gameRef.update(newState); }
		catch (e) {
			console.error('Firebase Update Error:', e);
			gameState = newState;
			updateLocalStateFromServer();
		}
	} else {
		gameState = newState;
		updateLocalStateFromServer();
	}
}

// ================================================
// TIKLIK YÖNETIMI
// ================================================

function nearestPointToClick(mx, my) {
	const threshold = step * 0.4;
	for (let i = 0; i <= N; i++) {
		for (let j = 0; j <= N; j++) {
			const dx = mx - i * step;
			const dy = my - j * step;
			if (Math.sqrt(dx * dx + dy * dy) <= threshold) {
				return { x: i, y: j };
			}
		}
	}
	return null;
}

function findClickedEdge(mx, my) {
	let best = null, bestDist = Infinity;
	const threshold = Math.max(25, step * 0.45); // Daha geniş tıklama alanı

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
	return bestDist <= threshold ? { a: best[0], b: best[1] } : null;
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
	const dx = px - xx, dy = py - yy;
	return Math.sqrt(dx * dx + dy * dy);
}

function handleClick(evt) {
	ensureGameStateDefaults();
	const isAiTurn = !onlineRoom && isSinglePlayer && gameState.turn === 2;
	if (gameState.gameOver || isAiTurn) return;

	const playersCount = Object.keys(gameState.players || {}).length;
	if (playersCount < 2 && gameState.status !== 'local') {
		alert('Rakibin bağlanmasını bekleyin.');
		return;
	}
	if (playerNumber !== null && playerNumber !== gameState.turn) return;

	const rect = canvas.getBoundingClientRect();
	const mx = evt.clientX - rect.left, my = evt.clientY - rect.top;

	const edge = findClickedEdge(mx, my);
	if (!edge) return;

	processMove(edge.a, edge.b);
}

// ================================================
// YAPAY ZEKA
// ================================================

function getAllUndrawnEdges(state) {
	const edgesSet = new Set((state.edgesList || []).map(e => keyForEdge(e.a, e.b)));
	const list = [];
	for (let y = 0; y <= state.N; y++) {
		for (let x = 0; x <= state.N; x++) {
			if (x < state.N) {
				const a = { x, y }, b = { x: x + 1, y };
				if (!edgesSet.has(keyForEdge(a, b))) list.push({ a, b });
			}
			if (y < state.N) {
				const a = { x, y }, b = { x, y: y + 1 };
				if (!edgesSet.has(keyForEdge(a, b))) list.push({ a, b });
			}
		}
	}
	return list;
}

function pickRandomMove(state) {
	const allUndrawn = getAllUndrawnEdges(state);
	if (allUndrawn.length === 0) return null;

	if (state.gameType === 'square') {
		return allUndrawn[Math.floor(Math.random() * allUndrawn.length)];
	}

	let candidates = [];
	if (!state.edgesList || state.edgesList.length === 0) {
		candidates = allUndrawn;
	} else if (state.edgesList.length === 1) {
		const first = state.edgesList[0];
		for (const edge of allUndrawn) {
			if (pointEquals(edge.a, first.a) || pointEquals(edge.a, first.b) || pointEquals(edge.b, first.a) || pointEquals(edge.b, first.b)) {
				candidates.push(edge);
			}
		}
	} else {
		candidates = getValidPathMoves(state);
	}

	if (candidates.length === 0) return null;
	return candidates[Math.floor(Math.random() * candidates.length)];
}

function getBestSquareMove(state) {
	const all = getAllUndrawnEdges(state);
	if (all.length === 0) return null;

	const edgesSet = edgesSetFromState(state);
	let winning = [], safe = [], risky = [];

	for (const e of all) {
		const tmp = new Set(edgesSet);
		tmp.add(keyForEdge(e.a, e.b));

		// Kare tamamlıyor mu?
		let completes = false;
		const x = Math.min(e.a.x, e.b.x), y = Math.min(e.a.y, e.b.y);

		const checkComplete = (sx, sy) => {
			if (sx < 0 || sx >= state.N || sy < 0 || sy >= state.N) return false;
			return countSidesWithSet(tmp, sx, sy) === 4;
		};

		if (e.a.y === e.b.y) { completes = checkComplete(x, y - 1) || checkComplete(x, y); }
		else { completes = checkComplete(x - 1, y) || checkComplete(x, y); }

		if (completes) {
			winning.push(e);
			continue;
		}

		// 3. kenar oluşturuyor mu?
		const createsThird = (sx, sy) => {
			if (sx < 0 || sx >= state.N || sy < 0 || sy >= state.N) return false;
			return countSidesWithSet(tmp, sx, sy) === 3;
		};

		let makesThird = false;
		if (e.a.y === e.b.y) { makesThird = createsThird(x, y - 1) || createsThird(x, y); }
		else { makesThird = createsThird(x - 1, y) || createsThird(x, y); }

		if (makesThird) {
			risky.push(e);
		} else {
			safe.push(e);
		}
	}

	if (winning.length > 0) return winning[Math.floor(Math.random() * winning.length)];
	if (safe.length > 0) return safe[Math.floor(Math.random() * safe.length)];
	return risky[Math.floor(Math.random() * risky.length)] || all[Math.floor(Math.random() * all.length)];
}

function getBestPathMove(state) {
	if (!Array.isArray(state.edgesList) || state.edgesList.length === 0) {
		// İlk hamle - merkeze yakın başla
		const centerX = Math.floor(state.N / 2);
		const centerY = Math.floor(state.N / 2);
		const all = getAllUndrawnEdges(state);

		// Merkezden başlayan kenarları bul
		const centerEdges = all.filter(e => {
			const isNearCenter = (Math.abs(e.a.x - centerX) <= 1 && Math.abs(e.a.y - centerY) <= 1) ||
				(Math.abs(e.b.x - centerX) <= 1 && Math.abs(e.b.y - centerY) <= 1);
			// Sınırda olmayanları seç
			const notOnBorder = !isBorderPoint(e.a) && !isBorderPoint(e.b);
			return isNearCenter && notOnBorder;
		});

		if (centerEdges.length > 0) {
			return centerEdges[Math.floor(Math.random() * centerEdges.length)];
		}
		return pickRandomMove(state);
	}

	const edgesSet = edgesSetFromState(state);
	const visited = new Set();
	(state.edgesList || []).forEach(e => { visited.add(keyForPoint(e.a)); visited.add(keyForPoint(e.b)); });

	let candidates = state.edgesList.length === 1 ? [] : getValidPathMoves(state);

	if (state.edgesList.length === 1) {
		const first = state.edgesList[0];
		const all = getAllUndrawnEdges(state);
		for (const edge of all) {
			// İlk kenarın uçlarından birinden başlayan ve sınıra gitmeyen kenarlar
			const startsFromFirst = pointEquals(edge.a, first.a) || pointEquals(edge.a, first.b) ||
				pointEquals(edge.b, first.a) || pointEquals(edge.b, first.b);
			if (startsFromFirst) {
				// Gideceği nokta sınırda mı kontrol et
				const sharedPoint = pointEquals(edge.a, first.a) || pointEquals(edge.a, first.b) ? edge.a : edge.b;
				const otherPoint = pointEquals(edge.a, sharedPoint) ? edge.b : edge.a;

				if (!isBorderPoint(otherPoint) && !visited.has(keyForPoint(otherPoint))) {
					candidates.push(edge);
				}
			}
		}
	}

	if (candidates.length === 0) {
		// Uygun hamle yok, zorunlu hamle yap
		return pickRandomMove(state);
	}

	// Her hamleyi değerlendir (Gelişmiş Strateji)
	const evaluatedMoves = [];

	for (const m of candidates) {
		let newPoint = null;

		if (state.activeEndpoint && pointEquals(m.a, state.activeEndpoint)) newPoint = m.b;
		else if (state.activeEndpoint && pointEquals(m.b, state.activeEndpoint)) newPoint = m.a;
		else if (state.edgesList.length === 1) {
			const first = state.edgesList[0];
			if (pointEquals(m.a, first.a) || pointEquals(m.a, first.b)) newPoint = m.b;
			else newPoint = m.a;
		}

		if (!newPoint) continue;
		if (isBorderPoint(newPoint) || visited.has(keyForPoint(newPoint))) continue;

		const tmpEdges = new Set(edgesSet);
		tmpEdges.add(keyForEdge(m.a, m.b));
		const tmpVisited = new Set(visited);
		tmpVisited.add(keyForPoint(newPoint));

		// Rakibin (oyuncu) o noktadan kaç hamle yapabileceğini say
		let playerOptions = 0;
		const nbs = [
			{ x: newPoint.x + 1, y: newPoint.y }, { x: newPoint.x - 1, y: newPoint.y },
			{ x: newPoint.x, y: newPoint.y + 1 }, { x: newPoint.x, y: newPoint.y - 1 }
		];

		for (const nn of nbs) {
			if (nn.x < 0 || nn.x > state.N || nn.y < 0 || nn.y > state.N) continue;
			const kk = keyForEdge(newPoint, nn);
			if (!tmpEdges.has(kk) && !isBorderPoint(nn) && !tmpVisited.has(keyForPoint(nn))) {
				playerOptions++;
			}
		}

		// Merkeze uzaklık (merkezde kalmak iyi)
		const centerDist = Math.abs(newPoint.x - state.N / 2) + Math.abs(newPoint.y - state.N / 2);

		// Optimal değil hamleleri filtrele (0 seçenek = oyuncu kazanır, bunu seçme!)
		// Eğer playerOptions 0 veya 1 ise rakip sıkışır - BU İYİ!
		// Ama kendimiz sıkışmayalım

		// Puanlama: Az seçenek = oyuncu sıkışır = AI için iyi
		// Ama 0 seçenek direkt oyun bitirir - bu en iyi
		let score = 0;

		if (playerOptions === 0) {
			score = 1000; // Oyuncuyu anında sıkıştır - EN İYİ
		} else if (playerOptions === 1) {
			score = 500 - centerDist; // Oyuncunun tek seçeneği var
		} else {
			score = 100 - playerOptions * 20 - centerDist; // Az seçenek iyi, merkeze yakınlık bonus
		}

		evaluatedMoves.push({ move: m, score, playerOptions });
	}

	if (evaluatedMoves.length === 0) return candidates[Math.floor(Math.random() * candidates.length)];

	// En yüksek skorlu hamleyi seç
	evaluatedMoves.sort((a, b) => b.score - a.score);
	const best = evaluatedMoves[0];
	const bestMoves = evaluatedMoves.filter(m => m.score === best.score);
	return bestMoves[Math.floor(Math.random() * bestMoves.length)].move;
}

function scheduleAIMoveIfNeeded() {
	if (onlineRoom || !isSinglePlayer) return;
	if (aiThinking) return;
	if (gameState.gameOver) return;
	if (gameState.turn !== 2) return;

	if (rulesModal && !rulesModal.classList.contains('hidden')) return;

	aiThinking = true;
	updateTurnVisualIndicator();

	const prevPointer = canvas.style.pointerEvents;
	canvas.style.pointerEvents = 'none';

	let delay, getMove;

	if (aiDifficulty === 'easy') {
		// KOLAY: Çok yavaş, %80 rastgele, %20 akıllı
		delay = 1500;
		getMove = (state) => {
			if (Math.random() < 0.2) {
				// %20 ihtimalle akıllı hamle
				if (state.gameType === 'square') return getBestSquareMove(state);
				return getBestPathMove(state);
			}
			return pickRandomMove(state);
		};
	} else if (aiDifficulty === 'medium') {
		// ORTA: Normal hız, %70 akıllı, %30 rastgele
		delay = 800;
		getMove = (state) => {
			if (Math.random() < 0.7) {
				if (state.gameType === 'square') return getBestSquareMove(state);
				return getBestPathMove(state);
			}
			return pickRandomMove(state);
		};
	} else {
		// ZOR: Çok hızlı, %95 akıllı (neredeyse mükemmel)
		delay = 300;
		getMove = (state) => {
			if (Math.random() < 0.95) {
				if (state.gameType === 'square') return getBestSquareMove(state);
				return getBestPathMove(state);
			}
			return pickRandomMove(state);
		};
	}

	setTimeout(() => {
		try {
			let move = getMove(gameState);
			if (!move) move = pickRandomMove(gameState);
			if (move) processMove(move.a, move.b);
		} catch (err) {
			console.error('AI error:', err);
		} finally {
			aiThinking = false;
			if (!gameState.gameOver) canvas.style.pointerEvents = prevPointer || 'auto';
			updateLocalStateFromServer();
		}
	}, delay);
}

// ================================================
// DURUM GÜNCELLEMESİ
// ================================================

function updateLocalStateFromServer() {
	ensureGameStateDefaults();
	N = gameState.N;
	gameType = gameState.gameType || gameType;
	resizeCanvasAndSetStep();

	if (gameType === 'square') scoreboard.classList.remove('hidden');
	else scoreboard.classList.add('hidden');

	if (!Array.isArray(gameState.squares) || gameState.squares.length !== N) {
		const newSquares = Array(N).fill(0).map(() => Array(N).fill(0));
		if (Array.isArray(gameState.squares)) {
			for (let y = 0; y < Math.min(gameState.squares.length, N); y++) {
				for (let x = 0; x < Math.min(gameState.squares[y]?.length || 0, N); x++) {
					newSquares[y][x] = gameState.squares[y][x] || 0;
				}
			}
		}
		gameState.squares = newSquares;
	}

	updateStatusText();
	updateScoreDisplay();
	draw();

	if (gameState.gameOver) {
		stopTimer();
		timerContainer.classList.add('hidden');
		showGameOverScreen();
		if (onlineRoom && playerNumber) {
			updateLeaderboard(gameState.losingPlayer === playerNumber ? 0 : 1);
		}
	} else {
		if (!onlineRoom && isSinglePlayer && gameState.turn === 2) {
			stopTimer();
			timerContainer.classList.add('hidden');
			scheduleAIMoveIfNeeded();
		} else {
			// Oyuncu sırası - zamanlayıcıyı başlat
			startTimer();
		}
		gameOverModal.classList.add('hidden');
	}
	updateTurnVisualIndicator();
}

// ================================================
// EVENT LISTENERS
// ================================================

closeRulesBtn.addEventListener('click', () => {
	rulesModal.classList.add('hidden');
	updateLocalStateFromServer();
});

playAgainBtn.addEventListener('click', () => {
	gameOverModal.classList.add('hidden');
	resetGame();
});

exitBtn.addEventListener('click', () => {
	window.location.href = 'index.html';
});

resetBtn.addEventListener('click', () => {
	resetGame();
});

canvas.addEventListener('click', handleClick);
window.addEventListener('resize', resizeCanvasAndSetStep);
