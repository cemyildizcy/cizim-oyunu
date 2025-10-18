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

// Yeni: single-player ve AI flag'leri
let isSinglePlayer = false;
let aiThinking = false;

// --- Yardımcı: gameState için varsayılanlar ---
function ensureGameStateDefaults() {
	if (!gameState || typeof gameState !== 'object') gameState = {};
	gameState.status = gameState.status || 'waiting';
	gameState.turn = (typeof gameState.turn === 'number') ? gameState.turn : 1;
	gameState.edgesList = Array.isArray(gameState.edgesList) ? gameState.edgesList : [];
	gameState.squares = Array.isArray(gameState.squares) ? gameState.squares : Array(N).fill(0).map(()=>Array(N).fill(0));
	gameState.player1Score = gameState.player1Score || 0;
	gameState.player2Score = gameState.player2Score || 0;
	gameState.activeEndpoint = gameState.activeEndpoint || null;
	gameState.gameOver = !!gameState.gameOver;
	gameState.N = gameState.N || N;
	gameState.gameType = gameState.gameType || gameType;
	gameState.players = gameState.players || {};
}

// =================================================================
// OYUNUN BAŞLATILMASI VE KURULUMU
// =================================================================

// Sayfa yüklendiğinde URL'den oyun parametrelerini al
(function initGameFromUrl() {
	const params = new URLSearchParams(window.location.search);
	const s = parseInt(params.get('size'));
	if (s && s >= 3 && s <= 20) N = s;

	myName = params.get('p1') || myName;
	gameType = params.get('type') || gameType;
	onlineRoom = params.get('room') || null;

	// Yeni: mode param ('single' veya 'local'), default local
	const mode = params.get('mode') || 'local';
	// Eğer explicit mode yoksa p2 adı "bilgisayar" ise de single kabul et
	const p2FromUrl = (params.get('p2') || '').toLowerCase();
	isSinglePlayer = (mode === 'single') || p2FromUrl.includes('bilgisayar');

	if (gridSizeDisplay) gridSizeDisplay.textContent = `${N} × ${N} Kare`;
	if (footerInfo) footerInfo.textContent = onlineRoom ? `Oda Kodu: ${onlineRoom}` : '';

	if (gameTitle) {
		gameTitle.textContent = `${gameType === 'square' ? 'Kare Kapatma' : 'Yol Çizme'}`;
	}

	// Her durumda ızgarayı hemen göster
	resizeCanvasAndSetStep();

	// Eğer kare kapatma modunda gelindiyse kuralları göster (kullanıcı görsün)
	if (gameType === 'square') {
		displayRules();
	}

	// Eğer onlineRoom varsa Firebase bağlantısını kur
	if (onlineRoom && typeof database !== 'undefined' && database) {
		setupFirebaseConnection();
	} else {
		// Offline fallback: oluşturulmuş local state ile bekle
		const p2NameFromUrl = params.get('p2') || (isSinglePlayer ? 'Bilgisayar' : 'Oyuncu 2');
		gameState = {
			status: 'local',
			turn: 1,
			edgesList: [],
			squares: Array(N).fill(0).map(()=>Array(N).fill(0)),
			player1Score: 0,
			player2Score: 0,
			activeEndpoint: null,
			gameOver: false,
			N: N,
			gameType: gameType,
			players: { p1: { name: myName }, p2: { name: p2NameFromUrl } }
		};
		// Local client davranışı:
		// - Tek kişilik: bu istemci Oyuncu 1 (AI Oyuncu 2)
		// - Aynı cihaz: her iki oyuncu aynı cihazdan tıklayabilir -> playerNumber null yap
		// Local client is player 1
		playerNumber = isSinglePlayer ? 1 : null;
		ensureGameStateDefaults();
		updateStatusText();
		draw();
	}
})();

// Firebase kurulum fonksiyonu (mevcut online akışı bozulmasın diye aynı şekilde bırakıldı)
function setupFirebaseConnection() {
	if (!onlineRoom) return;
	gameRef = database.ref('games/' + onlineRoom);
	playersRef = database.ref('games/' + onlineRoom + '/players');

	myPlayerRef = playersRef.push({ name: myName });
	myPlayerRef.onDisconnect().remove();

	playersRef.on('value', (snapshot) => {
		const players = snapshot.val() || {};
		// Sunucudan gelen oyuncu listesini gameState'e koy ve UI'ı güncelle
		gameState.players = players;
		ensureGameStateDefaults();
		// Belirle: bu istemcinin oyuncu sırası (1 veya 2)
		const playerKeys = Object.keys(players);
		const myKey = myPlayerRef && myPlayerRef.key;
		const myIndex = myKey ? playerKeys.findIndex(k => k === myKey) : -1;
		if (myIndex !== -1) playerNumber = myIndex + 1;
		// Güncellenmiş oyuncu bilgisiyle UI ve çizimi yenile
		updateLocalStateFromServer();
		// Eğer oda sahibi (1) ise ve oyun başlamadıysa başlat
		if (playerNumber === 1 && !gameState.status) resetGame();
	});

	gameRef.on('value', (snapshot) => {
		const newState = snapshot.val();
		if (newState) {
			gameState = newState;
			ensureGameStateDefaults();
			// Eğer sunucudan N farklı geldiyse tuvali güncelle
			if (gameState.N && gameState.N !== N) {
				N = gameState.N;
				resizeCanvasAndSetStep();
			}
			updateLocalStateFromServer();
		}
	});
}

