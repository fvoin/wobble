import Physics from './Physics.js';
import Renderer from './Renderer.js';
import Input from './Input.js';
import TowerBuilder from '../systems/TowerBuilder.js';
import EnemyManager from '../systems/EnemyManager.js';
import ResourceManager from '../systems/ResourceManager.js';
// Matter.js is available globally via script tag in index.html

export default class Game {
    constructor(config) {
        // Canvas setup
        this.canvas = document.getElementById(config.canvasId);
        if (!this.canvas) {
            console.error("Canvas element not found:", config.canvasId);
            return;
        }
        
        this.canvas.width = config.width || 800;
        this.canvas.height = config.height || 600;
        this.ctx = this.canvas.getContext('2d');
        
        // Core systems
        this.physics = new Physics();
        this.renderer = new Renderer(this.ctx);
        this.input = new Input(this.canvas);
        
        // Game systems
        this.resourceManager = new ResourceManager();
        
        // Initialize TowerBuilder with the physics instance and resource manager
        this.towerBuilder = new TowerBuilder(this.physics, this.canvas, this.input, this.resourceManager);
        
        // Initialize EnemyManager with the physics instance
        this.enemyManager = new EnemyManager(this.physics);
        
        // Game state
        this.isRunning = false;
        this.gameOver = false;
        this.lastTime = 0;
        this.frameCount = 0;
        
        // Time step settings for stable physics
        this.fixedTimeStep = 1/60; // Target 60 updates per second
        this.maxDeltaTime = 0.05; // Cap at 50ms (20fps) to prevent huge jumps
        this.accumulatedTime = 0;
        
        // FPS monitoring
        this.lastFpsUpdate = 0;
        this.framesThisSecond = 0;
        this.fps = 60;
        
        // Create static ground
        this.createGround();
        
        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
        this.restart = this.restart.bind(this);
        
        // Expose game instance globally for button functionality
        window.gameInstance = this;
        
        // Create game over popup (hidden initially)
        this.createGameOverPopup();
        
        console.log("Game initialized successfully");
    }
    
    createGround() {
        try {
            // Calculate ground position
            const groundY = this.canvas.height - 25;
            const groundWidth = this.canvas.width;
            const groundHeight = 50;
            const groundX = this.canvas.width / 2;
            
            // Store ground information for other components to access
            this.groundInfo = {
                x: groundX,
                y: groundY,
                width: groundWidth,
                height: groundHeight,
                top: groundY - groundHeight/2 // Top surface of ground
            };
            
            // Create a static ground rectangle directly with Matter.js
            const ground = Matter.Bodies.rectangle(
                groundX,
                groundY,
                groundWidth,
                groundHeight,
                { 
                    isStatic: true, 
                    label: 'ground',
                    friction: 0.5,     // Higher friction to prevent sliding
                    restitution: 0.1,  // Low restitution (bounciness)
                    collisionFilter: {
                        category: 0x0001,
                        mask: 0xFFFFFFFF
                    }
                }
            );
            
            // Add ground directly to the world
            Matter.Composite.add(this.physics.world, ground);
            
            // Store ground body reference
            this.groundBody = ground;
            
            return ground;
            
        } catch (error) {
            console.error("Error creating ground:", error);
            return null;
        }
    }
    
    getGroundLevel() {
        if (this.groundInfo) {
            return this.groundInfo.top;
        }
        // Fallback if ground info isn't available
        return this.canvas.height - 50;
    }
    
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTime = performance.now();
            
            // Start initial game state
            this.initialize();
            
