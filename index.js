const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const CONTENT = require('./content');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

const rooms = {};
const roomsByIP = {};
const MAX_ROOMS_PER_IP = 5;
const msgCount = {};
const MSG_LIMIT = 20;
const MSG_WINDOW = 1000;

function isRateLimited(socketId) {
  const now = Date.now();
  if (!msgCount[socketId] || now > msgCount[socketId].resetAt) {
    msgCount[socketId] = { count: 1, resetAt: now + MSG_WINDOW };
    return false;
  }
  msgCount[socketId].count++;
  return msgCount[socketId].count > MSG_LIMIT;
}

function getRoom(id) { return rooms[id]; }
function roomPlayers(room) { return Object.entries(room.players).map(([sid, p]) => ({ sid, ...p })); }
function broadcast(roomId, event, data) { io.to(roomId).emit(event, data); }
function getEnqueteurs(room) { return roomPlayers(room).filter(p => p.role === 'enqueteur'); }
function getTeam(room, t) { return roomPlayers(room).filter(p => p.role === t); }

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
  const alibiKey = room.currentTeam === 'A' ? room.alibiA : room.alibiB;
  const qs = CONTENT[alibiKey].questions;
  const idx = room.singleTeam ? room.currentRound : Math.floor(room.currentRound / 2);
  return qs[idx % qs.length];
}

function advanceRound(room) {
  if (room._advancing) return;
  room._advancing = true;

  room.currentRound++;
  room.answers = {}; room.mjAnswers = {}; room.mjValidations = {};

  if (room.currentRound >= room.rounds) {
    room.phase = 'end';
    emitRoomState(room);
    broadcast(room.id, 'game:end', { scoreA: room.scoreA, scoreB: room.scoreB, history: room.history });
    return;
  }

  if (!room.singleTeam) room.currentTeam = room.currentTeam === 'A' ? 'B' : 'A';
  room.phase = 'playing';
  room._advancing = false;
  emitRoomState(room);
  broadcast(room.id, 'round:ready', { round: room.currentRound, team: room.currentTeam, totalRounds: room.rounds });
}

