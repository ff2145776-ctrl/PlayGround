const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hud = {
  cash: document.getElementById('cashValue'),
  health: document.getElementById('healthValue'),
  heat: document.getElementById('heatValue'),
  mission: document.getElementById('missionText'),
  message: document.getElementById('messageBox'),
};

const WORLD = { width: 2200, height: 1400 };
const PLAYER_RADIUS = 18;
const PLAYER_SPEED = 220;
const MISSION_SPOTS = [
  { x: 430, y: 350, label: 'Downtown cash stash' },
  { x: 980, y: 470, label: 'Harbor pickup' },
  { x: 1530, y: 800, label: 'Grove jackpot' },
  { x: 1750, y: 1150, label: 'Airport drop' }
];
const BUILDINGS = [
  { x: 260, y: 250, w: 240, h: 200 },
  { x: 690, y: 215, w: 320, h: 180 },
  { x: 1120, y: 260, w: 230, h: 260 },
  { x: 1500, y: 220, w: 280, h: 150 },
  { x: 380, y: 720, w: 240, h: 240 },
  { x: 850, y: 670, w: 320, h: 220 },
  { x: 1340, y: 760, w: 240, h: 260 },
  { x: 1750, y: 640, w: 260, h: 210 },
  { x: 730, y: 1040, w: 260, h: 180 },
  { x: 1270, y: 1060, w: 250, h: 220 },
];
const COPS = [
  { x: 300, y: 930, dir: 1, speed: 90 },
  { x: 1640, y: 380, dir: -1, speed: 70 },
  { x: 900, y: 1120, dir: 1, speed: 80 },
];
const PICKUPS = [
  { x: 430, y: 350, r: 18, value: 150 },
  { x: 980, y: 470, r: 18, value: 220 },
  { x: 1530, y: 800, r: 18, value: 280 },
  { x: 1750, y: 1150, r: 18, value: 350 },
  { x: 720, y: 860, r: 18, value: 180 },
  { x: 1480, y: 1180, r: 18, value: 200 },
];

const state = {
  player: { x: 200, y: 1040, vx: 0, vy: 0 },
  camera: { x: 0, y: 0 },
  cash: 0,
  health: 100,
  heat: 0,
  missionIndex: 0,
  missed: 0,
  lastMessage: 0,
  keys: { up: false, down: false, left: false, right: false },
  touch: { up: false, down: false, left: false, right: false },
  lastTime: 0,
  missionReached: false,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rectCircleCollision(cx, cy, r, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

function isBlocked(x, y) {
  if (x < PLAYER_RADIUS || x > WORLD.width - PLAYER_RADIUS || y < PLAYER_RADIUS || y > WORLD.height - PLAYER_RADIUS) {
    return true;
  }

  for (const building of BUILDINGS) {
    if (rectCircleCollision(x, y, PLAYER_RADIUS, building)) {
      return true;
    }
  }

  return false;
}

function updateMovement(dt) {
  let dirX = 0;
  let dirY = 0;

  const active = state.keys;
  if (active.up || state.touch.up) dirY -= 1;
  if (active.down || state.touch.down) dirY += 1;
  if (active.left || state.touch.left) dirX -= 1;
  if (active.right || state.touch.right) dirX += 1;

  const len = Math.hypot(dirX, dirY) || 1;
  dirX /= len;
  dirY /= len;

  const nextX = state.player.x + dirX * PLAYER_SPEED * dt;
  const nextY = state.player.y + dirY * PLAYER_SPEED * dt;

  if (!isBlocked(nextX, state.player.y)) {
    state.player.x = nextX;
  }
  if (!isBlocked(state.player.x, nextY)) {
    state.player.y = nextY;
  }

  state.camera.x = clamp(state.player.x - canvas.width / 2, 0, WORLD.width - canvas.width);
  state.camera.y = clamp(state.player.y - canvas.height / 2, 0, WORLD.height - canvas.height);
}

function updateCops(dt) {
  for (const cop of COPS) {
    cop.x += cop.dir * cop.speed * dt;
    if (cop.x < 260 || cop.x > 1900) {
      cop.dir *= -1;
      cop.x = clamp(cop.x, 260, 1900);
    }
  }

  const player = state.player;
  for (const cop of COPS) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 80) {
      state.health = clamp(state.health - 18 * dt, 0, 100);
      state.heat = clamp(state.heat + 12 * dt, 0, 100);
      if (state.health <= 0) {
        state.health = 100;
        state.cash = Math.max(0, state.cash - 200);
        state.player.x = 200;
        state.player.y = 1040;
        showMessage('You were busted. Back to the start!', '#ff6b6b');
      }
    }
  }
}