            // Start the game loop
            requestAnimationFrame(this.gameLoop);
        }
    }
    
    stop() {
        this.isRunning = false;
    }
    
    gameLoop(timestamp) {
        if (!this.isRunning) return;
        
        // Calculate raw delta time
        const now = timestamp;
        let deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;
        
        // FPS calculation
        if (now > this.lastFpsUpdate + 1000) { // Update every second
            this.fps = this.framesThisSecond;
            this.framesThisSecond = 0;
            this.lastFpsUpdate = now;
            console.log(`FPS: ${this.fps}`);
        }
        this.framesThisSecond++;
        
        // Cap maximum delta to prevent spiral of death
        if (deltaTime > this.maxDeltaTime) {
            console.warn(`Delta time capped from ${deltaTime.toFixed(3)}s to ${this.maxDeltaTime}s`);
            deltaTime = this.maxDeltaTime;
        }
        
        // Accumulate time since last frame
        this.accumulatedTime += deltaTime;
        
        // Fixed time step loop - this provides more stable physics
        let updated = false;
        while (this.accumulatedTime >= this.fixedTimeStep) {
            this.update(this.fixedTimeStep);
            this.accumulatedTime -= this.fixedTimeStep;
            updated = true;
            
            // Prevent spiral of death by limiting the number of updates per frame
            if (this.accumulatedTime > this.fixedTimeStep * 4) {
                console.warn("Too many updates needed, skipping to avoid spiral of death");
                this.accumulatedTime = 0;
                break;
            }
        }
        
        // Only render if we updated at least once
        if (updated) {
            this.render();
            this.frameCount++;
        }
        
        // Continue the loop
        requestAnimationFrame(this.gameLoop);
    }
    
    update(deltaTime) {
        // Don't update if game is over and paused
        if (this.gameOver && !this.isRunning) return;
        
        // Update input
        this.input.update();
        
        // Update physics
        this.physics.update(deltaTime);
        
        // Update game systems
        this.towerBuilder.update(deltaTime);
        
        // Update tower blocks
        for (const block of this.towerBuilder.getTowerBlocks()) {
            block.update(deltaTime, this.enemyManager.enemies);
        }
        
        this.enemyManager.update(deltaTime, this.towerBuilder.getTowerBlocks());
        this.resourceManager.update(deltaTime);
        
        // Check if an enemy was defeated and award energy - with error handling
        try {
            const lastDefeatedEnemy = this.enemyManager.getLastDefeatedEnemy();
            if (lastDefeatedEnemy) {
                const energyReward = lastDefeatedEnemy.getEnergyReward();
                this.resourceManager.addEnergy(energyReward);
                this.enemyManager.resetLastDefeatedEnemy();
            }
        } catch (error) {
            console.warn("Energy reward system not fully loaded yet:", error.message);
            // Add fallback methods if they don't exist yet
            if (!this.enemyManager.getLastDefeatedEnemy) {
                this.enemyManager.getLastDefeatedEnemy = function() { return null; };
            }
            if (!this.enemyManager.resetLastDefeatedEnemy) {
                this.enemyManager.resetLastDefeatedEnemy = function() {};
            }
        }
        
        // Handle collisions and game logic
        this.handleCollisions();
        
        // Check for wave completion or game over
        this.checkGameState();
    }
    
    render() {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.renderer.drawBackground(this.canvas.width, this.canvas.height);
        
        // Draw game elements
        this.towerBuilder.render(this.renderer);
        this.enemyManager.render(this.renderer);
        
        // Draw UI elements
        this.renderUI();
    }
    
    renderUI() {
        // Update resource display in DOM
        document.querySelector('#energy span').textContent = Math.floor(this.resourceManager.energy);
        document.querySelector('#gold span').textContent = Math.floor(this.resourceManager.gold);
    }
    
    handleCollisions() {
        // Process collisions between enemies and tower blocks
        const collisions = this.physics.getCollisions();
        
        collisions.forEach(collision => {
            const { bodyA, bodyB } = collision;
            
            // Check for enemy-block collisions
            const isEnemyA = bodyA.label === 'enemy';
            const isEnemyB = bodyB.label === 'enemy';
            const isBlockA = bodyA.label === 'towerBlock';
            const isBlockB = bodyB.label === 'towerBlock';
            
            // Handle enemy-block collision
            if ((isEnemyA && isBlockB) || (isEnemyB && isBlockA)) {
                const enemy = isEnemyA ? bodyA.enemyRef : bodyB.enemyRef;
                const block = isBlockA ? bodyA.blockRef : bodyB.blockRef;
                
                if (enemy && block) {
                    // Enemy damages block on collision
                    block.takeDamage(enemy.damage * 0.05); // Scale damage for impact
                    
                    // Check for block destruction
                    if (block.durability <= 0) {
                        this.towerBuilder.removeBlock(block);
                    }
                }
            }
        });
    }
    
    createGameOverPopup() {
        // Remove existing popup if it exists
        const existingPopup = document.getElementById('game-over-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        // Create popup element
        const popup = document.createElement('div');
        popup.id = 'game-over-popup';
        popup.style.position = 'absolute';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        popup.style.color = 'white';
        popup.style.padding = '30px';
        popup.style.borderRadius = '10px';
        popup.style.textAlign = 'center';
        popup.style.display = 'none';
        popup.style.zIndex = '1000';
        popup.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.5)';
        popup.style.border = '2px solid #ff0000';
        
        // Add content to popup
        const title = document.createElement('h2');
        title.textContent = 'GAME OVER';
        title.style.color = '#ff0000';
        title.style.marginTop = '0';
        title.style.fontSize = '32px';
        
        const message = document.createElement('p');
        message.textContent = 'An enemy has reached your home!';
        message.style.fontSize = '16px';
        message.style.marginBottom = '20px';
        
        const restartButton = document.createElement('button');
        restartButton.textContent = 'Restart Game';
        restartButton.style.backgroundColor = '#4CAF50';
        restartButton.style.color = 'white';
        restartButton.style.padding = '12px 24px';
        restartButton.style.border = 'none';
        restartButton.style.borderRadius = '5px';
        restartButton.style.cursor = 'pointer';
        restartButton.style.fontSize = '16px';
        
        // Add hover effect
        restartButton.onmouseover = function() {
            this.style.backgroundColor = '#45a049';
        };
        restartButton.onmouseout = function() {
            this.style.backgroundColor = '#4CAF50';
        };
        
        // Add restart functionality
        restartButton.addEventListener('click', this.restart);
        
        // Assemble popup
        popup.appendChild(title);
        popup.appendChild(message);
        popup.appendChild(restartButton);
        
        // Add to document
        const gameContainer = document.getElementById('game-container');
        gameContainer.appendChild(popup);
        
        this.gameOverPopup = popup;
    }
    
    restart() {
        console.log("Restarting game...");
        
        // Hide game over popup
        if (this.gameOverPopup) {
            this.gameOverPopup.style.display = 'none';
        }
        
        // Reset game state
        this.gameOver = false;
        
        // Stop the game loop temporarily while we reset
        const wasRunning = this.isRunning;
        this.isRunning = false;
        
        // Ensure Input system has necessary methods
        if (this.input) {
            console.log("Refreshing input system...");
            
            // Reset input state completely
            this.input.dropRequested = false;
            this.input.pressed = false;
            this.input.released = false;
            
            // Add isDropRequested method if it doesn't exist
            if (typeof this.input.isDropRequested !== 'function') {
                console.warn("Adding missing isDropRequested method to Input class");
                this.input.isDropRequested = function() {
                    return this.dropRequested || false;
                };
            }
            
            // Add requestDrop method if it doesn't exist
            if (typeof this.input.requestDrop !== 'function') {
                console.warn("Adding missing requestDrop method to Input class");
                this.input.requestDrop = function() {
                    this.dropRequested = true;
                    console.log("Manual drop requested via fallback method");
                };
            }
            
            // Ensure dropRequested property exists
            if (typeof this.input.dropRequested === 'undefined') {
                this.input.dropRequested = false;
            }
        }
        
        // Explicitly clear existing enemies before resetting physics
        if (this.enemyManager && this.enemyManager.enemies) {
            // Clean up enemy physics bodies properly
            for (const enemy of this.enemyManager.enemies) {
                if (enemy.body) {
                    try {
                        // Remove references to prevent circular references
                        enemy.body.enemyRef = null;
                        
                        // Remove from world if not already removed
                        Matter.Composite.remove(this.physics.world, enemy.body);
                    } catch (e) {
                        console.warn("Error removing enemy body:", e);
                    }
                }
            }
            
            // Clear enemy array
            this.enemyManager.enemies = [];
        }
        
        // Explicitly clear existing tower blocks
        if (this.towerBuilder && this.towerBuilder.getTowerBlocks) {
            const blocks = this.towerBuilder.getTowerBlocks();
            if (blocks && blocks.length) {
                for (const block of blocks) {
                    if (block.body) {
                        try {
                            // Remove references to prevent circular references
                            block.body.blockRef = null;
                            
                            // Remove from world if not already removed
                            Matter.Composite.remove(this.physics.world, block.body);
                        } catch (e) {
                            console.warn("Error removing block body:", e);
                        }
                    }
                }
            }
            // Clear blocks array directly
            this.towerBuilder.towerBlocks = [];
            
            // Reset TowerBuilder flags to ensure they don't carry over
            if (this.towerBuilder) {
                console.log("Resetting TowerBuilder state flags");
                this.towerBuilder.isPlacingBlock = false;
                this.towerBuilder.isCreatingBlock = false;
                this.towerBuilder.pendingBlock = null;
                this.towerBuilder.lastPlaceTime = 0;
                
                if (this.towerBuilder.messageTimeout) {
                    clearTimeout(this.towerBuilder.messageTimeout);
                    this.towerBuilder.messageTimeout = null;
                }
                this.towerBuilder.insufficientEnergyMessage = null;
            }
        }
        
        // Reset physics world - try different approaches for more resilience
        let physicsReset = false;
        
        try {
            // First, try to clear all bodies from world without creating new engine
            if (this.physics && this.physics.world) {
                const allBodies = Matter.Composite.allBodies(this.physics.world);
                console.log(`Found ${allBodies.length} bodies to remove from physics world`);
                
                // Remove each body individually
                for (const body of allBodies) {
                    Matter.Composite.remove(this.physics.world, body);
                }
                
                // Then clear the world composite
                Matter.Composite.clear(this.physics.world);
                console.log("Cleared all bodies from physics world");
            }
            
            // Method 1: Try using the reset method if available
            if (typeof this.physics.reset === 'function') {
                this.physics.reset();
                physicsReset = true;
                console.log("Physics reset via reset method");
            }
        } catch (error) {
            console.warn("Error cleaning up physics world:", error);
        }
        
        // If reset method didn't work, create new physics instance
        if (!physicsReset) {
            try {
                console.log("Creating new Physics instance");
                // Create a new physics instance
                this.physics = new Physics();
                physicsReset = true;
            } catch (error) {
                console.error("Error creating new physics instance:", error);
            }
        }
        
        // Create new ground
        this.createGround();
        
        // Clear all existing blocks and enemies and recreate the systems
        // Create completely new instances to avoid state carry-over
        this.resourceManager = new ResourceManager();
        this.towerBuilder = new TowerBuilder(this.physics, this.canvas, this.input, this.resourceManager);
        this.enemyManager = new EnemyManager(this.physics);
        
        // Share ground level info with enemy manager
        if (this.groundInfo && this.enemyManager) {
            this.enemyManager.groundLevel = this.groundInfo.top;
            console.log(`Synchronized ground level: ${this.groundInfo.top}`);
        }
        
        // Initialize the game systems in the correct order
        this.resourceManager.initialize();
        this.towerBuilder.initialize();
        this.enemyManager.initialize();
        
        // Reset timers
        this.lastTime = performance.now();
        this.frameCount = 0;
        
        // Give a moment for physics to stabilize before restarting game loop
        setTimeout(() => {
            // Clear any pending timeouts from the old TowerBuilder
            for (let i = 1; i < 1000; i++) {
                window.clearTimeout(i);
            }
            
            // Restart the game loop
            this.isRunning = wasRunning;
            if (this.isRunning) {
                requestAnimationFrame(this.gameLoop);
            }
            console.log("Game restart complete");
        }, 100);
    }
    
    checkGameState() {
        // Check for destroyed blocks
        const blocks = this.towerBuilder.getTowerBlocks();
        for (let i = blocks.length - 1; i >= 0; i--) {
            if (blocks[i].durability <= 0) {
                this.towerBuilder.removeBlock(blocks[i]);
            }
        }
        
        // Check if wave is completed and award wave completion bonus
        if (this.enemyManager.isWaveCompleted()) {
            console.log("Wave completed in Game.js - awarding rewards");
            // Add wave completion bonus rewards
            this.resourceManager.addRewards(this.enemyManager.getCurrentWaveReward());
            this.enemyManager.prepareNextWave();
        }
        
        // Game over condition - enemy reached the home
        if (this.enemyManager.hasReachedObjective() && !this.gameOver) {
            this.gameOver = true;
            this.handleGameOver();
        }
    }
    
    handleGameOver() {
        console.log("Game Over - Enemy reached the home!");
        
        // Show the game over popup
        if (this.gameOverPopup) {
            this.gameOverPopup.style.display = 'block';
        }
        
        // Optionally pause the game
        // this.isRunning = false;
    }
    
    initialize() {
        // Ensure Input system has necessary methods
        if (this.input) {
            // Add isDropRequested method if it doesn't exist
            if (typeof this.input.isDropRequested !== 'function') {
                console.warn("Adding missing isDropRequested method to Input class");
                this.input.isDropRequested = function() {
                    return this.dropRequested || false;
                };
            }
            
            // Add requestDrop method if it doesn't exist
            if (typeof this.input.requestDrop !== 'function') {
                console.warn("Adding missing requestDrop method to Input class");
                this.input.requestDrop = function() {
                    this.dropRequested = true;
                    console.log("Manual drop requested via fallback method");
                };
            }
            
            // Ensure dropRequested property exists
            if (typeof this.input.dropRequested === 'undefined') {
                this.input.dropRequested = false;
            }
        }
        
        // Add code to the initialize method to update EnemyManager with ground info
        if (this.enemyManager && this.groundInfo) {
            this.enemyManager.groundLevel = this.groundInfo.top;
        }
        
        // Add a direct debug method for forcing a block drop
        window.forceBlockDrop = () => {
            console.log("Forcing block drop from window method");
            if (this.towerBuilder) {
                if (typeof this.towerBuilder.doSimpleDrop === 'function') {
                    this.towerBuilder.doSimpleDrop();
                    return true;
                }
                else if (typeof this.towerBuilder.simpleDrop === 'function') {
                    this.towerBuilder.simpleDrop();
                    return true;
                }
                else if (typeof this.towerBuilder.placeBlock === 'function') {
                    this.towerBuilder.placeBlock();
                    return true;
                }
            }
            return false;
        };
        
        // Continue with normal initialization
        this.towerBuilder.initialize();
        this.enemyManager.initialize();
        this.resourceManager.initialize();
    }
} 