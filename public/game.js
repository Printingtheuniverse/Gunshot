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
  { name: "NOVA", description: "Frontier scout · Precision-built ceramic armor.", className: "avatar-nova" },
  { name: "BOLT", description: "Rapid-response explorer · Angular pulse plating.", className: "avatar-bolt" },
  { name: "MOSS", description: "Recon specialist · Rugged field-ready armor.", className: "avatar-moss" },
  { name: "ORBIT", description: "Signal navigator · Orbital sensor crown and violet energy trim.", className: "avatar-orbit" },
  { name: "EMBER", description: "Solar wanderer · Heat-shield plates and amber glow.", className: "avatar-ember" }
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

  const availableModes = ["Zone Control","Checkpoint Rally","Crystal Hunt","Free Explore"];
  const availableMaps = ["Luminous Gardens","Glass Dunes","Skyline Ruins","Aurora Grove"];
  renderVotes("modeVotes", state.modeVotes, availableModes, "voteMode");
  renderVotes("mapVotes", state.mapVotes, availableMaps, "voteMap");
  const leader = (votes, options) => {
    const ranked = options.map((name, index) => ({name, votes:Number(votes?.[name] || 0), index})).sort((a,b)=>b.votes-a.votes || a.index-b.index);
    return ranked[0]?.votes ? `${ranked[0].name} (${ranked[0].votes})` : "No votes yet";
  };
  if ($("leadingMode")) $("leadingMode").textContent = leader(state.modeVotes, availableModes);
  if ($("leadingMap")) $("leadingMap").textContent = leader(state.mapVotes, availableMaps);

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
    resizeArena();
    setMapTheme(state.map);
  }
});

function renderVotes(id, votes, options, eventName) {
  const container = $(id);
  if (!container) return;
  container.innerHTML = options.map((option, index) => `
    <div class="vote">
      <span>${option} — ${Number(votes?.[option] || 0)} vote(s)</span>
      <button type="button" data-vote-option="${index}">VOTE</button>
    </div>`).join("");

  // Bind after rendering instead of interpolating quoted option names into
  // an inline HTML attribute (which broke for names containing spaces).
  container.querySelectorAll("button[data-vote-option]").forEach(button => {
    button.addEventListener("click", () => {
      const option = options[Number(button.dataset.voteOption)];
      if (typeof window[eventName] === "function" && option !== undefined) {
        window[eventName](option);
      }
    });
  });
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
function chooseAbility(ability, button) {
  selectedAbility = ability;
  document.querySelectorAll(".ability-option").forEach(el => el.classList.toggle("selected", el === button));
  const label = $("selectedAbilityLabel");
  if (label) label.textContent = ability.toUpperCase();
}

function toggleReady() {
  socket.emit("ready");
}

const arena = $("arena");
let selectedAbility = "Dash";
let jumpHeight = 0;
let jumpRequested = false;
let cameraYaw = 0;
let cameraPitch = 0.18;
const cameraDistance = 15;
let moveFacing = 0;
let hasMovedFacing = false;
let cameraDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let jumpVelocity = 0;
let abilityCooldown = 0;
let abilityRequested = false;
let lastFrameTime = performance.now();

const scene = new THREE.Scene();
const mapDecoration = new THREE.Group();
scene.add(mapDecoration);
function setMapTheme(mapName) {
  baseEnvironmentObjects.forEach(object => { object.visible = mapName === "Luminous Gardens"; });
  while (mapDecoration.children.length) {
    const item = mapDecoration.children[0]; mapDecoration.remove(item);
    item.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m=>m.dispose()); else obj.material.dispose(); } });
  }
  const themes = {
    "Luminous Gardens": {bg:0x102c38,fog:0x102c38,floor:0x244b45,grid:0x5be6bd,light:0xb7ffe5,accent:0x69ffc7,secondary:0x8a9cff},
    "Glass Dunes": {bg:0x5a321b,fog:0x9b6034,floor:0xc69a5b,grid:0xe9c17a,light:0xffd49a,accent:0xffc46d,secondary:0xf18a56},
    "Skyline Ruins": {bg:0x252b4c,fog:0x343c60,floor:0x6b6c7e,grid:0x9ba9e8,light:0xd2d6ff,accent:0x9da9ff,secondary:0xffa9da},
    "Aurora Grove": {bg:0x102b38,fog:0x173b43,floor:0x254a42,grid:0x65cbb4,light:0xc6ffe8,accent:0x76f2b4,secondary:0xb69bff}
  };
  const t = themes[mapName] || themes["Luminous Gardens"];
  scene.background.setHex(t.bg); scene.fog.color.setHex(t.fog); floor.material.color.setHex(t.floor);
  grid.material.color.setHex(t.grid); mainLight.color.setHex(t.light); blueLight.color.setHex(t.accent); redLight.color.setHex(t.secondary);
  grid.visible = mapName !== "Glass Dunes";
  const mat = (color, emissive=0x000000) => new THREE.MeshStandardMaterial({color,roughness:0.82,metalness:0.08,emissive,emissiveIntensity:0.35});
  const add = (geometry, material, x,y,z, sx=1,sy=1,sz=1) => { const m = new THREE.Mesh(geometry,material); m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow=true; m.receiveShadow=true; mapDecoration.add(m); return m; };
  if (mapName === "Glass Dunes") {
    for (const [x,z] of [[-30,-16],[30,-12],[-25,15],[26,16]]) {
      add(new THREE.BoxGeometry(1.8,5.5,1.8),mat(0xb9854f),x,2.75,z);
      add(new THREE.BoxGeometry(5.4,.8,1.8),mat(0xe2b76d),x,5.2,z);
    }
    // Large sculpted dune ridges and rock clusters frame a broad central route.
    for (const [x,z,sx,sz] of [[-24,-17,8,4],[24,-15,9,4],[-27,13,7,5],[27,15,8,4],[-12,20,6,3],[14,-21,7,3]]) {
      add(new THREE.SphereGeometry(1,18,12),mat(0xd9ad69),x,-0.35,z,sx,0.7,sz);
    }
    for (const [x,z,s] of [[-31,-7,2.8],[-20,8,2.2],[29,4,2.6],[19,-8,2.4],[-8,-22,2.1],[8,22,2.5]]) {
      add(new THREE.DodecahedronGeometry(1.5,1),mat(0x8c6545),x,s*0.48,z,s*1.1,s*0.85,s);
      add(new THREE.DodecahedronGeometry(0.9,0),mat(0xb88a51),x+s*0.75,s*0.28,z-s*0.35,s*0.75,s*0.6,s*0.8);
    }
    add(new THREE.SphereGeometry(5,24,16),new THREE.MeshBasicMaterial({color:0xffc477}),27,20,-38);
  } else if (mapName === "Skyline Ruins") {
    for (const [x,z,h] of [[-30,-12,9],[-20,13,5],[23,-16,11],[31,12,7],[-4,-20,6],[8,18,9]]) {
      add(new THREE.BoxGeometry(4,h,4),mat(0x454d70),x,h/2,z);
      add(new THREE.BoxGeometry(5.4,.35,4.8),mat(0x9ba9e8,0x323e80),x,h,z);
      add(new THREE.BoxGeometry(2,.18,1.8),mat(0x7ceaff,0x1c7fa5),x,h+.22,z);
    }
    for (const [x,z] of [[-10,-7],[11,6],[-25,5],[24,-4]]) add(new THREE.BoxGeometry(8,.5,2),mat(0x747d9c),x,2.5,z);
    for (const [x,z] of [[-28,-17],[-20,14],[22,-16],[29,13],[-5,-19],[7,18]]) { add(new THREE.BoxGeometry(2.6,7,2.6),mat(0x666c83),x,3.5,z); add(new THREE.BoxGeometry(3.4,.45,3.4),mat(0xa5a9c3),x,7,z); }
    for (let i=0;i<10;i++) add(new THREE.TetrahedronGeometry(1.3),mat(0x777b91),((i*13)%55)-27,.7,((i*19)%38)-19,1.3,.8,1.1);
  } else {
    for (let i=0;i<24;i++) {
      const x=((i*17)%68)-34, z=((i*23)%42)-21;
      if(Math.abs(x)<8 && Math.abs(z)<8) continue;
      add(new THREE.CylinderGeometry(.18,.32,3,7),mat(0x335e62),x,1.5,z);
      add(new THREE.SphereGeometry(1.6,12,9),mat(i%2?0x58bba4:0x8e83d8,i%2?0x2a967f:0x6352b5),x,3.5,z,1.1,.75,1.1);
    }
    for (let i=0;i<16;i++) { const x=((i*19)%64)-32, z=((i*11)%40)-20; if(Math.abs(x)<7 && Math.abs(z)<7) continue; const color=mapName==="Aurora Grove"?(i%2?0x6ac99a:0x718bcb):(i%2?0x3c9b77:0x5cba9d); add(new THREE.CylinderGeometry(.22,.42,2.4,7),mat(0x4a6b60),x,1.2,z); add(new THREE.IcosahedronGeometry(1.8,1),mat(color,mapName==="Luminous Gardens"?color:0x000000),x,3.1,z,0.78,0.82,0.78); }
    for (let i=0;i<12;i++) add(new THREE.SphereGeometry(.14,8,6),new THREE.MeshBasicMaterial({color:t.secondary}),((i*9)%54)-27,1.4+(i%4),((i*17)%36)-18);
  }
  mainLight.position.set(-8, mapName==="Glass Dunes"?25:18, 10); mainLight.intensity=mapName==="Glass Dunes"?3.8:3.1;
  resizeArena();
}
scene.background = new THREE.Color(0x17212b);
scene.fog = new THREE.Fog(0x17212b, 48, 125);

