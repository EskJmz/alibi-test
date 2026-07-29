const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const CONTENT = require('./content');

const app = express();
const server = http.createServer(app);

// ── Protection 2 : limite de connexions simultanées par IP (max 20) ──
const io = new Server(server, {
  cors: { origin: '*' },
  connectionStateRecovery: {},
});

app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const rooms = {};

// ── Protection 1 : compteur de rooms actives par IP ──
const roomsByIP = {}; // { ip: count }
const MAX_ROOMS_PER_IP = 5;

// ── Protection 3 : rate limiting par socket (max 20 messages/seconde) ──
const msgCount = {}; // { socketId: { count, resetAt } }
const MSG_LIMIT = 20;
const MSG_WINDOW = 1000; // 1 seconde

function isRateLimited(socketId) {
  const now = Date.now();
  if (!msgCount[socketId] || now > msgCount[socketId].resetAt) {
    msgCount[socketId] = { count: 1, resetAt: now + MSG_WINDOW };
    return false;
  }
  msgCount[socketId].count++;
  return msgCount[socketId].count > MSG_LIMIT;
}

// ── Helpers ──
function getRoom(id) { return rooms[id]; }
function roomPlayers(room) { return Object.entries(room.players).map(([sid, p]) => ({ sid, ...p })); }
function broadcast(roomId, event, data) { io.to(roomId).emit(event, data); }
function getMJs(room)       { return roomPlayers(room).filter(p => p.role === 'mj'); }
function getTeam(room, t)   { return roomPlayers(room).filter(p => p.role === t); }

function emitRoomState(room) {
  broadcast(room.id, 'room:state', {
    players: roomPlayers(room),
    mode: room.mode, rounds: room.rounds, phase: room.phase,
    hostId: room.hostId, scoreA: room.scoreA, scoreB: room.scoreB,
    currentRound: room.currentRound, currentTeam: room.currentTeam, singleTeam: room.singleTeam,
  });
}

function startTimer(room, seconds, onEnd) {
  clearInterval(room.timerInterval);
  room.timerEndsAt = Date.now() + seconds * 1000;
  broadcast(room.id, 'timer:start', { seconds, endsAt: room.timerEndsAt });
  room.timerInterval = setInterval(() => {
    if (Date.now() >= room.timerEndsAt) {
      clearInterval(room.timerInterval);
      onEnd();
    }
  }, 500);
}

function stopTimer(room) {
  clearInterval(room.timerInterval);
  broadcast(room.id, 'timer:stop', {});
}

function getQuestion(room) {
  // Utiliser l'alibi tiré aléatoirement pour cette room
  const alibiKey = room.currentTeam === 'A' ? room.alibiA : room.alibiB;
  const qs = CONTENT[alibiKey].questions;
  const idx = room.singleTeam ? room.currentRound : Math.floor(room.currentRound / 2);
  return qs[idx % qs.length];
}

function advanceRound(room) {
  // FIX 4 — verrou côté serveur : on ne peut avancer qu'une fois par manche
  if (room._advancing) return;
  room._advancing = true;

  room.currentRound++;
  room.answers = {}; room.mjAnswers = {}; room.mjValidations = {};

  if (room.currentRound >= room.rounds) {
    room.phase = 'end';
    emitRoomState(room);
    broadcast(room.id, 'game:end', { scoreA: room.scoreA, scoreB: room.scoreB });
    return;
  }

  if (!room.singleTeam) room.currentTeam = room.currentTeam === 'A' ? 'B' : 'A';
  room.phase = 'playing';
  room._advancing = false;
  emitRoomState(room);
  broadcast(room.id, 'round:ready', { round: room.currentRound, team: room.currentTeam, totalRounds: room.rounds });
}

