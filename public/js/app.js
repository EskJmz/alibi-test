// ══════════════════════════════════════════════════
// APP CLIENT — Alibi (version corrigée)
// ══════════════════════════════════════════════════

const socket = io();

const L = {
  roomId: null, name: null, isHost: false, role: null,
  mode: null, rounds: 6, action: null, joinCode: null,
  players: [], scoreA: 0, scoreB: 0,
  currentRound: 0, currentTeam: 'A', singleTeam: false,
  timerTotal: 60, mjList: [],
  awardPending: false,   // FIX 4 — verrou double-clic award
};

// ── Nav ──
function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

// ── Helpers UI ──
function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }

// FIX 2 — échappement HTML pour éviter XSS
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showResult(point) {
  const ov = document.getElementById('result-overlay');
  ov.className = 'result-overlay ' + (point ? 'win' : 'lose');
  ov.textContent = point ? '✓ Point !' : '✗ Raté';
  ov.style.display = 'flex';
  setTimeout(() => { ov.style.display = 'none'; }, 2000);
}

// ══════════════════════════════════════════════════
// ACCUEIL
// ══════════════════════════════════════════════════
document.getElementById('btn-create').addEventListener('click', () => {
  L.action = 'create';
  setText('name-label', 'Créer un groupe');
  document.getElementById('name-inp').value = '';
  go('s-name');
});

document.getElementById('btn-join-toggle').addEventListener('click', () => {
  const f = document.getElementById('join-form');
  f.style.display = f.style.display === 'none' ? '' : 'none';
});

document.getElementById('btn-join-confirm').addEventListener('click', () => {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!code || code.length !== 6) { showErr('home-err', 'Entrez un code de 6 caractères.'); return; }
  L.action = 'join'; L.joinCode = code;
  setText('name-label', 'Rejoindre le groupe');
  document.getElementById('name-inp').value = '';
  go('s-name');
});

document.getElementById('btn-name-confirm').addEventListener('click', confirmName);
document.getElementById('name-inp').addEventListener('keydown', e => { if (e.key === 'Enter') confirmName(); });

function confirmName() {
  const name = document.getElementById('name-inp').value.trim();
  if (!name) { showErr('name-err', 'Entrez un pseudo.'); return; }
  L.name = name;
  if (L.action === 'create') socket.emit('room:create', { name });
  else socket.emit('room:join', { roomId: L.joinCode, name });
}

// ══════════════════════════════════════════════════
// LOBBY
// ══════════════════════════════════════════════════
let selectedMode = null;

function selectMode(m) {
  selectedMode = m;
  document.getElementById('mc-odd').classList.toggle('selected', m === 'odd');
  document.getElementById('mc-even').classList.toggle('selected', m === 'even');
  socket.emit('room:configure', { mode: m, rounds: L.rounds });
  updateStartBtn();
}

document.getElementById('btn-rounds-minus').addEventListener('click', () => {
  L.rounds = Math.max(2, L.rounds - 1);
  setText('rounds-val', L.rounds); updateRoundsHint();
  if (selectedMode) socket.emit('room:configure', { mode: selectedMode, rounds: L.rounds });
});
document.getElementById('btn-rounds-plus').addEventListener('click', () => {
  L.rounds = Math.min(14, L.rounds + 1);
  setText('rounds-val', L.rounds); updateRoundsHint();
  if (selectedMode) socket.emit('room:configure', { mode: selectedMode, rounds: L.rounds });
});

function updateRoundsHint() {
  const cnt = L.players.length;
  const twoTeams = selectedMode === 'odd' ? cnt === 5 : cnt === 6;
  const hint = twoTeams
    ? `~${Math.floor(L.rounds / 2)} questions par équipe`
    : `${L.rounds} questions pour l'unique équipe`;
  setText('rounds-hint', hint + ' · max 14');
}

