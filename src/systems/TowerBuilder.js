import TowerBlock from '../entities/TowerBlock.js';
// Matter.js is available globally, no need to import it

export default class TowerBuilder {
    constructor(physicsEngine, canvas, input, resourceManager) {
        this.physics = physicsEngine;
        this.canvas = canvas;
        this.input = input;
        this.resourceManager = resourceManager; // Add reference to ResourceManager
        
        // Tower building state
        this.ropePosition = { x: canvas.width / 2, y: 50 };
        this.ropeLength = 100;
        this.ropeAngle = 0;
        this.ropeSwingSpeed = 1.5;
        this.swingDirection = 1;
        
        // Tower blocks
        this.pendingBlock = null;
        this.nextBlockType = null; // Store the next block type
        this.towerBlocks = [];
        
        // Block types with different shapes
        this.blockTypes = [
            { type: 'plank', blockType: 'plank', material: 'wood', durability: 100 },
            { type: 'square', blockType: 'square', material: 'stone', durability: 150 },
            { type: 'L-shape', blockType: 'L-shape', material: 'metal', durability: 200 }
        ];
        
        // Message for insufficient energy
        this.insufficientEnergyMessage = null;
        this.messageTimeout = null;
        
        // Add a throttle to prevent rapid block dropping
        this.lastPlaceTime = 0;
        this.placeDelay = 300; // 300ms between block placements
        
        // Flag to track if a block drop is in progress to prevent double energy consumption
        this.isPlacingBlock = false;
        this.isCreatingBlock = false;
        
        // Remove any existing event listeners for manualBlockDrop
        // We create a named handler for easier removal
        this.handleManualBlockDrop = () => {
            console.log("Manual block drop event received");
            this.doSimpleDrop();
        };
        
        // Pre-select the next block
        this.selectNextBlockType();
        
        // Clean up old event listeners if possible (important for restart)
        try {
            document.removeEventListener('manualBlockDrop', this.handleManualBlockDrop);
            
            if (canvas) {
                const oldListeners = canvas._towerBuilderListeners;
                if (oldListeners) {
                    for (const listener of oldListeners) {
                        canvas.removeEventListener(listener.type, listener.fn);
                    }
                }
            }
            
            // Keep track of event listeners we add to clean them up later if needed
            canvas._towerBuilderListeners = [];
        } catch (e) {
            console.warn("Error cleaning up old event listeners:", e);
        }
        
        // Listen for custom event for manual block drop
        document.addEventListener('manualBlockDrop', this.handleManualBlockDrop);
        
        // Add a handler for a direct canvas click in case the event system fails
        if (canvas) {
            // Add direct mousedown handler
            const mousedownHandler = (e) => {
                console.log("Direct mousedown detected in TowerBuilder");
                // Use a more direct drop method
                this.doSimpleDrop();
            };
            canvas.addEventListener('mousedown', mousedownHandler);
            canvas._towerBuilderListeners.push({ type: 'mousedown', fn: mousedownHandler });
            
            // Add direct touchstart handler for mobile
            const touchstartHandler = (e) => {
                console.log("Direct touchstart detected in TowerBuilder");
                // Prevent default to avoid unwanted behaviors
                e.preventDefault();
                // Use a more direct drop method
                this.doSimpleDrop();
            };
            canvas.addEventListener('touchstart', touchstartHandler);
            canvas._towerBuilderListeners.push({ type: 'touchstart', fn: touchstartHandler });
        }
        
        // Handle keyboard space bar as another backup drop method
        // First, clean up old listener if it exists
        if (window._spaceBarBlockDropHandler) {
            document.removeEventListener('keydown', window._spaceBarBlockDropHandler);
        }
        
        // Create new handler and store reference for cleanup
        this.spaceBarHandler = (e) => {
            if (e.code === 'Space' || e.key === ' ') {
                console.log("Space bar pressed - dropping block");
                this.doSimpleDrop();
            }
        };
        document.addEventListener('keydown', this.spaceBarHandler);
        window._spaceBarBlockDropHandler = this.spaceBarHandler;
        
        // Log that TowerBuilder is ready
        console.log("TowerBuilder initialized and ready to place blocks");
    }
    