// updateLocalStateFromServer: güvenli güncelleme + UI
function updateLocalStateFromServer() {
	ensureGameStateDefaults();
	gameType = gameState.gameType || gameType;
	if (gridSizeDisplay) gridSizeDisplay.textContent = `${N} × ${N} Kare`;
	if (gameTitle) gameTitle.textContent = `${gameType === 'square' ? 'Kare Kapatma' : 'Yol Çizme'}`;

	if (gameType === 'square') scoreboard.classList.remove('hidden'); else scoreboard.classList.add('hidden');

	// Eğer serverdan gelen squares matrisi N ile uyumlu değilse yeniden boyutlandır
	if (!Array.isArray(gameState.squares) || gameState.squares.length !== N) {
		const newSquares = Array(N).fill(0).map(() => Array(N).fill(0));
		if (Array.isArray(gameState.squares)) {
			// var olan değerleri kopyala (sığ mümkünse)
			for (let y = 0; y < Math.min(gameState.squares.length, N); y++) {
				for (let x = 0; x < Math.min(gameState.squares[y].length || 0, N); x++) {
					newSquares[y][x] = gameState.squares[y][x] || 0;
				}
			}
		}
		gameState.squares = newSquares;
	}

	updateStatusText();
	updateScoreDisplay();
	draw();

	// Zamanlayıcı yönetimi: eğer oyun bitti temizle
	if (gameState.gameOver) {
		clearTurnTimer();
		showGameOverScreen();
	} else {
		// Eğer bu istemcinin sırasıysa ve ilk hamle yapılmışsa başlat
		if (typeof playerNumber !== 'undefined' && playerNumber === gameState.turn) {
			if (Array.isArray(gameState.edgesList) && gameState.edgesList.length > 0) startTurnTimer();
			else clearTurnTimer();
		} else {
			clearTurnTimer();
		}
		// Yeni: eğer single-player moddaysak ve AI sırasıysa AI'yi planla (küçük gecikmeyle)
		if (!onlineRoom && isSinglePlayer) {
			setTimeout(() => {
				if (gameState && gameState.turn === 2) scheduleAIMoveIfNeeded();
			}, 60);
		}
		gameOverModal.classList.add('hidden');
	}
}

// oyunu sıfırlar ve başlangıç durumunu Firebase'e yazar
function resetGame() {
	if (playerNumber !== 1) return;
	const initialGameState = {
		status: 'game_started',
		turn: 1,
		edgesList: [],
		squares: Array(N).fill(0).map(()=>Array(N).fill(0)),
		player1Score: 0,
		player2Score: 0,
		activeEndpoint: null,
		gameOver: false,
		N: N,
		gameType: gameType
	};
	if (gameRef) gameRef.update(initialGameState);
	else { gameState = initialGameState; ensureGameStateDefaults(); updateLocalStateFromServer(); }
	displayRules();
}

// =================================================================
// GÖRSEL GÜNCELLEMELER (ÇİZİM, METİN VB.)
// =================================================================

function updateStatusText() {
	ensureGameStateDefaults();
	const players = gameState.players || {};

	// Tercihen p1/p2 anahtarlarını kullan, yoksa keys sırasına göre al
	const p1Name = (players.p1 && players.p1.name) || (Object.keys(players)[0] && players[Object.keys(players)[0]] && players[Object.keys(players)[0]].name) || 'Oyuncu 1';
	const p2Name = (players.p2 && players.p2.name) || (Object.keys(players)[1] && players[Object.keys(players)[1]] && players[Object.keys(players)[1]].name) || 'Oyuncu 2';

	const keys = Object.keys(players);
	if (keys.length < 2 && !gameState.gameOver) { statusDiv.textContent = 'Rakip bekleniyor...'; return; }
	if (gameState.gameOver) { statusDiv.textContent = 'Oyun Bitti!'; return; }
	const current = gameState.turn === 1 ? p1Name : p2Name;
	let text = `Sıra: ${current}`;
	// Eğer local aynı cihaz modunda playerNumber null ise her iki oyuncuya izin ver => (Sıra Sende) sadece tek-kullanıcı modunda göster
	if (playerNumber && playerNumber === gameState.turn) text += ' (Sıra Sende)';
	statusDiv.textContent = text;
}

function updateScoreDisplay() {
	if (gameType !== 'square') return;
	const players = gameState.players || {};
	const names = Object.keys(players).map(k => players[k].name);
	p1ScoreDisplay.textContent = `${names[0] || 'Oyuncu 1'}: ${gameState.player1Score || 0}`;
	p2ScoreDisplay.textContent = `${names[1] || 'Oyuncu 2'}: ${gameState.player2Score || 0}`;
}

function showGameOverScreen() {
	ensureGameStateDefaults();
	clearTurnTimer();
	const players = gameState.players || {};
	const names = Object.keys(players).map(k => players[k].name);
	const p1 = names[0] || 'Oyuncu 1', p2 = names[1] || 'Oyuncu 2';
	let message = '';
	if (gameType === 'square') {
		const scoreText = `(${gameState.player1Score} - ${gameState.player2Score})`;
		if (gameState.player1Score > gameState.player2Score) message = `${p1} Kazandı! ${scoreText}`;
		else if (gameState.player2Score > gameState.player1Score) message = `${p2} Kazandı! ${scoreText}`;
		else message = `Oyun Berabere! ${scoreText}`;
	} else {
		const losing = gameState.losingPlayer;
		const lname = losing === 1 ? p1 : p2;
		const wname = losing === 1 ? p2 : p1;
		message = `${lname} Kaybetti! Kazanan: ${wname}`;
	}
	gameOverMessage.textContent = message;
	gameOverModal.classList.remove('hidden');
}