const camera = new THREE.PerspectiveCamera(52, 1.6, 0.1, 260);
camera.position.set(0, 31, 38);
camera.lookAt(0, 0, 0);
// Reuse the canvas already present in index.html. Do not nest a canvas
// inside another canvas; that creates an invisible/zero-sized render surface.
const renderer = new THREE.WebGLRenderer({ canvas: arena, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.domElement.style.cssText = "display:block;width:100%;height:100%;border-radius:10px;cursor:crosshair";
function resizeArena() {
  const width = Math.max(320, arena.clientWidth || arena.parentElement.clientWidth || 960);
  const height = Math.max(480, Math.min(window.innerHeight * 0.78, width * 0.72));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resizeArena);
renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());
renderer.domElement.addEventListener("pointerdown", e => {
  if (currentState !== "playing" || e.button !== 2) return;
  e.preventDefault();
  renderer.domElement.focus();
  cameraDragging = true; lastPointerX = e.clientX; lastPointerY = e.clientY;
  renderer.domElement.setPointerCapture?.(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", e => {
  if (!cameraDragging) return;
  cameraYaw -= (e.clientX - lastPointerX) * 0.008;
  cameraPitch = Math.max(0.08, Math.min(0.78, cameraPitch - (e.clientY - lastPointerY) * 0.004));
  lastPointerX = e.clientX; lastPointerY = e.clientY;
});
renderer.domElement.addEventListener("pointerup", () => { cameraDragging = false; });
renderer.domElement.addEventListener("pointercancel", () => { cameraDragging = false; });
renderer.domElement.addEventListener("wheel", e => { if (currentState === "playing") e.preventDefault(); }, {passive:false});

scene.add(new THREE.HemisphereLight(0xc8d9e8, 0x52606b, 2.1));

const mainLight = new THREE.DirectionalLight(0xfff3df, 3.1);
mainLight.position.set(-8, 18, 10);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.camera.left = -65;
mainLight.shadow.camera.right = 65;
mainLight.shadow.camera.top = 45;
mainLight.shadow.camera.bottom = -45;
mainLight.shadow.bias = -0.00015;
mainLight.shadow.normalBias = 0.025;
scene.add(mainLight);

// Cool rim lighting separates explorer silhouettes from the arena background.
const rimLight = new THREE.DirectionalLight(0x62cfff, 2.0);
rimLight.position.set(12, 9, -14);
scene.add(rimLight);
const fillLight = new THREE.DirectionalLight(0x8b9cff, 0.8);
fillLight.position.set(4, 7, 12);
scene.add(fillLight);

const blueLight = new THREE.PointLight(0x4a9ac7, 32, 48);
blueLight.position.set(-15, 5, -8);
scene.add(blueLight);

const redLight = new THREE.PointLight(0xc77969, 26, 48);
redLight.position.set(15, 5, 8);
scene.add(redLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 80),
  new THREE.MeshStandardMaterial({
    color: 0x53616b,
    metalness: 0.22,
    roughness: 0.82
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(120, 48, 0x607f91, 0x344956);
grid.position.y = 0.025;
scene.add(grid);

const baseEnvironmentObjects = [];
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
  baseEnvironmentObjects.push(mesh);
  return mesh;
}

// Arena walls and glowing trim
addBox(0, 2, -40, 120, 4, 1, 0x344653);
addBox(0, 2, 40, 120, 4, 1, 0x17263a);
addBox(-60, 2, 0, 1, 4, 80, 0x17263a);
addBox(60, 2, 0, 1, 4, 80, 0x17263a);
addBox(0, 3.8, -39.4, 118, 0.12, 0.12, 0x5a9cb5, 0x163847);
addBox(0, 3.8, 39.4, 118, 0.12, 0.12, 0xc77969, 0x3d201d);

// Cover crates
for (const [x, z] of [
  [-18, -10], [-8, 8], [8, -8], [18, 10],
  [-24, 5], [24, -5], [0, -16], [0, 16]
]) {
  addBox(x, 1.2, z, 3.5, 2.4, 3.5, 0x53636c);
  addBox(x, 2.43, z, 3.7, 0.12, 3.7, 0x7897a5, 0x152e3a);
}

// Industrial frontier set dressing: structural steel, utility conduits, lamps, and worn floor panels.
const steel = 0x354957;
const darkSteel = 0x182b39;
const neonCyan = 0x48d8f3;
const neonAmber = 0xe7a765;
// Heavy corner pylons with illuminated signal bands.
for (const [x, z] of [[-34,-20],[34,-20],[-34,20],[34,20]]) {
  addBox(x, 3.3, z, 2.1, 6.6, 2.1, darkSteel);
  addBox(x, 6.15, z, 2.35, 0.16, 2.35, steel);
  addBox(x, 4.8, z + (z < 0 ? 1.08 : -1.08), 1.2, 0.12, 0.08, neonCyan, neonCyan);
  addBox(x, 2.5, z + (z < 0 ? 1.08 : -1.08), 0.75, 0.08, 0.08, neonAmber, neonAmber);
}
// Reinforced wall ribs and recessed service bays.
for (const x of [-28,-18,-8,2,12,22,32]) {
  addBox(x, 2.6, -24.05, 0.32, 5.2, 0.18, steel);
  addBox(x, 2.6, 24.05, 0.32, 5.2, 0.18, steel);
}
for (const z of [-15,-5,5,15]) {
  addBox(-39.35, 2.2, z, 0.16, 3.8, 0.28, steel);
  addBox(39.35, 2.2, z, 0.16, 3.8, 0.28, steel);
}
// Ground-level light strips and modular floor plates.
for (const z of [-21,-13,-5,3,11,19]) {
  addBox(-29, 0.035, z, 10, 0.035, 0.09, neonCyan, 0x124c60);
  addBox(29, 0.035, z, 10, 0.035, 0.09, neonAmber, 0x5c3218);
}
for (const x of [-30,-20,-10,10,20,30]) {
  addBox(x, 0.04, 0, 0.055, 0.025, 36, 0x6a7b84);
}
// Utility consoles along the outer lanes.
for (const [x, z, color] of [[-30,-8,neonCyan],[30,8,neonAmber],[-30,8,neonCyan],[30,-8,neonAmber]]) {
  addBox(x, 0.8, z, 2.2, 1.6, 1.5, darkSteel);
  addBox(x, 1.65, z, 2.25, 0.12, 1.55, steel);
  addBox(x, 1.12, z + (z < 0 ? 0.77 : -0.77), 1.1, 0.28, 0.06, color, color);
  addBox(x - 0.55, 0.25, z, 0.12, 0.35, 1.05, steel);
  addBox(x + 0.55, 0.25, z, 0.12, 0.35, 1.05, steel);
}
// Low industrial gantries frame the arena without closing the play space.
for (const x of [-20, 20]) {
  addBox(x, 4.9, -18, 0.35, 0.25, 9, steel);
  addBox(x, 4.9, 18, 0.35, 0.25, 9, steel);
  addBox(x, 4.75, -18, 0.12, 0.06, 8.5, neonCyan, 0x124c60);
  addBox(x, 4.75, 18, 0.12, 0.06, 8.5, neonAmber, 0x5c3218);
}
// A few metal floor grates and hazard markers give the surface scale.
for (const [x, z] of [[-12,-20],[12,-20],[-12,20],[12,20]]) {
  addBox(x, 0.045, z, 4.4, 0.045, 1.8, 0x263b49);
  for (let stripe = -1; stripe <= 1; stripe++) {
    addBox(x + stripe * 1.1, 0.073, z, 0.055, 0.018, 1.5, 0x91a4aa);
  }
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

// Always-visible local operator fallback, independent of the detailed character
// model builder. This ensures a player is visible even if a weapon/model part fails.
const emergencyOperator = new THREE.Group();
const emergencyBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.42, 0.9, 4, 10),
  new THREE.MeshStandardMaterial({ color: 0x35e8ff, emissive: 0x087b99, emissiveIntensity: 1.2 })
);
emergencyBody.position.y = 1.05;
emergencyOperator.add(emergencyBody);
const emergencyHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 12, 10),
  new THREE.MeshStandardMaterial({ color: 0xf4fbff, emissive: 0x399dff, emissiveIntensity: 0.5 })
);
emergencyHead.position.y = 1.85;
emergencyOperator.add(emergencyHead);
const emergencyRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.78, 0.07, 8, 28),
  new THREE.MeshBasicMaterial({ color: 0x35e8ff })
);
emergencyRing.rotation.x = -Math.PI / 2;
emergencyRing.position.y = 0.1;
emergencyOperator.add(emergencyRing);
emergencyOperator.visible = false;
scene.add(emergencyOperator);
const collectibleCrystals = [];
let collectedCrystals = 0;
const controlZones = [];
const rallyCheckpoints = [];
let activeCheckpoint = 0;
let lastObjectiveScoreAt = 0;
function createObjectiveRing(x, z, index) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.25,0.09,10,40), new THREE.MeshStandardMaterial({color:teamColors[index%teamColors.length],emissive:teamColors[index%teamColors.length],emissiveIntensity:1.3}));
  ring.rotation.x = Math.PI/2; ring.position.set(x,0.12,z); ring.userData.objectiveIndex=index; scene.add(ring); controlZones.push(ring);
}
function createCheckpoint(x,z,index) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8,0.12,10,36),new THREE.MeshStandardMaterial({color:0x8df5ff,emissive:0x28cfff,emissiveIntensity:1.8}));
  ring.position.y=2.2; group.add(ring);
  const postMat=new THREE.MeshStandardMaterial({color:0x284c60,emissive:0x147c9a,emissiveIntensity:.7});
  for(const side of [-1,1]) {const post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,2.2,8),postMat);post.position.set(side*1.8,1.1,0);group.add(post);}
  group.position.set(x,0,z);group.userData.checkpointIndex=index;scene.add(group);rallyCheckpoints.push(group);
}
[[-22,-12],[0,0],[22,12]].forEach((p,i)=>createObjectiveRing(p[0],p[1],i));
[[-28,-16],[-14,12],[0,-14],[15,13],[28,-10]].forEach((p,i)=>createCheckpoint(p[0],p[1],i));
function setWeapon() {}

