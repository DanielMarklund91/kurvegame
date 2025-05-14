const Point = require('./Point');

/**
 * Available power-up types
 * @enum {string}
 */
const PowerUpType = {
  SPEED: 'speed',
  SLOW: 'slow',
  THICK: 'thick',
  THIN: 'thin',
  GHOST: 'ghost',
  CLEAR: 'clear',
  REVERSE: 'reverse'
};

class PowerUp {
  /**
   * PowerUp class for in-game bonuses
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} type - Type of power-up
   */
  constructor(x, y, type) {
    this.position = new Point(x, y);
    this.type = type;
    this.radius = 12;
    this.active = true;
    this.pulseAnimation = 0;
    this.rotationAngle = 0;
    
    // Color based on type
    this.getColor();
    
    // Default duration for power-up effects (in ms)
    this.duration = 5000;
  }
  
  /**
   * Set color based on power-up type
   */
  getColor() {
    switch(this.type) {
      case PowerUpType.SPEED:
        this.color = '#ff5722';
        this.icon = '⚡';
        break;
      case PowerUpType.SLOW:
        this.color = '#2196f3';
        this.icon = '❄';
        break;
      case PowerUpType.THICK:
        this.color = '#9c27b0';
        this.icon = '↔';
        break;
      case PowerUpType.THIN:
        this.color = '#4caf50';
        this.icon = '↕';
        break;
      case PowerUpType.GHOST:
        this.color = '#607d8b';
        this.icon = '👻';
        break;
      case PowerUpType.CLEAR:
        this.color = '#ffeb3b';
        this.icon = '💣';
        break;
      case PowerUpType.REVERSE:
        this.color = '#e91e63';
        this.icon = '🔄';
        break;
      default:
        this.color = '#ffffff';
        this.icon = '?';
    }
  }
  
  /**
   * Update animation state
   * @param {number} deltaTime - Time since last frame
   */
  update(deltaTime) {
    // Pulse animation
    this.pulseAnimation += deltaTime * 2;
    if (this.pulseAnimation > Math.PI * 2) {
      this.pulseAnimation -= Math.PI * 2;
    }
    
    // Rotation animation
    this.rotationAngle += deltaTime * 0.5;
    if (this.rotationAngle > Math.PI * 2) {
      this.rotationAngle -= Math.PI * 2;
    }
  }
  
  /**
   * Draw the power-up
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  draw(ctx) {
    if (!this.active) return;
    
    const pulseFactor = 1 + Math.sin(this.pulseAnimation) * 0.2;
    const radius = this.radius * pulseFactor;
    
    ctx.save();
    
    // Outer glow
    const gradient = ctx.createRadialGradient(
      this.position.x, this.position.y, radius * 0.5,
      this.position.x, this.position.y, radius * 1.5
    );
    gradient.addColorStop(0, this.color + 'CC');
    gradient.addColorStop(1, this.color + '00');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner circle
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw icon with rotation
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.rotationAngle);
    ctx.translate(-this.position.x, -this.position.y);
    
    ctx.fillStyle = 'white';
    ctx.font = `${radius}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.icon, this.position.x, this.position.y);
    
    ctx.restore();
  }
  
  /**
   * Check if a point collides with this power-up
   * @param {Point} point - Point to check
   * @returns {boolean} - True if collision detected
   */
  checkCollision(point) {
    if (!this.active) return false;
    
    const distance = Math.sqrt(
      Math.pow(this.position.x - point.x, 2) + 
      Math.pow(this.position.y - point.y, 2)
    );
    
    return distance <= this.radius;
  }
  
  /**
   * Apply power-up effect to a player
   * @param {Object} player - Player to apply effect to
   */
  applyEffect(player) {
    this.active = false;
    
    switch(this.type) {
      case PowerUpType.SPEED:
        const originalSpeed = player.speed;
        player.speed *= 1.5;
        
        setTimeout(() => {
          player.speed = originalSpeed;
        }, this.duration);
        break;
        
      case PowerUpType.SLOW:
        const origSpeed = player.speed;
        player.speed *= 0.6;
        
        setTimeout(() => {
          player.speed = origSpeed;
        }, this.duration);
        break;
        
      case PowerUpType.THICK:
        const origWeight = player.curve.weight;
        player.curve.weight = origWeight * 1.8;
        
        setTimeout(() => {
          player.curve.weight = origWeight;
        }, this.duration);
        break;
        
      case PowerUpType.THIN:
        const origThickness = player.curve.weight;
        player.curve.weight = Math.max(1, origThickness * 0.5);
        
        setTimeout(() => {
          player.curve.weight = origThickness;
        }, this.duration);
        break;
        
      case PowerUpType.GHOST:
        player.immune = true;
        player.active = false;
        
        // Add ghost trail visual effect
        const originalColor = player.color;
        player.color = player.color + '40'; // Add transparency
        
        setTimeout(() => {
          player.immune = false;
          player.active = true;
          player.color = originalColor;
          player.curve.updatePosition();
        }, this.duration);
        break;
        
      case PowerUpType.CLEAR:
        // This power-up clears all curves for a brief moment
        // Will be handled by the game manager
        break;
        
      case PowerUpType.REVERSE:
        // Reverse controls
        const originalVector = player.vector;
        player.vector *= -1;
        
        setTimeout(() => {
          player.vector = originalVector;
        }, this.duration);
        break;
    }
    
    // Return effect type and duration for any game-wide effects
    return {
      type: this.type,
      duration: this.duration
    };
  }
  
  /**
   * Get a random power-up type
   * @returns {string} - Random power-up type
   */
  static getRandomType() {
    const types = Object.values(PowerUpType);
    return types[Math.floor(Math.random() * types.length)];
  }
}

module.exports = {
  PowerUp,
  PowerUpType
};