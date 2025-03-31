export default class ResourceManager {
    constructor() {
        // Resources
        this.energy = 0;
        this.gold = 0;
        
        // Resource generation rates
        this.energyRate = 1; // Energy per second
        this.goldRate = 0;   // Gold per second
        
        // Block costs by block type (not by material anymore)
        this.blockCosts = {
            plank: 5,    // Wide plank - basic block
            square: 10,  // Square block - medium cost
            'L-shape': 10 // L-shaped block - most expensive
        };
        
        // Keep material costs for backward compatibility
        this.materialCosts = {
            wood: 5,
            stone: 10,
            metal: 10
        };
    }
    
    initialize() {
        // Set starting resources
        this.energy = 30;
        this.gold = 0;
    }
    
    update(deltaTime) {
        // Generate resources over time
        this.energy += this.energyRate * deltaTime;
        this.gold += this.goldRate * deltaTime;
    }
    
    canAffordAnyBlock() {
        // Get the lowest block cost
        const lowestCost = Math.min(...Object.values(this.blockCosts));
        return this.energy >= lowestCost;
    }
    
    canAffordBlock(typeOrMaterial) {
        // Check if it's a block type first
        if (this.blockCosts[typeOrMaterial] !== undefined) {
            return this.energy >= this.blockCosts[typeOrMaterial];
        }
        
        // Fall back to material-based cost for backward compatibility
        if (this.materialCosts[typeOrMaterial] !== undefined) {
            return this.energy >= this.materialCosts[typeOrMaterial];
        }
        
        // Default to plank cost if unknown type
        return this.energy >= this.blockCosts.plank;
    }
    
    getCostForBlock(block) {
        // Get cost based on block type if available
        if (block.blockType && this.blockCosts[block.blockType] !== undefined) {
            return this.blockCosts[block.blockType];
        }
        
        // Fall back to material-based cost
        if (block.material && this.materialCosts[block.material] !== undefined) {
            return this.materialCosts[block.material];
        }
        
        // Default cost
        return this.blockCosts.plank;
    }
    
    spendEnergy(amount) {
        if (this.energy >= amount) {
            this.energy -= amount;
            return true;
        }
        return false;
    }
    
    spendGold(amount) {
        if (this.gold >= amount) {
            this.gold -= amount;
            return true;
        }
        return false;
    }
    
    addRewards(rewards) {
        this.energy += rewards.energy || 0;
        this.gold += rewards.gold || 0;
    }
    
    // Add energy directly (for enemy defeat rewards)
    addEnergy(amount) {
        this.energy += amount;
    }
    
    // Upgrade rates or provide bonuses
    upgradeEnergyRate(amount) {
        this.energyRate += amount;
    }
    
    upgradeGoldRate(amount) {
        this.goldRate += amount;
    }
} 