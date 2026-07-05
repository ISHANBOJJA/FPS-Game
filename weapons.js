// ============================================================
// weapons.js — weapon defs, viewmodels, firing, recoil, ADS
// ============================================================
const Weapons = {
  defs: {
    rifle: {
      name: 'AR-77 VANDAL', sound: 'rifle', auto: true,
      damage: 22, headMult: 2, pellets: 1, falloff: false,
      fireDelay: 0.1, magSize: 30, startReserve: 150,
      spread: 0.012, adsSpreadMult: 0.22, bloomPerShot: 0.006, bloomMax: 0.034,
      recoil: 0.013, kick: 0.05, reloadTime: 1.7, adsFov: 52,
      hipPos: { x: 0.24, y: -0.21, z: -0.42 }, adsPos: { x: 0, y: -0.082, z: -0.3 },
      tracer: 0xffd27a,
    },
    pistol: {
      name: 'P9 HAVOC', sound: 'pistol', auto: false,
      damage: 34, headMult: 2, pellets: 1, falloff: false,
      fireDelay: 0.16, magSize: 12, startReserve: 84,
      spread: 0.008, adsSpreadMult: 0.25, bloomPerShot: 0.011, bloomMax: 0.04,
      recoil: 0.02, kick: 0.07, reloadTime: 1.15, adsFov: 58,
      hipPos: { x: 0.22, y: -0.22, z: -0.4 }, adsPos: { x: 0, y: -0.058, z: -0.3 },
      tracer: 0xaad4ff,
    },
    shotgun: {
      name: 'S8 BREACHER', sound: 'shotgun', auto: false,
      damage: 12, headMult: 1.6, pellets: 8, falloff: true,
      fireDelay: 0.9, magSize: 6, startReserve: 32,
      spread: 0.042, adsSpreadMult: 0.7, bloomPerShot: 0.008, bloomMax: 0.03,
      recoil: 0.04, kick: 0.13, reloadTime: 2.2, adsFov: 60,
      hipPos: { x: 0.24, y: -0.22, z: -0.44 }, adsPos: { x: 0, y: -0.075, z: -0.34 },
      tracer: 0xffb066,
    },
  },
  order: ['rifle', 'pistol', 'shotgun'],
  current: 'rifle',
  ammo: {},

  camera: null,
  model: null,
  muzzle: null,
  flashMesh: null,
  flashLight: null,
  flashT: 0,

  fireTimer: 0,
  bloom: 0,
  camRecoilX: 0,
  camRecoilY: 0,
  gunKick: 0,
  adsAmount: 0,
  sprintBlock: 0,
  swayX: 0,
  swayY: 0,

  reloading: false,
  reloadT: 0,
  reloadMidPlayed: false,
  switchT: 0,
  pendingSwitch: null,

  shotsFired: 0,
  shotsHit: 0,

  _ray: null,

  init(camera) {
    this.camera = camera;
    this._ray = new THREE.Raycaster();
    this._ray.far = 250;
    for (const k of this.order) {
      this.ammo[k] = { mag: this.defs[k].magSize, reserve: this.defs[k].startReserve };
    }
    this.model = new THREE.Group();
    camera.add(this.model);

    this.flashMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 })
    );
    this.flashMesh.visible = false;
    this.flashLight = new THREE.PointLight(0xffa640, 0, 7);

    this.buildModel(this.current);
  },

  _mat(c, metal = 0.6) {
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.42, metalness: metal });
  },

  buildModel(name) {
    while (this.model.children.length) this.model.remove(this.model.children[0]);
    const gm = this._mat(0x2c2f36);       // gunmetal
    const dk = this._mat(0x1b1d22, 0.4);  // grips / furniture
    const part = (mat, w, h, d, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      this.model.add(m);
      return m;
    };

    this.muzzle = new THREE.Object3D();

    if (name === 'rifle') {
      part(gm, 0.075, 0.1, 0.46, 0, 0, -0.12);        // receiver
      part(gm, 0.035, 0.045, 0.3, 0, 0.01, -0.48);    // barrel
      part(dk, 0.06, 0.07, 0.22, 0, -0.005, -0.36);   // handguard
      part(dk, 0.06, 0.09, 0.18, 0, -0.01, 0.14);     // stock
      part(dk, 0.045, 0.11, 0.06, 0, -0.09, 0.02, 0.3);   // grip
      part(dk, 0.05, 0.14, 0.07, 0, -0.11, -0.16, -0.15); // magazine
      part(gm, 0.012, 0.035, 0.012, 0, 0.075, -0.44);  // front sight post
      part(gm, 0.016, 0.03, 0.02, -0.02, 0.072, -0.02); // rear sight L
      part(gm, 0.016, 0.03, 0.02, 0.02, 0.072, -0.02);  // rear sight R
      this.muzzle.position.set(0, 0.01, -0.64);
    } else if (name === 'pistol') {
      part(gm, 0.055, 0.06, 0.24, 0, 0.02, -0.1);      // slide
      part(dk, 0.05, 0.05, 0.18, 0, -0.025, -0.07);    // frame
      part(dk, 0.048, 0.13, 0.07, 0, -0.1, 0.02, 0.25);// grip
      part(gm, 0.01, 0.025, 0.012, 0, 0.062, -0.2);    // front sight
      part(gm, 0.014, 0.022, 0.016, -0.016, 0.06, 0);  // rear sight L
      part(gm, 0.014, 0.022, 0.016, 0.016, 0.06, 0);   // rear sight R
      this.muzzle.position.set(0, 0.02, -0.24);
    } else {
      part(gm, 0.08, 0.1, 0.5, 0, 0, -0.1);            // receiver
      part(gm, 0.045, 0.045, 0.35, 0, 0.025, -0.55);   // barrel
      part(dk, 0.05, 0.05, 0.34, 0, -0.035, -0.5);     // tube
      part(dk, 0.07, 0.06, 0.16, 0, -0.04, -0.42);     // pump
      part(dk, 0.065, 0.1, 0.2, 0, -0.02, 0.18);       // stock
      part(gm, 0.012, 0.03, 0.012, 0, 0.06, -0.7);     // bead sight
      this.muzzle.position.set(0, 0.025, -0.73);
    }

    this.model.add(this.muzzle);
    this.muzzle.add(this.flashMesh);
    this.muzzle.add(this.flashLight);
  },

  def() { return this.defs[this.current]; },

  spreadNow() {
    const d = this.def();
    let s = d.spread * THREE.MathUtils.lerp(1, d.adsSpreadMult, this.adsAmount) + this.bloom;
    const moveSpeed = Math.hypot(Player.vel.x, Player.vel.z);
    s *= 1 + moveSpeed * 0.03;
    if (!Player.onGround) s *= 1.6;
    if (Player.crouching) s *= 0.8;
    return s;
  },

  switchTo(name) {
    if (name === this.current || this.pendingSwitch || !this.defs[name]) return;
    this.pendingSwitch = name;
    this.switchT = 0.28;
    this.reloading = false;
    AudioSys.switchW();
  },

  cycle(dir) {
    const i = this.order.indexOf(this.pendingSwitch || this.current);
    const n = this.order[(i + dir + this.order.length) % this.order.length];
    this.switchTo(n);
  },

  startReload() {
    const a = this.ammo[this.current];
    const d = this.def();
    if (this.reloading || this.switchT > 0 || a.mag >= d.magSize || a.reserve <= 0) return;
    this.reloading = true;
    this.reloadT = 0;
    this.reloadMidPlayed = false;
    AudioSys.reload(0);
  },

  tryFire() {
    if (this.fireTimer > 0 || this.reloading || this.switchT > 0 || !Player.alive) return;
    const a = this.ammo[this.current];
    if (a.mag <= 0) {
      AudioSys.dry();
      this.fireTimer = 0.25;
      if (a.reserve > 0) this.startReload();
      return;
    }
    this.doShot();
  },

  doShot() {
    const d = this.def();
    const a = this.ammo[this.current];
    a.mag--;
    this.fireTimer = d.fireDelay;
    this.sprintBlock = 0.35;
    AudioSys.shoot(d.sound);

    // muzzle flash
    this.flashT = 0.045;
    this.flashMesh.rotation.z = Math.random() * Math.PI;
    const fs = 0.8 + Math.random() * 0.5;
    this.flashMesh.scale.set(fs, fs, fs);

    // recoil: part permanent kick, part recovering spring
    const r = d.recoil * THREE.MathUtils.lerp(1, 0.6, this.adsAmount);
    Player.pitch = Math.min(1.55, Player.pitch + r * 0.45);
    this.camRecoilX += r;
    this.camRecoilY += (Math.random() - 0.5) * r * 0.8;
    this.gunKick += d.kick;
    this.bloom = Math.min(d.bloomMax, this.bloom + d.bloomPerShot);
    FX.addShake(d.pellets > 1 ? 0.1 : 0.025);

    const spread = this.spreadNow();
    const muzzlePos = new THREE.Vector3();
    this.muzzle.getWorldPosition(muzzlePos);
    const camPos = this.camera.position.clone();
    const targets = Enemies.hitMeshes.concat(World.solidMeshes);

    for (let p = 0; p < d.pellets; p++) {
      const dir = new THREE.Vector3(
        (Math.random() * 2 - 1) * spread,
        (Math.random() * 2 - 1) * spread,
        -1
      ).normalize().applyQuaternion(this.camera.quaternion);

      this._ray.set(camPos, dir);
      const hits = this._ray.intersectObjects(targets, false);
      let end = camPos.clone().addScaledVector(dir, 120);
      this.shotsFired++;

      if (hits.length) {
        const h = hits[0];
        end = h.point;
        const ud = h.object.userData;
        if (ud.enemy && !ud.enemy.dead) {
          let dmg = d.damage * (ud.head ? d.headMult : 1);
          if (d.falloff) dmg *= THREE.MathUtils.clamp(1 - (h.distance - 9) / 28, 0.25, 1);
          Enemies.hurt(ud.enemy, dmg, !!ud.head, h.point);
          this.shotsHit++;
          FX.sparks(h.point, 0xffb066, 6, 5, 0.4, 0.05);
        } else {
          FX.sparks(h.point, 0x9fb4cc, 5, 4, 0.3, 0.04);
        }
      }
      FX.tracer(muzzlePos, end, d.tracer);
    }
  },

  update(dt, input) {
    const d = this.def();
    const a = this.ammo[this.current];

    this.fireTimer -= dt;
    this.sprintBlock = Math.max(0, this.sprintBlock - dt);
    this.bloom = Math.max(0, this.bloom - dt * 0.06);
    this.camRecoilX += (0 - this.camRecoilX) * Math.min(1, dt * 9);
    this.camRecoilY += (0 - this.camRecoilY) * Math.min(1, dt * 9);
    this.gunKick += (0 - this.gunKick) * Math.min(1, dt * 10);
    this.flashT -= dt;
    this.flashMesh.visible = this.flashT > 0;
    this.flashLight.intensity = this.flashT > 0 ? 2.6 : 0;

    // ADS
    const wantAds = input.ads && !this.reloading && this.switchT <= 0 && Player.alive && !Player.sprinting;
    this.adsAmount += ((wantAds ? 1 : 0) - this.adsAmount) * Math.min(1, dt * 11);

    // weapon switching
    if (this.switchT > 0) {
      this.switchT -= dt;
      if (this.pendingSwitch && this.switchT <= 0.14) {
        this.current = this.pendingSwitch;
        this.pendingSwitch = null;
        this.buildModel(this.current);
      }
      if (this.switchT <= 0) this.switchT = 0;
    }

    // reloading
    if (this.reloading) {
      this.reloadT += dt;
      if (!this.reloadMidPlayed && this.reloadT > d.reloadTime * 0.6) {
        this.reloadMidPlayed = true;
        AudioSys.reload(1);
      }
      if (this.reloadT >= d.reloadTime) {
        const need = d.magSize - a.mag;
        const take = Math.min(need, a.reserve);
        a.mag += take;
        a.reserve -= take;
        this.reloading = false;
      }
    }

    // firing input
    if (input.attackPressed) {
      this.tryFire();
      input.attackPressed = false;
    } else if (input.attack && d.auto) {
      this.tryFire();
    }

    // ---- viewmodel pose ----
    const ads = this.adsAmount;
    let px = THREE.MathUtils.lerp(d.hipPos.x, d.adsPos.x, ads);
    let py = THREE.MathUtils.lerp(d.hipPos.y, d.adsPos.y, ads);
    let pz = THREE.MathUtils.lerp(d.hipPos.z, d.adsPos.z, ads);

    // sway from look input
    const targetSwayX = THREE.MathUtils.clamp(-input.lookDX * 0.0022, -0.05, 0.05);
    const targetSwayY = THREE.MathUtils.clamp(input.lookDY * 0.0018, -0.04, 0.04);
    this.swayX += (targetSwayX - this.swayX) * Math.min(1, dt * 9);
    this.swayY += (targetSwayY - this.swayY) * Math.min(1, dt * 9);
    px += this.swayX * (1 - ads * 0.85);
    py += this.swayY * (1 - ads * 0.85);

    // bob follows the player's head bob, opposed slightly
    px += Player.bobX * 0.35 * (1 - ads);
    py -= Player.bobY * 0.45 * (1 - ads);

    // kick pushes the gun back toward the camera
    pz += this.gunKick;

    let rx = this.gunKick * 1.6 + this.swayY * 1.2;
    let ry = this.swayX * 1.4;
    let rz = 0;

    // sprint pose: gun tilts across the body
    const sp = Player.sprintAmount * (1 - ads);
    py -= 0.07 * sp;
    px -= 0.03 * sp;
    rx -= 0.25 * sp;
    ry += 0.55 * sp;
    rz += 0.12 * sp;

    // reload dip
    if (this.reloading) {
      const k = Math.sin(Math.min(1, this.reloadT / d.reloadTime) * Math.PI);
      py -= 0.13 * k;
      rx -= 0.55 * k;
      rz += 0.2 * k;
    }

    // switch lower/raise
    if (this.switchT > 0) {
      const k = Math.sin((this.switchT / 0.28) * Math.PI);
      py -= 0.2 * k;
      rx -= 0.7 * k;
    }

    this.model.position.set(px, py, pz);
    this.model.rotation.set(rx, ry, rz);

    // FOV: sprint widens, ADS narrows
    const baseFov = 74 + 8 * Player.sprintAmount;
    const targetFov = THREE.MathUtils.lerp(baseFov, d.adsFov, ads);
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 10);
      this.camera.updateProjectionMatrix();
    }
  },

  addReserve(amounts) {
    for (const k of this.order) {
      if (amounts[k]) this.ammo[k].reserve += amounts[k];
    }
  },
};
