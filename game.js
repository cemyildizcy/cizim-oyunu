// --- Tuval ve DOM Elementleri ---
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
const rulesModal = document.getElementById('rulesModal');
const rulesTitle = document.getElementById('rulesTitle');
const rulesContent = document.getElementById('rulesContent');
const closeRulesBtn = document.getElementById('closeRulesBtn');
const gameTitle = document.getElementById('gameTitle');
const footerInfo = document.getElementById('footerInfo');


// --- Oyun Durumu Değişkenleri ---
let N = 5;
let myName = 'Oyuncu';
let gameType = 'path';
let step = 120; // Tuval boyutuna göre yeniden hesaplanacak

// --- Çevrimiçi Oyun Değişkenleri ---
let onlineRoom = null;
let playerNumber = null; // Bu odadaki oyuncu numaram (1 veya 2)
let gameRef = null; // Firebase'deki oyun odasının referansı
let playersRef = null; // Odadaki oyuncuların referansı
let myPlayerRef = null; // Bu oyuncunun kendi referansı

// --- Oyun Mekaniği Değişkenleri (Firebase'den senkronize edilecek) ---
let gameState = {}; // Sunucudaki tüm oyun verisini tutan obje

// =================================================================
// OYUNUN BAŞLATILMASI VE KURULUMU
// =================================================================

// Sayfa yüklendiğinde URL'den oyun parametrelerini al
(function initGameFromUrl() {
	const params = new URLSearchParams(window.location.search);
	const s = parseInt(params.get('size'));
	if (s && s >= 3 && s <= 20) N = s;

	myName = params.get('p1') || 'Oyuncu';
	gameType = params.get('type') || 'path';
	onlineRoom = params.get('room') || null;

	if (gridSizeDisplay) gridSizeDisplay.textContent = `${N} × ${N} Kare`;
    if (footerInfo) footerInfo.textContent = `Oda Kodu: ${onlineRoom}`;
	if (gameTitle) {
        gameTitle.textContent = `${gameType === 'square' ? 'Kare Kapatma' : 'Yol Çizme'}`;
    }

	// Eğer oda kodu yoksa, ana sayfaya yönlendir
	if (!onlineRoom) {
		window.location.href = 'index.html';
		return;
	}
    
    // DÜZELTME: Firebase bağlantısı kurulmadan önce boş bir ızgara çizerek beyaz ekranı önle.
    resizeCanvasAndSetStep();

	// Firebase bağlantısını ve dinleyicilerini kur
	setupFirebaseConnection();
})();

// Firebase bağlantısını kurar ve oyun durumu değişikliklerini dinler
function setupFirebaseConnection() {
	if (!onlineRoom) return;
	
	gameRef = database.ref('games/' + onlineRoom);
	playersRef = database.ref('games/' + onlineRoom + '/players');

	// Oyuncu odaya katıldığında kendini ekler
	myPlayerRef = playersRef.push({ name: myName });
	myPlayerRef.onDisconnect().remove(); // Bağlantı koparsa kendini siler

	// Odadaki oyuncu sayısını ve sırasını belirlemek için dinleyici
	playersRef.on('value', (snapshot) => {
		const players = snapshot.val();
		if (!players) return;

		const playerKeys = Object.keys(players);
		const myKey = myPlayerRef.key;
		
		const myIndex = playerKeys.findIndex(key => key === myKey);
		if (myIndex !== -1) {
			playerNumber = myIndex + 1;
		}

		// Eğer ilk oyuncuysa ve oyun henüz başlamamışsa, oyunu başlat
		if (playerNumber === 1 && !gameState.status) {
			resetGame();
		}
	});

	// Oyun durumundaki tüm değişiklikleri dinler
	gameRef.on('value', (snapshot) => {
		const newState = snapshot.val();
		if (newState) {
			gameState = newState;
			updateLocalStateFromServer();
		}
	});
}

