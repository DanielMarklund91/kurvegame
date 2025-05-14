const User = require('./User');
const Player = require('./Player');
const Point = require('../class/Point');
const { PowerUp, PowerUpType } = require('../class/PowerUp');

const EventEmitter = require('../helpers/EventEmitter');
const { int, one } = require('../helpers/random');
const colors = ['#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#e74c3c', '#ecf0f1'];

class Round extends EventEmitter {
  /**
   * Round class
   * @param {Game} game
   */
  constructor(game) {
    super();
    this.game = game;
    this.started = false;
    this.ended = false;
    this.paused = false;
    this.preparedToEnd = false;
    
    // Store power-ups
    this.powerUps = [];
    this.maxPowerUps = 5; // Maximum number of power-ups at once
    this.powerUpTimer = null;
    
    // Special effects
    this.specialEffects = [];

    /**
     * @type {Map<User, Player>}
     */
    this.players = new Map();
    for (const user of game.users) {
      this.newPlayer(user);
    }

    // Create border with updated visuals
    const mapSize = this.game.mapSize;
    this.border = {
      /** @param {CanvasRenderingContext2D} ctx */
      draw: (ctx) => {
        // Draw fancy borders with gradient
        const gradient = ctx.createLinearGradient(0, 0, mapSize.x, mapSize.y);
        gradient.addColorStop(0, '#303f9f');
        gradient.addColorStop(0.5, '#3f51b5');
        gradient.addColorStop(1, '#5c6bc0');
        
        ctx.lineWidth = 15;
        ctx.strokeStyle = gradient;
        ctx.strokeRect(0, 0, mapSize.x, mapSize.y);
        
        // Draw power-ups
        this.powerUps.forEach(powerUp => {
          powerUp.update(1/60); // Assume 60fps for animations
          powerUp.draw(ctx);
        });
        
        // Draw special effects
        this.drawSpecialEffects(ctx);
      }
    };
    this.game.renderer.push(this.border);
  }
  
  /**
   * Draw any special game-wide effects
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  drawSpecialEffects(ctx) {
    const now = Date.now();
    
    // Remove expired effects
    this.specialEffects = this.specialEffects.filter(effect => effect.endTime > now);
    
    // Draw active effects
    for (const effect of this.specialEffects) {
      // Calculate progress (0-1)
      const progress = 1 - ((effect.endTime - now) / effect.duration);
      
      switch (effect.type) {
        case PowerUpType.CLEAR:
          // Flash effect that fades out
          if (progress < 0.2) {
            // Initial flash
            ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * (1 - progress/0.2)})`;
            ctx.fillRect(0, 0, this.game.mapSize.x, this.game.mapSize.y);
          }
          break;
        
        case 'lightning':
          // Draw lightning effect across the screen
          if (progress < 0.3) {
            ctx.strokeStyle = `rgba(255, 255, 0, ${0.8 * (1 - progress/0.3)})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            let x = 0;
            let y = this.game.mapSize.y / 2;
            
            ctx.moveTo(x, y);
            
            while (x < this.game.mapSize.x) {
              x += int(20, 40);
              y += int(-40, 40);
              ctx.lineTo(x, y);
            }
            
            ctx.stroke();
          }
          break;
      }
    }
  }
  
  /**
   * Spawn a new power-up at a random location
   */
  spawnPowerUp() {
    if (this.ended || this.powerUps.length >= this.maxPowerUps) return;
    
    // Find a clear spot to place the power-up
    let validPosition = false;
    let attempts = 0;
    let x, y;
    
    while (!validPosition && attempts < 20) {
      attempts++;
      
      // Random position within playable area (with padding)
      const padding = 50;
      x = int(padding, this.game.mapSize.x - padding);
      y = int(padding, this.game.mapSize.y - padding);
      
      // Check if position is clear from curves
      validPosition = true;
      const testPoint = new Point(x, y);
      
      // Check distance from all players
      for (const player of this.players.values()) {
        if (!player.crashed) {
          const distance = Math.sqrt(
            Math.pow(player.position.x - x, 2) + 
            Math.pow(player.position.y - y, 2)
          );
          
          // Too close to a player
          if (distance < 100) {
            validPosition = false;
            break;
          }
          
          // Check for collision with curves
          if (player.curve.interfere(testPoint, 20, false)) {
            validPosition = false;
            break;
          }
        }
      }
      
      // Check distance from other power-ups
      if (validPosition) {
        for (const powerUp of this.powerUps) {
          const distance = Math.sqrt(
            Math.pow(powerUp.position.x - x, 2) + 
            Math.pow(powerUp.position.y - y, 2)
          );
          
          if (distance < 80) {
            validPosition = false;
            break;
          }
        }
      }
    }
    
    // If we found a valid position
    if (validPosition) {
      const type = PowerUp.getRandomType();
      const powerUp = new PowerUp(x, y, type);
      this.powerUps.push(powerUp);
    }
    
    // Schedule next power-up spawn
    const nextSpawnTime = int(3000, 8000); // 3-8 seconds
    this.powerUpTimer = setTimeout(() => this.spawnPowerUp(), nextSpawnTime);
  }
  
  /**
   * Add a special effect
   * @param {string} type - Effect type
   * @param {number} duration - Effect duration in ms
   */
  addSpecialEffect(type, duration) {
    this.specialEffects.push({
      type,
      duration,
      endTime: Date.now() + duration
    });
  }
  
