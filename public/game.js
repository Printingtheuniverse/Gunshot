const socket = io();
let roomId = null;
let playerId = null;
let keys = {};
let players = [];
let currentState = "voting";
let myTeam = 0;
const teamColors = ["#4da3ff","#ff5c5c","#4ddc88","#ffd34d"];

const $ = id => document.getElementById(id);
function openPanel(id){document.body.classList.add("panel-open");document.querySelectorAll(".panel-page").forEach(p=>p.classList.toggle("panel-page-active",p.id===id));$(id)?.classList.remove("hidden");window.scrollTo(0,0);}
function closePanel(){document.body.classList.remove("panel-open");document.querySelectorAll(".panel-page").forEach(p=>p.classList.remove("panel-page-active"));$("loadoutStudio")?.classList.add("hidden");window.scrollTo(0,0);}
function openLeaderboard(){openPanel("leaderboardPanel");}
const show = id => document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === id));

function name() {
  return ($("playerName").value.trim() || "Player").slice(0,18);
}


const characters = [
  { name: "NOVA", description: "Frontier scout · Precision-built ceramic armor.", className: "avatar-nova" },
  { name: "BOLT", description: "Rapid-response explorer · Angular pulse plating.", className: "avatar-bolt" },
  { name: "MOSS", description: "Recon specialist · Rugged field-ready armor.", className: "avatar-moss" },
  { name: "ORBIT", description: "Signal navigator · Orbital sensor crown and violet energy trim.", className: "avatar-orbit" },
  { name: "EMBER", description: "Solar wanderer · Heat-shield plates and amber glow.", className: "avatar-ember" },
  { name: "AURORA", description: "Glacier navigator · Frosted alloy armor and polar light.", className: "avatar-aurora" },
  { name: "CIPHER", description: "Signal phantom · Stealth plating and spectral violet trim.", className: "avatar-cipher" }
];
let selectedCharacter = 0;
let selectedAvatarColor = "#63e6ff";

const EXPLORER_PROFILE_KEY = "reloadShotExplorerProfileV1";
function saveExplorerProfile() {
  try {
    localStorage.setItem(EXPLORER_PROFILE_KEY, JSON.stringify({
      name: ($("playerName")?.value || "").trim().slice(0,18),
      character: selectedCharacter,
      color: selectedAvatarColor
    }));
  } catch (error) {}
}
function restoreExplorerProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(EXPLORER_PROFILE_KEY) || "null");
    if (!saved || typeof saved !== "object") return;
    const allowedColors = ["#63e6ff","#a78bfa","#ffad66","#8be0a2","#ff78c8","#ffd36e"];
    const input = $("playerName");
    if (input && typeof saved.name === "string") input.value = saved.name.slice(0,18);
    const playerName = (input?.value || "").trim();
    if ($("profileNamePreview")) $("profileNamePreview").textContent = (playerName || "ARENA EXPLORER").toUpperCase();
    if ($("miniAvatar") && playerName) $("miniAvatar").textContent = playerName.charAt(0).toUpperCase();
    if ($("commandPlayerName") && playerName) $("commandPlayerName").textContent = playerName.toUpperCase();
    if (Number.isInteger(saved.character)) selectCharacter(saved.character);
    if (allowedColors.includes(saved.color)) {
      const swatch = [...document.querySelectorAll(".swatch")].find(item => item.getAttribute("style")?.includes(saved.color));
      setAvatarColor(saved.color, swatch || null);
    }
  } catch (error) {}
}

function selectCharacter(index) {
  selectedCharacter = (index + characters.length) % characters.length;
  const character = characters[selectedCharacter];
  $("characterName").textContent = character.name;
  $("characterDescription").textContent = character.description;
  $("characterCount").textContent = String(selectedCharacter + 1).padStart(2, "0") + " / " + String(characters.length).padStart(2, "0");
  $("avatarFigure").className = "avatar-figure " + character.className;
  document.querySelectorAll(".character-dots .dot").forEach((dot, i) => dot.classList.toggle("active", i === selectedCharacter));
  $("miniAvatar").textContent = character.name.charAt(0);
  saveExplorerProfile();
}

function changeCharacter(direction) {
  selectCharacter(selectedCharacter + direction);
}

function setAvatarColor(color, button) {
  selectedAvatarColor = color;
  document.documentElement.style.setProperty("--avatar-accent", color);
  document.querySelectorAll(".swatch").forEach(swatch => swatch.classList.toggle("active", swatch === button));
  const names = { "#63e6ff": "Neon cyan", "#a78bfa": "Violet pulse", "#ffad66": "Solar orange", "#8be0a2": "Mint glow", "#ff78c8": "Rose flare", "#ffd36e": "Starlight gold" };
  $("styleSummary").textContent = names[color] || "Custom color";
  saveExplorerProfile();
}

document.addEventListener("input", event => {
  if (event.target && event.target.id === "playerName") {
    const value = event.target.value.trim();
    $("profileNamePreview").textContent = (value || "ARENA EXPLORER").toUpperCase().slice(0, 18);
    $("miniAvatar").textContent = (value || "A").charAt(0).toUpperCase();
    saveExplorerProfile();
  }
});

function showServers() {
  // The command-center PLAY buttons must work for first-time visitors too.
  // Previously an empty name field caused a silent return, making every
  // PLAY / QUICK MATCH button appear broken.
  const input = $("playerName");
  if (input && !input.value.trim()) input.value = "Explorer";
  const playerName = name();
  if ($("profileNamePreview")) $("profileNamePreview").textContent = playerName.toUpperCase();
  if ($("miniAvatar")) $("miniAvatar").textContent = playerName.charAt(0).toUpperCase();
  if ($("commandPlayerName")) $("commandPlayerName").textContent = playerName.toUpperCase();
  show("servers");
}

function createServer() {
  socket.emit("createRoom", {name: name()});
}

function joinByCode() {
  socket.emit("joinRoom", {id: $("roomCode").value.trim(), name: name()});
}

socket.on("connect", () => playerId = socket.id);
socket.on("frontierLeaderboard", rows => renderFrontierLeaderboard(rows));
function renderFrontierLeaderboard(rows) {
  const roots = [$("frontierLeaderboard"),$("fullLeaderboard")].filter(Boolean);
  if (!roots.length) return;
  roots.forEach(root=>{ root.replaceChildren();
  const title = document.createElement("strong");
  title.className = "frontier-board-title";
  title.textContent = "LIVE FRONTIER RANKINGS";
  root.appendChild(title);
  const spacer = document.createElement("div");
  spacer.className = "frontier-board-spacer";
  spacer.setAttribute("aria-hidden","true");
  root.appendChild(spacer);
  const note = document.createElement("small");
  note.className = "frontier-board-note";
  note.textContent = "Session XP · resets when the game server restarts";
  root.appendChild(note);
  if (!rows || !rows.length) {
    const empty = document.createElement("span");
    empty.className = "frontier-board-empty";
    empty.textContent = "Play a match to earn your first ranking points.";
    root.appendChild(empty);
    return;
  }
  rows.slice(0,10).forEach(row => {
    const item = document.createElement("div");
    item.className = "frontier-board-row";
    const rank = document.createElement("b");
    rank.textContent = "#" + row.rank;
    const name = document.createElement("span");
    name.textContent = String(row.name || "Explorer").slice(0,18);
    const stat = document.createElement("strong");
    stat.textContent = String(row.points || 0) + " XP";
    item.append(rank,name,stat);
    root.appendChild(item);
  });
  });
}

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
    markQuestProgress("firstmatch");
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

