class GameRenderer {
    constructor(canvas, world, vehicle, track) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.world = world;
        this.vehicle = vehicle;
        this.track = track;
        
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Camera offset
        this.cameraX = 0;
        this.cameraY = 0;
        this.targetCameraY = 0;
        
        // Particles
        this.particles = [];
    }

    render() {
        const ctx = this.ctx;
        
        // 1. Update Camera
        const carPos = this.vehicle.getPosition();
        this.cameraX = carPos.x - this.width * 0.3;
        
        // Smooth camera Y
        const gravityDir = window.Physics.getGravity();
        const baseOffset = gravityDir > 0 ? this.height * 0.6 : this.height * 0.4;
        this.targetCameraY = carPos.y - baseOffset;
        this.cameraY += (this.targetCameraY - this.cameraY) * 0.1;

        // 2. Clear Background
        ctx.fillStyle = WorldEngine.colors.background;
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Parallax Background
        this.drawParallax();

        ctx.save();
        ctx.translate(-this.cameraX, -this.cameraY);

        this.drawTrack();
        this.drawItems();
        this.drawGhost(); // Algorithmic Ghost Racer
        this.drawVehicle();
        this.drawParticles();

        ctx.restore();
    }

    drawGhost() {
        const ctx = this.ctx;
        const pos = this.vehicle.getPosition();
        // The Ghost is an algorithmic "perfect" run slightly ahead
        const ghostX = pos.x + 200;
        const ghostY = this.track.lastY - 50;
        
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = WorldEngine.colors.accent;
        ctx.shadowBlur = 10;
        ctx.shadowColor = WorldEngine.colors.accent;
        ctx.fillRect(ghostX - 25, ghostY - 10, 50, 20);
        ctx.restore();
    }

    drawParallax() {
        const ctx = this.ctx;
        const moveX = this.cameraX * 0.3;
        const moveY = this.cameraY * 0.3;

        ctx.strokeStyle = 'rgba(136, 34, 255, 0.1)'; // Purple grid
        ctx.lineWidth = 1;
        const size = 200;
        const startX = -(moveX % size);
        const startY = -(moveY % size);

        for (let x = startX; x < this.width; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }
        for (let y = startY; y < this.height; y += size) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }
    }

    drawTrack() {
        const ctx = this.ctx;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#20ff77'; // Spectral Green
        ctx.strokeStyle = '#20ff77';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        this.track.segments.forEach(seg => {
            const { vertices } = seg;
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
                ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.closePath();
            ctx.stroke();
            
            // Fill with dark color
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fill();
        });
        ctx.shadowBlur = 0;
    }

    drawItems() {
        const ctx = this.ctx;
        this.track.items.forEach(item => {
            const color = item.label === 'coin' ? '#ffd700' : '#ff00ea';
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
            ctx.fillStyle = color;
            
            ctx.beginPath();
            ctx.arc(item.position.x, item.position.y, item.circleRadius, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;
    }

    drawVehicle() {
        const ctx = this.ctx;
        const v = this.vehicle;
        const carData = Garage.getSelectedCar();
        const primaryColor = WorldEngine.colors.primary;

        // Spirit Trail
        this.addParticles(v.chassis.position.x, v.chassis.position.y, primaryColor + '33', 1);

        ctx.shadowBlur = 20;
        ctx.shadowColor = primaryColor;
        
        ctx.save();
        ctx.translate(v.chassis.position.x, v.chassis.position.y);
        ctx.rotate(v.chassis.angle);
        
        ctx.fillStyle = primaryColor;
        const w = v.chassisWidth;
        const h = v.chassisHeight;

        // Algorithmic Chassis Base
        ctx.fillRect(-w/2, -h/2, w, h);

        // Algorithmic Cockpit (Positioned by car.id)
        const cockpitOffset = (carData.id % 3) * 10 - 10;
        ctx.fillStyle = WorldEngine.colors.accent + 'aa';
        ctx.beginPath();
        ctx.ellipse(cockpitOffset, -h/2 - 5, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Algorithmic F1 Spoiler (Dynamic Downforce Wing)
        const spoilerHeight = 10 + carData.stats.jump;
        ctx.fillStyle = primaryColor;
        ctx.fillRect(-w/2 - 10, -h/2 - spoilerHeight, 5, spoilerHeight + 10);
        ctx.fillRect(-w/2 - 25, -h/2 - spoilerHeight, 35, 5); // Rear Wing
        
        // F1 Nose (Procedural Front Wing)
        ctx.fillRect(w/2 - 10, -h/2 + 5, 20, 5);
        ctx.fillRect(w/2 + 10, -h/2 + 5, 5, 15); // Front wing plate

        // Window Glow
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0.3;
        ctx.fillRect(cockpitOffset, -h/2 - 4, 8, 4);

        ctx.restore();

        // Draw Wheels (Adaptive Tires)
        [v.wheelBack, v.wheelFront].forEach(wheel => {
            ctx.save();
            ctx.translate(wheel.position.x, wheel.position.y);
            ctx.rotate(wheel.angle);
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(0, 0, wheel.circleRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Tire Treads
            for (let i = 0; i < 8; i++) {
                ctx.rotate(Math.PI / 4);
                ctx.fillRect(wheel.circleRadius - 2, -2, 4, 4);
            }
            ctx.restore();
        });
        ctx.shadowBlur = 0;
    }

    drawParticles() {
        // Simple particle system
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        this.ctx.globalAlpha = 1.0;
    }

    addParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                color,
                size: Math.random() * 4 + 2
            });
        }
    }
}

window.GameRenderer = GameRenderer;
