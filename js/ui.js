const UI = {
    elements: {
        hud: document.getElementById('hud'),
        score: document.getElementById('score-value'),
        coins: document.getElementById('coin-value'),
        combo: document.getElementById('combo-multiplier'),
        speedBar: document.getElementById('speed-bar'),
        gravityStatus: document.getElementById('gravity-status'),
        startScreen: document.getElementById('start-screen'),
        gameOverScreen: document.getElementById('game-over-screen'),
        pauseScreen: document.getElementById('pause-screen'),
        finalScore: document.getElementById('final-score'),
        finalCoins: document.getElementById('final-coins'),
        finalDistance: document.getElementById('final-distance')
    },

    init() {
        // Button listeners
        document.getElementById('start-btn').onclick = () => window.Game.start();
        document.getElementById('levels-btn').onclick = () => this.showLevels();
        document.getElementById('garage-btn').onclick = () => this.showGarage();
        document.getElementById('back-to-menu-levels-btn').onclick = () => this.showStart();
        document.getElementById('back-to-menu-garage-btn').onclick = () => this.showStart();
        document.getElementById('retry-btn').onclick = () => window.Game.restart();
        document.getElementById('resume-btn').onclick = () => window.Game.resume();
        document.getElementById('pause-btn').onclick = () => window.Game.pause();
        document.getElementById('autopilot-btn').onclick = () => window.Game.toggleAutopilot();
        document.getElementById('main-menu-btn').onclick = () => location.reload();
        document.getElementById('quit-btn').onclick = () => location.reload();
    },

    showStart() {
        this.hideAll();
        this.elements.startScreen.classList.remove('hidden');
    },

    showHUD() {
        this.elements.hud.classList.remove('hidden');
    },

    showLevels() {
        this.hideAll();
        this.elements.levelsScreen = document.getElementById('levels-screen');
        this.elements.levelsScreen.classList.remove('hidden');
        this.renderLevelsGrid();
    },

    showGarage() {
        this.hideAll();
        this.elements.garageScreen = document.getElementById('garage-screen');
        this.elements.garageScreen.classList.remove('hidden');
        this.renderGarageGrid();
    },

    renderGarageGrid() {
        const grid = document.getElementById('garage-grid');
        grid.innerHTML = '';
        Garage.init();
        const currentCar = Garage.getSelectedCar();

        Garage.getCars().forEach(car => {
            const card = document.createElement('div');
            const isEquipped = car.id === currentCar.id;
            card.className = `level-card ${car.unlocked ? '' : 'locked'} ${isEquipped ? 'equipped' : ''}`;
            card.innerHTML = `
                <h3>${car.name}</h3>
                <p class="level-objective">${car.description}</p>
                <div class="stats-mini-container">
                    <div class="stats-mini">SPEED: ${car.stats.speed}/10</div>
                    <div class="stats-mini">STABILITY: ${car.stats.stability}/10</div>
                    <div class="stats-mini">JUMP: ${car.stats.jump}/10</div>
                </div>
                ${!car.unlocked ? `<button class="buy-btn">BUY: ${car.price} 💰</button>` : (isEquipped ? '<b>EQUIPPED</b>' : '<button class="equip-btn">EQUIP</button>')}
            `;
            if (car.unlocked) {
                card.onclick = () => {
                    Garage.selectCar(car.id);
                    this.renderGarageGrid();
                };
            } else {
                card.querySelector('.buy-btn').onclick = (e) => {
                    e.stopPropagation();
                    if (Garage.unlockCar(car.id, Gameplay.coins || 0)) {
                        this.renderGarageGrid();
                    }
                };
            }
            grid.appendChild(card);
        });
    },

    renderLevelsGrid() {
        const grid = document.getElementById('levels-grid');
        grid.innerHTML = '';
        Levels.init();
        
        Levels.data.forEach(lvl => {
            const card = document.createElement('div');
            card.className = `level-card ${lvl.unlocked ? '' : 'locked'} ${lvl.completed ? 'completed' : ''}`;
            card.innerHTML = `
                ${lvl.completed ? '<div class="level-status">✓ DONE</div>' : ''}
                <h3>${lvl.name}</h3>
                <p class="level-objective">${lvl.objectiveDescription}</p>
                ${!lvl.unlocked ? '<p style="color:red; font-size:0.7rem; margin-top:0.5rem;">[ LOCKED ]</p>' : ''}
            `;
            if (lvl.unlocked) {
                card.onclick = () => window.Game.startLevel(lvl.id);
            }
            grid.appendChild(card);
        });
    },

    showGameOver(score, coins, distance, isWin = false) {
        this.hideAll();
        this.elements.gameOverScreen.classList.remove('hidden');
        
        const title = this.elements.gameOverScreen.querySelector('h1');
        title.innerText = isWin ? "SECTOR CLEARED" : "DRIVE TERMINATED";
        title.className = isWin ? "success" : "critical";
        
        this.elements.finalScore.innerText = score;
        this.elements.finalCoins.innerText = coins;
        this.elements.finalDistance.innerText = distance + 'm';
    },

    hideAll() {
        this.elements.startScreen.classList.add('hidden');
        if (this.elements.levelsScreen) this.elements.levelsScreen.classList.add('hidden');
        if (this.elements.garageScreen) this.elements.garageScreen.classList.add('hidden');
        document.getElementById('levels-screen').classList.add('hidden');
        document.getElementById('garage-screen').classList.add('hidden');
        this.elements.gameOverScreen.classList.add('hidden');
        this.elements.pauseScreen.classList.add('hidden');
        this.elements.hud.classList.add('hidden');
    },

    updateScore(val) {
        this.elements.score.innerText = val.toString().padStart(6, '0');
    },

    updateCoins(val) {
        this.elements.coins.innerText = val;
    },

    updateEntropy(val) {
        const el = document.getElementById('entropy-value');
        if (el) el.innerText = val.toFixed(2);
    },

    updateCombo(val) {
        if (val > 1) {
            this.elements.combo.classList.remove('hidden');
            this.elements.combo.innerText = `x${val}`;
        } else {
            this.elements.combo.classList.add('hidden');
        }
    },

    updateSpeed(val, max) {
        const percent = Math.min(100, (val / max) * 100);
        this.elements.speedBar.style.width = percent + '%';
    },

    updateGravity(dir) {
        if (dir < 0) {
            this.elements.gravityStatus.classList.add('flipped');
        } else {
            this.elements.gravityStatus.classList.remove('flipped');
        }
    },

    updatePowerup(type, timeLeft) {
        const p = document.getElementById(type);
        if (p) p.style.width = `${(timeLeft / 5000) * 100}%`;
    },

    updateDataStream() {
        if (!window.Game || !window.Game.isRunning) return;
        const container = document.getElementById('data-stream');
        if (!container) return;

        const v = window.Game.vehicle;
        const pos = v.getPosition();
        const vel = v.chassis.velocity;
        
        const data = [
            `> SECTOR_X: ${pos.x.toFixed(2)}`,
            `> VECTOR_Y: ${vel.y.toFixed(4)}`,
            `> GRAV_VAL: ${Physics.getGravity().toFixed(2)}`,
            `> COMP_LVL: ${window.Game.track.complexity.toFixed(2)}`,
            `> STAB_SYS: ONLINE`,
            `> GEN_SEED: ${window.Game.track.difficultySeed.toFixed(0)}`
        ];

        container.innerHTML = data.map(line => `<div class="data-line">${line}</div>`).join('');
        this.updateActiveFormula();
    },

    updateActiveFormula() {
        const s = WorldEngine.seed;
        const formula = `λ = ∫(Σ${s} + ∂x) / √(π * φⁿ)`;
        const el = document.getElementById('active-formula');
        if (el) el.innerText = formula;
    },

    showNotification(text) {
        // Could add a toast system here
        console.log("NOTIF:", text);
    }
};

window.UI = UI;
