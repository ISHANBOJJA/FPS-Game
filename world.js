// ============================================================
// world.js — arena geometry, static colliders, particle FX
// ============================================================
const World = {
  colliders: [],    // { minX, maxX, minY, maxY, minZ, maxZ }
  solidMeshes: [],  // raycast targets for bullets / line of sight
  spawnPoints: [],
  scene: null,

  build(scene) {
    this.scene = scene;

    // ---- floor with procedural grid texture ----
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g2 = cv.getContext('2d');
    g2.fillStyle = '#161b24';
    g2.fillRect(0, 0, 256, 256);
    g2.strokeStyle = '#232c3c';
    g2.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) {
      g2.beginPath(); g2.moveTo(i, 0); g2.lineTo(i, 256); g2.stroke();
      g2.beginPath(); g2.moveTo(0, i); g2.lineTo(256, i); g2.stroke();
    }
    g2.fillStyle = '#2c3850';
    g2.fillRect(0, 0, 4, 4);
    const floorTex = new THREE.CanvasTexture(cv);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(30, 30);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 130),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    this.solidMeshes.push(floor);

    // ---- lighting ----
    scene.add(new THREE.HemisphereLight(0x8fa8cc, 0x2a3040, 0.75));
    const sun = new THREE.DirectionalLight(0xffeedd, 0.85);
    sun.position.set(35, 60, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
    sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    // ---- helper to place a solid box (mesh + collider) ----
    const addBox = (x, z, w, h, d, color, opts = {}) => {
      const y = opts.y || 0;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: opts.rough !== undefined ? opts.rough : 0.8, metalness: 0.25 })
      );
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.solidMeshes.push(mesh);
      this.colliders.push({
        minX: x - w / 2, maxX: x + w / 2,
        minY: y, maxY: y + h,
        minZ: z - d / 2, maxZ: z + d / 2,
      });
      return mesh;
    };

    // ---- perimeter walls (arena is ±42) ----
    const wallC = 0x222a38;
    addBox(0, -43, 88, 6, 2, wallC, { rough: 0.9 });
    addBox(0, 43, 88, 6, 2, wallC, { rough: 0.9 });
    addBox(-43, 0, 2, 6, 88, wallC, { rough: 0.9 });
    addBox(43, 0, 2, 6, 88, wallC, { rough: 0.9 });

    // glowing accent strips along the inner walls (visual only)
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x2bd4ff });
    const stripGeoH = new THREE.BoxGeometry(84, 0.14, 0.08);
    const stripGeoV = new THREE.BoxGeometry(0.08, 0.14, 84);
    for (const [x, z, geo] of [[0, -41.9, stripGeoH], [0, 41.9, stripGeoH], [-41.9, 0, stripGeoV], [41.9, 0, stripGeoV]]) {
      const s = new THREE.Mesh(geo, stripMat);
      s.position.set(x, 2.6, z);
      scene.add(s);
    }

    // ---- central monolith landmark ----
    addBox(0, 0, 5, 3.4, 5, 0x2b3242, { rough: 0.6 });
    const ring = new THREE.Mesh(
      new THREE.BoxGeometry(5.15, 0.18, 5.15),
      new THREE.MeshBasicMaterial({ color: 0x2bd4ff })
    );
    ring.position.set(0, 2.9, 0);
    scene.add(ring);

    // ---- cover crates (deterministic layout) ----
    const crateColors = [0x3a4150, 0x424a3d, 0x4a4038];
    const crates = [
      [10, -8, 2.6], [12.7, -7.3, 2.6], [11.3, -7.7, 2.6, 2.6],
      [-12, -10, 3], [-9, 9, 2.2], [-11.4, 9.7, 2.2],
      [14, 12, 2.8], [0, -16, 3.4], [-18, 1, 2.4], [-18, 1, 2.4, 2.4],
      [18, -2, 2.2], [6, 18, 2.6], [8.8, 18.5, 2.6],
      [-6, -22, 2.4], [22, 8, 3], [-22, -8, 3],
      [-2, 24, 2.8], [24, -18, 2.6], [-24, 16, 2.4],
      [16, -22, 2.4], [-16, 22, 2.6], [26, 24, 2.8], [-27, -24, 2.8],
    ];
    crates.forEach(([x, z, s, y], i) => {
      addBox(x, z, s, s, s, crateColors[i % 3], { y: y || 0 });
    });

    // ---- corner pillars with glowing caps ----
    for (const [x, z] of [[28, 28], [-28, 28], [28, -28], [-28, -28]]) {
      addBox(x, z, 2.2, 7, 2.2, 0x2b3242, { rough: 0.55 });
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.2, 2.4),
        new THREE.MeshBasicMaterial({ color: 0xff9540 })
      );
      cap.position.set(x, 7.15, z);
      scene.add(cap);
    }

    // ---- low barriers ----
    addBox(0, 30, 8, 1.3, 1, 0x374052);
    addBox(0, -30, 8, 1.3, 1, 0x374052);
    addBox(30, 0, 1, 1.3, 8, 0x374052);
    addBox(-30, 0, 1, 1.3, 8, 0x374052);

    // ---- enemy spawn points ----
    this.spawnPoints = [
      new THREE.Vector3(36, 0, 36), new THREE.Vector3(-36, 0, 36),
      new THREE.Vector3(36, 0, -36), new THREE.Vector3(-36, 0, -36),
      new THREE.Vector3(0, 0, 38), new THREE.Vector3(0, 0, -38),
      new THREE.Vector3(38, 0, 0), new THREE.Vector3(-38, 0, 0),
    ];

    FX.init(scene);
  },

  // circle (x,z,r) vs collider AABB in the XZ plane
  circleHitsBox(x, z, r, c) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx, dz = z - cz;
    return dx * dx + dz * dz < r * r;
  },

  pointInAnyBox(p) {
    for (const c of this.colliders) {
      if (p.x > c.minX && p.x < c.maxX && p.y > c.minY && p.y < c.maxY && p.z > c.minZ && p.z < c.maxZ) return true;
    }
    return false;
  },
};