function displayRules() {
    rulesModal.classList.remove('hidden');
    if (gameType === 'path') {
        rulesTitle.textContent = "Yol Çizme Oyunu Kuralları";
        rulesContent.innerHTML = `<ul>
            <li>İlk hamle serbesttir.</li>
            <li>İkinci hamle ilk çizginin bir ucuna bağlı olmak zorundadır.</li>
            <li>Sonraki hamleler, aktif uçtan devam eder.</li>
            <li>Aktif uç sınır veya daha önce ziyaret edilmiş noktaya götürürse o oyuncu kaybeder.</li>
        </ul>`;
    } else if (gameType === 'square') {
        rulesTitle.textContent = "Kare Kapatma — Kurallar (Detaylı)";
        rulesContent.innerHTML = `
            <div class="rules-text">
                <h3>Genel</h3>
                <ul>
                    <li>Oyun N×N kare ızgarasında oynanır. Noktalar ızgara köşeleridir, kenarlar kare kenarlarıdır.</li>
                    <li>Amaç: Kareleri tamamlayarak daha fazla puan toplamak.</li>
                </ul>

                <h3>Başlangıç</h3>
                <ul>
                    <li>Oyuncular sırayla bir boş kenar çizer. Odayı oluşturan (ilk oyuncu) genellikle oyunu başlatır.</li>
                    <li>Her kare 4 kenardan oluşur; bir oyuncu son kenarı çizdiğinde o kareyi kazanır.</li>
                </ul>

                <h3>Hamle Kuralları</h3>
                <ul>
                    <li>Her hamlede bir kenar (iki nokta arasında) çizilir. Aynı kenarı ikinci kez çizmek geçersizdir.</li>
                    <li>Bir hamle bir veya birden fazla kare tamamlayabilir. Tamamlanan her kare o oyuncunun puanına eklenir.</li>
                    <li>Kare tamamlayan oyuncu hemen <strong>bir hamle daha</strong> yapar — yani sıra ona kalır.</li>
                    <li>Eğer hamle hiç kare tamamlamıyorsa sıra diğer oyuncuya geçer.</li>
                </ul>

                <h3>Puanlama ve Oyun Sonu</h3>
                <ul>
                    <li>Her tamamlanan kare 1 puandır (çoklu kare tamamlanırsa her biri ayrı puandır).</li>
                    <li>Tüm kareler kapatıldığında oyun biter. En çok puana sahip oyuncu kazanır.</li>
                    <li>Eşit puan durumunda oyun beraberlikle sonuçlanır.</li>
                </ul>

                <h3>Geçersiz Hamle ve Zaman Aşımı</h3>
                <ul>
                    <li>Aynı kenarın yeniden çizilmesi geçersizdir ve reddedilir.</li>
                    <li>Çevrimiçi oyunda süre limiti (örn. 5s) varsa süre dolduğunda sistem rastgele geçerli bir kenar çizebilir veya hamle yapan oyuncu için tanımlı davranışı (kaybetme ya da otomatik hamle) uygulayabilir.</li>
                </ul>

                <h3>Örnek</h3>
                <pre style="color:var(--muted);background:transparent;padding:6px;border-radius:6px;">
Nokta düzeni (küçük örnek, X işaretli kenar çizilmiş):
•—•   •
| X   |
•   —•
Bir oyuncu kalan kenarı çizerek kareyi tamamladığında o kare onun olur ve tekrar oynar.
                </pre>

                <h3>Strateji Notları</h3>
                <ul>
                    <li>Genel strateji: Rakibe "3 kenarlı kare" vermekten kaçının — 3 kenarı olan kare rakibin o kareyi tamamlamasını sağlar.</li>
                    <li>Genellikle güvenli hamlelerle ilerleyin; rakibe çoklu kare verme riskini hesaplayın.</li>
                    <li>Son aşamada birden fazla kareyi art arda almak mümkün olabilir; bu durumda toplu puan farkı yaratabilirsiniz.</li>
                </ul>

                <h3>Çevrimiçi Davranış</h3>
                <ul>
                    <li>Hamleler sunucuya gönderilir, sunucu doğrular ve tüm oyunculara yayınlar — bu, senkronizasyonu sağlar.</li>
                    <li>Odayı oluşturan oyuncu oyuncu 1'dir; yalnızca oyuncu 1 oyunu sıfırlayabilir.</li>
                    <li>Rakip ayrılırsa karşı tarafa bildirim gider; anlık senkronizasyon koparsa otomatik yeniden bağlanma veya odadan ayrılma mantığı uygulanır.</li>
                </ul>

                <p style="color:var(--muted);margin-top:8px">Kısaca: Her kareyi tamamlayan oyuncu puan alır ve ekstra hamle yapar; tüm kareler kapandığında en çok puan alan kazanır. Oyun süresince aynı kenarı yeniden çizemezsin ve strateji olarak "3 kenarlı kare" tuzaklarına dikkat etmelisin.</p>
            </div>
        `;
    }
}

