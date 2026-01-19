// ================================================
// KELİME OYUNU (TABU) - OYUN MANTIĞI
// ================================================

// DOM
const gameContainer = document.getElementById('gameContainer');
const statusDiv = document.getElementById('status');

// Oyun değişkenleri
let team1Name = 'Kırmızı Takım';
let team2Name = 'Mavi Takım';
let roundTime = 60;
let targetScore = 20;

let scores = { team1: 0, team2: 0 };
let currentTeam = 'team1';
let currentWordIndex = 0;
let words = [];
let timer = null;
let timeLeft = 0;
let passesLeft = 3;
let roundScore = 0;
let gamePhase = 'pregame'; // pregame, playing, roundend, gameover

// ================================================
// BAŞLATMA
// ================================================

function init() {
    const params = new URLSearchParams(window.location.search);
    team1Name = params.get('team1') || 'Kırmızı Takım';
    team2Name = params.get('team2') || 'Mavi Takım';
    roundTime = parseInt(params.get('time')) || 60;
    targetScore = parseInt(params.get('target')) || 20;

    words = shuffleWords();
    showPreGame();
}

// ================================================
// EKRANLAR
// ================================================

function showPreGame() {
    gamePhase = 'pregame';
    statusDiv.textContent = 'Oyun hazır';

    const teamName = currentTeam === 'team1' ? team1Name : team2Name;
    const teamColor = currentTeam === 'team1' ? '🔴' : '🔵';

    gameContainer.innerHTML = `
        ${getScoreboard()}
        <div class="turn-indicator">${teamColor} ${teamName} sırası!</div>
        <div class="word-card">
            <div style="font-size:48px;margin-bottom:16px">🎯</div>
            <p style="color:#374151">Telefonu anlatıcıya ver.</p>
            <p style="color:#6b7280;font-size:14px;margin-top:8px">
                Süre: ${roundTime} saniye | Pas hakkı: 3
            </p>
        </div>
        <div class="action-buttons">
            <button class="btn primary" onclick="startRound()">Başla!</button>
        </div>
    `;
}

function getScoreboard() {
    return `
        <div class="scoreboard">
            <div class="team-score red ${currentTeam === 'team1' ? 'active' : ''}">
                <div class="team-score-name">${team1Name}</div>
                <div class="team-score-value">${scores.team1}</div>
            </div>
            <div class="team-score blue ${currentTeam === 'team2' ? 'active' : ''}">
                <div class="team-score-name">${team2Name}</div>
                <div class="team-score-value">${scores.team2}</div>
            </div>
        </div>
    `;
}

function startRound() {
    gamePhase = 'playing';
    timeLeft = roundTime;
    passesLeft = 3;
    roundScore = 0;
    statusDiv.textContent = 'Anlat!';

    showCurrentWord();
    startTimer();
}

function showCurrentWord() {
    if (currentWordIndex >= words.length) {
        words = shuffleWords();
        currentWordIndex = 0;
    }

    const word = words[currentWordIndex];
    const timerClass = timeLeft <= 10 ? 'danger' : (timeLeft <= 20 ? 'warning' : '');

    gameContainer.innerHTML = `
        ${getScoreboard()}
        <div class="timer ${timerClass}">${timeLeft}</div>
        <div class="word-card">
            <div class="main-word">${word.word}</div>
            <div class="taboo-words">
                <div class="taboo-label">🚫 YASAK KELİMELER</div>
                ${word.taboo.map(t => `<span class="taboo-word">${t}</span>`).join('')}
            </div>
        </div>
        <div class="action-buttons">
            <button class="action-btn correct" onclick="correctAnswer()">✓ Doğru</button>
            <button class="action-btn wrong" onclick="wrongAnswer()">✗ Tabu</button>
            <button class="action-btn skip" onclick="skipWord()" ${passesLeft <= 0 ? 'disabled' : ''}>
                Pas (${passesLeft})
            </button>
        </div>
    `;
}

function startTimer() {
    timer = setInterval(() => {
        timeLeft--;

        const timerEl = document.querySelector('.timer');
        if (timerEl) {
            timerEl.textContent = timeLeft;
            timerEl.className = 'timer';
            if (timeLeft <= 10) timerEl.classList.add('danger');
            else if (timeLeft <= 20) timerEl.classList.add('warning');
        }

        if (timeLeft <= 0) {
            endRound();
        }
    }, 1000);
}

function correctAnswer() {
    roundScore++;
    currentWordIndex++;
    showCurrentWord();
}

function wrongAnswer() {
    roundScore--;
    currentWordIndex++;
    showCurrentWord();
}

function skipWord() {
    if (passesLeft > 0) {
        passesLeft--;
        currentWordIndex++;
        showCurrentWord();
    }
}

function endRound() {
    clearInterval(timer);
    timer = null;
    gamePhase = 'roundend';

    scores[currentTeam] += roundScore;
    if (scores[currentTeam] < 0) scores[currentTeam] = 0;

    // Kazanma kontrolü
    if (scores.team1 >= targetScore || scores.team2 >= targetScore) {
        showGameOver();
        return;
    }

    const teamName = currentTeam === 'team1' ? team1Name : team2Name;
    const teamColor = currentTeam === 'team1' ? '🔴' : '🔵';

    gameContainer.innerHTML = `
        ${getScoreboard()}
        <div class="word-card">
            <div style="font-size:48px;margin-bottom:16px">⏰</div>
            <div class="main-word">Süre Doldu!</div>
            <p style="color:#374151;font-size:18px">
                ${teamColor} ${teamName} bu turda <strong>${roundScore}</strong> puan kazandı!
            </p>
        </div>
        <div class="action-buttons">
            <button class="btn primary" onclick="nextTeam()">Sıradaki Takım</button>
        </div>
    `;
}

function nextTeam() {
    currentTeam = currentTeam === 'team1' ? 'team2' : 'team1';
    showPreGame();
}

function showGameOver() {
    gamePhase = 'gameover';
    statusDiv.textContent = 'Oyun bitti!';

    const winner = scores.team1 >= targetScore ? team1Name : team2Name;
    const winnerColor = scores.team1 >= targetScore ? '🔴' : '🔵';

    gameContainer.innerHTML = `
        ${getScoreboard()}
        <div class="word-card">
            <div style="font-size:64px;margin-bottom:16px">🏆</div>
            <div class="main-word">${winnerColor} ${winner}</div>
            <p style="color:#374151">Tebrikler, kazandınız!</p>
        </div>
        <div class="action-buttons">
            <button class="btn primary" onclick="restartGame()">Yeni Oyun</button>
            <button class="btn ghost" onclick="location.href='index.html'">Ayarlar</button>
        </div>
    `;
}

function restartGame() {
    scores = { team1: 0, team2: 0 };
    currentTeam = 'team1';
    currentWordIndex = 0;
    words = shuffleWords();
    showPreGame();
}

// Başlat
init();