// Sunucudan gelen yeni verilerle yerel durumu günceller
function updateLocalStateFromServer() {
    // Odaya sonradan katılan oyuncu, odanın ayarlarını benimser
    const serverN = gameState.N || N;
    // Eğer N değeri sunucudan gelenle farklıysa, güncelle ve tuvali yeniden boyutlandır
    if (N !== serverN) {
        N = serverN;
        resizeCanvasAndSetStep(); 
    }

    gameType = gameState.gameType || gameType;
    if (gridSizeDisplay) gridSizeDisplay.textContent = `${N} × ${N} Kare`;
    if (gameTitle) gameTitle.textContent = `${gameType === 'square' ? 'Kare Kapatma' : 'Yol Çizme'}`;


	// Skor tablosu görünürlüğü
	if (gameType === 'square') {
		scoreboard.classList.remove('hidden');
	} else {
		scoreboard.classList.add('hidden');
	}

	updateStatusText();
	updateScoreDisplay();
	draw(); // Her veri güncellemesinde tuvali yeniden çiz

    // Oyun bittiyse modalı göster
    if(gameState.gameOver && !gameOverModal.classList.contains('hidden')) {
        // Zaten açıksa tekrar gösterme
    } else if (gameState.gameOver) {
        showGameOverScreen();
    } else {
        gameOverModal.classList.add('hidden');
    }
}

// Oyunu sıfırlar ve başlangıç durumunu Firebase'e yazar
function resetGame() {
	if (playerNumber !== 1) {
		return; // Sadece 1. oyuncu (kurucu) oyunu başlatabilir/sıfırlayabilir.
	}

	const initialGameState = {
		status: 'game_started', // Durumu 'oyun başladı' olarak değiştir
		turn: 1,
		edgesList: [],
		squares: Array(N).fill(0).map(() => Array(N).fill(0)),
		player1Score: 0,
		player2Score: 0,
		activeEndpoint: null,
		gameOver: false,
        N: N, // Izgara boyutu da kaydedilir
        gameType: gameType
	};
    
	gameRef.update(initialGameState);
    
    displayRules();
}


// =================================================================
// GÖRSEL GÜNCELLEMELER (ÇİZİM, METİN VB.)
// =================================================================

function updateStatusText() {
    if (!gameState || !gameState.status) {
        statusDiv.textContent = 'Oda durumu bekleniyor...';
        return;
    }

    const players = gameState.players || {};
    const playerKeys = Object.keys(players);
    const playerNames = playerKeys.map(key => players[key].name);
    const p1Name = playerNames[0] || 'Oyuncu 1';
    const p2Name = playerNames[1] || 'Oyuncu 2';

    if(playerKeys.length < 2 && !gameState.gameOver) {
        statusDiv.textContent = 'Rakip bekleniyor...';
        return;
    }
    
    if (gameState.gameOver) {
         statusDiv.textContent = 'Oyun Bitti!';
         return;
    }

    const currentPlayerName = gameState.turn === 1 ? p1Name : p2Name;
    let text = `Sıra: ${currentPlayerName}`;
    if (playerNumber === gameState.turn) {
        text += " (Sıra Sende)";
    }
    statusDiv.textContent = text;
}


function updateScoreDisplay() {
	if (gameType !== 'square') return;
    const players = gameState.players || {};
    const playerKeys = Object.keys(players);
    const playerNames = playerKeys.map(key => players[key].name);
    const p1Name = playerNames[0] || 'Oyuncu 1';
    const p2Name = playerNames[1] || 'Oyuncu 2';

	p1ScoreDisplay.textContent = `${p1Name}: ${gameState.player1Score || 0}`;
	p2ScoreDisplay.textContent = `${p2Name}: ${gameState.player2Score || 0}`;
}

function showGameOverScreen() {
    const players = gameState.players || {};
    const playerKeys = Object.keys(players);
    const playerNames = playerKeys.map(key => players[key].name);
    const p1Name = playerNames[0] || 'Oyuncu 1';
    const p2Name = playerNames[1] || 'Oyuncu 2';
    
    let message = '';
    if (gameType === 'square') {
        const scoreText = `(${gameState.player1Score} - ${gameState.player2Score})`;
        if (gameState.player1Score > gameState.player2Score) message = `${p1Name} Kazandı! ${scoreText}`;
        else if (gameState.player2Score > gameState.player1Score) message = `${p2Name} Kazandı! ${scoreText}`;
        else message = `Oyun Berabere! ${scoreText}`;
    } else {
        const losingPlayer = gameState.losingPlayer;
        const losingPlayerName = losingPlayer === 1 ? p1Name : p2Name;
        const winningPlayerName = losingPlayer === 1 ? p2Name : p1Name;
        message = `${losingPlayerName} Kaybetti! Kazanan: ${winningPlayerName}`;
    }
    gameOverMessage.textContent = message;
    gameOverModal.classList.remove('hidden');
}