function renderPlayerLeaderboard(roster) {
  const root = $("playerLeaderboard");
  if (!root) return;
  const ranked = [...(roster || [])].sort((a,b) =>
    (Number(b.eliminations)||0) - (Number(a.eliminations)||0) ||
    String(a.name||"").localeCompare(String(b.name||""))
  ).slice(0,5);
  const localPlayer = (roster || []).find(player => player.id === playerId);
  const healthRoot = $("playerHealth");
  if (healthRoot) {
    const hp = Math.max(0, Math.min(100, Number(localPlayer?.hp ?? 100)));
    const value = healthRoot.querySelector("strong");
    const fill = healthRoot.querySelector("em");
    if (value) value.textContent = hp + "%";
    if (fill) fill.style.width = hp + "%";
  }
  root.replaceChildren();
  const heading = document.createElement("strong");
  heading.className = "player-leaderboard-title";
  heading.textContent = "MATCH LEADERBOARD";
  root.appendChild(heading);
  if (!ranked.length) {
    const empty = document.createElement("span");
    empty.className = "player-leaderboard-empty";
    empty.textContent = "Waiting for explorers...";
    root.appendChild(empty);
    return;
  }
  ranked.forEach((player,index) => {
    const item = document.createElement("span");
    item.className = "player-leaderboard-entry" + (player.id === playerId ? " is-you" : "");
    const rank = document.createElement("b");
    rank.textContent = String(index+1).padStart(2,"0");
    const name = document.createElement("span");
    name.textContent = String(player.name || "Explorer").slice(0,18) + (player.id === playerId ? " · YOU" : "");
    const score = document.createElement("strong");
    score.textContent = String(Number(player.eliminations)||0) + " ELIMS";
    item.append(rank,name,score);
    root.appendChild(item);
  });
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
let cameraPitch = 0.32;
let cameraDistance = 8.5;
let targetCameraDistance = 8.5;
let cameraYawVelocity = 0;
let cameraPitchVelocity = 0;
let moveFacing = 0;
let hasMovedFacing = false;
let cameraDragging = false;
let cameraDragMoved = false;
let lastGestureWasDrag = false;
let lastPointerX = 0;
let lastPointerY = 0;
let lastPointerDownAt = 0;
let jumpVelocity = 0;
let abilityCooldown = 0;
let abilityRequested = false;
let vehicleActive = false;
function updateVehicleHud() {
  const label = $("vehicleStatus");
  if (label) label.textContent = vehicleActive ? "MOUNTED · FAST TRAVEL ACTIVE · Press V to dismount" : "PARKED · Press V to mount";
  if (vehicleGroup) vehicleGroup.visible = vehicleActive;
}
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
  // Far perimeter beacons and monumental gates make the arena feel like a world,
  // not a small boxed room. These sit outside the central combat routes.
  const perimeterMat = new THREE.MeshStandardMaterial({color:0x203e57,metalness:0.78,roughness:0.24,emissive:0x0b4260,emissiveIntensity:0.65});
  const beaconMat = new THREE.MeshBasicMaterial({color:t.accent});
  for (const [x,z,scale] of [[-98,-64,1],[0,-70,1.25],[98,-64,1],[-108,0,.9],[108,0,.9],[-98,64,1],[0,70,1.25],[98,64,1]]) {
    add(new THREE.BoxGeometry(2.8,13*scale,2.8),perimeterMat,x,6.5*scale,z);
    add(new THREE.TorusGeometry(2.3*scale,.13,8,28),beaconMat,x,10.2*scale,z,1,1,1);
    add(new THREE.BoxGeometry(3.8,.24,3.8),perimeterMat,x,13*scale,z);
  }

  if (mapName === "Glass Dunes") {
    // Signature sandstone arch, mesas and glass spires make this map recognizable from spawn.
    const duneStone = mat(0xb87943), duneLight = mat(0xffd28a,0x7a3d18);
    add(new THREE.TorusGeometry(12,1.25,10,48,Math.PI*1.15),duneStone,0,8,-39,1.35,1.15,0.72).rotation.z=Math.PI;
    for (const [x,z,h,r] of [[-48,-30,16,7],[48,-28,19,8],[-48,28,13,6],[48,30,17,7]]) {
      add(new THREE.CylinderGeometry(r*.78,r,h,7),duneStone,x,h/2,z);
      add(new THREE.ConeGeometry(r*1.2,4,7),mat(0xd99a58),x,h+2,z);
    }
    for (const [x,z,h] of [[-17,-34,9],[18,-30,12],[-34,8,7],[34,6,10]]) {
      add(new THREE.OctahedronGeometry(1.8,0),duneLight,x,h/2,z,1.1,h/2,1.1);
    }
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
    // Broken elevated transit bridge and monumental gate frame the ruined city.
    const ruinMetal=mat(0x586486,0x202b60), ruinGlow=mat(0x8ceaff,0x247cce);
    for (const [x,z] of [[-48,-36],[-24,-36],[24,-36],[48,-36]]) {
      add(new THREE.BoxGeometry(1.6,15,1.6),ruinMetal,x,7.5,z);
      add(new THREE.BoxGeometry(2.8,.55,2.8),ruinGlow,x,15.2,z);
    }
    add(new THREE.BoxGeometry(54,.8,3.2),ruinMetal,0,12,-36);
    add(new THREE.BoxGeometry(20,.45,3.5),ruinGlow,-17,12.55,-36);
    add(new THREE.BoxGeometry(20,.45,3.5),ruinGlow,18,12.55,-36);
    for(const [x,z] of [[-42,34],[42,34]]) {
      add(new THREE.BoxGeometry(5,18,5),ruinMetal,x,9,z);
      add(new THREE.TorusGeometry(4,.28,8,32),ruinGlow,x,18,z,1,1,1);
    }
    for (const [x,z,h] of [[-30,-12,9],[-20,13,5],[23,-16,11],[31,12,7],[-4,-20,6],[8,18,9]]) {
      add(new THREE.BoxGeometry(4,h,4),mat(0x454d70),x,h/2,z);
      add(new THREE.BoxGeometry(5.4,.35,4.8),mat(0x9ba9e8,0x323e80),x,h,z);
      add(new THREE.BoxGeometry(2,.18,1.8),mat(0x7ceaff,0x1c7fa5),x,h+.22,z);
    }
    for (const [x,z] of [[-10,-7],[11,6],[-25,5],[24,-4]]) add(new THREE.BoxGeometry(8,.5,2),mat(0x747d9c),x,2.5,z);
    for (const [x,z] of [[-28,-17],[-20,14],[22,-16],[29,13],[-5,-19],[7,18]]) { add(new THREE.BoxGeometry(2.6,7,2.6),mat(0x666c83),x,3.5,z); add(new THREE.BoxGeometry(3.4,.45,3.4),mat(0xa5a9c3),x,7,z); }
    for (let i=0;i<10;i++) add(new THREE.TetrahedronGeometry(1.3),mat(0x777b91),((i*13)%55)-27,.7,((i*19)%38)-19,1.3,.8,1.1);
  } else if (mapName === "Aurora Grove") {
    // Aurora Grove gets its own tall bioluminescent forest and glowing ground pools.
    const auroraTrunk=mat(0x315e60), auroraGlow=mat(0x8eeed2,0x238f9c);
    for(let i=0;i<28;i++){
      const x=((i*29)%112)-56, z=((i*37)%76)-38;
      if(Math.abs(x)<10 && Math.abs(z)<10)continue;
      const height=5+(i*7)%6;
      add(new THREE.CylinderGeometry(.22,.48,height,8),auroraTrunk,x,height/2,z);
      add(new THREE.SphereGeometry(1.8,14,10),mat(i%2?0x4dbd9d:0x8790db,0x235b73),x,height+.4,z,1.3,1.0,1.25);
      add(new THREE.SphereGeometry(.28,10,8),new THREE.MeshBasicMaterial({color:i%2?0x8effdb:0xbca7ff}),x,height+2,z);
    }
    for(const [x,z] of [[-36,-22],[36,-20],[-34,24],[34,22]]){
      add(new THREE.CylinderGeometry(5.5,6.5,.22,32),mat(0x176c75,0x0c4e73),x,.12,z);
      add(new THREE.TorusGeometry(5.8,.16,8,36),new THREE.MeshBasicMaterial({color:0x8bfff0}),x,.24,z);
    }
    for(let i=0;i<18;i++){
      const x=((i*13)%100)-50,z=((i*17)%68)-34;
      if(Math.abs(x)<9&&Math.abs(z)<9)continue;
      add(new THREE.ConeGeometry(.8,2.4,6),mat(0x5c8cbd,0x3d4cb0),x,1.2,z);
    }
  } else {
    // Luminous Gardens: crystalline flower beds, glowing monoliths and curved garden walks.
    const gardenStone=mat(0x397a72,0x124b4b), gardenCrystal=mat(0x8effd9,0x37bfa3);
    for(const [x,z,h] of [[-38,-28,12],[38,-28,15],[-40,28,10],[40,28,13],[-20,38,8],[22,38,11]]){
      add(new THREE.OctahedronGeometry(2.1,1),gardenCrystal,x,h/2,z,1,h/1.7,1);
      add(new THREE.CylinderGeometry(.7,1.2,h/2,7),gardenStone,x,h/4,z);
      add(new THREE.TorusGeometry(2.6,.12,8,28),new THREE.MeshBasicMaterial({color:0x75ffd2}),x,h*.72,z,1,1,1);
    }
    for(const [x,z] of [[-28,-8],[-14,22],[14,-22],[28,8]]){
      add(new THREE.TorusGeometry(5,.28,8,40,Math.PI*1.3),gardenStone,x,2.6,z,1,1.25,1);
      add(new THREE.SphereGeometry(.5,12,8),new THREE.MeshBasicMaterial({color:0x9effdd}),x,4.2,z);
    }
    for (let i=0;i<24;i++) {
      const x=((i*17)%68)-34, z=((i*23)%42)-21;
      if(Math.abs(x)<8 && Math.abs(z)<8) continue;
      add(new THREE.CylinderGeometry(.18,.32,3,7),mat(0x335e62),x,1.5,z);
      add(new THREE.SphereGeometry(1.6,12,9),mat(i%2?0x58bba4:0x8e83d8,i%2?0x2a967f:0x6352b5),x,3.5,z,1.1,.75,1.1);
    }
    for (let i=0;i<16;i++) { const x=((i*19)%64)-32, z=((i*11)%40)-20; if(Math.abs(x)<7 && Math.abs(z)<7) continue; const color=i%2?0x3c9b77:0x5cba9d; add(new THREE.CylinderGeometry(.22,.42,2.4,7),mat(0x4a6b60),x,1.2,z); add(new THREE.IcosahedronGeometry(1.8,1),mat(color,color),x,3.1,z,0.78,0.82,0.78); }
    for (let i=0;i<12;i++) add(new THREE.SphereGeometry(.14,8,6),new THREE.MeshBasicMaterial({color:t.secondary}),((i*9)%54)-27,1.4+(i%4),((i*17)%36)-18);
  }
  mainLight.position.set(-8, mapName==="Glass Dunes"?25:18, 10); mainLight.intensity=mapName==="Glass Dunes"?3.8:3.1;
  resizeArena();
}
scene.background = new THREE.Color(0x071326);
scene.fog = new THREE.Fog(0x17212b, 85, 235);

// Cinematic orbital sky: procedural atmospheric gradient, distant ringed world,
// and layered orbital rings. Built from geometry/shaders—no external assets.
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(220, 48, 32),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDirection; void main(){ vDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vDirection; void main(){ float h=max(vDirection.y,0.0); vec3 horizon=vec3(0.035,0.12,0.22); vec3 zenith=vec3(0.008,0.018,0.065); float band=pow(max(0.0,1.0-abs(vDirection.y-0.18)*3.0),5.0); vec3 aurora=mix(vec3(0.02,0.36,0.52),vec3(0.22,0.10,0.48),smoothstep(-0.1,0.8,vDirection.x))*band*0.42; gl_FragColor=vec4(mix(horizon,zenith,smoothstep(0.0,0.82,h))+aurora,1.0); }'
  })
);
skyDome.renderOrder = -10;
scene.add(skyDome);