function updatePickups() {
  const player = state.player;
  for (let i = PICKUPS.length - 1; i >= 0; i--) {
    const pickup = PICKUPS[i];
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    if (Math.hypot(dx, dy) < 34) {
      state.cash += pickup.value;
      PICKUPS.splice(i, 1);
      showMessage(`Cash pickup +$${pickup.value}!`, '#7ef29a');
      state.heat = clamp(state.heat + 10, 0, 100);
      if (PICKUPS.length === 0) {
        state.heat = 0;
        state.missionIndex = MISSION_SPOTS.length;
      }
    }
  }
}

function updateMission() {
  if (PICKUPS.length > 0) {
    const target = MISSION_SPOTS[state.missionIndex % MISSION_SPOTS.length];
    const player = state.player;
    const dx = player.x - target.x;
    const dy = player.y - target.y;
    if (Math.hypot(dx, dy) < 50) {
      state.missionIndex += 1;
      state.missionReached = true;
      showMessage(`Mission complete: ${target.label}!`, '#ffd166');
    }
  }

  if (state.missionIndex >= MISSION_SPOTS.length && PICKUPS.length === 0) {
    hud.mission.textContent = 'Mission: Escape city';
    if (state.player.x > WORLD.width - 250 && state.player.y > WORLD.height - 250) {
      state.cash += 500;
      showMessage('You escaped the city with the loot!', '#6ce37c');
      state.player.x = 200;
      state.player.y = 1040;
      state.heat = 0;
      PICKUPS.push(...[
        { x: 430, y: 350, r: 18, value: 150 },
        { x: 980, y: 470, r: 18, value: 220 },
        { x: 1530, y: 800, r: 18, value: 280 },
        { x: 1750, y: 1150, r: 18, value: 350 },
      ]);
      state.missionIndex = 0;
    }
  } else {
    const currentTarget = MISSION_SPOTS[state.missionIndex % MISSION_SPOTS.length];
    hud.mission.textContent = `Mission: ${currentTarget.label}`;
  }
}

function showMessage(text, color) {
  hud.message.textContent = text;
  hud.message.style.color = color;
  hud.message.style.borderColor = color + '80';
  hud.message.style.boxShadow = `0 0 0 1px ${color}60, 0 12px 18px rgba(0,0,0,0.25)`;
}

function updateHUD() {
  hud.cash.textContent = `$${state.cash}`;
  hud.health.textContent = `${Math.ceil(state.health)}%`;
  hud.heat.textContent = `${Math.ceil(state.heat)}`;
}

