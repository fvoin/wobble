import Projectile from './Projectile.js';

export default class TowerBlock {
    constructor(x, y, blockType = 'plank', material = 'wood', durability = 100) {
        this.x = x;
        this.y = y;
        this.blockType = blockType; // 'plank', 'square', 'L-shape'
        this.material = material;
        
        // Apply block type specific modifications
        // L-shaped blocks get 4x health
        if (this.blockType === 'L-shape') {
            this.maxDurability = durability * 4;
            this.durability = durability * 4;
            this.hasWeapon = false; // L-shaped blocks have no weapons
        } else {
            this.maxDurability = durability;
            this.durability = durability;
            this.hasWeapon = true;
        }
        
        this.body = null;
        
        // Set dimensions based on block type
        this.setDimensions();
        
        // Block stats
        this.attackPower = this.calculateAttackPower();
        this.attackRange = 200;
        // Square blocks attack twice as fast
        this.attackSpeed = this.blockType === 'square' ? 2 : 1; // Attacks per second
        this.attackTimer = 0;
        
        // Cannon position relative to center
        this.cannonOffsetX = 0;
        this.cannonOffsetY = -this.height/2;
        
        // Targeting
        this.target = null;
        
        // Projectiles
        this.projectiles = [];
        
        // Health properties for health bar
        this.health = this.durability;
        this.maxHealth = this.maxDurability;
        
        // Add flag to track if block has collided with ground or other blocks
        this.hasCollided = false;
        
        // Store vertices for L-shaped blocks and others
        this.vertices = null;
    }
    
    setDimensions() {
        switch (this.blockType) {
            case 'square':
                this.width = 40;
                this.height = 40;
                break;
            case 'L-shape':
                this.width = 60;
                this.height = 60;
                // L-shape dimensions, but body will be created from parts
                break;
            case 'plank':
            default:
                this.width = 80;
                this.height = 20;
                break;
        }
    }
    
    calculateAttackPower() {
        // Different materials have different attack powers
        switch (this.material) {
            case 'stone': return 15;
            case 'metal': return 20;
            default: return 10; // wood
        }
    }
    
