const socket = io();

const L = {
  roomId: null, name: null, isHost: false, role: null,
  mode: null, rounds: 6, action: null, joinCode: null,
  players: [], scoreA: 0, scoreB: 0,
  currentRound: 0, currentTeam: 'A', singleTeam: false,
  enqList: [], awardPending: false,
};

let selectedMode = null;
let currentRoundNum = 0;

function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }

function showResult(point) {
  const ov = document.getElementById('result-overlay');
  ov.className = 'result-overlay ' + (point ? 'win' : 'lose');
  ov.textContent = point ? '✓ Point !' : '✗ Raté';
  ov.style.display = 'flex';
  setTimeout(() => { ov.style.display = 'none'; }, 2000);
}

function qNum(round) {
  return `Question N°${String(round + 1).padStart(2, '0')}`;
}

function updateScoreVisibility() {
  // Masquer score B si une seule équipe
  const showB = !L.singleTeam;
  ['enq-odd-sb','enq-even-sb','rw-sb','pe-sb','ans-sb','end-sb'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const card = el.closest('.score-c');
      if (card) card.style.display = showB ? '' : 'none';
    }
  });
  // Centrer le score A si seule équipe
  ['score-pair-odd','score-pair-even','score-pair-rw','score-pair-pe','score-pair-ans','score-pair-end'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.gridTemplateColumns = showB ? '1fr 1fr' : '1fr';
  });
}

