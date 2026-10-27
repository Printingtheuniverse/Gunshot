const socket = io();
let roomId = null;
let playerId = null;
let keys = {};
let players = [];
let currentState = "voting";
let myTeam = 0;
const teamColors = ["#4da3ff","#ff5c5c","#4ddc88","#ffd34d"];

const $ = id => document.getElementById(id);
const show = id => document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === id));

function name() {
  return ($("playerName").value.trim() || "Player").slice(0,18);
}


const characters = [
  { name: "NOVA", description: "Fast feet. Big energy. Ready to explore.", className: "avatar-nova" },
  { name: "BOLT", description: "Bright ideas. Bold moves. Always curious.", className: "avatar-bolt" },
  { name: "MOSS", description: "Calm under pressure. A friend to every team.", className: "avatar-moss" }
];
let selectedCharacter = 0;
let selectedAvatarColor = "#63e6ff";

function selectCharacter(index) {
  selectedCharacter = (index + characters.length) % characters.length;
  const character = characters[selectedCharacter];
  $("characterName").textContent = character.name;
  $("characterDescription").textContent = character.description;
  $("characterCount").textContent = String(selectedCharacter + 1).padStart(2, "0") + " / " + String(characters.length).padStart(2, "0");
  $("avatarFigure").className = "avatar-figure " + character.className;
  document.querySelectorAll(".character-dots .dot").forEach((dot, i) => dot.classList.toggle("active", i === selectedCharacter));
  $("miniAvatar").textContent = character.name.charAt(0);
}

function changeCharacter(direction) {
  selectCharacter(selectedCharacter + direction);
}

function setAvatarColor(color, button) {
  selectedAvatarColor = color;
  document.documentElement.style.setProperty("--avatar-accent", color);
  document.querySelectorAll(".swatch").forEach(swatch => swatch.classList.toggle("active", swatch === button));
  const names = { "#63e6ff": "Neon cyan", "#a78bfa": "Violet pulse", "#ffad66": "Solar orange", "#8be0a2": "Mint glow" };
  $("styleSummary").textContent = names[color] || "Custom color";
}

document.addEventListener("input", event => {
  if (event.target && event.target.id === "playerName") {
    const value = event.target.value.trim();
    $("profileNamePreview").textContent = (value || "ARENA EXPLORER").toUpperCase().slice(0, 18);
    $("miniAvatar").textContent = (value || "A").charAt(0).toUpperCase();
  }
});

function showServers() {
  if (!name()) return;
  show("servers");
}

function createServer() {
  socket.emit("createRoom", {name: name()});
}

function joinByCode() {
  socket.emit("joinRoom", {id: $("roomCode").value.trim(), name: name()});
}

socket.on("connect", () => playerId = socket.id);

socket.on("rooms", rooms => {
  $("serverList").innerHTML = rooms.length ? rooms.map(r => `
    <div class="server">
      <span><b>${r.id}</b> — ${r.players}/${r.maxPlayers} players</span>
      <button onclick="joinRoom('${r.id}')">JOIN</button>
    </div>`).join("") : "<p>No servers yet. Create the first one!</p>";
});

function joinRoom(id) {
  socket.emit("joinRoom", {id, name:name()});
}

socket.on("joinedRoom", data => {
  roomId = data.id;
  $("lobbyCode").textContent = roomId;
  show("lobby");
});

socket.on("errorMessage", msg => alert(msg));

socket.on("lobbyState", state => {
  currentState = state.state;
  $("lobbyStatus").textContent =
    state.state === "voting" ? "Vote for the game mode and map, then ready up." :
    state.state === "countdown" ? "Match starting..." : "Match in progress";

  $("players").innerHTML = state.players.map(p => `
    <div class="vote">
      <span>${p.name}${p.id === playerId ? " (YOU)" : ""}</span>
      <span>Team ${p.team + 1} ${p.ready ? "✓" : ""}</span>
    </div>`).join("");

  renderVotes("modeVotes", state.modeVotes, ["2 Teams","Capture the Flag","Free For All","Team Elimination"], "voteMode");
  renderVotes("mapVotes", state.mapVotes, ["Battleground","Desert","Rocky Valley","Forest"], "voteMap");

  $("readyBtn").disabled = state.state !== "voting";
  $("readyBtn").textContent = state.players.find(p=>p.id===playerId)?.ready ? "NOT READY" : "READY";

  if (state.state === "countdown") {
    $("countdown").classList.remove("hidden");
    $("countdown").textContent = state.countdown;
  } else {
    $("countdown").classList.add("hidden");
  }

  if (state.state === "playing") {
    $("matchTitle").textContent = `${state.mode} — ${state.map}`;
    renderScores(state.scores);
    show("game");
  }
});

