const Menu3D = {
    renderer: null,
    scene: null,
    camera: null,
    ghostLights: [],
    isActive: false,
    cameraPath: null,
    animationId: null,
    car: null,
    exhaust: null,
    isStarting: false,
    
    init() {
        const canvas = document.getElementById('menu3dCanvas');
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.scene = new THREE.Scene();
        const fogColor = 0x050510; // Dark spooky blue
        this.scene.background = new THREE.Color(fogColor);
        this.scene.fog = new THREE.FogExp2(fogColor, 0.08);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 2, 10);

        // Lights
        const ambient = new THREE.AmbientLight(0x4040ff, 0.2); // Dim blue ambience
        this.scene.add(ambient);

        for (let i = 0; i < 3; i++) {
            const light = new THREE.PointLight(i === 0 ? 0x00ffaa : 0xaa00ff, 2, 15);
            light.position.set((Math.random() - 0.5) * 10, 2, (Math.random() - 0.5) * 5);
            this.scene.add(light);
            this.ghostLights.push(light);
        }

        // The "Ghost House" (Simple stylized geometry)
        this.createHouse();

        // Create Cinematic Path
        this.cameraPath = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-10, 4, 15),
            new THREE.Vector3(10, 8, 10),
            new THREE.Vector3(15, 6, -5),
            new THREE.Vector3(0, 12, -15),
            new THREE.Vector3(-15, 4, 0)
        ]);
        this.cameraPath.closed = true;

        // Ground
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 })
        );
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        this.createCar();
        this.createExhaust();

        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));

        this.isActive = true;
        this.animate();
    },

    createHouse() {
        const houseGroup = new THREE.Group();
        
        // Main block
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(6, 8, 4),
            new THREE.MeshStandardMaterial({ color: 0x111122 })
        );
        body.position.y = 4;
        houseGroup.add(body);

        // Roof
        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(5, 4, 4),
            new THREE.MeshStandardMaterial({ color: 0x050510 })
        );
        roof.position.y = 10;
        roof.rotation.y = Math.PI / 4;
        houseGroup.add(roof);

        // Windows (Glowing)
        const windowGeo = new THREE.PlaneGeometry(0.8, 1.2);
        const windowMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
        for (let i = 0; i < 4; i++) {
            const win = new THREE.Mesh(windowGeo, windowMat);
            win.position.set(i % 2 === 0 ? -1.5 : 1.5, i < 2 ? 5 : 2, 2.01);
            houseGroup.add(win);
        }

        houseGroup.position.z = -5;
        this.scene.add(houseGroup);
    },

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    onMouseMove(e) {
        if (!this.isActive) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        
        // Subtle camera pan
        this.camera.position.x = x * 2;
        this.camera.position.y = 2 - y * 1;
        this.camera.lookAt(0, 4, -5);
    },

    animate() {
        if (!this.isActive) return;
        this.animationId = requestAnimationFrame(() => this.animate());

        const time = Date.now() * 0.0005; // Slower for cinematic feel
        
        // Cinematic Camera Movement
        if (!this.isStarting) {
            const t = (time * 0.1) % 1;
            const pos = this.cameraPath.getPointAt(t);
            this.camera.position.lerp(pos, 0.05);
            this.camera.lookAt(0, 4, -5);
        } else {
            // "Zoom In" Effect on Start
            this.camera.position.lerp(new THREE.Vector3(0, 2, 8), 0.1);
            this.car.position.z += 0.5;
            this.exhaust.visible = true;
            this.animateExhaust();
        }

        // Animate ghostly lights
        this.ghostLights.forEach((light, i) => {
            light.position.y = 2 + Math.sin(time + i) * 1;
            light.position.x += Math.cos(time * 0.5 + i) * 0.01;
            light.intensity = 1.5 + Math.sin(time * 3 + i) * 0.5; // Flicker
        });

        if (this.car) {
            this.car.rotation.y = Math.sin(time * 2) * 0.1;
            this.car.position.y = Math.sin(time * 10) * 0.02; // Engine vibration
        }

        this.renderer.render(this.scene, this.camera);
    },

    createCar() {
        this.car = new THREE.Group();
        
        // Chassis (Spectral F1/Buggy mix)
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.4, 3),
            new THREE.MeshStandardMaterial({ 
                color: WorldEngine.colors.primary, 
                emissive: WorldEngine.colors.primary, 
                emissiveIntensity: 0.5 
            })
        );
        this.car.add(body);

        // Cockpit
        const cockpit = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0x00ccff, transparent: true, opacity: 0.7 })
        );
        cockpit.position.y = 0.3;
        cockpit.position.z = -0.5;
        this.car.add(cockpit);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const wheelPositions = [
            [-0.8, -0.2, 1], [0.8, -0.2, 1],
            [-0.8, -0.2, -1], [0.8, -0.2, -1]
        ];
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(...pos);
            wheel.rotation.z = Math.PI / 2;
            this.car.add(wheel);
        });

        this.car.position.set(0, 0.5, 5);
        this.scene.add(this.car);
    },

    createExhaust() {
        const particles = new THREE.BufferGeometry();
        const count = 50;
        const pos = new Float32Array(count * 3);
        for(let i=0; i<count*3; i++) pos[i] = 0;
        particles.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        
        const mat = new THREE.PointsMaterial({
            color: 0x20ff77,
            size: 0.1,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        
        this.exhaust = new THREE.Points(particles, mat);
        this.exhaust.visible = false;
        this.scene.add(this.exhaust);
    },

    animateExhaust() {
        const pos = this.exhaust.geometry.attributes.position.array;
        for(let i=0; i<50; i++) {
            pos[i*3] = this.car.position.x + (Math.random()-0.5)*0.2;
            pos[i*3+1] = this.car.position.y + (Math.random()-0.5)*0.2;
            pos[i*3+2] = this.car.position.z + 1.5 + Math.random();
        }
        this.exhaust.geometry.attributes.position.needsUpdate = true;
    },

    startSequence() {
        this.isStarting = true;
        // The zoom in logic is handled in animate()
    },

    hide() {
        this.stop();
        document.getElementById('menu3dCanvas').style.display = 'none';
    },

    stop() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    dispose() {
        this.stop();
        this.scene.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
                else object.material.dispose();
            }
        });
        this.renderer.dispose();
    },

    show() {
        this.isActive = true;
        document.getElementById('menu3dCanvas').style.display = 'block';
        this.animate();
    }
};

window.Menu3D = Menu3D;
