// ============================================================
// main.js — bootstrap, input, UI, state machine, game loop
// ============================================================
let scene, camera, renderer, clock;

const Input = {
  keys: {},
  attack: false,
  attackPressed: false,
  ads: false,
  lookDX: 0,
  lookDY: 0,
};

// ------------------------------------------------------------
// UI
// ------------------------------------------------------------
const UI = {
  el: {},
  hitT: 0,
  dmgT: 0,
  bannerTimeout: null,

  init() {
    const ids = [
      'hud', 'crosshair', 'hitmarker', 'reload-wrap', 'reload-bar',
      'wave-num', 'enemies-num', 'score-num', 'hp-num', 'hp-fill',
      'weapon-name', 'ammo', 'ammo-mag', 'ammo-reserve', 'killfeed',
      'banner', 'banner-title', 'banner-sub', 'damage-flash', 'lowhp-vignette',
      'menu', 'pause', 'gameover', 'go-stats',
    ];
    for (const id of ids) this.el[id] = document.getElementById(id);
  },

  hitmarker(head) {
    this.hitT = head ? 0.28 : 0.16;
    this.el['hitmarker'].classList.toggle('head', !!head);
  },

  damageFlash(intensity) {
    this.dmgT = Math.max(this.dmgT, intensity);
  },

  killfeed(text, cls) {
    const kf = this.el['killfeed'];
    const div = document.createElement('div');
    div.className = 'kf' + (cls ? ' ' + cls : '');
    div.textContent = text;
    kf.insertBefore(div, kf.firstChild);
    while (kf.children.length > 6) kf.removeChild(kf.lastChild);
    setTimeout(() => div.classList.add('out'), 2300);
    setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 2900);
  },

  banner(title, sub, ms) {
    const b = this.el['banner'];
    this.el['banner-title'].textContent = title;
    this.el['banner-sub'].textContent = sub || '';
    b.classList.remove('hidden');
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => b.classList.add('hidden'), ms || 2000);
  },

  frame(dt) {
    // hitmarker fade
    this.hitT = Math.max(0, this.hitT - dt);
    this.el['hitmarker'].style.opacity = Math.min(1, this.hitT * 8);
    // damage flash fade
    this.dmgT = Math.max(0, this.dmgT - dt * 1.6);
    this.el['damage-flash'].style.opacity = this.dmgT;
    // persistent low-hp vignette with pulse
    const lowK = Player.hp < 35 ? (1 - Player.hp / 35) : 0;
    this.el['lowhp-vignette'].style.opacity =
      lowK > 0 ? (0.45 + 0.25 * Math.sin(performance.now() * 0.006)) * lowK : 0;

    if (Main.state !== 'playing') return;

    // crosshair spread
    const ads = Weapons.adsAmount;
    const px = THREE.MathUtils.clamp(Weapons.spreadNow() * 1500 * (1 - ads * 0.6), 3, 42);
    this.el['crosshair'].style.setProperty('--sp', px + 'px');
    this.el['crosshair'].querySelectorAll('.ch-line').forEach(l => {
      l.style.opacity = ads > 0.7 ? 0.15 : 1;
    });

    // reload bar
    if (Weapons.reloading) {
      this.el['reload-wrap'].style.display = 'block';
      this.el['reload-bar'].style.width =
        Math.min(100, (Weapons.reloadT / Weapons.def().reloadTime) * 100) + '%';
    } else {
      this.el['reload-wrap'].style.display = 'none';
    }

    // stats
    const hp = Math.max(0, Math.ceil(Player.hp));
    this.el['hp-num'].textContent = hp;
    this.el['hp-fill'].style.width = (hp / Player.maxHp) * 100 + '%';
    this.el['hp-num'].style.color = hp < 35 ? '#ff5a5a' : '#7dffa8';

    const a = Weapons.ammo[Weapons.current];
    this.el['weapon-name'].textContent = Weapons.def().name;
    this.el['ammo-mag'].textContent = a.mag;
    this.el['ammo-reserve'].textContent = a.reserve;
    this.el['ammo'].classList.toggle('low', a.mag <= Weapons.def().magSize * 0.25);

    this.el['wave-num'].textContent = Enemies.wave || '—';
    this.el['enemies-num'].textContent = Enemies.totalRemaining();
    this.el['score-num'].textContent = Main.score;
  },
};

