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
  { name: "MOSS", description: "Recon specialist · Rugged field-ready armor.", className: "avatar-moss" }
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
const weaponNames = ["PULSE RIFLE", "SIDEARM", "HEAVY BLASTER"];
let selectedWeapon = 0;

function setWeapon(index) {
  selectedWeapon = (index + weaponNames.length) % weaponNames.length;
  const label = document.getElementById("weaponStatus");
  if (label) label.textContent = "WEAPON // " + weaponNames[selectedWeapon] + "  ·  " + (selectedWeapon + 1);
  const ownModel = playerObjects.get(playerId);
  if (ownModel) ownModel.traverse(child => {
    if (child.userData.weaponSlot !== undefined) child.visible = child.userData.weaponSlot === selectedWeapon;
  });
}

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

  // Extra silhouette details make the arena avatars feel like distinct sci-fi explorers.
  const armor = new THREE.MeshStandardMaterial({
    color: 0x9db7c5, metalness: 0.62, roughness: 0.3
  });
  const deepArmor = new THREE.MeshStandardMaterial({
    color: 0x172b3a, metalness: 0.5, roughness: 0.4
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0xd9fbff, emissive: 0x56dfff, emissiveIntensity: 0.85,
    metalness: 0.25, roughness: 0.25
  });
  // Stable per-player silhouette variants keep every explorer visually distinct.
  const identity = String(p.id || p.name || "scout");
  const variant = [...identity].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
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
  } else {
    // Compact sensor mast and side-mounted utility pack
    part(new THREE.CylinderGeometry(0.055, 0.075, 0.36, 8), material, 0.25, 2.42, -0.02);
    part(new THREE.SphereGeometry(0.1, 10, 8), glow, 0.25, 2.62, -0.02);
    part(new THREE.BoxGeometry(0.18, 0.42, 0.25), armor, -0.34, 1.56, -0.28);
  }
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

  // Three stylized, selectable sci-fi weapon models. These are visual game props.
  const weaponMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x263d4d, metalness: 0.82, roughness: 0.28 }),
    new THREE.MeshStandardMaterial({ color: 0x8198a5, metalness: 0.78, roughness: 0.25 }),
    new THREE.MeshStandardMaterial({ color: 0x152633, metalness: 0.72, roughness: 0.34 })
  ];
  const weaponGlow = new THREE.MeshStandardMaterial({
    color: 0xbff8ff, emissive: 0x36dfff, emissiveIntensity: 1.8,
    metalness: 0.2, roughness: 0.2
  });
  const amberGlow = new THREE.MeshStandardMaterial({
    color: 0xffd1a0, emissive: 0xff873d, emissiveIntensity: 1.6,
    metalness: 0.2, roughness: 0.25
  });
  function weaponPart(parent, geometry, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const rifle = new THREE.Group();
  weaponPart(rifle, new THREE.BoxGeometry(0.23, 0.22, 0.72), weaponMaterials[0], 0, 0, 0);
  weaponPart(rifle, new THREE.BoxGeometry(0.14, 0.16, 0.42), weaponMaterials[1], 0, 0.07, -0.47);
  weaponPart(rifle, new THREE.CylinderGeometry(0.055, 0.055, 0.58, 10), weaponMaterials[2], 0, 0.02, -0.78, Math.PI / 2);
  weaponPart(rifle, new THREE.BoxGeometry(0.11, 0.055, 0.32), weaponGlow, 0, 0.14, -0.18);
  weaponPart(rifle, new THREE.BoxGeometry(0.12, 0.24, 0.18), weaponMaterials[2], 0, -0.19, 0.1, -0.22);
  weaponPart(rifle, new THREE.BoxGeometry(0.14, 0.08, 0.17), weaponMaterials[1], 0, 0.16, 0.12);
  const sidearm = new THREE.Group();
  weaponPart(sidearm, new THREE.BoxGeometry(0.19, 0.2, 0.38), weaponMaterials[1], 0, 0, 0);
  weaponPart(sidearm, new THREE.BoxGeometry(0.13, 0.12, 0.26), weaponMaterials[0], 0, 0.06, -0.27);
  weaponPart(sidearm, new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8), weaponMaterials[2], 0, 0.03, -0.43, Math.PI / 2);
  weaponPart(sidearm, new THREE.BoxGeometry(0.1, 0.045, 0.2), weaponGlow, 0, 0.12, -0.04);
  weaponPart(sidearm, new THREE.BoxGeometry(0.12, 0.23, 0.14), weaponMaterials[2], 0, -0.17, 0.08, -0.18);
  const heavy = new THREE.Group();
  weaponPart(heavy, new THREE.BoxGeometry(0.31, 0.28, 0.6), weaponMaterials[2], 0, 0, 0);
  weaponPart(heavy, new THREE.CylinderGeometry(0.105, 0.13, 0.52, 10), weaponMaterials[1], 0, 0.02, -0.52, Math.PI / 2);
  weaponPart(heavy, new THREE.CylinderGeometry(0.14, 0.14, 0.12, 10), amberGlow, 0, 0.02, -0.81, Math.PI / 2);
  weaponPart(heavy, new THREE.BoxGeometry(0.16, 0.08, 0.36), amberGlow, 0, 0.18, -0.1);
  weaponPart(heavy, new THREE.BoxGeometry(0.16, 0.3, 0.2), weaponMaterials[0], 0, -0.23, 0.12, -0.2);
  const weaponRack = new THREE.Group();
  weaponRack.position.set(0.53, 1.28, -0.22);
  weaponRack.rotation.y = 0;
  [rifle, sidearm, heavy].forEach((weaponModel, index) => {
    weaponModel.userData.weaponSlot = index;
    weaponModel.visible = index === 0;
    weaponRack.add(weaponModel);
  });
  group.add(weaponRack);
  // Make the rack itself easy to identify when updating the selected weapon.
  weaponRack.userData.weaponRack = true;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.045, 8, 32),
    material
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  scene.add(group);
  playerObjects.set(p.id, group);
  if (p.id === playerId) setWeapon(selectedWeapon);
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
const cyanGlowForShot = new THREE.MeshBasicMaterial({ color: 0x8df5ff });
const amberGlowForShot = new THREE.MeshBasicMaterial({ color: 0xffbb73 });

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
  const ownModel = playerObjects.get(playerId);
  if (ownModel) {
    const muzzleOrigin = new THREE.Vector3();
    ownModel.getWorldPosition(muzzleOrigin);
    muzzleOrigin.y += 1.42;
    muzzleOrigin.x += 0.48;
    muzzleOrigin.z -= 0.62;
    const flashMaterial = selectedWeapon === 2 ? amberGlowForShot : cyanGlowForShot;
    const flash = new THREE.Mesh(new THREE.SphereGeometry(selectedWeapon === 2 ? 0.16 : 0.1, 8, 6), flashMaterial);
    flash.position.copy(muzzleOrigin);
    scene.add(flash);
    const shotEnd = hit.length ? hit[0].point.clone() : muzzleOrigin.clone().add(new THREE.Vector3(
      (pointer.x * 12), 0, -16 + pointer.y * 4
    ));
    const beamGeometry = new THREE.BufferGeometry().setFromPoints([muzzleOrigin, shotEnd]);
    const beam = new THREE.Line(beamGeometry, new THREE.LineBasicMaterial({
      color: selectedWeapon === 2 ? 0xffa45e : selectedWeapon === 1 ? 0xa9f8ff : 0x43e6ff,
      transparent: true, opacity: 0.9
    }));
    scene.add(beam);
    window.setTimeout(() => {
      scene.remove(flash);
      flash.geometry.dispose();
      scene.remove(beam);
      beam.geometry.dispose();
      beam.material.dispose();
    }, 110);
  }
  if (hit.length) socket.emit("score", { team: myTeam });
});

