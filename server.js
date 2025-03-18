class Server {
  async joinGame(nickname) {
    try {
      // Join the default combat room
      const roomId = await $global.joinRoom('combat-arena');
      
      // Initialize player state with random position
      const randomX = 1000 + Math.floor(Math.random() * 800 - 400);
      const randomY = 1000 + Math.floor(Math.random() * 800 - 400);
      
      await $room.updateMyState({
        nickname: nickname || `Knight-${$sender.account.substring(0, 5)}`,
        position: { x: randomX, y: randomY },
        health: 100,
        isAttacking: false,
        facingLeft: false,
        lastAttackTime: 0
      });
      
      return { 
        success: true, 
        roomId,
        position: { x: randomX, y: randomY }
      };
    } catch (error) {
      console.error("Error joining game:", error);
      return { success: false, message: '게임 참가 중 오류가 발생했습니다.' };
    }
  }
  
  async leaveGame() {
    try {
      await $global.leaveRoom();
      return { success: true };
    } catch (error) {
      console.error("Error leaving game:", error);
      return { success: false };
    }
  }
  
  async updatePlayerState(state) {
    if (!state) return { success: false };
    
    try {
      await $room.updateMyState({
        position: state.position,
        health: state.health,
        isAttacking: state.isAttacking,
        facingLeft: state.facingLeft,
        lastAttackTime: state.lastAttackTime
      });
      
      return { success: true };
    } catch (error) {
      console.error("Error updating player state:", error);
      return { success: false };
    }
  }
  
  async attackPlayer(targetAccount) {
    try {
      // Get attacker state
      const myState = await $room.getMyState();
      
      // Get target player state
      const targetState = await $room.getUserState(targetAccount);
      
      if (!targetState) {
        return { success: false, message: '대상 플레이어를 찾을 수 없습니다.' };
      }
      
      // Check if enough time has passed since last attack (server-side validation)
      const now = Date.now();
      if (myState.lastAttackTime && now - myState.lastAttackTime < 800) {
        return { success: false, message: '공격 쿨다운 중입니다.' };
      }
      
      // Update attacker's last attack time
      await $room.updateMyState({
        lastAttackTime: now,
        isAttacking: true
      });
      
      // Calculate damage (10-20 damage per hit)
      const damage = 10 + Math.floor(Math.random() * 10);
      
      // Update target's health
      const newHealth = Math.max(0, targetState.health - damage);
      await $room.updateUserState(targetAccount, {
        health: newHealth
      });
      
      // Send hit message to target
      $room.sendMessageToUser('hit', targetAccount, {
        attacker: $sender.account,
        damage: damage
      });
      
      return { 
        success: true, 
        damage: damage,
        targetHealth: newHealth
      };
    } catch (error) {
      console.error("Error attacking player:", error);
      return { success: false, message: '공격 중 오류가 발생했습니다.' };
    }
  }
  
  async respawnPlayer() {
    try {
      // Generate random position for respawn
      const randomX = 1000 + Math.floor(Math.random() * 800 - 400);
      const randomY = 1000 + Math.floor(Math.random() * 800 - 400);
      
      // Reset player state
      await $room.updateMyState({
        position: { x: randomX, y: randomY },
        health: 100,
        isAttacking: false
      });
      
      return { 
        success: true, 
        position: { x: randomX, y: randomY }
      };
    } catch (error) {
      console.error("Error respawning player:", error);
      return { success: false, message: '리스폰 중 오류가 발생했습니다.' };
    }
  }
  
  async getAllPlayers() {
    try {
      const allStates = await $room.getAllUserStates();
      return { 
        players: allStates
      };
    } catch (error) {
      console.error("Error getting all players:", error);
      return { players: [] };
    }
  }
}
