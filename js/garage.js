const Garage = {
    selectedCarId: 0,
    carCount: 20, // Infinite list restricted to 20 for UI paging simulation
    
    // Algorithmic Name Parts
    prefixes: ["NOVA", "DELTA", "CYBER", "VOID", "SIGMA", "PHANTOM", "NEON", "VECTOR", "ROOT", "BINARY"],
    suffixes: ["COMMANDER", "DRIFTER", "X", "CORE", "PULSE", "GHOST", "WRATH", "PRIME", "LINK", "SEQUENCE"],

    generateCar(index) {
        // Create a local PRNG for this specific car index
        const seed = WorldEngine.seed + (index * 777);
        const r = WorldEngine.mulberry32(seed);

        const name = this.prefixes[Math.floor(r() * this.prefixes.length)] + " " + 
                     this.suffixes[Math.floor(r() * this.suffixes.length)];
        
        // Algorithmic Stats (Balanced around 10)
        const speed = Math.floor(r() * 8) + 4;
        const stability = Math.floor(r() * 8) + 4;
        const jump = Math.floor(r() * 8) + 4;

        return {
            id: index,
            name: name,
            type: 'formula',
            description: `Seeded Performance Construct [Sector ${index}].`,
            stats: { speed, stability, jump },
            physics: {
                torque: 0.25 + (speed * 0.03), // F1 torque boost
                maxAngVel: 0.5 + (speed * 0.08), // High F1 velocity
                chassisWidth: 100 + (stability * 6), // Wide F1 base
                chassisHeight: 15 + (jump * 1.5) // Lower F1 height
            },
            color: WorldEngine.colors.primary,
            unlocked: index < 3, // First 3 are free
            price: index * 500
        };
    },

    getCars() {
        const cars = [];
        for(let i=0; i<this.carCount; i++) {
            cars.push(this.generateCar(i));
        }
        return cars;
    },

    init() {
        const saved = localStorage.getItem('loop_rush_algorithmic_garage');
        if (saved) {
            this.selectedCarId = parseInt(saved) || 0;
        }
    },

    save() {
        localStorage.setItem('loop_rush_algorithmic_garage', this.selectedCarId);
    },

    selectCar(id) {
        this.selectedCarId = id;
        this.save();
        return true;
    },

    getSelectedCar() {
        return this.generateCar(this.selectedCarId);
    },

    unlockCar(id, coins) {
        return coins >= (id * 500);
    }
};

window.Garage = Garage;