function updateStartBtn() {
  const cnt = L.players.length;
  const valid = selectedMode &&
    ((selectedMode === 'odd'  && (cnt === 3 || cnt === 5)) ||
     (selectedMode === 'even' && (cnt === 4 || cnt === 6)));
  document.getElementById('btn-start-assign').disabled = !valid;
  if (!valid && selectedMode) {
    const need = selectedMode === 'odd' ? '3 ou 5' : '4 ou 6';
    setText('lobby-err', `Mode ${selectedMode === 'odd' ? 'impair' : 'pair'} : il faut ${need} joueurs.`);
    show('lobby-err');
  } else { hide('lobby-err'); }
}

document.getElementById('btn-copy-code').addEventListener('click', () => {
  navigator.clipboard.writeText(L.roomId).then(() => {
    setText('btn-copy-code', 'Copié !');
    setTimeout(() => setText('btn-copy-code', 'Copier'), 2000);
  });
});

document.getElementById('btn-start-assign').addEventListener('click', () => {
  socket.emit('room:startAssign');
});

function renderLobbyPlayers() {
  const list = document.getElementById('lobby-players');
  list.innerHTML = L.players.map(p => `
    <div class="lobby-player">
      <div class="lobby-dot"></div>
      <span class="lobby-name">${escapeHtml(p.name)}</span>
      ${p.name === L.name && L.isHost ? '<span class="lobby-host">Chef</span>' : ''}
    </div>`).join('');
  const cnt = L.players.length;
  setText('lobby-count', `${cnt} joueur${cnt > 1 ? 's' : ''}`);
  updateRoundsHint();
  updateStartBtn();
}

// ══════════════════════════════════════════════════
// ASSIGNATION
// ══════════════════════════════════════════════════
function renderAssign(players, mode) {
  const maxMJ = mode === 'odd' ? 1 : 2;
  const twoTeams = (mode === 'odd' && players.length === 5) || (mode === 'even' && players.length === 6);
  setText('assign-hint', mode === 'odd' ? 'Choisissez 1 MJ puis formez les équipes.' : 'Choisissez 2 MJ puis formez les équipes.');
  setText('assign-mj-label', mode === 'odd' ? 'Maître du jeu' : 'Maîtres du jeu (2)');
  document.getElementById('tb-section').style.display = twoTeams ? '' : 'none';

  renderPills('mj-pills', players, 'mj', maxMJ);
  renderPills('ta-pills', players, 'A', 2);
  if (twoTeams) renderPills('tb-pills', players, 'B', 2);

  const mjs = players.filter(p => p.role === 'mj');
  const ta  = players.filter(p => p.role === 'A');
  const tb  = players.filter(p => p.role === 'B');
  const valid = mjs.length === maxMJ && ta.length === 2 && (!twoTeams || tb.length === 2);
  document.getElementById('btn-assign-confirm').disabled = !valid;
}

function renderPills(containerId, players, targetRole, max) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const inRole = players.filter(p => p.role === targetRole);
  container.innerHTML = players.map(p => {
    const active   = p.role === targetRole;
    const inOther  = !active && p.role !== null;
    const full     = !active && inRole.length >= max;
    const dis      = inOther || full;
    const cls      = active ? (targetRole === 'mj' ? 'sel-mj' : targetRole === 'A' ? 'sel-a' : 'sel-b') : '';
    const badgeCls = targetRole === 'mj' ? 'b-amber' : targetRole === 'A' ? 'b-blue' : 'b-green';
    const badgeLbl = targetRole === 'mj' ? 'MJ' : `Éq. ${targetRole}`;
    // FIX 2 — échapper le sid dans l'attribut onclick
    const safeSid  = escapeHtml(p.sid);
    const newRole  = active ? 'null' : targetRole;
    return `
      <div class="pill ${cls} ${dis ? 'disabled' : ''}"
           ${!dis ? `onclick="assignRole('${safeSid}','${newRole}')"` : ''}>
        <span class="pill-name">${escapeHtml(p.name)}</span>
        ${active ? `<span class="badge ${badgeCls}">${badgeLbl}</span>` : ''}
      </div>`;
  }).join('');
}

function assignRole(sid, role) {
  socket.emit('assign:setRole', { targetSid: sid, role: role === 'null' ? null : role });
}

document.getElementById('btn-assign-confirm').addEventListener('click', () => {
  socket.emit('assign:confirm');
});

