export default class Input {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Mouse position
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Mouse state
        this.isMouseDown = false;
        this.isMousePressed = false;
        this.isMouseReleased = false;
        
        // Touch state
        this.isTouching = false;
        this.touchStarted = false;
        this.touchEnded = false;
        
        // Add a direct drop request flag
        this.dropRequested = false;
        
        // Debug
        this.lastEvent = null;
        
        // Debug logs - enhanced tracing
        console.log("Input constructor called with canvas:", canvas ? "Canvas present" : "Canvas missing");
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Bind methods
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleClick = this.handleClick.bind(this);
        
        console.log("Input initialization complete");
    }
    
    setupEventListeners() {
        if (!this.canvas) {
            console.error("Cannot set up event listeners: Canvas is null or undefined");
            return;
        }
        
        console.log("Setting up event listeners on canvas element:", this.canvas);
        
        // Mouse events
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        
        // Add click handler for direct block placement
        this.canvas.addEventListener('click', this.handleClick);
        
        // Add event listeners to document to catch events outside canvas
        document.addEventListener('mouseup', this.handleMouseUp);
        
        // Touch events
        this.canvas.addEventListener('touchstart', this.handleTouchStart);
        this.canvas.addEventListener('touchmove', this.handleTouchMove);
        document.addEventListener('touchend', this.handleTouchEnd);
        
        // Verify listeners are added with direct canvas inspection
        console.log("Input event listeners set up - mouse and touch handlers configured");
        
        // Test event firing manually
        setTimeout(() => {
            console.log("Input system active and listening for events");
        }, 100);
    }
    
    handleMouseMove(event) {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = event.clientX - rect.left;
        this.mouseY = event.clientY - rect.top;
        this.lastEvent = "mousemove";
    }
    
    handleMouseDown(event) {
        console.log(`Mouse down detected at (${event.clientX}, ${event.clientY})`);
        this.isMouseDown = true;
        this.isMousePressed = true;
        this.lastEvent = "mousedown";
        console.log("Mouse down event processed: isMouseDown set to true");
    }
    
    handleMouseUp(event) {
        console.log(`Mouse up detected at (${event.clientX}, ${event.clientY})`);
        this.isMouseDown = false;
        this.isMouseReleased = true;
        this.lastEvent = "mouseup";
        console.log("Mouse up event processed: isMouseReleased set to true");
    }
    
    handleClick(event) {
        console.log(`Click detected at (${event.clientX}, ${event.clientY})`);
        // Set the drop request flag on direct click
        this.dropRequested = true;
        this.lastEvent = "click";
        console.log("Click event processed: dropRequested set to true");
    }
    
    handleTouchStart(event) {
        if (!this.canvas) return;
        
        event.preventDefault();
        this.isTouching = true;
        this.touchStarted = true;
        this.isMouseDown = true;
        this.isMousePressed = true;
        
        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = touch.clientX - rect.left;
        this.mouseY = touch.clientY - rect.top;
        this.lastEvent = "touchstart";
        console.log("Touch start event detected");
    }
    
    handleTouchMove(event) {
        if (!this.canvas) return;
        
        event.preventDefault();
        
        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = touch.clientX - rect.left;
        this.mouseY = touch.clientY - rect.top;
        this.lastEvent = "touchmove";
    }
    
    handleTouchEnd(event) {
        event.preventDefault();
        this.isTouching = false;
        this.touchEnded = true;
        this.isMouseDown = false;
        this.isMouseReleased = true;
        // Also set drop request on touch end for mobile
        this.dropRequested = true;
        this.lastEvent = "touchend";
        console.log("Touch end event detected, requesting block drop");
    }
    
    update() {
        // Reset one-frame flags
        const hadClick = this.isClicked();
        const hadRelease = this.isReleased();
        
        // Store drop request before clearing
        const hadDropRequest = this.dropRequested;
        
        this.isMousePressed = false;
        this.isMouseReleased = false;
        this.touchStarted = false;
        this.touchEnded = false;
        this.dropRequested = false; // Reset drop request flag
        
        if (hadClick || hadRelease || hadDropRequest) {
            console.log(`Input update: Clicked: ${hadClick}, Released: ${hadRelease}, Drop Requested: ${hadDropRequest}, Last event: ${this.lastEvent}`);
        }
    }
    
    // Convenience methods
    isClicked() {
        return this.isMousePressed || this.touchStarted;
    }
    
    isReleased() {
        return this.isMouseReleased || this.touchEnded;
    }
    
    // New method to check if a drop was requested
    isDropRequested() {
        return this.dropRequested;
    }
    
    // Method to manually request a drop (for external calls)
    requestDrop() {
        this.dropRequested = true;
        console.log("Manual drop requested");
    }
} 