const orbitalWorld = new THREE.Group();
orbitalWorld.position.set(56, 53, 158);
scene.add(orbitalWorld);
const planetMat = new THREE.MeshPhysicalMaterial({color:0x557eaa, roughness:0.82, metalness:0.04, clearcoat:0.25, emissive:0x102b4c, emissiveIntensity:0.32});
const planet = new THREE.Mesh(new THREE.SphereGeometry(16, 48, 32), planetMat);
orbitalWorld.add(planet);
const planetClouds = new THREE.Mesh(
  new THREE.SphereGeometry(16.12, 48, 32),
  new THREE.MeshBasicMaterial({color:0x8bdcff, transparent:true, opacity:0.12, wireframe:true})
);
orbitalWorld.add(planetClouds);
const ringGold = new THREE.MeshStandardMaterial({color:0x9ec9e7, metalness:0.62, roughness:0.28, emissive:0x173c62, emissiveIntensity:0.55, side:THREE.DoubleSide});
const planetRingA = new THREE.Mesh(new THREE.TorusGeometry(22,0.72,8,128),ringGold);
planetRingA.scale.y=0.28; planetRingA.rotation.x=0.12; orbitalWorld.add(planetRingA);
const planetRingB = new THREE.Mesh(new THREE.TorusGeometry(26,0.22,6,128),new THREE.MeshBasicMaterial({color:0x65dfff,transparent:true,opacity:0.7,side:THREE.DoubleSide}));
planetRingB.scale.y=0.28; planetRingB.rotation.x=0.12; orbitalWorld.add(planetRingB);
const orbitalMoon = new THREE.Mesh(new THREE.SphereGeometry(4.2,24,18),new THREE.MeshStandardMaterial({color:0x9aaec5,roughness:0.95,metalness:0.02}));
orbitalMoon.position.set(-42,18,188); scene.add(orbitalMoon);
const distantSun = new THREE.Group();
distantSun.position.set(-105,82,190);
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(7,24,18),new THREE.MeshBasicMaterial({color:0x9beaff}));
distantSun.add(sunDisc);
for(const [radius,opacity] of [[10,.18],[14,.09],[20,.045]]) {
  const halo=new THREE.Mesh(new THREE.SphereGeometry(radius,24,18),new THREE.MeshBasicMaterial({color:0x3caeff,transparent:true,opacity,depthWrite:false}));
  distantSun.add(halo);
}
scene.add(distantSun);

// Atmospheric starfield adds distant scale without affecting player controls.
const starPositions = new Float32Array(900 * 3);
for (let i = 0; i < 900; i++) {
  starPositions[i * 3] = ((i * 7919) % 240) - 120;
  starPositions[i * 3 + 1] = 12 + ((i * 3571) % 100);
  starPositions[i * 3 + 2] = -35 - ((i * 1877) % 150);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xb9eaff, size: 0.34, transparent: true, opacity: 0.72, sizeAttenuation: true, depthWrite: false });
const starfield = new THREE.Points(starGeometry, starMaterial);
scene.add(starfield);


const camera = new THREE.PerspectiveCamera(52, 1.6, 0.1, 420);
camera.position.set(0, 31, 38);
camera.lookAt(0, 0, 0);
scene.add(camera);
// Reuse the canvas already present in index.html. Do not nest a canvas
// inside another canvas; that creates an invisible/zero-sized render surface.
const renderer = new THREE.WebGLRenderer({ canvas: arena, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.domElement.style.cssText = "display:block;width:100%;height:100%;border-radius:10px;cursor:crosshair;touch-action:none;user-select:none";
function resizeArena() {
  const width = Math.max(320, arena.clientWidth || arena.parentElement.clientWidth || 960);
  const height = Math.max(480, Math.min(window.innerHeight * 0.78, width * 0.72));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resizeArena);
renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());
// Click once to capture the mouse; camera look then follows mouse movement
// continuously. Escape releases the pointer. No click-and-hold dragging.
renderer.domElement.addEventListener("click", () => {
  if (currentState === "playing" && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock?.();
  }
});
document.addEventListener("pointerlockchange", () => {
  cameraDragging = document.pointerLockElement === renderer.domElement;
});
document.addEventListener("mousemove", e => {
  if (!cameraDragging || currentState !== "playing") return;
  cameraYaw += e.movementX * 0.0025;
  cameraPitch = Math.max(-1.15, Math.min(1.15, cameraPitch - e.movementY * 0.0022));
});
renderer.domElement.addEventListener("wheel", e => {
  if (currentState !== "playing") return;
  e.preventDefault();
  // First-person view keeps a fixed eye position; wheel input is ignored.
}, {passive:false});

scene.add(new THREE.HemisphereLight(0xc8d9e8, 0x52606b, 2.1));

const mainLight = new THREE.DirectionalLight(0xfff3df, 3.1);
mainLight.position.set(-8, 18, 10);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.camera.left = -145;
mainLight.shadow.camera.right = 145;
mainLight.shadow.camera.top = 105;
mainLight.shadow.camera.bottom = -105;
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
  new THREE.PlaneGeometry(300, 220),
  new THREE.MeshStandardMaterial({
    color: 0x53616b,
    metalness: 0.48,
    roughness: 0.32
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Procedural high-frequency arena surface: brushed alloy grain, fine panel seams,
// edge markings and tiny fasteners. Generated locally, so no external asset load.
const floorCanvas = document.createElement("canvas");
floorCanvas.width = 512; floorCanvas.height = 512;
const floorCtx = floorCanvas.getContext("2d");
floorCtx.fillStyle = "#d8e1e6"; floorCtx.fillRect(0,0,512,512);
for(let i=0;i<18000;i++){
  const x=(i*7919)%512, y=(i*3571)%512, shade=150+((i*13)%80);
  floorCtx.fillStyle="rgba("+shade+","+shade+","+shade+",0.12)";
  floorCtx.fillRect(x,y,1+(i%3),1);
}
floorCtx.strokeStyle="rgba(30,68,88,.22)"; floorCtx.lineWidth=2;
for(let x=0;x<=512;x+=128){floorCtx.beginPath();floorCtx.moveTo(x,0);floorCtx.lineTo(x,512);floorCtx.stroke();}
for(let y=0;y<=512;y+=128){floorCtx.beginPath();floorCtx.moveTo(0,y);floorCtx.lineTo(512,y);floorCtx.stroke();}
floorCtx.strokeStyle="rgba(255,255,255,.48)"; floorCtx.lineWidth=1;
for(let x=8;x<512;x+=128)for(let y=8;y<512;y+=128){
  floorCtx.beginPath();floorCtx.arc(x,y,3,0,Math.PI*2);floorCtx.stroke();
  floorCtx.fillStyle="rgba(22,52,70,.25)";floorCtx.fillRect(x+10,y+10,24,2);
}
const floorTexture = new THREE.CanvasTexture(floorCanvas);
floorTexture.wrapS=floorTexture.wrapT=THREE.RepeatWrapping;
floorTexture.repeat.set(15,12);
floorTexture.colorSpace=THREE.SRGBColorSpace;
floorTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
floor.material.map=floorTexture;
floor.material.needsUpdate=true;

const terrainDetails = new THREE.Group();
scene.add(terrainDetails);
const panelMetal = new THREE.MeshStandardMaterial({color:0x617b8c,metalness:.78,roughness:.32});
const panelGlow = new THREE.MeshStandardMaterial({color:0x6deaff,emissive:0x159fc9,emissiveIntensity:1.15,metalness:.38,roughness:.2});
for(let x=-128;x<=128;x+=16){
  for(let z=-88;z<=88;z+=16){
    if(Math.abs(x)<7 && Math.abs(z)<7) continue;
    const plate=new THREE.Mesh(new THREE.BoxGeometry(7.4,.035,7.4),panelMetal);
    plate.position.set(x,.018,z); plate.receiveShadow=true; terrainDetails.add(plate);
    for(const side of [-1,1]){
      const seam=new THREE.Mesh(new THREE.BoxGeometry(.055,.025,5.9),panelGlow);
      seam.position.set(x+side*3.55,.045,z); terrainDetails.add(seam);
    }
  }
}

const grid = new THREE.GridHelper(300, 120, 0x607f91, 0x344956);
grid.position.y = 0.025;
scene.add(grid);

// Distant sci-fi skyline, orbital bridge, and a luminous moon add depth beyond the arena walls.
const skylineMaterial = new THREE.MeshStandardMaterial({color:0x182d42,metalness:0.72,roughness:0.3,emissive:0x07182c,emissiveIntensity:0.7});
for (let i=0;i<18;i++) {
  const x = -82 + i*9.6;
  const height = 9 + ((i*17)%13);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3.2,height,3.2),skylineMaterial);
  tower.position.set(x,height/2,-72-(i%3)*5);
  tower.castShadow = true;
  scene.add(tower);
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.9,0.18),new THREE.MeshBasicMaterial({color:i%2?0x49dfff:0xff8b75}));
  beacon.position.set(x,height+0.35,-72-(i%3)*5);
  scene.add(beacon);
}
const orbitalBridge = new THREE.Mesh(new THREE.TorusGeometry(39,0.42,10,120,Math.PI*1.18),new THREE.MeshStandardMaterial({color:0x59758b,metalness:0.86,roughness:0.22,emissive:0x12364c,emissiveIntensity:0.8}));
orbitalBridge.position.set(0,24,-88);
orbitalBridge.rotation.x = Math.PI/2;
scene.add(orbitalBridge);
const moon = new THREE.Mesh(new THREE.SphereGeometry(12,40,28),new THREE.MeshStandardMaterial({color:0x9fb9d0,roughness:0.92,metalness:0.02,emissive:0x263c59,emissiveIntensity:0.32}));
moon.position.set(48,39,-105);
scene.add(moon);
const moonHalo = new THREE.Mesh(new THREE.SphereGeometry(12.8,32,24),new THREE.MeshBasicMaterial({color:0x4d9bd0,transparent:true,opacity:0.08,side:THREE.BackSide}));
moonHalo.position.copy(moon.position);
scene.add(moonHalo);

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
addBox(0, 2, -60, 180, 4, 1, 0x344653);
addBox(0, 2, 60, 180, 4, 1, 0x17263a);
addBox(-90, 2, 0, 1, 4, 120, 0x17263a);
addBox(90, 2, 0, 1, 4, 120, 0x17263a);
addBox(0, 3.8, -59.4, 178, 0.12, 0.12, 0x5a9cb5, 0x163847);
addBox(0, 3.8, 59.4, 178, 0.12, 0.12, 0xc77969, 0x3d201d);