// --- Tüm Çizim Fonksiyonları ---
function draw() {
	if (!canvas) return;
	ensureGameStateDefaults();
	const dpr = window.devicePixelRatio || 1;
	const physicalWidth = canvas.width / dpr;
	ctx.clearRect(0,0,physicalWidth,physicalWidth);

	ctx.strokeStyle = '#e6eef6'; ctx.lineWidth = 1;
	for (let i=0;i<=N;i++){
		ctx.beginPath(); ctx.moveTo(0,i*step); ctx.lineTo(physicalWidth,i*step); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(i*step,0); ctx.lineTo(i*step,physicalWidth); ctx.stroke();
	}
	ctx.fillStyle='#7b93a7';
	for (let i=0;i<=N;i++) for (let j=0;j<=N;j++){ ctx.beginPath(); ctx.arc(i*step,j*step,2,0,Math.PI*2); ctx.fill(); }

	// güvenli erişim
	const edges = Array.isArray(gameState.edgesList) ? gameState.edgesList : [];
	const squares = Array.isArray(gameState.squares) ? gameState.squares : Array(N).fill(0).map(()=>Array(N).fill(0));
	const activeEP = gameState.activeEndpoint || null;
	const gameOverLocal = !!gameState.gameOver;

	if (gameType === 'square') {
		for (let y=0;y<N;y++) for (let x=0;x<N;x++){
			if (squares[y][x] !== 0) {
				ctx.fillStyle = squares[y][x] === 1 ? 'rgba(79,70,229,0.3)' : 'rgba(239,68,68,0.3)';
				ctx.fillRect(x*step, y*step, step, step);
			}
		}
	}

	for (let i=0;i<edges.length;i++){
		const e = edges[i];
		const isLast = i===edges.length-1 && !gameOverLocal;
		ctx.beginPath();
		ctx.strokeStyle = (e.player===1) ? '#4f46e5' : '#ef4444';
		ctx.lineWidth = isLast?7:5;
		ctx.moveTo(e.a.x*step, e.a.y*step);
		ctx.lineTo(e.b.x*step, e.b.y*step);
		ctx.stroke();
	}

	if (activeEP && !gameOverLocal && gameType==='path') {
		ctx.beginPath(); ctx.fillStyle='#16a34a'; ctx.arc(activeEP.x*step, activeEP.y*step, 6,0,Math.PI*2); ctx.fill();
	}
}


// =================================================================
// OYUN MANTIĞI VE HAMLE İŞLEME
// =================================================================

// Tuvale tıklandığında tetiklenir
function handleClick(evt) {
	ensureGameStateDefaults();
	if (gameState.gameOver) return;
	const playersCount = Object.keys(gameState.players || {}).length;
	if (playersCount < 2 && gameState.status!=='local') { alert('Rakipin bağlanmasını bekleyin.'); return; }
	if (playerNumber && playerNumber !== gameState.turn) return;

	const rect = canvas.getBoundingClientRect();
	const mx = evt.clientX - rect.left, my = evt.clientY - rect.top;
	const edge = findClickedEdge(mx, my);
	if (!edge) return;

	processMove(edge.a, edge.b);
}

// processMove: newState oluştur, validator, sonra gameRef.update veya local apply
function processMove(a,b){
	ensureGameStateDefaults();
	const newState = JSON.parse(JSON.stringify(gameState));
	const edgeKey = keyForEdge(a,b);
	if ((newState.edgesList||[]).some(e=>keyForEdge(e.a,e.b)===edgeKey)) return;

	// apply rules
	if (gameType === 'square') {
		applySquareMove(newState,a,b);
	} else {
		applyPathMove(newState,a,b);
	}

	// push to server if possible, else locally
	if (gameRef) {
		try { gameRef.update(newState); }
		catch(e){ console.error(e); gameState = newState; updateLocalStateFromServer(); }
	} else {
		gameState = newState;
		updateLocalStateFromServer();
		// Eğer single-player ve AI sırası geldiyse ufak gecikmeyle planla (updateLocalStateFromServer bitmesini beklemek için)
		if (isSinglePlayer) {
			setTimeout(() => {
				if (gameState && gameState.turn === 2) scheduleAIMoveIfNeeded();
			}, 60);
		}
	}
}

// Kare move uygulayıcı
function applySquareMove(state,a,b){
	state.edgesList.push({a,b,player:state.turn});
	const completed = checkCompletedSquares(state,a,b);
	if (completed>0){
		if (state.turn===1) state.player1Score += completed; else state.player2Score += completed;
	} else {
		state.turn = state.turn===1 ? 2 : 1;
	}
	const total = (state.player1Score||0) + (state.player2Score||0);
	if (total === N*N) state.gameOver = true;
}

// Path move uygulayıcı (daha sağlam)
function applyPathMove(state,a,b){
	const visited = new Set();
	(state.edgesList||[]).forEach(e=>{ visited.add(keyForPoint(e.a)); visited.add(keyForPoint(e.b)); });

	if ((state.edgesList||[]).length===0){
		state.edgesList.push({a,b,player:state.turn});
		state.turn = 2;
		return;
	}
	if ((state.edgesList||[]).length===1){
		const first = state.edgesList[0];
		let shared=null, other=null;
		if (pointEquals(a,first.a)){ shared=a; other=b; }
		else if (pointEquals(b,first.a)){ shared=b; other=a; }
		else if (pointEquals(a,first.b)){ shared=a; other=b; }
		else if (pointEquals(b,first.b)){ shared=b; other=a; }
		else return; // invalid

		if (isBorderPoint(other) || visited.has(keyForPoint(other))){
			state.edgesList.push({a,b,player:state.turn});
			state.gameOver = true; state.losingPlayer = state.turn; return;
		}
		state.edgesList.push({a,b,player:state.turn});
		state.activeEndpoint = other;
		state.turn = 1;
		// rakibin hamlesi var mı
		if (!state.gameOver && getValidPathMoves(state).length===0){
			state.gameOver = true; state.losingPlayer = state.turn;
		}
		return;
	}
	// subsequent moves
	let other=null;
	if (pointEquals(a,state.activeEndpoint)) other=b;
	else if (pointEquals(b,state.activeEndpoint)) other=a;
	else return;
	if (isBorderPoint(other) || visited.has(keyForPoint(other))){
		state.edgesList.push({a,b,player:state.turn});
		state.gameOver = true; state.losingPlayer = state.turn; return;
	}
	state.edgesList.push({a,b,player:state.turn});
	state.activeEndpoint = other;
	state.turn = state.turn===1 ? 2 : 1;
	if (!state.gameOver && getValidPathMoves(state).length===0){
		state.gameOver = true; state.losingPlayer = state.turn;
	}
}

