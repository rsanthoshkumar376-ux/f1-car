const Levels = {
    prefixes: ["SECTOR", "GRID", "SEQUENCE", "EQUATION", "ROOT", "VOID", "BINARY", "CORE", "DELTA", "OMEGA"],
    suffixes: ["ALPHA", "GAMMA", "X", "PRIME", "LINK", "PULSE", "FLOW", "NODE", "GHOST", "REDACTED"],
    
    currentLevelSeed: 0,

    generateLevel(index) {
        const seed = WorldEngine.seed + (index * 1337);
        const r = WorldEngine.mulberry32(seed);

        const name = this.prefixes[Math.floor(r() * this.prefixes.length)] + " " + 
                     this.suffixes[Math.floor(r() * this.suffixes.length)];
        
        return {
            id: index,
            name: name,
            seed: seed,
            objectiveDescription: `Decrypt Sector ${index} at ${Math.floor(r() * 100)}% Complexity.`,
            distanceGoal: 1000 + (index * 500),
            unlocked: true, // For algorithmic mode, all accessible
            completed: false
        };
    },

    get data() {
        const list = [];
        for(let i=0; i<10; i++) {
            list.push(this.generateLevel(i));
        }
        return list;
    },

    init() {
        console.log("LEVELS: Algorithmic missions online.");
    },

    getLevel(id) {
        return this.generateLevel(parseInt(id) || 0);
    }
};

window.Levels = Levels;