function makePlayer(p) {
  const group = new THREE.Group();
  const material = teamMaterials[p.team] || teamMaterials[0];
  const dark = new THREE.MeshStandardMaterial({
    color: 0x253847,
    metalness: 0.58,
    roughness: 0.32
  });
  // Declare shared suit materials before any armor parts use them.
  const trim = new THREE.MeshStandardMaterial({color:0xcee7ee,metalness:0.78,roughness:0.24});
  const teamGlow = new THREE.MeshStandardMaterial({color:0x8af7ff,emissive:0x35dfff,emissiveIntensity:1.25,metalness:0.25,roughness:0.22});

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

  // Extra silhouette details make the arena avatars feel like distinct sci-fi explorers.
  const armor = new THREE.MeshStandardMaterial({
    color: 0xb8cbd5, metalness: 0.72, roughness: 0.24
  });
  const deepArmor = new THREE.MeshStandardMaterial({
    color: 0x101e2b, metalness: 0.62, roughness: 0.3
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0xd9fbff, emissive: 0x56dfff, emissiveIntensity: 0.85,
    metalness: 0.25, roughness: 0.25
  });
  // Stable per-player silhouette variants keep every explorer visually distinct.
  const identity = String(p.id || p.name || "scout");
  const variant = p.id === playerId ? selectedCharacter : [...identity].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  // Shoulder plates
  part(new THREE.SphereGeometry(variant === 1 ? 0.31 : 0.27, 12, 8), armor, -0.53, 1.72, 0);
  part(new THREE.SphereGeometry(variant === 1 ? 0.31 : 0.27, 12, 8), armor, 0.53, 1.72, 0);
  if (variant === 0) {
    // Broad explorer crest
    part(new THREE.BoxGeometry(0.46, 0.12, 0.16), deepArmor, 0, 2.28, 0);
    part(new THREE.ConeGeometry(0.13, 0.28, 5), material, 0, 2.43, -0.02);
  } else if (variant === 1) {
    // Angular side fins and reinforced collar
    part(new THREE.ConeGeometry(0.13, 0.38, 5), material, -0.29, 2.32, -0.02).rotation.z = -0.48;
    part(new THREE.ConeGeometry(0.13, 0.38, 5), material, 0.29, 2.32, -0.02).rotation.z = 0.48;
    part(new THREE.BoxGeometry(0.84, 0.13, 0.42), armor, 0, 1.86, -0.01);
  } else if (variant === 2) {
    // Compact sensor mast and side-mounted utility pack
    part(new THREE.CylinderGeometry(0.055, 0.075, 0.36, 8), material, 0.25, 2.42, -0.02);
    part(new THREE.SphereGeometry(0.1, 10, 8), glow, 0.25, 2.62, -0.02);
    part(new THREE.BoxGeometry(0.18, 0.42, 0.25), armor, -0.34, 1.56, -0.28);
  }
  if (variant === 3) {
    part(new THREE.TorusGeometry(0.42,0.055,8,20), glow, 0, 2.48, 0).rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(0.18,0.55,0.22), deepArmor, 0.42, 1.55, -0.28);
  } else if (variant === 4) {
    part(new THREE.ConeGeometry(0.2,0.52,6), material, 0, 2.48, -0.02);
    part(new THREE.BoxGeometry(0.72,0.14,0.3), armor, 0, 1.88, -0.02);
    part(new THREE.SphereGeometry(0.14,10,8), new THREE.MeshStandardMaterial({color:0xffb45e,emissive:0xff7a28,emissiveIntensity:1.4}), 0, 1.5, 0.31);
  }
  // Premium suit detailing: layered collar, segmented abdomen and shoulder insets.
  part(new THREE.TorusGeometry(0.31, 0.065, 10, 28), trim, 0, 1.91, 0).rotation.x = Math.PI / 2;
  part(new THREE.BoxGeometry(0.36, 0.12, 0.08), deepArmor, 0, 1.28, 0.225);
  part(new THREE.BoxGeometry(0.28, 0.08, 0.07), armor, 0, 1.16, 0.235);
  part(new THREE.BoxGeometry(0.12, 0.22, 0.065), teamGlow, -0.43, 1.73, 0.17);
  part(new THREE.BoxGeometry(0.12, 0.22, 0.065), teamGlow, 0.43, 1.73, 0.17);
  // Helmet side housings and a glossy, multi-layer visor.
  part(new THREE.BoxGeometry(0.11, 0.23, 0.25), deepArmor, -0.285, 2.06, 0.015);
  part(new THREE.BoxGeometry(0.11, 0.23, 0.25), deepArmor, 0.285, 2.06, 0.015);
  part(new THREE.BoxGeometry(0.33, 0.035, 0.045), glow, 0, 2.155, 0.302);

  // Chest badge and slim illuminated torso panel
  part(new THREE.BoxGeometry(0.3, 0.38, 0.075), deepArmor, 0, 1.48, 0.19);
  part(new THREE.BoxGeometry(0.12, 0.2, 0.09), glow, 0, 1.5, 0.245);
  // Back-mounted explorer pack
  part(new THREE.BoxGeometry(0.48, 0.56, 0.2), deepArmor, 0, 1.55, -0.29);
  part(new THREE.BoxGeometry(0.34, 0.09, 0.08), material, 0, 1.72, -0.405);
  // Forearm cuffs and knee guards
  part(new THREE.CylinderGeometry(0.17, 0.17, 0.15, 8), material, -0.53, 1.1, 0);
  part(new THREE.CylinderGeometry(0.17, 0.17, 0.15, 8), material, 0.53, 1.1, 0);
  part(new THREE.BoxGeometry(0.29, 0.18, 0.12), armor, -0.2, 0.47, 0.13);
  part(new THREE.BoxGeometry(0.29, 0.18, 0.12), armor, 0.2, 0.47, 0.13);
  // Helmet fins and boots give the model a stronger silhouette.
  part(new THREE.ConeGeometry(0.12, 0.32, 5), material, -0.22, 2.35, -0.02).rotation.z = -0.35;
  part(new THREE.ConeGeometry(0.12, 0.32, 5), material, 0.22, 2.35, -0.02).rotation.z = 0.35;
  part(new THREE.BoxGeometry(0.34, 0.16, 0.42), deepArmor, -0.2, 0.08, 0.08);
  part(new THREE.BoxGeometry(0.34, 0.16, 0.42), deepArmor, 0.2, 0.08, 0.08);
  // Layered tactical silhouette pass: visor, segmented chest plates, utility gear and shin armor.
  const visor = new THREE.MeshStandardMaterial({color:0x0b2638, metalness:0.45, roughness:0.18, emissive:0x06283c, emissiveIntensity:0.8});
  part(new THREE.BoxGeometry(0.39,0.13,0.075), visor, 0, 2.08, 0.255);
  part(new THREE.BoxGeometry(0.055,0.075,0.035), teamGlow, -0.115, 2.08, 0.3);
  part(new THREE.BoxGeometry(0.055,0.075,0.035), teamGlow, 0.115, 2.08, 0.3);
  part(new THREE.BoxGeometry(0.55,0.19,0.095), armor, 0, 1.68, 0.225);
  part(new THREE.BoxGeometry(0.13,0.12,0.045), teamGlow, 0, 1.69, 0.28);
  part(new THREE.BoxGeometry(0.21,0.32,0.1), deepArmor, -0.37, 1.4, 0.14);
  part(new THREE.BoxGeometry(0.21,0.32,0.1), deepArmor, 0.37, 1.4, 0.14);
  part(new THREE.BoxGeometry(0.24,0.19,0.17), trim, -0.2, 0.7, 0.035);
  part(new THREE.BoxGeometry(0.24,0.19,0.17), trim, 0.2, 0.7, 0.035);
  part(new THREE.BoxGeometry(0.12,0.34,0.16), deepArmor, -0.2, 0.34, 0.02);
  part(new THREE.BoxGeometry(0.12,0.34,0.16), deepArmor, 0.2, 0.34, 0.02);
  part(new THREE.BoxGeometry(0.16,0.27,0.18), armor, -0.38, 1.3, -0.3);
  part(new THREE.BoxGeometry(0.16,0.27,0.18), armor, 0.38, 1.3, -0.3);
  part(new THREE.CylinderGeometry(0.085,0.085,0.34,8), teamGlow, -0.27, 1.57, -0.43);
  part(new THREE.CylinderGeometry(0.085,0.085,0.34,8), teamGlow, 0.27, 1.57, -0.43);


  // Visual polish pass: layered ceramic panels, engraved seams, and luminous explorer trim.
  const ceramic = new THREE.MeshStandardMaterial({color:0xd8e8ee,metalness:0.68,roughness:0.22});
  const seam = new THREE.MeshStandardMaterial({color:0x142838,metalness:0.52,roughness:0.3});
  const accent = new THREE.MeshStandardMaterial({color:0x9af7ff,emissive:0x24cfff,emissiveIntensity:1.7,metalness:0.28,roughness:0.2});
  // Layered chest and hip plates add readable silhouette depth at arena camera distance.
  part(new THREE.BoxGeometry(0.42,0.12,0.11), ceramic, 0, 1.82, 0.205);
  part(new THREE.BoxGeometry(0.27,0.09,0.09), seam, 0, 1.73, 0.27);
  part(new THREE.BoxGeometry(0.19,0.07,0.035), accent, 0, 1.73, 0.322);
  part(new THREE.BoxGeometry(0.24,0.12,0.13), ceramic, -0.29, 0.91, 0.09);
  part(new THREE.BoxGeometry(0.24,0.12,0.13), ceramic, 0.29, 0.91, 0.09);
  // Fine shoulder and backpack signal strips catch the rim light.
  part(new THREE.BoxGeometry(0.28,0.055,0.07), accent, -0.52, 1.83, 0.16);
  part(new THREE.BoxGeometry(0.28,0.055,0.07), accent, 0.52, 1.83, 0.16);
  part(new THREE.BoxGeometry(0.28,0.08,0.035), accent, 0, 1.77, -0.412);

  // Explorer beacon: a harmless glowing navigation orb carried by each explorer.
  const beacon = new THREE.Group();
  const beaconCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.13, 1),
    new THREE.MeshStandardMaterial({color:0x8df5ff,emissive:0x28cfff,emissiveIntensity:2.2,metalness:0.18,roughness:0.2})
  );
  beaconCore.position.set(0.48,1.35,-0.22);
  beacon.add(beaconCore);
  const beaconHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.21,0.025,8,24),
    new THREE.MeshBasicMaterial({color:0xa8a0ff})
  );
  beaconHalo.position.copy(beaconCore.position);
  beaconHalo.rotation.x = Math.PI/2;
  beacon.add(beaconHalo);
  beacon.userData.navigationBeacon = true;
  group.add(beacon);

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
    const x = (p.x - 400) * 0.12;
    const z = (p.y - 250) * 0.12;
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
    if (p.id === playerId && !hasMovedFacing) model.rotation.y = moveFacing;
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
const cyanGlowForShot = new THREE.MeshBasicMaterial({ color: 0x8df5ff });
const amberGlowForShot = new THREE.MeshBasicMaterial({ color: 0xffbb73 });

