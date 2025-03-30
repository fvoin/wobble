export default class Projectile {
    constructor(x, y, targetX, targetY, damage, speed = 300) {
        this.position = { x, y };
        this.radius = 5;
        this.damage = damage;
        this.speed = speed;
        this.active = true;
        
        // Calculate direction toward target
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Normalize direction vector
        this.direction = {
            x: dx / distance,
            y: dy / distance
        };
        
        // Set a maximum lifetime for the projectile (2 seconds)
        this.lifetime = 2;
    }
    
    update(deltaTime, enemies) {
        // Reduce lifetime
        this.lifetime -= deltaTime;
        
        // Deactivate if lifetime is up
        if (this.lifetime <= 0) {
            this.active = false;
            return;
        }
        
        // Move projectile in the calculated direction
        this.position.x += this.direction.x * this.speed * deltaTime;
        this.position.y += this.direction.y * this.speed * deltaTime;
        
        // Check for collisions with enemies
        this.checkCollisions(enemies);
    }
    
    checkCollisions(enemies) {
        if (!enemies || !this.active) return;
        
        for (const enemy of enemies) {
            if (!enemy.body || enemy.health <= 0) continue;
            
            const enemyPos = enemy.body.position;
            const dx = enemyPos.x - this.position.x;
            const dy = enemyPos.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If collision detected (using enemy radius or width/height)
            const hitRadius = enemy.radius || Math.max(enemy.width, enemy.height) / 2;
            
            if (distance < this.radius + hitRadius) {
                // Deal damage to the enemy
                enemy.takeDamage(this.damage);
                
                // Deactivate the projectile
                this.active = false;
                break;
            }
        }
    }
} 