// ── ACCUEIL ──
document.getElementById('btn-create').addEventListener('click', () => {
  L.action = 'create'; setText('name-label', 'Créer un groupe');
  document.getElementById('name-inp').value = ''; go('s-name');
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
  document.getElementById('name-inp').value = ''; go('s-name');
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

// ── LOBBY ──
function selectMode(m) {
  selectedMode = m;
  document.getElementById('mc-odd').classList.toggle('selected', m === 'odd');
  document.getElementById('mc-even').classList.toggle('selected', m === 'even');
  socket.emit('room:configure', { mode: m, rounds: L.rounds });
  updateStartBtn();
}
document.getElementById('btn-rounds-minus').addEventListener('click', () => {
  L.rounds = Math.max(2, L.rounds - 1); setText('rounds-val', L.rounds); updateRoundsHint();
  if (selectedMode) socket.emit('room:configure', { mode: selectedMode, rounds: L.rounds });
});
document.getElementById('btn-rounds-plus').addEventListener('click', () => {
  L.rounds = Math.min(14, L.rounds + 1); setText('rounds-val', L.rounds); updateRoundsHint();
  if (selectedMode) socket.emit('room:configure', { mode: selectedMode, rounds: L.rounds });
});
function updateRoundsHint() {
  const cnt = L.players.length;
  const twoTeams = selectedMode === 'odd' ? cnt === 5 : cnt === 6;
  const hint = twoTeams ? `~${Math.floor(L.rounds / 2)} questions par groupe` : `${L.rounds} questions pour l'unique groupe`;
  setText('rounds-hint', hint + ' · max 14');
}
function updateStartBtn() {
  const cnt = L.players.length;
  const valid = selectedMode &&
    ((selectedMode === 'odd' && (cnt === 3 || cnt === 5)) ||
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
document.getElementById('btn-start-assign').addEventListener('click', () => { socket.emit('room:startAssign'); });

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
  updateRoundsHint(); updateStartBtn();
}

// ── ASSIGNATION ──
function renderAssign(players, mode) {
  const maxEnq = mode === 'odd' ? 1 : 2;
  const twoTeams = (mode === 'odd' && players.length === 5) || (mode === 'even' && players.length === 6);
  setText('assign-hint', mode === 'odd' ? 'Choisissez 1 enquêteur puis formez les groupes.' : 'Choisissez 2 enquêteurs puis formez les groupes.');
  setText('assign-enq-label', mode === 'odd' ? 'Enquêteur' : 'Enquêteurs (2)');
  document.getElementById('tb-section').style.display = twoTeams ? '' : 'none';
  renderPills('enq-pills', players, 'enqueteur', maxEnq);
  renderPills('ta-pills', players, 'A', 2);
  if (twoTeams) renderPills('tb-pills', players, 'B', 2);
  const enqs = players.filter(p => p.role === 'enqueteur');
  const ta = players.filter(p => p.role === 'A');
  const tb = players.filter(p => p.role === 'B');
  const valid = enqs.length === maxEnq && ta.length === 2 && (!twoTeams || tb.length === 2);
  document.getElementById('btn-assign-confirm').disabled = !valid;
}

function renderPills(containerId, players, targetRole, max) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const inRole = players.filter(p => p.role === targetRole);
  container.innerHTML = players.map(p => {
    const active = p.role === targetRole;
    const inOther = !active && p.role !== null;
    const full = !active && inRole.length >= max;
    const dis = inOther || full;
    const cls = active ? (targetRole === 'enqueteur' ? 'sel-mj' : targetRole === 'A' ? 'sel-a' : 'sel-b') : '';
    const badgeCls = targetRole === 'enqueteur' ? 'b-amber' : targetRole === 'A' ? 'b-blue' : 'b-green';
    const badgeLbl = targetRole === 'enqueteur' ? 'Enquêteur' : `Suspects ${targetRole}`;
    return `<div class="pill ${cls} ${dis ? 'disabled' : ''}" ${!dis ? `onclick="assignRole('${escapeHtml(p.sid)}','${active ? 'null' : targetRole}')"` : ''}>
      <span class="pill-name">${escapeHtml(p.name)}</span>
      ${active ? `<span class="badge ${badgeCls}">${badgeLbl}</span>` : ''}
    </div>`;
  }).join('');
}

function assignRole(sid, role) {
  socket.emit('assign:setRole', { targetSid: sid, role: role === 'null' ? null : role });
}
document.getElementById('btn-assign-confirm').addEventListener('click', () => { socket.emit('assign:confirm'); });

// ── ENQUÊTEUR MODE IMPAIR ──
document.getElementById('btn-enq-odd-launch').addEventListener('click', () => {
  socket.emit('enqueteur:launchQuestion');
  document.getElementById('btn-enq-odd-launch').disabled = true;
  setText('btn-enq-odd-launch', 'Question en cours…');
});
document.getElementById('btn-award-yes').addEventListener('click', () => {
  if (L.awardPending) return; L.awardPending = true;
  socket.emit('enqueteur:award', { point: true });
  document.getElementById('btn-award-yes').disabled = true;
  document.getElementById('btn-award-no').disabled = true;
});
document.getElementById('btn-award-no').addEventListener('click', () => {
  if (L.awardPending) return; L.awardPending = true;
  socket.emit('enqueteur:award', { point: false });
  document.getElementById('btn-award-yes').disabled = true;
  document.getElementById('btn-award-no').disabled = true;
});

// ── SUSPECT ACTIF ──
document.getElementById('btn-pl-submit').addEventListener('click', submitPlayerAnswer);
document.getElementById('pl-active-ans').addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) submitPlayerAnswer(); });
function submitPlayerAnswer() {
  const ans = document.getElementById('pl-active-ans').value.trim();
  if (!ans) return;
  socket.emit('player:answer', { answer: ans });
  hide('pl-active-input'); show('pl-active-sent');
  stopClientTimer('pl-active-arc');
}

// ── ENQUÊTEUR MODE PAIR ──
document.getElementById('btn-enq-even-launch').addEventListener('click', () => {
  socket.emit('enqueteur:launchQuestionEven');
  document.getElementById('btn-enq-even-launch').disabled = true;
  setText('btn-enq-even-launch', "En attente de l'autre enquêteur…");
});
document.getElementById('btn-enq-even-submit').addEventListener('click', () => {
  const ans = document.getElementById('enq-even-inp').value.trim();
  if (!ans) return;
  socket.emit('enqueteur:submitAnswer', { answer: ans });
  hide('enq-even-inp'); document.getElementById('btn-enq-even-submit').disabled = true;
  show('enq-even-sent');
});
document.getElementById('btn-enq-val-ok').addEventListener('click', () => {
  socket.emit('enqueteur:validate', { ok: true });
  document.getElementById('btn-enq-val-ok').disabled = true;
  document.getElementById('btn-enq-val-no').disabled = true;
  hide('enq-even-val-btns'); show('enq-even-wait-partner');
});
document.getElementById('btn-enq-val-no').addEventListener('click', () => {
  socket.emit('enqueteur:validate', { ok: false });
  document.getElementById('btn-enq-val-ok').disabled = true;
  document.getElementById('btn-enq-val-no').disabled = true;
  hide('enq-even-val-btns'); show('enq-even-wait-partner');
});