// Explore the arena by collecting luminous data crystals. Clicking an explorer
// no longer tags opponents; only crystal discoveries contribute to team score.
function addDataCrystal(x, z, color = 0x8df5ff) {
  const crystal = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.48, 0),
    new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:1.35, metalness:0.18, roughness:0.22})
  );
  gem.position.y = 0.9;
  crystal.add(gem);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.025, 8, 32),
    new THREE.MeshBasicMaterial({color})
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  crystal.add(ring);
  crystal.position.set(x,0,z);
  crystal.userData.isDataCrystal = true;
  scene.add(crystal);
  collectibleCrystals.push(crystal);
}
[[-22,-15],[22,-15],[-27,13],[27,13],[0,-20],[0,20],[-12,0],[12,0]].forEach((p,i)=>addDataCrystal(p[0],p[1],[0x8df5ff,0xb8a0ff,0x8be0a2,0xffd18a][i%4]));

renderer.domElement.addEventListener("click", event => {
  if (currentState !== "playing") return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(collectibleCrystals, true);
  if (!hit.length) return;
  let crystal = hit[0].object;
  while (crystal && !crystal.userData.isDataCrystal) crystal = crystal.parent;
  if (!crystal || !crystal.userData.isDataCrystal) return;
  scene.remove(crystal);
  const index = collectibleCrystals.indexOf(crystal);
  if (index >= 0) collectibleCrystals.splice(index,1);
  collectedCrystals++;
  const status = document.getElementById("arenaObjective");
  if (status) status.textContent = "CRYSTALS FOUND // " + collectedCrystals + " / 8";
  if (document.getElementById("matchTitle")?.textContent.startsWith("Crystal Hunt")) socket.emit("score", { team: myTeam });
});

