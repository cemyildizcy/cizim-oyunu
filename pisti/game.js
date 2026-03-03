// ================================================
// PİŞTİ - TÜRK KART OYUNU
// ================================================

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// DOM Elementleri
const playerHandEl = document.getElementById('playerHand');
const opponentHandEl = document.getElementById('opponentHand');
const deckEl = document.getElementById('deck');
const pileEl = document.getElementById('pile');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('resetGameBtn');
const playerInfo = document.getElementById('playerInfo');
const opponentInfo = document.getElementById('opponentInfo');
const playerNameEl = document.getElementById('playerName');
const opponentNameEl = document.getElementById('opponentName');
const playerCardCount = document.getElementById('playerCardCount');
const opponentCardCount = document.getElementById('opponentCardCount');
const p1Score = document.getElementById('p1Score');
const p2Score = document.getElementById('p2Score');
const p1ScoreLabel = document.getElementById('p1ScoreLabel');
const p2ScoreLabel = document.getElementById('p2ScoreLabel');
const pistiCountEl = document.getElementById('pistiCount');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverMessage = document.getElementById('gameOverMessage');
const gameOverDetails = document.getElementById('gameOverDetails');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitBtn = document.getElementById('exitBtn');
const rulesModal = document.getElementById('rulesModal');
const closeRulesBtn = document.getElementById('closeRulesBtn');

// Oyun değişkenleri
let player1Name = 'Oyuncu';
let player2Name = 'Bilgisayar';
let isSinglePlayer = true;
let aiDifficulty = 'medium';

let deck = [];
let pile = [];
let playerHand = [];
let opponentHand = [];
let currentTurn = 'player'; // 'player' veya 'opponent'
let gameOver = false;

// Toplanan kartlar ve puanlar
let collectedCards = { player: [], opponent: [] };
let pistiCount = { player: 0, opponent: 0 };
let lastCollector = null;

// ================================================
// BAŞLATMA
// ================================================

function init() {
    const params = new URLSearchParams(window.location.search);
    player1Name = params.get('p1') || 'Oyuncu';
    player2Name = params.get('p2') || 'Bilgisayar';
    isSinglePlayer = params.get('mode') === 'ai';
    aiDifficulty = params.get('diff') || 'medium';

    playerNameEl.textContent = player1Name;
    opponentNameEl.textContent = player2Name;
    p1ScoreLabel.textContent = player1Name;
    p2ScoreLabel.textContent = player2Name;

    resetGame();
    rulesModal.classList.remove('hidden');
}

function resetGame() {
    deck = createDeck();
    shuffleDeck(deck);
    pile = [];
    playerHand = [];
    opponentHand = [];
    collectedCards = { player: [], opponent: [] };
    pistiCount = { player: 0, opponent: 0 };
    lastCollector = null;
    currentTurn = 'player';
    gameOver = false;

    // İlk dağıtım
    dealInitialCards();

    renderAll();
    updateUI();
    gameOverModal.classList.add('hidden');
}

function createDeck() {
    const d = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            d.push({ suit, value });
        }
    }
    return d;
}

function shuffleDeck(d) {
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
}

function dealInitialCards() {
    // 4'er kart dağıt
    for (let i = 0; i < 4; i++) {
        playerHand.push(deck.pop());
        opponentHand.push(deck.pop());
    }
    // Masaya 4 kart
    for (let i = 0; i < 4; i++) {
        pile.push(deck.pop());
    }
    // Eğer üstteki J ise, alta al
    while (pile[pile.length - 1].value === 'J') {
        pile.unshift(pile.pop());
    }
}

function dealCards() {
    if (deck.length === 0) return false;

    const cardsToDeal = Math.min(4, deck.length);
    for (let i = 0; i < cardsToDeal && deck.length > 0; i++) {
        playerHand.push(deck.pop());
        if (deck.length > 0) opponentHand.push(deck.pop());
    }
    return true;
}

// ================================================
// RENDER
// ================================================

function renderAll() {
    renderDeck();
    renderPile();
    renderPlayerHand();
    renderOpponentHand();
}

