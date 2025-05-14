const Point = require('../class/Point');
const Curve = require('../class/Curve');
const ParticleSystem = require('../class/ParticleSystem');
const { PowerUp } = require('../class/PowerUp');

const EventEmitter = require('../helpers/EventEmitter');
const { int } = require('../helpers/random');

class Player extends EventEmitter {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number, color: string, angle: number, name: string}} options
   */
  constructor(ctx, options) {
    super();
    this.ctx = ctx;
    this.name = options.name || 'Player';
    this.position = new Point(options.x, options.y);

    /** @type {Curve} */
    this.curve = new Curve(this.position, 5);

    // Engine
    this.stop = true; // move or not?
    this.speed = 80; // pixels per second
    this.agility = 1; // ability to turn
    this.active = true; // draw line?
    this.immune = false; // dead on collision?

    // Controllers
    this.angle = options.angle;
    this.vector = 0;

    // Stats
    this.distanceTraveled = 0;
    this.crashed = false;
    this.powerUps = [];
    this.score = 0;

    // Design
    this.color = options.color;
    this.glowEffect = false;
    this.trailEffect = false;
    this.particleSystem = new ParticleSystem();

    // Current active effects
    this.activeEffects = [];

    // Draw a bit of body
    const movement = this.getMovement(.1);
    const newPos = new Point(this.position.x + movement.vx, this.position.y + movement.vy);
    this.curve.update(newPos);
    this.position.x = newPos.x;
    this.position.y = newPos.y;

    initBonuses(this);
  }

  /**
   * @param {number} angle
   */
  setAngle(angle) {
    this.angle = angle;
  }

  /**
   * @param {number} va
   */
  addAngle(va) {
    this.angle -= (va * 3.6) * this.agility;
  }

  /** @param {number} diff */
  getMovement(diff) {
    const radians = this.angle * (Math.PI / 180);
    const movement = this.speed * diff;
    const vx = movement * Math.sin(radians);
    const vy = movement * Math.cos(radians);
    return {
      vx,
      vy,
      movement
    };
  }

  /**
   * Apply a power-up effect to the player
   * @param {PowerUp} powerUp - The power-up to apply
   */
  applyPowerUp(powerUp) {
    const effect = powerUp.applyEffect(this);
    
    // Add to active effects
    this.activeEffects.push({
      type: effect.type,
      endTime: Date.now() + effect.duration
    });
    
    // Create visual effect for power-up collection
    this.particleSystem.createExplosion(
      this.position.x, 
      this.position.y, 
      30, 
      powerUp.color
    );
    
    // Enable glow effect temporarily
    this.glowEffect = true;
    setTimeout(() => {
      this.glowEffect = false;
    }, 1000);
    
    // Emit event for game to handle
    this.emit('powerUpCollected', effect);
  }

  /**
   * Check and clean up expired effects
   */
  updateEffects() {
    const now = Date.now();
    const expiredEffects = this.activeEffects.filter(effect => effect.endTime <= now);
    
    if (expiredEffects.length > 0) {
      this.activeEffects = this.activeEffects.filter(effect => effect.endTime > now);
      
      // Notify about expired effects
      for (const effect of expiredEffects) {
        this.emit('effectExpired', effect);
      }
    }
  }

  /** @param {number} diff */
  update(diff) {
    if (this.stop) {
      return;
    }
    
    this.emit('pre/update');
    
    // Update particles
    this.particleSystem.update(diff);
    
    // Check for expired effects
    this.updateEffects();
    
    // If controller active
    if (this.vector) {
      this.addAngle(this.vector);
    }

    // Displacement
    const {
      vx,
      vy,
      movement
    } = this.getMovement(diff);
    this.distanceTraveled += movement;

    const newPos = new Point(this.position.x + vx, this.position.y + vy);

    // Update position
    this.position.x = newPos.x;
    this.position.y = newPos.y;

    // Update curve if active
    if (this.active) {
      this.curve.update(newPos);
    }
    
    // Create trail particles when moving
    if (this.trailEffect || this.glowEffect) {
      this.particleSystem.createTrail(
        this.position.x, 
        this.position.y, 
        this.color, 
        this.glowEffect ? 3 : 1
      );
    }
    
    this.emit('update');
  }

  /**
   * Handle player crash
   * @param {Point} collisionPoint - Point where collision occurred
   */
  crash(collisionPoint) {
    if (this.crashed || this.immune) return;
    
    this.crashed = true;
    this.stop = true;
    
    // Create explosion particles
    this.particleSystem.createExplosion(
      collisionPoint.x, 
      collisionPoint.y, 
      60, 
      this.color, 
      8, 
      200
    );
    
    this.emit('crash', this);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} diff
   */
  draw(ctx, diff) {
    this.emit('pre/draw');
    this.update(diff);
    
    // Draw curve
    this.curve.draw(this.ctx, this.color);
    
    // Draw particles
    this.particleSystem.draw(ctx);

    // Draw player head with effects
    const headRadius = this.curve.weight / 2;
    
    // Glow effect for power-ups
    if (this.glowEffect) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.position.x, this.position.y, headRadius * 2, 0, Math.PI * 2);
      
      const gradient = ctx.createRadialGradient(
        this.position.x, this.position.y, headRadius,
        this.position.x, this.position.y, headRadius * 2
      );
      gradient.addColorStop(0, this.color);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();
    }
    
    // If ghost mode (immune)
    if (this.immune) {
      ctx.globalAlpha = 0.6;
    }
    
    // Draw head
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, headRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Reset alpha
    if (this.immune) {
      ctx.globalAlpha = 1.0;
    }
    
    // Draw active effects indicators
    if (this.activeEffects.length > 0) {
      ctx.save();
      ctx.fillStyle = '#FFF';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${this.activeEffects.length}`, 
        this.position.x, 
        this.position.y - headRadius * 2
      );
      ctx.restore();
    }

    this.emit('draw');
  }

  /**
   * Check for collision with power-ups
   * @param {PowerUp[]} powerUps - Array of power-ups to check
   * @returns {PowerUp|null} - Collided power-up or null
   */
  checkPowerUpCollisions(powerUps) {
    for (const powerUp of powerUps) {
      if (powerUp.active && powerUp.checkCollision(this.position)) {
        return powerUp;
      }
    }
    return null;
  }

  destroy() {
    this.emit('destroy');
    this._events = {};
  }
}

/**
 * Init bonuses and specials
 * @param {Player} player
 */
function initBonuses(player) {
  const data = {
    distanceTraveled: 0,
    distance: 0,
    pause: false,
    pauseDistance: 0
  };
  let limits = [int(200, 400), 4];
  player.on('pre/update', () => {
    const movement = player.distanceTraveled - data.distanceTraveled;
    data.distanceTraveled = player.distanceTraveled;

    if (data.pause) {
      data.pauseDistance += movement;
      if (data.pauseDistance > player.curve.weight * limits[1]) {
        data.pauseDistance = 0;
        data.pause = false;
        player.immune = false;
        player.active = true;
        player.curve.updatePosition();
        limits[0] = int(200, 400);
      }
    } else {
      data.distance += movement;
      if (data.distance > limits[0]) {
        data.distance = 0;
        data.pause = true;
        player.immune = true;
        player.active = false;
      }
    }
  });
}

module.exports = Player;
