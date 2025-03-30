export default class Enemy {
    constructor(x, y, type = 'basic', physics) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Set properties based on enemy type
        this.setPropertiesByType();
        
        // Create physics body if provided
        if (physics) {
            this.createBody(physics);
        }
    }
    
    setPropertiesByType() {
        // Default properties
        this.width = 30;
        this.height = 30;
        this.radius = 15;
        this.shape = 'circle';
        this.speed = 20; // Halved from 50 to make enemy 2x slower
        this.maxHealth = 57; // Reduced by 25% from 76
        this.health = 57; // Reduced by 25% from 76
        this.damage = 10;
        this.reward = 5;
        this.energyReward = 3; // Base energy reward for basic enemy
        
        // Adjust based on type
        switch (this.type) {
            case 'fast':
                this.width = 50;
                this.height = 50;
                this.radius = 10;
                this.speed = 25; // Halved from 80 to make enemy 2x slower
                this.maxHealth = 35; // Reduced by 25% from 46
                this.health = 35; // Reduced by 25% from 46
                this.damage = 5;
                this.energyReward = 2; // Less energy for fast enemy (easier to kill)
                break;
            case 'heavy':
                this.width = 40;
                this.height = 40;
                this.radius = 20;
                this.speed = 15; // Halved from 30 to make enemy 2x slower
                this.maxHealth = 113; // Reduced by 25% from 150
                this.health = 113; // Reduced by 25% from 150
                this.damage = 20;
                this.energyReward = 5; // More energy for heavy enemy (harder to kill)
                break;
            case 'flying':
                this.width = 25;
                this.height = 25;
                this.radius = 12;
                this.speed = 20; // Halved from 60 to make enemy 2x slower
                this.maxHealth = 45; // Reduced by 25% from 60
                this.health = 45; // Reduced by 25% from 60
                this.damage = 8;
                this.flying = true;
                this.energyReward = 4; // Medium energy for flying enemy
                break;
        }
    }
    
    createBody(physics) {
        // Create appropriate physics body based on shape
        if (this.shape === 'circle') {
            this.body = Matter.Bodies.circle(this.x, this.y, this.radius, {
                label: 'enemy',
                density: 0.002, // Light
                friction: 0.1, // Increased friction to prevent sliding
                restitution: 0.2,
                frictionAir: 0.01, // Add air friction to slow down
                collisionFilter: {
                    category: 0x0002, // Enemy category
                    mask: 0xFFFFFFFF // Collide with everything
                },
                // Add extra collision properties
                plugin: {
                    attractors: []
                }
            });
        } else {
            this.body = Matter.Bodies.rectangle(this.x, this.y, this.width, this.height, {
                label: 'enemy',
                density: 0.002,
                friction: 0.1, // Increased friction
                restitution: 0.2,
                frictionAir: 0.01, // Add air friction to slow down
                collisionFilter: {
                    category: 0x0002, // Enemy category
                    mask: 0xFFFFFFFF // Collide with everything
                }
            });
        }
        
        // Store a reference to this enemy on the body
        this.body.enemyRef = this;
        
        // Ensure body doesn't rotate too much
        Matter.Body.setInertia(this.body, Infinity);
        
        // Add to physics world
        Matter.Composite.add(physics.world, this.body);
    }
    
    update(deltaTime, towerBlocks) {
        if (!this.body) return;
        
        // Update position from physics body
        this.x = this.body.position.x;
        this.y = this.body.position.y;
        
        // Get ground level from game instance if available
        const groundLevel = this.getGroundLevel();
        
        // Ensure enemy stays above ground
        if (this.y + this.radius > groundLevel) {
            this.y = groundLevel - this.radius;
            // Update physics body position to match
            if (this.body) {
                Matter.Body.setPosition(this.body, { x: this.x, y: this.y });
                // Reset vertical velocity to prevent sinking
                Matter.Body.setVelocity(this.body, {
                    x: this.body.velocity.x,
                    y: Math.min(0, this.body.velocity.y) // Allow upward but not downward velocity
                });
            }
        }
        
        // Move toward home (target is now set in the EnemyManager)
        if (window.gameInstance && window.gameInstance.enemyManager) {
            this.moveTowardHome(deltaTime, window.gameInstance.enemyManager.homePosition);
        } else {
            // Fallback to moving left if home position is not available
            this.moveLeft(deltaTime);
        }
        
        // Attack tower blocks if in range
        this.attackNearbyBlocks(towerBlocks);
    }
    
    moveTowardHome(deltaTime, homePosition) {
        if (!homePosition || !this.body) {
            // Fallback to moving left if no home position
            this.moveLeft(deltaTime);
            return;
        }
        
        // Get current position
        const currentPos = this.body.position;
        
        // Calculate direction vector to home
        const dx = homePosition.x - currentPos.x;
        const dy = homePosition.y - currentPos.y;
        
        // Calculate distance to target
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if enemy is "stuck" (very small movement)
        // Store previous position if not already stored
        if (!this.prevPosition) {
            this.prevPosition = { x: currentPos.x, y: currentPos.y };
            this.stuckCounter = 0;
            this.lastMoveTime = Date.now();
        } else {
            // Check time elapsed since last movement check
            const currentTime = Date.now();
            const timeDiff = (currentTime - this.lastMoveTime) / 1000; // in seconds
            
            if (timeDiff > 0.5) { // Check every half second
                // Calculate movement since last check
                const movementDist = Math.sqrt(
                    Math.pow(currentPos.x - this.prevPosition.x, 2) +
                    Math.pow(currentPos.y - this.prevPosition.y, 2)
                );
                
                // If barely moving, increment the stuck counter
                if (movementDist < 2 && distance > 50) { // Not at target but barely moving
                    this.stuckCounter++;
                } else {
                    this.stuckCounter = 0; // Reset if moving normally
                }
                
                // Update previous position and timestamp
                this.prevPosition = { x: currentPos.x, y: currentPos.y };
                this.lastMoveTime = currentTime;
            }
        }
        
        // Apply "unstuck" boost if needed
        const isStuck = this.stuckCounter > 2; // Stuck for more than 2 checks
        
        // Normalize the vector
        const length = Math.max(0.0001, distance); // Avoid division by zero
        const normalizedDx = dx / length;
        const normalizedDy = dy / length;
        
        // Calculate force multiplier - stronger when closer, to overcome friction
        // Increased base value to compensate for halved speed values
        let forceMultiplier = 0.02; // Increased from 0.015 to compensate for lower speed
        
        // Increase force if stuck
        if (isStuck) {
            forceMultiplier *= 3; // Triple the force to break out of stuck state
            
            // Apply a small random "jitter" to help break symmetrical stalemates
            Matter.Body.setVelocity(this.body, {
                x: this.body.velocity.x + (Math.random() - 0.5) * 2,
                y: this.body.velocity.y - 1 // Slight upward boost
            });
            
            console.log("Applying unstuck force to enemy");
        }
        
        // Scale force by distance but with reduced scaling to prevent erratic movement
        if (distance < 200) {
            // Reduced from (1 + (200 - distance) / 100) to prevent excessive force at close range
            forceMultiplier *= (1 + (200 - distance) / 200); // Up to 2x stronger when close (instead of 3x)
        }
        
        // Vertical force depends on position relative to target
        // Stronger upward force, weaker downward force
        const verticalFactor = currentPos.y > homePosition.y ? 0.01 : 0.001;
        
        // Apply force toward home, with enhanced horizontal movement
        // Add a maximum cap to deltaTime to prevent huge force spikes when FPS drops
        const cappedDeltaTime = Math.min(deltaTime, 0.05);
        const force = {
            x: normalizedDx * this.speed * cappedDeltaTime * forceMultiplier,
            y: normalizedDy * this.speed * cappedDeltaTime * verticalFactor
        };
        
        // Apply the force at the center of the body
        Matter.Body.applyForce(this.body, this.body.position, force);
        
        // If very close to target, add direct velocity to ensure we reach it
        if (distance < 50) {
            const finalApproachSpeed = Math.min(distance / 10, 2);
            Matter.Body.setVelocity(this.body, {
                x: normalizedDx * finalApproachSpeed,
                y: normalizedDy * finalApproachSpeed * 0.5
            });
        }
        
        // Limit maximum velocity
        this.limitVelocity();
        
        // Check if enemy is below ground level
        const groundLevel = this.getGroundLevel();
        
        // Correct position if below ground
        if (this.body.position.y + this.radius > groundLevel) {
            Matter.Body.setPosition(this.body, {
                x: this.body.position.x,
                y: groundLevel - this.radius
            });
            
            // Reset vertical velocity
            Matter.Body.setVelocity(this.body, {
                x: this.body.velocity.x,
                y: Math.min(0, this.body.velocity.y) // Allow upward but not downward velocity
            });
        }
    }
    
    moveLeft(deltaTime) {
        // Legacy method - just moves left (toward tower)
        // Cap deltaTime to prevent large jumps
        const cappedDeltaTime = Math.min(deltaTime, 0.05);
        
        const force = {
            x: -this.speed * cappedDeltaTime * 0.01,
            y: 0
        };
        
        // Apply the force at the center of the body
        Matter.Body.applyForce(this.body, this.body.position, force);
        
        // Limit maximum velocity to prevent excessive speeds
        this.limitVelocity();
    }
    
    limitVelocity() {
        if (!this.body) return;
        
        // Change from speed-based to fixed maximum velocity
        // This ensures consistent limits regardless of enemy type's speed value
        const maxVelocity = 3.0; // Fixed max velocity instead of this.speed / 15
        const velocity = this.body.velocity;
        
        // Create a new velocity object with limited values
        const newVelocity = {
            x: velocity.x,
            y: velocity.y
        };
        
        // Limit horizontal velocity
        if (Math.abs(velocity.x) > maxVelocity) {
            newVelocity.x = Math.sign(velocity.x) * maxVelocity;
        }
        
        // Limit vertical velocity more strictly to prevent sinking
        const maxVerticalVelocity = maxVelocity * 0.5; // Half of horizontal max
        if (Math.abs(velocity.y) > maxVerticalVelocity) {
            newVelocity.y = Math.sign(velocity.y) * maxVerticalVelocity;
        }
        
        // Apply the new velocity
        Matter.Body.setVelocity(this.body, newVelocity);
    }
    
    attackNearbyBlocks(towerBlocks) {
        if (!towerBlocks || towerBlocks.length === 0) return;
        
        // Get enemy position from physics body
        const enemyPos = this.body.position;
        
        // Attack range
        const attackRange = this.radius * 2;
        
        // Find blocks in range
        for (const block of towerBlocks) {
            if (!block.body) continue;
            
            const blockPos = block.body.position;
            const dx = blockPos.x - enemyPos.x;
            const dy = blockPos.y - enemyPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < attackRange + Math.max(block.width, block.height) / 2) {
                // Deal damage to the block
                block.takeDamage(this.damage * 0.1); // Scale damage per frame
            }
        }
    }
    
    takeDamage(amount) {
        this.health -= amount;
        
        // Visual feedback can be added here in a full game
    }
    
    hasReachedObjective(objective) {
        if (!this.body || !objective) return false;
        
        const enemyPos = this.body.position;
        const dx = objective.x - enemyPos.x;
        const dy = objective.y - enemyPos.y;
        
        // Calculate a slightly larger distance for larger enemies
        const collisionDistance = Math.max(this.radius * 2, 30);
        
        // Check distance to objective
        return Math.sqrt(dx * dx + dy * dy) < collisionDistance;
    }
    
    getEnergyReward() {
        // Return the energy reward for defeating this enemy
        // Add error handling in case energyReward isn't defined
        return this.energyReward || 3; // Default to 3 if not set
    }
    
    // Helper method to get ground level
    getGroundLevel() {
        // Try to get from game instance
        if (window.gameInstance) {
            if (window.gameInstance.enemyManager && window.gameInstance.enemyManager.groundLevel) {
                return window.gameInstance.enemyManager.groundLevel;
            }
            
            if (typeof window.gameInstance.getGroundLevel === 'function') {
                return window.gameInstance.getGroundLevel();
            }
        }
        
        // Fallback value
        return 550;
    }
} 