io.on('connection', (socket) => {
  const ip = socket.handshake.address;

  socket.use(([event], next) => {
    if (isRateLimited(socket.id)) { socket.emit('room:error', { msg: 'Trop de messages envoyés.' }); return; }
    next();
  });

  socket.on('room:create', ({ name }) => {
    if (!name || typeof name !== 'string') return;
    if ((roomsByIP[ip] || 0) >= MAX_ROOMS_PER_IP) { socket.emit('room:error', { msg: 'Trop de groupes créés depuis cette adresse.' }); return; }
    const roomId = uuidv4().slice(0, 6).toUpperCase();
    roomsByIP[ip] = (roomsByIP[ip] || 0) + 1;
    rooms[roomId] = {
      id: roomId, hostId: socket.id, _creatorIP: ip,
      players: { [socket.id]: { name: name.slice(0, 20), role: null } },
      mode: null, rounds: 6, phase: 'lobby',
      currentRound: 0, currentTeam: 'A', singleTeam: false,
      scoreA: 0, scoreB: 0,
      answers: {}, mjAnswers: {}, mjValidations: {},
      history: [], // { question, answers: [{name, answer}], point, team }
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
    const allowed = ['enqueteur', 'A', 'B', null];
    if (!allowed.includes(role)) return;
    room.players[targetSid].role = role;
    emitRoomState(room);
  });

  socket.on('assign:confirm', () => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.hostId !== socket.id) return;
    const enqs = getEnqueteurs(room), teamA = getTeam(room, 'A'), teamB = getTeam(room, 'B');
    const maxEnq = room.mode === 'odd' ? 1 : 2;
    if (enqs.length !== maxEnq) { socket.emit('assign:error', { msg: `Il faut exactement ${maxEnq} enquêteur(s).` }); return; }
    if (teamA.length !== 2) { socket.emit('assign:error', { msg: 'Suspects A : il faut 2 joueurs.' }); return; }
    if (teamB.length > 0 && teamB.length !== 2) { socket.emit('assign:error', { msg: 'Suspects B : il faut 2 joueurs.' }); return; }

    room.singleTeam = teamB.length === 0;
    room.phase = 'alibi'; room.currentRound = 0; room.currentTeam = 'A';
    room.scoreA = 0; room.scoreB = 0; room._advancing = false;
    room._mjReady = new Set(); room.history = [];

    const keys = Object.keys(CONTENT);
    const shuffled = keys.sort(() => Math.random() - 0.5);
    room.alibiA = shuffled[0];
    room.alibiB = room.singleTeam ? null : shuffled[1];

    emitRoomState(room);

    teamA.forEach(p => io.to(p.sid).emit('alibi:show', { team: 'A', text: CONTENT[room.alibiA].alibi }));
    if (!room.singleTeam) teamB.forEach(p => io.to(p.sid).emit('alibi:show', { team: 'B', text: CONTENT[room.alibiB].alibi }));
    enqs.forEach(p => io.to(p.sid).emit('alibi:waiting', {}));

    startTimer(room, 60, () => {
      room.phase = 'playing';
      emitRoomState(room);
      broadcast(room.id, 'round:ready', { round: 0, team: room.currentTeam, totalRounds: room.rounds });
    });
  });

  // ── Mode impair ──
  socket.on('enqueteur:launchQuestion', () => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.phase !== 'playing') return;
    if (!getEnqueteurs(room).find(p => p.sid === socket.id)) return;

    const q = getQuestion(room);
    room.answers = {}; room._currentQuestion = q;
    const active = room.currentTeam;
    const activeMembers = getTeam(room, active);
    const watchMembers = active === 'A' ? getTeam(room, 'B') : getTeam(room, 'A');

    activeMembers.forEach(p => io.to(p.sid).emit('question:active', { question: q, team: active }));
    watchMembers.forEach(p => io.to(p.sid).emit('question:watch', { question: q, team: active }));
    getEnqueteurs(room).forEach(p => io.to(p.sid).emit('question:enqueteur', { question: q, team: active, round: room.currentRound + 1, totalRounds: room.rounds }));

    startTimer(room, 30, () => endQuestionPhase(room));
  });

  socket.on('player:answer', ({ answer }) => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.phase !== 'playing') return;
    const player = room.players[socket.id];
    if (!player || player.role !== room.currentTeam) return;
    if (room.answers[socket.id] !== undefined) return;
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
    const answersForEnq = activeTeam.map(p => ({ name: p.name, answer: room.answers[p.sid] || '(pas de réponse)' }));
    room._pendingAnswers = answersForEnq;
    getEnqueteurs(room).forEach(p => io.to(p.sid).emit('enqueteur:showAnswers', { answers: answersForEnq, team: room.currentTeam }));
  }

  socket.on('enqueteur:award', ({ point }) => {
    const room = getRoom(socket.data.roomId);
    if (!room || room._advancing) return;
    if (!getEnqueteurs(room).find(p => p.sid === socket.id)) return;
    if (point) { if (room.currentTeam === 'A') room.scoreA++; else room.scoreB++; }

    // Sauvegarder dans l'historique
    room.history.push({
      team: room.currentTeam,
      question: room._currentQuestion,
      answers: room._pendingAnswers || [],
      point: !!point,
    });

    // Afficher les réponses à tout le monde
    broadcast(room.id, 'round:showAnswers', {
      team: room.currentTeam,
      question: room._currentQuestion,
      answers: room._pendingAnswers || [],
      point: !!point,
      scoreA: room.scoreA,
      scoreB: room.scoreB,
    });

    emitRoomState(room);
  });

  socket.on('enqueteur:nextQuestion', () => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;
    if (!getEnqueteurs(room).find(p => p.sid === socket.id)) return;
    advanceRound(room);
  });

  // ── Mode pair ──
  socket.on('enqueteur:launchQuestionEven', () => {
    const room = getRoom(socket.data.roomId);
    if (!room || room.phase !== 'playing') return;
    const enqs = getEnqueteurs(room);
    if (!enqs.find(p => p.sid === socket.id)) return;
    room._mjReady.add(socket.id);
    if (room._mjReady.size < enqs.length) return;
    room._mjReady = new Set(); room.mjAnswers = {};

    const q = getQuestion(room);
    room._currentQuestion = q;
    const activeTeam = getTeam(room, room.currentTeam);
    const watchTeam = room.currentTeam === 'A' ? getTeam(room, 'B') : getTeam(room, 'A');

    enqs.forEach((enq, i) => {
      const assigned = activeTeam[i % activeTeam.length];
      io.to(enq.sid).emit('question:enqueteur:even', {
        question: q, team: room.currentTeam,
        assignedPlayer: assigned ? assigned.name : '?',
        round: room.currentRound + 1, totalRounds: room.rounds,
      });
    });
    watchTeam.forEach(p => io.to(p.sid).emit('question:watch', { question: q, team: room.currentTeam }));
    activeTeam.forEach(p => io.to(p.sid).emit('question:activeWait', { team: room.currentTeam }));
    startTimer(room, 60, () => endEvenSaisiePhase(room));
  });

  socket.on('enqueteur:submitAnswer', ({ answer }) => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;
    const enqs = getEnqueteurs(room);
    if (!enqs.find(p => p.sid === socket.id)) return;
    if (room.mjAnswers[socket.id] !== undefined) return;
    room.mjAnswers[socket.id] = String(answer).slice(0, 500);
    socket.emit('enqueteur:answered', {});
    if (enqs.every(p => room.mjAnswers[p.sid] !== undefined)) {
      stopTimer(room);
      setTimeout(() => endEvenSaisiePhase(room), 300);
    }
  });

  function endEvenSaisiePhase(room) {
    const enqs = getEnqueteurs(room);
    room.mjValidations = {};
    if (enqs.length === 1) {
      io.to(enqs[0].sid).emit('enqueteur:crossValidate', { otherEnqName: '—', otherAnswer: '(un seul enquêteur)' });
      return;
    }
    enqs.forEach((enq, i) => {
      const other = enqs[i === 0 ? 1 : 0];
      io.to(enq.sid).emit('enqueteur:crossValidate', {
        otherEnqName: other.name,
        otherAnswer: room.mjAnswers[other.sid] || '(pas de réponse)',
      });
    });
  }

  socket.on('enqueteur:validate', ({ ok }) => {
    const room = getRoom(socket.data.roomId);
    if (!room || room._advancing) return;
    const enqs = getEnqueteurs(room);
    if (!enqs.find(p => p.sid === socket.id)) return;
    if (room.mjValidations[socket.id] !== undefined) return;
    room.mjValidations[socket.id] = !!ok;
    enqs.forEach(p => { if (p.sid !== socket.id) io.to(p.sid).emit('enqueteur:partnerValidated', {}); });
    if (!enqs.every(p => room.mjValidations[p.sid] !== undefined)) return;

    const point = enqs.every(p => room.mjValidations[p.sid] === true);
    if (point) { if (room.currentTeam === 'A') room.scoreA++; else room.scoreB++; }

    // Construire les réponses pour l'affichage
    const activeTeam = getTeam(room, room.currentTeam);
    const answersForAll = enqs.map((enq, i) => {
      const assigned = activeTeam[i % activeTeam.length];
      return { name: assigned ? assigned.name : '?', answer: room.mjAnswers[enq.sid] || '(pas de réponse)' };
    });
    room._pendingAnswers = answersForAll;

    room.history.push({
      team: room.currentTeam,
      question: room._currentQuestion,
      answers: answersForAll,
      point,
    });

    broadcast(room.id, 'round:showAnswers', {
      team: room.currentTeam,
      question: room._currentQuestion,
      answers: answersForAll,
      point,
      scoreA: room.scoreA,
      scoreB: room.scoreB,
    });

    emitRoomState(room);
  });

  socket.on('enqueteur:nextQuestionEven', () => {
    const room = getRoom(socket.data.roomId);
    if (!room) return;
    if (!getEnqueteurs(room).find(p => p.sid === socket.id)) return;
    advanceRound(room);
  });

  socket.on('disconnect', () => {
    delete msgCount[socket.id];
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = getRoom(roomId);
    if (!room) return;
    delete room.players[socket.id];
    if (Object.keys(room.players).length === 0) {
      clearInterval(room.timerInterval);
      delete rooms[roomId];
      if (room._creatorIP && roomsByIP[room._creatorIP] > 0) roomsByIP[room._creatorIP]--;
    } else {
      if (room.hostId === socket.id) room.hostId = Object.keys(room.players)[0];
      emitRoomState(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Alibi — http://localhost:${PORT}`));
