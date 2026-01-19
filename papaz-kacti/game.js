// ================================================
// PAPAZ KAÇTI (HEARTS) - KART OYUNU
// ================================================

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

// DOM
const playerHandEl = document.getElementById('playerHand');
const centerCardsEl = document.getElementById('centerCards');
const statusDiv = document.getElementById('status');
const resetBtn = document.getElementById('resetGameBtn');
const gameOverModal = document.getElementById('gameOverModal');
const gameOverMessage = document.getElementById('gameOverMessage');
const gameOverDetails = document.getElementById('gameOverDetails');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitBtn = document.getElementById('exitBtn');
const rulesModal = document.getElementById('rulesModal');
const closeRulesBtn = document.getElementById('closeRulesBtn');

const playerLabels = [
    document.getElementById('p1Label'),
    document.getElementById('p2Label'),
    document.getElementById('p3Label'),
    document.getElementById('p4Label')
];
const playerPoints = [
    document.getElementById('p1Points'),
    document.getElementById('p2Points'),
    document.getElementById('p3Points'),
    document.getElementById('p4Points')
];
const playerScores = [
    document.getElementById('p1Score'),
    document.getElementById('p2Score'),
    document.getElementById('p3Score'),
    document.getElementById('p4Score')
];

let player1Name = 'Oyuncu';
let aiDifficulty = 'medium';

let hands = [[], [], [], []];
let roundPoints = [0, 0, 0, 0];
let totalScores = [0, 0, 0, 0];
let currentTrick = [];
let leadSuit = null;
let currentPlayer = 0;
let heartsBroken = false;
let gameOver = false;

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

    hands = [[], [], [], []];
    for (let i = 0; i < 52; i++) {
        hands[i % 4].push(deck[i]);
    }
    hands.forEach(h => sortHand(h));

    roundPoints = [0, 0, 0, 0];
    currentTrick = [];
    leadSuit = null;
    heartsBroken = false;
    gameOver = false;

    // 2♣ başlar
    currentPlayer = findStartingPlayer();

    renderAll();
    updateUI();

    if (currentPlayer !== 0) {
        setTimeout(() => makeAIMove(), 800);
    }
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
    const suitOrder = { '♣': 0, '♦': 1, '♠': 2, '♥': 3 };
    hand.sort((a, b) => {
        if (suitOrder[a.suit] !== suitOrder[b.suit]) {
            return suitOrder[a.suit] - suitOrder[b.suit];
        }
        return VALUE_ORDER[a.value] - VALUE_ORDER[b.value];
    });
}

function findStartingPlayer() {
    for (let p = 0; p < 4; p++) {
        if (hands[p].some(c => c.suit === '♣' && c.value === '2')) {
            return p;
        }
    }
    return 0;
}

function renderAll() {
    renderPlayerHand();
    renderCenterCards();
    updatePoints();
}

function renderPlayerHand() {
    playerHandEl.innerHTML = '';
    hands[0].forEach((card, i) => {
        const el = createCardElement(card);
        if (currentPlayer === 0 && !gameOver && isPlayable(card, hands[0])) {
            el.addEventListener('click', () => playCard(i));
        } else {
            el.classList.add('disabled');
        }
        playerHandEl.appendChild(el);
    });
}

function renderCenterCards() {
    centerCardsEl.innerHTML = '';
    currentTrick.forEach(({ card }) => {
        const el = createCardElement(card);
        el.classList.add('small');
        el.style.cursor = 'default';
        centerCardsEl.appendChild(el);
    });
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'card';
    el.classList.add(card.suit === '♥' || card.suit === '♦' ? 'red' : 'black');
    el.innerHTML = `${card.value}${card.suit}`;
    return el;
}

function updatePoints() {
    for (let i = 0; i < 4; i++) {
        playerPoints[i].textContent = `${roundPoints[i]} puan`;
        playerScores[i].textContent = totalScores[i];
        playerLabels[i].classList.toggle('active', currentPlayer === i);
    }
}

function updateUI() {
    const names = [player1Name, 'AI 1', 'AI 2', 'AI 3'];
    statusDiv.textContent = gameOver ? 'Tur bitti!' : `Sıra: ${names[currentPlayer]}`;
}

function isPlayable(card, hand) {
    // İlk el: 2♣ zorunlu
    if (currentTrick.length === 0 && hands.flat().length === 52) {
        return card.suit === '♣' && card.value === '2';
    }

    if (!leadSuit) {
        // İlk kart: kupa kırılmamışsa kupa başlatılamaz
        if (!heartsBroken && card.suit === '♥') {
            return hand.every(c => c.suit === '♥');
        }
        return true;
    }

    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    if (hasLeadSuit) return card.suit === leadSuit;
    return true;
}

