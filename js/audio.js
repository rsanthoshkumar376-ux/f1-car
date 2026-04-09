const AudioEngine = {
    ctx: null,
    masterGain: null,
    bgmNode: null,
    isMuted: false,
    
    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // Pure Mathematical Sound Generation
    algorithmicSound(freq, duration, type = 'sine', sweep = true) {
        if (!this.ctx) return;
        this.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (sweep) {
            osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + duration);
        }
        
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playCoin() {
        this.algorithmicSound(800 + (WorldEngine.seed % 400), 0.1, 'sine');
    },

    playPowerup() {
        this.algorithmicSound(200, 0.4, 'sawtooth');
    },

    playCrash() {
        if (!this.ctx) return;
        this.resume();
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Deterministic Noise Algorithm
        const r = WorldEngine.mulberry32(WorldEngine.seed + 123);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (r() * 2 - 1) * (1 - i / bufferSize);
        }
        
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, this.ctx.currentTime);
        
        source.connect(filter);
        filter.connect(this.masterGain);
        source.start();
    },

    playBGM() {
        if (!this.ctx || this.bgmNode) return;
        this.resume();
        
        // Algorithmic Ghost Drone (Deterministic)
        const duration = 4.0; 
        const sampleRate = this.ctx.sampleRate;
        const buffer = this.ctx.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        const r = WorldEngine.mulberry32(WorldEngine.seed + 999);
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            data[i] = Math.sin(2 * Math.PI * 40 * t) * 0.1 + (r() * 0.02);
        }
        this.bgmNode = this.ctx.createBufferSource();
        this.bgmNode.buffer = buffer;
        this.bgmNode.loop = true;
        this.bgmNode.connect(this.masterGain);
        this.bgmNode.start();

        this.startAlgorithmicMelody();
    },

    startAlgorithmicMelody() {
        // Frequency Scale calculated from Seed (Degrees of the scale)
        const baseFreq = 220 + (WorldEngine.seed % 220);
        const scale = [1, 1.125, 1.25, 1.333, 1.5, 1.666, 1.875]; // Just intonation ratios
        const freqs = scale.map(r => baseFreq * r);

        let index = 0;
        const r = WorldEngine.mulberry32(WorldEngine.seed + 444);

        const nextNote = () => {
            if (!this.bgmNode) return;
            
            const speedFact = window.Game.vehicle ? Math.abs(window.Game.vehicle.chassis.velocity.x) / 12 : 1;
            const tempo = Math.max(80, 400 - (speedFact * 200));
            
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            // Deterministic Random Walk
            const step = Math.floor(r() * 3) - 1;
            index = (index + step + freqs.length) % freqs.length;
            
            osc.frequency.setValueAtTime(freqs[index], this.ctx.currentTime);
            osc.type = r() < 0.5 ? 'square' : 'sawtooth';
            
            gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 500 + (speedFact * 2000);
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start();
            osc.stop(this.ctx.currentTime + 0.5);
            
            setTimeout(nextNote, tempo);
        };
        
        nextNote();
    },

    stopBGM() {
        if (this.bgmNode) {
            this.bgmNode.stop();
            this.bgmNode = null;
        }
    }
};

window.AudioEngine = AudioEngine;