  /**
   * Handle the CLEAR power-up effect
   * @param {Player} player - Player who collected the power-up
   */
  handleClearEffect(player) {
    // Create a flash effect
    this.addSpecialEffect(PowerUpType.CLEAR, 500);
    
    // Make all players temporarily immune
    for (const p of this.players.values()) {
      if (!p.crashed) {
        p.immune = true;
        
        // Return to normal after the effect duration
        setTimeout(() => {
          if (!p.crashed) {
            p.immune = false;
          }
        }, 1500);
      }
    }
    
    // Create lightning effect
    this.addSpecialEffect('lightning', 800);
  }
  
  /**
   * Return `true` if player is out of map
   * @param {Player} player
   */
  isOutOfMap(player) {
    const padding = 10;
    return player.position.x < padding
    || player.position.y < padding
    || player.position.x > this.game.mapSize.x - padding
    || player.position.y > this.game.mapSize.y - padding;
  }
  
  /**
   * @param {User} user
   */
  newPlayer(user) {
    const options = this.generatrePosition(this.game.users.indexOf(user));
    const player = new Player(this.game.renderer.ctx, {
      x: options.x, 
      y: options.y,
      angle: int(0, 360),
      color: user.color,
      name: user.name || `Player ${this.players.size + 1}`
    });
    
    this.players.set(user, player);
    this.game.renderer.push(player);
    
    // Handle user input
    user.on('input', (dir) => {
      if(!this.started || this.ended) {
        return;
      }
      player.vector = ({
        left: -1,
        right: 1
      })[dir] || 0;
    });
    
    // Listen for power-up collection
    player.on('powerUpCollected', (effect) => {
      // Handle special effects that affect the whole game
      if (effect.type === PowerUpType.CLEAR) {
        this.handleClearEffect(player);
      }
    });
    
    // Collision detection
    player.on('pre/update', () => {
      // Skip if player is immune or already crashed
      if (player.crashed) return;
      
      // Check for map boundary collision
      if (this.isOutOfMap(player) && !player.immune) {
        const collisionPoint = new Point(player.position.x, player.position.y);
        player.crash(collisionPoint);
        this.emit('crash', user);
        
        if ([...this.players.values()].filter(p => !p.crashed).length < 2) {
          this.prepareToEnd();
        }
        return;
      }
      
      // Check for curve collisions
      if (!player.immune) {
        for (const p of this.players.values()) {
          if (p.curve.interfere(player.position, player.curve.weight / 2, p === player)) {
            const collisionPoint = new Point(player.position.x, player.position.y);
            player.crash(collisionPoint);
            this.emit('crash', user);
            
            if ([...this.players.values()].filter(p => !p.crashed).length < 2) {
              this.prepareToEnd();
            }
            return;
          }
        }
      }
      
      // Check for power-up collisions
      const collidedPowerUp = player.checkPowerUpCollisions(this.powerUps);
      if (collidedPowerUp) {
        player.applyPowerUp(collidedPowerUp);
        this.powerUps = this.powerUps.filter(p => p !== collidedPowerUp);
      }
    });
  }
  
  prepareToEnd() {
    if (this.preparedToEnd) return;
    this.preparedToEnd = true;
    
    // Clean up timers
    if (this.powerUpTimer) {
      clearTimeout(this.powerUpTimer);
      this.powerUpTimer = null;
    }
    
    this.ended = true;
    for (const player of this.players.values()) {
      player.stop = true;
    }
    
    this.emit('prepareToEnd', this);
    
    // Allow pressing space to continue
    this.game.inputController.once('keydown/32', () => {
      this.end();
    });
  }
  
  start() {
    if (this.started) return;
    this.started = true;
    
    // Add countdown message box
    const msgBox = {
      timeLeft: 3,
      lastUpdate: Date.now(),
      
      /** @param {CanvasRenderingContext2D} ctx */
      draw(ctx) {
        const now = Date.now();
        if (now - this.lastUpdate > 1000) {
          this.timeLeft--;
          this.lastUpdate = now;
        }
        
        ctx.save();
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Animate the text
        const scale = 1 + Math.sin(now / 150) * 0.1;
        ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.fillText(this.timeLeft.toString(), 0, 0);
        
        ctx.restore();
      }
    };
    
    this.game.renderer.push(msgBox);
    
    // Remove countdown after timeout and start the game
    setTimeout(() => {
      for (const player of this.players.values()) {
        player.stop = false;
      }
      
      // Start spawning power-ups
      this.spawnPowerUp();
      
      this.emit('start');
      this.game.renderer.remove(msgBox);
    }, 3000);
  }
  
  end() {
    if (this.ended) return;
    
    // Clean up timers
    if (this.powerUpTimer) {
      clearTimeout(this.powerUpTimer);
      this.powerUpTimer = null;
    }
    
    // Reset all players
    for (const user of this.players.keys()) {
      user.off('input');
    }
    
    for (const player of this.players.values()) {
      this.game.renderer.remove(player);
      player.destroy();
    }
    
    this.ended = true;
    this.game.renderer.remove(this.border);
    
    this.emit('end');
  }
  
  /**
   * Generate random position and angle
   * @param {number} i
   */
  generatrePosition(i) {
    return {
      x: int(30, this.game.mapSize.x - 30),
      y: int(30, this.game.mapSize.y - 30)
    }
  }
}

module.exports = Round;