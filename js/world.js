const WorldEngine = {
    seed: 0,
    prng: null,
    colors: {
        primary: '#20ff77',
        secondary: '#8822ff',
        accent: '#00ccff',
        background: '#05030a'
    },
    
    init(seed) {
        this.seed = seed || Math.floor(Math.random() * 1000000);
        this.prng = this.mulberry32(this.seed);
        this.generatePalette();
        console.log(`ALGORITHMIC_INIT: Master Seed ${this.seed}`);
    },

    // Seedable Pseudo-Random Number Generator
    mulberry32(a) {
        return function() {
          var t = a += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    },

    // Get a seeded random value
    getNext() {
        return this.prng ? this.prng() : Math.random();
    },

    generatePalette() {
        const r = this.mulberry32(this.seed);
        const hue1 = Math.floor(r() * 360);
        const hue2 = (hue1 + 140) % 360;
        const hue3 = (hue1 + 220) % 360;
        
        this.colors.primary = `hsl(${hue1}, 100%, 60%)`;
        this.colors.secondary = `hsl(${hue2}, 80%, 50%)`;
        this.colors.accent = `hsl(${hue3}, 100%, 70%)`;
        
        document.documentElement.style.setProperty('--neon-blue', this.colors.primary);
        document.documentElement.style.setProperty('--neon-pink', this.colors.secondary);
    }
};

window.WorldEngine = WorldEngine;