// Cover crates
for (const [x, z] of [
  [-18, -10], [-8, 8], [8, -8], [18, 10],
  [-24, 5], [24, -5], [0, -16], [0, 16]
]) {
  addBox(x, 1.2, z, 3.5, 2.4, 3.5, 0x53636c);
  addBox(x, 2.43, z, 3.7, 0.12, 3.7, 0x7897a5, 0x152e3a);
}


// Industrial frontier set dressing: structural steel, utility conduits, lamps, and worn floor panels.
// Signature skyline structures: illuminated orbital pylons and suspended transit arcs.
const architecturalSteel = new THREE.MeshStandardMaterial({color:0x263f55,metalness:0.82,roughness:0.24});
const luminousGlass = new THREE.MeshPhysicalMaterial({color:0x63dfff,metalness:0.28,roughness:0.12,transparent:true,opacity:0.42,emissive:0x126c99,emissiveIntensity:1.1,clearcoat:1,clearcoatRoughness:0.08});
for (const side of [-1,1]) {
  for (const z of [-34,-4,27]) {
    const x=side*48;
    const pylon=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.8,19,8),architecturalSteel);
    pylon.position.set(x,9.5,z); pylon.castShadow=true; pylon.receiveShadow=true; scene.add(pylon);
    const crown=new THREE.Mesh(new THREE.TorusGeometry(2.1,.16,10,40),new THREE.MeshBasicMaterial({color:side<0?0x43dfff:0xffa875}));
    crown.position.set(x,18.9,z); crown.rotation.x=Math.PI/2; scene.add(crown);
    const glass=new THREE.Mesh(new THREE.BoxGeometry(.22,12,.22),luminousGlass);
    glass.position.set(x-side*1.35,8,z); scene.add(glass);
  }
}
for (const z of [-32,30]) {
  const arch=new THREE.Mesh(new THREE.TorusGeometry(22,.42,12,96,Math.PI),architecturalSteel);
  arch.position.set(0,10,z); arch.rotation.z=Math.PI; arch.scale.set(1.35,1,1); arch.castShadow=true; scene.add(arch);
  const lightArc=new THREE.Mesh(new THREE.TorusGeometry(22,.075,8,96,Math.PI),new THREE.MeshBasicMaterial({color:0x53dfff}));
  lightArc.position.set(0,10.15,z); lightArc.rotation.z=Math.PI; lightArc.scale.set(1.35,1,1); scene.add(lightArc);
}
// Precision runway inlays and reflective floor panels guide the eye toward the arena core.
const laneMaterial=new THREE.MeshStandardMaterial({color:0x5b8da2,metalness:.72,roughness:.26,emissive:0x123b50,emissiveIntensity:.55});
for (const x of [-13,-11,11,13]) {
  const lane=new THREE.Mesh(new THREE.BoxGeometry(.12,.035,104),laneMaterial);
  lane.position.set(x,.045,0); scene.add(lane);
}
for (let z=-48;z<=48;z+=8) {
  const dash=new THREE.Mesh(new THREE.BoxGeometry(8,.04,.12),new THREE.MeshBasicMaterial({color:0x4fc9ec,transparent:true,opacity:.55}));
  dash.position.set(0,.052,z); scene.add(dash);
}
const centerSigil=new THREE.Mesh(new THREE.TorusGeometry(5.2,.12,10,96),new THREE.MeshStandardMaterial({color:0x8cecff,metalness:.45,roughness:.2,emissive:0x1b8db5,emissiveIntensity:1.25}));
centerSigil.rotation.x=Math.PI/2; centerSigil.position.y=.12; scene.add(centerSigil);
const centerCore=new THREE.Mesh(new THREE.CylinderGeometry(2.7,3.5,.16,48),new THREE.MeshPhysicalMaterial({color:0x193b56,metalness:.82,roughness:.18,clearcoat:1,emissive:0x0b5475,emissiveIntensity:.7}));
centerCore.position.y=.08; scene.add(centerCore);
// Fine atmospheric motes catch the colored arena lights.
const motePositions=new Float32Array(520*3);
for(let i=0;i<520;i++){
  motePositions[i*3]=((i*1877)%84)-42;
  motePositions[i*3+1]=.7+((i*3253)%19);
  motePositions[i*3+2]=((i*1297)%100)-50;
}
const moteGeometry=new THREE.BufferGeometry();
moteGeometry.setAttribute("position",new THREE.BufferAttribute(motePositions,3));
const motes=new THREE.Points(moteGeometry,new THREE.PointsMaterial({color:0x8feaff,size:.11,transparent:true,opacity:.48,depthWrite:false}));
scene.add(motes);

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
const navigationBeacons = new Set();
function beaconLightPulse(){
  const time=performance.now();
  const scale=0.92+Math.sin(time*0.003)*0.12;
  for(const beacon of navigationBeacons){
    beacon.children[0].scale.setScalar(scale);
    beacon.children[1].rotation.z+=0.012;
  }
}

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
const vehicleGroup = new THREE.Group();
const vehicleHullMat = new THREE.MeshStandardMaterial({color:0x172d42,metalness:.82,roughness:.22,emissive:0x063c55,emissiveIntensity:.8});
const vehicleGlowMat = new THREE.MeshStandardMaterial({color:0x38eaff,emissive:0x18cfff,emissiveIntensity:2.1,metalness:.3,roughness:.2});
const vehicleHull = new THREE.Mesh(new THREE.BoxGeometry(1.35,.34,2.05),vehicleHullMat);
vehicleHull.position.y=-.22; vehicleGroup.add(vehicleHull);
const vehicleCanopy = new THREE.Mesh(new THREE.SphereGeometry(.48,16,10),new THREE.MeshStandardMaterial({color:0x8cefff,transparent:true,opacity:.62,metalness:.45,roughness:.12}));
vehicleCanopy.scale.set(.85,.42,.9); vehicleCanopy.position.set(0,.02,-.18); vehicleGroup.add(vehicleCanopy);
for (const side of [-1,1]) {
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.35,.12,.62),vehicleHullMat);
  wing.position.set(side*.78,-.2,.2); wing.rotation.y=side*.12; vehicleGroup.add(wing);
  const thruster = new THREE.Mesh(new THREE.CylinderGeometry(.17,.22,.65,12),vehicleGlowMat);
  thruster.rotation.x=Math.PI/2; thruster.position.set(side*.78,-.32,.92); vehicleGroup.add(thruster);
}
vehicleGroup.visible=false; emergencyOperator.add(vehicleGroup);

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
    color: 0x111d2b,
    metalness: 0.78,
    roughness: 0.24
  });
  // Declare shared suit materials before any armor parts use them.
  const trim = new THREE.MeshStandardMaterial({color:0xb9cbd8,metalness:0.86,roughness:0.18});
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
    color: 0x9eafbd, metalness: 0.82, roughness: 0.2
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
  const variant = p.id === playerId ? selectedCharacter : [...identity].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7;
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
  } else if (variant === 5) {
    // Aurora explorer: luminous polar halo and swept shoulder fins.
    part(new THREE.TorusGeometry(0.38,0.045,8,24), glow, 0, 2.48, -0.02).rotation.x = Math.PI / 2;
    part(new THREE.ConeGeometry(0.12,0.48,5), material, -0.58, 1.86, -0.08).rotation.z = -0.9;
    part(new THREE.ConeGeometry(0.12,0.48,5), material, 0.58, 1.86, -0.08).rotation.z = 0.9;
    part(new THREE.OctahedronGeometry(0.16,1), teamGlow, 0, 1.52, 0.31);
  } else if (variant === 6) {
    // Cipher explorer: twin sensor masts and angular side armor.
    for (const side of [-1,1]) {
      part(new THREE.CylinderGeometry(0.035,0.055,0.42,8), material, side*0.22, 2.42, -0.03);
      part(new THREE.SphereGeometry(0.085,10,8), glow, side*0.22, 2.65, -0.03);
      part(new THREE.BoxGeometry(0.2,0.42,0.28), deepArmor, side*0.42, 1.56, -0.26);
    }
    part(new THREE.BoxGeometry(0.42,0.08,0.08), glow, 0, 2.16, 0.29);
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
  // Micro-details: segmented utility belt, luminous boot rails and wrist status bars.
  part(new THREE.BoxGeometry(0.62,0.11,0.13), deepArmor, 0, 1.02, 0.12);
  part(new THREE.BoxGeometry(0.16,0.075,0.045), signal, -0.24, 1.02, 0.205);
  part(new THREE.BoxGeometry(0.16,0.075,0.045), signal, 0.24, 1.02, 0.205);
  part(new THREE.BoxGeometry(0.055,0.22,0.045), signal, -0.66, 1.2, 0.12);
  part(new THREE.BoxGeometry(0.055,0.22,0.045), signal, 0.66, 1.2, 0.12);
  part(new THREE.BoxGeometry(0.32,0.045,0.045), signal, -0.2, 0.09, 0.27);
  part(new THREE.BoxGeometry(0.32,0.045,0.045), signal, 0.2, 0.09, 0.27);

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

  // Signature operator redesign: a larger sealed helmet, panoramic visor,
  // reinforced chest core, shoulder shells, and readable backpack silhouette.
  const helmetShell = new THREE.MeshStandardMaterial({color:0xe4f1f5,metalness:0.78,roughness:0.2});
  const visorGlass = new THREE.MeshStandardMaterial({color:0x061b2a,metalness:0.62,roughness:0.12,emissive:0x073b55,emissiveIntensity:1.15});
  const operatorAccents = [
    [0x55eaff,0x16b9ed],[0xffbd65,0xff7b2c],[0x8be6a6,0x2aa875],[0xb9a2ff,0x7959ed],[0xff91b9,0xe34b83]
  ];
  const operatorAccent = operatorAccents[variant] || operatorAccents[0];
  const signal = new THREE.MeshStandardMaterial({color:operatorAccent[0],emissive:operatorAccent[1],emissiveIntensity:2.0,metalness:0.3,roughness:0.18});
  // Helmet crown and broad luminous face shield.
  part(new THREE.SphereGeometry(0.31,20,14), helmetShell, 0, 2.13, -0.015).scale.set(1.08,0.94,0.98);
  part(new THREE.BoxGeometry(0.49,0.2,0.105), visorGlass, 0, 2.08, 0.275);
  part(new THREE.BoxGeometry(0.39,0.025,0.035), signal, 0, 2.205, 0.292);
  part(new THREE.BoxGeometry(0.09,0.12,0.045), signal, -0.31, 2.08, 0.08);
  part(new THREE.BoxGeometry(0.09,0.12,0.045), signal, 0.31, 2.08, 0.08);
  // Chest reactor and layered chest frame.
  part(new THREE.BoxGeometry(0.48,0.48,0.09), deepArmor, 0, 1.49, 0.245);
  part(new THREE.BoxGeometry(0.3,0.32,0.075), helmetShell, 0, 1.51, 0.305);
  part(new THREE.OctahedronGeometry(0.13,1), signal, 0, 1.53, 0.37);
  part(new THREE.BoxGeometry(0.18,0.055,0.035), material, -0.34, 1.57, 0.27);
  part(new THREE.BoxGeometry(0.18,0.055,0.035), material, 0.34, 1.57, 0.27);
  // Shoulder shells and compact thruster/backpack fins create a distinct silhouette.
  part(new THREE.SphereGeometry(0.32,16,12), helmetShell, -0.56, 1.76, -0.015).scale.set(1.08,0.72,0.9);
  part(new THREE.SphereGeometry(0.32,16,12), helmetShell, 0.56, 1.76, -0.015).scale.set(1.08,0.72,0.9);
  part(new THREE.BoxGeometry(0.22,0.62,0.28), deepArmor, -0.34, 1.57, -0.47);
  part(new THREE.BoxGeometry(0.22,0.62,0.28), deepArmor, 0.34, 1.57, -0.47);
  part(new THREE.BoxGeometry(0.12,0.42,0.08), signal, -0.34, 1.57, -0.625);
  part(new THREE.BoxGeometry(0.12,0.42,0.08), signal, 0.34, 1.57, -0.625);
  // Reinforced forearm guards and boot caps add detail at normal gameplay distance.
  part(new THREE.BoxGeometry(0.22,0.42,0.24), helmetShell, -0.54, 1.24, 0.12);
  part(new THREE.BoxGeometry(0.22,0.42,0.24), helmetShell, 0.54, 1.24, 0.12);
  part(new THREE.BoxGeometry(0.29,0.16,0.28), material, -0.2, 0.18, 0.22);
  part(new THREE.BoxGeometry(0.29,0.16,0.28), material, 0.2, 0.18, 0.22);

  // NEUROVOID-inspired visual language: graphite undersuit, sculpted ceramic
  // armor, sharp panel breaks, and restrained cyan/violet signal lighting.
  const voidGraphite = new THREE.MeshStandardMaterial({color:0x071321,metalness:0.86,roughness:0.22});
  const pearlCeramic = new THREE.MeshStandardMaterial({color:0xdce8ef,metalness:0.76,roughness:0.19});
  const smokedGlass = new THREE.MeshStandardMaterial({color:0x020d19,metalness:0.72,roughness:0.1,emissive:0x06243b,emissiveIntensity:0.9});
  const voidSignal = new THREE.MeshStandardMaterial({color:0x9df8ff,emissive:0x25cfff,emissiveIntensity:2.1,metalness:0.35,roughness:0.16});
  const violetSignal = new THREE.MeshStandardMaterial({color:0xb7a4ff,emissive:0x684cff,emissiveIntensity:1.5,metalness:0.28,roughness:0.2});
  // Helmet becomes a sealed, layered pilot shell with a wide dark faceplate.
  part(new THREE.SphereGeometry(0.34,24,18), pearlCeramic, 0, 2.08, 0.015).scale.set(1.02,0.96,0.92);
  part(new THREE.BoxGeometry(0.48,0.19,0.075), smokedGlass, 0, 2.095, 0.285);
  part(new THREE.BoxGeometry(0.33,0.025,0.025), voidSignal, 0, 2.19, 0.33);
  part(new THREE.BoxGeometry(0.075,0.12,0.08), voidGraphite, -0.29, 2.04, 0.04);
  part(new THREE.BoxGeometry(0.075,0.12,0.08), voidGraphite, 0.29, 2.04, 0.04);
  // Layered chest yoke, central luminous identity core, and split abdominal plates.
  part(new THREE.BoxGeometry(0.68,0.16,0.16), voidGraphite, 0, 1.79, 0.22);
  part(new THREE.BoxGeometry(0.25,0.31,0.09), pearlCeramic, 0, 1.51, 0.32);
  part(new THREE.OctahedronGeometry(0.105,1), voidSignal, 0, 1.53, 0.39);
  part(new THREE.BoxGeometry(0.17,0.055,0.035), violetSignal, -0.22, 1.31, 0.29);
  part(new THREE.BoxGeometry(0.17,0.055,0.035), violetSignal, 0.22, 1.31, 0.29);
  // Angular shoulder caps and forearm shells create a cleaner, more graphic outline.
  const shoulderL = part(new THREE.OctahedronGeometry(0.29,0), pearlCeramic,-0.56,1.77,0.02);
  shoulderL.scale.set(1.18,0.78,0.92);
  const shoulderR = part(new THREE.OctahedronGeometry(0.29,0), pearlCeramic,0.56,1.77,0.02);
  shoulderR.scale.set(1.18,0.78,0.92);
  part(new THREE.BoxGeometry(0.09,0.28,0.055), voidSignal, -0.56,1.77,0.205);
  part(new THREE.BoxGeometry(0.09,0.28,0.055), voidSignal, 0.56,1.77,0.205);
  part(new THREE.BoxGeometry(0.25,0.34,0.16), voidGraphite,-0.55,1.22,0.11);
  part(new THREE.BoxGeometry(0.25,0.34,0.16), voidGraphite,0.55,1.22,0.11);
  part(new THREE.BoxGeometry(0.09,0.2,0.035), pearlCeramic,-0.55,1.22,0.205);
  part(new THREE.BoxGeometry(0.09,0.2,0.035), pearlCeramic,0.55,1.22,0.205);
  // Backpack spine and paired vertical status lights.
  part(new THREE.BoxGeometry(0.42,0.62,0.16), voidGraphite,0,1.57,-0.43);
  part(new THREE.BoxGeometry(0.08,0.4,0.045), violetSignal,-0.13,1.58,-0.525);
  part(new THREE.BoxGeometry(0.08,0.4,0.045), voidSignal,0.13,1.58,-0.525);
  // Distinct visor/signal tint per operator variant while preserving team identity.
  if (variant === 1 || variant === 4) {
    part(new THREE.BoxGeometry(0.13,0.035,0.035), violetSignal,0,2.095,0.335);
  } else {
    part(new THREE.BoxGeometry(0.13,0.035,0.035), voidSignal,0,2.095,0.335);
  }

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
  navigationBeacons.add(beacon);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.045, 8, 32),
    material
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  group.scale.setScalar(1.12);
  scene.add(group);
  playerObjects.set(p.id, group);
  
  return group;
}

function makeNameSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 112;
  const c = canvas.getContext("2d");
  const label = String(text || "Player").slice(0, 18).toUpperCase();
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = "rgba(4, 13, 27, 0.88)";
  c.beginPath();
  c.roundRect(8, 8, 496, 96, 22);
  c.fill();
  c.strokeStyle = "rgba(99, 230, 255, 0.9)";
  c.lineWidth = 5;
  c.stroke();
  c.font = "bold 42px sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.shadowColor = "rgba(99, 230, 255, 0.8)";
  c.shadowBlur = 10;
  c.fillStyle = "#ffffff";
  c.fillText(label, 256, 58, 450);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  );
  sprite.scale.set(7.1, 1.55, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function updatePlayers() {
  const liveIds = new Set();
  const countLabel = $("arenaPlayerCount");
  if (countLabel) countLabel.textContent = `${players.length} / 16`;
  const squadLabel = $("arenaSquadStatus");
  if (squadLabel) squadLabel.textContent = `SQUAD ${String((myTeam || 0) + 1).padStart(2,"0")}`;
  const fieldLabel = $("arenaFieldStatus");
  if (fieldLabel) fieldLabel.textContent = currentState === "playing" ? "LIVE SESSION" : "SYNCING";

  for (const p of players) {
    liveIds.add(p.id);
    let model = playerObjects.get(p.id);
    if (!model) model = makePlayer(p);

    // Expanded server coordinates map onto the larger 3D world (1200 x 800).
    const x = (p.x - 600) * 0.23;
    const z = (p.y - 400) * 0.23;
    model.position.set(x, 0, z);

    const material = teamMaterials[p.team] || teamMaterials[0];
    model.children.forEach(child => {
      if (child.geometry?.type === "TorusGeometry") child.material = material;
    });

    if (!nameSprites.has(p.id)) {
      const label = makeNameSprite(p.name || "Player");
      label.position.set(0, 4.25, 0);
      model.add(label);
      nameSprites.set(p.id, label);
    }

    // Face toward the current movement direction.
    if (p.id === playerId && !hasMovedFacing) model.rotation.y = moveFacing;
  }

  for (const [id, model] of playerObjects) {
    if (!liveIds.has(id)) {
      scene.remove(model);
      model.traverse(object=>{if(object.userData.navigationBeacon)navigationBeacons.delete(object);});
      playerObjects.delete(id);
      nameSprites.delete(id);
    }
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const cyanGlowForShot = new THREE.MeshBasicMaterial({ color: 0x8df5ff });
const amberGlowForShot = new THREE.MeshBasicMaterial({ color: 0xffbb73 });

// Click to fire; crystal collection remains available when clicking a crystal.
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
  crystal.visible = false;
  scene.add(crystal);
  collectibleCrystals.push(crystal);
}
[[-22,-15],[22,-15],[-27,13],[27,13],[0,-20],[0,20],[-12,0],[12,0]].forEach((p,i)=>addDataCrystal(p[0],p[1],[0x8df5ff,0xb8a0ff,0x8be0a2,0xffd18a][i%4]));

renderer.domElement.addEventListener("click", event => {
  if (currentState !== "playing") return;
  if (lastGestureWasDrag || performance.now() - lastPointerDownAt > 220) { lastGestureWasDrag = false; return; }
  socket.emit("shoot");
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (!$("matchTitle")?.textContent.startsWith("Crystal Hunt")) return;
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
  if (key === "f" && !e.repeat && currentState === "playing") socket.emit("shoot");
  if ((key === " " || e.code === "Space") && !e.repeat && currentState === "playing" && !["INPUT","TEXTAREA"].includes(e.target?.tagName)) { jumpRequested = true; e.preventDefault(); }
  if (key === "e" && !e.repeat && currentState === "playing") abilityRequested = true;
  if (key === "v" && !e.repeat && currentState === "playing") { vehicleActive = !vehicleActive; updateVehicleHud(); }
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
  motes.rotation.y += 0.00016;
  starfield.rotation.y += 0.000025;
  orbitalWorld.rotation.y += 0.000018;
  planetClouds.rotation.y -= 0.000035;
  planetRingA.rotation.z += 0.000006;
  planetRingB.rotation.z -= 0.000009;
  const atmospherePulse = 0.88 + Math.sin(performance.now()*0.0007)*0.12;
  blueLight.intensity = 32 * atmospherePulse;
  redLight.intensity = 26 * (1.12-atmospherePulse*0.14);
  beaconLightPulse();

  if (currentState === "playing") {
    // Recover if the socket ID or player-list event arrived late.
    if (!playerId && socket.id) playerId = socket.id;
    if (!players.length && playerId) {
      players = [{ id: playerId, name: name(), team: myTeam, x: 600, y: 400, hp: 100 }];
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
      const moveSpeed = (keys["shift"] ? speed * 1.8 : speed) * (vehicleActive ? 2.15 : 1);
      const forward = (keys["w"] || keys["arrowup"] ? 1 : 0) - (keys["s"] || keys["arrowdown"] ? 1 : 0);
      const strafe = (keys["a"] || keys["arrowleft"] ? 1 : 0) - (keys["d"] || keys["arrowright"] ? 1 : 0);
      if (forward || strafe) {
        const magnitude = Math.hypot(forward, strafe) || 1;
        const f = forward / magnitude, side = strafe / magnitude, angle = cameraYaw;
        const dx = Math.sin(angle) * f + Math.cos(angle) * side;
        const dz = Math.cos(angle) * f - Math.sin(angle) * side;
        const proposedX = me.x + dx * moveSpeed;
        const proposedY = me.y + dz * moveSpeed;
        const nextX = (proposedX - 400) * 0.23, nextZ = (proposedY - 250) * 0.23;
        const currentX = (me.x - 600) * 0.23, currentZ = (me.y - 400) * 0.23;
        const crates = [[-18,-10],[-8,8],[8,-8],[18,10],[-24,5],[24,-5],[0,-16],[0,16]];
        const blocked = (wx,wz) => crates.some(([cx,cz]) => Math.abs(wx-cx)<2.47 && Math.abs(wz-cz)<2.47);
        if (Math.abs(nextX)<88 && Math.abs(nextZ)<55 && !blocked(nextX,nextZ)) { me.x=proposedX; me.y=proposedY; }
        else {
          if (Math.abs(nextX)<88 && !blocked(nextX,currentZ)) me.x=proposedX;
          if (Math.abs(nextZ)<55 && !blocked(currentX,nextZ)) me.y=proposedY;
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
      const skillStatus = $("fieldSkillStatus"); if (skillStatus) skillStatus.textContent = "SELECTED: " + selectedAbility.toUpperCase() + (abilityCooldown > 0 ? " · " + abilityCooldown.toFixed(1) + "s cooldown" : " · E READY");
      if (abilityRequested && abilityCooldown <= 0) { abilityRequested = false; if (selectedAbility === "Dash") { if(keys["w"]||keys["arrowup"]) me.y -= 90; else if(keys["s"]||keys["arrowdown"]) me.y += 90; else if(keys["a"]||keys["arrowleft"]) me.x -= 90; else me.x += 90; } else if (selectedAbility === "Shield") { const model = playerObjects.get(playerId); if (model) { const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.35,16,12),new THREE.MeshBasicMaterial({color:0x75eaff,transparent:true,opacity:0.22,wireframe:true})); bubble.position.y=1.2; model.add(bubble); setTimeout(()=>{model.remove(bubble);bubble.geometry.dispose();bubble.material.dispose();},1800); } } else if (selectedAbility === "Scanner") { collectibleCrystals.forEach(crystal => crystal.scale.setScalar(1.35)); setTimeout(() => collectibleCrystals.forEach(crystal => crystal.scale.setScalar(1)), 1200); } else if (selectedAbility === "Beacon") { const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.55,1),new THREE.MeshStandardMaterial({color:0x8df5ff,emissive:0x28cfff,emissiveIntensity:2})); beacon.position.set((me.x-600)*0.075,1.1,(me.y-400)*0.075); scene.add(beacon); setTimeout(()=>{scene.remove(beacon);beacon.geometry.dispose();beacon.material.dispose();},4000); } abilityCooldown = 4; }
      me.x = Math.max(0, Math.min(1200, me.x));
      me.y = Math.max(0, Math.min(800, me.y));
      const worldX = (me.x - 600) * 0.23;
      const worldZ = (me.y - 400) * 0.23;
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
    try { updatePlayers(); const localModel = playerObjects.get(playerId); if (localModel && vehicleGroup.parent !== localModel) { vehicleGroup.parent?.remove(vehicleGroup); localModel.add(vehicleGroup); } if (localModel) localModel.position.y = jumpHeight; emergencyOperator.position.y = jumpHeight; vehicleGroup.visible = vehicleActive; vehicleGroup.position.y = vehicleActive ? -0.15 + Math.sin(performance.now()*.004)*.07 : -0.22; } catch (error) { console.error("RELOAD-SHOT player model error:", error); }
    const targetPlayer = players.find(p => p.id === playerId) || players[0];
    const cameraTarget = targetPlayer ? playerObjects.get(targetPlayer.id) : null;
    const fallback = targetPlayer || { x: 600, y: 400 };
    const target = cameraTarget
      ? cameraTarget.position
      : new THREE.Vector3((fallback.x - 600) * 0.23, jumpHeight, (fallback.y - 400) * 0.23);
    const localModel = playerObjects.get(playerId);
    if (localModel) {
      localModel.visible = true;
      emergencyOperator.visible = false;
    } else {
      emergencyOperator.visible = true;
      emergencyOperator.position.set(target.x, jumpHeight, target.z);
    }
    // Third-person follow camera keeps the full explorer visible during play.
    // The viewmodel stays hidden so it cannot obscure the character.
    if (gunViewModel) gunViewModel.visible = false;
    const horizontalDistance = cameraDistance * Math.cos(cameraPitch * 0.25);
    const desiredCamera = new THREE.Vector3(
      target.x - Math.sin(cameraYaw) * horizontalDistance,
      target.y + 3.1,
      target.z - Math.cos(cameraYaw) * horizontalDistance
    );
    camera.position.lerp(desiredCamera, 0.2);
    camera.lookAt(target.x, target.y + 1.25, target.z);
  }

  lastFrameTime = performance.now();
  const crystalHuntActive = $("matchTitle")?.textContent.startsWith("Crystal Hunt") === true;
  collectibleCrystals.forEach((crystal, i) => { crystal.visible = crystalHuntActive; crystal.rotation.y += 0.008; crystal.position.y = Math.sin(performance.now() * 0.0018 + i) * 0.18; });
  renderer.render(scene, camera);
}

const GAME_TUTORIAL_KEY = "reloadshot.tutorial.seen.v1";
function openGameTutorial() {
  const modal = $("gameTutorial");
  if (!modal) return;
  const mode = $("matchTitle")?.textContent.split(" — ")[0] || "your match";
  const modeCopy = {
    "Crystal Hunt": "Collect the glowing data crystals around the arena. The counter tracks your team's progress.",
    "Zone Control": "Stand in the marked control zones and hold them for your team.",
    "Checkpoint Rally": "Run through the checkpoints in order and follow the route.",
    "Free Explore": "Explore the map, practice movement, and get comfortable with the arena."
  };
  const objective = modeCopy[mode] || "Learn the controls and explore the arena.";
  $("tutorialMode").textContent = "FIELD OBJECTIVE // " + objective;
  $("tutorialObjective").textContent = "YOUR MODE: " + mode.toUpperCase() + " — " + objective;
  modal.classList.remove("hidden");
}
function closeGameTutorial() {
  $("gameTutorial")?.classList.add("hidden");
  try { localStorage.setItem(GAME_TUTORIAL_KEY, "1"); } catch {}
}
window.openGameTutorial = openGameTutorial;
window.closeGameTutorial = closeGameTutorial;

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
  let tutorialSeen = false;
  try { tutorialSeen = localStorage.getItem(GAME_TUTORIAL_KEY) === "1"; } catch {}
  if (!tutorialSeen) openGameTutorial();
  setWeaponViewmodel();
  vehicleActive = false; updateVehicleHud();
  collectedCrystals = 0;
  collectibleCrystals.forEach(crystal => { crystal.visible = data.mode === "Crystal Hunt"; });
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
    players = [{ id: playerId, name: name(), team: myTeam, x: 600, y: 400, hp: 100 }];
    updatePlayers();
  }
  start3DLoop();
});

