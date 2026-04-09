class TrackGenerator {
    constructor(world) {
        this.world = world;
        this.segments = [];
        this.items = [];
        this.lastX = 0;
        this.lastY = 600;
        this.chunkSize = 800;
        this.difficulty = 1;
        
        // Settings (Deterministic initialization)
        this.segmentThickness = 40;
        this.resolution = 20;
        this.hillAmplitude = 40;
        this.hillFrequency = 0.003;
        this.difficultySeed = WorldEngine.seed; // Use Master Seed
        this.complexity = 1.0;
    }

    generateChunk() {
        // Algorithmic Selection of Section Type
        const r = WorldEngine.getNext();
        const type = r < 0.2 ? 'loop' : (r < 0.35 ? 'jump' : 'hill');
        
        if (type === 'loop') {
            this.generateLoop();
        } else if (type === 'jump') {
            this.generateJump();
        } else {
            this.generateHills();
        }
    }

    generateHills() {
        const startX = this.lastX;
        const width = this.chunkSize;
        const numPoints = Math.floor(width / this.resolution);
        
        for (let i = 0; i <= numPoints; i++) {
            const x = startX + (i * this.resolution);
            const frequency = this.hillFrequency;
            const amplitude = this.hillAmplitude;
            const y = this.lastY + Math.sin(x * frequency + this.difficultySeed) * (amplitude / 4);
            
            this.addSegment(this.lastX, this.lastY, x, y);
            
            // Deterministic coin placement
            const coinRoll = WorldEngine.getNext();
            if (i % 5 === 0 && coinRoll < 0.4) {
                this.addItem(x, y - 60, 'coin');
            }
            
            this.lastX = x;
            this.lastY = y;
        }
    }

    generateJump() {
        const r = WorldEngine.getNext();
        const jumpWidth = 250 + (r * 250);
        const rampHeight = 120;
        
        // Up ramp
        this.addSegment(this.lastX, this.lastY, this.lastX + 150, this.lastY - rampHeight);
        this.lastX += 150;
        this.lastY -= rampHeight;
        
        // Final jump tip item
        this.addItem(this.lastX, this.lastY - 20, 'coin');

        // The Gap (Deterministic landing)
        const landingRoll = WorldEngine.getNext();
        this.lastX += jumpWidth;
        this.lastY += 50 + (landingRoll - 0.5) * 120;
        
        // Mid-air algorithmic tokens
        this.addItem(this.lastX - jumpWidth/2, this.lastY - 180, 'coin');
    }

    generateLoop() {
        const radius = 280;
        const centerX = this.lastX + radius;
        const centerY = this.lastY - radius;
        const segments = 32;
        
        for (let i = 0; i <= segments; i++) {
            const angle = Math.PI / 2 + (i / segments) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            this.addSegment(this.lastX, this.lastY, x, y);
            
            // Add coins around the loop algorithmically
            if (i % 4 === 0) {
                const coinX = centerX + Math.cos(angle) * (radius - 50);
                const coinY = centerY + Math.sin(angle) * (radius - 50);
                this.addItem(coinX, coinY, 'coin');
            }

            this.lastX = x;
            this.lastY = y;
        }
    }

    addSegment(x1, y1, x2, y2) {
        const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        
        const segment = Bodies.rectangle(
            (x1 + x2) / 2,
            (y1 + y2) / 2,
            length + 2,
            this.segmentThickness,
            {
                isStatic: true,
                angle: angle,
                friction: 1.0,
                label: 'track',
                render: { 
                    fillStyle: WorldEngine.colors.background, 
                    strokeStyle: WorldEngine.colors.primary, 
                    lineWidth: 3 
                }
            }
        );
        
        World.add(this.world, segment);
        this.segments.push(segment);
    }

    addItem(x, y, type) {
        const item = Bodies.circle(x, y, 15, {
            isSensor: true,
            isStatic: true,
            label: type,
            plugin: {
                reward: type === 'coin' ? 10 : 0
            }
        });
        World.add(this.world, item);
        this.items.push(item);
    }

    update(playerX) {
        const clearThreshold = playerX - 1200;
        this.segments = this.segments.filter(seg => {
            if (seg.position.x < clearThreshold) {
                World.remove(this.world, seg);
                return false;
            }
            return true;
        });

        this.items = this.items.filter(item => {
            if (item.position.x < clearThreshold) {
                World.remove(this.world, item);
                return false;
            }
            return true;
        });

        if (this.lastX < playerX + 3500) {
            this.complexity = 1.0 + (playerX / 40000); 
            this.hillAmplitude = 40 * this.complexity;
            this.hillFrequency = 0.003 * Math.sqrt(this.complexity);
            
            this.generateChunk();
            this.difficulty += 0.01;
        }
    }
}

window.TrackGenerator = TrackGenerator;
