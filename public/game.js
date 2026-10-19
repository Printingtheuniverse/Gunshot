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
scene.background = new THREE.Color(0x070b16);
scene.fog = new THREE.Fog(0x070b16, 35, 100);

const camera = new THREE.PerspectiveCamera(65, 800 / 500, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(800, 500);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.cssText =
  "display:block;width:100%;height:auto;border-radius:10px;cursor:crosshair";
arena.replaceChildren(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9bbcff, 0x151525, 2));

const mainLight = new THREE.DirectionalLight(0xffffff, 3);
mainLight.position.set(-8, 18, 10);
mainLight.castShadow = true;
scene.add(mainLight);

const blueLight = new THREE.PointLight(0x168bff, 100, 40);
blueLight.position.set(-15, 5, -8);
scene.add(blueLight);

const redLight = new THREE.PointLight(0xff244f, 100, 40);
redLight.position.set(15, 5, 8);
scene.add(redLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 50),
  new THREE.MeshStandardMaterial({
    color: 0x101a2b,
    metalness: 0.8,
    roughness: 0.35
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(80, 40, 0x168bff, 0x243b58);
grid.position.y = 0.025;
scene.add(grid);

function addBox(x, y, z, sx, sy, sz, color, emissive = 0x000000) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.65,
      roughness: 0.3,
      emissive,
      emissiveIntensity: 1
    })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Arena walls and glowing trim
addBox(0, 2, -25, 80, 4, 1, 0x17263a);
addBox(0, 2, 25, 80, 4, 1, 0x17263a);
addBox(-40, 2, 0, 1, 4, 50, 0x17263a);
addBox(40, 2, 0, 1, 4, 50, 0x17263a);
addBox(0, 3.8, -24.4, 78, 0.12, 0.12, 0x168bff, 0x168bff);
addBox(0, 3.8, 24.4, 78, 0.12, 0.12, 0xff244f, 0xff244f);

// Cover crates
for (const [x, z] of [
  [-18, -10], [-8, 8], [8, -8], [18, 10],
  [-24, 5], [24, -5], [0, -16], [0, 16]
]) {
  addBox(x, 1.2, z, 3.5, 2.4, 3.5, 0x29394d);
  addBox(x, 2.43, z, 3.7, 0.12, 3.7, 0x168bff, 0x06264d);
}

const teamMaterials = teamColors.map(color =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
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
    color: 0x202b3c,
    metalness: 0.8,
    roughness: 0.28
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
