// We'll use Matter.js as our physics engine
// In an actual implementation, you'd import Matter.js from npm
// For now, we'll assume it's globally available via <script> tag in index.html
// import Matter from 'matter-js';

export default class Physics {
    constructor() {
        // Create a Matter.js engine with increased solver iterations for better stability
        this.engine = Matter.Engine.create({
            // Enable gravity (increased for better gameplay)
            gravity: { x: 0, y: 1.2 },
            // Better precision for stacking and collisions
            positionIterations: 10,
            velocityIterations: 10
        });
        
        // Create a world
        this.world = this.engine.world;
        
        // Enable sleeping for better performance and stability
        // Objects that come to rest will "sleep" and use less CPU
        this.world.sleeping = true;
        
        // Set sleep properties directly on the Matter.js engine
        // This fixes the "Cannot set properties of undefined (setting 'x')" error
        this.engine.timing.timeScale = 1;
        this.engine.sleepThreshold = 15; // Default is 60
        
        // Collision tracking
        this.collisions = [];
        
        // Set up collision detection
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            this.handleCollisionStart(event);
        });
    }
    
    update(deltaTime) {
        // Cap delta time to prevent large jumps
        const cappedDelta = Math.min(deltaTime, 0.05);
        
        // Update the physics engine
        Matter.Engine.update(this.engine, cappedDelta * 1000);
        
        // Clear collision list after processing
        this.collisions = [];
    }
    
    handleCollisionStart(event) {
        // Track all collisions to be processed in the game logic
        const pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            this.collisions.push({
                bodyA: pair.bodyA,
                bodyB: pair.bodyB,
                velocity: pair.collision.depth
            });
        }
    }
    
    getCollisions() {
        return this.collisions;
    }
    
    addBody(body) {
        if (!body) {
            console.error("Attempted to add null/undefined body to world");
            return;
        }
        
        Matter.Composite.add(this.world, body);
    }
    
    removeBody(body) {
        if (body) {
            Matter.Composite.remove(this.world, body);
        }
    }
    
    createRectangle(x, y, width, height, options = {}) {
        // Apply default options for rectangles if not specified
        const defaultOptions = {
            frictionStatic: 0.7,
            friction: 0.6,
            frictionAir: 0.01,
            ...options
        };
        return Matter.Bodies.rectangle(x, y, width, height, defaultOptions);
    }
    
    createCircle(x, y, radius, options = {}) {
        return Matter.Bodies.circle(x, y, radius, options);
    }
    
    createPolygon(x, y, sides, radius, options = {}) {
        return Matter.Bodies.polygon(x, y, sides, radius, options);
    }
    
    createConstraint(bodyA, bodyB, options = {}) {
        return Matter.Constraint.create({
            bodyA: bodyA,
            bodyB: bodyB,
            ...options
        });
    }
    
    applyForce(body, position, force) {
        Matter.Body.applyForce(body, position, force);
    }
    
    reset() {
        // Clear all bodies from the world
        Matter.Composite.clear(this.world);
        
        // Clear collision list
        this.collisions = [];
        
        // Reset engine if needed
        this.engine = Matter.Engine.create({
            gravity: { x: 0, y: 1.2 },
            positionIterations: 10,
            velocityIterations: 10
        });
        
        // Get the new world
        this.world = this.engine.world;
        
        // Enable sleeping for better performance and stability
        this.world.sleeping = true;
        
        // Set sleep properties directly on the engine
        this.engine.timing.timeScale = 1;
        this.engine.sleepThreshold = 15; // Default is 60
        
        // Set up collision detection again
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            this.handleCollisionStart(event);
        });
        
        console.log("Physics world reset");
    }
} 