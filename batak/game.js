// ================================================
// BATAK - TÜRK KART OYUNU (4 OYUNCU)
// ================================================

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

// DOM Elementleri
const playerHandEl = document.getElementById('playerHand');
const centerCardsEl = document.getElementById('centerCards');
const trumpSuitEl = document.getElementById('trumpSuit');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('resetGameBtn');
const trumpModal = document.getElementById('trumpModal');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverMessage = document.getElementById('gameOverMessage');
const gameOverDetails = document.getElementById('gameOverDetails');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitBtn = document.getElementById('exitBtn');
const rulesModal = document.getElementById('rulesModal');
const closeRulesBtn = document.getElementById('closeRulesBtn');

// Oyuncu etiketleri
const playerLabels = [
    document.getElementById('p1Label'),
    document.getElementById('p2Label'),
    document.getElementById('p3Label'),
    document.getElementById('p4Label')
];
const playerTricks = [
    document.getElementById('p1Tricks'),
    document.getElementById('p2Tricks'),
    document.getElementById('p3Tricks'),
    document.getElementById('p4Tricks')
];
const playerScores = [
    document.getElementById('p1Score'),
    document.getElementById('p2Score'),
    document.getElementById('p3Score'),
    document.getElementById('p4Score')
];

// Oyun değişkenleri
let player1Name = 'Oyuncu';
let aiDifficulty = 'medium';

let hands = [[], [], [], []]; // 4 oyuncunun elleri
let tricks = [0, 0, 0, 0]; // Alınan el sayıları
let scores = [0, 0, 0, 0]; // Toplam puanlar
let trump = null; // Koz
let currentTrick = []; // Masa ortasındaki kartlar
let leadSuit = null; // İlk atılan renk
let currentPlayer = 0; // 0 = oyuncu
let trickStarter = 0; // El başlatan
let gameOver = false;
let roundNumber = 0;

// ================================================
// BAŞLATMA
// ================================================

function init() {
    const params = new URLSearchParams(window.location.search);
    player1Name = params.get('p1') || 'Oyuncu';
    aiDifficulty = params.get('diff') || 'medium';

    playerLabels[0].textContent = player1Name;

    rulesModal.classList.remove('hidden');
}

function startNewRound() {
    const deck = createDeck();
    shuffleDeck(deck);

    // 13'er kart dağıt
    hands = [[], [], [], []];
    for (let i = 0; i < 52; i++) {
        hands[i % 4].push(deck[i]);
    }

    // Elleri sırala
    hands.forEach(hand => sortHand(hand));

    tricks = [0, 0, 0, 0];
    currentTrick = [];
    leadSuit = null;
    trump = null;
    currentPlayer = 0;
    trickStarter = 0;
    gameOver = false;
    roundNumber++;

    renderAll();
    updateUI();

    // Koz seçimi (oyuncu seçer)
    trumpModal.classList.remove('hidden');
}

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function sortHand(hand) {
    const suitOrder = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 };
    hand.sort((a, b) => {
        if (suitOrder[a.suit] !== suitOrder[b.suit]) {
            return suitOrder[a.suit] - suitOrder[b.suit];
        }
        return VALUE_ORDER[b.value] - VALUE_ORDER[a.value];
    });
}

// ================================================
// RENDER
// ================================================

function renderAll() {
    renderPlayerHand();
    renderCenterCards();
    updateTricks();
}

function renderPlayerHand() {
    playerHandEl.innerHTML = '';
    hands[0].forEach((card, index) => {
        const cardEl = createCardElement(card);

        // Oynanabilirlik kontrolü
        if (currentPlayer === 0 && !gameOver) {
            if (isPlayable(card, hands[0])) {
                cardEl.addEventListener('click', () => playCard(index));
            } else {
                cardEl.classList.add('disabled');
            }
        } else {
            cardEl.classList.add('disabled');
        }

        playerHandEl.appendChild(cardEl);
    });
}

