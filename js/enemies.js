// ============================================================
// enemies.js — enemy AI, wave director, projectiles, pickups
// ============================================================
const Enemies = {
  defs: {
    grunt: {
      name: 'RAIDER', hp: 60, speed: 4.2, radius: 0.5, scale: 1,
      body: 0x4a4038, eye: 0xff7733, score: 100,
      melee: { dmg: 12, range: 1.9, rate: 0.9 },
    },
    runner: {
      name: 'STALKER', hp: 34, speed: 7.2, radius: 0.4, scale: 0.72,
      body: 0x3d4a3d, eye: 0xffe14d, score: 150,
      melee: { dmg: 8, range: 1.6, rate: 0.6 },
    },
    shooter: {
      name: 'SENTRY', hp: 75, speed: 3.1, radius: 0.5, scale: 1,
      body: 0x38404f, eye: 0x4dd2ff, score: 200,
      ranged: { dmg: 13, speed: 17, rate: 2.0, prefer: 16 },
    },
    tank: {
      name: 'JUGGERNAUT', hp: 320, speed: 2.3, radius: 0.75, scale: 1.5,
      body: 0x4f3838, eye: 0xff4455, score: 400,
      melee: { dmg: 26, range: 2.5, rate: 1.2 },
    },
  },

  list: [],
  hitMeshes: [],
  projectiles: [],
  pickups: [],
  scene: null,

  wave: 0,
  state: 'idle', // idle | active | intermission
  intermissionT: 0,
  spawnQueue: [],
  spawnTimer: 0,
  hpScale: 1,
  spdScale: 1,

  _ray: null,
  _projGeo: null,

  init(scene) {
    this.scene = scene;
    this._ray = new THREE.Raycaster();
    this._projGeo = new THREE.SphereGeometry(0.16, 8, 8);
  },

  begin() {
    this.wave = 0;
    this.state = 'intermission';
    this.intermissionT = 3;
    UI.banner('PREPARE', 'FIRST WAVE INBOUND', 2200);
  },

  totalRemaining() {
    return this.list.length + this.spawnQueue.length;
  },

  composeWave(n) {
    const q = [];
    const count = Math.min(5 + Math.round(n * 2.4), 32);
    for (let i = 0; i < count; i++) {
      let t = 'grunt';
      if (n >= 2 && i % 3 === 1) t = 'runner';
      if (n >= 3 && i % 4 === 2) t = 'shooter';
      if (n >= 4 && i % 7 === 6) t = 'tank';
      q.push(t);
    }
    return q;
  },

  startWave(n) {
    this.wave = n;
    this.hpScale = 1 + (n - 1) * 0.12;
    this.spdScale = Math.min(1 + (n - 1) * 0.03, 1.35);
    this.spawnQueue = this.composeWave(n);
    this.spawnTimer = 0.4;
    this.state = 'active';
    UI.banner('WAVE ' + n, 'ELIMINATE ALL HOSTILES', 2200);
    AudioSys.wave();
  },

  // ---------- enemy construction ----------
  spawn(type) {
    const def = this.defs[type];
    // pick a spawn point a decent distance from the player
    let pt = World.spawnPoints[Math.floor(Math.random() * World.spawnPoints.length)];
    for (let tries = 0; tries < 6; tries++) {
      const d = Math.hypot(pt.x - Player.pos.x, pt.z - Player.pos.z);
      if (d > 15) break;
      pt = World.spawnPoints[Math.floor(Math.random() * World.spawnPoints.length)];
    }
    const px = pt.x + (Math.random() - 0.5) * 3;
    const pz = pt.z + (Math.random() - 0.5) * 3;

    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: def.body, roughness: 0.55, metalness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e222a, roughness: 0.6, metalness: 0.4 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: def.eye });

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.3), darkMat);
    legs.position.y = 0.35;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.38), bodyMat);
    torso.position.y = 1.08;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), bodyMat.clone());
    head.position.y = 1.68;
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.03), eyeMat);
    eyes.position.set(0, 1.7, -0.17);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.03), eyeMat);
    core.position.set(0, 1.12, -0.2);

    for (const m of [legs, torso, head]) { m.castShadow = true; }
    group.add(legs, torso, head, eyes, core);

    // health bar sprites
    const barRoot = new THREE.Object3D();
    barRoot.position.y = 2.15;
    const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x101418 }));
    barBg.scale.set(0.9, 0.1, 1);
    const barFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x4dff7a }));
    barFg.center.set(0, 0.5);
    barFg.position.x = -0.45;
    barFg.scale.set(0.9, 0.08, 1);
    barRoot.add(barBg, barFg);
    barRoot.visible = false;
    group.add(barRoot);

    group.scale.setScalar(def.scale);
    group.position.set(px, -1.9 * def.scale, pz);
    this.scene.add(group);

    const e = {
      type, def, group, torso, head, legs,
      barRoot, barFg,
      pos: new THREE.Vector3(px, 0, pz),
      hp: def.hp * this.hpScale,
      maxHp: def.hp * this.hpScale,
      radius: def.radius,
      speed: def.speed * this.spdScale * (0.92 + Math.random() * 0.16),
      dead: false,
      spawnT: 0.7,
      animT: Math.random() * 10,
      flashT: 0,
      atkCd: 0,
      fireCd: 1 + Math.random(),
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      strafeT: 2 + Math.random() * 2,
      avoidDir: 1,
      lungeT: 0,
    };

    // register hittable meshes
    for (const m of [torso, legs]) { m.userData.enemy = e; m.userData.head = false; this.hitMeshes.push(m); }
    head.userData.enemy = e; head.userData.head = true; this.hitMeshes.push(head);

    this.list.push(e);
    FX.spawnBeam(e.pos, def.eye);
  },

  // ---------- damage / death ----------
  hurt(e, dmg, isHead, point) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flashT = 0.07;
    e.barRoot.visible = true;
    UI.hitmarker(isHead);
    AudioSys.hit(isHead);
    if (e.hp <= 0) this.kill(e, isHead);
  },

  kill(e, isHead) {
    e.dead = true;
    const pts = e.def.score + (isHead ? 50 : 0);
    Main.addScore(pts, e.def.name + (isHead ? ' · HEADSHOT' : ''), isHead ? 'head' : '');
    Main.kills++;
    if (isHead) Main.headshots++;

    const c = e.pos.clone(); c.y = 1.1 * e.def.scale;
    FX.sparks(c, e.def.eye, 14, 7, 0.6, 0.07);
    FX.sparks(c, 0x666e7c, 12, 6, 0.8, 0.09, 16);
    AudioSys.kill();

    // drops
    const r = Math.random();
    if (r < 0.16) this.dropPickup('health', e.pos);
    else if (r < 0.34) this.dropPickup('ammo', e.pos);

    this.scene.remove(e.group);
    this.list = this.list.filter(x => x !== e);
    this.hitMeshes = this.hitMeshes.filter(m => m.userData.enemy !== e);
  },

  // ---------- pickups ----------
  dropPickup(kind, pos) {
    const color = kind === 'health' ? 0x2fbf5f : 0xdba53a;
    const group = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.45, 0.45),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3, emissive: color, emissiveIntensity: 0.5 })
    );
    group.add(box);
    if (kind === 'health') {
      const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.06), barMat);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.06), barMat);
      b1.position.z = 0.26; b2.position.z = 0.26;
      group.add(b1, b2);
    }
    group.position.set(pos.x, 0.8, pos.z);
    this.scene.add(group);
    this.pickups.push({ kind, group, t: Math.random() * 6 });
  },

  // ---------- projectiles (shooter enemies) ----------
  fireProjectile(e) {
    const origin = e.pos.clone();
    origin.y = 1.35 * e.def.scale;
    const target = new THREE.Vector3(
      Player.pos.x + (Math.random() - 0.5) * 0.9,
      Player.pos.y + Player.height * 0.6 + (Math.random() - 0.5) * 0.5,
      Player.pos.z + (Math.random() - 0.5) * 0.9
    );
    const dir = target.sub(origin).normalize();
    origin.addScaledVector(dir, 0.5);
    const mesh = new THREE.Mesh(this._projGeo, new THREE.MeshBasicMaterial({ color: e.def.eye }));
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      pos: origin,
      vel: dir.multiplyScalar(e.def.ranged.speed),
      dmg: e.def.ranged.dmg,
      life: 4,
    });
    AudioSys.enemyShoot();
    FX.sparks(origin, e.def.eye, 3, 2, 0.2, 0.04, 0);
  },

  hasLineOfSight(e) {
    const from = e.pos.clone(); from.y = 1.4 * e.def.scale;
    const to = new THREE.Vector3(Player.pos.x, Player.pos.y + Player.height * 0.6, Player.pos.z);
    const dir = to.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    this._ray.set(from, dir);
    this._ray.far = dist - 0.3;
    return this._ray.intersectObjects(World.solidMeshes, false).length === 0;
  },

  // ---------- movement helpers ----------
  blockedAt(x, z, r) {
    for (const c of World.colliders) {
      if (c.maxY > 0.5 && World.circleHitsBox(x, z, r, c)) return true;
    }
    return false;
  },

  stepMove(e, dx, dz) {
    const nx = e.pos.x + dx, nz = e.pos.z + dz;
    if (!this.blockedAt(nx, nz, e.radius)) { e.pos.x = nx; e.pos.z = nz; return; }
    if (!this.blockedAt(nx, e.pos.z, e.radius)) { e.pos.x = nx; return; }
    if (!this.blockedAt(e.pos.x, nz, e.radius)) { e.pos.z = nz; return; }
    // both axes blocked: slide perpendicular, flipping direction when stuck
    const px = e.pos.x - dz * e.avoidDir, pz = e.pos.z + dx * e.avoidDir;
    if (!this.blockedAt(px, pz, e.radius)) { e.pos.x = px; e.pos.z = pz; }
    else e.avoidDir = -e.avoidDir;
  },

  // ---------- per-frame update ----------
  update(dt) {
    // wave director
    if (this.state === 'intermission') {
      this.intermissionT -= dt;
      if (this.intermissionT <= 0) this.startWave(this.wave + 1);
    } else if (this.state === 'active') {
      if (this.spawnQueue.length) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawn(this.spawnQueue.shift());
          this.spawnTimer = Math.max(0.4, 1.2 - this.wave * 0.06);
        }
      } else if (this.list.length === 0) {
        // wave cleared
        const bonus = this.wave * 50;
        Main.addScore(bonus, 'WAVE ' + this.wave + ' CLEARED', 'bonus');
        Player.heal(15);
        UI.killfeed('+15 HP', 'bonus');
        UI.banner('WAVE CLEARED', '+' + bonus + ' BONUS', 2200);
        AudioSys.cleared();
        this.state = 'intermission';
        this.intermissionT = 4.5;
      }
    }

    // enemies
    for (const e of this.list) {
      this.updateEnemy(e, dt);
    }

    // separation so enemies don't stack
    for (let i = 0; i < this.list.length; i++) {
      for (let j = i + 1; j < this.list.length; j++) {
        const a = this.list[i], b = this.list[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0.0001 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5 / d;
          a.pos.x -= dx * push; a.pos.z -= dz * push;
          b.pos.x += dx * push; b.pos.z += dz * push;
        }
      }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.life -= dt;
      let remove = false;

      const dxz = Math.hypot(p.pos.x - Player.pos.x, p.pos.z - Player.pos.z);
      if (Player.alive && dxz < 0.55 && p.pos.y > Player.pos.y && p.pos.y < Player.pos.y + Player.height + 0.2) {
        Player.takeDamage(p.dmg);
        remove = true;
      } else if (p.pos.y < 0.05 || World.pointInAnyBox(p.pos) || p.life <= 0) {
        FX.sparks(p.pos, 0x4dd2ff, 4, 3, 0.25, 0.04);
        remove = true;
      }
      if (remove) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      pk.group.rotation.y += dt * 2;
      pk.group.position.y = 0.8 + Math.sin(pk.t * 2.5) * 0.15;
      const d = Math.hypot(pk.group.position.x - Player.pos.x, pk.group.position.z - Player.pos.z);
      if (Player.alive && d < 1.35) {
        if (pk.kind === 'health') {
          if (Player.hp >= Player.maxHp) continue; // leave it for later
          Player.heal(35);
          UI.killfeed('+35 HP', 'bonus');
        } else {
          Weapons.addReserve({ rifle: 40, pistol: 20, shotgun: 8 });
          UI.killfeed('+ AMMO', 'bonus');
        }
        AudioSys.pickup(pk.kind);
        this.scene.remove(pk.group);
        this.pickups.splice(i, 1);
      }
    }
  },

  updateEnemy(e, dt) {
    const def = e.def;
    e.animT += dt;
    e.atkCd = Math.max(0, e.atkCd - dt);
    e.lungeT = Math.max(0, e.lungeT - dt);

    // hit flash
    if (e.flashT > 0) {
      e.flashT -= dt;
      const on = e.flashT > 0;
      e.torso.material.emissive.setHex(on ? 0xffffff : 0x000000);
      e.torso.material.emissiveIntensity = on ? 0.7 : 0;
    }

    // health bar
    if (e.barRoot.visible) {
      const ratio = Math.max(0, e.hp / e.maxHp);
      e.barFg.scale.x = 0.9 * ratio;
      e.barFg.material.color.setHSL(ratio * 0.33, 0.9, 0.55);
    }

    // rising out of the ground on spawn
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      const k = Math.max(0, e.spawnT / 0.7);
      e.group.position.set(e.pos.x, -1.9 * def.scale * k, e.pos.z);
      return;
    }

    const toX = Player.pos.x - e.pos.x;
    const toZ = Player.pos.z - e.pos.z;
    const dist = Math.hypot(toX, toZ);
    const nx = dist > 0.001 ? toX / dist : 0;
    const nz = dist > 0.001 ? toZ / dist : 0;

    let moveX = 0, moveZ = 0, moving = false;

    if (Player.alive) {
      if (def.ranged) {
        const prefer = def.ranged.prefer;
        e.strafeT -= dt;
        if (e.strafeT <= 0) { e.strafeDir = -e.strafeDir; e.strafeT = 2 + Math.random() * 2.5; }
        if (dist > prefer + 3) { moveX = nx; moveZ = nz; moving = true; }
        else if (dist < prefer - 5) { moveX = -nx; moveZ = -nz; moving = true; }
        else { moveX = -nz * e.strafeDir; moveZ = nx * e.strafeDir; moving = true; }

        e.fireCd -= dt;
        if (e.fireCd <= 0 && dist < 30 && this.hasLineOfSight(e)) {
          this.fireProjectile(e);
          e.fireCd = def.ranged.rate * (0.8 + Math.random() * 0.5);
        }
      } else {
        const m = def.melee;
        if (dist > m.range * 0.85) { moveX = nx; moveZ = nz; moving = true; }
        if (dist < m.range && e.atkCd <= 0 && Math.abs(Player.pos.y - e.pos.y) < 1.6) {
          Player.takeDamage(m.dmg);
          AudioSys.melee();
          e.atkCd = m.rate;
          e.lungeT = 0.22;
          FX.addShake(0.18);
        }
      }
    }

    if (moving) {
      const sp = e.speed * dt;
      this.stepMove(e, moveX * sp, moveZ * sp);
    }

    // pose: face player, bob while walking, lunge on attack
    e.group.position.set(e.pos.x, 0, e.pos.z);
    e.group.rotation.y = Math.atan2(toX, toZ) + Math.PI;
    const walkK = moving ? 1 : 0;
    const bob = Math.abs(Math.sin(e.animT * e.speed * 1.6)) * 0.06 * walkK;
    e.group.position.y = bob;
    e.torso.rotation.z = Math.sin(e.animT * e.speed * 1.6) * 0.05 * walkK;
    e.torso.rotation.x = e.lungeT > 0 ? -0.45 * (e.lungeT / 0.22) : 0;
  },
};