// ── Socket events ──
io.on('connection', (socket) => {
  const ip = socket.handshake.address;

  // Middleware rate limiting : vérifier à chaque message entrant
  socket.use(([event], next) => {
    if (isRateLimited(socket.id)) {
      socket.emit('room:error', { msg: 'Trop de messages envoyés.' });
      return;
    }
    next();
  });

  socket.on('room:create', ({ name }) => {
    if (!name || typeof name !== 'string') return;

    // Protection 1 : limite de rooms par IP
    if ((roomsByIP[ip] || 0) >= MAX_ROOMS_PER_IP) {
      socket.emit('room:error', { msg: 'Trop de groupes créés depuis cette adresse.' });
      return;
    }

    const roomId = uuidv4().slice(0, 6).toUpperCase();
    roomsByIP[ip] = (roomsByIP[ip] || 0) + 1;
    rooms[roomId] = {
      id: roomId, hostId: socket.id, _creatorIP: ip,
      players: { [socket.id]: { name: name.slice(0, 20), role: null } },
      mode: null, rounds: 6, phase: 'lobby',
      currentRound: 0, currentTeam: 'A', singleTeam: false,
      scoreA: 0, scoreB: 0,
      answers: {}, mjAnswers: {}, mjValidations: {},
      timerInterval: null, timerEndsAt: null,
      _advancing: false, _mjReady: new Set(),
    };
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name;
    socket.emit('room:joined', { roomId, isHost: true });
    emitRoomState(rooms[roomId]);
  });

  socket.on('room:join', ({ roomId, name }) => {
    if (!name || typeof name !== 'string') return;
    const room = getRoom(roomId.toUpperCase());
    if (!room) { socket.emit('room:error', { msg: 'Groupe introuvable.' }); return; }
    if (room.phase !== 'lobby') { socket.emit('room:error', { msg: 'La partie a déjà commencé.' }); return; }
    const names = roomPlayers(room).map(p => p.name);
    if (names.includes(name)) { socket.emit('room:error', { msg: 'Ce pseudo est déjà pris.' }); return; }
    room.players[socket.id] = { name: name.slice(0, 20), role: null };
    socket.join(roomId.toUpperCase());
    socket.data.roomId = roomId.toUpperCase();
    socket.data.name = name;
    socket.emit('room:joined', { roomId: roomId.toUpperCase(), isHost: false });
    emitRoomState(room);
  });

  socket.on('room:configure', ({ mode, rounds }) => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.hostId !== socket.id) return;
    if (!['odd', 'even'].includes(mode)) return;
    room.mode = mode;
    room.rounds = Math.min(14, Math.max(2, Number(rounds) || 6));
    emitRoomState(room);
  });

  socket.on('room:startAssign', () => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.hostId !== socket.id) return;
    room.phase = 'assign';
    room._advancing = false;
    Object.keys(room.players).forEach(sid => { room.players[sid].role = null; });
    emitRoomState(room);
  });

  socket.on('assign:setRole', ({ targetSid, role }) => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.hostId !== socket.id) return;
    if (!room.players[targetSid]) return;
    // FIX 3 — valider les valeurs de rôle acceptables
    const allowed = ['mj', 'A', 'B', null];
    if (!allowed.includes(role)) return;
    room.players[targetSid].role = role;
    emitRoomState(room);
  });

  socket.on('assign:confirm', () => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.hostId !== socket.id) return;
    const mjs = getMJs(room), teamA = getTeam(room, 'A'), teamB = getTeam(room, 'B');
    const maxMJ = room.mode === 'odd' ? 1 : 2;
    if (mjs.length !== maxMJ) { socket.emit('assign:error', { msg: `Il faut exactement ${maxMJ} MJ.` }); return; }
    if (teamA.length !== 2)   { socket.emit('assign:error', { msg: 'Équipe A doit avoir 2 joueurs.' }); return; }
    // FIX 3 — en mode pair, vérifier qu'il y a bien 2 MJ (déjà garanti par maxMJ=2, mais on vérifie teamB cohérence)
    if (teamB.length > 0 && teamB.length !== 2) { socket.emit('assign:error', { msg: 'Équipe B doit avoir 2 joueurs.' }); return; }

    room.singleTeam = teamB.length === 0;
    room.phase = 'alibi'; room.currentRound = 0; room.currentTeam = 'A';
    room.scoreA = 0; room.scoreB = 0; room._advancing = false;
    room._mjReady = new Set();

    // Tirage aléatoire de 2 alibis différents parmi tous les disponibles
    const keys = Object.keys(CONTENT);
    const shuffled = keys.sort(() => Math.random() - 0.5);
    room.alibiA = shuffled[0];
    room.alibiB = room.singleTeam ? null : shuffled[1];

    emitRoomState(room);

    teamA.forEach(p => io.to(p.sid).emit('alibi:show', { team: 'A', text: CONTENT[room.alibiA].alibi }));
    if (!room.singleTeam) teamB.forEach(p => io.to(p.sid).emit('alibi:show', { team: 'B', text: CONTENT[room.alibiB].alibi }));
    mjs.forEach(p => io.to(p.sid).emit('alibi:waiting', {}));

    startTimer(room, 60, () => {
      room.phase = 'playing';
      emitRoomState(room);
      broadcast(room.id, 'round:ready', { round: 0, team: room.currentTeam, totalRounds: room.rounds });
    });
  });

  // ── Mode impair ──
  socket.on('mj:launchQuestion', () => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.phase !== 'playing') return;
    if (!getMJs(room).find(p => p.sid === socket.id)) return;

    const q = getQuestion(room);
    room.answers = {};
    const active = room.currentTeam, teamA = getTeam(room, 'A'), teamB = getTeam(room, 'B');
    const activeMembers = active === 'A' ? teamA : teamB;
    const watchMembers  = active === 'A' ? teamB : teamA;

    activeMembers.forEach(p => io.to(p.sid).emit('question:active', { question: q, team: active }));
    watchMembers.forEach(p  => io.to(p.sid).emit('question:watch',  { question: q, team: active }));
    getMJs(room).forEach(p  => io.to(p.sid).emit('question:mj', { question: q, team: active, round: room.currentRound + 1, totalRounds: room.rounds }));

    startTimer(room, 30, () => endQuestionPhase(room));
  });

  socket.on('player:answer', ({ answer }) => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.phase !== 'playing') return;
    const player = room.players[socket.id];
    if (!player || player.role !== room.currentTeam) return;
    if (room.answers[socket.id] !== undefined) return; // déjà répondu
    room.answers[socket.id] = String(answer).slice(0, 500);
    socket.emit('player:answered', {});
    const activeTeam = getTeam(room, room.currentTeam);
    if (activeTeam.every(p => room.answers[p.sid] !== undefined)) {
      stopTimer(room);
      setTimeout(() => endQuestionPhase(room), 300);
    }
  });

  function endQuestionPhase(room) {
    broadcast(room.id, 'question:ended', {});
    const activeTeam = getTeam(room, room.currentTeam);
    const answersForMJ = activeTeam.map(p => ({ name: p.name, answer: room.answers[p.sid] || '(pas de réponse)' }));
    getMJs(room).forEach(p => io.to(p.sid).emit('mj:showAnswers', { answers: answersForMJ, team: room.currentTeam }));
  }

  socket.on('mj:award', ({ point }) => {
    const room = getRoom(socket.data.roomId);
    if (!room || room._advancing) return; // FIX 4 — verrou serveur
    if (!getMJs(room).find(p => p.sid === socket.id)) return;
    if (point) { if (room.currentTeam === 'A') room.scoreA++; else room.scoreB++; }
    getTeam(room, room.currentTeam).forEach(p => io.to(p.sid).emit('round:result', { point: !!point }));
    emitRoomState(room);
    setTimeout(() => advanceRound(room), 1500);
  });

  // ── Mode pair ──
  socket.on('mj:launchQuestionEven', () => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.phase !== 'playing') return;
    const mjs = getMJs(room);
    if (!mjs.find(p => p.sid === socket.id)) return;
    room._mjReady.add(socket.id);
    if (room._mjReady.size < mjs.length) return; // attendre l'autre MJ
    room._mjReady = new Set();
    room.mjAnswers = {};

    const q = getQuestion(room);
    const activeTeam = getTeam(room, room.currentTeam);
    const watchTeam  = room.currentTeam === 'A' ? getTeam(room, 'B') : getTeam(room, 'A');

    // Assigner chaque MJ à un membre du binôme
    mjs.forEach((mj, i) => {
      const assigned = activeTeam[i % activeTeam.length];
      io.to(mj.sid).emit('question:mj:even', {
        question: q, team: room.currentTeam,
        assignedPlayer: assigned ? assigned.name : '?',
        round: room.currentRound + 1, totalRounds: room.rounds,
      });
    });
    watchTeam.forEach(p  => io.to(p.sid).emit('question:watch', { question: q, team: room.currentTeam }));
    activeTeam.forEach(p => io.to(p.sid).emit('question:activeWait', { team: room.currentTeam }));
    startTimer(room, 60, () => endEvenSaisiePhase(room));
  });

  socket.on('mj:submitAnswer', ({ answer }) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;
    const mjs = getMJs(room);
    if (!mjs.find(p => p.sid === socket.id)) return;
    if (room.mjAnswers[socket.id] !== undefined) return; // déjà soumis
    room.mjAnswers[socket.id] = String(answer).slice(0, 500);
    socket.emit('mj:answered', {});
    if (mjs.every(p => room.mjAnswers[p.sid] !== undefined)) {
      stopTimer(room);
      setTimeout(() => endEvenSaisiePhase(room), 300);
    }
  });

  function endEvenSaisiePhase(room) {
    const mjs = getMJs(room);
    room.mjValidations = {};
    // FIX 3 — gérer le cas d'un seul MJ (mode pair à 4 joueurs avec 1 MJ ne devrait pas arriver, mais sécurité)
    if (mjs.length === 1) {
      // Validation automatique avec la seule réponse disponible
      io.to(mjs[0].sid).emit('mj:crossValidate', { otherMJName: '—', otherAnswer: '(un seul MJ)' });
      return;
    }
    mjs.forEach((mj, i) => {
      const other = mjs[i === 0 ? 1 : 0];
      io.to(mj.sid).emit('mj:crossValidate', {
        otherMJName: other.name,
        otherAnswer: room.mjAnswers[other.sid] || '(pas de réponse)',
      });
    });
  }

  socket.on('mj:validate', ({ ok }) => {
    const room = getRoom(socket.data.roomId);
    if (!room || room._advancing) return;
    const mjs = getMJs(room);
    if (!mjs.find(p => p.sid === socket.id)) return;
    if (room.mjValidations[socket.id] !== undefined) return; // déjà validé
    room.mjValidations[socket.id] = !!ok;
    mjs.forEach(p => { if (p.sid !== socket.id) io.to(p.sid).emit('mj:partnerValidated', {}); });
    if (!mjs.every(p => room.mjValidations[p.sid] !== undefined)) return;
    const point = mjs.every(p => room.mjValidations[p.sid] === true);
    if (point) { if (room.currentTeam === 'A') room.scoreA++; else room.scoreB++; }
    getTeam(room, room.currentTeam).forEach(p => io.to(p.sid).emit('round:result', { point }));
    emitRoomState(room);
    setTimeout(() => advanceRound(room), 1500);
  });

  // ── Déconnexion ──
  socket.on('disconnect', () => {
    delete msgCount[socket.id]; // Nettoyer le rate limiter
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    delete room.players[socket.id];
    if (Object.keys(room.players).length === 0) {
      clearInterval(room.timerInterval);
      delete rooms[roomId];
      // Libérer le slot IP du créateur
      if (room._creatorIP && roomsByIP[room._creatorIP] > 0) {
        roomsByIP[room._creatorIP]--;
      }
    } else {
      if (room.hostId === socket.id) room.hostId = Object.keys(room.players)[0];
      emitRoomState(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Alibi — http://localhost:${PORT}`));
