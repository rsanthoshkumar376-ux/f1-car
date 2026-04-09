const Gameplay = {
    score: 0,
    coins: 0,
    multiplier: 1,
    comboTimer: 0,
    isGameOver: false,
    distance: 0,
    currentLevel: null,
    objectiveProgress: 0,
    
    powerups: {
        nitro: 0,
        magnet: 0,
        shield: 0,
        slowmo: 0
    },

    init(level = null) {
        this.score = 0;
        this.coins = 0;
        this.multiplier = 1;
        this.isGameOver = false;
        this.distance = 0;
        this.currentLevel = level;
        this.objectiveProgress = 0;
        
        // Reset powerups
        for (let p in this.powerups) this.powerups[p] = 0;
    },

    update(dt, playerX) {
        if (this.isGameOver) return;

        // Score based on distance
        const currentDist = Math.max(0, Math.floor(playerX / 100));
        if (currentDist > this.distance) {
            const delta = currentDist - this.distance;
            this.score += delta * this.multiplier;
            this.distance = currentDist;
            
            if (this.currentLevel && this.currentLevel.objectiveType === 'distance') {
                this.checkObjective(this.distance);
            }
        }

        // Combo cooldown
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.multiplier = 1;
                UI.updateCombo(0);
            }
        }

        // Powerups cooldown
        for (let p in this.powerups) {
            if (this.powerups[p] > 0) {
                this.powerups[p] -= dt;
                UI.updatePowerup(p, this.powerups[p]);
            }
        }
    },

    collectCoin() {
        this.coins++;
        this.score += 100 * this.multiplier;
        
        if (this.currentLevel && this.currentLevel.objectiveType === 'coins') {
            this.checkObjective(this.coins);
        }

        // Increase combo
        this.multiplier++;
        this.comboTimer = 2000; // 2 seconds
        
        UI.updateCoins(this.coins);
        UI.updateScore(this.score);
        UI.updateCombo(this.multiplier);
        
        AudioEngine.playCoin();
    },

    collectPowerup() {
        const types = ['nitro', 'magnet', 'shield', 'slowmo'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.powerups[type] = 5000; // 5 seconds
        UI.showNotification(`POWERUP: ${type.toUpperCase()}`);
        AudioEngine.playPowerup();
    },

    onCrash() {
        if (this.powerups.shield > 0) {
            this.powerups.shield = 0; // Consume shield
            return false; // Not dead
        }
        this.isGameOver = true;
        AudioEngine.playCrash();
        UI.showGameOver(this.score, this.coins, this.distance);
        return true;
    },

    checkObjective(val) {
        if (!this.currentLevel || this.isGameOver) return;
        
        if (val >= this.currentLevel.objectiveTarget) {
            this.isLevelComplete = true;
            this.isGameOver = true; // Use game over state for now
            Levels.completeLevel(this.currentLevel.id);
            UI.showNotification("LEVEL COMPLETE!");
            UI.showGameOver(this.score, this.coins, this.distance, true);
        }
    }
};

window.Gameplay = Gameplay;