function renderDeck() {
    deckEl.innerHTML = '';
    const count = Math.min(3, Math.ceil(deck.length / 10));
    for (let i = 0; i < count; i++) {
        const card = document.createElement('div');
        card.className = 'card back';
        card.textContent = '🂠';
        card.style.top = (i * 2) + 'px';
        card.style.left = (i * 2) + 'px';
        deckEl.appendChild(card);
    }
}

function renderPile() {
    pileEl.innerHTML = '';
    if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        const cardEl = createCardElement(topCard);
        cardEl.style.cursor = 'default';
        pileEl.appendChild(cardEl);
    }
}

function renderPlayerHand() {
    playerHandEl.innerHTML = '';
    playerHand.forEach((card, index) => {
        const cardEl = createCardElement(card);
        cardEl.addEventListener('click', () => playCard(index));
        playerHandEl.appendChild(cardEl);
    });
    playerCardCount.textContent = `${playerHand.length} kart`;
}

function renderOpponentHand() {
    opponentHandEl.innerHTML = '';
    opponentHand.forEach(() => {
        const card = document.createElement('div');
        card.className = 'card back';
        card.textContent = '🂠';
        card.style.cursor = 'default';
        opponentHandEl.appendChild(card);
    });
    opponentCardCount.textContent = `${opponentHand.length} kart`;
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.classList.add(card.suit === '♥' || card.suit === '♦' ? 'red' : 'black');
    el.innerHTML = `<span>${card.value}${card.suit}</span>`;
    return el;
}

function updateUI() {
    // Sıra göstergesi
    playerInfo.classList.toggle('active', currentTurn === 'player');
    opponentInfo.classList.toggle('active', currentTurn === 'opponent');

    // Durum
    if (gameOver) {
        statusDiv.textContent = 'Oyun Bitti';
    } else {
        const name = currentTurn === 'player' ? player1Name : player2Name;
        statusDiv.textContent = `Sıra: ${name}`;
    }

    // Skorlar
    const scores = calculateScores();
    p1Score.textContent = scores.player;
    p2Score.textContent = scores.opponent;
    pistiCountEl.textContent = pistiCount.player + pistiCount.opponent;
}

// ================================================
// OYUN MEKANİĞİ
// ================================================

function playCard(index) {
    if (gameOver) return;
    if (currentTurn !== 'player') return;

    const card = playerHand.splice(index, 1)[0];
    handlePlay(card, 'player');
}

function handlePlay(card, player) {
    const topCard = pile[pile.length - 1];
    const isPisti = pile.length === 1 && topCard && (card.value === topCard.value || card.value === 'J');
    const isCollect = topCard && (card.value === topCard.value || card.value === 'J');

    pile.push(card);
    renderPile();

    if (isCollect) {
        // Kartları topla
        setTimeout(() => {
            collectedCards[player] = collectedCards[player].concat(pile);
            lastCollector = player;

            if (isPisti) {
                pistiCount[player]++;
                showPistiAlert(card.value === 'J');
            }

            pile = [];
            renderPile();
            afterPlay(player);
        }, 500);
    } else {
        afterPlay(player);
    }
}

function afterPlay(player) {
    renderAll();

    // El bitti mi kontrol
    if (playerHand.length === 0 && opponentHand.length === 0) {
        if (deck.length > 0) {
            dealCards();
            renderAll();
        } else {
            // Oyun bitti
            endGame();
            return;
        }
    }

    // Sıra değiştir
    currentTurn = player === 'player' ? 'opponent' : 'player';
    updateUI();

    // AI hamlesi
    if (!gameOver && isSinglePlayer && currentTurn === 'opponent') {
        setTimeout(makeAIMove, getAIDelay());
    }
}

function showPistiAlert(isJack) {
    const alert = document.createElement('div');
    alert.className = 'pisti-alert';
    alert.textContent = isJack ? '🃏 ÇİFTE PİŞTİ!' : '🎉 PİŞTİ!';
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 1500);
}

// ================================================
// PUAN HESABI
// ================================================

