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

	if (gridSizeDisplay) gridSizeDisplay.textContent = `${N} × ${N} Kare`;
	if (footerInfo) footerInfo.textContent = onlineRoom ? `Oda Kodu: ${onlineRoom}` : '';

	if (gameTitle) {
		gameTitle.textContent = `${gameType === 'square' ? 'Kare Kapatma' : 'Yol Çizme'}`;
	}

	// Her durumda ızgarayı hemen göster
	resizeCanvasAndSetStep();

	// Eğer onlineRoom varsa Firebase bağlantısını kur (online kodu dokunulmadan bırakıldı)
	if (onlineRoom && typeof database !== 'undefined' && database) {
		setupFirebaseConnection();
	} else {
		// Offline fallback: oluşturulmuş local state ile bekle
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
			players: { local: { name: myName } }
		};
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
		const players = snapshot.val();
		if (!players) return;
		const playerKeys = Object.keys(players);
		const myKey = myPlayerRef.key;
		const myIndex = playerKeys.findIndex(k => k === myKey);
		if (myIndex !== -1) playerNumber = myIndex + 1;
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

	updateStatusText();
	updateScoreDisplay();
	draw();

	if (gameState.gameOver) showGameOverScreen();
	else gameOverModal.classList.add('hidden');
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
	const keys = Object.keys(players);
	const names = keys.map(k => players[k].name);
	const p1 = names[0] || 'Oyuncu 1';
	const p2 = names[1] || 'Oyuncu 2';

	if (keys.length < 2 && !gameState.gameOver) { statusDiv.textContent = 'Rakip bekleniyor...'; return; }
	if (gameState.gameOver) { statusDiv.textContent = 'Oyun Bitti!'; return; }
	const current = gameState.turn === 1 ? p1 : p2;
	let text = `Sıra: ${current}`;
	if (playerNumber === gameState.turn) text += ' (Sıra Sende)';
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
	} else {
		rulesTitle.textContent = "Kare Kapatma Oyunu Kuralları";
		rulesContent.innerHTML = `<ul>
<li>Amaç kareleri tamamlayarak puanları toplamaktır.</li>
<li>Kare tamamlayan ayni oyuncu tekrar hamle yapar.</li>
<li>Tüm kareler dolunca en yüksek puan kazanan olur.</li>
</ul>`;
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
	if (playersCount < 2 && gameState.status!=='local') { alert('Rakibin bağlanmasını bekleyin.'); return; }
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