// getValidPathMoves gibi yardımcılar (aynı mantık)
function getValidPathMoves(state){
	if (!state || !state.activeEndpoint) return [];
	if (!Array.isArray(state.edgesList)) return [];
	const p = state.activeEndpoint;
	const visited = new Set(); state.edgesList.forEach(e=>{ visited.add(keyForPoint(e.a)); visited.add(keyForPoint(e.b)); });
	const edgesSet = new Set(state.edgesList.map(e=>keyForEdge(e.a,e.b)));
	const neighbors = [{x:p.x+1,y:p.y},{x:p.x-1,y:p.y},{x:p.x,y:p.y+1},{x:p.x,y:p.y-1}];
	const moves = [];
	for (const n of neighbors){
		if (n.x<0||n.x>state.N||n.y<0||n.y>state.N) continue;
		const k = keyForEdge(p,n);
		if (!edgesSet.has(k) && !isBorderPoint(n) && !visited.has(keyForPoint(n))) moves.push({a:p,b:n});
	}
	return moves;
}

// Diğer yardımcılar
function keyForEdge(a,b){ const s1=`${a.x},${a.y}`, s2=`${b.x},${b.y}`; return s1<s2?`${s1}-${s2}`:`${s2}-${s1}`; }
function keyForPoint(p){ return `${p.x},${p.y}`; }
function pointEquals(p1,p2){ return p1.x===p2.x && p1.y===p2.y; }
function isBorderPoint(p){ return p.x===0||p.x===N||p.y===0||p.y===N; }
function countSides(state,x,y){
	let count=0; const edges = new Set((state.edgesList||[]).map(e=>keyForEdge(e.a,e.b)));
	if (edges.has(keyForEdge({x,y},{x:x+1,y}))) count++;
	if (edges.has(keyForEdge({x,y: y+1},{x:x+1,y: y+1}))) count++;
	if (edges.has(keyForEdge({x,y},{x,y: y+1}))) count++;
	if (edges.has(keyForEdge({x: x+1,y},{x: x+1,y: y+1}))) count++;
	return count;
}

function findClickedEdge(mx,my){
	let best=null,bestDist=Infinity; const threshold=Math.min(20,step*0.4);
	for (let i=0;i<=N;i++) for (let j=0;j<=N;j++){
		if (i<N){ const d=distPointToSegment(mx,my,i*step,j*step,(i+1)*step,j*step); if (d<bestDist){ best=[{x:i,y:j},{x:i+1,y:j}]; bestDist=d; } }
		if (j<N){ const d=distPointToSegment(mx,my,i*step,j*step,i*step,(j+1)*step); if (d<bestDist){ best=[{x:i,y:j},{x:i,y:j+1}]; bestDist=d; } }
	}
	return bestDist<=threshold ? {a:best[0],b:best[1]} : null;
}
function distPointToSegment(px,py,x1,y1,x2,y2){
	const A=px-x1, B=py-y1, C=x2-x1, D=y2-y1; const dot=A*C+B*D; const len_sq=C*C+D*D;
	let param=-1; if (len_sq!==0) param = dot/len_sq;
	let xx,yy; if (param<0){xx=x1;yy=y1;} else if (param>1){xx=x2;yy=y2;} else {xx=x1+param*C;yy=y1+param*D;}
	const dx=px-xx, dy=py-yy; return Math.sqrt(dx*dx+dy*dy);
}

function resizeCanvasAndSetStep(){
	const margin=80; const maxSize=Math.min(window.innerWidth-margin, window.innerHeight-margin-80,1000);
	const sizePx = Math.max(200, maxSize); const dpr=window.devicePixelRatio||1;
	canvas.style.width = sizePx+'px'; canvas.style.height = sizePx+'px';
	canvas.width = Math.floor(sizePx*dpr); canvas.height = Math.floor(sizePx*dpr);
	ctx.setTransform(dpr,0,0,dpr,0,0); step = sizePx / N; draw();
}

// Event listeners
window.addEventListener('resize', resizeCanvasAndSetStep);
canvas.addEventListener('click', handleClick);
resetBtn.addEventListener('click', ()=>{ if (playerNumber===1) resetGame(); else alert('Sadece 1. oyuncu sıfırlayabilir'); });
playAgainBtn.addEventListener('click', ()=>{ if (playerNumber===1) resetGame(); else alert('Sadece 1. oyuncu sıfırlayabilir'); });
exitBtn.addEventListener('click', ()=>{ window.location.href='index.html'; });
closeModalBtn.addEventListener('click', ()=>{ gameOverModal.classList.add('hidden'); });
closeRulesBtn.addEventListener('click', ()=>{ rulesModal.classList.add('hidden'); });

// İlk boyutlandırma
resizeCanvasAndSetStep();

