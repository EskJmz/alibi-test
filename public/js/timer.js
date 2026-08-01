// ══════════════════════════════════════════════════
// TIMER CLIENT — arc SVG synchronisé avec le serveur
// ══════════════════════════════════════════════════
const CIRC = 2 * Math.PI * 47;

const timers = {}; // { arcId: intervalRef }

function initArc(arcId) {
  const el = document.getElementById(arcId);
  if (!el) return;
  el.style.strokeDasharray = CIRC;
  el.style.strokeDashoffset = 0;
  el.classList.remove('danger');
}

function startClientTimer(arcId, cdId, totalSeconds, endsAt) {
  // Annuler tout timer précédent sur cet arc
  if (timers[arcId]) clearInterval(timers[arcId]);
  initArc(arcId);

  const arc = document.getElementById(arcId);
  const cd  = document.getElementById(cdId);

  function tick() {
    const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    if (cd) cd.textContent = remaining;
    if (arc) {
      arc.style.strokeDashoffset = CIRC * (1 - remaining / totalSeconds);
      if (remaining <= 10) arc.classList.add('danger');
      else arc.classList.remove('danger');
    }
    if (remaining <= 0) {
      clearInterval(timers[arcId]);
      delete timers[arcId];
    }
  }

  tick();
  timers[arcId] = setInterval(tick, 500);
}

function stopClientTimer(arcId) {
  if (timers[arcId]) {
    clearInterval(timers[arcId]);
    delete timers[arcId];
  }
}

function stopAllTimers() {
  Object.keys(timers).forEach(id => {
    clearInterval(timers[id]);
    delete timers[id];
  });
}
