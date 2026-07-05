// ============================================================
// player.js — first-person movement controller
// ============================================================
const Player = {
  pos: new THREE.Vector3(0, 0, 18), // feet position
  vel: new THREE.Vector3(0, 0, 0),
  yaw: 0,
  pitch: 0,
  radius: 0.42,
  standHeight: 1.72,
  crouchHeight: 1.15,
  height: 1.72,
  hp: 100,
  maxHp: 100,
  alive: true,
  onGround: true,
  crouching: false,
  sprinting: false,
  sprintAmount: 0,
  bobPhase: 0,
  bobX: 0,
  bobY: 0,

  eyeHeight() { return this.height - 0.12; },

  update(dt, input) {
    if (!this.alive) return;
    const keys = input.keys;
    const fwd = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    const strafe = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);

    this.crouching = !!(keys['KeyC'] || keys['ControlLeft']);
    this.sprinting = !!(keys['ShiftLeft'] || keys['ShiftRight']) && fwd > 0 &&
      !this.crouching && !input.ads && Weapons.sprintBlock <= 0;
    this.sprintAmount += ((this.sprinting ? 1 : 0) - this.sprintAmount) * Math.min(1, dt * 8);

    // crouch height transition
    const targetH = this.crouching ? this.crouchHeight : this.standHeight;
    this.height += (targetH - this.height) * Math.min(1, dt * 10);

    let speed = 6.2;
    if (this.sprinting) speed = 9.3;
    if (this.crouching) speed = 3.2;
    speed *= 1 - 0.45 * Weapons.adsAmount;

    // wish direction in world space (yaw 0 faces -Z)
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * fwd + cy * strafe;
    let wz = -cy * fwd - sy * strafe;
    const wl = Math.hypot(wx, wz);
    if (wl > 0.001) { wx /= wl; wz /= wl; }

    const accel = this.onGround ? 12 : 3.5;
    this.vel.x += (wx * speed - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (wz * speed - this.vel.z) * Math.min(1, dt * accel);

    if (keys['Space'] && this.onGround) {
      this.vel.y = 8.3;
      this.onGround = false;
      AudioSys.jump();
    }
    this.vel.y -= 23 * dt;

    this.moveCollide(dt);

    // head bob + footsteps
    const groundSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && groundSpeed > 1.5) {
      const prev = this.bobPhase;
      this.bobPhase += dt * groundSpeed * 1.35;
      const amp = (0.026 + groundSpeed * 0.002) * (1 - 0.85 * Weapons.adsAmount);
      this.bobX = Math.sin(this.bobPhase) * amp;
      this.bobY = Math.abs(Math.cos(this.bobPhase)) * amp * 0.6;
      if (Math.floor(prev / Math.PI) !== Math.floor(this.bobPhase / Math.PI)) AudioSys.step();
    } else {
      this.bobX += (0 - this.bobX) * Math.min(1, dt * 8);
      this.bobY += (0 - this.bobY) * Math.min(1, dt * 8);
    }
  },

  moveCollide(dt) {
    const r = this.radius, step = 0.55;
    const feet = this.pos.y;

    const blockedAt = (x, z) => {
      for (const c of World.colliders) {
        if (feet + step < c.maxY && feet + this.height > c.minY &&
            x > c.minX - r && x < c.maxX + r &&
            z > c.minZ - r && z < c.maxZ + r) return true;
      }
      return false;
    };

    // horizontal, axis by axis so we slide along walls
    const nx = this.pos.x + this.vel.x * dt;
    if (!blockedAt(nx, this.pos.z)) this.pos.x = nx; else this.vel.x = 0;
    const nz = this.pos.z + this.vel.z * dt;
    if (!blockedAt(this.pos.x, nz)) this.pos.z = nz; else this.vel.z = 0;

    // ground height under the player (crate tops count if at/below feet+step)
    let ground = 0;
    for (const c of World.colliders) {
      if (c.maxY <= feet + step && c.maxY > ground &&
          this.pos.x > c.minX - r * 0.5 && this.pos.x < c.maxX + r * 0.5 &&
          this.pos.z > c.minZ - r * 0.5 && this.pos.z < c.maxZ + r * 0.5) {
        ground = c.maxY;
      }
    }

    const wasFalling = this.vel.y < -8;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= ground) {
      this.pos.y = ground;
      if (this.vel.y < 0) this.vel.y = 0;
      if (!this.onGround && wasFalling) AudioSys.land();
      this.onGround = true;
    } else {
      this.onGround = this.pos.y - ground < 0.02;
    }
  },

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    UI.damageFlash(Math.min(0.7, 0.25 + amount / 45));
    AudioSys.hurt();
    FX.addShake(0.12);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      Main.gameOver();
    }
  },

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  },
};
