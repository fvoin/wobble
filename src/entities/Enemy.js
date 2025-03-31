export default class Enemy {
    constructor(x, y, type = 'balanced', physics) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Set properties based on enemy type
        this.setPropertiesByType();
        
        // Animation properties
        this.animationTime = 0;
        this.walkSpeed = 1.0; // Animation speed multiplier
        
        // Robot parts colors - will be set based on type
        this.bodyColor = '#666666';
        this.headColor = '#888888';
        this.limbColor = '#444444';
        this.eyeColor = '#ff0000';
        
        // Create physics body if provided
        if (physics) {
            this.createBody(physics);
        }
    }
    
    setPropertiesByType() {
        // Default properties for balanced enemy
        this.width = 30;
        this.height = 30;
        this.radius = 15;
        this.shape = 'circle';
        this.speed = 15; // Movement speed
        this.pushForce = 0.01; // New property - how hard enemy pushes blocks (separate from speed)
        this.maxHealth = 120; // Doubled from 60
        this.health = 120; // Doubled from 60
        this.damage = 10;
        this.reward = 5;
        this.energyReward = 3;
        
        // Set specific properties based on type
        switch (this.type) {
            case 'fast':
                // Small, fast and weak enemy
                this.width = 20;
                this.height = 20;
                this.radius = 10;
                this.speed = 20; // Faster movement
                this.pushForce = 0.01; // Lower pushing force
                this.maxHealth = 70; // Doubled from 35
                this.health = 70; // Doubled from 35
                this.damage = 5; // Lower damage
                this.energyReward = 2;
                // Fast robot colors - lighter/scout-like
                this.bodyColor = '#88a1b3'; // Light blue-gray
                this.headColor = '#a7c0d1';
                this.limbColor = '#667d8d';
                this.eyeColor = '#29d6ff'; // Blue eyes
                // Animation speed faster
                this.walkSpeed = 1.5;
                break;
                
            case 'heavy':
                // Slow, strong enemy
                this.width = 40;
                this.height = 40;
                this.radius = 20;
                this.speed = 10; // Slower movement
                this.pushForce = 0.05; // Higher pushing force
                this.maxHealth = 400; // Doubled from 156
                this.health = 400; // Doubled from 156
                this.damage = 15; // Higher damage
                this.energyReward = 5;
                // Heavy robot colors - darker/armored
                this.bodyColor = '#6a4f31'; // Brown/rust
                this.headColor = '#7e5d39';
                this.limbColor = '#523d26';
                this.eyeColor = '#ff5a00'; // Orange eyes
                // Animation speed slower
                this.walkSpeed = 0.7;
                break;
                
            case 'balanced':
            default:
                // Balanced enemy - uses default properties
                // Balanced robot colors - neutral
                this.bodyColor = '#666666'; // Gray
                this.headColor = '#888888';
                this.limbColor = '#444444';
                this.eyeColor = '#ff0000'; // Red eyes
                break;
        }
    }
    
    createBody(physics) {
        // Create appropriate physics body based on shape
        if (this.shape === 'circle') {
            this.body = Matter.Bodies.circle(this.x, this.y, this.radius, {
                label: 'enemy',
                density: 0.0002, // Light - reduced by 10x from 0.002
                friction: 0.1,
                restitution: 0.2,
                frictionAir: 0.01,
                collisionFilter: {
                    category: 0x0002, // Enemy category
                    mask: 0xFFFFFFFF // Collide with everything
                },
                plugin: {
                    attractors: []
                }
            });
        } else {
            this.body = Matter.Bodies.rectangle(this.x, this.y, this.width, this.height, {
                label: 'enemy',
                density: 0.0002, // Light - reduced by 10x from 0.002
                friction: 0.1,
                restitution: 0.2,
                frictionAir: 0.01,
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
        
        // Update animation time
        this.animationTime += deltaTime * this.walkSpeed;
        
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
    
    // Drawing method for component-based robot
    render(renderer) {
        if (!this.body) return;
        
        const ctx = renderer.ctx;
        ctx.save();
        
        // Position at physics body
        ctx.translate(this.x, this.y);
        
        // Draw based on movement direction
        const isMovingLeft = this.body.velocity.x < 0;
        if (isMovingLeft) {
            ctx.scale(-1, 1); // Flip horizontally if moving left
        }
        
        // Calculate animation values
        const legAngle = Math.sin(this.animationTime * 5) * 0.3;
        const armAngle = Math.sin(this.animationTime * 5 + Math.PI) * 0.2;
        
        // Calculate bob height based on type
        let bobHeight = Math.sin(this.animationTime * 10) * 2;
        
        // Special jumping motion for fast robot
        if (this.type === 'fast') {
            // Make the fast robot jump as it moves
            const jumpHeight = Math.abs(Math.sin(this.animationTime * 6));
            bobHeight = jumpHeight * 8; // Exaggerated jump height
        }
        
        // Size multiplier based on enemy type
        const sizeMultiplier = this.radius / 15; // Normalize based on balanced enemy size
        
        // DRAW ROBOT BASED ON TYPE
        if (this.type === 'fast') {
            // ---- FAST ROBOT (SCOUT) DESIGN ----
            // Thinner legs
            ctx.fillStyle = this.limbColor;
            
            // Left leg
            ctx.save();
            ctx.translate(-7 * sizeMultiplier, 5 * sizeMultiplier);
            // During jump, legs are tucked up more
            const fastLegAngle = legAngle * 1.2 + (bobHeight * 0.02);
            ctx.rotate(fastLegAngle);
            ctx.fillRect(-2 * sizeMultiplier, 0, 4 * sizeMultiplier, 15 * sizeMultiplier);
            ctx.restore();
            
            // Right leg
            ctx.save();
            ctx.translate(7 * sizeMultiplier, 5 * sizeMultiplier);
            ctx.rotate(-fastLegAngle);
            ctx.fillRect(-2 * sizeMultiplier, 0, 4 * sizeMultiplier, 15 * sizeMultiplier);
            ctx.restore();
            
            // Streamlined body
            ctx.fillStyle = this.bodyColor;
            // Smaller, more triangular body
            ctx.beginPath();
            ctx.moveTo(-8 * sizeMultiplier, -12 * sizeMultiplier + bobHeight);
            ctx.lineTo(8 * sizeMultiplier, -12 * sizeMultiplier + bobHeight);
            ctx.lineTo(10 * sizeMultiplier, -2 * sizeMultiplier + bobHeight);
            ctx.lineTo(8 * sizeMultiplier, 8 * sizeMultiplier + bobHeight);
            ctx.lineTo(-8 * sizeMultiplier, 8 * sizeMultiplier + bobHeight);
            ctx.lineTo(-10 * sizeMultiplier, -2 * sizeMultiplier + bobHeight);
            ctx.closePath();
            ctx.fill();
            
            // Sleeker arms
            ctx.fillStyle = this.limbColor;
            
            // Left arm
            ctx.save();
            ctx.translate(-9 * sizeMultiplier, -6 * sizeMultiplier + bobHeight);
            ctx.rotate(armAngle * 1.2); // More arm movement
            ctx.fillRect(-4 * sizeMultiplier, 0, 4 * sizeMultiplier, 10 * sizeMultiplier);
            ctx.restore();
            
            // Right arm
            ctx.save();
            ctx.translate(9 * sizeMultiplier, -6 * sizeMultiplier + bobHeight);
            ctx.rotate(-armAngle * 1.2);
            ctx.fillRect(0, 0, 4 * sizeMultiplier, 10 * sizeMultiplier);
            ctx.restore();
            
            // Sleek head with visor
            ctx.fillStyle = this.headColor;
            // Pointed head
            ctx.beginPath();
            ctx.moveTo(-7 * sizeMultiplier, -22 * sizeMultiplier + bobHeight);
            ctx.lineTo(7 * sizeMultiplier, -22 * sizeMultiplier + bobHeight);
            ctx.lineTo(5 * sizeMultiplier, -12 * sizeMultiplier + bobHeight);
            ctx.lineTo(-5 * sizeMultiplier, -12 * sizeMultiplier + bobHeight);
            ctx.closePath();
            ctx.fill();
            
            // Visor instead of eyes
            ctx.fillStyle = this.eyeColor;
            ctx.fillRect(-6 * sizeMultiplier, -20 * sizeMultiplier + bobHeight, 
                         12 * sizeMultiplier, 2 * sizeMultiplier);
        }
        else if (this.type === 'heavy') {
            // ---- HEAVY ROBOT DESIGN ----
            // Thicker legs
            ctx.fillStyle = this.limbColor;
            
            // Left leg
            ctx.save();
            ctx.translate(-9 * sizeMultiplier, 5 * sizeMultiplier);
            ctx.rotate(legAngle * 0.7); // Less leg movement for heavy
            ctx.fillRect(-4 * sizeMultiplier, 0, 8 * sizeMultiplier, 15 * sizeMultiplier);
            ctx.restore();
            
            // Right leg
            ctx.save();
            ctx.translate(9 * sizeMultiplier, 5 * sizeMultiplier);
            ctx.rotate(-legAngle * 0.7);
            ctx.fillRect(-4 * sizeMultiplier, 0, 8 * sizeMultiplier, 15 * sizeMultiplier);
            ctx.restore();
            
            // Bulkier body
            ctx.fillStyle = this.bodyColor;
            // Draw main body
            ctx.fillRect(-12 * sizeMultiplier, -18 * sizeMultiplier + bobHeight, 
                        24 * sizeMultiplier, 23 * sizeMultiplier);
            
            // Add armor plates
            ctx.fillStyle = this.headColor; // Use head color for armor plates
            // Shoulder plates
            ctx.fillRect(-14 * sizeMultiplier, -18 * sizeMultiplier + bobHeight, 
                        28 * sizeMultiplier, 5 * sizeMultiplier);
            // Chest plate
            ctx.fillRect(-10 * sizeMultiplier, -13 * sizeMultiplier + bobHeight, 
                        20 * sizeMultiplier, 10 * sizeMultiplier);
            
            // Heavy arms
            ctx.fillStyle = this.limbColor;
            
            // Left arm
            ctx.save();
            ctx.translate(-12 * sizeMultiplier, -10 * sizeMultiplier + bobHeight);
            ctx.rotate(armAngle * 0.6); // Less arm movement
            ctx.fillRect(-6 * sizeMultiplier, 0, 6 * sizeMultiplier, 14 * sizeMultiplier);
            ctx.restore();
            
            // Right arm
            ctx.save();
            ctx.translate(12 * sizeMultiplier, -10 * sizeMultiplier + bobHeight);
            ctx.rotate(-armAngle * 0.6);
            ctx.fillRect(0, 0, 6 * sizeMultiplier, 14 * sizeMultiplier);
            ctx.restore();
            
            // Head with helmet
            ctx.fillStyle = this.headColor;
            // Helmet-like head
            ctx.beginPath();
            ctx.moveTo(-10 * sizeMultiplier, -28 * sizeMultiplier + bobHeight);
            ctx.lineTo(10 * sizeMultiplier, -28 * sizeMultiplier + bobHeight);
            ctx.lineTo(12 * sizeMultiplier, -23 * sizeMultiplier + bobHeight);
            ctx.lineTo(10 * sizeMultiplier, -18 * sizeMultiplier + bobHeight);
            ctx.lineTo(-10 * sizeMultiplier, -18 * sizeMultiplier + bobHeight);
            ctx.lineTo(-12 * sizeMultiplier, -23 * sizeMultiplier + bobHeight);
            ctx.closePath();
            ctx.fill();
            
            // Eyes in a more menacing pattern
            ctx.fillStyle = this.eyeColor;
            // Two narrow eyes
            ctx.fillRect(-7 * sizeMultiplier, -25 * sizeMultiplier + bobHeight, 
                         5 * sizeMultiplier, 2 * sizeMultiplier);
            ctx.fillRect(2 * sizeMultiplier, -25 * sizeMultiplier + bobHeight, 
                         5 * sizeMultiplier, 2 * sizeMultiplier);
        }
        else {
            // ---- BALANCED ROBOT (DEFAULT) DESIGN ----
            // Draw legs
            ctx.fillStyle = this.limbColor;
            
            // Left leg
            ctx.save();
            ctx.translate(-8 * sizeMultiplier, 5 * sizeMultiplier);
            ctx.rotate(legAngle);
            ctx.fillRect(-3 * sizeMultiplier, 0, 6 * sizeMultiplier, 15 * sizeMultiplier);
            ctx.restore();
            
            // Right leg
            ctx.save();
            ctx.translate(8 * sizeMultiplier, 5 * sizeMultiplier);
            ctx.rotate(-legAngle);
            ctx.fillRect(-3 * sizeMultiplier, 0, 6 * sizeMultiplier, 15 * sizeMultiplier);
            ctx.restore();
            
            // Draw body
            ctx.fillStyle = this.bodyColor;
            ctx.fillRect(-10 * sizeMultiplier, -15 * sizeMultiplier + bobHeight, 20 * sizeMultiplier, 20 * sizeMultiplier);
            
            // Draw arms
            ctx.fillStyle = this.limbColor;
            
            // Left arm
            ctx.save();
            ctx.translate(-10 * sizeMultiplier, -5 * sizeMultiplier + bobHeight);
            ctx.rotate(armAngle);
            ctx.fillRect(-5 * sizeMultiplier, 0, 5 * sizeMultiplier, 12 * sizeMultiplier);
            ctx.restore();
            
            // Right arm
            ctx.save();
            ctx.translate(10 * sizeMultiplier, -5 * sizeMultiplier + bobHeight);
            ctx.rotate(-armAngle);
            ctx.fillRect(0, 0, 5 * sizeMultiplier, 12 * sizeMultiplier);
            ctx.restore();
            
            // Draw head
            ctx.fillStyle = this.headColor;
            ctx.fillRect(-8 * sizeMultiplier, -25 * sizeMultiplier + bobHeight, 16 * sizeMultiplier, 12 * sizeMultiplier);
            
            // Draw eyes
            ctx.fillStyle = this.eyeColor;
            // Adjust eye position based on enemy type
            const eyeOffset = 3 * sizeMultiplier;
            const eyeSize = 3 * sizeMultiplier;
            ctx.fillRect(-eyeOffset, -22 * sizeMultiplier + bobHeight, eyeSize, eyeSize);
            ctx.fillRect(eyeOffset - eyeSize, -22 * sizeMultiplier + bobHeight, eyeSize, eyeSize);
        }
        
        ctx.restore();
        
        // Draw a fixed health bar at the top of the enemy (not affected by rotation)
        this.drawHealthBar(renderer);
    }
    
    // Draw a stable health bar that doesn't flash or flicker
    drawHealthBar(renderer) {
        if (!this.body || this.health >= this.maxHealth) return;
        
        const ctx = renderer.ctx;
        const barWidth = this.radius * 2.5;
        const barHeight = 4;
        const healthPercentage = this.health / this.maxHealth;
        
        // Position above the enemy
        const x = this.body.position.x;
        const y = this.body.position.y - this.radius - 15;
        
        ctx.save();
        
        // Draw background (darker shadow)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x - barWidth/2 - 1, y - 1, barWidth + 2, barHeight + 2);
        
        // Draw background
        ctx.fillStyle = '#444';
        ctx.fillRect(x - barWidth/2, y, barWidth, barHeight);
        
        // Determine health color based on percentage
        if (healthPercentage > 0.6) {
            ctx.fillStyle = '#2ecc71'; // Green
        } else if (healthPercentage > 0.3) {
            ctx.fillStyle = '#f39c12'; // Orange/yellow
        } else {
            ctx.fillStyle = '#e74c3c'; // Red
        }
        
        // Draw health fill with slight padding
        ctx.fillRect(x - barWidth/2 + 1, y + 1, (barWidth - 2) * healthPercentage, barHeight - 2);
        
        ctx.restore();
    }

    moveTowardHome(deltaTime, homePosition) {
        if (!this.body || !homePosition) return;
        
        const currentPos = this.body.position;
        const dx = homePosition.x - currentPos.x;
        const dy = homePosition.y - currentPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Only move if not already at target
        if (distance < 5) return;
        
        // Normalize direction vector
        const normalizedDx = dx / distance;
        const normalizedDy = dy / distance;
        
        // Initial force multiplier based on distance from target
        let forceMultiplier = 0.002; // Base force multiplier
        
        // Check if enemy is stuck
        const speed = Math.sqrt(this.body.velocity.x * this.body.velocity.x + 
                            this.body.velocity.y * this.body.velocity.y);
        const isStuck = speed < 0.5 && distance > 20;
        
        // Increase force if stuck
        if (isStuck) {
            forceMultiplier *= 3; // Triple the force to break out of stuck state
            
            // Apply a small random "jitter" to help break symmetrical stalemates
            Matter.Body.setVelocity(this.body, {
                x: this.body.velocity.x + (Math.random() - 0.5) * 2,
                y: this.body.velocity.y - 1 // Slight upward boost
            });
        }
        
        // Scale force by distance but with reduced scaling
        if (distance < 200) {
            forceMultiplier *= (1 + (200 - distance) / 200); // Up to 2x stronger when close
        }
        
        // Vertical force depends on position relative to target
        const verticalFactor = currentPos.y > homePosition.y ? 0.01 : 0.001;
        
        // Apply force toward home, with enhanced horizontal movement
        const cappedDeltaTime = Math.min(deltaTime, 0.05);
        const force = {
            // Use both speed (for movement) and pushForce (for block interaction)
            x: normalizedDx * this.speed * cappedDeltaTime * forceMultiplier * (this.pushForce / 0.1),
            y: normalizedDy * this.speed * cappedDeltaTime * verticalFactor * (this.pushForce / 0.1)
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
        // Cap deltaTime to prevent large jumps
        const cappedDeltaTime = Math.min(deltaTime, 0.05);
        
        const force = {
            // Use pushForce property to determine how hard the enemy pushes
            x: -this.speed * cappedDeltaTime * (this.pushForce / 100), // Scale force by pushForce
            y: 0
        };
        
        // Apply the force at the center of the body
        Matter.Body.applyForce(this.body, this.body.position, force);
        
        // Limit maximum velocity to prevent excessive speeds
        this.limitVelocity();
    }
    
    limitVelocity() {
        if (!this.body) return;
        
        // Use speed to determine maximum velocity - this allows fast enemies to move quickly
        // without pushing blocks harder
        const maxVelocity = this.speed / 6; // Scale max velocity based on speed
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