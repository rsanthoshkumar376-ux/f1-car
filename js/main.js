const Game = {
    canvas: null,
    renderer: null,
    vehicle: null,
    track: null,
    isRunning: false,
    isPaused: false,
    entropy: 0,
    lastTime: 0,
    keys: {},
    chassisContactTime: 0,
    lastCrashTime: 0,

    init() {
        console.log("ALGORITHMIC_INIT: Starting boot sequence...");
        try {
            this.canvas = document.getElementById('gameCanvas');
            this.resize();
            window.addEventListener('resize', () => this.resize());

            console.log("ALGORITHMIC_BOOT [1/7]: Physics...");
            Physics.init();
            
            console.log("ALGORITHMIC_BOOT [2/7]: Audio...");
            AudioEngine.init();
            
            console.log("ALGORITHMIC_BOOT [3/7]: Garage...");
            Garage.init();
            
            console.log("ALGORITHMIC_BOOT [4/7]: World Engine...");
            WorldEngine.init(); 
            
            console.log("ALGORITHMIC_BOOT [5/7]: Levels...");
            Levels.init();
            
            console.log("ALGORITHMIC_BOOT [6/7]: UI...");
            UI.init();
            
            console.log("ALGORITHMIC_BOOT [7/7]: 3D Menu...");
            Menu3D.init();

            // Input listeners
            window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
            window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
            
            UI.showStart();
            console.log("ALGORITHMIC_INIT: BOOT_COMPLETED_SUCCESSFULLY");

            // Start animation loop
            requestAnimationFrame((t) => this.loop(t));
        } catch (e) {
            console.error("ALGORITHMIC_FATAL_BOOT_FAILURE:", e);
            alert("BOOT FAILURE: Check console for [ALGORITHMIC_FATAL_BOOT_FAILURE]\n" + e.message);
        }
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.renderer) {
            this.renderer.width = this.canvas.width;
            this.renderer.height = this.canvas.height;
        }
    },

    start(levelData = null) {
        Gameplay.init(levelData);
        AudioEngine.resume();
        AudioEngine.playBGM();

        // Start Cinematic Transition with 3D Car Start Effect
        Menu3D.startSequence();
        
        setTimeout(() => {
            Menu3D.stop(); 
            document.getElementById('menu3dCanvas').style.display = 'none';
            
            const carData = Garage.getSelectedCar();
            this.track = new TrackGenerator(Physics.world);
            this.track.generateChunk();
            
            this.vehicle = new Vehicle(Physics.world, 200, 400);
            if (carData.physics) {
                // Apply car specific physics stats
                this.vehicle.chassisWidth = carData.physics.chassisWidth;
                this.vehicle.torque = carData.physics.torque;
                this.vehicle.maxAngVel = carData.physics.maxAngVel;
            }

            this.renderer = new GameRenderer(this.canvas, Physics.world, this.vehicle, this.track);
            this.setupCollisions();
            
            this.isRunning = true;
            UI.showHUD();
        }, 1500);
    },
    toggleAutopilot() {
        if (!this.vehicle) return;
        this.vehicle.autopilot = !this.vehicle.autopilot;
        UI.showNotification(this.vehicle.autopilot ? "AUTOPILOT: CALIBRATED" : "MANUAL_CONTROL: ACTIVE");
    },

    startLevel(id) {
        const lvl = Levels.getLevel(id);
        if (lvl) {
            this.currentLevelId = id;
            this.start(lvl);
        }
    },

    restart() {
        // Clear old world
        Matter.World.clear(Physics.world);
        Physics.init();
        if (this.currentLevelId) {
            this.startLevel(this.currentLevelId);
        } else {
            this.start();
        }
    },

    pause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            document.getElementById('pause-screen').classList.remove('hidden');
        } else {
            document.getElementById('pause-screen').classList.add('hidden');
        }
    },

    resume() {
        this.isPaused = false;
        document.getElementById('pause-screen').classList.add('hidden');
    },

    updateEntropy() {
        if (!this.vehicle) return;
        const v = this.vehicle;
        const angVel = Math.abs(v.chassis.angularVelocity);
        const velocity = Math.abs(v.chassis.velocity.x);
        
        // Algorithmic Complexity Score
        // Higher angular velocity + higher speed = more entropy
        const complexity = (angVel * 2) * (velocity / 50);
        this.entropy += complexity;
        
        UI.updateEntropy(this.entropy);
    },

    flipGravity() {
        Physics.flipGravity();
        UI.updateGravity(Physics.getGravity());
        // Stabilizing flip torque
        const dir = Physics.getGravity();
        // Matter.Body.setAngle(this.vehicle.chassis, dir < 0 ? Math.PI : 0);
    },

    handleTouch(e) {
        if (!this.isRunning) return;
        const x = e.touches[0].clientX;
        if (x < window.innerWidth / 2) {
            // Left side touch: Toggle gravity
            this.flipGravity();
        } else {
            // Right side touch: Throttle (managed in update)
        }
    },

    setupCollisions() {
        Matter.Events.on(Physics.engine, 'collisionStart', (event) => {
            event.pairs.forEach(pair => {
                const labels = [pair.bodyA.label, pair.bodyB.label];
                const bodies = [pair.bodyA, pair.bodyB];
                
                // Vehicle Grounding
                if (labels.includes('wheel') && labels.includes('track')) {
                    this.vehicle.isGrounded = true;
                }

                // Crash detection with 500ms Buffer
                if (labels.includes('chassis') && labels.includes('track')) {
                    const now = Date.now();
                    const angle = Math.abs(this.vehicle.chassis.angle % (Math.PI * 2));
                    const isUpsideDown = (Physics.getGravity() > 0) ? 
                        (angle > 1.8 && angle < 4.5) : // Normal Grav upside down
                        (angle < 1.3 || angle > 5.0);  // Inverted Grav upside down

                    if (isUpsideDown && now - this.lastCrashTime > 2000) {
                        this.chassisContactTime += 16; // Approx ms per frame
                        if (this.chassisContactTime > 500) {
                            if (Gameplay.onCrash()) {
                                this.isRunning = false;
                                this.renderer.addParticles(this.vehicle.chassis.position.x, this.vehicle.chassis.position.y, '#ff3131', 50);
                            }
                        } else {
                            // Close call feedback
                            UI.showNotification("CLOSE CALL!");
                        }
                    }
                }
                
                // Jump Pad logic
                if (labels.includes('chassis') && labels.includes('jump_pad')) {
                    const itemIdx = labels.indexOf('jump_pad');
                    const pad = bodies[itemIdx];
                    Matter.Body.applyForce(this.vehicle.chassis, this.vehicle.chassis.position, {
                        x: 0,
                        y: Physics.getGravity() > 0 ? -0.05 : 0.05
                    });
                    this.renderer.addParticles(pad.position.x, pad.position.y, '#20ff77', 30);
                    AudioEngine.playPowerup(); // Re-use powerup sound
                    Matter.World.remove(Physics.world, pad);
                }

                // Item collection
                if (labels.includes('chassis') || labels.includes('wheel')) {
                    const itemIdx = labels.findIndex(l => l === 'coin' || l === 'powerup');
                    if (itemIdx !== -1) {
                        const item = bodies[itemIdx];
                        const type = labels[itemIdx];
                        
                        if (type === 'coin') Gameplay.collectCoin();
                        else Gameplay.collectPowerup();
                        
                        this.renderer.addParticles(item.position.x, item.position.y, type === 'coin' ? '#ffd700' : '#ff00ea', 20);
                        Matter.World.remove(Physics.world, item);
                    }
                }
            });
        });

        Matter.Events.on(Physics.engine, 'collisionEnd', (event) => {
            event.pairs.forEach(pair => {
                const labels = [pair.bodyA.label, pair.bodyB.label];
                if (labels.includes('wheel') && labels.includes('track')) {
                    this.vehicle.isGrounded = false;
                }
                if (labels.includes('chassis') && labels.includes('track')) {
                    this.chassisContactTime = 0; // Reset timer on release
                }
            });
        });
    },

    updateInput() {
        let throttle = 0;
        if (this.keys['d'] || this.keys['arrowright']) throttle = 1;
        if (this.keys['a'] || this.keys['arrowleft']) throttle = -1;
        
        // Touch throttle (simple check: if touching right side)
        // (In a real game you'd track touch IDs but this works for demo)
        
        this.vehicle.setThrottle(throttle);
        this.vehicle.setNitro(this.keys['n']);
    },

    loop(time) {
        const dt = time - (this.lastTime || time);
        this.lastTime = time;

        if (this.isRunning && !this.isPaused) {
            this.updateInput();
            
            // Apply Manual 'Slow' Gravity to Vehicle Only
            const gravityForce = { x: 0, y: 0.0003 * Physics.getGravity() };
            [this.vehicle.chassis, this.vehicle.wheelBack, this.vehicle.wheelFront].forEach(body => {
                Matter.Body.applyForce(body, body.position, {
                    x: body.mass * gravityForce.x,
                    y: body.mass * gravityForce.y
                });
            });

            Physics.update(dt);
            this.vehicle.update();
            this.track.update(this.vehicle.getPosition().x);
            this.updateEntropy();
            UI.updateDataStream();
            Gameplay.update(dt, this.vehicle.getPosition().x);
            
            // HUD Updates
            UI.updateSpeed(Math.abs(this.vehicle.wheelBack.angularSpeed), 1);
        }

        if (this.renderer) {
            this.renderer.render();
        }

        requestAnimationFrame((t) => this.loop(t));
    }
};

window.Game = Game;
// Initialization is now handled by the robust readyState check in index.html