function renderCenterCards() {
    centerCardsEl.innerHTML = '';
    currentTrick.forEach(({ card, player }) => {
        const cardEl = createCardElement(card);
        cardEl.classList.add('small');
        cardEl.style.cursor = 'default';
        centerCardsEl.appendChild(cardEl);
    });
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.classList.add(card.suit === '♥' || card.suit === '♦' ? 'red' : 'black');
    el.innerHTML = `${card.value}${card.suit}`;
    return el;
}

function updateTricks() {
    for (let i = 0; i < 4; i++) {
        playerTricks[i].textContent = `${tricks[i]} el`;
        playerScores[i].textContent = scores[i];
        playerLabels[i].classList.toggle('active', currentPlayer === i);
    }
}

function updateUI() {
    if (gameOver) {
        statusDiv.textContent = 'Tur bitti!';
    } else if (trump === null) {
        statusDiv.textContent = 'Koz seçimi...';
    } else {
        const names = [player1Name, 'AI 1', 'AI 2', 'AI 3'];
        statusDiv.textContent = `Sıra: ${names[currentPlayer]}`;
    }

    trumpSuitEl.textContent = trump || '-';
    trumpSuitEl.style.color = (trump === '♥' || trump === '♦') ? '#dc2626' : '#1f2937';
}

// ================================================
// OYUN MEKANİĞİ
// ================================================

function isPlayable(card, hand) {
    if (!leadSuit) return true; // İlk kart her şey oynanabilir

    // Lead suit var mı kontrol
    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    if (hasLeadSuit) {
        return card.suit === leadSuit;
    }
    return true; // Yoksa her şey oynanabilir
}

function playCard(index) {
    if (gameOver || currentPlayer !== 0) return;

    const card = hands[0].splice(index, 1)[0];
    handlePlay(card, 0);
}

function handlePlay(card, player) {
    if (currentTrick.length === 0) {
        leadSuit = card.suit;
    }

    currentTrick.push({ card, player });
    renderCenterCards();

    if (currentTrick.length === 4) {
        // El tamamlandı
        setTimeout(() => {
            const winner = determineTrickWinner();
            tricks[winner]++;
            currentTrick = [];
            leadSuit = null;
            trickStarter = winner;
            currentPlayer = winner;

            renderAll();
            updateUI();

            // Tur bitti mi?
            if (hands[0].length === 0) {
                endRound();
            } else {
                // Sonraki oyuncuya geç
                if (currentPlayer !== 0) {
                    setTimeout(() => makeAIMove(), getAIDelay());
                }
            }
        }, 800);
    } else {
        // Sonraki oyuncuya geç
        currentPlayer = (currentPlayer + 1) % 4;
        updateUI();
        renderPlayerHand();

        if (currentPlayer !== 0) {
            setTimeout(() => makeAIMove(), getAIDelay());
        }
    }
}

function determineTrickWinner() {
    let winningIndex = 0;
    let winningCard = currentTrick[0].card;

    for (let i = 1; i < 4; i++) {
        const card = currentTrick[i].card;

        // Koz kontrolü
        const isWinningTrump = winningCard.suit === trump;
        const isCurrentTrump = card.suit === trump;

        if (isCurrentTrump && !isWinningTrump) {
            winningIndex = i;
            winningCard = card;
        } else if (isCurrentTrump && isWinningTrump) {
            if (VALUE_ORDER[card.value] > VALUE_ORDER[winningCard.value]) {
                winningIndex = i;
                winningCard = card;
            }
        } else if (!isCurrentTrump && !isWinningTrump) {
            // Aynı renk mi?
            if (card.suit === leadSuit && winningCard.suit === leadSuit) {
                if (VALUE_ORDER[card.value] > VALUE_ORDER[winningCard.value]) {
                    winningIndex = i;
                    winningCard = card;
                }
            } else if (card.suit === leadSuit) {
                winningIndex = i;
                winningCard = card;
            }
        }
    }

    return currentTrick[winningIndex].player;
}

// ================================================
// YAPAY ZEKA
// ================================================

function getAIDelay() {
    if (aiDifficulty === 'easy') return 1200;
    if (aiDifficulty === 'medium') return 800;
    return 500;
}