// ── QUESTION SUIVANTE ──
document.getElementById('btn-next-question').addEventListener('click', () => {
  if (L.role === 'enqueteur') {
    if (L.mode === 'odd') {
      socket.emit('enqueteur:nextQuestion');
    } else {
      socket.emit('enqueteur:nextQuestionEven');
      document.getElementById('btn-next-question').disabled = true;
      setText('btn-next-question', "En attente de l'autre enquêteur…");
    }
  }
});

// ── FIN ──
document.getElementById('btn-replay').addEventListener('click', () => {
  socket.emit('replay:ready');
  document.getElementById('btn-replay').disabled = true;
});

// ── SOCKET EVENTS ──
socket.on('replay:count', ({ ready, total }) => {
  const btn = document.getElementById('btn-replay');
  if (btn) {
    btn.textContent = `Rejouer (${ready} / ${total})`;
    btn.disabled = true;
  }
});

socket.on('room:joined', ({ roomId, isHost }) => {
  L.roomId = roomId; L.isHost = isHost;
  setText('lobby-code', roomId);
  if (isHost) { show('host-config'); hide('guest-wait'); }
  else { hide('host-config'); show('guest-wait'); }
  go('s-lobby');
});

socket.on('room:error', ({ msg }) => { showErr('home-err', msg); showErr('name-err', msg); });

socket.on('room:state', (state) => {
  L.players = state.players || [];
  L.mode = state.mode; L.rounds = state.rounds;
  L.scoreA = state.scoreA; L.scoreB = state.scoreB;
  L.currentRound = state.currentRound; L.currentTeam = state.currentTeam;
  L.singleTeam = state.singleTeam;
  L.enqList = L.players.filter(p => p.role === 'enqueteur');
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

  setText('enq-odd-sa', state.scoreA); setText('enq-odd-sb', state.scoreB);
  setText('enq-even-sa', state.scoreA); setText('enq-even-sb', state.scoreB);
  setText('rw-sa', state.scoreA); setText('rw-sb', state.scoreB);
  setText('pe-sa', state.scoreA); setText('pe-sb', state.scoreB);
  updateScoreVisibility();
});

socket.on('alibi:show', ({ team, text }) => {
  L.role = team;
  setText('alibi-team-lbl', `Suspects ${team}`);
  document.getElementById('alibi-text').textContent = text;
  go('s-alibi');
});
socket.on('alibi:waiting', () => { go('s-alibi-enq'); });

socket.on('timer:start', ({ seconds, endsAt }) => {
  const active = document.querySelector('.screen.active');
  if (!active) return;
  const arcMap = {
    's-alibi':         ['alibi-arc',     'alibi-cd'],
    's-alibi-enq':     ['alibi-enq-arc', 'alibi-enq-cd'],
    's-player-active': ['pl-active-arc', 'pl-active-cd'],
    // Pas de timer pour l'enquêteur en mode pair
  };
  const pair = arcMap[active.id];
  if (pair) startClientTimer(pair[0], pair[1], seconds, endsAt);
});
socket.on('timer:stop', () => { stopAllTimers(); });

