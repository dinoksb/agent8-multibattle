import Phaser from "phaser";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private speed: number = 200;
  private attackCooldown: number = 0;
  private healthBar!: Phaser.GameObjects.Graphics;
  private health: number = 100;
  private maxHealth: number = 100;
  private _isAttacking: boolean = false;
  private _facingLeft: boolean = false;
  private lastAttackTime: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "knight");
    
    // Add this game object to the scene
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Set up physics body
    this.setSize(60, 80);
    this.setOffset(66, 80);
    this.setCollideWorldBounds(false);
    
    // Set scale to make the knight a bit smaller
    this.setScale(0.8);
    
    // Play idle animation
    this.play('knight-idle');
    
    // Create health bar
    this.createHealthBar();
  }

  update(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasdKeys: {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
      SPACE: Phaser.Input.Keyboard.Key;
    }
  ) {
    // Don't handle input during attack animation
    if (this._isAttacking) {
      return;
    }
    
    // Handle movement
    const leftPressed = cursors.left.isDown || wasdKeys.A.isDown;
    const rightPressed = cursors.right.isDown || wasdKeys.D.isDown;
    const upPressed = cursors.up.isDown || wasdKeys.W.isDown;
    const downPressed = cursors.down.isDown || wasdKeys.S.isDown;
    
    // Reset velocity
    this.setVelocity(0);
    
    // Apply velocity based on input
    if (leftPressed) {
      this.setVelocityX(-this.speed);
      this._facingLeft = true;
      this.setFlipX(true);
    } else if (rightPressed) {
      this.setVelocityX(this.speed);
      this._facingLeft = false;
      this.setFlipX(false);
    }
    
    if (upPressed) {
      this.setVelocityY(-this.speed);
    } else if (downPressed) {
      this.setVelocityY(this.speed);
    }
    
    // Normalize velocity for diagonal movement
    if ((leftPressed || rightPressed) && (upPressed || downPressed)) {
      this.body.velocity.normalize().scale(this.speed);
    }
    
    // Set animation based on movement
    if (this.body.velocity.length() > 0) {
      if (this.anims.currentAnim?.key !== 'knight-move') {
        this.play('knight-move');
      }
    } else {
      if (this.anims.currentAnim?.key !== 'knight-idle') {
        this.play('knight-idle');
      }
    }
    
    // Handle attack
    if ((cursors.space.isDown || wasdKeys.SPACE.isDown) && this.attackCooldown <= 0 && !this._isAttacking) {
      this.attack();
    }
    
    // Update attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= this.scene.game.loop.delta;
    }
    
    // Update health bar position
    this.updateHealthBar();
  }

  private attack() {
    this._isAttacking = true;
    this.attackCooldown = 800; // 800ms cooldown
    this.lastAttackTime = Date.now();
    
    // Stop movement during attack
    this.setVelocity(0);
    
    // Play attack animation
    this.play('knight-attack');
    
    // Listen for animation completion
    this.once('animationcomplete', () => {
      this._isAttacking = false;
      this.play('knight-idle');
    });
  }

  private createHealthBar() {
    this.healthBar = this.scene.add.graphics();
    this.updateHealthBar();
  }

  private updateHealthBar() {
    this.healthBar.clear();
    
    // Draw background
    this.healthBar.fillStyle(0x000000, 0.5);
    this.healthBar.fillRect(-25, -50, 50, 6);
    
    // Draw health
    const healthWidth = 50 * (this.health / this.maxHealth);
    this.healthBar.fillStyle(0x2ecc71, 1);
    this.healthBar.fillRect(-25, -50, healthWidth, 6);
    
    // Position the health bar
    this.healthBar.setPosition(this.x, this.y);
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
    this.updateHealthBar();
    
    // Flash red when taking damage
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.clearTint();
    });
    
    if (this.health <= 0) {
      // Player is defeated
      this.setActive(false);
      this.setVisible(false);
      
      // Emit death event
      this.scene.events.emit('player-died');
    }
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.updateHealthBar();
  }
  
  respawn(x: number, y: number) {
    // Reset health
    this.health = this.maxHealth;
    this.updateHealthBar();
    
    // Reset position
    this.setPosition(x, y);
    
    // Make visible and active again
    this.setActive(true);
    this.setVisible(true);
    
    // Reset animation
    this.play('knight-idle');
  }
  
  getHealth() {
    return this.health;
  }
  
  isAttacking() {
    return this._isAttacking;
  }
  
  isFacingLeft() {
    return this._facingLeft;
  }
  
  getLastAttackTime() {
    return this.lastAttackTime;
  }
}
