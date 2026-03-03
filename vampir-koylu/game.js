// ================================================
// VAMPİR KÖYLÜ - PARTİ OYUNU
// Tek cihaz modu (telefon/tablet geçirme)
// ================================================

// DOM
const gameContainer = document.getElementById('gameContainer');
const statusDiv = document.getElementById('status');

// Oyun Durumu
let playerCount = 6;
let players = [];
let roles = [];
let currentPhase = 'setup'; // setup, role-reveal, night, day, vote, end
let currentPlayerIndex = 0;
let nightActions = { vampireKill: null, seerCheck: null, doctorSave: null };
let dayNumber = 0;
let gameLog = [];
let votes = {};

// Rol Bilgileri
const ROLES = {
    vampire: { icon: '🧛', name: 'Vampir', team: 'evil', desc: 'Gece birini öldür. Köylüleri kandır!' },
    seer: { icon: '👁️', name: 'Kahin', team: 'good', desc: 'Gece birinin rolünü öğren.' },
    doctor: { icon: '🏥', name: 'Doktor', team: 'good', desc: 'Gece birini vampirden koru.' },
    hunter: { icon: '🏹', name: 'Avcı', team: 'good', desc: 'Ölünce birini seç ve öldür.' },
    villager: { icon: '👨‍🌾', name: 'Köylü', team: 'good', desc: 'Vampirleri bul ve oy ver!' }
};

// ================================================
// BAŞLATMA
// ================================================

function init() {
    const params = new URLSearchParams(window.location.search);
    playerCount = parseInt(params.get('players')) || 6;
    const hasSeer = params.get('seer') === '1';
    const hasDoctor = params.get('doctor') === '1';
    const hasHunter = params.get('hunter') === '1';

    // Oyuncuları oluştur
    players = [];
    for (let i = 0; i < playerCount; i++) {
        players.push({
            id: i,
            name: `Oyuncu ${i + 1}`,
            role: null,
            alive: true
        });
    }

    // Rolleri dağıt
    distributeRoles(hasSeer, hasDoctor, hasHunter);

    // Rol gösterme fazına geç
    currentPhase = 'role-reveal';
    currentPlayerIndex = 0;
    renderRoleRevealIntro();
}