function renderVotes(id, votes, options, eventName) {
  $(id).innerHTML = options.map(o => `
    <div class="vote">
      <span>${o} — ${votes[o] || 0} vote(s)</span>
      <button onclick="${eventName}(${JSON.stringify(o)})">VOTE</button>
    </div>`).join("");
}

function renderScores(scores) {
  $("scores").innerHTML = scores.map((s,i) =>
    `<span style="color:${teamColors[i]};margin-left:10px">T${i+1}: ${s}</span>`).join("");
}

function chooseTeam(team) {
  myTeam = team;
  socket.emit("chooseTeam", team);
}

function voteMode(mode) {
  socket.emit("voteMode", mode);
}

function voteMap(map) {
  socket.emit("voteMap", map);
}

function toggleReady() {
  socket.emit("ready");
}

const arena = $("arena");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x17212b);
scene.fog = new THREE.Fog(0x17212b, 48, 125);

const camera = new THREE.PerspectiveCamera(52, 800 / 500, 0.1, 220);
camera.position.set(0, 31, 38);
camera.lookAt(0, 0, 0);
// Reuse the canvas already present in index.html. Do not nest a canvas
// inside another canvas; that creates an invisible/zero-sized render surface.
const renderer = new THREE.WebGLRenderer({ canvas: arena, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.domElement.style.cssText =
  "display:block;width:100%;height:auto;border-radius:10px;cursor:crosshair";

scene.add(new THREE.HemisphereLight(0xc8d9e8, 0x52606b, 2.1));

const mainLight = new THREE.DirectionalLight(0xfff3df, 3.1);
mainLight.position.set(-8, 18, 10);
mainLight.castShadow = true;
scene.add(mainLight);

const blueLight = new THREE.PointLight(0x4a9ac7, 32, 48);
blueLight.position.set(-15, 5, -8);
scene.add(blueLight);

const redLight = new THREE.PointLight(0xc77969, 26, 48);
redLight.position.set(15, 5, 8);
scene.add(redLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 50),
  new THREE.MeshStandardMaterial({
    color: 0x53616b,
    metalness: 0.22,
    roughness: 0.82
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(80, 32, 0x607f91, 0x344956);
grid.position.y = 0.025;
scene.add(grid);

function addBox(x, y, z, sx, sy, sz, color, emissive = 0x000000) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.28,
      roughness: 0.62,
      emissive,
      emissiveIntensity: emissive === 0x000000 ? 0 : 0.28
    })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Arena walls and glowing trim
addBox(0, 2, -25, 80, 4, 1, 0x344653);
addBox(0, 2, 25, 80, 4, 1, 0x17263a);
addBox(-40, 2, 0, 1, 4, 50, 0x17263a);
addBox(40, 2, 0, 1, 4, 50, 0x17263a);
addBox(0, 3.8, -24.4, 78, 0.12, 0.12, 0x5a9cb5, 0x163847);
addBox(0, 3.8, 24.4, 78, 0.12, 0.12, 0xc77969, 0x3d201d);

// Cover crates
for (const [x, z] of [
  [-18, -10], [-8, 8], [8, -8], [18, 10],
  [-24, 5], [24, -5], [0, -16], [0, 16]
]) {
  addBox(x, 1.2, z, 3.5, 2.4, 3.5, 0x53636c);
  addBox(x, 2.43, z, 3.7, 0.12, 3.7, 0x7897a5, 0x152e3a);
}

const teamMaterials = teamColors.map(color =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.12,
    metalness: 0.45,
    roughness: 0.35
  })
);

const playerObjects = new Map();
const nameSprites = new Map();

function makePlayer(p) {
  const group = new THREE.Group();
  const material = teamMaterials[p.team] || teamMaterials[0];
  const dark = new THREE.MeshStandardMaterial({
    color: 0x3b4c59,
    metalness: 0.42,
    roughness: 0.48
  });

  function part(geometry, mat, x, y, z) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }

  part(new THREE.CapsuleGeometry(0.42, 0.7, 4, 8), dark, 0, 1.2, 0);
  part(new THREE.BoxGeometry(0.72, 0.62, 0.38), material, 0, 1.45, -0.05);
  part(new THREE.SphereGeometry(0.28, 16, 12), dark, 0, 2.05, 0);
  part(new THREE.BoxGeometry(0.42, 0.14, 0.18), material, 0, 2.06, 0.23);
  part(new THREE.CylinderGeometry(0.13, 0.17, 0.65, 8), dark, -0.52, 1.35, 0);
  part(new THREE.CylinderGeometry(0.13, 0.17, 0.65, 8), dark, 0.52, 1.35, 0);
  part(new THREE.CylinderGeometry(0.16, 0.18, 0.65, 8), dark, -0.2, 0.38, 0);
  part(new THREE.CylinderGeometry(0.16, 0.18, 0.65, 8), dark, 0.2, 0.38, 0);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.045, 8, 32),
    material
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  scene.add(group);
  playerObjects.set(p.id, group);
  return group;
}

function makeNameSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const c = canvas.getContext("2d");
  c.fillStyle = "rgba(5,10,25,0.8)";
  c.fillRect(0, 0, 256, 64);
  c.font = "bold 28px sans-serif";
  c.textAlign = "center";
  c.fillStyle = "#ffffff";
  c.fillText(String(text).slice(0, 18), 128, 42);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true })
  );
  sprite.scale.set(3.2, 0.8, 1);
  return sprite;
}

function updatePlayers() {
  const liveIds = new Set();

  for (const p of players) {
    liveIds.add(p.id);
    let model = playerObjects.get(p.id);
    if (!model) model = makePlayer(p);

    // Server coordinates remain 800 x 500, mapped onto the 3D floor.
    const x = (p.x - 400) * 0.075;
    const z = (p.y - 250) * 0.075;
    model.position.set(x, 0, z);

    const material = teamMaterials[p.team] || teamMaterials[0];
    model.children.forEach(child => {
      if (child.geometry.type === "TorusGeometry") child.material = material;
    });

    if (!nameSprites.has(p.id)) {
      const label = makeNameSprite(p.name || "Player");
      label.position.set(0, 3, 0);
      model.add(label);
      nameSprites.set(p.id, label);
    }

    // Face toward the current movement direction.
    if (p.id === playerId) {
      model.rotation.y = 0;
    }
  }

  for (const [id, model] of playerObjects) {
    if (!liveIds.has(id)) {
      scene.remove(model);
      playerObjects.delete(id);
      nameSprites.delete(id);
    }
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener("click", event => {
  if (currentState !== "playing") return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const targets = [];

  for (const p of players) {
    if (p.id === playerId || p.team === myTeam) continue;
    const model = playerObjects.get(p.id);
    if (model) targets.push(...model.children);
  }

  const hit = raycaster.intersectObjects(targets, false);
  if (hit.length) socket.emit("score", { team: myTeam });
});

document.addEventListener("keydown", e => {
  if (!e.key) return;
  keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", e => {
  if (!e.key) return;
  keys[e.key.toLowerCase()] = false;
});

let lastSentX = null;
let lastSentY = null;
let animationStarted = false;

function loop() {
  requestAnimationFrame(loop);

  if (currentState === "playing") {
    const me = players.find(p => p.id === playerId);

    if (me) {
      const speed = 3;
      if (keys["w"] || keys["arrowup"]) me.y -= speed;
      if (keys["s"] || keys["arrowdown"]) me.y += speed;
      if (keys["a"] || keys["arrowleft"]) me.x -= speed;
      if (keys["d"] || keys["arrowright"]) me.x += speed;

      me.x = Math.max(15, Math.min(785, me.x));
      me.y = Math.max(15, Math.min(485, me.y));

      if (me.x !== lastSentX || me.y !== lastSentY) {
        socket.emit("playerMove", { x: me.x, y: me.y });
        lastSentX = me.x;
        lastSentY = me.y;
      }

      const model = playerObjects.get(playerId);
      if (model) {
        camera.position.set(
          model.position.x,
          6,
          model.position.z + 10
        );
        camera.lookAt(
          model.position.x,
          1.2,
          model.position.z - 2
        );
      }
    }

    updatePlayers();
  }

  renderer.render(scene, camera);
}

function start3DLoop() {
  if (animationStarted) return;
  animationStarted = true;
  loop();
}

socket.on("matchStarted", data => {
  currentState = "playing";
  $("matchTitle").textContent = `${data.mode} — ${data.map}`;
  show("game");
  start3DLoop();
});

socket.on("players", data => {
  players = data;
  updatePlayers();
});

function resizeArena() {
  const width = arena.clientWidth || 800;
  const height = width * 500 / 800;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resizeArena);
resizeArena();
start3DLoop();

/* Cosmetic loadout studio: browser-local saves, no server or gameplay changes. */
let selectedGear = "AURORA";
let loadoutColor = "#63e6ff";
const LOADOUT_STORAGE_KEY = "arenaverse.cosmeticLoadouts.v1";
function openLoadoutStudio() {
  const panel = $("loadoutStudio");
  if (!panel) return;
  panel.classList.remove("hidden");
  panel.scrollIntoView({behavior:"smooth", block:"start"});
  renderSavedLoadouts();
}
function closeLoadoutStudio() {
  $("loadoutStudio")?.classList.add("hidden");
}
function chooseGear(gear, button) {
  selectedGear = gear;
  document.querySelectorAll(".gear-card").forEach(card => {
    const active = card.dataset.gear === gear;
    card.classList.toggle("selected", active);
    const state = card.querySelector(".gear-state");
    if (state) state.textContent = active ? "SELECTED" : "EQUIP";
  });
  document.documentElement.dataset.loadoutGear = gear.toLowerCase();
  const style = {"AURORA":"Aurora shell","PHANTOM":"Phantom suit","PULSE":"Pulse armor"}[gear] || gear;
  $("styleSummary").textContent = style + " · " + colorName(loadoutColor);
}
function colorName(color) {
  return ({"#63e6ff":"Ice cyan","#a78bfa":"Violet","#ffad66":"Solar orange","#8be0a2":"Mint","#f28bb8":"Rose"})[color] || "Custom";
}
function chooseLoadoutColor(color, button) {
  loadoutColor = color;
  selectedAvatarColor = color;
  document.documentElement.style.setProperty("--avatar-accent", color);
  document.querySelectorAll("#loadoutStudio .swatch").forEach(s => s.classList.toggle("active", s === button));
  document.querySelectorAll(".gear-visual").forEach(v => v.style.setProperty("--gear-color", color));
  $("styleSummary").textContent = ({"AURORA":"Aurora shell","PHANTOM":"Phantom suit","PULSE":"Pulse armor"}[selectedGear]) + " · " + colorName(color);
  const oldSwatches = document.querySelectorAll("#customizer .swatch");
  oldSwatches.forEach(s => s.classList.toggle("active", s.getAttribute("aria-label") === ({"#63e6ff":"Cyan","#a78bfa":"Violet","#ffad66":"Orange","#8be0a2":"Mint"}[color])));
  if (typeof renderSavedLoadouts === "function") renderSavedLoadouts();
}
function readLoadouts() {
  try {
    const value = JSON.parse(localStorage.getItem(LOADOUT_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter(x => x && typeof x.name === "string" && ["AURORA","PHANTOM","PULSE"].includes(x.gear) && /^#[0-9a-f]{6}$/i.test(x.color)).slice(0,5) : [];
  } catch (_) { return []; }
}
function saveLoadout() {
  const input = $("loadoutName");
  const name = (input.value.trim() || ({"AURORA":"Aurora shell","PHANTOM":"Phantom suit","PULSE":"Pulse armor"}[selectedGear])).slice(0,20);
  const saved = readLoadouts();
  if (saved.length >= 5) {
    $("loadoutMessage").textContent = "You have 5 saved looks. Delete one before saving another.";
    return;
  }
  saved.push({id:Date.now().toString(36),name,gear:selectedGear,color:loadoutColor});
  try {
    localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(saved));
    input.value = "";
    $("loadoutMessage").textContent = "Saved “" + name + "” on this device.";
    renderSavedLoadouts();
  } catch (_) {
    $("loadoutMessage").textContent = "Saving is unavailable in this browser session.";
  }
}
function equipSavedLoadout(id) {
  const item = readLoadouts().find(x => x.id === id);
  if (!item) return;
  chooseGear(item.gear, document.querySelector('.gear-card[data-gear="' + item.gear + '"]'));
  const swatch = [...document.querySelectorAll("#loadoutStudio .swatch")].find(s => s.style.getPropertyValue("--swatch").trim().toLowerCase() === item.color.toLowerCase());
  chooseLoadoutColor(item.color, swatch || document.querySelector("#loadoutStudio .swatch"));
  $("loadoutMessage").textContent = "Equipped “" + item.name + "”.";
}
function deleteSavedLoadout(id) {
  try {
    localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(readLoadouts().filter(x => x.id !== id)));
    renderSavedLoadouts();
    $("loadoutMessage").textContent = "Saved look deleted.";
  } catch (_) { $("loadoutMessage").textContent = "Could not update saved looks."; }
}
function renderSavedLoadouts() {
  const list = $("savedLoadoutList");
  if (!list) return;
  const saved = readLoadouts();
  $("savedLoadoutCount").textContent = saved.length + " / 5";
  list.innerHTML = saved.length ? saved.map(item => '<div class="saved-loadout-item"><span class="saved-color" style="--saved-color:' + item.color + '"></span><span class="saved-info"><strong>' + escapeLoadoutText(item.name) + '</strong><small>' + item.gear + ' · ' + colorName(item.color) + '</small></span><span class="saved-actions"><button onclick="equipSavedLoadout(\'' + item.id + '\')">EQUIP</button><button class="delete-loadout" aria-label="Delete ' + escapeLoadoutText(item.name) + '" onclick="deleteSavedLoadout(\'' + item.id + '\')">×</button></span></div>').join("") : '<p class="fine-print">No saved looks yet. Customize a style and save it above.</p>';
}
function escapeLoadoutText(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".gear-visual").forEach(v => v.style.setProperty("--gear-color", loadoutColor));
  renderSavedLoadouts();
});