// --- Yeni eklenen fonksiyon: checkCompletedSquares ---
// filepath: c:\Users\cemyi\Desktop\oyunproje\game.js
function checkCompletedSquares(state, p1, p2) {
	let completedCount = 0;
	// use min coords to be robust regardless of edge orientation
	const x = Math.min(p1.x, p2.x);
	const y = Math.min(p1.y, p2.y);

	// helper to test and claim a square at (sx, sy)
	function tryClaim(sx, sy) {
		if (sx < 0 || sx >= N || sy < 0 || sy >= N) return;
		if (!Array.isArray(state.squares) || !Array.isArray(state.squares[sy])) return;
		if (state.squares[sy][sx] !== 0) return;
		if (countSides(state, sx, sy) === 4) {
			state.squares[sy][sx] = state.turn;
			completedCount++;
		}
	}

	// If edge is horizontal (same y), it can affect square above (y-1) and below (y)
	if (p1.y === p2.y) {
		tryClaim(x, y - 1); // square above the horizontal edge
		tryClaim(x, y);     // square below the horizontal edge
	}
	// vertical edge (same x): affects left (x-1) and right (x)
	else if (p1.x === p2.x) {
		tryClaim(x - 1, y); // square left of the vertical edge
		tryClaim(x, y);     // square right of the vertical edge
	}
	return completedCount;
}

// Yeni: zamanlayıcı değişkenleri
let turnTimer = null;
let countdownInterval = null;
let timeLeft = 0;

function clearTurnTimer() {
	// Cancel any existing timers and clear UI timer text
	if (turnTimer) { clearTimeout(turnTimer); turnTimer = null; }
	if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
	// Yeniden yaz (status'ı eski haline döndür)
	updateStatusText();
}

function startTurnTimer() {
	clearTurnTimer();
	// Eğer oyun bitti ise başlama
	if (gameState.gameOver) return;
	// Local modda (aynı cihaz) her iki oyuncu için timer başlatılır
	if (playerNumber === null) {
		// İlk hamle için zamanlayıcı başlatma kuralı: edgesList.length === 0 ise timer yok
		if (!Array.isArray(gameState.edgesList) || gameState.edgesList.length === 0) return;
		timeLeft = (gameState.gameType === 'square') ? 5 : 3;
		countdownInterval = setInterval(() => {
			timeLeft--;
			if (timeLeft <= 0) {
				timeLeft = 0;
				clearInterval(countdownInterval); countdownInterval = null;
			}
			updateStatusTextWithTimer();
		}, 1000);
		turnTimer = setTimeout(() => {
			clearTurnTimer();
			if (gameState.gameOver) return;
			ensureGameStateDefaults();
			// Sırası gelen oyuncu için otomatik hamle
			const move = (gameState.gameType === 'square')
				? pickRandomSquareMove(gameState)
				: pickRandomPathMove(gameState);
			if (move) processMove(move.a, move.b);
		}, timeLeft * 1000);
		return;
	}
	// Tek kişilik veya online modda sadece kendi sırası için timer başlatılır
	if (typeof playerNumber === 'undefined' || playerNumber !== gameState.turn) return;
	if (!Array.isArray(gameState.edgesList) || gameState.edgesList.length === 0) return;
	timeLeft = (gameState.gameType === 'square') ? 5 : 3;
	countdownInterval = setInterval(() => {
		timeLeft--;
		if (timeLeft <= 0) {
			timeLeft = 0;
			clearInterval(countdownInterval); countdownInterval = null;
		}
		updateStatusTextWithTimer();
	}, 1000);
	turnTimer = setTimeout(() => {
		clearTurnTimer();
		if (gameState.gameOver) return;
		ensureGameStateDefaults();
		if (gameState.gameType === 'square') {
			const move = pickRandomSquareMove(gameState);
			if (move) processMove(move.a, move.b);
		} else {
			const move = pickRandomPathMove(gameState);
			if (move) processMove(move.a, move.b);
		}
	}, timeLeft * 1000);
}

function updateStatusTextWithTimer() {
	updateStatusText();
	// Local modda timer her iki oyuncu için gösterilmeli
	if ((playerNumber === null || playerNumber === gameState.turn) && turnTimer) {
		statusDiv.textContent = statusDiv.textContent + ` (Kalan süre: ${timeLeft}s)`;
	}
}

// Yardımcı: tüm boş kenarları döndür
function getAllUndrawnEdges(state) {
	const edgesSet = new Set((state.edgesList || []).map(e => keyForEdge(e.a, e.b)));
	const list = [];
	for (let y = 0; y <= state.N; y++) {
		for (let x = 0; x <= state.N; x++) {
			// horizontal
			if (x < state.N) {
				const a = { x, y }, b = { x: x + 1, y };
				if (!edgesSet.has(keyForEdge(a, b))) list.push({ a, b });
			}
			// vertical
			if (y < state.N) {
				const a = { x, y }, b = { x, y: y + 1 };
				if (!edgesSet.has(keyForEdge(a, b))) list.push({ a, b });
			}
		}
	}
	return list;
}

// Yardımcı: state'den kenar seti oluştur
function edgesSetFromState(state) {
	const s = new Set();
	(state.edgesList || []).forEach(e => s.add(keyForEdge(e.a, e.b)));
	return s;
}

// countSides benzeri ama geçici kenar seti ile çalışır
function countSidesWithSet(edgesSet, sx, sy) {
	let c = 0;
	if (edgesSet.has(keyForEdge({ x: sx, y: sy }, { x: sx + 1, y: sy }))) c++;
	if (edgesSet.has(keyForEdge({ x: sx, y: sy + 1 }, { x: sx + 1, y: sy + 1 }))) c++;
	if (edgesSet.has(keyForEdge({ x: sx, y: sy }, { x: sx, y: sy + 1 }))) c++;
	if (edgesSet.has(keyForEdge({ x: sx + 1, y: sy }, { x: sx + 1, y: sy + 1 }))) c++;
	return c;
}