// ══════════════════════════════════════════════════
// MJ — MODE IMPAIR
// ══════════════════════════════════════════════════
document.getElementById('btn-mj-odd-launch').addEventListener('click', () => {
  socket.emit('mj:launchQuestion');
  document.getElementById('btn-mj-odd-launch').disabled = true;
  setText('btn-mj-odd-launch', 'Question en cours…');
});

// FIX 4 — verrou awardPending pour éviter double-clic
document.getElementById('btn-award-yes').addEventListener('click', () => {
  if (L.awardPending) return;
  L.awardPending = true;
  socket.emit('mj:award', { point: true });
  document.getElementById('btn-award-yes').disabled = true;
  document.getElementById('btn-award-no').disabled = true;
});
document.getElementById('btn-award-no').addEventListener('click', () => {
  if (L.awardPending) return;
  L.awardPending = true;
  socket.emit('mj:award', { point: false });
  document.getElementById('btn-award-yes').disabled = true;
  document.getElementById('btn-award-no').disabled = true;
});

// ══════════════════════════════════════════════════
// JOUEUR ACTIF — MODE IMPAIR
// ══════════════════════════════════════════════════
document.getElementById('btn-pl-submit').addEventListener('click', submitPlayerAnswer);
document.getElementById('pl-active-ans').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) submitPlayerAnswer();
});

function submitPlayerAnswer() {
  const ans = document.getElementById('pl-active-ans').value.trim();
  if (!ans) return;
  socket.emit('player:answer', { answer: ans });
  hide('pl-active-input');
  show('pl-active-sent');
  stopClientTimer('pl-active-arc');
}

// ══════════════════════════════════════════════════
// MJ — MODE PAIR
// ══════════════════════════════════════════════════
document.getElementById('btn-mj-even-launch').addEventListener('click', () => {
  socket.emit('mj:launchQuestionEven');
  document.getElementById('btn-mj-even-launch').disabled = true;
  setText('btn-mj-even-launch', "En attente de l'autre MJ…");
});

document.getElementById('btn-mj-even-submit').addEventListener('click', () => {
  const ans = document.getElementById('mj-even-inp').value.trim();
  if (!ans) return;
  socket.emit('mj:submitAnswer', { answer: ans });
  hide('mj-even-inp');
  document.getElementById('btn-mj-even-submit').disabled = true;
  show('mj-even-sent');
  stopClientTimer('mj-even-arc');
});

document.getElementById('btn-mj-val-ok').addEventListener('click', () => {
  socket.emit('mj:validate', { ok: true });
  document.getElementById('btn-mj-val-ok').disabled = true;
  document.getElementById('btn-mj-val-no').disabled = true;
  hide('mj-even-val-btns');
  show('mj-even-wait-partner');
});
document.getElementById('btn-mj-val-no').addEventListener('click', () => {
  socket.emit('mj:validate', { ok: false });
  document.getElementById('btn-mj-val-ok').disabled = true;
  document.getElementById('btn-mj-val-no').disabled = true;
  hide('mj-even-val-btns');
  show('mj-even-wait-partner');
});

// ══════════════════════════════════════════════════
// FIN
// ══════════════════════════════════════════════════
document.getElementById('btn-replay').addEventListener('click', () => {
  socket.emit('room:startAssign');
});

// ══════════════════════════════════════════════════
// SOCKET EVENTS
// ══════════════════════════════════════════════════

socket.on('room:joined', ({ roomId, isHost }) => {
  L.roomId = roomId; L.isHost = isHost;
  setText('lobby-code', roomId);
  if (isHost) { show('host-config'); hide('guest-wait'); }
  else        { hide('host-config'); show('guest-wait'); }
  go('s-lobby');
});

socket.on('room:error', ({ msg }) => {
  showErr('home-err', msg);
  showErr('name-err', msg);
});