function displayRules() {
    rulesModal.classList.remove('hidden');
    if (gameType === 'path') {
        rulesTitle.textContent = "Yol Çizme Oyunu Kuralları";
        rulesContent.innerHTML = `<ul><li>Rakip bekleniyor. Oyun, rakip katıldığında başlayacak.</li><li>Amaç, rakibi hamle yapamaz duruma getirmektir.</li><li>Oyuncular sırayla, en son çizilen çizginin ucundan yeni bir çizgi çeker.</li><li>Çizgiler ızgaranın kenarlarına veya daha önce ziyaret edilmiş bir noktaya değemez.</li><li>Kuralı ihlal eden veya hamle yapamayan oyuncu kaybeder.</li></ul>`;
    } else if (gameType === 'square') {
        rulesTitle.textContent = "Kare Kapatma Oyunu Kuralları";
        rulesContent.innerHTML = `<ul><li>Rakip bekleniyor. Oyun, rakip katıldığında başlayacak.</li><li>Amaç, kareleri kapatarak puan toplamaktır.</li><li>Bir kareyi tamamlayan son çizgiyi çizen oyuncu puan kazanır ve <strong>bir hamle hakkı daha</strong> elde eder.</li><li>Tüm kareler dolduğunda en çok puanı olan kazanır.</li></ul>`;
    }
}

// --- Tüm Çizim Fonksiyonları ---
function draw() {
    if (!canvas || !gameState || typeof gameState.edgesList === 'undefined') {
        const dpr = window.devicePixelRatio || 1;
        const physicalWidth = canvas.width / dpr;
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
        return;
    }

	const dpr = window.devicePixelRatio || 1;
	const physicalWidth = canvas.width / dpr;
	ctx.clearRect(0, 0, physicalWidth, physicalWidth);
	
	// Izgarayı çiz
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

    // Ele geçirilen kareleri çiz
	if (gameType === 'square' && gameState.squares) {
		for (let y = 0; y < N; y++) {
			for (let x = 0; x < N; x++) {
				if (gameState.squares[y][x] !== 0) {
					ctx.fillStyle = gameState.squares[y][x] === 1 ? 'rgba(79, 70, 229, 0.3)' : 'rgba(239, 68, 68, 0.3)';
					ctx.fillRect(x * step, y * step, step, step);
				}
			}
		}
	}

	// Çizgileri çiz
	for (let i = 0; i < gameState.edgesList.length; i++) {
		const e = gameState.edgesList[i];
		const isLastMove = i === gameState.edgesList.length - 1 && !gameState.gameOver;
		
		ctx.beginPath();
		ctx.strokeStyle = e.player === 1 ? '#4f46e5' : '#ef4444';
		ctx.lineWidth = isLastMove ? 7 : 5;
		ctx.moveTo(e.a.x * step, e.a.y * step);
		ctx.lineTo(e.b.x * step, e.b.y * step);
		ctx.stroke();
	}

    // Aktif ucu çiz (Yol Çizme oyunu için)
	if (gameState.activeEndpoint && !gameState.gameOver && gameType === 'path') {
		ctx.beginPath();
		ctx.fillStyle = '#16a34a';
		ctx.arc(gameState.activeEndpoint.x * step, gameState.activeEndpoint.y * step, 6, 0, Math.PI * 2);
		ctx.fill();
	}
}


// =================================================================
// OYUN MANTIĞI VE HAMLE İŞLEME
// =================================================================

// Tuvale tıklandığında tetiklenir
function handleClick(evt) {
	if (gameState.gameOver) return;
	if (Object.keys(gameState.players || {}).length < 2) {
        alert("Rakibin bağlanmasını bekleyin.");
        return;
    }
	if (playerNumber !== gameState.turn) {
		return;
	}

	const rect = canvas.getBoundingClientRect();
	const mx = evt.clientX - rect.left;
	const my = evt.clientY - rect.top;
	const edge = findClickedEdge(mx, my);
	if (!edge) return;
    
	processMove(edge.a, edge.b);
}