function distributeRoles(hasSeer, hasDoctor, hasHunter) {
    roles = [];

    // Vampir sayısı
    const vampireCount = playerCount <= 6 ? 1 : (playerCount <= 9 ? 2 : 3);
    for (let i = 0; i < vampireCount; i++) roles.push('vampire');

    // Özel roller
    if (hasSeer) roles.push('seer');
    if (hasDoctor) roles.push('doctor');
    if (hasHunter) roles.push('hunter');

    // Kalan köylüler
    while (roles.length < playerCount) roles.push('villager');

    // Karıştır
    shuffleArray(roles);

    // Oyunculara ata
    players.forEach((p, i) => p.role = roles[i]);
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// ================================================
// ROL GÖSTERME
// ================================================

function renderRoleRevealIntro() {
    statusDiv.textContent = 'Roller dağıtılıyor...';
    gameContainer.innerHTML = `
        <div class="phase-indicator">🎭</div>
        <div class="phase-title">Roller Dağıtıldı!</div>
        <div class="phase-subtitle">Telefonunu sırayla arkadaşlarına ver. Her oyuncu rolünü gizlice öğrenecek.</div>
        <div class="message-box">
            <p>📱 <strong>Nasıl Oynanır?</strong></p>
            <p>Her oyuncu sırayla telefonu alacak ve "Rolümü Gör" butonuna basacak.</p>
            <p>Rolünü gördükten sonra telefonu diğer oyuncuya verecek.</p>
        </div>
        <div class="action-buttons">
            <button class="btn primary" onclick="showNextRole()">Başla</button>
        </div>
    `;
}

function showNextRole() {
    if (currentPlayerIndex >= playerCount) {
        startNightPhase();
        return;
    }

    gameContainer.innerHTML = `
        <div class="phase-indicator">👤</div>
        <div class="phase-title">Oyuncu ${currentPlayerIndex + 1}</div>
        <div class="phase-subtitle">Telefonu al ve rolünü gör</div>
        <div class="action-buttons">
            <button class="btn primary" onclick="revealRole(${currentPlayerIndex})">Rolümü Gör</button>
        </div>
    `;
}

function revealRole(index) {
    const player = players[index];
    const roleInfo = ROLES[player.role];

    gameContainer.innerHTML = `
        <div class="role-reveal">
            <div class="role-reveal-icon">${roleInfo.icon}</div>
            <div class="role-reveal-name">${roleInfo.name}</div>
            <div class="role-reveal-desc">${roleInfo.desc}</div>
        </div>
        <div class="message-box">
            <p>🤫 Bu rolü kimseye söyleme!</p>
        </div>
        <div class="action-buttons">
            <button class="btn primary" onclick="hideRoleAndContinue()">Anladım, Gizle</button>
        </div>
    `;
}

function hideRoleAndContinue() {
    currentPlayerIndex++;
    showNextRole();
}

// ================================================
// GECE FAZI
// ================================================

function startNightPhase() {
    dayNumber++;
    currentPhase = 'night';
    document.body.className = 'night';
    nightActions = { vampireKill: null, seerCheck: null, doctorSave: null };

    statusDiv.textContent = `Gece ${dayNumber}`;

    gameContainer.innerHTML = `
        <div class="phase-indicator">🌙</div>
        <div class="phase-title">Gece ${dayNumber}</div>
        <div class="phase-subtitle">Herkes gözlerini kapatsın!</div>
        <div class="message-box">
            <p>Telefonu masaya koy veya bir kişi yönetsin.</p>
            <p>Sırayla roller aktif olacak.</p>
        </div>
        <div class="action-buttons">
            <button class="btn primary" onclick="vampiresTurn()">Vampirler Uyanır</button>
        </div>
    `;
}

function vampiresTurn() {
    const vampires = players.filter(p => p.alive && p.role === 'vampire');
    const targets = players.filter(p => p.alive && p.role !== 'vampire');

    statusDiv.textContent = 'Vampirler seçiyor...';

    let html = `
        <div class="phase-indicator">🧛</div>
        <div class="phase-title">Vampirler</div>
        <div class="phase-subtitle">Kimi öldürmek istiyorsunuz?</div>
        <div class="player-grid">
    `;

    targets.forEach(p => {
        html += `
            <div class="player-card ${nightActions.vampireKill === p.id ? 'selected' : ''}" 
                 onclick="selectVampireTarget(${p.id})">
                <div class="player-number">${p.id + 1}</div>
            </div>
        `;
    });

    html += `</div>
        <div class="action-buttons">
            <button class="btn primary" onclick="confirmVampireKill()" ${nightActions.vampireKill === null ? 'disabled' : ''}>Onayla</button>
        </div>
    `;

    gameContainer.innerHTML = html;
}

function selectVampireTarget(id) {
    nightActions.vampireKill = id;
    vampiresTurn(); // Yeniden render
}

function confirmVampireKill() {
    const hasSeer = players.some(p => p.alive && p.role === 'seer');
    const hasDoctor = players.some(p => p.alive && p.role === 'doctor');

    if (hasSeer) {
        seerTurn();
    } else if (hasDoctor) {
        doctorTurn();
    } else {
        endNightPhase();
    }
}

function seerTurn() {
    const seer = players.find(p => p.alive && p.role === 'seer');
    if (!seer) {
        const hasDoctor = players.some(p => p.alive && p.role === 'doctor');
        if (hasDoctor) doctorTurn();
        else endNightPhase();
        return;
    }

    const targets = players.filter(p => p.alive && p.id !== seer.id);

    statusDiv.textContent = 'Kahin bakıyor...';

    let html = `
        <div class="phase-indicator">👁️</div>
        <div class="phase-title">Kahin</div>
        <div class="phase-subtitle">Kimin rolünü görmek istiyorsun?</div>
        <div class="player-grid">
    `;

    targets.forEach(p => {
        html += `
            <div class="player-card ${nightActions.seerCheck === p.id ? 'selected' : ''}" 
                 onclick="selectSeerTarget(${p.id})">
                <div class="player-number">${p.id + 1}</div>
            </div>
        `;
    });

    html += `</div>
        <div class="action-buttons">
            <button class="btn primary" onclick="confirmSeerCheck()" ${nightActions.seerCheck === null ? 'disabled' : ''}>Bak</button>
        </div>
    `;

    gameContainer.innerHTML = html;
}

function selectSeerTarget(id) {
    nightActions.seerCheck = id;
    seerTurn();
}

function confirmSeerCheck() {
    const target = players.find(p => p.id === nightActions.seerCheck);
    const roleInfo = ROLES[target.role];
    const isEvil = roleInfo.team === 'evil';

    gameContainer.innerHTML = `
        <div class="phase-indicator">${isEvil ? '🧛' : '👨‍🌾'}</div>
        <div class="phase-title">Oyuncu ${target.id + 1}</div>
        <div class="phase-subtitle">${isEvil ? '❌ VAMPİR!' : '✅ Köylü tarafında'}</div>
        <div class="action-buttons">
            <button class="btn primary" onclick="afterSeerCheck()">Tamam</button>
        </div>
    `;
}

function afterSeerCheck() {
    const hasDoctor = players.some(p => p.alive && p.role === 'doctor');
    if (hasDoctor) {
        doctorTurn();
    } else {
        endNightPhase();
    }
}

function doctorTurn() {
    const doctor = players.find(p => p.alive && p.role === 'doctor');
    if (!doctor) {
        endNightPhase();
        return;
    }

    const targets = players.filter(p => p.alive);

    statusDiv.textContent = 'Doktor koruyor...';

    let html = `
        <div class="phase-indicator">🏥</div>
        <div class="phase-title">Doktor</div>
        <div class="phase-subtitle">Kimi korumak istiyorsun?</div>
        <div class="player-grid">
    `;

    targets.forEach(p => {
        html += `
            <div class="player-card ${nightActions.doctorSave === p.id ? 'selected' : ''}" 
                 onclick="selectDoctorTarget(${p.id})">
                <div class="player-number">${p.id + 1}</div>
            </div>
        `;
    });

    html += `</div>
        <div class="action-buttons">
            <button class="btn primary" onclick="confirmDoctorSave()" ${nightActions.doctorSave === null ? 'disabled' : ''}>Koru</button>
        </div>
    `;

    gameContainer.innerHTML = html;
}

function selectDoctorTarget(id) {
    nightActions.doctorSave = id;
    doctorTurn();
}

function confirmDoctorSave() {
    endNightPhase();
}

function endNightPhase() {
    // Vampir öldürme
    let killed = null;
    if (nightActions.vampireKill !== null && nightActions.vampireKill !== nightActions.doctorSave) {
        killed = players.find(p => p.id === nightActions.vampireKill);
        killed.alive = false;
        gameLog.push(`Gece ${dayNumber}: Oyuncu ${killed.id + 1} öldürüldü.`);
    }

    // Sonuç göster ve gündüze geç
    showNightResult(killed);
}

function showNightResult(killed) {
    statusDiv.textContent = 'Sabah oldu!';

    let message = '';
    if (killed) {
        message = `💀 Oyuncu ${killed.id + 1} geceleyin öldürüldü!`;
    } else if (nightActions.doctorSave === nightActions.vampireKill) {
        message = '🏥 Doktor birini kurtardı! Kimse ölmedi.';
    } else {
        message = '☀️ Sakin bir gece geçti.';
    }

    gameContainer.innerHTML = `
        <div class="phase-indicator">☀️</div>
        <div class="phase-title">Sabah Oldu</div>
        <div class="message-box">
            <p>${message}</p>
        </div>
        <div class="action-buttons">
            <button class="btn primary" onclick="checkWinCondition()">Devam Et</button>
        </div>
    `;
}

// ================================================
// GÜNDÜZ FAZI - OYLAMA
// ================================================

function startDayPhase() {
    currentPhase = 'day';
    document.body.className = 'day';
    votes = {};

    statusDiv.textContent = `Gündüz ${dayNumber}`;

    const alivePlayers = players.filter(p => p.alive);

    let html = `
        <div class="phase-indicator">☀️</div>
        <div class="phase-title">Tartışma Zamanı</div>
        <div class="phase-subtitle">Kim vampir olabilir? Tartışın!</div>
        <div class="player-grid">
    `;

    alivePlayers.forEach(p => {
        html += `
            <div class="player-card" onclick="toggleVote(${p.id})">
                <div class="player-number">${p.id + 1}</div>
                <div class="vote-count" id="votes-${p.id}">0 oy</div>
            </div>
        `;
    });

    html += `</div>
        <div class="message-box">
            <p>Herkes sırayla oy verebilir. En çok oy alan oyuncu oyundan çıkar.</p>
        </div>
        <div class="action-buttons">
            <button class="btn ghost" onclick="skipVote()">Kimseyi Asma</button>
            <button class="btn primary" onclick="executeVote()">Oylama Bitir</button>
        </div>
    `;

    gameContainer.innerHTML = html;
}

function toggleVote(id) {
    votes[id] = (votes[id] || 0) + 1;
    document.getElementById(`votes-${id}`).textContent = `${votes[id]} oy`;
}

function skipVote() {
    gameLog.push(`Gündüz ${dayNumber}: Kimse asılmadı.`);
    checkWinCondition();
}

function executeVote() {
    // En çok oyu bulan
    let maxVotes = 0;
    let executed = null;

    Object.entries(votes).forEach(([id, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            executed = players.find(p => p.id === parseInt(id));
        }
    });

    if (executed && maxVotes > 0) {
        executed.alive = false;
        const roleInfo = ROLES[executed.role];
        gameLog.push(`Gündüz ${dayNumber}: Oyuncu ${executed.id + 1} (${roleInfo.name}) asıldı.`);

        // Avcı mı kontrol et
        if (executed.role === 'hunter') {
            hunterRevenge(executed);
            return;
        }

        showExecutionResult(executed);
    } else {
        skipVote();
    }
}

function showExecutionResult(executed) {
    const roleInfo = ROLES[executed.role];

    gameContainer.innerHTML = `
        <div class="phase-indicator">⚖️</div>
        <div class="phase-title">Oyuncu ${executed.id + 1} Asıldı!</div>
        <div class="role-reveal">
            <div class="role-reveal-icon">${roleInfo.icon}</div>
            <div class="role-reveal-name">${roleInfo.name}</div>
        </div>
        <div class="action-buttons">
            <button class="btn primary" onclick="checkWinCondition()">Devam Et</button>
        </div>
    `;
}

function hunterRevenge(hunter) {
    const targets = players.filter(p => p.alive);

    gameContainer.innerHTML = `
        <div class="phase-indicator">🏹</div>
        <div class="phase-title">Avcı Öldü!</div>
        <div class="phase-subtitle">Son bir atış hakkı var. Kimi vuracak?</div>
        <div class="player-grid">
            ${targets.map(p => `
                <div class="player-card" onclick="hunterShoot(${p.id})">
                    <div class="player-number">${p.id + 1}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function hunterShoot(targetId) {
    const target = players.find(p => p.id === targetId);
    target.alive = false;
    gameLog.push(`Avcı son atışıyla Oyuncu ${target.id + 1}'i vurdu!`);

    const roleInfo = ROLES[target.role];
    gameContainer.innerHTML = `
        <div class="phase-indicator">💥</div>
        <div class="phase-title">Avcı Vurdu!</div>
        <div class="phase-subtitle">Oyuncu ${target.id + 1} (${roleInfo.name}) öldü!</div>
        <div class="action-buttons">
            <button class="btn primary" onclick="checkWinCondition()">Devam Et</button>
        </div>
    `;
}

// ================================================
// KAZANMA KONTROLÜ
// ================================================

function checkWinCondition() {
    const aliveVampires = players.filter(p => p.alive && p.role === 'vampire').length;
    const aliveGood = players.filter(p => p.alive && ROLES[p.role].team === 'good').length;

    if (aliveVampires === 0) {
        endGame('good');
    } else if (aliveVampires >= aliveGood) {
        endGame('evil');
    } else {
        startNightPhase();
    }
}

function endGame(winner) {
    currentPhase = 'end';
    document.body.className = '';

    const isGoodWin = winner === 'good';

    let rolesHtml = players.map(p => {
        const roleInfo = ROLES[p.role];
        return `<div style="margin:8px 0">
            ${p.alive ? '✅' : '💀'} Oyuncu ${p.id + 1}: ${roleInfo.icon} ${roleInfo.name}
        </div>`;
    }).join('');

    gameContainer.innerHTML = `
        <div class="phase-indicator">${isGoodWin ? '☀️' : '🧛'}</div>
        <div class="phase-title">${isGoodWin ? 'Köylüler Kazandı!' : 'Vampirler Kazandı!'}</div>
        <div class="message-box">
            <p><strong>Roller:</strong></p>
            ${rolesHtml}
        </div>
        <div class="action-buttons">
            <button class="btn primary" onclick="location.href='index.html'">Yeni Oyun</button>
        </div>
    `;
}

// Başlat
init();
