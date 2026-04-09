const Physics = {
    engine: null,
    world: null,
    MatterSymbols: {}, // Container for safely scoped Matter classes
    collisionGroups: {},
    
    init() {
        // Safe destructuring inside init ensures Matter is loaded
        const { Engine, Render, World, Bodies, Composite, Constraint, Body, Events, Vector, Mouse, MouseConstraint } = Matter;
        
        // Export to window for other scripts (track.js, vehicle.js)
        window.Engine = Engine;
        window.Render = Render;
        window.World = World;
        window.Bodies = Bodies;
        window.Composite = Composite;
        window.Constraint = Constraint;
        window.Body = Body;
        window.Events = Events;
        window.Vector = Vector;
        
        this.collisionGroups = {
            car: Body.nextGroup(true),
            track: Body.nextGroup(false),
            items: Body.nextGroup(false)
        };

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
        if (window.Engine) {
            window.Engine.update(this.engine, delta);
        }
    },

    flipGravity() {
        if (this.world) this.world.gravity.y *= -1;
    },

    getGravity() {
        return this.world ? this.world.gravity.y : 0.5;
    }
};

// Global for easier access across modules (simple pattern for this project)
window.Physics = Physics;