document.addEventListener("keydown", e => {
  if (!e.key) return;
  const key = e.key.toLowerCase();
  if ((key === " " || e.code === "Space") && !e.repeat && currentState === "playing" && !["INPUT","TEXTAREA"].includes(e.target?.tagName)) { jumpRequested = true; e.preventDefault(); }
  if (key === "e" && !e.repeat && currentState === "playing") abilityRequested = true;
  keys[key] = true;
  if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(key)) e.preventDefault();
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
    // Recover if the socket ID or player-list event arrived late.
    if (!playerId && socket.id) playerId = socket.id;
    if (!players.length && playerId) {
      players = [{ id: playerId, name: name(), team: myTeam, x: 400, y: 250, hp: 100 }];
    }
    const me = players.find(p => p.id === playerId);
    const matchMode = $("matchTitle")?.textContent.split(" — ")[0] || "Crystal Hunt";
    controlZones.forEach(zone => { zone.visible = matchMode === "Zone Control"; zone.rotation.z += 0.002; });
    rallyCheckpoints.forEach((checkpoint, i) => {
      checkpoint.visible = matchMode === "Checkpoint Rally";
      const ring = checkpoint.children[0];
      if (ring?.material) ring.material.color.setHex(i === activeCheckpoint ? 0xffd18a : 0x385c70);
    });
    if (me) {
      const speed = 3;
      const dt = Math.min(0.04, (performance.now() - lastFrameTime) / 1000 || 0.016);
      const moveSpeed = keys["shift"] ? speed * 1.8 : speed;
      const forward = (keys["w"] || keys["arrowup"] ? 1 : 0) - (keys["s"] || keys["arrowdown"] ? 1 : 0);
      const strafe = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
      if (forward || strafe) {
        const magnitude = Math.hypot(forward, strafe) || 1;
        const f = forward / magnitude, side = strafe / magnitude, angle = cameraYaw;
        const dx = Math.sin(angle) * f - Math.cos(angle) * side;
        const dz = -Math.cos(angle) * f - Math.sin(angle) * side;
        const proposedX = me.x + dx * moveSpeed;
        const proposedY = me.y + dz * moveSpeed;
        const nextX = (proposedX - 400) * 0.12, nextZ = (proposedY - 250) * 0.12;
        const currentX = (me.x - 400) * 0.12, currentZ = (me.y - 250) * 0.12;
        const crates = [[-18,-10],[-8,8],[8,-8],[18,10],[-24,5],[24,-5],[0,-16],[0,16]];
        const blocked = (wx,wz) => crates.some(([cx,cz]) => Math.abs(wx-cx)<2.47 && Math.abs(wz-cz)<2.47);
        if (Math.abs(nextX)<58.5 && Math.abs(nextZ)<38.5 && !blocked(nextX,nextZ)) { me.x=proposedX; me.y=proposedY; }
        else {
          if (Math.abs(nextX)<58.5 && !blocked(nextX,currentZ)) me.x=proposedX;
          if (Math.abs(nextZ)<38.5 && !blocked(currentX,nextZ)) me.y=proposedY;
        }
        moveFacing = Math.atan2(dx, dz);
        const movingModel = playerObjects.get(playerId);
        if (movingModel) movingModel.rotation.y = moveFacing;
        emergencyOperator.rotation.y = moveFacing;
        hasMovedFacing = true;
      }
      if (jumpRequested && jumpHeight <= 0.02) { jumpVelocity = 9.5; jumpRequested = false; }
      if (jumpHeight > 0.02 && jumpRequested) jumpRequested = false;
      jumpVelocity -= 20 * dt; jumpHeight = Math.max(0, jumpHeight + jumpVelocity * dt); if (jumpHeight === 0) jumpVelocity = 0;
      if (abilityCooldown > 0) abilityCooldown = Math.max(0, abilityCooldown - dt);
      const abilityHud = $("abilityStatus"); if (abilityHud) abilityHud.textContent = "ABILITY // " + selectedAbility.toUpperCase() + (abilityCooldown > 0 ? " // " + abilityCooldown.toFixed(1) + "s" : " // READY");
      if (abilityRequested && abilityCooldown <= 0) { abilityRequested = false; if (selectedAbility === "Dash") { if(keys["w"]||keys["arrowup"]) me.y -= 90; else if(keys["s"]||keys["arrowdown"]) me.y += 90; else if(keys["a"]||keys["arrowleft"]) me.x -= 90; else me.x += 90; } else if (selectedAbility === "Shield") { const model = playerObjects.get(playerId); if (model) { const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.35,16,12),new THREE.MeshBasicMaterial({color:0x75eaff,transparent:true,opacity:0.22,wireframe:true})); bubble.position.y=1.2; model.add(bubble); setTimeout(()=>{model.remove(bubble);bubble.geometry.dispose();bubble.material.dispose();},1800); } } else if (selectedAbility === "Scanner") { collectibleCrystals.forEach(crystal => crystal.scale.setScalar(1.35)); setTimeout(() => collectibleCrystals.forEach(crystal => crystal.scale.setScalar(1)), 1200); } else if (selectedAbility === "Beacon") { const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.55,1),new THREE.MeshStandardMaterial({color:0x8df5ff,emissive:0x28cfff,emissiveIntensity:2})); beacon.position.set((me.x-400)*0.075,1.1,(me.y-250)*0.075); scene.add(beacon); setTimeout(()=>{scene.remove(beacon);beacon.geometry.dispose();beacon.material.dispose();},4000); } abilityCooldown = 4; }
      me.x = Math.max(15, Math.min(785, me.x));
      me.y = Math.max(15, Math.min(485, me.y));
      const worldX = (me.x - 400) * 0.12;
      const worldZ = (me.y - 250) * 0.12;
      const now = performance.now();
      if (matchMode === "Zone Control" && now - lastObjectiveScoreAt > 5000) {
        const zone = controlZones.find(z => Math.hypot(worldX-z.position.x, worldZ-z.position.z) < 2.6);
        if (zone) { socket.emit("score", {team:myTeam}); lastObjectiveScoreAt = now; const status=$("arenaObjective"); if(status) status.textContent="ZONE HELD // TEAM "+(myTeam+1); }
      } else if (matchMode === "Checkpoint Rally" && rallyCheckpoints[activeCheckpoint] && Math.hypot(worldX-rallyCheckpoints[activeCheckpoint].position.x,worldZ-rallyCheckpoints[activeCheckpoint].position.z)<2.8) {
        activeCheckpoint=(activeCheckpoint+1)%rallyCheckpoints.length;
        socket.emit("score",{team:myTeam}); lastObjectiveScoreAt=now;
        const status=$("arenaObjective"); if(status) status.textContent="CHECKPOINT // "+activeCheckpoint+" / "+rallyCheckpoints.length;
      }
      if (me.x !== lastSentX || me.y !== lastSentY) {
        socket.emit("playerMove", { x: me.x, y: me.y });
        lastSentX = me.x;
        lastSentY = me.y;
      }
    }
    // Detailed player creation can fail if any model asset is invalid. Keep a
    // simple, bright operator visible regardless, and keep the camera following it.
    try { updatePlayers(); const localModel = playerObjects.get(playerId); if (localModel) localModel.position.y = jumpHeight; emergencyOperator.position.y = jumpHeight; } catch (error) { console.error("RELOAD-SHOT player model error:", error); }
    const targetPlayer = players.find(p => p.id === playerId) || players[0];
    const cameraTarget = targetPlayer ? playerObjects.get(targetPlayer.id) : null;
    if (cameraTarget) {
      emergencyOperator.visible = false;
      const target = cameraTarget.position;
      // Stable third-person chase camera; keep the explorer visible.
      const horizontal = Math.cos(cameraPitch) * cameraDistance;
      const desiredCamera = new THREE.Vector3(
        target.x + Math.sin(cameraYaw) * horizontal,
        target.y + 2.2 + Math.sin(cameraPitch) * cameraDistance,
        target.z + Math.cos(cameraYaw) * horizontal
      );
      camera.position.lerp(desiredCamera, 0.22);
      camera.lookAt(target.x, target.y + 1.1 + jumpHeight * 0.2, target.z);
      const localModel = playerObjects.get(playerId);
      if (localModel) localModel.visible = true;
      emergencyOperator.visible = false;
    } else {
      const fallback = targetPlayer || { x: 400, y: 250 };
      emergencyOperator.visible = true;
      emergencyOperator.position.set((fallback.x - 400) * 0.12, 0, (fallback.y - 250) * 0.12);
      const target = emergencyOperator.position;
      const horizontal = Math.cos(cameraPitch) * cameraDistance;
      const desiredCamera = new THREE.Vector3(target.x + Math.sin(cameraYaw) * horizontal, target.y + 3 + Math.sin(cameraPitch) * cameraDistance, target.z + Math.cos(cameraYaw) * horizontal);
      camera.position.lerp(desiredCamera, 0.12);
      camera.lookAt(target.x, 1.15 + jumpHeight * 0.2, target.z);
    }
  }

  lastFrameTime = performance.now();
  collectibleCrystals.forEach((crystal, i) => { crystal.rotation.y += 0.008; crystal.position.y = Math.sin(performance.now() * 0.0018 + i) * 0.12; });
  renderer.render(scene, camera);
}

