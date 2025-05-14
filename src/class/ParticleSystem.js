const Point = require('./Point');

/**
 * Represents a single particle in the particle system
 */
class Particle {
  /**
   * Create a new particle
   * @param {number} x - Starting X position
   * @param {number} y - Starting Y position
   * @param {number} size - Particle size
   * @param {string} color - Particle color
   * @param {number} lifetime - How long the particle lives (in seconds)
   * @param {Object} velocity - Initial velocity {x, y}
   */
  constructor(x, y, size, color, lifetime, velocity) {
    this.position = new Point(x, y);
    this.initialSize = size;
    this.size = size;
    this.color = color;
    this.initialLifetime = lifetime;
    this.lifetime = lifetime;
    this.velocity = velocity;
    this.alpha = 1;
    this.dead = false;
  }
  
  /**
   * Update particle state
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    if (this.dead) return;
    
    // Update lifetime
    this.lifetime -= deltaTime;
    if (this.lifetime <= 0) {
      this.dead = true;
      return;
    }
    
    // Calculate lifetime progress (0 to 1)
    const progress = 1 - (this.lifetime / this.initialLifetime);
    
    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    
    // Apply physics (slower over time)
    this.velocity.x *= 0.95;
    this.velocity.y *= 0.95;
    
    // Shrink particle over time
    this.size = this.initialSize * (1 - progress);
    
    // Fade out
    this.alpha = 1 - progress;
  }
  
  /**
   * Draw the particle
   * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
   */
  draw(ctx) {
    if (this.dead) return;
    
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Manages a collection of particles
 */
class ParticleSystem {
  /**
   * Create a new particle system
   */
  constructor() {
    this.particles = [];
    this.maxParticles = 500; // Prevent performance issues
  }
  
  /**
   * Add explosion effect
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} count - Number of particles
   * @param {string} color - Base color
   * @param {number} size - Size range
   * @param {number} speed - Speed multiplier
   */
  createExplosion(x, y, count, color, size = 5, speed = 100) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        // Replace oldest particle
        this.particles.shift();
      }
      
      // Random direction
      const angle = Math.random() * Math.PI * 2;
      const magnitude = Math.random() * speed;
      
      const velocity = {
        x: Math.cos(angle) * magnitude,
        y: Math.sin(angle) * magnitude
      };
      
      // Small random variation in color
      const colorVariation = () => {
        const hex = Math.floor(Math.random() * 40 - 20).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      // Create slight color variations
      let particleColor = color;
      if (color.startsWith('#') && color.length === 7) {
        const r = parseInt(color.substr(1, 2), 16);
        const g = parseInt(color.substr(3, 2), 16);
        const b = parseInt(color.substr(5, 2), 16);
        
        const varR = Math.max(0, Math.min(255, r + Math.floor(Math.random() * 40 - 20)));
        const varG = Math.max(0, Math.min(255, g + Math.floor(Math.random() * 40 - 20)));
        const varB = Math.max(0, Math.min(255, b + Math.floor(Math.random() * 40 - 20)));
        
        particleColor = `#${varR.toString(16).padStart(2, '0')}${varG.toString(16).padStart(2, '0')}${varB.toString(16).padStart(2, '0')}`;
      }
      
      // Add particle
      const particle = new Particle(
        x, 
        y, 
        Math.random() * size + 1, 
        particleColor,
        Math.random() * 0.8 + 0.2, // Random lifetime 0.2-1.0 seconds
        velocity
      );
      
      this.particles.push(particle);
    }
  }
  
  /**
   * Create trail effect behind moving object
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @param {string} color - Particle color
   * @param {number} count - Number of particles
   */
  createTrail(x, y, color, count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      
      const velocity = {
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 20
      };
      
      const particle = new Particle(
        x + (Math.random() - 0.5) * 4, 
        y + (Math.random() - 0.5) * 4, 
        Math.random() * 3 + 1, 
        color,
        Math.random() * 0.4 + 0.1, // Shorter lifetime
        velocity
      );
      
      this.particles.push(particle);
    }
  }
  
  /**
   * Update all particles
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    // Update all particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(deltaTime);
      
      // Remove dead particles
      if (this.particles[i].dead) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  /**
   * Draw all particles
   * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
   */
  draw(ctx) {
    for (const particle of this.particles) {
      particle.draw(ctx);
    }
  }
}

module.exports = ParticleSystem;