// Verilen kenarın eklenmesiyle hangi karelerin tamamlanacağını say
function completesSquaresWithSet(edgesSet, a, b, stateN) {
	let completed = 0;
	const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
	function check(sx, sy) {
		if (sx < 0 || sx >= stateN || sy < 0 || sy >= stateN) return;
		if (countSidesWithSet(edgesSet, sx, sy) === 4) completed++;
	}
	if (a.y === b.y) { check(x, y - 1); check(x, y); }
	else if (a.x === b.x) { check(x - 1, y); check(x, y); }
	return completed;
}

// Verilen kenarın eklenmesiyle oluşturacağı "3 kenarlı kare" var mı?
function createsThirdWithSet(edgesSet, a, b, stateN) {
	const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
	function check3(sx, sy) {
		if (sx < 0 || sx >= stateN || sy < 0 || sy >= stateN) return false;
		return countSidesWithSet(edgesSet, sx, sy) === 3;
	}
	if (a.y === b.y) { if (check3(x, y - 1)) return true; if (check3(x, y)) return true; }
	else if (a.x === b.x) { if (check3(x - 1, y)) return true; if (check3(x, y)) return true; }
	return false;
}

// Yeni akıllı seçim: Kare kapatma modu
function pickRandomSquareMove(state) {
	const all = getAllUndrawnEdges(state);
	if (all.length === 0) return null;

	const edgesSet = edgesSetFromState(state);
	const winning = [], safe = [], risky = [];

	for (const e of all) {
		// simulate
		const tmp = new Set(edgesSet);
		tmp.add(keyForEdge(e.a, e.b));
		const completed = completesSquaresWithSet(tmp, e.a, e.b, state.N);
		if (completed > 0) { winning.push(e); continue; }

		// oluşturacağı 3 kenarlı kare var mı?
		if (createsThirdWithSet(tmp, e.a, e.b, state.N)) risky.push(e);
		else safe.push(e);
	}

	if (winning.length > 0) return winning[Math.floor(Math.random() * winning.length)];
	if (safe.length > 0) return safe[Math.floor(Math.random() * safe.length)];
	return risky[Math.floor(Math.random() * risky.length)];
}

// Yeni akıllı seçim: Yol çizme modu (fallback ile güncellendi)
function pickRandomPathMove(state) {
	// İlk hamle: herhangi bir kenar
	if (!Array.isArray(state.edgesList) || state.edgesList.length === 0) {
		return pickRandomSquareMove(state);
	}

	const edgesSet = edgesSetFromState(state);
	const visited = new Set();
	(state.edgesList || []).forEach(e => { visited.add(keyForPoint(e.a)); visited.add(keyForPoint(e.b)); });

	let candidates = [];

	// İkinci hamle: ilk kenara bağlı olmalı
	if (state.edgesList.length === 1) {
		const first = state.edgesList[0];
		const all = getAllUndrawnEdges(state);
		for (const edge of all) {
			if (pointEquals(edge.a, first.a) || pointEquals(edge.a, first.b) || pointEquals(edge.b, first.a) || pointEquals(edge.b, first.b)) {
				candidates.push(edge);
			}
		}
	} else {
		// Sonraki hamleler: aktif uçtan bağlanmalı
		const p = state.activeEndpoint;
		if (!p) {
			// fallback: herhangi bir boş kenar
			return pickRandomSquareMove(state);
		}
		const neighbors = [
			{ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y },
			{ x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }
		];
		for (const n of neighbors) {
			if (n.x >= 0 && n.x <= state.N && n.y >= 0 && n.y <= state.N) {
				const key = keyForEdge(p, n);
				if (!edgesSet.has(key)) candidates.push({ a: p, b: n });
			}
		}
	}

	// Eğer aday yoksa fallback: tüm boş kenarlardan en azından birini döndür
	if (candidates.length === 0) {
		const all = getAllUndrawnEdges(state);
		if (all.length === 0) return null;
		return all[Math.floor(Math.random() * all.length)];
	}

	// Ayır: hemen kaybettirenler ve güvenli olanlar
	const safeMoves = [], losingMoves = [];
	for (const m of candidates) {
		// other endpoint
		let other = null;
		if (pointEquals(m.a, state.activeEndpoint)) other = m.b;
		else if (pointEquals(m.b, state.activeEndpoint)) other = m.a;
		else if (state.edgesList.length === 1) {
			const first = state.edgesList[0];
			if (pointEquals(m.a, first.a) || pointEquals(m.a, first.b)) other = m.b;
			else other = m.a;
		}

		if (!other) continue;

		if (isBorderPoint(other) || visited.has(keyForPoint(other))) {
			losingMoves.push(m);
			continue;
		}

		const tmpEdges = new Set(edgesSet);
		tmpEdges.add(keyForEdge(m.a, m.b));
		const newActive = other;
		const tmpVisited = new Set(visited);
		tmpVisited.add(keyForPoint(newActive));

		let opponentMoves = 0;
		const nbs = [
			{ x: newActive.x + 1, y: newActive.y }, { x: newActive.x - 1, y: newActive.y },
			{ x: newActive.x, y: newActive.y + 1 }, { x: newActive.x, y: newActive.y - 1 }
		];
		for (const nn of nbs) {
			if (nn.x < 0 || nn.x > state.N || nn.y < 0 || nn.y > state.N) continue;
			const kk = keyForEdge(newActive, nn);
			if (!tmpEdges.has(kk) && !isBorderPoint(nn) && !tmpVisited.has(keyForPoint(nn))) opponentMoves++;
		}
		safeMoves.push({ move: m, opp: opponentMoves });
	}

	if (safeMoves.length === 0) {
		if (losingMoves.length > 0) return losingMoves[Math.floor(Math.random() * losingMoves.length)];
		return candidates[Math.floor(Math.random() * candidates.length)];
	}

	safeMoves.sort((a, b) => a.opp - b.opp);
	const bestOpp = safeMoves[0].opp;
	const best = safeMoves.filter(s => s.opp === bestOpp).map(s => s.move);
	return best[Math.floor(Math.random() * best.length)];
}

