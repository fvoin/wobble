import Enemy from '../entities/Enemy.js';
// Matter.js is available globally, no need to import it

export default class EnemyManager {
    constructor(physicsEngine) {
        this.physics = physicsEngine;
        
        // Enemy tracking
        this.enemies = [];
        this.currentWave = 0;
        this.waveTimer = 0;
        this.waveInterval = 5; // Seconds between waves
        this.waveActive = false;
        
        // Track enemies for wave completion
        this.enemiesDefeated = 0;
        this.enemiesReachedHome = 0;
        this.totalEnemiesInWave = 0;
        
        // Track last defeated enemy for reward calculation
        this.lastDefeatedEnemy = null;
        
        // Improved spawn system
        this.spawnTimer = 0;
        this.spawnInterval = 1; // One enemy per second
        this.enemiesToSpawn = 0;
        
        // Debug tracking
        this.frameCount = 0;
        
        // Game over state
        this.gameOver = false;
        
        // Wave definitions - each wave has +1 enemy compared to previous
        this.waves = [
            { enemies: 3, types: ['balanced'], reward: { energy: 20, gold: 5 } },
            { enemies: 4, types: ['balanced', 'fast'], reward: { energy: 25, gold: 10 } },
            { enemies: 5, types: ['balanced', 'fast', 'heavy'], reward: { energy: 30, gold: 15 } }
        ];
        
        // Get the canvas dimensions - fallback to reasonable defaults if not available
        const canvas = document.getElementById('game-canvas');
        const canvasWidth = canvas ? canvas.width : 800;
        const canvasHeight = canvas ? canvas.height : 600;
        
        // Calculate ground level - this should match the ground in Game.js
        this.groundLevel = canvasHeight - 25; // 25px from bottom matches Game.js ground position
        
        // Enemy spawn point - ensure it's ABOVE ground level
        this.spawnPoint = { 
            x: canvasWidth - 40, // Right side of the screen
            y: this.groundLevel - 30 // Safely above ground level
        };
        
        // Home location (for enemies to target and player to defend)
        this.homePosition = { 
            x: 100, // Left side of the screen
            y: this.groundLevel - 30 // Safely above ground level
        };
    }
    
    initialize() {
        this.waveTimer = 7; // Changed from 3 to 7 seconds for the first wave
        this.currentWave = 0;
        this.waveActive = false;
        this.enemiesDefeated = 0;
        this.enemiesReachedHome = 0;
        this.totalEnemiesInWave = 0;
        this.enemies = [];
        this.lastDefeatedEnemy = null;
        this.enemiesToSpawn = 0;
        this.spawnTimer = 0;
        this.frameCount = 0;
        this.gameOver = false;
    }
    
    update(deltaTime, towerBlocks) {
        // If game is over, don't update
        if (this.gameOver) return;
        
        // Increment frame counter for debugging
        this.frameCount++;
        
        // Update existing enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(deltaTime, towerBlocks);
            
            // Ensure enemy doesn't go below ground (fixes any ongoing physics issues)
            if (enemy.body && enemy.body.position.y + enemy.radius > this.groundLevel) {
                Matter.Body.setPosition(enemy.body, {
                    x: enemy.body.position.x,
                    y: this.groundLevel - enemy.radius
                });
                
                // Reset vertical velocity to prevent sinking
                Matter.Body.setVelocity(enemy.body, {
                    x: enemy.body.velocity.x,
                    y: 0
                });
            }
            
            // Remove dead enemies
            if (enemy.health <= 0) {
                this.lastDefeatedEnemy = enemy; // Store the defeated enemy
                this.removeEnemy(enemy);
                this.enemiesDefeated++;
            }
            
            // Check if enemy reached home
            if (enemy.hasReachedObjective(this.homePosition)) {
                // Enemy has reached home - this is bad for the player!
                this.enemiesReachedHome++;
                this.removeEnemy(enemy);
                
                // Game over if any enemy reaches home
                this.gameOver = true;
            }
        }
        
