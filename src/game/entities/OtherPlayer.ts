import Phaser from 'phaser';

export class OtherPlayer extends Phaser.Physics.Arcade.Sprite {
  private healthBar: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private health: number = 100;
  private maxHealth: number = 100;
  private account: string;
  private nickname: string;
  private isAttacking: boolean = false;
  
  constructor(scene: Phaser.Scene, x: number, y: number, account: string, nickname: string) {
    super(scene, x, y, 'knight');
    
    this.account = account;
    this.nickname = nickname || `Knight-${account.substring(0, 5)}`;
    
    // Add this game object to the scene
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Set up physics body
    this.setSize(60, 80);
    this.setOffset(66, 80);
    
    // Set scale to make the knight a bit smaller
    this.setScale(0.8);
    
    // Play idle animation
    this.play('knight-idle');
    
    // Create health bar
    this.healthBar = scene.add.graphics();
    this.updateHealthBar();
    
    // Add name text
    this.nameText = scene.add.text(x, y - 60, this.nickname, {
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5, 0.5);
  }
  
  updateFromState(state: any) {
    if (!state) return;
    
    // Update position
    if (state.position) {
      this.setPosition(state.position.x, state.position.y);
    }
    
    // Update health
    if (state.health !== undefined) {
      this.health = state.health;
      this.updateHealthBar();
    }
    
    // Update facing direction
    if (state.facingLeft !== undefined) {
      this.setFlipX(state.facingLeft);
    }
    
    // Handle attack animation
    if (state.isAttacking && !this.isAttacking) {
      this.isAttacking = true;
      this.play('knight-attack');
      
      // Reset attacking flag when animation completes
      this.once('animationcomplete', () => {
        this.isAttacking = false;
        this.play('knight-idle');
      });
    } else if (!state.isAttacking && !this.isAttacking) {
      // Only update animation if not attacking
      if (state.position && (state.position.velocityX || state.position.velocityY)) {
        this.play('knight-move', true);
      } else {
        this.play('knight-idle', true);
      }
    }
  }
  
  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
    this.updateHealthBar();
    
    // Flash red when taking damage
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.clearTint();
    });
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
  
  update() {
    // Update health bar and name text positions
    this.updateHealthBar();
    this.nameText.setPosition(this.x, this.y - 60);
  }
  
  getAccount() {
    return this.account;
  }
  
  destroy(fromScene?: boolean) {
    // Clean up text and health bar
    if (this.nameText) this.nameText.destroy();
    if (this.healthBar) this.healthBar.destroy();
    
    super.destroy(fromScene);
  }
}
