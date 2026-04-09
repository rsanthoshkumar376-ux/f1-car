/**
 * FORMULA ALGORITHMIC: SPECTRAL RACER
 * A single-file, self-contained game engine.
 * All logic is in one place to prevent loading/dependency issues.
 */

// =====================================================================
// 1. WORLD ENGINE - Deterministic Seed System
// =====================================================================
const WorldEngine = {
    seed: 42,
    _state: 42,

    mulberry32(seed) {
        return function() {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    },

    init(seed) {
        this.seed = seed || Math.floor(Math.random() * 99999) + 1000;
        this._rng = this.mulberry32(this.seed);
        // Compute deterministic color palette from seed
        const hue = (this.seed % 360);
        this.colors = {
            primary: `hsl(${hue}, 100%, 60%)`,
            accent: `hsl(${(hue + 120) % 360}, 100%, 60%)`,
            background: '#050310',
            track: '#20ff77',
        };
        console.log(`WorldEngine initialized with seed: ${this.seed}`);
    },

    next() {
        return this._rng();
    }
};

// =====================================================================
// 2. AUDIO ENGINE - Procedural Synthesis
// =====================================================================
const AudioEngine = {
    ctx: null,
    masterGain: null,
    enabled: true,

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.4;
            this.masterGain.connect(this.ctx.destination);
        } catch (e) {
            console.warn('AudioEngine: Web Audio API unavailable.', e);
            this.enabled = false;
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    play(freq, duration, type = 'sine', vol = 0.15) {
        if (!this.enabled || !this.ctx) return;
        try {
            this.resume();
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + duration);
            g.gain.setValueAtTime(vol, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(g);
            g.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    },

    playCoin()    { this.play(880, 0.12, 'sine');      },
    playJump()    { this.play(440, 0.2, 'square', 0.1); },
    playCrash()   { this.play(80, 0.5, 'sawtooth', 0.2); },
    playNitro()   { this.play(220, 0.3, 'sawtooth', 0.08); },
};

// =====================================================================
// 3. GARAGE - Car Data (Procedurally Generated)
// =====================================================================
const Garage = {
    selectedId: 0,
    prefixes: ['NOVA', 'DELTA', 'CYBER', 'VOID', 'SIGMA', 'PHANTOM', 'NEON', 'VECTOR'],
    suffixes: ['COMMANDER', 'DRIFTER', 'CORE', 'PULSE', 'GHOST', 'WRATH', 'PRIME'],

    generateCar(id) {
        const r = WorldEngine.mulberry32(WorldEngine.seed + id * 777);
        const speed     = 4 + Math.floor(r() * 8);   // 4–11
        const stability = 4 + Math.floor(r() * 8);
        const grip      = 4 + Math.floor(r() * 8);
        const name = this.prefixes[Math.floor(r() * this.prefixes.length)]
                   + ' ' + this.suffixes[Math.floor(r() * this.suffixes.length)];
        const hue = (WorldEngine.seed * (id + 7)) % 360;
        return {
            id,
            name,
            color: `hsl(${hue}, 100%, 60%)`,
            stats: { speed, stability, grip },
            physics: {
                torque:       0.20 + speed * 0.025,
                maxAngVel:    0.45 + speed * 0.07,
                chassisW:     90 + stability * 5,
                chassisH:     18 + grip * 1.2,
            },
            unlocked: id < 3,
            price: id * 500,
        };
    },

    getCars(count = 12) {
        return Array.from({ length: count }, (_, i) => this.generateCar(i));
    },

    getSelectedCar() {
        return this.generateCar(this.selectedId);
    },

    init() {
        const saved = localStorage.getItem('fa_selected_car');
        if (saved !== null) this.selectedId = parseInt(saved) || 0;
    },

    select(id) {
        this.selectedId = id;
        localStorage.setItem('fa_selected_car', id);
    },
};

// =====================================================================
// 4. MATTER.JS PHYSICS HELPERS
// =====================================================================
// We use Matter.js globals safely by accessing them through the Matter namespace
function mEngine()     { return Matter.Engine; }
function mBodies()     { return Matter.Bodies; }
function mBody()       { return Matter.Body; }
function mWorld()      { return Matter.World; }
function mComposite()  { return Matter.Composite; }
function mConstraint() { return Matter.Constraint; }
function mEvents()     { return Matter.Events; }

// =====================================================================
// 5. TRACK GENERATOR
// =====================================================================
class TrackGenerator {
    constructor(world, seed) {
        this.world    = world;
        this.segments = [];
        this.coins    = [];
        this.lastX    = 0;
        this.lastY    = 500;
        this.seed     = seed;
        this._rng     = WorldEngine.mulberry32(seed);
        this.difficulty = 1;
    }

    generate(initialLength = 5) {
        // Always start with a flat section for safety
        this._addFlat(1200);
        for (let i = 0; i < initialLength; i++) this._nextChunk();
    }

    _nextChunk() {
        const r = this._rng();
        if (r < 0.15) {
            this._addLoop();
        } else if (r < 0.35) {
            this._addJump();
        } else {
            this._addHills();
        }
    }

    _addFlat(width = 800) {
        const step = 20;
        for (let i = 0; i < width; i += step) {
            this._seg(this.lastX, this.lastY, this.lastX + step, this.lastY);
            this.lastX += step;
        }
    }

    _addHills() {
        const width = 600 + this._rng() * 600;
        const step  = 20;
        const amp   = 30 * this.difficulty;
        const freq  = 0.004 + this._rng() * 0.004;
        const startX = this.lastX;

        for (let i = 0; i < width; i += step) {
            const x1 = startX + i;
            const y1 = this.lastY;
            const x2 = startX + i + step;
            const y2 = 500 + Math.sin(x2 * freq) * amp;
            this._seg(x1, y1, x2, y2);
            if (i % 80 === 0 && this._rng() < 0.5) {
                this._coin(x2, y2 - 60);
            }
            this.lastX = x2;
            this.lastY = y2;
        }
    }

    _addJump() {
        const rH = 80 + this._rng() * 80;
        const rW = 200 + this._rng() * 200;

        // ramp up
        this._seg(this.lastX, this.lastY, this.lastX + 150, this.lastY - rH);
        this.lastX += 150;
        this.lastY -= rH;

        // air coin
        this._coin(this.lastX + rW / 2, this.lastY - 100);

        // gap
        this.lastX += rW;
        this.lastY += 30 + this._rng() * 40;
    }

    _addLoop() {
        const radius = 200 + this._rng() * 100;
        const centerX = this.lastX + radius;
        const centerY = this.lastY - radius;
        const segs = 28;

        for (let i = 0; i <= segs; i++) {
            const a1 = Math.PI / 2 + (i / segs) * Math.PI * 2;
            const a2 = Math.PI / 2 + ((i + 1) / segs) * Math.PI * 2;
            const x1 = centerX + Math.cos(a1) * radius;
            const y1 = centerY + Math.sin(a1) * radius;
            const x2 = centerX + Math.cos(a2) * radius;
            const y2 = centerY + Math.sin(a2) * radius;
            this._seg(x1, y1, x2, y2);
            if (i % 5 === 0) this._coin(
                centerX + Math.cos(a1) * (radius - 45),
                centerY + Math.sin(a1) * (radius - 45)
            );
            this.lastX = x2;
            this.lastY = y2;
        }
    }

    _seg(x1, y1, x2, y2) {
        const len   = Math.hypot(x2 - x1, y2 - y1);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const seg   = mBodies().rectangle(
            (x1 + x2) / 2, (y1 + y2) / 2,
            len + 2, 40,
            { isStatic: true, angle, friction: 1.0, label: 'track' }
        );
        mWorld().add(this.world, seg);
        this.segments.push(seg);
    }

    _coin(x, y) {
        const coin = mBodies().circle(x, y, 14, {
            isSensor: true, isStatic: true, label: 'coin'
        });
        mWorld().add(this.world, coin);
        this.coins.push(coin);
    }

    update(playerX) {
        // Prune old segments
        const threshold = playerX - 1500;
        this.segments = this.segments.filter(s => {
            if (s.position.x < threshold) { mWorld().remove(this.world, s); return false; }
            return true;
        });
        this.coins = this.coins.filter(c => {
            if (c.position.x < threshold) { mWorld().remove(this.world, c); return false; }
            return true;
        });

        // Generate ahead
        if (this.lastX < playerX + 4000) {
            this.difficulty = 1 + playerX / 30000;
            this._nextChunk();
        }
    }
}

// =====================================================================
// 6. VEHICLE
// =====================================================================
class Vehicle {
    constructor(world, x, y, carData) {
        this.world       = world;
        this.carData     = carData;
        this.throttle    = 0;
        this.nitro       = false;
        this.isGrounded  = false;

        const W = carData.physics.chassisW;
        const H = carData.physics.chassisH;
        const R = 20;  // wheel radius
        const group = mBody().nextGroup(true);
        const cf = { group };

        this.chassis = mBodies().rectangle(x, y, W, H, {
            collisionFilter: cf,
            density: 0.002,
            friction: 0,
            chamfer: { radius: 6 },
            label: 'chassis',
        });

        const wOpt = {
            collisionFilter: cf,
            friction: 5.0,
            frictionStatic: 15.0,
            density: 0.005,
            label: 'wheel',
        };
        this.wBack  = mBodies().circle(x - 32, y + 22, R, wOpt);
        this.wFront = mBodies().circle(x + 32, y + 22, R, wOpt);

        const sOpt = { stiffness: 0.18, damping: 0.25, length: 12 };
        this.sBack = mConstraint().create({
            bodyA: this.chassis, pointA: { x: -32, y: H / 2 },
            bodyB: this.wBack,   ...sOpt,
        });
        this.sFront = mConstraint().create({
            bodyA: this.chassis, pointA: { x: 32, y: H / 2 },
            bodyB: this.wFront,  ...sOpt,
        });

        const comp = mComposite().create();
        mComposite().add(comp, [this.chassis, this.wBack, this.wFront, this.sBack, this.sFront]);
        mWorld().add(this.world, comp);
    }

    update(keys) {
        const t = this.carData.physics.torque;
        const maxV = this.carData.physics.maxAngVel;
        const boost = this.nitro ? 2.2 : 1.0;

        let dir = 0;
        if (keys['d'] || keys['arrowright']) dir = 1;
        if (keys['a'] || keys['arrowleft'])  dir = -1;
        this.throttle = dir;

        if (dir !== 0) {
            mBody().setAngularVelocity(this.wBack,  this.wBack.angularVelocity  + t * dir * boost);
            mBody().setAngularVelocity(this.wFront, this.wFront.angularVelocity + t * dir * boost);
        }

        // Speed cap
        const cap = maxV * boost;
        if (Math.abs(this.wBack.angularVelocity)  > cap) mBody().setAngularVelocity(this.wBack,  Math.sign(this.wBack.angularVelocity)  * cap);
        if (Math.abs(this.wFront.angularVelocity) > cap) mBody().setAngularVelocity(this.wFront, Math.sign(this.wFront.angularVelocity) * cap);

        // Air correction
        if (!this.isGrounded) {
            const angle = this.chassis.angle;
            mBody().setAngularVelocity(this.chassis, this.chassis.angularVelocity + (-angle) * 0.003);
        }
    }

    get position() { return this.chassis.position; }
    get angle()    { return this.chassis.angle; }
    get speed()    { return Math.hypot(this.chassis.velocity.x, this.chassis.velocity.y); }
}

// =====================================================================
// 7. RENDERER
// =====================================================================
class GameRenderer {
    constructor(canvas, vehicle, track, engine) {
        this.canvas  = canvas;
        this.ctx     = canvas.getContext('2d');
        this.vehicle = vehicle;
        this.track   = track;
        this.engine  = engine;
        this.camX    = 0;
        this.camY    = 0;
        this.particles = [];
        this.gravDir  = 1;
    }

    render() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const v = this.vehicle;
        const pos = v.position;

        // Smooth camera
        const tX = pos.x - W * 0.32;
        const tY = pos.y - (this.gravDir > 0 ? H * 0.6 : H * 0.4);
        this.camX += (tX - this.camX) * 0.12;
        this.camY += (tY - this.camY) * 0.12;

        // Background
        ctx.fillStyle = '#050310';
        ctx.fillRect(0, 0, W, H);

        // Grid parallax
        this._drawGrid(W, H);

        ctx.save();
        ctx.translate(-this.camX, -this.camY);

        // Track
        this._drawTrack();

        // Coins
        this._drawCoins();

        // Particles
        this._updateParticles(ctx);

        // Vehicle
        this._drawVehicle(ctx, v);

        ctx.restore();
    }

    _drawGrid(W, H) {
        const ctx = this.ctx;
        const px = this.camX * 0.2;
        const py = this.camY * 0.2;
        const size = 160;
        ctx.strokeStyle = 'rgba(136,34,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = -(px % size); x < W; x += size) {
            ctx.moveTo(x, 0); ctx.lineTo(x, H);
        }
        for (let y = -(py % size); y < H; y += size) {
            ctx.moveTo(0, y); ctx.lineTo(W, y);
        }
        ctx.stroke();
    }

    _drawTrack() {
        const ctx = this.ctx;
        this.track.segments.forEach(seg => {
            const verts = seg.vertices;
            ctx.beginPath();
            ctx.moveTo(verts[0].x, verts[0].y);
            for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.fill();
            ctx.strokeStyle = '#20ff77';
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#20ff77';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
    }

    _drawCoins() {
        const ctx = this.ctx;
        const t = Date.now() * 0.003;
        this.track.coins.forEach(coin => {
            const x = coin.position.x;
            const y = coin.position.y;
            ctx.beginPath();
            ctx.arc(x, y, 14, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd700';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffd700';
            ctx.fill();
            ctx.shadowBlur = 0;
            // Inner glow
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,200,0.8)';
            ctx.fill();
        });
    }

    _drawVehicle(ctx, v) {
        const car = this.vehicle.carData;
        const color = car.color;

        // Trail particles
        if (Math.random() < 0.5) {
            this.particles.push({
                x: v.position.x, y: v.position.y,
                vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
                life: 1, color: color + '88', size: 3 + Math.random() * 3
            });
        }

        // Chassis
        ctx.save();
        ctx.translate(v.position.x, v.position.y);
        ctx.rotate(v.angle);

        const W = this.vehicle.carData.physics.chassisW;
        const H = this.vehicle.carData.physics.chassisH;

        ctx.shadowBlur = 20;
        ctx.shadowColor = color;

        // Main body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-W/2, -H/2, W, H, 4);
        ctx.fill();

        // Cockpit dome
        const grad = ctx.createRadialGradient(0, -H/2 - 4, 1, 0, -H/2 - 4, 14);
        grad.addColorStop(0, 'rgba(0,200,255,0.9)');
        grad.addColorStop(1, 'rgba(0,50,100,0.3)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, -H/2, 12, 8, 0, Math.PI, 0);
        ctx.fill();

        // Rear wing
        ctx.fillStyle = color;
        ctx.fillRect(-W/2 - 8, -H/2 - 10, 6, 12);
        ctx.fillRect(-W/2 - 20, -H/2 - 10, 25, 4);

        // Front wing
        ctx.fillRect(W/2 + 2, -H/2 + 4, 4, 10);
        ctx.fillRect(W/2 - 8,  -H/2 + 8, 18, 4);

        ctx.shadowBlur = 0;
        ctx.restore();

        // Wheels
        [this.vehicle.wBack, this.vehicle.wFront].forEach(w => {
            ctx.save();
            ctx.translate(w.position.x, w.position.y);
            ctx.rotate(w.angle);
            ctx.beginPath();
            ctx.arc(0, 0, w.circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#111';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.shadowBlur = 8;
            ctx.shadowColor = color;
            ctx.stroke();
            // Tread lines
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 0;
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(w.circleRadius, 0);
                ctx.stroke();
                ctx.rotate(Math.PI / 3);
            }
            ctx.restore();
        });
    }

    _updateParticles(ctx) {
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.05;
        });
        ctx.globalAlpha = 1;
    }

    addBurst(x, y, color, count = 15) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1, color, size: 2 + Math.random() * 4
            });
        }
    }
}