// scheduleAIMoveIfNeeded: aiThinking'in temizlenmesini garanti et ve move yoksa temizle
function scheduleAIMoveIfNeeded() {
	if (!isSinglePlayer) return;
	if (aiThinking) return;
	if (gameState.gameOver) return;
	if (gameState.turn !== 2) return;

	aiThinking = true;
	const prevPointer = canvas.style.pointerEvents;
	canvas.style.pointerEvents = 'none';

	setTimeout(() => {
		try {
			let move = null;
			if (gameState.gameType === 'square') move = pickRandomSquareMove(gameState);
			else move = pickRandomPathMove(gameState);

			// fallback: eğer yine null ise tüm boş kenarlardan seç
			if (!move) {
				const all = getAllUndrawnEdges(gameState);
				if (all.length > 0) move = all[Math.floor(Math.random() * all.length)];
			}

			if (move) {
				processMove(move.a, move.b);
			} else {
				// Hamle bulunamazsa aiThinking'i temizle (güvenlik)
				aiThinking = false;
				if (!gameState.gameOver) canvas.style.pointerEvents = prevPointer || 'auto';
			}
		} catch (err) {
			console.error('AI error:', err);
			aiThinking = false;
			if (!gameState.gameOver) canvas.style.pointerEvents = prevPointer || 'auto';
		}
	}, 700);
}

// Güncelle: updateLocalStateFromServer sonunda AI tetikleme
function updateLocalStateFromServer() {
	ensureGameStateDefaults();
	gameType = gameState.gameType || gameType;
	if (gridSizeDisplay) gridSizeDisplay.textContent = `${N} × ${N} Kare`;
	if (gameTitle) gameTitle.textContent = `${gameType === 'square' ? 'Kare Kapatma' : 'Yol Çizme'}`;

	if (gameType === 'square') scoreboard.classList.remove('hidden'); else scoreboard.classList.add('hidden');

	// Eğer serverdan gelen squares matrisi N ile uyumlu değilse yeniden boyutlandır
	if (!Array.isArray(gameState.squares) || gameState.squares.length !== N) {
		const newSquares = Array(N).fill(0).map(() => Array(N).fill(0));
		if (Array.isArray(gameState.squares)) {
			// var olan değerleri kopyala (sığ mümkünse)
			for (let y = 0; y < Math.min(gameState.squares.length, N); y++) {
				for (let x = 0; x < Math.min(gameState.squares[y].length || 0, N); x++) {
					newSquares[y][x] = gameState.squares[y][x] || 0;
				}
			}
		}
		gameState.squares = newSquares;
	}

	updateStatusText();
	updateScoreDisplay();
	draw();

	// Zamanlayıcı yönetimi: eğer oyun bitti temizle
	if (gameState.gameOver) {
		clearTurnTimer();
		showGameOverScreen();
	} else {
		// Eğer bu istemcinin sırasıysa ve ilk hamle yapılmışsa başlat
		if (typeof playerNumber !== 'undefined' && playerNumber === gameState.turn) {
			if (Array.isArray(gameState.edgesList) && gameState.edgesList.length > 0) startTurnTimer();
			else clearTurnTimer();
		} else {
			clearTurnTimer();
		}
		// Yeni: eğer single-player moddaysak ve AI sırasıysa AI'yi planla (küçük gecikmeyle)
		if (!onlineRoom && isSinglePlayer) {
			setTimeout(() => {
				if (gameState && gameState.turn === 2) scheduleAIMoveIfNeeded();
			}, 60);
		}
		gameOverModal.classList.add('hidden');
	}
}

// Ayrıca showGameOverScreen içinde timer temizleme
function showGameOverScreen() {
	ensureGameStateDefaults();
	clearTurnTimer();
	const players = gameState.players || {};
	const names = Object.keys(players).map(k => players[k].name);
	const p1 = names[0] || 'Oyuncu 1', p2 = names[1] || 'Oyuncu 2';
	let message = '';
	if (gameType === 'square') {
		const scoreText = `(${gameState.player1Score} - ${gameState.player2Score})`;
		if (gameState.player1Score > gameState.player2Score) message = `${p1} Kazandı! ${scoreText}`;
		else if (gameState.player2Score > gameState.player1Score) message = `${p2} Kazandı! ${scoreText}`;
		else message = `Oyun Berabere! ${scoreText}`;
	} else {
		const losing = gameState.losingPlayer;
		const lname = losing === 1 ? p1 : p2;
		const wname = losing === 1 ? p2 : p1;
		message = `${lname} Kaybetti! Kazanan: ${wname}`;
	}
	gameOverMessage.textContent = message;
	gameOverModal.classList.remove('hidden');
}