socket.on('room:state', (state) => {
  L.players      = state.players || [];
  L.mode         = state.mode;
  L.rounds       = state.rounds;
  L.scoreA       = state.scoreA;
  L.scoreB       = state.scoreB;
  L.currentRound = state.currentRound;
  L.currentTeam  = state.currentTeam;
  L.singleTeam   = state.singleTeam;
  L.mjList       = L.players.filter(p => p.role === 'mj');

  const me = L.players.find(p => p.name === L.name);
  if (me) L.role = me.role;

  if (state.phase === 'lobby') {
    renderLobbyPlayers();
    if (state.mode) {
      selectedMode = state.mode;
      document.getElementById('mc-odd').classList.toggle('selected', state.mode === 'odd');
      document.getElementById('mc-even').classList.toggle('selected', state.mode === 'even');
    }
  }

  if (state.phase === 'assign') {
    if (L.isHost) { renderAssign(L.players, L.mode); go('s-assign'); }
    else go('s-wait');
  }

  // Scores
  setText('mj-odd-sa', state.scoreA); setText('mj-odd-sb', state.scoreB);
  setText('mj-even-sa', state.scoreA); setText('mj-even-sb', state.scoreB);
  setText('rw-sa', state.scoreA); setText('rw-sb', state.scoreB);
  setText('pe-sa', state.scoreA); setText('pe-sb', state.scoreB);
});

socket.on('alibi:show', ({ team, text }) => {
  L.role = team;
  setText('alibi-team-lbl', `Équipe ${team}`);
  setText('alibi-text', text);
  go('s-alibi');
});

socket.on('alibi:waiting', () => { go('s-alibi-mj'); });

// FIX 1 — un seul listener timer:start (suppression du doublon)
socket.on('timer:start', ({ seconds, endsAt }) => {
  L.timerTotal = seconds;
  const active = document.querySelector('.screen.active');
  if (!active) return;
  const arcMap = {
    's-alibi':         ['alibi-arc',     'alibi-cd'],
    's-alibi-mj':      ['alibi-mj-arc',  'alibi-mj-cd'],
    's-player-active': ['pl-active-arc', 'pl-active-cd'],
    's-mj-even':       ['mj-even-arc',   'mj-even-cd'],
  };
  const pair = arcMap[active.id];
  if (pair) startClientTimer(pair[0], pair[1], seconds, endsAt);
});

socket.on('timer:stop', () => { stopAllTimers(); });

socket.on('round:ready', ({ round, team, totalRounds }) => {
  L.currentRound = round; L.currentTeam = team;
  // Réinitialiser le verrou award pour la nouvelle manche
  L.awardPending = false;

  if (L.role === 'mj') {
    if (L.mode === 'odd') {
      setText('mj-odd-round', `Manche ${round + 1} / ${totalRounds}`);
      setText('mj-odd-team-lbl', `Équipe ${team} joue`);
      hide('mj-odd-answers'); show('btn-mj-odd-launch');
      document.getElementById('btn-mj-odd-launch').disabled = false;
      setText('btn-mj-odd-launch', 'Lancer la question');
      go('s-mj-odd');
    } else {
      const mjIdx = L.mjList.findIndex(p => p.name === L.name);
      setText('mj-even-who', `${L.name} (MJ ${mjIdx + 1})`);
      setText('mj-even-round', `Manche ${round + 1} / ${totalRounds}`);
      setText('mj-even-team-lbl', `Équipe ${team} interrogée`);
      hide('mj-even-validation'); show('mj-even-saisie');
      hide('mj-even-sent'); show('mj-even-inp');
      document.getElementById('mj-even-inp').value = '';
      document.getElementById('btn-mj-even-submit').disabled = false;
      show('btn-mj-even-launch');
      document.getElementById('btn-mj-even-launch').disabled = false;
      setText('btn-mj-even-launch', 'Lancer la question');
      go('s-mj-even');
    }
  } else {
    setText('round-wait-msg', `Manche ${round + 1} / ${totalRounds} — En attente du MJ…`);
    go('s-round-wait');
  }
});

socket.on('question:active', ({ question, team }) => {
  setText('pl-active-badge', `Équipe ${team}`);
  document.getElementById('pl-active-badge').className = `badge ${team === 'A' ? 'b-amber' : 'b-green'}`;
  setText('pl-active-q', question);
  document.getElementById('pl-active-ans').value = '';
  show('pl-active-input'); hide('pl-active-sent');
  document.getElementById('btn-pl-submit').disabled = false;
  go('s-player-active');
});