function start3DLoop() {
  if (animationStarted) return;
  animationStarted = true;
  loop();
}

socket.on("matchStarted", data => {
  playerId = playerId || socket.id;
  currentState = "playing";
  $("matchTitle").textContent = `${data.mode} — ${data.map}`;
  show("game");
  resizeArena();
  setMapTheme(data.map);
  collectedCrystals = 0;
  activeCheckpoint = 0;
  lastObjectiveScoreAt = 0;
  const objective = $("arenaObjective");
  if (objective) {
    const mode = String(data.mode || "");
    objective.textContent = mode === "Zone Control" ? "ZONE CONTROL // HOLD THE GLOWING RINGS" :
      mode === "Checkpoint Rally" ? "CHECKPOINT RALLY // RUN THE COURSE" :
      mode === "Free Explore" ? "FREE EXPLORE // FIND YOUR OWN PATH" : "CRYSTAL HUNT // 0 / 8";
  }
  const abilityLabel = $("abilityStatus"); if (abilityLabel) abilityLabel.textContent = "ABILITY // " + selectedAbility.toUpperCase() + " // READY";

  // Give the local player a visible starting model immediately. The server's
  // authoritative players event replaces this temporary entry as soon as it
  // arrives, avoiding an empty arena if that event is delayed.
  if (!players.length && playerId) {
    players = [{ id: playerId, name: name(), team: myTeam, x: 400, y: 250, hp: 100 }];
    updatePlayers();
  }
  start3DLoop();
});