// ------------------------------------------------------------
// Main game controller
// ------------------------------------------------------------
const Main = {
  state: 'menu', // menu | playing | paused | gameover
  score: 0,
  kills: 0,
  headshots: 0,
  sens: 0.0021,
  startTime: 0,

  addScore(points, label, cls) {
    this.score += points;
    UI.killfeed('+' + points + '  ' + label, cls);
  },

  requestLock() {
    AudioSys.ensure();
    renderer.domElement.requestPointerLock();
  },

  beginGame() {
    this.state = 'playing';
    this.startTime = performance.now();
    UI.el['menu'].classList.add('hidden');
    UI.el['hud'].classList.remove('hidden');
    Enemies.begin();
  },

  gameOver() {
    this.state = 'gameover';
    document.exitPointerLock();
    const acc = Weapons.shotsFired > 0
      ? Math.round((Weapons.shotsHit / Weapons.shotsFired) * 100) : 0;
    const mins = Math.floor((performance.now() - this.startTime) / 60000);
    const secs = Math.floor(((performance.now() - this.startTime) / 1000) % 60);
    const wavesSurvived = Math.max(0, Enemies.state === 'active' ? Enemies.wave - 1 : Enemies.wave);
    UI.el['go-stats'].innerHTML =
      'FINAL SCORE <b>' + this.score + '</b><br>' +
      'WAVES SURVIVED <b>' + wavesSurvived + '</b> · ' +
      'KILLS <b>' + this.kills + '</b><br>' +
      'HEADSHOTS <b>' + this.headshots + '</b> · ' +
      'ACCURACY <b>' + acc + '%</b> · ' +
      'TIME <b>' + mins + ':' + String(secs).padStart(2, '0') + '</b>';
    UI.el['gameover'].classList.remove('hidden');
  },
};

// ------------------------------------------------------------
// bootstrap
// ------------------------------------------------------------
function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f16);
  scene.fog = new THREE.Fog(0x0b0f16, 55, 130);

  camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 300);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  UI.init();
  World.build(scene);
  Weapons.init(camera);
  Enemies.init(scene);

  clock = new THREE.Clock();
  bindEvents();
  animate();
}

function bindEvents() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // sensitivity slider
  const slider = document.getElementById('sens-slider');
  const sensVal = document.getElementById('sens-val');
  const saved = localStorage.getItem('steelsurge_sens');
  if (saved) slider.value = saved;
  const applySens = () => {
    sensVal.textContent = slider.value;
    Main.sens = slider.value * 0.00042;
    localStorage.setItem('steelsurge_sens', slider.value);
  };
  slider.addEventListener('input', applySens);
  applySens();

  document.getElementById('play-btn').addEventListener('click', () => Main.requestLock());
  document.getElementById('resume-btn').addEventListener('click', () => Main.requestLock());
  document.getElementById('restart-btn').addEventListener('click', () => location.reload());

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    if (locked) {
      if (Main.state === 'menu') Main.beginGame();
      else if (Main.state === 'paused') {
        Main.state = 'playing';
        UI.el['pause'].classList.add('hidden');
      }
    } else if (Main.state === 'playing') {
      Main.state = 'paused';
      UI.el['pause'].classList.remove('hidden');
      Input.attack = false;
      Input.ads = false;
      Input.keys = {};
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (Main.state !== 'playing' || document.pointerLockElement !== renderer.domElement) return;
    Player.yaw -= e.movementX * Main.sens;
    Player.pitch = THREE.MathUtils.clamp(Player.pitch - e.movementY * Main.sens, -1.55, 1.55);
    Input.lookDX += e.movementX;
    Input.lookDY += e.movementY;
  });

  document.addEventListener('mousedown', (e) => {
    if (Main.state !== 'playing' || document.pointerLockElement !== renderer.domElement) return;
    if (e.button === 0) { Input.attack = true; Input.attackPressed = true; }
    if (e.button === 2) Input.ads = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) Input.attack = false;
    if (e.button === 2) Input.ads = false;
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('wheel', (e) => {
    if (Main.state !== 'playing') return;
    Weapons.cycle(e.deltaY > 0 ? 1 : -1);
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    Input.keys[e.code] = true;
    if (Main.state !== 'playing') return;
    if (e.code === 'KeyR') Weapons.startReload();
    if (e.code === 'Digit1') Weapons.switchTo('rifle');
    if (e.code === 'Digit2') Weapons.switchTo('pistol');
    if (e.code === 'Digit3') Weapons.switchTo('shotgun');
  });
  document.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { Input.keys = {}; Input.attack = false; Input.ads = false; });
}

function updateCamera() {
  camera.rotation.y = Player.yaw;
  camera.rotation.x = THREE.MathUtils.clamp(Player.pitch + Weapons.camRecoilX, -1.56, 1.58);
  camera.rotation.z = Weapons.camRecoilY * 0.5;

  const cy = Math.cos(Player.yaw), sy = Math.sin(Player.yaw);
  let x = Player.pos.x + cy * Player.bobX; // lateral bob along the right vector
  let y = Player.pos.y + Player.eyeHeight() + Player.bobY;
  let z = Player.pos.z - sy * Player.bobX;

  if (FX.shake > 0.001) {
    const s = FX.shake * 0.05;
    x += (Math.random() - 0.5) * s;
    y += (Math.random() - 0.5) * s;
    z += (Math.random() - 0.5) * s;
  }
  camera.position.set(x, y, z);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (Main.state === 'playing') {
    Player.update(dt, Input);
    updateCamera();
    Weapons.update(dt, Input);
    Enemies.update(dt);
  } else {
    updateCamera();
  }

  FX.update(dt);
  UI.frame(dt);
  Input.lookDX = 0;
  Input.lookDY = 0;

  renderer.render(scene, camera);
}

init();