// ============================================================
// FX — short-lived particles, tracers, spawn beams, cam shake
// ============================================================
const FX = {
  items: [],
  scene: null,
  shake: 0,
  _sparkGeo: null,
  _tracerGeo: null,

  init(scene) {
    this.scene = scene;
    this._sparkGeo = new THREE.BoxGeometry(1, 1, 1);
    this._tracerGeo = new THREE.BoxGeometry(0.025, 0.025, 1);
  },

  addShake(a) { this.shake = Math.min(this.shake + a, 0.5); },

  sparks(pos, color, count = 8, speed = 5, life = 0.4, size = 0.05, gravity = 12) {
    if (this.items.length > 380) return;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const m = new THREE.Mesh(this._sparkGeo, mat);
      const s = size * (0.6 + Math.random() * 0.8);
      m.scale.set(s, s, s);
      m.position.copy(pos);
      this.scene.add(m);
      this.items.push({
        mesh: m, mat, gravity,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 2 * speed,
          Math.random() * speed * 0.9,
          (Math.random() - 0.5) * 2 * speed
        ),
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
      });
    }
  },

  tracer(from, to, color) {
    if (this.items.length > 380) return;
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const m = new THREE.Mesh(this._tracerGeo, mat);
    m.scale.z = len;
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.lookAt(to);
    this.scene.add(m);
    this.items.push({ mesh: m, mat, vel: null, life: 0.07, maxLife: 0.07, gravity: 0 });
  },

  spawnBeam(pos, color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
    const m = new THREE.Mesh(this._sparkGeo, mat);
    m.scale.set(0.9, 6, 0.9);
    m.position.set(pos.x, 3, pos.z);
    this.scene.add(m);
    this.items.push({ mesh: m, mat, vel: null, life: 0.45, maxLife: 0.45, gravity: 0, beam: true });
  },

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.scene.remove(it.mesh);
        it.mat.dispose();
        this.items.splice(i, 1);
        continue;
      }
      const t = it.life / it.maxLife;
      it.mat.opacity = t;
      if (it.vel) {
        it.vel.y -= it.gravity * dt;
        it.mesh.position.addScaledVector(it.vel, dt);
      }
      if (it.beam) {
        it.mesh.scale.x = 0.9 * t;
        it.mesh.scale.z = 0.9 * t;
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
  },
};