socket.on('round:ready', ({ round, team, totalRounds }) => {
  L.currentRound = round; L.currentTeam = team;
  L.awardPending = false; currentRoundNum = round;

  // Réinitialiser btn-next-question
  const btnNext = document.getElementById('btn-next-question');
  if (btnNext) { btnNext.disabled = false; setText('btn-next-question', 'Question suivante →'); }

  if (L.role === 'enqueteur') {
    if (L.mode === 'odd') {
      setText('enq-odd-round', `Manche ${round + 1} / ${totalRounds}`);
      setText('enq-odd-team-lbl', `Suspects ${team} interrogés`);
      setText('enq-odd-q', '—');
      hide('enq-odd-answers'); show('btn-enq-odd-launch');
      document.getElementById('btn-enq-odd-launch').disabled = false;
      setText('btn-enq-odd-launch', 'Lancer la question');
      go('s-enq-odd');
    } else {
      const enqIdx = L.enqList.findIndex(p => p.name === L.name);
      setText('enq-even-who', `${L.name} (Enquêteur ${enqIdx + 1})`);
      setText('enq-even-round', `Manche ${round + 1} / ${totalRounds}`);
      setText('enq-even-team-lbl', `Suspects ${team} interrogés`);
      setText('enq-even-q', '—'); setText('enq-even-qnum', '');
      hide('enq-even-validation'); hide('enq-even-saisie');
      hide('enq-even-sent'); show('enq-even-inp');
      document.getElementById('enq-even-inp').value = '';
      document.getElementById('btn-enq-even-submit').disabled = false;
      show('btn-enq-even-launch');
      document.getElementById('btn-enq-even-launch').disabled = false;
      setText('btn-enq-even-launch', 'Lancer la question');
      go('s-enq-even');
    }
  } else {
    setText('round-wait-msg', `Manche ${round + 1} / ${totalRounds} — En attente de l'enquêteur…`);
    go('s-round-wait');
  }
});

socket.on('question:active', ({ question, team }) => {
  setText('pl-active-badge', `Suspects ${team}`);
  document.getElementById('pl-active-badge').className = `badge ${team === 'A' ? 'b-amber' : 'b-green'}`;
  setText('pl-active-qnum', qNum(currentRoundNum));
  setText('pl-active-q', question);
  document.getElementById('pl-active-ans').value = '';
  show('pl-active-input'); hide('pl-active-sent');
  document.getElementById('btn-pl-submit').disabled = false;
  go('s-player-active');
});

socket.on('question:watch', ({ question, team }) => {
  setText('pl-watch-label', `Suspects ${team} interrogés`);
  setText('pl-watch-qnum', qNum(currentRoundNum));
  setText('pl-watch-q', question);
  go('s-player-watch');
});

socket.on('question:enqueteur', ({ question, team, round, totalRounds }) => {
  setText('enq-odd-round', `Manche ${round} / ${totalRounds}`);
  setText('enq-odd-team-lbl', `Suspects ${team} interrogés`);
  setText('enq-odd-q', question);
  hide('enq-odd-answers'); hide('btn-enq-odd-launch');
});

socket.on('question:enqueteur:even', ({ question, team, assignedPlayer, round, totalRounds }) => {
  setText('enq-even-round', `Manche ${round} / ${totalRounds}`);
  setText('enq-even-team-lbl', `Suspects ${team} interrogés`);
  setText('enq-even-qnum', qNum(round - 1));
  setText('enq-even-q', question);
  setText('enq-even-player-lbl', `Posez la question à voix haute à ${escapeHtml(assignedPlayer)}`);
  show('enq-even-saisie'); hide('enq-even-sent'); show('enq-even-inp');
  document.getElementById('enq-even-inp').value = '';
  document.getElementById('btn-enq-even-submit').disabled = false;
  hide('enq-even-validation'); hide('btn-enq-even-launch');
});

socket.on('question:activeWait', () => { go('s-player-even-wait'); });

socket.on('enqueteur:answered', () => {
  hide('enq-even-inp');
  document.getElementById('btn-enq-even-submit').disabled = true;
  show('enq-even-sent');
});

socket.on('question:ended', () => {
  hide('pl-active-input'); show('pl-active-sent'); stopAllTimers();
});

socket.on('enqueteur:showAnswers', ({ answers }) => {
  const list = document.getElementById('enq-odd-ans-list');
  list.innerHTML = '';
  answers.forEach(a => {
    const wrap = document.createElement('div'); wrap.className = 'col g4';
    const lbl = document.createElement('span'); lbl.className = 'label'; lbl.textContent = a.name;
    const box = document.createElement('div'); box.className = 'ans-box'; box.textContent = a.answer;
    wrap.appendChild(lbl); wrap.appendChild(box); list.appendChild(wrap);
  });
  show('enq-odd-answers'); hide('btn-enq-odd-launch');
  document.getElementById('btn-award-yes').disabled = false;
  document.getElementById('btn-award-no').disabled = false;
});