socket.on("players", data => {
  players = data;
  updatePlayers();
  renderPlayerLeaderboard(data);
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
function selectWeaponStyle(style, button) {
  document.querySelectorAll(".weapon-style-card").forEach(card => {
    const active = card.dataset.weaponStyle === style;
    card.classList.toggle("selected", active);
    const state = card.querySelector(".weapon-equipped");
    if (state) state.textContent = active ? "EQUIPPED" : "SELECT";
  });
  localStorage.setItem("reloadShotWeaponStyle", style);
}
const GUNS = {
  pulse: {name:"PULSE SCOUT",desc:"Balanced starter energy blaster",cost:0,color:0x55eaff,shape:"standard"},
  arc: {name:"ARC REPEATER",desc:"Rapid-response twin-core blaster",cost:120,color:0xffb65f,shape:"twin"},
  prism: {name:"PRISM LANCE",desc:"Long-range crystal energy caster",cost:220,color:0xb59aff,shape:"long"},
  nova: {name:"NOVA BURST",desc:"Heavy radiant pulse projector",cost:320,color:0x8ce8a4,shape:"heavy"}
};
const GUN_STORAGE_KEY="reloadshot.armory.v1";
let equippedGun="pulse";
let ownedGuns=["pulse"];
let gunViewModel=null;
function readGunInventory(){
  try{const saved=JSON.parse(localStorage.getItem(GUN_STORAGE_KEY)||"{}");ownedGuns=Array.isArray(saved.owned)?[...new Set(["pulse",...saved.owned.filter(id=>GUNS[id])])]:["pulse"];equippedGun=ownedGuns.includes(saved.equipped)?saved.equipped:"pulse";}
  catch{ownedGuns=["pulse"];equippedGun="pulse";}
}
function saveGunInventory(){localStorage.setItem(GUN_STORAGE_KEY,JSON.stringify({owned:ownedGuns,equipped:equippedGun}));}
function openArmory(){openPanel("armoryPanel");renderArmory();}
function renderArmory(){
  const grid=$("armoryGrid");if(!grid)return;
  const wallet=readShop();if($("armoryCredits"))$("armoryCredits").textContent=wallet.credits;
  grid.innerHTML=Object.entries(GUNS).map(([id,g])=>{
    const owned=ownedGuns.includes(id),equipped=equippedGun===id;
    const glow="#"+g.color.toString(16).padStart(6,"0");
    return '<article class="armory-card '+(equipped?"equipped":owned?"":"locked")+'" style="--gun-glow:'+glow+'"><span class="armory-state">'+(equipped?"EQUIPPED":owned?"UNLOCKED":"LOCKED")+'</span><div class="armory-art"><span class="armory-core"></span></div><h3>'+g.name+'</h3><p>'+g.desc+'</p><span class="armory-cost">'+(g.cost?g.cost+" ◉ CREDITS":"FREE STARTER")+'</span><button onclick="'+(owned?'equipGun(\''+id+'\')':'buyGun(\''+id+'\')')+'">'+(equipped?"CURRENTLY EQUIPPED":owned?"EQUIP WEAPON": "UNLOCK · "+g.cost+" ◉")+'</button></article>';
  }).join("");
}
function buyGun(id){
  const gun=GUNS[id];if(!gun||ownedGuns.includes(id))return;
  const wallet=readShop();if(wallet.credits<gun.cost){$("armoryMessage").textContent="Not enough credits yet. Earn more in the Quest Board or Style Shop.";return;}
  wallet.credits-=gun.cost;saveShop(wallet);ownedGuns.push(id);equippedGun=id;saveGunInventory();setWeaponViewmodel();renderArmory();
  $("armoryMessage").textContent=gun.name+" unlocked and equipped. Ready for your next match!";
}
function equipGun(id){
  if(!GUNS[id]||!ownedGuns.includes(id))return;
  equippedGun=id;saveGunInventory();setWeaponViewmodel();renderArmory();
  $("armoryMessage").textContent=GUNS[id].name+" equipped for your next match.";
}
function setWeaponViewmodel(){
  if(typeof camera==="undefined"||!camera)return;
  if(gunViewModel){camera.remove(gunViewModel);gunViewModel.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});}
  const g=GUNS[equippedGun]||GUNS.pulse;
  const group=new THREE.Group();
  const shell=new THREE.MeshStandardMaterial({color:0x263d52,metalness:.88,roughness:.2});
  const edge=new THREE.MeshStandardMaterial({color:0xc8e1ed,metalness:.82,roughness:.18});
  const glow=new THREE.MeshStandardMaterial({color:g.color,emissive:g.color,emissiveIntensity:2.1,metalness:.22,roughness:.18});
  const add=(geo,mat,x,y,z,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;group.add(m);};
  const long=g.shape==="long"||g.shape==="heavy";
  add(new THREE.BoxGeometry(long?.19:.23,.18,long?.92:.64),shell,0,0,0);
  add(new THREE.BoxGeometry(.13,.12,long?1.02:.68),edge,0,.08,-.04);
  add(new THREE.BoxGeometry(.08,.08,long?.74:.45),glow,0,.12,-.16);
  add(new THREE.BoxGeometry(.13,.25,.18),shell,0,-.18,.12);
  add(new THREE.CylinderGeometry(.075,.075,.06,12),glow,0,.02,-.52,1,1,1);
  add(new THREE.BoxGeometry(.32,.07,.22),edge,0,.12,.2);
  if(g.shape==="twin"){for(const x of [-.12,.12])add(new THREE.CylinderGeometry(.045,.055,.56,10),glow,x,.04,-.38,1,1,1);}
  if(g.shape==="long"){add(new THREE.BoxGeometry(.08,.25,.32),glow,0,.2,-.15);add(new THREE.TorusGeometry(.14,.025,8,20),glow,0,.04,-.62);}
  if(g.shape==="heavy"){add(new THREE.BoxGeometry(.36,.2,.28),edge,0,.08,-.1);add(new THREE.BoxGeometry(.08,.28,.32),glow,0,.12,-.12);}
  group.position.set(.43,-.37,-.78);group.rotation.set(-.08,-.12,.02);
  camera.add(group);gunViewModel=group;
}

