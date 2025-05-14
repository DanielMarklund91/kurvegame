const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));
app.use('/src', express.static(path.join(__dirname, 'src')));

// Display startup message
console.log('Starting Enhanced Kurve Game with power-ups and particle effects!');

// WebSocket server setup for collaborative features
const lobbies = {
  'Lobby 1': { players: [], inputs: {}, scores: {} },
  'Lobby 2': { players: [], inputs: {}, scores: {} },
  'Lobby 3': { players: [], inputs: {}, scores: {} },
  'Lobby 4': { players: [], inputs: {}, scores: {} },
};

const socketToLobby = {};
const usernames = {};

// Power-ups management
const activePowerUps = {};

function emitLobbyState(lobby) {
  io.to(lobby).emit('lobbyState', {
    players: lobbies[lobby].players.map(p => ({
      username: p.username,
      ready: p.ready,
      host: lobbies[lobby].players[0]?.id === p.id,
      powerUps: activePowerUps[p.id] || []
    }))
  });
}

function updateLobbyList() {
  const status = {};
  for (const [name, lobby] of Object.entries(lobbies)) {
    status[name] = { players: lobby.players };
  }
  io.emit('lobbyList', status);
}

io.on('connection', (socket) => {
  console.log(`✅ Socket connected: ${socket.id}`);

  // Development dashboard WebSocket connection
  if (socket.handshake.query && socket.handshake.query.type === 'dashboard') {
    socket.join('dashboard');
    socket.emit('dashboardInit', {
      players: Object.keys(usernames).length,
      lobbies: Object.keys(lobbies).length
    });
    return;
  }

  socket.on('setUsername', (username) => {
    usernames[socket.id] = username;
    updateLobbyList();
  });

  socket.on('joinLobby', (lobbyName) => {
    const lobby = lobbies[lobbyName];
    if (!lobby || lobby.players.length >= 4) return;

    const player = {
      id: socket.id,
      username: usernames[socket.id] || 'Player',
      ready: false
    };

    lobby.players.push(player);
    socketToLobby[socket.id] = lobbyName;
    lobby.inputs[socket.id] = { left: false, right: false };
    lobby.scores[player.username] = 0;
    activePowerUps[socket.id] = [];

    socket.join(lobbyName);
    socket.emit('joinedLobby', { hostId: lobby.players[0].id });

    io.to(lobbyName).emit('chatMessage', {
      username: 'System',
      message: `${player.username} joined the lobby.`
    });

    emitLobbyState(lobbyName);
    updateLobbyList();
  });

  socket.on('readyToggle', () => {
    const lobby = socketToLobby[socket.id];
    if (!lobby) return;

    const player = lobbies[lobby].players.find(p => p.id === socket.id);
    if (player) player.ready = !player.ready;

    emitLobbyState(lobby);
  });

  socket.on('forceStart', () => {
    const lobbyName = socketToLobby[socket.id];
    if (!lobbyName) return;

    const lobby = lobbies[lobbyName];
    const players = lobby.players;
    const isHost = players[0].id === socket.id;
    const allReady = players.length >= 2 && players.every(p => p.ready);

    if (isHost && allReady) {
      io.to(lobbyName).emit('startGame');
    }
  });

  socket.on('input', (input) => {
    const lobbyName = socketToLobby[socket.id];
    if (!lobbyName) return;

    lobbies[lobbyName].inputs[socket.id] = input;
    socket.to(lobbyName).emit('opponentInput', { id: socket.id, input });
  });

  socket.on('powerUpCollected', (powerUpData) => {
    const lobbyName = socketToLobby[socket.id];
    if (!lobbyName) return;

    // Add power-up to player's active power-ups
    if (!activePowerUps[socket.id]) {
      activePowerUps[socket.id] = [];
    }
    
    activePowerUps[socket.id].push({
      type: powerUpData.type,
      expiresAt: Date.now() + powerUpData.duration
    });

    // Broadcast power-up collection to other players
    socket.to(lobbyName).emit('playerCollectedPowerUp', {
      playerId: socket.id,
      type: powerUpData.type,
      position: powerUpData.position
    });

    // Special case for "clear" power-up that affects all players
    if (powerUpData.type === 'clear') {
      io.to(lobbyName).emit('clearEffect', {
        initiator: socket.id,
        duration: 1500 // milliseconds
      });
    }
  });

  socket.on('roundOver', () => {
    const lobbyName = socketToLobby[socket.id];
    const lobby = lobbies[lobbyName];
    if (!lobby) return;

    const winner = lobby.players.find(p => p.id !== socket.id);
    if (winner) {
      lobby.scores[winner.username]++;
      io.to(lobbyName).emit('chatMessage', {
        username: 'System',
        message: `${winner.username} won the round. Total Wins: ${lobby.scores[winner.username]}`
      });

      if (lobby.scores[winner.username] >= 5) {
        io.to(lobbyName).emit('chatMessage', {
          username: 'System',
          message: `${winner.username} wins the match! 🎉`
        });
        lobby.players.forEach(p => p.ready = false);
      } else {
        setTimeout(() => io.to(lobbyName).emit('startGame'), 1500);
      }
    }

    // Clear power-ups at end of round
    lobby.players.forEach(p => {
      activePowerUps[p.id] = [];
    });

    emitLobbyState(lobbyName);
  });

  socket.on('sendChat', (msg) => {
    const lobby = socketToLobby[socket.id];
    if (!lobby) return;

    io.to(lobby).emit('chatMessage', {
      username: usernames[socket.id] || 'Player',
      message: msg
    });
  });

  socket.on('disconnect', () => {
    const lobby = socketToLobby[socket.id];
    if (lobby) {
      const index = lobbies[lobby].players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        const name = lobbies[lobby].players[index].username;
        lobbies[lobby].players.splice(index, 1);
        delete lobbies[lobby].inputs[socket.id];
        delete activePowerUps[socket.id];

        io.to(lobby).emit('chatMessage', {
          username: 'System',
          message: `${name} left the lobby.`
        });

        emitLobbyState(lobby);
        updateLobbyList();
      }
    }

    delete socketToLobby[socket.id];
    delete usernames[socket.id];
    
    io.to('dashboard').emit('playerDisconnected', {
      playerId: socket.id,
      activePlayers: Object.keys(usernames).length
    });
  });
});

// API endpoints for development dashboard
app.get('/api/stats', (req, res) => {
  const stats = {
    players: Object.keys(usernames).length,
    lobbies: Object.entries(lobbies).map(([name, lobby]) => ({
      name,
      playerCount: lobby.players.length,
      active: lobby.players.length > 0
    }))
  };
  res.json(stats);
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});