function drawBackground() {
  ctx.fillStyle = '#4d9a5f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#3c7f4f';
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.38);

  ctx.fillStyle = '#a8d4e6';
  ctx.fillRect(0, canvas.height * 0.38, canvas.width, canvas.height * 0.18);

  ctx.fillStyle = '#5a6a74';
  ctx.fillRect(0, canvas.height * 0.56, canvas.width, canvas.height * 0.44);

  // roads
  ctx.fillStyle = '#3c4349';
  ctx.fillRect(0, canvas.height * 0.45, canvas.width, 40);
  ctx.fillRect(canvas.width * 0.2, 0, 40, canvas.height);
  ctx.fillRect(canvas.width * 0.56, 0, 40, canvas.height);
  ctx.fillRect(canvas.width * 0.82, 0, 40, canvas.height);

  // lane markers
  ctx.strokeStyle = '#f3df6d';
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.45 + 20);
  ctx.lineTo(canvas.width, canvas.height * 0.45 + 20);
  ctx.moveTo(canvas.width * 0.2 + 20, 0);
  ctx.lineTo(canvas.width * 0.2 + 20, canvas.height);
  ctx.moveTo(canvas.width * 0.56 + 20, 0);
  ctx.lineTo(canvas.width * 0.56 + 20, canvas.height);
  ctx.moveTo(canvas.width * 0.82 + 20, 0);
  ctx.lineTo(canvas.width * 0.82 + 20, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawWorld() {
  const camX = state.camera.x;
  const camY = state.camera.y;

  for (const building of BUILDINGS) {
    const x = building.x - camX;
    const y = building.y - camY;
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(x, y, building.w, building.h);
    ctx.fillStyle = '#95a1ac';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.fillRect(x + 18 + col * 52, y + 18 + row * 48, 22, 26);
      }
    }
  }

  for (const cop of COPS) {
    const x = cop.x - camX;
    const y = cop.y - camY;
    ctx.fillStyle = '#1f5ac4';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9f0ff';
    ctx.fillRect(x - 4, y - 16, 8, 12);
  }

  for (const pickup of PICKUPS) {
    const x = pickup.x - camX;
    const y = pickup.y - camY;
    ctx.fillStyle = '#f9d64a';
    ctx.beginPath();
    ctx.arc(x, y, pickup.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#542e00';
    ctx.fillRect(x - 2, y - pickup.r - 8, 4, 8);
  }

  const pX = state.player.x - camX;
  const pY = state.player.y - camY;
  ctx.fillStyle = '#f45b69';
  ctx.beginPath();
  ctx.arc(pX, pY, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pX - 5, pY - 6, 10, 10);

  // objective marker
  if (PICKUPS.length > 0) {
    const target = MISSION_SPOTS[state.missionIndex % MISSION_SPOTS.length];
    const tx = target.x - camX;
    const ty = target.y - camY;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx, ty - 18);
    ctx.lineTo(tx + 10, ty - 30);
    ctx.lineTo(tx - 10, ty - 30);
    ctx.closePath();
    ctx.stroke();
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawWorld();
}

function update(dt) {
  updateMovement(dt);
  updateCops(dt);
  updatePickups();
  updateMission();
  updateHUD();
}

let lastTimestamp = 0;
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000 || 0.016, 0.033);
  lastTimestamp = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function bindKeyboard() {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') state.keys.up = true;
    if (key === 's' || key === 'arrowdown') state.keys.down = true;
    if (key === 'a' || key === 'arrowleft') state.keys.left = true;
    if (key === 'd' || key === 'arrowright') state.keys.right = true;
  });

  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') state.keys.up = false;
    if (key === 's' || key === 'arrowdown') state.keys.down = false;
    if (key === 'a' || key === 'arrowleft') state.keys.left = false;
    if (key === 'd' || key === 'arrowright') state.keys.right = false;
  });
}

function bindTouchControls() {
  const buttons = document.querySelectorAll('[data-touch]');
  buttons.forEach((button) => {
    const key = button.dataset.touch;
    const set = (active) => {
      state.touch[key] = active;
      button.classList.toggle('active', active);
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      set(true);
    });
    button.addEventListener('pointerup', () => set(false));
    button.addEventListener('pointerleave', () => set(false));
    button.addEventListener('pointercancel', () => set(false));
  });
}

function resizeCanvas() {
  const shell = document.getElementById('gameShell');
  const ratio = window.devicePixelRatio || 1;
  const w = shell.clientWidth;
  const h = shell.clientHeight;
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (canvas.width && canvas.height) {
    state.camera.x = clamp(state.player.x - canvas.width / (2 * ratio), 0, WORLD.width - canvas.width / ratio);
    state.camera.y = clamp(state.player.y - canvas.height / (2 * ratio), 0, WORLD.height - canvas.height / ratio);
  }
}

bindKeyboard();
bindTouchControls();
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
showMessage('Cruise the city and get the cash.', '#dfeaf7');
requestAnimationFrame(loop);
