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

socket.on("matchStarted", data => {
  $("matchTitle").textContent = `${data.mode} — ${data.map}`;
  show("game");
  requestAnimationFrame(loop);
});

socket.on("players", data => {
  players = data;
});

const canvas = $("arena");
const ctx = canvas.getContext("2d");

document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener("click", e => {
  if (currentState !== "playing") return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * canvas.width / rect.width;
  const my = (e.clientY - rect.top) * canvas.height / rect.height;

  // Arcade-style tag: clicking near an opponent gives your team a point.
  const hit = players.find(p => p.id !== playerId && p.team !== myTeam &&
    Math.hypot(p.x-mx,p.y-my) < 28);

  if (hit) socket.emit("score", {team: myTeam});
});

function loop() {
  if (currentState !== "playing") return;

  const me = players.find(p => p.id === playerId);
  if (me) {
    let speed = 4;
    if (keys["w"] || keys["arrowup"]) me.y -= speed;
    if (keys["s"] || keys["arrowdown"]) me.y += speed;
    if (keys["a"] || keys["arrowleft"]) me.x -= speed;
    if (keys["d"] || keys["arrowright"]) me.x += speed;
    me.x = Math.max(15, Math.min(785, me.x));
    me.y = Math.max(15, Math.min(485, me.y));
    socket.emit("playerMove", {x:me.x,y:me.y});
  }

  draw();
  requestAnimationFrame(loop);
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  const t = Date.now() / 1000;

  // Dark neon arena
  ctx.fillStyle = "#080d1c";
  ctx.fillRect(0, 0, w, h);

  // Glowing grid
  ctx.strokeStyle = "rgba(50, 220, 255, 0.16)";
  ctx.lineWidth = 1;

  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  for (let y = 0; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Glowing players
  for (const p of players) {
    const color = teamColors[p.team] || "#ffffff";

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 19 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x - 3, p.y - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    // Player name
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#080d1c";
    ctx.strokeText(p.name, p.x, p.y - 27);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(p.name, p.x, p.y - 27);

    ctx.restore();
  }

  // Controls
  ctx.fillStyle = "rgba(235,245,255,0.8)";
  ctx.font = "11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("MOVE: WASD / ARROWS | CLICK: TAG", 18, h - 17);
}

setInterval(() => {
  if (currentState === "playing") draw();
}, 100);