// Bir hamleyi işler ve sonucu Firebase'e yazar
function processMove(a, b) {
    let newState = JSON.parse(JSON.stringify(gameState));
    const edgeKey = keyForEdge(a, b);

    const edgeExists = newState.edgesList.some(e => keyForEdge(e.a, e.b) === edgeKey);
    if (edgeExists) {
        return;
    }

    if (gameType === 'square') {
        newState = processSquareMove(newState, a, b);
    } else {
        newState = processPathMove(newState, a, b);
    }

    gameRef.update(newState);
}

// Kare Kapatma oyunu için hamle mantığı
function processSquareMove(state, a, b) {
    state.edgesList.push({ a, b, player: state.turn });
    
    const completedCount = checkCompletedSquares(state, a, b);
    if (completedCount > 0) {
        if (state.turn === 1) state.player1Score += completedCount;
        else state.player2Score += completedCount;
    } else {
        state.turn = state.turn === 1 ? 2 : 1;
    }

    const totalScore = state.player1Score + state.player2Score;
    if (totalScore === N * N) {
        state.gameOver = true;
    }
    return state;
}

// Yol Çizme oyunu için hamle mantığı
function processPathMove(state, a, b) {
    const visitedPoints = new Set();
    state.edgesList.forEach(e => {
        visitedPoints.add(keyForPoint(e.a));
        visitedPoints.add(keyForPoint(e.b));
    });

    // Kural 1: İlk hamle serbest
    if (state.edgesList.length === 0) {
        state.edgesList.push({ a, b, player: state.turn });
        state.turn = 2; // Sıra diğer oyuncuya geçer
        return state;
    }
    
    // Kural 2: İkinci hamle ilk çizgiye bağlanmalı
    if (state.edgesList.length === 1) {
        const firstEdge = state.edgesList[0];
		let sharedPoint = null, newEndpoint = null;
        if (pointEquals(a, firstEdge.a)) { sharedPoint = a; newEndpoint = b; }
		else if (pointEquals(b, firstEdge.a)) { sharedPoint = b; newEndpoint = a; }
		else if (pointEquals(a, firstEdge.b)) { sharedPoint = a; newEndpoint = b; }
		else if (pointEquals(b, firstEdge.b)) { sharedPoint = b; newEndpoint = a; }
        else { 
            alert('İkinci hamle ilk çizgiye bağlı olmalıdır.'); 
            return state; // Geçersiz hamle, durumu değiştirme
        }

        // Kural 3: Kenara veya ziyaret edilmiş noktaya gidemez
        if (isBorderPoint(newEndpoint) || visitedPoints.has(keyForPoint(newEndpoint))) {
            state.gameOver = true;
            state.losingPlayer = state.turn;
        }
        state.edgesList.push({ a, b, player: state.turn });
        state.activeEndpoint = newEndpoint;
        state.turn = 1; // Sıra ilk oyuncuya döner
        
        // Rakibin hamlesi kalmış mı kontrol et
        if(!state.gameOver && getValidPathMoves(state).length === 0) {
            state.gameOver = true;
            state.losingPlayer = state.turn;
        }
        return state;
    }

    // Kural 4: Sonraki hamleler aktif uca bağlanmalı
	let newEndpoint = null;
	if (pointEquals(a, state.activeEndpoint)) { newEndpoint = b; }
	else if (pointEquals(b, state.activeEndpoint)) { newEndpoint = a; }
    else { 
        alert('Sadece aktif uçtan devam edilebilir.'); 
        return state; // Geçersiz hamle
    }

    // Kural 3 (tekrar): Kenara veya ziyaret edilmiş noktaya gidemez
    if (isBorderPoint(newEndpoint) || visitedPoints.has(keyForPoint(newEndpoint))) {
        state.gameOver = true;
        state.losingPlayer = state.turn;
    }
    state.edgesList.push({ a, b, player: state.turn });
    state.activeEndpoint = newEndpoint;
    state.turn = state.turn === 1 ? 2 : 1; // Sırayı değiştir

    // Kural 5: Rakibin hamlesi kalmış mı kontrol et
    if(!state.gameOver && getValidPathMoves(state).length === 0) {
        state.gameOver = true;
        state.losingPlayer = state.turn; // Sıradaki oyuncu hamle yapamayacağı için kaybeder
    }
    return state;
}

