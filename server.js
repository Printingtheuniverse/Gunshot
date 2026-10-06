const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 16;

const rooms = new Map();
const colors = ["#4da3ff", "#ff5c5c", "#4ddc88", "#ffd34d"];
const modes = ["2 Teams", "Capture the Flag", "Free For All", "Team Elimination"];
const maps = ["Battleground", "Desert", "Rocky Valley", "Forest"];

function makeRoom(id, hostName) {
  return {
    id,
    hostId: null,
    players: [],
    modeVotes: {},
    mapVotes: {},
    state: "voting",
    mode: null,
    map: null,
    countdown: 0,
    scores: [0, 0, 0, 0]
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    players: room.players.length,
    maxPlayers: MAX_PLAYERS,
    state: room.state,
    mode: room.mode,
    map: room.map
  };
}

function roomList() {
  return [...rooms.values()].map(publicRoom);
}

function broadcastRooms() {
  io.emit("rooms", roomList());
}

function sendLobby(room) {
  io.to(room.id).emit("lobbyState", {
    players: room.players.map(p => ({
      id: p.id, name: p.name, team: p.team, ready: p.ready
    })),
    modeVotes: room.modeVotes,
    mapVotes: room.mapVotes,
    mode: room.mode,
    map: room.map,
    state: room.state,
    countdown: room.countdown,
    scores: room.scores
  });
}

function findRoomForSocket(socket) {
  return [...rooms.values()].find(r => r.players.some(p => p.id === socket.id));
}

function getPlayer(room, socketId) {
  return room?.players.find(p => p.id === socketId);
}

function startMatch(room) {
  if (!room || room.state === "playing") return;

  const modeEntries = Object.entries(room.modeVotes);
  const mapEntries = Object.entries(room.mapVotes);

  room.mode = modeEntries.length
    ? modeEntries.sort((a,b) => b[1]-a[1])[0][0]
    : modes[0];

  room.map = mapEntries.length
    ? mapEntries.sort((a,b) => b[1]-a[1])[0][0]
    : maps[0];

  room.state = "countdown";
  room.countdown = 5;
  sendLobby(room);

  const timer = setInterval(() => {
    room.countdown--;
    if (room.countdown <= 0) {
      clearInterval(timer);
      room.state = "playing";
      room.countdown = 0;
      sendLobby(room);
      io.to(room.id).emit("matchStarted", {
        mode: room.mode, map: room.map
      });
    } else {
      sendLobby(room);
    }
  }, 1000);
}

io.on("connection", socket => {
  socket.emit("rooms", roomList());

  socket.on("createRoom", ({ name }) => {
    const clean = String(name || "Player").slice(0, 18);
    let id;
    do id = Math.random().toString(36).slice(2, 7).toUpperCase();
    while (rooms.has(id));

    const room = makeRoom(id, clean);
    room.hostId = socket.id;
    rooms.set(id, room);

    room.players.push({
      id: socket.id, name: clean, team: 0, ready: false,
      x: 100, y: 100, hp: 100
    });

    socket.join(id);
    socket.data.roomId = id;
    socket.emit("joinedRoom", { id });
    sendLobby(room);
    broadcastRooms();
  });

  socket.on("joinRoom", ({ id, name }) => {
    const room = rooms.get(String(id || "").toUpperCase());
    if (!room) return socket.emit("errorMessage", "Server not found.");
    if (room.players.length >= MAX_PLAYERS) return socket.emit("errorMessage", "Server is full.");
    if (room.state === "playing") return socket.emit("errorMessage", "Match already started.");

    const clean = String(name || "Player").slice(0, 18);
    room.players.push({
      id: socket.id, name: clean, team: room.players.length % 4, ready: false,
      x: 100 + Math.random()*400, y: 100 + Math.random()*300, hp: 100
    });

    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.emit("joinedRoom", { id: room.id });
    sendLobby(room);
    broadcastRooms();
  });

  socket.on("chooseTeam", team => {
    const room = findRoomForSocket(socket);
    const player = getPlayer(room, socket.id);
    team = Number(team);
    if (!room || !player || !Number.isInteger(team) || team < 0 || team > 3) return;
    player.team = team;
    sendLobby(room);
  });

  socket.on("voteMode", mode => {
    const room = findRoomForSocket(socket);
    if (!room || room.state !== "voting" || !modes.includes(mode)) return;
    room.modeVotes[mode] = (room.modeVotes[mode] || 0) + 1;
    sendLobby(room);
  });

  socket.on("voteMap", map => {
    const room = findRoomForSocket(socket);
    if (!room || room.state !== "voting" || !maps.includes(map)) return;
    room.mapVotes[map] = (room.mapVotes[map] || 0) + 1;
    sendLobby(room);
  });

  socket.on("ready", () => {
    const room = findRoomForSocket(socket);
    const player = getPlayer(room, socket.id);
    if (!room || !player || room.state !== "voting") return;
    player.ready = !player.ready;
    sendLobby(room);

    if (room.players.length >= 2 && room.players.every(p => p.ready)) {
      startMatch(room);
    }
  });

  socket.on("playerMove", data => {
    const room = findRoomForSocket(socket);
    const player = getPlayer(room, socket.id);
    if (!room || !player || room.state !== "playing") return;

    player.x = Math.max(15, Math.min(785, Number(data.x) || player.x));
    player.y = Math.max(15, Math.min(485, Number(data.y) || player.y));

    io.to(room.id).emit("players", room.players.map(p => ({
      id: p.id, name: p.name, team: p.team, x: p.x, y: p.y, hp: p.hp
    })));
  });

  socket.on("score", ({ team }) => {
    const room = findRoomForSocket(socket);
    team = Number(team);
    if (!room || room.state !== "playing" || team < 0 || team > 3) return;
    room.scores[team]++;
    sendLobby(room);
  });

  socket.on("disconnect", () => {
    const room = findRoomForSocket(socket);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.hostId === socket.id) {
      room.hostId = room.players[0]?.id || null;
    }

    if (room.players.length === 0) {
      rooms.delete(room.id);
    } else {
      sendLobby(room);
    }
    broadcastRooms();
  });
});

server.listen(PORT, () => {
  console.log(`Battle Arena running on http://localhost:${PORT}`);
});