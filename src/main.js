import Game from './core/Game.js';

// Initialize the game when the window loads
window.addEventListener('load', () => {
    const game = new Game({
        canvasId: 'game-canvas',
        width: 800,
        height: 600
    });
    
    // Expose the game instance globally for direct access
    window.gameInstance = game;
    
    // Start the game
    game.start();
    
    // Listen for manual block drop events
    document.addEventListener('manualBlockDrop', () => {
        if (game.towerBuilder && game.towerBuilder.pendingBlock) {
            game.towerBuilder.placeBlock();
        }
    });
}); 