function openLoadoutStudio() {
  const panel = $("loadoutStudio");
  if (!panel) return;
  openPanel("loadoutStudio");
  renderSavedLoadouts();
}
function closeLoadoutStudio(){closePanel();}
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


/* Browser-local game credits and cosmetic rewards. No real-money purchases. */
const SHOP_KEY = "reloadshot.shop.v1";
const DAILY_KEY = "reloadshot.daily.v1";
const QUEST_KEY = "reloadshot.quests.v1";
const SHOP_ITEMS = {
  aurora:{name:"AURORA SHELL",description:"Icy explorer suit accent",cost:120,icon:"✧",category:"suit"},
  comet:{name:"COMET TRAIL",description:"A luminous trail for your explorer",cost:160,icon:"☄",category:"trail"},
  starlight:{name:"STARLIGHT BADGE",description:"A bright profile emblem",cost:90,icon:"✦",category:"badge"},
  nebula:{name:"NEBULA SUIT",description:"Violet cosmic suit theme",cost:220,icon:"◈",category:"suit"},
  holo:{name:"HOLO NAMEPLATE",description:"A holographic profile frame",cost:140,icon:"▱",category:"nameplate"},
  orbit:{name:"ORBIT VICTORY",description:"A celebratory victory effect",cost:180,icon:"◎",category:"emote"},
  ion:{name:"ION AURA",description:"A soft electric glow around your explorer",cost:260,icon:"ϟ",category:"aura"},
  prism:{name:"PRISM VISOR",description:"A shifting rainbow visor highlight",cost:240,icon:"◇",category:"visor"},
  cometwing:{name:"COMET WINGS",description:"Decorative light fins for your profile",cost:320,icon:"✧",category:"banner"},
  drone:{name:"TINY ORBITER",description:"A friendly cosmetic companion marker",cost:360,icon:"◉",category:"companion"},
  pioneer:{name:"PIONEER TITLE",description:"A special title beneath your name",cost:200,icon:"✦",category:"title"},
  stardust:{name:"STARDUST EMOTE",description:"A sparkling celebration for your profile",cost:280,icon:"✺",category:"emote"}
};
function readShop(){
  try {
    const saved=JSON.parse(localStorage.getItem(SHOP_KEY)||"null")||{};
    const owned=Array.isArray(saved.owned)?[...new Set(saved.owned.filter(id=>SHOP_ITEMS[id]))]:[];
    const equipped=saved.equipped&&typeof saved.equipped==="object"?saved.equipped:{};
    return {credits:Math.max(0,Math.floor(Number(saved.credits??250)||0)),owned,equipped};
  } catch { return {credits:250,owned:[],equipped:{}}; }
}
function saveShop(data){
  localStorage.setItem(SHOP_KEY,JSON.stringify(data));
  renderShop();
  renderQuests();
  renderArmory();
}
function openShop(){openPanel("shopPanel");renderShop();}
function applyShopCosmetics(data){
  const equipped=Object.values(data.equipped||{}).filter(id=>data.owned.includes(id));
  const labels=equipped.map(id=>SHOP_ITEMS[id]?.name).filter(Boolean);
  const root=$("equippedCosmetics");
  if(root)root.textContent=labels.length?"EQUIPPED COSMETICS: "+labels.join(" · "):"No shop cosmetics equipped yet.";
  document.documentElement.dataset.shopSuit=data.equipped.suit||"";
  document.documentElement.dataset.shopTrail=data.equipped.trail||"";
  document.documentElement.dataset.shopBadge=data.equipped.badge||"";
  document.documentElement.dataset.shopNameplate=data.equipped.nameplate||"";
  document.documentElement.dataset.shopEmote=data.equipped.emote||"";
  document.documentElement.dataset.shopAura=data.equipped.aura||"";
  document.documentElement.dataset.shopVisor=data.equipped.visor||"";
  document.documentElement.dataset.shopBanner=data.equipped.banner||"";
  document.documentElement.dataset.shopCompanion=data.equipped.companion||"";
  document.documentElement.dataset.shopTitle=data.equipped.title||"";
}
function renderShop(){
  const data=readShop();
  const balance=$("coinBalance");
  if(balance)balance.textContent=data.credits;
  const dashboardBalance=$("dashboardCredits");
  if(dashboardBalance)dashboardBalance.textContent=data.credits;
  document.querySelectorAll(".shop-item[data-shop-id]").forEach(card=>{
    const id=card.dataset.shopId,item=SHOP_ITEMS[id],button=card.querySelector("button");
    if(!item||!button)return;
    const owned=data.owned.includes(id),equipped=data.equipped[item.category]===id;
    button.disabled=equipped;
    button.textContent=equipped?"EQUIPPED":owned?"EQUIP":"UNLOCK";
    button.onclick=()=>owned?equipShopItem(id):buyShopItem(id);
    const cost=card.querySelector(".shop-buy-row strong");
    if(cost)cost.textContent=item.cost+" ◉";
  });
  const owned=$("ownedItems");
  if(owned)owned.textContent=data.owned.length?"UNLOCKED COSMETICS: "+data.owned.map(id=>SHOP_ITEMS[id].name).join(" · "):"No cosmetics unlocked yet.";
  applyShopCosmetics(data);
  const armoryWallet=$("armoryCredits");
  if(armoryWallet)armoryWallet.textContent=data.credits;
}
function buyShopItem(id){
  const item=SHOP_ITEMS[id],data=readShop();
  if(!item||data.owned.includes(id))return;
  if(data.credits<item.cost){
    $("shopMessage").textContent="Not enough credits yet. Complete a mission or claim your daily reward.";
    return;
  }
  data.credits-=item.cost;
  data.owned.push(id);
  data.equipped[item.category]=id;
  saveShop(data);
  $("shopMessage").textContent=item.name+" unlocked and equipped!";
}
function equipShopItem(id){
  const item=SHOP_ITEMS[id],data=readShop();
  if(!item||!data.owned.includes(id))return;
  data.equipped[item.category]=id;
  saveShop(data);
  $("shopMessage").textContent=item.name+" equipped!";
}

