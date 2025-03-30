export default class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
        
        // Define color palette
        this.colors = {
            background: '#333',
            ground: '#654321',
            towerBlock: {
                wood: '#A0522D',
                stone: '#808080',
                metal: '#C0C0C0'
            },
            cannon: '#333333',
            enemies: {
                basic: '#FF0000',
                fast: '#FF8000',
                heavy: '#8B0000',
                flying: '#FFC0CB'
            },
            projectile: '#FFFF00',
            ui: {
                energy: '#00FFFF',
                gold: '#FFD700'
            }
        };
    }
    
    drawBackground(width, height) {
        // Draw sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#E0F7FF');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw ground with more distinct styling
        const groundHeight = 50;
        const groundY = height - groundHeight;
        
        // Fill ground with texture pattern
        this.ctx.fillStyle = '#3a5c3b'; // Dark green
        this.ctx.fillRect(0, groundY, width, groundHeight);
        
        // Add texture lines to ground
        this.ctx.strokeStyle = '#2a4c2b'; // Darker green for texture
        this.ctx.lineWidth = 1;
        
        // Draw horizontal lines
        for (let y = groundY + 5; y < height; y += 10) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
        
        // Draw top border of ground to make it more visible
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, groundY);
        this.ctx.lineTo(width, groundY);
        this.ctx.stroke();
    }
    
    drawTowerBlock(block) {
        if (!block.body) return;
        
        // Draw the block
        this.ctx.save();
        
        // Set position and rotation from physics body
        this.ctx.translate(block.body.position.x, block.body.position.y);
        this.ctx.rotate(block.body.angle);
        
        // Set color based on material
        this.ctx.fillStyle = this.colors.towerBlock[block.material] || this.colors.towerBlock.wood;
        
        // Draw shape based on block type
        if (block.blockType === 'L-shape' && block.vertices) {
            // Draw custom L-shape using stored vertices
            this.ctx.beginPath();
            this.ctx.moveTo(block.vertices[0].x, block.vertices[0].y);
            
            for (let i = 1; i < block.vertices.length; i++) {
                this.ctx.lineTo(block.vertices[i].x, block.vertices[i].y);
            }
            
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        } else {
            // Draw rectangular block
            const w = block.width;
            const h = block.height;
            
            this.ctx.fillRect(-w/2, -h/2, w, h);
            
            // Draw border
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(-w/2, -h/2, w, h);
        }
        
        // Draw cannon
        this.drawCannon(block);
        
        this.ctx.restore();
        
        // Draw health bar (outside the rotation transformation)
        this.drawFixedHealthBar(block);
        
        // Draw projectiles from this block
        if (block.projectiles) {
            for (const projectile of block.projectiles) {
                this.drawProjectile(projectile);
            }
        }
    }
    
    drawCannon(block) {
        // Don't draw a cannon for L-shaped blocks
        if (block.blockType === 'L-shape') {
            return;
        }
        
        const cannonSize = 8;
        const cannonLength = 12;
        
        // Position the cannon based on block's cannon offset
        this.ctx.fillStyle = this.colors.cannon;
        
        // Draw cannon body as a rectangle
        this.ctx.fillRect(
            block.cannonOffsetX - cannonSize/2, 
            block.cannonOffsetY - cannonSize/2, 
            cannonSize, 
            cannonLength
        );
        
        // Draw cannon base as a circle
        this.ctx.beginPath();
        this.ctx.arc(
            block.cannonOffsetX, 
            block.cannonOffsetY, 
            cannonSize/2 + 2, 
            0, 
            Math.PI * 2
        );
        this.ctx.fill();
    }
    
    drawFixedHealthBar(entity) {
        if (!entity.body) return;
        
        const barWidth = entity.width || entity.radius * 2;
        const barHeight = 5;
        const healthPercentage = entity.health / entity.maxHealth;
        
        // Position above the entity in screen coordinates
        const x = entity.body.position.x;
        const y = entity.body.position.y - entity.height/2 - 15;
        
        // Background
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(x - barWidth/2, y, barWidth, barHeight);
        
        // Health fill
        this.ctx.fillStyle = healthPercentage > 0.5 ? '#00FF00' : healthPercentage > 0.25 ? '#FFFF00' : '#FF0000';
        this.ctx.fillRect(x - barWidth/2, y, barWidth * healthPercentage, barHeight);
        
        // Border
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x - barWidth/2, y, barWidth, barHeight);
    }
    
    drawEnemy(enemy) {
        this.ctx.save();
        
        // Position from physics body
        this.ctx.translate(enemy.body.position.x, enemy.body.position.y);
        
        // Set color based on enemy type
        this.ctx.fillStyle = this.colors.enemies[enemy.type] || this.colors.enemies.basic;
        
        // Draw the enemy based on its shape
        if (enemy.shape === 'circle') {
            this.ctx.beginPath();
            this.ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        } else {
            // Draw rectangular enemy
            this.ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
            this.ctx.strokeRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
        }
        
        this.ctx.restore();
        
        // Draw health bar without rotation
        this.drawFixedHealthBar(enemy);
    }
    
    drawHealthBar(entity) {
        const barWidth = entity.width || entity.radius * 2;
        const barHeight = 5;
        const healthPercentage = entity.health / entity.maxHealth;
        
        // Background
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(-barWidth / 2, -entity.height / 2 - 10, barWidth, barHeight);
        
        // Health fill
        this.ctx.fillStyle = healthPercentage > 0.5 ? '#00FF00' : healthPercentage > 0.25 ? '#FFFF00' : '#FF0000';
        this.ctx.fillRect(-barWidth / 2, -entity.height / 2 - 10, barWidth * healthPercentage, barHeight);
    }
    
    drawRope(x, y, length, angle) {
        this.ctx.save();
        
        // Start at the anchor point
        this.ctx.translate(x, y);
        
        // Calculate end point of rope
        const endX = Math.sin(angle) * length;
        const endY = length; // Fixed length down from anchor
        
        // Draw rope
        this.ctx.strokeStyle = '#A0522D';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawHoldingBlock(block, x, y) {
        this.ctx.save();
        
        this.ctx.translate(x, y);
        
        // Set color based on material
        this.ctx.fillStyle = this.colors.towerBlock[block.material] || this.colors.towerBlock.wood;
        
        // Draw shape based on block type
        if (block.blockType === 'L-shape') {
            // Draw L-shape
            this.ctx.beginPath();
            this.ctx.moveTo(-block.width/2, -block.height/2);
            this.ctx.lineTo(0, -block.height/2);
            this.ctx.lineTo(0, 0);
            this.ctx.lineTo(block.width/2, 0);
            this.ctx.lineTo(block.width/2, block.height/2);
            this.ctx.lineTo(-block.width/2, block.height/2);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Draw outline
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        } else {
            // Draw rectangular block (square or plank)
            this.ctx.fillRect(-block.width / 2, -block.height / 2, block.width, block.height);
            
            // Draw outline
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(-block.width / 2, -block.height / 2, block.width, block.height);
        }
        
        // Draw a small preview of the cannon
        this.ctx.fillStyle = this.colors.cannon;
        
        // Position depends on block type
        let cannonX = 0;
        let cannonY = -block.height/2;
        
        if (block.blockType === 'plank') {
            cannonX = block.width/4;
        } else if (block.blockType === 'L-shape') {
            cannonX = -block.width/4;
        }
        
        // Draw cannon circle - but not for L-shaped blocks
        if (block.blockType !== 'L-shape') {
            this.ctx.beginPath();
            this.ctx.arc(cannonX, cannonY - 3, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }
    
    drawProjectile(projectile) {
        this.ctx.save();
        
        this.ctx.translate(projectile.position.x, projectile.position.y);
        
        // Draw projectile
        this.ctx.fillStyle = this.colors.projectile;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawText(text, x, y, options = {}) {
        this.ctx.save();
        
        this.ctx.font = options.font || '16px Arial';
        this.ctx.fillStyle = options.color || '#FFF';
        this.ctx.textAlign = options.align || 'center';
        this.ctx.textBaseline = options.baseline || 'middle';
        
        this.ctx.fillText(text, x, y);
        
        this.ctx.restore();
    }
} 