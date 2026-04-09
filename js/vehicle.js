class Vehicle {
    constructor(world, x, y) {
        this.world = world;
        this.chassisWidth = 100;
        this.chassisHeight = 30;
        this.wheelRadius = 22;
        this.group = Matter.Body.nextGroup(true);

        // Collision filters
        const carFilter = { group: this.group };

        // 1. Create Chassis
        this.chassis = Bodies.rectangle(x, y, this.chassisWidth, this.chassisHeight, {
            collisionFilter: carFilter,
            chamfer: { radius: 10 },
            density: 0.002,
            friction: 0.0, // Frictionless chassis to prevent "snagging"
            label: 'chassis'
        });

        // 2. Create Wheels
        const wheelOptions = {
            collisionFilter: carFilter,
            friction: 4.0, // Increased friction for much better grip
            frictionStatic: 10.0,
            density: 0.005,
            label: 'wheel'
        };

        this.wheelBack = Bodies.circle(x - 35, y + 25, this.wheelRadius, wheelOptions);
        this.wheelFront = Bodies.circle(x + 35, y + 25, this.wheelRadius, wheelOptions);

        // 3. Create Suspension Constraints (Springs)
        const suspensionOptions = {
            stiffness: 0.15,
            damping: 0.2,
            length: 15,
            render: { visible: true, strokeStyle: '#00f2ff' }
        };

        this.springBack = Constraint.create({
            bodyA: this.chassis,
            pointA: { x: -35, y: 15 },
            bodyB: this.wheelBack,
            ...suspensionOptions
        });

        this.springFront = Constraint.create({
            bodyA: this.chassis,
            pointA: { x: 35, y: 15 },
            bodyB: this.wheelFront,
            ...suspensionOptions
        });

        // 4. Create Pivot Constraints (to keep wheels in place vertically/horizontally relative to chassis)
        // Matter.js doesn't have a built-in "Wheel" constraint that limits path, 
        // but we can use multiple constraints or just rely on these high-damping springs.

        this.composite = Composite.create();
        Composite.add(this.composite, [
            this.chassis,
            this.wheelBack,
            this.wheelFront,
            this.springBack,
            this.springFront
        ]);

        World.add(this.world, this.composite);

        // State
        this.throttle = 0;
        this.isNitro = false;
        this.isGrounded = false;
        this.autopilot = false;
    }

    update() {
        // Apply engine force to wheels
        const torque = 0.22 * this.throttle; // Slightly more power
        const nitroBoost = this.isNitro ? 2.5 : 1.0;
        
        Body.setAngularVelocity(this.wheelBack, this.wheelBack.angularVelocity + torque * nitroBoost);
        Body.setAngularVelocity(this.wheelFront, this.wheelFront.angularVelocity + torque * nitroBoost);

        // Air Tilt (Balance) - Made more responsive for easier mid-air correction
        if (!this.isGrounded) {
            if (this.autopilot) {
                // Algorithmic Control of pitch
                const currentAngle = this.chassis.angle;
                const targetAngle = 0;
                const diff = targetAngle - currentAngle;
                Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity + diff * 0.05);
            } else {
                const isAirborne = !this.isGrounded;
                const tiltTorque = isAirborne ? 0.04 : 0.02; // Boost flip power in air
                
                if (window.Game.keys['a']) {
                    Matter.Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity - tiltTorque);
                }
                if (window.Game.keys['d']) {
                    Matter.Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity + tiltTorque);
                }
                
                const currentAngle = this.chassis.angle;
                const targetAngle = 0;
                const diff = targetAngle - currentAngle;
                Body.setAngularVelocity(this.chassis, this.chassis.angularVelocity + diff * 0.001);
            }
        }

        // Speed limit
        const maxAngVel = 0.5 * nitroBoost; // Lower max speed for better control
        if (Math.abs(this.wheelBack.angularVelocity) > maxAngVel) {
            Body.setAngularVelocity(this.wheelBack, Math.sign(this.wheelBack.angularVelocity) * maxAngVel);
        }
    }

    setThrottle(val) {
        this.throttle = val;
    }

    setNitro(val) {
        this.isNitro = val;
    }

    getPosition() {
        return this.chassis.position;
    }

    resetRotation() {
        Body.setAngle(this.chassis, 0);
        Body.setAngularVelocity(this.chassis, 0);
    }
}

window.Vehicle = Vehicle;