document.addEventListener("keydown", e => {
  if (!e.key) return;
  const key = e.key.toLowerCase();
  if (key === "1" || key === "2" || key === "3") setWeapon(Number(key) - 1);
  keys[key] = true;
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

      // If the socket ID has not synced yet, still frame a received player model.
      const model = playerObjects.get(playerId) || (players.length ? playerObjects.get(players[0].id) : null);
      if (model) {
        // Closer follow camera: keep the local operator large enough to see during play.
        camera.position.set(
          model.position.x + 1.2,
          7.5,
          model.position.z + 10
        );
        camera.lookAt(
          model.position.x,
          1.15,
          model.position.z
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


/* Local prototype credits/shop. Replace with server-backed accounts before public monetization. */
const SHOP_KEY = "reloadshot.shop.v1";
const PROMO_KEY = "reloadshot.promos.v1";
const SHOP_ITEMS = { arctic: "ARCTIC PULSE", sunforged: "SUNFORGED", void: "VOID CIRCUIT" };
const PROMO_CODES = { FRONTIER100: { credits: 100 }, RELOADBONUS: { credits: 250 }, SCOUTDROP: { credits: 50, item: "arctic" }, QASIM2COOL: { credits: 100, item: "sunforged" } };
function readShop(){ try { return JSON.parse(localStorage.getItem(SHOP_KEY)) || {credits:250,owned:[]}; } catch { return {credits:250,owned:[]}; } }
function saveShop(data){ localStorage.setItem(SHOP_KEY,JSON.stringify(data)); renderShop(); }
function openShop(){ $("shopPanel").scrollIntoView({behavior:"smooth",block:"start"}); renderShop(); }
function renderShop(){ const data=readShop(); const balance=$("coinBalance"); if(!balance)return; balance.textContent=data.credits; document.querySelectorAll(".shop-item").forEach((card,i)=>{const id=Object.keys(SHOP_ITEMS)[i];const button=card.querySelector("button");const owned=data.owned.includes(id);button.disabled=owned;button.textContent=owned?"OWNED":"UNLOCK";}); $("ownedItems").textContent=data.owned.length?"UNLOCKED FINISHES: "+data.owned.map(id=>SHOP_ITEMS[id]).join(" · "):"No finishes unlocked yet."; }
function buyShopItem(id,cost){const data=readShop();if(!SHOP_ITEMS[id])return;if(data.owned.includes(id)){ $("shopMessage").textContent="You already own this finish.";return;}if(data.credits<cost){$("shopMessage").textContent="Not enough credits yet. Try a promo code.";return;}data.credits-=cost;data.owned.push(id);$("shopMessage").textContent=SHOP_ITEMS[id]+" unlocked on this browser.";saveShop(data);}
function redeemPromo(){const input=$("promoInput");const code=input.value.trim().toUpperCase();const used=JSON.parse(localStorage.getItem(PROMO_KEY)||"[]");const reward=PROMO_CODES[code];if(!reward){$("shopMessage").textContent="Code not recognized.";return;}if(used.includes(code)){$("shopMessage").textContent="That code has already been used on this browser.";return;}const data=readShop();data.credits+=reward.credits||0;if(reward.item&&!data.owned.includes(reward.item))data.owned.push(reward.item);used.push(code);localStorage.setItem(PROMO_KEY,JSON.stringify(used));input.value="";$("shopMessage").textContent="Code claimed! "+(reward.credits||0)+" credits added"+(reward.item?" and "+SHOP_ITEMS[reward.item]+" unlocked.":".");saveShop(data);}
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
