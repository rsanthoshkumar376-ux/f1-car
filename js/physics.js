const { Engine, Render, World, Bodies, Composite, Constraint, Body, Events, Vector, Mouse, MouseConstraint } = Matter;

const Physics = {
    engine: null,
    world: null,
    collisionGroups: {
        car: Matter.Body.nextGroup(true),
        track: Matter.Body.nextGroup(false),
        items: Matter.Body.nextGroup(false)
    },
    
    init() {
        this.engine = Engine.create({
            enableSleeping: false
        });
        this.world = this.engine.world;
        
        // Disable global gravity scale to allow for manual "selective" gravity
        this.world.gravity.scale = 0;
        this.world.gravity.y = 0.5; // Base direction for logic
        
        // Update physics iterations for stability (essential for car suspension)
        this.engine.constraintIterations = 10;
        this.engine.positionIterations = 10;
        this.engine.velocityIterations = 10;
    },

    update(delta) {
        Engine.update(this.engine, delta);
    },

    flipGravity() {
        this.world.gravity.y *= -1;
    },

    getGravity() {
        return this.world.gravity.y;
    }
};

// Global for easier access across modules (simple pattern for this project)
window.Physics = Physics;