    createBody(physics) {
        try {
            console.log(`Creating body for ${this.blockType} block at (${this.x}, ${this.y}), size: ${this.width}x${this.height}`);
            
            // Create a physics body using Matter.js based on shape
            if (this.blockType === 'L-shape') {
                // Create L-shaped body by combining two rectangles
                const mainPart = Matter.Bodies.rectangle(
                    this.x - this.width/4, 
                    this.y, 
                    this.width/2, 
                    this.height,
                    {
                        label: 'towerBlock',
                        density: this.getDensity(),
                        friction: this.getFriction(),
                        restitution: this.getRestitution()
                    }
                );
                
                const sidePart = Matter.Bodies.rectangle(
                    this.x + this.width/4, 
                    this.y + this.height/4, 
                    this.width/2, 
                    this.height/2,
                    {
                        label: 'towerBlock',
                        density: this.getDensity(),
                        friction: this.getFriction(),
                        restitution: this.getRestitution()
                    }
                );
                
                // Combine the two parts into a compound body
                this.body = Matter.Body.create({
                    parts: [mainPart, sidePart],
                    label: 'towerBlock'
                });
                
                // Store the vertices of the L-shape for drawing
                this.vertices = [
                    { x: -this.width/2, y: -this.height/2 },
                    { x: 0, y: -this.height/2 },
                    { x: 0, y: 0 },
                    { x: this.width/2, y: 0 },
                    { x: this.width/2, y: this.height/2 },
                    { x: -this.width/2, y: this.height/2 }
                ];
                
                // Set cannon position for L-shape
                this.cannonOffsetX = -this.width/4;
                this.cannonOffsetY = -this.height/2 - 5;
            } else {
                // Create rectangular bodies for plank and square
                this.body = Matter.Bodies.rectangle(this.x, this.y, this.width, this.height, {
                    label: 'towerBlock',
                    density: this.getDensity(),
                    friction: this.getFriction(),
                    restitution: this.getRestitution()
                });
                
                // Set cannon position based on block type
                if (this.blockType === 'square') {
                    this.cannonOffsetX = 0;
                    this.cannonOffsetY = -this.height/2 - 5;
                } else { // plank
                    this.cannonOffsetX = this.width/4;
                    this.cannonOffsetY = -this.height/2 - 5;
                }
            }
            
            // Store a reference to this block on the body
            this.body.blockRef = this;
            
            // Add to physics world
            Matter.Composite.add(physics.world, this.body);
            
            console.log(`${this.blockType} block body created successfully`);
            
            // Setup collision detection
            Matter.Events.on(physics.engine, 'collisionStart', (event) => {
                const pairs = event.pairs;
                
                for (let i = 0; i < pairs.length; i++) {
                    const pair = pairs[i];
                    
                    // Check if this block is involved in collision
                    if (pair.bodyA === this.body || pair.bodyB === this.body) {
                        // Get the other body
                        const otherBody = pair.bodyA === this.body ? pair.bodyB : pair.bodyA;
                        
                        // Mark as collided if it hit ground or another block
                        if (otherBody.label === 'ground' || otherBody.label === 'towerBlock') {
                            this.hasCollided = true;
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error(`Error creating body for ${this.blockType} block:`, error);
            throw error;
        }
    }
    
    getDensity() {
        // Different materials have different densities
        // All values quadrupled to make blocks 4x heavier than original
        switch (this.material) {
            case 'stone': return 0.032; // Doubled from 0.016 (was originally 0.008)
            case 'metal': return 0.04;  // Doubled from 0.02 (was originally 0.01)
            default: return 0.02;       // Doubled from 0.01 (was originally 0.005) (wood)
        }
    }
    
    getFriction() {
        // Different materials have different friction
        // All values doubled to make friction 2x stronger
        switch (this.material) {
            case 'stone': return 0.8;  // Doubled from 0.4
            case 'metal': return 0.4;  // Doubled from 0.2
            default: return 0.6;       // Doubled from 0.3 (wood)
        }
    }
    
    getRestitution() {
        // Different materials have different "bounciness"
        switch (this.material) {
            case 'stone': return 0.1;
            case 'metal': return 0.3;
            default: return 0.2; // wood
        }
    }
    
    update(deltaTime, enemies) {
        // Update position from physics body
        if (this.body) {
            this.x = this.body.position.x;
            this.y = this.body.position.y;
        }
        
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.update(deltaTime, enemies);
            
            // Remove inactive projectiles
            if (!projectile.active) {
                this.projectiles.splice(i, 1);
            }
        }
        
        // If block has collided and has weapon, handle attacking
        if (this.hasCollided && this.hasWeapon && this.body) {
            this.attackTimer -= deltaTime;
            
            if (this.attackTimer <= 0) {
                this.findTarget(enemies);
                
                if (this.target) {
                    this.fireProjectile();
                    this.attackTimer = 1 / this.attackSpeed;
                }
            }
        }
    }
    
    findTarget(enemies) {
        this.target = null;
        
        if (!enemies || enemies.length === 0) return;
        
        // Get block position from physics body
        const blockPos = this.body.position;
        
        // Find closest enemy in range
        let closestDistance = this.attackRange;
        
        for (const enemy of enemies) {
            if (enemy.health <= 0) continue;
            
            const enemyPos = enemy.body.position;
            const dx = enemyPos.x - blockPos.x;
            const dy = enemyPos.y - blockPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                this.target = enemy;
            }
        }
    }
    
    fireProjectile() {
        if (!this.target || !this.target.body) return;
        
        // Calculate cannon position in world coordinates
        const angle = this.body.angle;
        const cannonX = this.x + (Math.cos(angle) * this.cannonOffsetX - Math.sin(angle) * this.cannonOffsetY);
        const cannonY = this.y + (Math.sin(angle) * this.cannonOffsetX + Math.cos(angle) * this.cannonOffsetY);
        
        const targetPos = this.target.body.position;
        const projectile = new Projectile(
            cannonX, 
            cannonY, 
            targetPos.x, 
            targetPos.y, 
            this.attackPower
        );
        
        this.projectiles.push(projectile);
    }
    
    takeDamage(amount) {
        this.durability -= amount;
        this.health = this.durability; // Keep health synced with durability
        
        // Destroy if durability reaches zero
        if (this.durability <= 0) {
            // In a real game, trigger destruction effects
            // The block would be removed in Game.js
        }
    }
    
    setPendingPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    
    getProjectiles() {
        return this.projectiles;
    }
    
    getCannonPosition() {
        if (!this.body) return { x: this.x, y: this.y };
        
        const angle = this.body.angle;
        return {
            x: this.x + (Math.cos(angle) * this.cannonOffsetX - Math.sin(angle) * this.cannonOffsetY),
            y: this.y + (Math.sin(angle) * this.cannonOffsetX + Math.cos(angle) * this.cannonOffsetY)
        };
    }
} 