function playCard(index) {
    if (gameOver || currentPlayer !== 0) return;
    const card = hands[0].splice(index, 1)[0];
    handlePlay(card, 0);
}

function handlePlay(card, player) {
    if (currentTrick.length === 0) leadSuit = card.suit;
    if (card.suit === '♥') heartsBroken = true;

    currentTrick.push({ card, player });
    renderCenterCards();

    if (currentTrick.length === 4) {
        setTimeout(() => {
            const winner = determineTrickWinner();
            const points = countTrickPoints();
            roundPoints[winner] += points;

            if (points > 0) showDangerAlert(points);

            currentTrick = [];
            leadSuit = null;
            currentPlayer = winner;

            renderAll();
            updateUI();

            if (hands[0].length === 0) {
                endRound();
            } else if (currentPlayer !== 0) {
                setTimeout(() => makeAIMove(), 600);
            }
        }, 700);
    } else {
        currentPlayer = (currentPlayer + 1) % 4;
        updateUI();
        renderPlayerHand();
        if (currentPlayer !== 0) setTimeout(() => makeAIMove(), 500);
    }
}

function determineTrickWinner() {
    let winner = 0;
    let highest = currentTrick[0].card;

    for (let i = 1; i < 4; i++) {
        const card = currentTrick[i].card;
        if (card.suit === leadSuit && highest.suit === leadSuit) {
            if (VALUE_ORDER[card.value] > VALUE_ORDER[highest.value]) {
                winner = i;
                highest = card;
            }
        } else if (card.suit === leadSuit) {
            winner = i;
            highest = card;
        }
    }
    return currentTrick[winner].player;
}

function countTrickPoints() {
    let pts = 0;
    for (const { card } of currentTrick) {
        if (card.suit === '♥') pts += 1;
        if (card.suit === '♠' && card.value === 'Q') pts += 13;
    }
    return pts;
}

function showDangerAlert(pts) {
    const alert = document.createElement('div');
    alert.className = 'danger-alert';
    alert.textContent = pts === 13 ? '♠️Q PAPAZ!' : `+${pts} puan`;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 1000);
}

function endRound() {
    // 26 puan alan: "shoot the moon"
    for (let i = 0; i < 4; i++) {
        if (roundPoints[i] === 26) {
            roundPoints[i] = 0;
            for (let j = 0; j < 4; j++) {
                if (j !== i) roundPoints[j] = 26;
            }
            break;
        }
    }

    for (let i = 0; i < 4; i++) {
        totalScores[i] += roundPoints[i];
    }

    updatePoints();

    if (Math.max(...totalScores) >= 100) {
        showGameOver();
    } else {
        setTimeout(() => startNewRound(), 2000);
    }
}

function showGameOver() {
    gameOver = true;
    const names = [player1Name, 'AI 1', 'AI 2', 'AI 3'];
    const minScore = Math.min(...totalScores);
    const winnerIndex = totalScores.indexOf(minScore);

    gameOverMessage.textContent = `🏆 ${names[winnerIndex]} Kazandı!`;
    gameOverDetails.innerHTML = names.map((n, i) => `<p>${n}: ${totalScores[i]} puan</p>`).join('');
    gameOverModal.classList.remove('hidden');
}

function makeAIMove() {
    if (gameOver || currentPlayer === 0) return;

    const hand = hands[currentPlayer];
    const playable = hand.filter(c => isPlayable(c, hand));

    let card;
    if (aiDifficulty === 'easy') {
        card = playable[Math.floor(Math.random() * playable.length)];
    } else {
        card = chooseBestCard(playable, hand);
    }

    const idx = hand.indexOf(card);
    hand.splice(idx, 1);
    handlePlay(card, currentPlayer);
}

function chooseBestCard(playable, hand) {
    // Yüksek tehlikeli kartları at
    const spadeQ = playable.find(c => c.suit === '♠' && c.value === 'Q');
    if (spadeQ && leadSuit && leadSuit !== '♠') return spadeQ;

    const hearts = playable.filter(c => c.suit === '♥');
    if (hearts.length > 0 && leadSuit && leadSuit !== '♥') {
        return hearts.reduce((h, c) => VALUE_ORDER[c.value] > VALUE_ORDER[h.value] ? c : h);
    }

    // En düşük kartı at
    return playable.reduce((l, c) => VALUE_ORDER[c.value] < VALUE_ORDER[l.value] ? c : l);
}

resetBtn.addEventListener('click', () => { totalScores = [0, 0, 0, 0]; startNewRound(); });
closeRulesBtn.addEventListener('click', () => { rulesModal.classList.add('hidden'); startNewRound(); });
playAgainBtn.addEventListener('click', () => { gameOverModal.classList.add('hidden'); totalScores = [0, 0, 0, 0]; startNewRound(); });
exitBtn.addEventListener('click', () => location.href = 'index.html');

init();