function calculateScores() {
    let playerScore = 0;
    let opponentScore = 0;

    // Piştiler
    playerScore += pistiCount.player * 10;
    opponentScore += pistiCount.opponent * 10;

    // Kart puanları
    playerScore += countCardPoints(collectedCards.player);
    opponentScore += countCardPoints(collectedCards.opponent);

    // Çoğunluk bonusu (26+ kart)
    if (collectedCards.player.length > collectedCards.opponent.length) {
        playerScore += 3;
    } else if (collectedCards.opponent.length > collectedCards.player.length) {
        opponentScore += 3;
    }

    return { player: playerScore, opponent: opponentScore };
}

function countCardPoints(cards) {
    let points = 0;
    for (const card of cards) {
        if (card.value === 'J') points += 1;
        if (card.value === 'A') points += 1;
        if (card.value === '2' && card.suit === '♣') points += 2;
        if (card.value === '10' && card.suit === '♦') points += 3;
    }
    return points;
}

// ================================================
// OYUN SONU
// ================================================

function endGame() {
    // Son kalan kartları son toplayan alır
    if (pile.length > 0 && lastCollector) {
        collectedCards[lastCollector] = collectedCards[lastCollector].concat(pile);
        pile = [];
    }

    gameOver = true;
    const scores = calculateScores();

    let winner, loser, winScore, loseScore;
    if (scores.player > scores.opponent) {
        winner = player1Name;
        loser = player2Name;
        winScore = scores.player;
        loseScore = scores.opponent;
    } else if (scores.opponent > scores.player) {
        winner = player2Name;
        loser = player1Name;
        winScore = scores.opponent;
        loseScore = scores.player;
    } else {
        gameOverMessage.textContent = '🤝 Berabere!';
        gameOverDetails.textContent = `Skor: ${scores.player} - ${scores.opponent}`;
        gameOverModal.classList.remove('hidden');
        updateUI();
        return;
    }

    gameOverMessage.textContent = `🏆 ${winner} Kazandı!`;
    gameOverDetails.innerHTML = `
        <p>${winner}: ${winScore} puan</p>
        <p>${loser}: ${loseScore} puan</p>
        <p>Pişti sayısı: ${pistiCount.player + pistiCount.opponent}</p>
    `;
    gameOverModal.classList.remove('hidden');
    updateUI();
}

// ================================================
// YAPAY ZEKA
// ================================================

function getAIDelay() {
    if (aiDifficulty === 'easy') return 1500;
    if (aiDifficulty === 'medium') return 1000;
    return 600;
}

function makeAIMove() {
    if (gameOver || opponentHand.length === 0) return;

    const topCard = pile[pile.length - 1];
    let selectedIndex = 0;

    if (aiDifficulty === 'easy') {
        // Rastgele oyna
        selectedIndex = Math.floor(Math.random() * opponentHand.length);
    } else {
        // Akıllı oyna
        selectedIndex = findBestCard(topCard);
    }

    const card = opponentHand.splice(selectedIndex, 1)[0];
    handlePlay(card, 'opponent');
}

function findBestCard(topCard) {
    // Pişti yapabiliyorsa yap
    if (pile.length === 1 && topCard) {
        for (let i = 0; i < opponentHand.length; i++) {
            if (opponentHand[i].value === topCard.value) return i;
        }
        // J ile pişti
        if (aiDifficulty === 'hard') {
            for (let i = 0; i < opponentHand.length; i++) {
                if (opponentHand[i].value === 'J') return i;
            }
        }
    }

    // Normal toplama
    if (topCard) {
        for (let i = 0; i < opponentHand.length; i++) {
            if (opponentHand[i].value === topCard.value) return i;
        }
    }

    // J'yi sakla (zor modda)
    if (aiDifficulty === 'hard') {
        for (let i = 0; i < opponentHand.length; i++) {
            if (opponentHand[i].value !== 'J') return i;
        }
    }

    // Değerli kartları sakla
    const valueOrder = ['J', 'A', '10', '2'];
    for (let i = 0; i < opponentHand.length; i++) {
        if (!valueOrder.includes(opponentHand[i].value)) return i;
    }

    return 0;
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