socket.on('question:watch', ({ question, team }) => {
  setText('pl-watch-label', `Équipe ${team} joue`);
  setText('pl-watch-q', question);
  go('s-player-watch');
});

socket.on('question:mj', ({ question, team, round, totalRounds }) => {
  setText('mj-odd-round', `Manche ${round} / ${totalRounds}`);
  setText('mj-odd-team-lbl', `Équipe ${team} joue`);
  setText('mj-odd-q', question);
  hide('mj-odd-answers'); hide('btn-mj-odd-launch');
});

socket.on('question:mj:even', ({ question, team, assignedPlayer, round, totalRounds }) => {
  setText('mj-even-round', `Manche ${round} / ${totalRounds}`);
  setText('mj-even-team-lbl', `Équipe ${team} interrogée`);
  setText('mj-even-q', question);
  setText('mj-even-player-lbl', `Posez la question à voix haute à ${escapeHtml(assignedPlayer)}`);
  show('mj-even-saisie'); hide('mj-even-sent'); show('mj-even-inp');
  document.getElementById('mj-even-inp').value = '';
  document.getElementById('btn-mj-even-submit').disabled = false;
  hide('mj-even-validation'); hide('btn-mj-even-launch');
});

socket.on('question:activeWait', () => {
  setText('pl-even-wait-msg', '🎙️ Le MJ va vous poser une question à voix haute — préparez-vous !');
  go('s-player-even-wait');
});

socket.on('mj:answered', () => {
  hide('mj-even-inp');
  document.getElementById('btn-mj-even-submit').disabled = true;
  show('mj-even-sent');
  stopClientTimer('mj-even-arc');
});

socket.on('question:ended', () => {
  hide('pl-active-input'); show('pl-active-sent');
  stopAllTimers();
});

// FIX 2 — innerHTML remplacé par textContent pour les réponses joueurs
socket.on('mj:showAnswers', ({ answers }) => {
  const list = document.getElementById('mj-odd-ans-list');
  list.innerHTML = '';
  answers.forEach(a => {
    const wrap = document.createElement('div');
    wrap.className = 'col g4';
    const lbl = document.createElement('span');
    lbl.className = 'label';
    lbl.textContent = a.name;
    const box = document.createElement('div');
    box.className = 'ans-box';
    box.textContent = a.answer;  // textContent = pas d'injection possible
    wrap.appendChild(lbl);
    wrap.appendChild(box);
    list.appendChild(wrap);
  });
  show('mj-odd-answers'); hide('btn-mj-odd-launch');
  document.getElementById('btn-award-yes').disabled = false;
  document.getElementById('btn-award-no').disabled = false;
});

// FIX 2 — même protection pour la validation croisée
socket.on('mj:crossValidate', ({ otherMJName, otherAnswer }) => {
  setText('mj-even-other-lbl', `Réponse de ${escapeHtml(otherMJName)}`);
  document.getElementById('mj-even-other-ans').textContent = otherAnswer;
  show('mj-even-validation'); hide('mj-even-saisie');
  show('mj-even-val-btns'); hide('mj-even-wait-partner');
  document.getElementById('btn-mj-val-ok').disabled = false;
  document.getElementById('btn-mj-val-no').disabled = false;
});

socket.on('mj:partnerValidated', () => {
  // L'autre MJ a validé — rien à faire ici, on attend game:end ou round:result
});

socket.on('round:result', ({ point }) => { showResult(point); });

socket.on('game:end', ({ scoreA, scoreB }) => {
  stopAllTimers();
  setText('end-sa', scoreA); setText('end-sb', scoreB);
  setText('end-score', `${scoreA} – ${scoreB}`);
  let winner;
  if (scoreA > scoreB) winner = 'Équipe A gagne !';
  else if (scoreB > scoreA) winner = 'Équipe B gagne !';
  else winner = 'Égalité !';
  setText('end-winner', winner);
  go('s-end');
});