function makeAIMove() {
    if (gameOver || currentPlayer === 0) return;

    const hand = hands[currentPlayer];
    const playableCards = hand.filter(c => isPlayable(c, hand));

    let selectedCard;

    if (aiDifficulty === 'easy') {
        // Rastgele oyna
        selectedCard = playableCards[Math.floor(Math.random() * playableCards.length)];
    } else {
        selectedCard = chooseBestCard(playableCards, hand);
    }

    const index = hand.indexOf(selectedCard);
    hand.splice(index, 1);
    handlePlay(selectedCard, currentPlayer);
}

function chooseBestCard(playable, hand) {
    // Ele başlıyorsa düşük kart at
    if (currentTrick.length === 0) {
        return playable.reduce((lowest, card) =>
            VALUE_ORDER[card.value] < VALUE_ORDER[lowest.value] ? card : lowest
        );
    }

    // Kazanabiliyorsa en düşük kazanan kartı at
    const currentWinning = getCurrentWinningCard();
    const winningCards = playable.filter(c => canBeat(c, currentWinning));

    if (winningCards.length > 0) {
        return winningCards.reduce((lowest, card) =>
            VALUE_ORDER[card.value] < VALUE_ORDER[lowest.value] ? card : lowest
        );
    }

    // Kazanamıyorsa en düşük kartı at
    return playable.reduce((lowest, card) =>
        VALUE_ORDER[card.value] < VALUE_ORDER[lowest.value] ? card : lowest
    );
}

function getCurrentWinningCard() {
    if (currentTrick.length === 0) return null;

    let winning = currentTrick[0].card;
    for (let i = 1; i < currentTrick.length; i++) {
        const card = currentTrick[i].card;
        if (canBeat(card, winning)) {
            winning = card;
        }
    }
    return winning;
}

function canBeat(card, target) {
    if (!target) return true;

    const cardIsTrump = card.suit === trump;
    const targetIsTrump = target.suit === trump;

    if (cardIsTrump && !targetIsTrump) return true;
    if (!cardIsTrump && targetIsTrump) return false;
    if (cardIsTrump && targetIsTrump) {
        return VALUE_ORDER[card.value] > VALUE_ORDER[target.value];
    }
    if (card.suit === leadSuit && target.suit === leadSuit) {
        return VALUE_ORDER[card.value] > VALUE_ORDER[target.value];
    }
    return false;
}

// ================================================
// TUR SONU
// ================================================

function endRound() {
    // Puanları güncelle
    for (let i = 0; i < 4; i++) {
        scores[i] += tricks[i];
    }

    updateTricks();

    // Oyun sonu kontrolü (genellikle birkaç tur oynanır)
    const maxScore = Math.max(...scores);
    if (maxScore >= 13) {
        gameOver = true;
        showGameOver();
    } else {
        // Yeni tur
        setTimeout(() => {
            startNewRound();
        }, 2000);
    }
}

function showGameOver() {
    const names = [player1Name, 'AI 1', 'AI 2', 'AI 3'];
    const maxScore = Math.max(...scores);
    const winnerIndex = scores.indexOf(maxScore);
    const winner = names[winnerIndex];

    gameOverMessage.textContent = `🏆 ${winner} Kazandı!`;
    gameOverDetails.innerHTML = names.map((name, i) =>
        `<p>${name}: ${scores[i]} puan</p>`
    ).join('');

    gameOverModal.classList.remove('hidden');
}

// ================================================
// EVENT LISTENERS
// ================================================

// Koz seçimi
document.querySelectorAll('.trump-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        trump = btn.dataset.suit;
        trumpModal.classList.add('hidden');
        renderAll();
        updateUI();
    });
});

resetBtn.addEventListener('click', () => {
    scores = [0, 0, 0, 0];
    startNewRound();
});

closeRulesBtn.addEventListener('click', () => {
    rulesModal.classList.add('hidden');
    startNewRound();
});

playAgainBtn.addEventListener('click', () => {
    gameOverModal.classList.add('hidden');
    scores = [0, 0, 0, 0];
    startNewRound();
});

exitBtn.addEventListener('click', () => {
    location.href = 'index.html';
});

// Başlat
init();
