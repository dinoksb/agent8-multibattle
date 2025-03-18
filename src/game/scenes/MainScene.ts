import Phaser from "phaser";
import { Player } from "../entities/Player";
import { OtherPlayer } from "../entities/OtherPlayer";

export class MainScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private server: any;
  private otherPlayers: Map<string, OtherPlayer> = new Map();
  private updateTimer: number = 0;
  private attackRange: number = 100; // Attack range in pixels
  private attackCooldown: number = 0;
  private hitEffects: Phaser.GameObjects.Group;
  private playerInfoText: Phaser.GameObjects.Text;
  private respawnButton: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "MainScene" });
  }

  preload() {
    // Load knight sprite sheet
    this.load.spritesheet('knight', 
      'https://agent8-games.verse8.io/assets/2D/sprite_characters/medieval-knight.png',
      { frameWidth: 192, frameHeight: 192 }
    );
    
    // Load hit effect
    this.load.image('hit-effect', 
      'https://agent8-games.verse8.io/assets/2D/vampire_survival_riped_asset/projectile/sword.png'
    );
  }

  create() {
    // Create animations
    this.createAnimations();
    
    // Create the player at center of the world
    this.player = new Player(this, 1000, 1000);
    
    // Set up camera to follow player
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(1.2);
    
    // Create input controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasdKeys = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    };
    
    // Create a simple background grid
    this.createBackgroundGrid();
    
    // Create hit effects group
    this.hitEffects = this.add.group();
    
    // Add player info text
    this.playerInfoText = this.add.text(16, 16, 'Health: 100', {
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setScrollFactor(0);
    
    // Create respawn button (hidden initially)
    this.respawnButton = this.add.text(
      this.cameras.main.width / 2, 
      this.cameras.main.height / 2, 
      '리스폰하기', 
      {
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#ff0000',
        padding: { x: 20, y: 10 }
      }
    )
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setInteractive()
    .on('pointerdown', () => this.respawnPlayer())
    .setVisible(false);
    
    // Handle window resize
    this.scale.on('resize', this.handleResize, this);
    
    // Set up game over event
    this.events.on('player-died', this.handlePlayerDeath, this);
  }
  
  handleResize() {
    if (this.respawnButton) {
      this.respawnButton.setPosition(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2
      );
    }
  }
  
  setServer(server: any) {
    this.server = server;
    
    if (server) {
      // Subscribe to room state to get all players
      server.subscribeRoomState('combat-arena', (state: any) => {
        if (state && state.$users) {
          // Request all player states
          this.requestAllPlayers();
        }
      });
      
      // Subscribe to all user states in the room
      server.subscribeRoomAllUserStates('combat-arena', (states: any[]) => {
        this.updateOtherPlayers(states);
      });
      
      // Listen for player join/leave events
      server.onRoomUserJoin('combat-arena', (account: string) => {
        console.log(`Player joined: ${account}`);
      });
      
      server.onRoomUserLeave('combat-arena', (account: string) => {
        this.handlePlayerLeave(account);
      });
      
      // Listen for hit messages
      server.onRoomMessage('combat-arena', 'hit', (message: any) => {
        if (message && message.damage) {
          this.player.takeDamage(message.damage);
          this.createHitEffect(this.player.x, this.player.y);
          
          // Check if player died
          if (this.player.getHealth() <= 0) {
            this.events.emit('player-died');
          }
        }
      });
      
      // Initialize player position from server if available
      this.initializePlayerPosition();
    }
  }
  
  async initializePlayerPosition() {
    if (!this.server) return;
    
    try {
      const result = await this.server.remoteFunction('joinGame', ['']);
      if (result.success && result.position) {
        this.player.setPosition(result.position.x, result.position.y);
      }
    } catch (error) {
      console.error('Failed to initialize player position:', error);
    }
  }
  
  async requestAllPlayers() {
    if (!this.server) return;
    
    try {
      const result = await this.server.remoteFunction('getAllPlayers');
      if (result && result.players) {
        this.updateOtherPlayers(result.players);
      }
    } catch (error) {
      console.error('Failed to get all players:', error);
    }
  }
  
  updateOtherPlayers(players: any[]) {
    if (!players) return;
    
    // Filter out current player
    const otherPlayers = players.filter(player => 
      player.account !== this.server.account
    );
    
    // Update existing players and add new ones
    otherPlayers.forEach(player => {
      const account = player.account;
      
      if (this.otherPlayers.has(account)) {
        // Update existing player
        const otherPlayer = this.otherPlayers.get(account);
        otherPlayer?.updateFromState(player);
      } else {
        // Add new player
        const nickname = player.nickname || `Knight-${account.substring(0, 5)}`;
        const position = player.position || { x: 1000, y: 1000 };
        
        const otherPlayer = new OtherPlayer(
          this, 
          position.x, 
          position.y, 
          account, 
          nickname
        );
        
        otherPlayer.updateFromState(player);
        this.otherPlayers.set(account, otherPlayer);
        
        // Add collision with player
        this.physics.add.collider(this.player, otherPlayer);
      }
    });
    
    // Remove players that are no longer in the game
    const currentAccounts = new Set(otherPlayers.map(p => p.account));
    
    this.otherPlayers.forEach((player, account) => {
      if (!currentAccounts.has(account)) {
        player.destroy();
        this.otherPlayers.delete(account);
      }
    });
  }
  
  handlePlayerLeave(account: string) {
    if (this.otherPlayers.has(account)) {
      const player = this.otherPlayers.get(account);
      player?.destroy();
      this.otherPlayers.delete(account);
    }
  }
  
  update(time: number, delta: number) {
    if (!this.player.active) return;
    
    // Update player
    this.player.update(this.cursors, this.wasdKeys);
    
    // Update other players
    this.otherPlayers.forEach(player => player.update());
    
    // Update player info text
    this.playerInfoText.setText(`Health: ${this.player.getHealth()}`);
    
    // Update attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }
    
    // Check for attack input
    if ((this.cursors.space.isDown || this.wasdKeys.SPACE.isDown) && 
        this.attackCooldown <= 0 && 
        !this.player.isAttacking()) {
      this.attackNearbyPlayers();
    }
    
    // Send player state to server periodically
    this.updateTimer += delta;
    if (this.updateTimer >= 100) { // Update every 100ms
      this.updateTimer = 0;
      this.sendPlayerState();
    }
  }
  
  async sendPlayerState() {
    if (!this.server || !this.player.active) return;
    
    try {
      const state = {
        position: {
          x: this.player.x,
          y: this.player.y,
          velocityX: this.player.body.velocity.x,
          velocityY: this.player.body.velocity.y
        },
        health: this.player.getHealth(),
        isAttacking: this.player.isAttacking(),
        facingLeft: this.player.isFacingLeft(),
        lastAttackTime: this.player.getLastAttackTime()
      };
      
      await this.server.remoteFunction('updatePlayerState', [state], {
        throttle: 100 // Throttle updates to reduce network traffic
      });
    } catch (error) {
      console.error('Failed to update player state:', error);
    }
  }
  
  async attackNearbyPlayers() {
    if (!this.server || !this.player.active) return;
    
    // Set local attack cooldown
    this.attackCooldown = 800;
    
    // Find nearby players
    let nearestPlayer: OtherPlayer | null = null;
    let nearestDistance = this.attackRange;
    
    this.otherPlayers.forEach(otherPlayer => {
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        otherPlayer.x, otherPlayer.y
      );
      
      if (distance < nearestDistance) {
        nearestPlayer = otherPlayer;
        nearestDistance = distance;
      }
    });
    
    // Attack nearest player if in range
    if (nearestPlayer) {
      try {
        const result = await this.server.remoteFunction('attackPlayer', [
          nearestPlayer.getAccount()
        ]);
        
        if (result.success) {
          // Create hit effect
          this.createHitEffect(nearestPlayer.x, nearestPlayer.y);
          
          // Show damage number
          this.showDamageNumber(nearestPlayer.x, nearestPlayer.y, result.damage);
        }
      } catch (error) {
        console.error('Failed to attack player:', error);
      }
    }
  }
  
  createHitEffect(x: number, y: number) {
    const effect = this.add.image(x, y, 'hit-effect');
    effect.setScale(1.5);
    effect.setAlpha(0.8);
    
    // Random rotation
    effect.setAngle(Phaser.Math.Between(0, 360));
    
    // Animation
    this.tweens.add({
      targets: effect,
      alpha: 0,
      scale: 0.5,
      duration: 300,
      onComplete: () => {
        effect.destroy();
      }
    });
  }
  
  showDamageNumber(x: number, y: number, damage: number) {
    const text = this.add.text(x, y - 20, `-${damage}`, {
      fontSize: '24px',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    this.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 1000,
      onComplete: () => {
        text.destroy();
      }
    });
  }
  
  handlePlayerDeath() {
    // Show respawn button
    this.respawnButton.setVisible(true);
  }
  
  async respawnPlayer() {
    if (!this.server) return;
    
    try {
      const result = await this.server.remoteFunction('respawnPlayer');
      
      if (result.success) {
        // Reset player
        this.player.respawn(result.position.x, result.position.y);
        
        // Hide respawn button
        this.respawnButton.setVisible(false);
      }
    } catch (error) {
      console.error('Failed to respawn player:', error);
    }
  }

  private createAnimations() {
    // Idle animation
    this.anims.create({
      key: 'knight-idle',
      frames: this.anims.generateFrameNumbers('knight', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
    
    // Move animation
    this.anims.create({
      key: 'knight-move',
      frames: this.anims.generateFrameNumbers('knight', { start: 4, end: 11 }),
      frameRate: 12,
      repeat: -1
    });
    
    // Attack animation
    this.anims.create({
      key: 'knight-attack',
      frames: this.anims.generateFrameNumbers('knight', { start: 12, end: 17 }),
      frameRate: 15,
      repeat: 0
    });
  }

  private createBackgroundGrid() {
    const graphics = this.add.graphics();
    
    // Draw grid
    graphics.lineStyle(1, 0x333333, 0.8);
    
    // Vertical lines
    for (let x = 0; x < 2000; x += 50) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, 2000);
    }
    
    // Horizontal lines
    for (let y = 0; y < 2000; y += 50) {
      graphics.moveTo(0, y);
      graphics.lineTo(2000, y);
    }
    
    graphics.strokePath();
    
    // Add some random decorative elements
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(50, 1950);
      const y = Phaser.Math.Between(50, 1950);
      const size = Phaser.Math.Between(5, 15);
      const color = 0x333333;
      
      graphics.fillStyle(color, 0.5);
      graphics.fillCircle(x, y, size);
    }
  }
}