// =====================================================================
// 8. UI MANAGER
// =====================================================================
const UI = {
    score: 0,
    coins: 0,
    dist: 0,
    combo: 1,
    comboTimer: 0,
    _notifTimer: null,

    reset() {
        this.score = 0; this.coins = 0; this.dist = 0; this.combo = 1; this.comboTimer = 0;
    },

    updateHUD(vehicle) {
        const pos = vehicle.position;
        this.dist = Math.max(0, Math.floor((pos.x - 200) / 100));
        document.getElementById('score-display').textContent = String(this.score).padStart(6, '0');
        document.getElementById('coins-display').textContent = this.coins;
        document.getElementById('dist-display').textContent  = this.dist + 'm';
        // Speed bar
        const spd = Math.min(1, vehicle.speed / 12);
        document.getElementById('speed-bar').style.width = (spd * 100) + '%';
    },

    addCoin(x, y) {
        this.coins++;
        this.combo += 0.5;
        this.comboTimer = 2000;
        this.score += Math.floor(100 * this.combo);
        const cd = document.getElementById('combo-pop');
        if (cd && this.combo > 2) {
            cd.textContent = 'x' + this.combo.toFixed(1);
            cd.style.opacity = '1';
        }
        AudioEngine.playCoin();
        this.notify('SCORE +' + Math.floor(100 * this.combo));
    },

    tickCombo(dt) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 1;
                const cd = document.getElementById('combo-pop');
                if (cd) cd.style.opacity = '0';
            }
        }
        this.score += Math.floor(this.combo * 0.01);
    },

    notify(text, duration = 1500) {
        const el = document.getElementById('notification');
        el.textContent = text;
        el.style.opacity = '1';
        clearTimeout(this._notifTimer);
        this._notifTimer = setTimeout(() => { el.style.opacity = '0'; }, duration);
    },

    setGravityIndicator(dir) {
        const el = document.getElementById('grav-icon');
        if (el) el.style.transform = dir > 0 ? '' : 'scaleY(-1)';
    },

    showHUD()      {
        document.getElementById('hud').style.display = 'block';
        document.getElementById('speed-wrap').style.display = 'block';
        const mc = document.getElementById('mobile-controls');
        if (mc) mc.style.display = 'block';
    },
    hideHUD()      {
        document.getElementById('hud').style.display = 'none';
        document.getElementById('speed-wrap').style.display = 'none';
        const mc = document.getElementById('mobile-controls');
        if (mc) mc.style.display = 'none';
    },
    showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); const el = document.getElementById(id); if (el) el.classList.remove('hidden'); },
    hideAllScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); },

    showGameOver(isWin) {
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-coins').textContent = this.coins;
        document.getElementById('final-dist').textContent  = this.dist + 'm';
        const title = document.getElementById('go-title');
        if (title) { title.textContent = isWin ? 'SECTOR CLEARED' : 'DRIVE TERMINATED'; title.className = isWin ? 'win' : ''; }
        this.showScreen('game-over-screen');
    },

    renderGarage() {
        const grid = document.getElementById('garage-grid');
        grid.innerHTML = '';
        const current = Garage.selectedId;
        Garage.getCars().forEach(car => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: rgba(255,255,255,0.04);
                border: 1px solid ${car.id === current ? car.color : 'rgba(255,255,255,0.1)'};
                border-radius: 6px;
                padding: 1rem;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: ${car.id === current ? '0 0 16px ' + car.color + '66' : 'none'};
            `;
            card.innerHTML = `
                <div style="font-family:'Orbitron',sans-serif;font-size:0.75rem;color:${car.color};letter-spacing:2px;margin-bottom:0.5rem;">${car.name}</div>
                <div style="font-size:0.65rem;color:rgba(255,255,255,0.4);margin-bottom:0.7rem;">PERF CONSTRUCT #${car.id}</div>
                <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:0.7rem;">
                    ${['speed','stability','grip'].map(s => `
                        <div style="font-size:0.6rem;color:rgba(255,255,255,0.5);letter-spacing:2px;">${s.toUpperCase()}
                            <div style="background:rgba(255,255,255,0.1);border-radius:3px;height:4px;margin-top:2px;">
                                <div style="background:${car.color};height:100%;width:${car.stats[s] * 10}%;border-radius:3px;"></div>
                            </div>
                        </div>`).join('')}
                </div>
                <div style="font-family:'Orbitron',sans-serif;font-size:0.6rem;color:${car.unlocked ? '#20ff77' : 'rgba(255,255,255,0.3)'};letter-spacing:2px;">
                    ${car.id === current ? '● EQUIPPED' : car.unlocked ? 'EQUIP' : 'LOCKED'}
                </div>
            `;
            card.addEventListener('mouseenter', () => { card.style.transform = 'scale(1.03)'; });
            card.addEventListener('mouseleave', () => { card.style.transform = ''; });
            if (car.unlocked) {
                card.onclick = () => { Garage.select(car.id); this.renderGarage(); };
            }
            grid.appendChild(card);
        });
    },
};

// =====================================================================
// 9. MAIN GAME ENGINE
// =====================================================================
const Game = {
    canvas: null,
    engine: null,
    vehicle: null,
    track: null,
    renderer: null,
    keys: {},
    isRunning: false,
    isPaused: false,
    lastTime: 0,
    gravDir: 1,
    lastCrash: 0,
    chassisOnTrack: 0,

    init() {
        console.log('[GAME] Initializing...');

        // Canvas
        this.canvas = document.getElementById('gameCanvas');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Sub-systems
        WorldEngine.init();
        AudioEngine.init();
        Garage.init();

        // ── Keyboard input ──
        window.addEventListener('keydown', e => {
            const k = e.key.toLowerCase();
            this.keys[k] = true;
            if (k === ' ' || k === 'arrowup' || k === 'w') {
                e.preventDefault();
                if (this.isRunning && !this.isPaused) this.flipGravity();
            }
            if (k === 'escape' || k === 'p') {
                if (this.isRunning) this.togglePause();
            }
        });
        window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });

        // ── Mobile on-screen buttons ──
        this._wireMobileBtn('btn-left',  () => { this.keys['a'] = true;  }, () => { this.keys['a'] = false; });
        this._wireMobileBtn('btn-right', () => { this.keys['d'] = true;  }, () => { this.keys['d'] = false; });
        this._wireMobileBtn('btn-nitro', () => { this.keys['n'] = true;  }, () => { this.keys['n'] = false; });
        const flipBtn = document.getElementById('btn-flip');
        if (flipBtn) {
            const doFlip = e => { e.preventDefault(); if (this.isRunning && !this.isPaused) this.flipGravity(); };
            flipBtn.addEventListener('touchstart', doFlip, { passive: false });
            flipBtn.addEventListener('mousedown',  doFlip);
        }

        // ── Screen button listeners ──
        document.getElementById('start-btn').onclick      = () => this.startGame();
        document.getElementById('garage-btn').onclick     = () => { UI.showScreen('garage-screen'); UI.renderGarage(); };
        document.getElementById('garage-back-btn').onclick= () => UI.showScreen('start-screen');
        document.getElementById('retry-btn').onclick      = () => this.startGame();
        document.getElementById('menu-btn').onclick       = () => { this.stopGame(); UI.showScreen('start-screen'); };
        document.getElementById('resume-btn').onclick     = () => this.togglePause();
        document.getElementById('pause-quit-btn').onclick = () => { this.stopGame(); UI.showScreen('start-screen'); };

        // Draw background and show menu
        this._drawBG();
        UI.showScreen('start-screen');
        console.log('[GAME] Ready.');
    },

    _wireMobileBtn(id, onDown, onUp) {
        const el = document.getElementById(id);
        if (!el) return;
        const down = e => { e.preventDefault(); el.classList.add('active'); onDown(); };
        const up   = e => { e.preventDefault(); el.classList.remove('active'); onUp(); };
        el.addEventListener('touchstart',  down, { passive: false });
        el.addEventListener('touchend',    up,   { passive: false });
        el.addEventListener('touchcancel', up,   { passive: false });
        el.addEventListener('mousedown',   down);
        el.addEventListener('mouseup',     up);
        el.addEventListener('mouseleave',  up);
    },

    _drawBG() {
        const ctx = this.canvas.getContext('2d');
        const W = this.canvas.width;
        const H = this.canvas.height;
        ctx.fillStyle = '#050310';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(136,34,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < W; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let y = 0; y < H; y += 100) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
    },

    resize() {
        if (!this.canvas) return;
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    startGame() {
        this.stopGame();
        WorldEngine.init(); // re-init for fresh seed each run

        // Physics
        this.engine = Matter.Engine.create({ enableSleeping: false });
        this.engine.world.gravity.scale = 0;
        this.engine.world.gravity.y = 0.5;
        this.gravDir = 1;

        this.engine.constraintIterations = 12;
        this.engine.positionIterations   = 8;
        this.engine.velocityIterations   = 8;

        // Car
        const carData = Garage.getSelectedCar();
        this.vehicle  = new Vehicle(this.engine.world, 200, 400, carData);

        // Track
        this.track    = new TrackGenerator(this.engine.world, WorldEngine.seed);
        this.track.generate(6);

        // Renderer
        this.renderer = new GameRenderer(this.canvas, this.vehicle, this.track, this.engine);
        this.renderer.gravDir = this.gravDir;

        // Collisions
        this._setupCollisions();

        // State
        UI.reset();
        UI.hideAllScreens();
        UI.showHUD();
        UI.setGravityIndicator(1);
        this.isRunning  = true;
        this.isPaused   = false;
        this.lastCrash  = 0;
        this.chassisOnTrack = 0;

        AudioEngine.resume();

        console.log('[GAME] Started. Car:', carData.name, 'Seed:', WorldEngine.seed);
        requestAnimationFrame(t => this._loop(t));
    },

    stopGame() {
        this.isRunning = false;
        if (this.engine) {
            Matter.World.clear(this.engine.world);
            Matter.Engine.clear(this.engine);
        }
        this.engine   = null;
        this.vehicle  = null;
        this.track    = null;
        this.renderer = null;
        UI.hideHUD();
    },

    _setupCollisions() {
        Matter.Events.on(this.engine, 'collisionStart', event => {
            event.pairs.forEach(pair => {
                const labels = [pair.bodyA.label, pair.bodyB.label];

                // Wheel lands on track
                if (labels.includes('wheel') && labels.includes('track')) {
                    this.vehicle.isGrounded = true;
                }

                // Chassis hits track = potential crash
                if (labels.includes('chassis') && labels.includes('track')) {
                    const now = Date.now();
                    if (now - this.lastCrash < 2500) return;
                    const angle = Math.abs(this.vehicle.angle % (Math.PI * 2));
                    const upsideDown = this.gravDir > 0
                        ? (angle > 1.8 && angle < 4.5)
                        : (angle < 1.3 || angle > 5.0);
                    if (upsideDown) {
                        this.chassisOnTrack += 16;
                        if (this.chassisOnTrack > 600) {
                            this._crash();
                        } else {
                            UI.notify('⚠ DANGER');
                        }
                    }
                }

                // Coin pickup
                const coinIdx = labels.indexOf('coin');
                if (coinIdx !== -1 && (labels.includes('chassis') || labels.includes('wheel'))) {
                    const coin = [pair.bodyA, pair.bodyB][coinIdx];
                    if (this.track.coins.includes(coin)) {
                        Matter.World.remove(this.engine.world, coin);
                        this.track.coins = this.track.coins.filter(c => c !== coin);
                        UI.addCoin(coin.position.x, coin.position.y);
                        this.renderer.addBurst(coin.position.x, coin.position.y, '#ffd700', 12);
                    }
                }
            });
        });

        Matter.Events.on(this.engine, 'collisionEnd', event => {
            event.pairs.forEach(pair => {
                const labels = [pair.bodyA.label, pair.bodyB.label];
                if (labels.includes('wheel') && labels.includes('track')) {
                    this.vehicle.isGrounded = false;
                }
                if (labels.includes('chassis') && labels.includes('track')) {
                    this.chassisOnTrack = 0;
                }
            });
        });
    },

    _crash() {
        this.lastCrash = Date.now();
        this.chassisOnTrack = 0;
        AudioEngine.playCrash();
        this.renderer.addBurst(this.vehicle.position.x, this.vehicle.position.y, '#ff3131', 30);
        UI.notify('DRIVE TERMINATED', 2000);
        setTimeout(() => {
            this.isRunning = false;
            UI.hideHUD();
            UI.showGameOver(false);
        }, 800);
    },

    flipGravity() {
        if (!this.engine) return;
        this.gravDir *= -1;
        this.engine.world.gravity.y = 0.5 * this.gravDir;
        UI.setGravityIndicator(this.gravDir);
        AudioEngine.playJump();
        if (this.renderer) this.renderer.gravDir = this.gravDir;
    },

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) UI.showScreen('pause-screen');
        else UI.hideAllScreens();
    },

    _loop(time) {
        if (!this.isRunning) return;
        if (this.isPaused) { requestAnimationFrame(t => this._loop(t)); return; }

        const dt = Math.min(time - (this.lastTime || time), 50);
        this.lastTime = time;

        // Apply custom gravity
        const grav = { x: 0, y: 0.0003 * this.gravDir };
        [this.vehicle.chassis, this.vehicle.wBack, this.vehicle.wFront].forEach(b => {
            Matter.Body.applyForce(b, b.position, { x: b.mass * grav.x, y: b.mass * grav.y });
        });

        // Nitro
        const nitroActive = this.keys['n'];
        if (nitroActive !== this.vehicle.nitro) {
            this.vehicle.nitro = nitroActive;
            if (nitroActive) AudioEngine.playNitro();
        }

        // Update subsystems
        Matter.Engine.update(this.engine, dt);
        this.vehicle.update(this.keys);
        this.track.update(this.vehicle.position.x);

        // UI
        UI.updateHUD(this.vehicle);
        UI.tickCombo(dt);

        // Render
        this.renderer.render();

        // Fall detection (fell off bottom)
        if (this.vehicle.position.y > 1500) this._crash();

        requestAnimationFrame(t => this._loop(t));
    }
};

// =====================================================================
// 10. BOOT
// =====================================================================
window.addEventListener('load', () => {
    try {
        if (typeof Matter === 'undefined') {
            throw new Error('Matter.js library failed to load. Check your internet connection.');
        }
        Game.init();
    } catch (e) {
        console.error('[GAME] Fatal boot error:', e);
        document.body.innerHTML = `
            <div style="color:#ff3131;font-family:monospace;padding:2rem;background:#050310;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;">
                <h1 style="font-size:2rem;letter-spacing:4px;">⚠ BOOT FAILURE</h1>
                <p style="color:rgba(255,255,255,0.6);max-width:500px;text-align:center;">${e.message}</p>
                <button onclick="location.reload()" style="margin-top:1rem;padding:0.8rem 2rem;background:#ff3131;color:white;border:none;cursor:pointer;font-family:monospace;font-size:1rem;">RETRY</button>
            </div>
        `;
    }
});