function checkCompletedSquares(state, a, b) {
    let completedCount = 0;
    const check = (x, y) => {
        if (x < 0 || x >= N || y < 0 || y >= N) return;
        if (state.squares[y][x] === 0 && countSides(state, x, y) === 4) {
            state.squares[y][x] = state.turn;
            completedCount++;
        }
    };
    if (a.y === b.y) {
        check(a.x, a.y - 1);
        check(a.x, a.y);
    } else {
        check(a.x - 1, a.y);
        check(a.x, a.y);
    }
    return completedCount;
}


// =================================================================
// YARDIMCI FONKSİYONLAR
// =================================================================

function getValidPathMoves(state) {
    if (state.edgesList.length < 1 || !state.activeEndpoint) return []; 
    
    const p = state.activeEndpoint;
    const validMoves = [];
    const neighbors = [
        {x: p.x + 1, y: p.y}, {x: p.x - 1, y: p.y},
        {x: p.x, y: p.y + 1}, {x: p.x, y: p.y - 1}
    ];

    const visitedPoints = new Set();
    state.edgesList.forEach(e => {
        visitedPoints.add(keyForPoint(e.a));
        visitedPoints.add(keyForPoint(e.b));
    });

    const edgesSet = new Set(state.edgesList.map(e => keyForEdge(e.a, e.b)));

    for (const n of neighbors) {
        // Izgara sınırları içinde mi?
        if (n.x >= 0 && n.x <= state.N && n.y >= 0 && n.y <= state.N) {
             const edgeExists = edgesSet.has(keyForEdge(p, n));
             // Kenar daha önce çizilmemiş, bitiş noktası kenarda değil ve daha önce ziyaret edilmemişse geçerlidir.
             if (!edgeExists && !isBorderPoint(n) && !visitedPoints.has(keyForPoint(n))) {
                 validMoves.push({a: p, b: n});
             }
        }
    }
    return validMoves;
}

function keyForEdge(a, b) {
	const s1 = `${a.x},${a.y}`;
	const s2 = `${b.x},${b.y}`;
	return s1 < s2 ? `${s1}-${s2}` : `${s2}-${s1}`;
}

function keyForPoint(p) { return `${p.x},${p.y}`; }
function pointEquals(p1, p2) { return p1.x === p2.x && p1.y === p2.y; }
function isBorderPoint(p) { return p.x === 0 || p.x === N || p.y === 0 || p.y === N; }

function countSides(state, x, y) {
    let count = 0;
    const edgesSet = new Set(state.edgesList.map(e => keyForEdge(e.a, e.b)));
    if (edgesSet.has(keyForEdge({x, y}, {x: x + 1, y}))) count++;
    if (edgesSet.has(keyForEdge({x, y: y + 1}, {x: x + 1, y: y + 1}))) count++;
    if (edgesSet.has(keyForEdge({x, y}, {x, y: y + 1}))) count++;
    if (edgesSet.has(keyForEdge({x: x + 1, y}, {x: x + 1, y: y + 1}))) count++;
    return count;
}

function findClickedEdge(mx, my) {
    let best = null;
	let bestDist = Infinity;
    const threshold = Math.min(20, step * 0.4);
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
	if (bestDist <= threshold) return { a: best[0], b: best[1] };
	return null;
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


// =================================================================
// EVENT LISTENERS
// =================================================================

window.addEventListener('resize', resizeCanvasAndSetStep);
canvas.addEventListener('click', handleClick);
resetBtn.addEventListener('click', () => {
    if(playerNumber === 1) resetGame();
    else alert('Sadece 1. oyuncu oyunu sıfırlayabilir.');
});
playAgainBtn.addEventListener('click', () => {
    if(playerNumber === 1) resetGame();
    else alert('Sadece 1. oyuncu oyunu sıfırlayabilir.');
});
exitBtn.addEventListener('click', () => { window.location.href = 'index.html'; });
closeModalBtn.addEventListener('click', () => { gameOverModal.classList.add('hidden'); });
closeRulesBtn.addEventListener('click', () => { rulesModal.classList.add('hidden'); });