/* Daily login reward: once per local calendar day, with a small capped streak bonus. */
function localDayKey(date=new Date()){
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
}
function readDaily(){
  try{return JSON.parse(localStorage.getItem(DAILY_KEY)||"{}")||{};}catch{return{};}
}
function renderDailyReward(){
  const saved=readDaily(),today=localDayKey();
  const buttons=[$("dailyClaimButton"),$("dailyDashboardClaimButton")].filter(Boolean);
  const status=$("dailyRewardStatus"),streak=$("dailyStreak");
  if(streak)streak.textContent="CURRENT STREAK: "+(Number(saved.streak)||0)+" DAYS";
  const claimed=saved.lastClaim===today;
  buttons.forEach(button=>{button.disabled=claimed;button.textContent=claimed?"CLAIMED REWARD":"CLAIM REWARD";});
  if(status)status.textContent=claimed?"Today's reward has already been claimed. Come back tomorrow!":"Your daily reward is ready: 50–120 credits.";
}
function claimDailyReward(){
  const buttons=[$("dailyClaimButton"),$("dailyDashboardClaimButton")].filter(Boolean);
  const status=$("dailyRewardStatus");
  try{
    const saved=readDaily(),today=localDayKey();
    if(saved.lastClaim===today){
      if(status)status.textContent="CLAIMED REWARD — today's credits have already been collected.";
      renderDailyReward();return;
    }
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    const nextStreak=saved.lastClaim===localDayKey(yesterday)?Math.min(7,(Number(saved.streak)||0)+1):1;
    const reward=50+(nextStreak-1)*10;
    const wallet=readShop();wallet.credits+=reward;
    localStorage.setItem(DAILY_KEY,JSON.stringify({lastClaim:today,streak:nextStreak}));
    localStorage.setItem(SHOP_KEY,JSON.stringify(wallet));
    renderShop();renderQuests();renderArmory();renderDailyReward();
    const message=$("shopMessage");if(message)message.textContent="Daily reward collected: +"+reward+" credits!";
  }catch(error){
    buttons.forEach(button=>{button.disabled=false;});
    if(status)status.textContent="Reward could not be saved. Please check browser storage and try again.";
  }
}

/* One-time missions and achievements, saved in this browser. */
const QUESTS=[
  {id:"welcome",title:"FIRST LANDING",description:"Collect your starter mission reward.",reward:50,goal:"Available from your first visit"},
  {id:"shopvisit",title:"STYLE EXPLORER",description:"Visit the Frontier Exchange.",reward:40,goal:"Open the cosmetic shop"},
  {id:"loadout",title:"IDENTITY DESIGNER",description:"Visit the Loadout Studio.",reward:40,goal:"Open the Loadout Studio"},
  {id:"firstmatch",title:"FIRST DEPLOYMENT",description:"Enter your first match.",reward:100,goal:"Join a match"}
];
function readQuests(){
  try{
    const data=JSON.parse(localStorage.getItem(QUEST_KEY)||"{}")||{};
    return {claimed:Array.isArray(data.claimed)?data.claimed:[],progress:Array.isArray(data.progress)?data.progress:[]};
  }catch{return{claimed:[],progress:[]};}
}
function markQuestProgress(id){
  const data=readQuests();
  if(!data.progress.includes(id)){data.progress.push(id);localStorage.setItem(QUEST_KEY,JSON.stringify(data));}
  renderQuests();
}
function openQuests(){openPanel("questPanel");renderQuests();}
function renderQuests(){
  const list=$("questList");
  if(!list)return;
  const data=readQuests(),wallet=readShop();
  if($("questCredits"))$("questCredits").textContent=wallet.credits;
  list.replaceChildren();
  QUESTS.forEach(quest=>{
    const claimed=data.claimed.includes(quest.id),done=quest.id==="welcome"||data.progress.includes(quest.id);
    const card=document.createElement("article");card.className="quest-card";
    const title=document.createElement("h3");title.textContent=quest.title;
    const description=document.createElement("p");description.textContent=quest.description+" · "+quest.goal;
    const row=document.createElement("div");row.className="quest-reward";
    const reward=document.createElement("strong");reward.textContent="+"+quest.reward+" ◉ CREDITS";
    const button=document.createElement("button");button.type="button";button.className="quest-claim";button.dataset.questId=quest.id;button.disabled=claimed||!done;
    button.textContent=claimed?"CLAIMED REWARD":done?"CLAIM REWARD":"IN PROGRESS";
    if(done&&!claimed){button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();claimQuest(quest.id);});}
    row.append(reward,button);card.append(title,description,row);list.appendChild(card);
  });
}
function claimQuest(id){
  const quest=QUESTS.find(item=>item.id===id);
  const feedback=$("questFeedback");
  if(!quest){if(feedback)feedback.textContent="That mission could not be found. Refresh and try again.";return;}
  const progress=readQuests();
  if(progress.claimed.includes(id)){if(feedback)feedback.textContent="CLAIMED REWARD — this mission reward was already collected.";renderQuests();return;}
  if(id!=="welcome"&&!progress.progress.includes(id)){if(feedback)feedback.textContent="Complete this mission before claiming its reward.";return;}
  try{
    const wallet=readShop();
    progress.claimed.push(id);
    localStorage.setItem(QUEST_KEY,JSON.stringify(progress));
    wallet.credits+=quest.reward;
    localStorage.setItem(SHOP_KEY,JSON.stringify(wallet));
    renderShop();renderArmory();renderQuests();
    if(feedback)feedback.textContent="REWARD CLAIMED: +"+quest.reward+" credits added!";
    const message=$("shopMessage");if(message)message.textContent=quest.title+" reward collected: +"+quest.reward+" credits.";
  }catch(error){
    if(feedback)feedback.textContent="Could not save this reward in this browser. Check storage settings and try again.";
  }
}
document.addEventListener("click",event=>{
  const button=event.target.closest("#questList button[data-quest-id]");
  if(button&&!button.disabled)claimQuest(button.dataset.questId);
});
const originalOpenShop=window.openShop;
window.openShop=function(){if(originalOpenShop)originalOpenShop();markQuestProgress("shopvisit");};
const originalOpenLoadout=window.openLoadoutStudio;
window.openLoadoutStudio=function(){if(originalOpenLoadout)originalOpenLoadout();markQuestProgress("loadout");};
document.addEventListener("DOMContentLoaded",()=>{
  [$("dailyClaimButton"),$("dailyDashboardClaimButton")].filter(Boolean).forEach(button=>{button.onclick=claimDailyReward;});
  restoreExplorerProfile();
  renderShop();readGunInventory();renderArmory();renderQuests();renderDailyReward();
  const splash=$("loadingCredit");
  if(splash){setTimeout(()=>{splash.classList.add("done");setTimeout(()=>splash.remove(),450);},1400);}
});