        // Handle enemy spawning for current wave if active
        if (this.waveActive && this.enemiesToSpawn > 0) {
            this.spawnTimer -= deltaTime;
            
            if (this.spawnTimer <= 0) {
                this.spawnEnemy();
                this.enemiesToSpawn--;
                this.spawnTimer = this.spawnInterval;
            }
        }
        
        // Calculate how many enemies have been processed in this wave
        const enemiesProcessed = this.enemiesDefeated + this.enemiesReachedHome;
        
        // Check if wave is complete (all enemies processed and none left to spawn)
        const waveComplete = this.waveActive && 
                            this.enemiesToSpawn <= 0 && 
                            enemiesProcessed >= this.totalEnemiesInWave;
        
        // Update wave state
        if (!this.waveActive) {
            this.waveTimer -= deltaTime;
            
            if (this.waveTimer <= 0) {
                this.startWave();
            }
        } else if (waveComplete) {
            // Wave complete - prepare for next wave
            console.log(`Wave ${this.currentWave + 1} completed. Enemies defeated: ${this.enemiesDefeated}, reached home: ${this.enemiesReachedHome}`);
            console.log(`Starting next wave in ${this.waveInterval} seconds.`);
            
            // Increment the wave counter to progress to the next wave
            this.currentWave++;
            console.log(`Advanced to wave ${this.currentWave + 1}`);
            
            this.waveActive = false;
            this.waveTimer = this.waveInterval;
            this.enemiesDefeated = 0;
            this.enemiesReachedHome = 0;
        }
        