    initialize() {
        // Clear any existing flags to ensure a fresh start
        this.isPlacingBlock = false;
        this.isCreatingBlock = false;
        
        // Clear any pending timeouts related to this tower builder
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
            this.messageTimeout = null;
        }
        
        // Make sure there's no existing pending block
        this.pendingBlock = null;
        
        // Select a new initial block type if not already set
        if (!this.nextBlockType) {
            this.selectNextBlockType();
        }
        
        // Create initial block
        this.createNewPendingBlock('plank');
        
        // Update UI
        this.updateNextBlockIndicator();
        
        console.log("TowerBuilder fully initialized");
    }
    
    update(deltaTime) {
        // Safety check for input system
        if (!this.input) {
            console.warn("Input system not available in TowerBuilder");
            return;
        }
        
        // Add fallback methods if they don't exist
        if (typeof this.input.isDropRequested !== 'function') {
            console.warn("Adding fallback isDropRequested method to input");
            this.input.isDropRequested = function() { return false; };
        }
        
        if (typeof this.input.isReleased !== 'function') {
            console.warn("Adding fallback isReleased method to input");
            this.input.isReleased = function() { return false; };
        }
        
        // Swing the rope
        this.updateRopeSwing(deltaTime);
        
        // Check for block placement - but only if we're not already placing a block
        if (this.pendingBlock && !this.isPlacingBlock) {
            // Check both traditional release and the new drop request
            // Use a safe approach to check if the method exists before calling it
            const isDropRequested = typeof this.input.isDropRequested === 'function' 
                ? this.input.isDropRequested() 
                : false;
                
            if (this.input.isReleased() || isDropRequested) {
                console.log("Drop detected via input system, placing block...");
                this.placeBlock();
            }
        }
        
        // Check if we need a new block
        if (!this.pendingBlock && !this.isPlacingBlock && !this.isCreatingBlock) {
            // Check if we have enough energy for any block
            if (this.resourceManager.canAffordAnyBlock()) {
                // Use the pre-selected block type
                this.createNewPendingBlock(this.nextBlockType);
                // Select the next block for future use
                this.selectNextBlockType();
            } else {
                // Show insufficient energy message
                this.showInsufficientEnergyMessage();
            }
        }
        
        // Fade out insufficient energy message
        if (this.insufficientEnergyMessage && this.insufficientEnergyMessage.opacity > 0) {
            this.insufficientEnergyMessage.opacity -= deltaTime;
            if (this.insufficientEnergyMessage.opacity < 0) {
                this.insufficientEnergyMessage.opacity = 0;
            }
        }
        
        // Update the next block UI indicator if it exists
        this.updateNextBlockIndicator();
    }
    
    selectNextBlockType() {
        // Randomly select the next block type
        const randomIndex = Math.floor(Math.random() * this.blockTypes.length);
        this.nextBlockType = this.blockTypes[randomIndex].type;
        console.log(`Next block selected: ${this.nextBlockType}`);
    }
    
    updateNextBlockIndicator() {
        // First, get the currently pending block type (what the player is about to drop)
        const currentBlockType = this.pendingBlock ? this.pendingBlock.blockType : null;
        
        // Then get the next block type (what will appear after dropping the current one)
        const nextBlockType = this.nextBlockType;
        
        console.log(`Updating UI indicators: Current=${currentBlockType}, Next=${nextBlockType}`);
        
        // Update the next block type display if it exists
        const nextBlockElement = document.querySelector('.next-block-type');
        if (nextBlockElement && nextBlockType) {
            // Find the block config
            const blockConfig = this.blockTypes.find(b => b.type === nextBlockType);
            if (blockConfig) {
                const formattedType = blockConfig.blockType.charAt(0).toUpperCase() + blockConfig.blockType.slice(1);
                nextBlockElement.textContent = formattedType;
            }
        }
        
        // Remove highlight from all blocks in the info panel
        document.querySelectorAll('.block-type').forEach(el => {
            el.classList.remove('next-block');
        });
        
        // Highlight the current block type in the block info panel
        if (currentBlockType) {
            const currentBlockElement = document.querySelector(`.block-type[data-type="${currentBlockType}"]`);
            if (currentBlockElement) {
                currentBlockElement.classList.add('next-block');
                console.log(`Highlighted ${currentBlockType} block in UI`);
            }
        }
    }
    
    updateRopeSwing(deltaTime) {
        // Swing the rope back and forth
        this.ropeAngle += this.ropeSwingSpeed * this.swingDirection * deltaTime;
        
        // Reverse direction at limits
        if (this.ropeAngle > Math.PI / 3) {
            this.ropeAngle = Math.PI / 3;
            this.swingDirection = -1;
        } else if (this.ropeAngle < -Math.PI / 3) {
            this.ropeAngle = -Math.PI / 3;
            this.swingDirection = 1;
        }
        
        // Update the pending block position
        if (this.pendingBlock) {
            const blockX = this.ropePosition.x + Math.sin(this.ropeAngle) * this.ropeLength;
            const blockY = this.ropePosition.y + this.ropeLength;
            this.pendingBlock.setPendingPosition(blockX, blockY);
        }
    }
    
    createNewPendingBlock(type) {
        // Don't create a new block if one already exists
        if (this.pendingBlock) {
            console.log("Attempted to create a new block while one already exists");
            return;
        }
        
        // Don't create if we're already in the process of creating one
        if (this.isCreatingBlock) {
            console.log("Block creation already in progress, ignoring duplicate request");
            return;
        }
        
        this.isCreatingBlock = true;
        
        const blockConfig = this.blockTypes.find(b => b.type === type) || this.blockTypes[0];
        console.log(`Creating new ${blockConfig.blockType} block`);
        
        this.pendingBlock = new TowerBlock(
            this.ropePosition.x,
            this.ropePosition.y + this.ropeLength,
            blockConfig.blockType,
            blockConfig.material,
            blockConfig.durability
        );
        
        // Update the next block UI indicator to match the pending block
        this.updateNextBlockIndicator();
        
        // Reset creation flag after a short delay
        setTimeout(() => {
            this.isCreatingBlock = false;
        }, 100);
    }
    
    placeBlock() {
        // Check if we're in a cooldown period to prevent rapid drops
        const now = Date.now();
        if (now - this.lastPlaceTime < this.placeDelay) {
            console.log('Block placement too fast, ignoring');
            return;
        }
        
        // Check if we're already in the process of placing a block
        if (this.isPlacingBlock) {
            console.log("Block placement already in progress via another method");
            return;
        }
        
        if (!this.pendingBlock) {
            return;
        }
        
        // Update last place time
        this.lastPlaceTime = now;
        
        // Check if we have enough energy using the block type instead of material
        if (!this.resourceManager.canAffordBlock(this.pendingBlock.blockType)) {
            this.showInsufficientEnergyMessage();
            return;
        }
        
        // Set flag to prevent multiple simultaneous drops
        this.isPlacingBlock = true;
        
        try {
            // Get current position from rope
            const x = this.ropePosition.x + Math.sin(this.ropeAngle) * this.ropeLength;
            const y = this.ropePosition.y + this.ropeLength;
            
            // Update the block position
            this.pendingBlock.x = x;
            this.pendingBlock.y = y;
            
            // Create physics body with direct Matter.js access for extra certainty
            if (!this.pendingBlock.body) {
                // Get the correct cost for this block type and spend energy
                const blockCost = this.resourceManager.getCostForBlock(this.pendingBlock);
                this.resourceManager.spendEnergy(blockCost);
                console.log(`Energy spent via placeBlock: ${blockCost}`);
                
                // Create the block's body using our enhanced method
                this.pendingBlock.createBody(this.physics);
                
                // Add block to tower blocks array
                this.towerBlocks.push(this.pendingBlock);
                
                // Apply a small initial impulse to help ensure it starts falling
                Matter.Body.applyForce(this.pendingBlock.body, this.pendingBlock.body.position, { x: 0, y: 0.005 });
            }
            
            // Reset pendingBlock for next placement
            this.pendingBlock = null;
            
            // Create a new block after a short delay
            setTimeout(() => {
                // Reset the placing flag
                this.isPlacingBlock = false;
                
                // Only create a new block if we have enough energy
                if (this.resourceManager.canAffordAnyBlock()) {
                    this.createNewPendingBlock(this.nextBlockType);
                    this.selectNextBlockType();
                    // Update UI to reflect the new block
                    this.updateNextBlockIndicator();
                }
            }, 500); // Half-second delay before new block
            
            console.log("Block placed successfully");
        } catch (error) {
            console.error("Error placing block:", error);
            // If error occurs, still try to create a new block
            this.pendingBlock = null;
            
            // Reset the placing flag
            this.isPlacingBlock = false;
            
            setTimeout(() => {
                if (this.resourceManager.canAffordAnyBlock()) {
                    this.createNewPendingBlock('plank');
                    this.selectNextBlockType();
                    // Update UI to reflect the new block
                    this.updateNextBlockIndicator();
                }
            }, 500);
        }
    }
    
    render(renderer) {
        // Draw the rope
        renderer.drawRope(
            this.ropePosition.x,
            this.ropePosition.y,
            this.ropeLength,
            this.ropeAngle
        );
        
        // Draw the pending block if exists
        if (this.pendingBlock) {
            const blockX = this.ropePosition.x + Math.sin(this.ropeAngle) * this.ropeLength;
            const blockY = this.ropePosition.y + this.ropeLength;
            
            // Also draw the energy cost
            const blockCost = this.resourceManager.getCostForBlock(this.pendingBlock);
            const canAfford = this.resourceManager.canAffordBlock(this.pendingBlock.blockType);
            
            renderer.drawHoldingBlock(this.pendingBlock, blockX, blockY);
            
            // Draw energy cost above the block
            renderer.drawText(
                `${blockCost} ⚡`,
                blockX,
                blockY - this.pendingBlock.height/2 - 25,
                {
                    color: canAfford ? '#FFF' : '#FF0000',
                    font: '16px Arial',
                    align: 'center'
                }
            );
        }
        
        // Draw all placed tower blocks
        this.towerBlocks.forEach(block => {
            renderer.drawTowerBlock(block);
        });
        
        // Draw insufficient energy message if it exists
        if (this.insufficientEnergyMessage && this.insufficientEnergyMessage.opacity > 0) {
            renderer.drawText(
                "Not enough energy!",
                this.canvas.width / 2,
                this.canvas.height / 2,
                {
                    color: `rgba(255, 0, 0, ${this.insufficientEnergyMessage.opacity})`,
                    font: '24px Arial',
                    align: 'center'
                }
            );
        }
    }
    
    getTowerBlocks() {
        return this.towerBlocks;
    }
    
    removeBlock(block) {
        const index = this.towerBlocks.indexOf(block);
        if (index !== -1) {
            this.towerBlocks.splice(index, 1);
            // Remove from physics world
            if (block.body) {
                Matter.Composite.remove(this.physics.world, block.body);
            }
        }
    }
    
    showInsufficientEnergyMessage() {
        // Create or update the message
        this.insufficientEnergyMessage = {
            text: "Not enough energy!",
            opacity: 1.0
        };
        
        // Clear existing timeout if any
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
        
        // Set timeout to clear message after 2 seconds
        this.messageTimeout = setTimeout(() => {
            this.insufficientEnergyMessage = null;
        }, 2000);
    }
    
    // Public method to get the next block type
    getNextBlockType() {
        return this.nextBlockType;
    }
    
    // Method to update the physics engine reference after reset
    setPhysics(physicsEngine) {
        this.physics = physicsEngine;
        
        // Recreate physics bodies for all existing blocks
        for (const block of this.towerBlocks) {
            if (block.body) {
                // Remove old reference to prevent issues
                block.body.blockRef = null;
                block.body = null;
                
                // Create new body with the new physics engine
                block.createBody(this.physics);
            }
        }
        
        console.log("TowerBuilder physics engine updated");
    }
    
    // A more direct drop method that skips all checks - FOR IMMEDIATE USE
    doSimpleDrop() {
        console.log("doSimpleDrop called - most direct method");
        
        // Check if we're already in the process of placing a block
        if (this.isPlacingBlock) {
            console.log("Block placement already in progress, preventing double energy consumption");
            return false;
        }
        
        if (!this.pendingBlock) {
            console.log("No pending block to drop");
            return false;
        }
        
        // Set flag to prevent multiple simultaneous drops
        this.isPlacingBlock = true;
        
        try {
            // Get current position from rope
            const x = this.ropePosition.x + Math.sin(this.ropeAngle) * this.ropeLength;
            const y = this.ropePosition.y + this.ropeLength;
            
            // Get the correct cost for this block type
            const blockCost = this.resourceManager.getCostForBlock(this.pendingBlock);
            
            // Check if player can afford the block
            if (!this.resourceManager.canAffordBlock(this.pendingBlock.blockType)) {
                console.log(`Cannot afford ${this.pendingBlock.blockType} block (cost: ${blockCost})`);
                this.showInsufficientEnergyMessage();
                this.isPlacingBlock = false; // Reset flag
                return false;
            }
            
            // Update the block position
            this.pendingBlock.x = x;
            this.pendingBlock.y = y;
            
            console.log(`Placing block at (${x}, ${y}), cost: ${blockCost}`);
            
            // Create physics body
            if (!this.pendingBlock.body) {
                // Spend the energy first
                this.resourceManager.spendEnergy(blockCost);
                console.log(`Energy spent: ${blockCost}`);
                
                // Create the physics body
                this.pendingBlock.createBody(this.physics);
                
                // Add to tower blocks
                this.towerBlocks.push(this.pendingBlock);
                
                // Apply a stronger initial impulse to ensure it starts falling
                Matter.Body.applyForce(
                    this.pendingBlock.body, 
                    this.pendingBlock.body.position, 
                    { x: 0, y: 0.05 }
                );
            }
            
            // Store the block we're dropping
            const droppedBlock = this.pendingBlock;
            
            // Reset pendingBlock
            this.pendingBlock = null;
            
            // Create a new block after a short delay
            setTimeout(() => {
                // Reset the placing flag
                this.isPlacingBlock = false;
                
                // Only create a new block if we have enough energy for at least the cheapest block
                if (this.resourceManager.canAffordAnyBlock()) {
                    this.createNewPendingBlock(this.nextBlockType);
                    this.selectNextBlockType();
                    // Update UI to reflect the new block
                    this.updateNextBlockIndicator();
                    console.log("New block created after drop");
                } else {
                    console.log("Not enough energy for a new block");
                    this.showInsufficientEnergyMessage();
                }
            }, 200); // Short delay before new block
            
            console.log("Block successfully placed via doSimpleDrop");
            return true;
        } catch (error) {
            console.error("Error in doSimpleDrop:", error);
            // Force recovery
            this.pendingBlock = null;
            
            // Reset the placing flag
            this.isPlacingBlock = false;
            
            setTimeout(() => {
                if (this.resourceManager.canAffordAnyBlock()) {
                    this.createNewPendingBlock(this.nextBlockType || 'plank');
                    this.selectNextBlockType();
                    // Update UI to reflect the new block
                    this.updateNextBlockIndicator();
                    console.log("Created recovery block after error");
                }
            }, 300);
            return false;
        }
    }
} 