socket.on("players", data => {
  players = data;
  updatePlayers();
});
socket.on("chatMessage", data => {
  const feed = $("chatMessages");
  if (!feed || !data) return;
  const row = document.createElement("div");
  row.className = "chat-line";
  const who = document.createElement("strong"); who.textContent = String(data.name || "Player") + ": ";
  const message = document.createElement("span"); message.textContent = String(data.message || "");
  row.append(who, message); feed.appendChild(row);
  while (feed.children.length > 40) feed.firstChild.remove();
  feed.scrollTop = feed.scrollHeight;
});
function sendChatMessage(event) {
  event?.preventDefault();
  const input = $("chatInput");
  if (!input || !input.value.trim()) return;
  socket.emit("chatMessage", input.value.trim().slice(0,180));
  input.value = "";
}

function resizeArena() {
  const width = Math.max(320, arena.clientWidth || arena.parentElement.clientWidth || 960);
  const height = Math.max(420, Math.min(window.innerHeight * 0.78, width * 0.58));
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


/* Local prototype credits/shop. Replace with server-backed accounts before public monetization. */
const SHOP_KEY = "reloadshot.shop.v1";
const PROMO_KEY = "reloadshot.promos.v1";
const SHOP_ITEMS = { arctic: "ARCTIC PULSE", sunforged: "SUNFORGED", void: "VOID CIRCUIT" };
const PROMO_CODES = { FRONTIER100: { credits: 100 }, RELOADBONUS: { credits: 250 }, SCOUTDROP: { credits: 50, item: "arctic" } };
function readShop(){ try { return JSON.parse(localStorage.getItem(SHOP_KEY)) || {credits:250,owned:[]}; } catch { return {credits:250,owned:[]}; } }
function saveShop(data){ localStorage.setItem(SHOP_KEY,JSON.stringify(data)); renderShop(); }
function openShop(){ $("shopPanel").scrollIntoView({behavior:"smooth",block:"start"}); renderShop(); }
function renderShop(){ const data=readShop(); const balance=$("coinBalance"); if(!balance)return; balance.textContent=data.credits; document.querySelectorAll(".shop-item").forEach((card,i)=>{const id=Object.keys(SHOP_ITEMS)[i];const button=card.querySelector("button");const owned=data.owned.includes(id);button.disabled=owned;button.textContent=owned?"OWNED":"UNLOCK";}); $("ownedItems").textContent=data.owned.length?"UNLOCKED FINISHES: "+data.owned.map(id=>SHOP_ITEMS[id]).join(" · "):"No finishes unlocked yet."; }
function buyShopItem(id,cost){const data=readShop();if(!SHOP_ITEMS[id])return;if(data.owned.includes(id)){ $("shopMessage").textContent="You already own this finish.";return;}if(data.credits<cost){$("shopMessage").textContent="Not enough credits yet. Try a promo code.";return;}data.credits-=cost;data.owned.push(id);$("shopMessage").textContent=SHOP_ITEMS[id]+" unlocked on this browser.";saveShop(data);}
function redeemPromo(){const input=$("promoInput");const code=input.value.trim().toUpperCase();const used=JSON.parse(localStorage.getItem(PROMO_KEY)||"[]");const reward=PROMO_CODES[code];if(!reward){$("shopMessage").textContent="Code not recognized.";return;}if(used.includes(code)){$("shopMessage").textContent="That code has already been used on this browser.";return;}const data=readShop();data.credits+=reward.credits||0;if(reward.item&&!data.owned.includes(reward.item))data.owned.push(reward.item);used.push(code);localStorage.setItem(PROMO_KEY,JSON.stringify(used));input.value="";$("shopMessage").textContent="Code claimed! "+(reward.credits||0)+" frontier credits added"+(reward.item?" and "+SHOP_ITEMS[reward.item]+" style unlocked.":".");saveShop(data);}
document.addEventListener("DOMContentLoaded",renderShop);


/* Quest board: one-time browser-local prototype rewards. */
const QUEST_KEY="reloadshot.quests.v1";
const QUESTS=[{id:"welcome",title:"WELCOME TO THE FRONTIER",description:"Claim your first mission reward.",reward:50,goal:"One-time starter mission"},{id:"shopvisit",title:"GEAR UP",description:"Visit the Frontier Exchange shop.",reward:40,goal:"Open the Shop"},{id:"promo",title:"CODE BREAKER",description:"Redeem a valid promo code in the Shop.",reward:75,goal:"Redeem any promo code"},{id:"loadout",title:"OPERATOR STYLE",description:"Open the Loadout Studio and check your gear.",reward:40,goal:"Open Loadout Studio"}];
function readQuests(){try{return JSON.parse(localStorage.getItem(QUEST_KEY))||{claimed:[],progress:[]};}catch{return{claimed:[],progress:[]};}}
function markQuestProgress(id){const data=readQuests();if(!data.progress.includes(id))data.progress.push(id);localStorage.setItem(QUEST_KEY,JSON.stringify(data));renderQuests();}
function openQuests(){const panel=$("questPanel");if(panel)panel.scrollIntoView({behavior:"smooth",block:"start"});renderQuests();}
function renderQuests(){const list=$("questList");if(!list)return;const data=readQuests();const shop=readShop();$("questCredits").textContent=shop.credits;list.innerHTML=QUESTS.map(q=>{const claimed=data.claimed.includes(q.id);const done=q.id==="welcome"||data.progress.includes(q.id);return '<article class="quest-card"><h3>'+q.title+'</h3><p>'+q.description+'<br><span>'+q.goal+'</span></p><div class="quest-reward"><strong>+'+q.reward+' ◉ CREDITS</strong><button class="quest-claim" '+(claimed||!done?'disabled':'')+' onclick="claimQuest(\''+q.id+'\')">'+(claimed?'CLAIMED':done?'CLAIM REWARD':'IN PROGRESS')+'</button></div></article>';}).join("");}
function claimQuest(id){const q=QUESTS.find(x=>x.id===id);if(!q)return;const data=readQuests();if(data.claimed.includes(id))return;const done=id==="welcome"||data.progress.includes(id);if(!done)return;data.claimed.push(id);localStorage.setItem(QUEST_KEY,JSON.stringify(data));const shop=readShop();shop.credits+=q.reward;saveShop(shop);renderQuests();}
const originalOpenShop=window.openShop;window.openShop=function(){if(originalOpenShop)originalOpenShop();markQuestProgress("shopvisit");};
const originalRedeemPromo=window.redeemPromo;window.redeemPromo=function(){const before=JSON.parse(localStorage.getItem(PROMO_KEY)||"[]").length;if(originalRedeemPromo)originalRedeemPromo();const after=JSON.parse(localStorage.getItem(PROMO_KEY)||"[]").length;if(after>before)markQuestProgress("promo");};
const originalOpenLoadout=window.openLoadoutStudio;window.openLoadoutStudio=function(){if(originalOpenLoadout)originalOpenLoadout();markQuestProgress("loadout");};
window.addEventListener("DOMContentLoaded",()=>{renderQuests();const splash=$("loadingCredit");if(splash){setTimeout(()=>{splash.classList.add("done");setTimeout(()=>splash.remove(),450);},1400);}});