        // Log state for debugging every 2 seconds (assuming 60fps)
        if (this.frameCount % 120 === 0) {
            this.logState();
        }
    }
    
    logState() {
        // Helper method to track state for debugging
        console.log({
            waveActive: this.waveActive,
            currentWave: this.currentWave,
            enemiesDefeated: this.enemiesDefeated,
            enemiesReachedHome: this.enemiesReachedHome,
            totalEnemiesInWave: this.totalEnemiesInWave,
            enemiesToSpawn: this.enemiesToSpawn,
            waveTimer: this.waveTimer,
            gameOver: this.gameOver
        });
    }
    
    startWave() {
        // Don't start if game is over
        if (this.gameOver) return;
        
        // If we're beyond the predefined waves, generate a tougher wave
        if (this.currentWave >= this.waves.length) {
            // Instead of looping back to wave 1, continue with increasingly difficult waves
            const lastWave = this.waves[this.waves.length - 1];
            const newWave = {
                // Each new wave has 1 more enemy than the last defined wave
                enemies: lastWave.enemies + (this.currentWave - this.waves.length + 1),
                // Use all available enemy types for advanced waves
                types: ['balanced', 'fast', 'heavy'].filter(type => lastWave.types.includes(type) || Math.random() > 0.5),
                // Increase rewards
                reward: {
                    energy: lastWave.reward.energy + 5,
                    gold: lastWave.reward.gold + 5
                }
            };
            
            // Ensure at least one enemy type
            if (newWave.types.length === 0) {
                newWave.types = ['balanced'];
            }
            
            console.log(`Creating advanced wave ${this.currentWave + 1} with ${newWave.enemies} enemies and types: ${newWave.types.join(', ')}`);
            
            // Use the dynamically generated wave
            this.totalEnemiesInWave = newWave.enemies;
            this.waveActive = true;
            this.enemiesDefeated = 0;
            this.enemiesReachedHome = 0;
            
            // Set up enemy spawning
            this.enemiesToSpawn = newWave.enemies;
            this.spawnTimer = 0; // Spawn first enemy immediately
            
            console.log(`Starting wave ${this.currentWave + 1} with ${newWave.enemies} enemies`);
            return;
        }
        
        const wave = this.waves[this.currentWave];
        this.totalEnemiesInWave = wave.enemies;
        this.waveActive = true;
        this.enemiesDefeated = 0;
        this.enemiesReachedHome = 0;
        
        // Set up enemy spawning
        this.enemiesToSpawn = wave.enemies;
        this.spawnTimer = 0; // Spawn first enemy immediately
        
        console.log(`Starting wave ${this.currentWave + 1} with ${wave.enemies} enemies`);
    }
    
    spawnEnemy() {
        let enemyTypes;
        let enemyType;
        
        // Handle case where we're beyond predefined waves
        if (this.currentWave >= this.waves.length) {
            // Use the last wave's types as a fallback if not specified
            const lastWave = this.waves[this.waves.length - 1];
            
            // For advanced waves, determine which enemy types to use
            // This needs to be consistent with what's defined in startWave()
            enemyTypes = ['balanced', 'fast', 'heavy'].filter(type => 
                lastWave.types.includes(type) || Math.random() > 0.5
            );
            
            // Ensure at least one enemy type
            if (enemyTypes.length === 0) {
                enemyTypes = ['balanced'];
            }
            
            // Randomly choose an enemy type from available types
            const typeIndex = Math.floor(Math.random() * enemyTypes.length);
            enemyType = enemyTypes[typeIndex];
        } else {
            // For predefined waves, get data from the waves array
            const wave = this.waves[this.currentWave];
            // Randomly choose an enemy type from available types for this wave
            const typeIndex = Math.floor(Math.random() * wave.types.length);
            enemyType = wave.types[typeIndex];
        }
        
        // Calculate a better spawn position - farther from ground and other objects
        // Get the canvas dimensions - fallback to reasonable defaults if not available
        const canvas = document.getElementById('game-canvas');
        const canvasWidth = canvas ? canvas.width : 800;
        
        // Ensure the Y position is well above ground level to avoid collision issues
        const spawnY = this.spawnPoint.y - 30 - Math.random() * 40; // Higher spawn point
        
        // Randomize X position more to avoid clustering
        const spawnX = canvasWidth - 40 - Math.random() * 60;
        
        // Create enemy with improved positioning
        const enemy = new Enemy(
            spawnX,
            spawnY,
            enemyType,
            this.physics
        );
        
        // Safety check - ensure enemy isn't below ground
        if (enemy.body && enemy.body.position.y + enemy.radius > this.groundLevel) {
            // Correct position if it's below ground
            Matter.Body.setPosition(enemy.body, {
                x: enemy.body.position.x,
                y: this.groundLevel - enemy.radius - 15 // Set well above ground
            });
        }
        
        // Add initial velocity toward the target to help unstick
        if (enemy.body) {
            // Calculate direction to home
            const dx = this.homePosition.x - enemy.body.position.x;
            const totalDistance = Math.abs(dx);
            
            // Only apply horizontal force based on enemy type speed
            const initialForce = enemy.speed / 2000;
            
            // Apply initial impulse
            Matter.Body.setVelocity(enemy.body, {
                x: Math.sign(dx) * initialForce * totalDistance,
                y: -0.5 // Slight upward boost to avoid ground sticking
            });
        }
        
        this.enemies.push(enemy);
        console.log(`Spawned ${enemyType} enemy at (${enemy.x}, ${enemy.y}). Remaining to spawn: ${this.enemiesToSpawn}`);
    }
    
    removeEnemy(enemy) {
        const index = this.enemies.indexOf(enemy);
        if (index !== -1) {
            this.enemies.splice(index, 1);
            // Remove from physics world if it has a body
            if (enemy.body) {
                Matter.Composite.remove(this.physics.world, enemy.body);
            }
        }
    }
    
    render(renderer) {
        // Draw home
        this.renderHome(renderer);
        
        // Draw all enemies
        this.enemies.forEach(enemy => {
            // Use the enemy's own render method instead of the renderer's drawEnemy
            enemy.render(renderer);
        });
        
        // Draw wave number prominently
        renderer.drawText(
            `WAVE ${this.currentWave + 1}`, 
            400, 
            20, 
            { font: 'bold 18px Arial', color: '#FFD700' }
        );
        
        // Draw wave information
        const waveText = this.gameOver 
            ? "GAME OVER!" 
            : (this.waveActive 
                ? `${this.totalEnemiesInWave - (this.enemiesDefeated + this.enemiesReachedHome)} enemies left` 
                : `Next wave in ${Math.ceil(this.waveTimer)}s`);
        
        renderer.drawText(waveText, 400, 50, { font: '16px Arial', color: '#FFF' });
    }
    
    renderHome(renderer) {
        // Draw a simple house to represent player's home
        const x = this.homePosition.x;
        // Modified Y position to sit directly on the ground
        const groundLevel = this.groundLevel;
        const y = groundLevel; // Move house down so it sits on ground
        
        // House body
        renderer.ctx.fillStyle = '#8B4513'; // Brown color for house
        renderer.ctx.fillRect(x - 30, y - 40, 60, 40);
        
        // Roof
        renderer.ctx.fillStyle = '#A52A2A'; // Brown-red for roof
        renderer.ctx.beginPath();
        renderer.ctx.moveTo(x - 40, y - 40);
        renderer.ctx.lineTo(x, y - 70);
        renderer.ctx.lineTo(x + 40, y - 40);
        renderer.ctx.closePath();
        renderer.ctx.fill();
        
        // Door
        renderer.ctx.fillStyle = '#4B2D10';
        renderer.ctx.fillRect(x - 10, y - 30, 20, 30);
        
        // Window
        renderer.ctx.fillStyle = '#ADD8E6';
        renderer.ctx.fillRect(x - 25, y - 35, 15, 15);
        
        // Draw a "DEFEND" text above the house
        renderer.ctx.fillStyle = '#FFFFFF';
        renderer.ctx.font = '14px Arial';
        renderer.ctx.textAlign = 'center';
        renderer.ctx.fillText('DEFEND!', x, y - 80);
        
        // Add a protective glow for visual emphasis (only when not game over)
        if (!this.gameOver) {
            renderer.ctx.beginPath();
            renderer.ctx.arc(x, y - 30, 50, 0, Math.PI * 2);
            const gradient = renderer.ctx.createRadialGradient(x, y - 30, 30, x, y - 30, 50);
            gradient.addColorStop(0, 'rgba(100, 200, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
            renderer.ctx.fillStyle = gradient;
            renderer.ctx.fill();
        } else {
            // Red danger glow when game over
            renderer.ctx.beginPath();
            renderer.ctx.arc(x, y - 30, 50, 0, Math.PI * 2);
            const gradient = renderer.ctx.createRadialGradient(x, y - 30, 30, x, y - 30, 50);
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            renderer.ctx.fillStyle = gradient;
            renderer.ctx.fill();
        }
    }
    
    isWaveCompleted() {
        // Check if current wave is completed (all enemies processed and none left to spawn)
        const enemiesProcessed = this.enemiesDefeated + this.enemiesReachedHome;
        return this.waveActive && 
               this.enemiesToSpawn <= 0 && 
               enemiesProcessed >= this.totalEnemiesInWave;
    }
    
    getCurrentWaveReward() {
        if (this.currentWave < this.waves.length) {
            return this.waves[this.currentWave].reward;
        } else {
            // For advanced waves, calculate increased rewards based on the last defined wave
            const lastWave = this.waves[this.waves.length - 1];
            const additionalWaves = this.currentWave - this.waves.length + 1;
            
            return {
                energy: lastWave.reward.energy + (additionalWaves * 5),
                gold: lastWave.reward.gold + (additionalWaves * 5)
            };
        }
    }
    
    prepareNextWave() {
        this.currentWave++;
        this.waveActive = false;
        this.waveTimer = this.waveInterval;
    }
    
    hasReachedObjective() {
        // Return true if any enemy has reached the home (game over)
        return this.gameOver;
    }
    
    getLastDefeatedEnemy() {
        return this.lastDefeatedEnemy;
    }
    
    resetLastDefeatedEnemy() {
        this.lastDefeatedEnemy = null;
    }
} 