socket.on('enqueteur:crossValidate', ({ mySuspectName, myAnswer, otherEnqName, otherSuspectName, otherAnswer }) => {
  // Afficher les deux réponses côte à côte pour validation
  const list = document.getElementById('enq-even-cross-list');
  if (list) {
    list.innerHTML = `
      <div class="col g4"><span class="label">Votre suspect : ${escapeHtml(mySuspectName)}</span><div class="ans-box">${escapeHtml(myAnswer)}</div></div>
      <div class="col g4"><span class="label">Suspect de ${escapeHtml(otherEnqName)} : ${escapeHtml(otherSuspectName)}</span><div class="ans-box">${escapeHtml(otherAnswer)}</div></div>
    `;
  }
  show('enq-even-validation'); hide('enq-even-saisie');
  show('enq-even-val-btns'); hide('enq-even-wait-partner');
  document.getElementById('btn-enq-val-ok').disabled = false;
  document.getElementById('btn-enq-val-no').disabled = false;
});

socket.on('enqueteur:partnerNextReady', () => {
  setText('btn-next-question', "L'autre enquêteur est prêt — Question suivante →");
});

socket.on('round:showAnswers', ({ team, question, answers, point, scoreA, scoreB }) => {
  stopAllTimers();
  setText('sa-team-lbl', `Suspects ${team}`);
  setText('sa-question', question);
  setText('sa-qnum', qNum(currentRoundNum));

  const badge = document.getElementById('sa-point-badge');
  badge.innerHTML = point ? `<span class="badge b-green">+1 point</span>` : `<span class="badge b-red">0 point</span>`;

  const list = document.getElementById('sa-answers-list');
  list.innerHTML = '';
  answers.forEach(a => {
    const wrap = document.createElement('div'); wrap.className = 'ans-reveal';
    wrap.innerHTML = `<div class="ans-reveal-name">${escapeHtml(a.name)}</div><div class="ans-reveal-text">${escapeHtml(a.answer)}</div>`;
    list.appendChild(wrap);
    list.appendChild(Object.assign(document.createElement('div'), { style: 'height:6px' }));
  });

  setText('ans-sa', scoreA); setText('ans-sb', scoreB);

  if (L.role === 'enqueteur') { show('btn-next-question'); hide('sa-wait-next'); }
  else { hide('btn-next-question'); show('sa-wait-next'); }

  if (L.role === team) showResult(point);
  go('s-show-answers');
  updateScoreVisibility();
});

socket.on('game:end', ({ scoreA, scoreB, history }) => {
  stopAllTimers();
  setText('end-sa', scoreA); setText('end-sb', scoreB);
  setText('end-score', `${scoreA} – ${scoreB}`);
  let winner;
  if (L.singleTeam) winner = 'Partie terminée !';
  else if (scoreA > scoreB) winner = 'Suspects A gagnent !';
  else if (scoreB > scoreA) winner = 'Suspects B gagnent !';
  else winner = 'Égalité !';
  setText('end-winner', winner);

  const histEl = document.getElementById('end-history');
  histEl.innerHTML = '';
  const teams = L.singleTeam ? ['A'] : ['A', 'B'];
  teams.forEach(team => {
    const items = (history || []).filter(h => h.team === team);
    if (!items.length) return;
    const section = document.createElement('div'); section.className = 'history-team';
    section.innerHTML = `<div class="history-team-title">Suspects ${team}</div>`;
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = `history-item ${item.point ? 'ok' : 'ko'}`;
      let answersHtml = (item.answers || []).map(a =>
        `<div class="history-ans"><span>${escapeHtml(a.name)} :</span> ${escapeHtml(a.answer)}</div>`
      ).join('');
      div.innerHTML = `
        <div class="history-q">${escapeHtml(item.question)}</div>
        ${answersHtml}
        <div class="history-result ${item.point ? 'ok' : 'ko'}">${item.point ? '✓ Point accordé' : '✗ Pas de point'}</div>`;
      section.appendChild(div);
    });
    histEl.appendChild(section);
  });

  go('s-end');
  updateScoreVisibility();
});
