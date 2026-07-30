// ==UserScript==
// @name         Nivel20 - Ayudante de Encuentros (D&D 5e 2014)
// @namespace    encounterN20
// @version      1.0.0
// @description  Muestra dificultad, XP y TTK estimado en el modal "Configurar el encuentro" de Nivel20
// @author       fergunet
// @match        https://nivel20.com/games/dnd-5/campaigns/*/tracking_log*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Datos de referencia (reglas 2014 / DMG pág. 82 y pág. 274)
  // ---------------------------------------------------------------------

  // Umbrales de XP por personaje y nivel: [Fácil, Medio, Difícil, Mortal]
  const XP_THRESHOLDS = {
    1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400],
    4: [125, 250, 375, 500], 5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400],
    7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100], 9: [550, 1100, 1600, 2400],
    10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
    13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400],
    16: [1600, 3200, 4800, 7200], 17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500],
    19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700],
  };

  // Multiplicadores de XP segun numero de monstruos (DMG 2014, pag. 82)
  const MULT_STEPS = [1, 1.5, 2, 2.5, 3, 4];
  function multiplierIndexForCount(n) {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    if (n <= 6) return 2;
    if (n <= 10) return 3;
    if (n <= 14) return 4;
    return 5;
  }
  function getEncounterMultiplier(monsterCount, partySize) {
    if (monsterCount <= 0) return 0;
    let idx = multiplierIndexForCount(monsterCount);
    if (partySize > 0 && partySize < 3) idx = Math.min(idx + 1, MULT_STEPS.length - 1);
    else if (partySize >= 6) idx = Math.max(idx - 1, 0);
    return MULT_STEPS[idx];
  }

  // Daño/Asalto esperado de un personaje segun su nivel, tratado como si
  // fuera el "Valor de Desafío" equivalente. Punto medio del rango de la
  // tabla "Estadísticas de monstruos según valor de desafío" (DMG 2014,
  // pág. 274). Solo depende del nivel: no se tiene en cuenta clase, arma
  // ni ataques concretos del personaje.
  const DPR_BY_LEVEL = {
    1: 11.5, 2: 17.5, 3: 23.5, 4: 29.5, 5: 35.5, 6: 41.5, 7: 47.5, 8: 53.5,
    9: 59.5, 10: 65.5, 11: 71.5, 12: 77.5, 13: 83.5, 14: 89.5, 15: 95.5,
    16: 101.5, 17: 107.5, 18: 113.5, 19: 119.5, 20: 131.5,
  };

  // ---------------------------------------------------------------------
  // Lectura de los personajes (jugadores) en la pagina principal
  // ---------------------------------------------------------------------

  function getPartyLevels() {
    const rows = document.querySelectorAll('.character-row.team-characters');
    const levels = [];
    rows.forEach((row) => {
      const descLines = row.querySelectorAll('.character-desc .text-muted.ellipsize');
      if (!descLines.length) return;
      const classLine = descLines[descLines.length - 1].textContent.trim();
      const levelMatch = classLine.match(/(\d+)\s*$/);
      levels.push(levelMatch ? parseInt(levelMatch[1], 10) : 1);
    });
    return levels;
  }

  // ---------------------------------------------------------------------
  // Lectura de las criaturas dentro del modal de encuentro
  // ---------------------------------------------------------------------

  function getEncounterModal() {
    return document.getElementById('encounter-modal');
  }

  function getEncounterRows(modal) {
    const rows = modal.querySelectorAll('.encounter-creature-form');
    const result = [];
    rows.forEach((row) => {
      const idField = row.querySelector('[name*="[creature_id]"]');
      const countField = row.querySelector('[name*="[count]"]');
      const teamField = row.querySelector('[name*="[team]"]');
      const creatureId = idField ? idField.value : '';
      if (!creatureId) return; // fila nueva sin criatura seleccionada todavia
      const count = countField ? parseInt(countField.value, 10) || 1 : 1;
      const team = teamField ? teamField.value : 'enemies';
      result.push({ creatureId, count, team });
    });
    return result;
  }

  // ---------------------------------------------------------------------
  // Ficha de criatura: HP / PX, obtenidos de la propia web (cacheado)
  // ---------------------------------------------------------------------

  const creatureCache = new Map(); // creatureId -> Promise<{hp, xp, name}>

  function fetchCreatureStats(creatureId) {
    if (creatureCache.has(creatureId)) return creatureCache.get(creatureId);

    const promise = fetch(`/games/dnd-5/creatures/${creatureId}`, { credentials: 'same-origin' })
      .then((res) => res.text())
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
        const main = doc.querySelector('.creature-detail, main, .content-body') || doc.body;
        const text = main.innerText.replace(/\s+/g, ' ');

        const hpMatch = text.match(/Puntos de Golpe:\s*(\d+)/);
        const xpMatch = text.match(/Valor de desafío:[^(]*\(([\d.,]+)\s*PX\)/);

        return {
          hp: hpMatch ? parseInt(hpMatch[1], 10) : null,
          xp: xpMatch ? parseInt(xpMatch[1].replace(/[.,]/g, ''), 10) : null,
        };
      })
      .catch(() => ({ hp: null, xp: null }));

    creatureCache.set(creatureId, promise);
    return promise;
  }

  // ---------------------------------------------------------------------
  // Calculo principal
  // ---------------------------------------------------------------------

  async function computeEncounterInfo() {
    const modal = getEncounterModal();
    if (!modal) return null;

    const partyLevels = getPartyLevels();
    const encounterRows = getEncounterRows(modal);
    if (!encounterRows.length) return null;

    const uniqueIds = [...new Set(encounterRows.map((r) => r.creatureId))];
    const statsById = new Map();
    await Promise.all(
      uniqueIds.map(async (id) => {
        statsById.set(id, await fetchCreatureStats(id));
      })
    );

    let hostileCount = 0;
    let hostileXpTotal = 0;
    let hostileHpTotal = 0;
    let missingData = false;

    encounterRows.forEach(({ creatureId, count, team }) => {
      if (team === 'characters') return; // aliado, no cuenta como amenaza
      const stats = statsById.get(creatureId);
      if (!stats || stats.hp == null || stats.xp == null) {
        missingData = true;
        return;
      }
      hostileCount += count;
      hostileXpTotal += stats.xp * count;
      hostileHpTotal += stats.hp * count;
    });

    const partySize = partyLevels.length;

    // Dificultad
    let easySum = 0, mediumSum = 0, hardSum = 0, deadlySum = 0;
    partyLevels.forEach((level) => {
      const t = XP_THRESHOLDS[Math.min(20, Math.max(1, level))];
      easySum += t[0]; mediumSum += t[1]; hardSum += t[2]; deadlySum += t[3];
    });
    const multiplier = getEncounterMultiplier(hostileCount, partySize);
    const adjustedXp = hostileXpTotal * multiplier;

    let difficulty = 'Trivial';
    if (adjustedXp >= deadlySum) difficulty = 'Mortal';
    else if (adjustedXp >= hardSum) difficulty = 'Difícil';
    else if (adjustedXp >= mediumSum) difficulty = 'Medio';
    else if (adjustedXp >= easySum) difficulty = 'Fácil';

    // XP total y por jugador (XP real otorgada, sin el multiplicador de dificultad)
    const xpPerPlayer = partySize > 0 ? hostileXpTotal / partySize : hostileXpTotal;

    // XP ajustada a repartir (con el multiplicador de dificultad aplicado) y su reparto por jugador
    const adjustedXpPerPlayer = partySize > 0 ? adjustedXp / partySize : adjustedXp;

    // TTK: turnos estimados para que el grupo derrote a las criaturas hostiles,
    // basado solo en el nivel de cada personaje (ver DPR_BY_LEVEL).
    const partyDpr = partyLevels.reduce((sum, level) => sum + (DPR_BY_LEVEL[Math.min(20, Math.max(1, level))] || 0), 0);
    const ttk = hostileHpTotal > 0 && partyDpr > 0 ? Math.ceil(hostileHpTotal / partyDpr) : null;

    return {
      partySize,
      hostileCount,
      difficulty,
      adjustedXp: Math.round(adjustedXp),
      adjustedXpPerPlayer: Math.round(adjustedXpPerPlayer),
      thresholds: { easySum, mediumSum, hardSum, deadlySum },
      xpTotal: hostileXpTotal,
      xpPerPlayer: Math.round(xpPerPlayer),
      ttk,
      missingData,
    };
  }

  // ---------------------------------------------------------------------
  // Panel de resultados dentro del modal
  // ---------------------------------------------------------------------

  const PANEL_ID = 'n20-encounter-helper-panel';

  function ensurePanel(modal) {
    let panel = modal.querySelector(`#${PANEL_ID}`);
    if (panel) return panel;

    const body = modal.querySelector('.modal-body');
    if (!body) return null;

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'alert alert-secondary';
    panel.style.fontSize = '0.95em';
    panel.innerHTML = '<em>Calculando…</em>';
    body.insertBefore(panel, body.firstChild);
    return panel;
  }

  function renderPanel(panel, info) {
    if (!panel) return;
    if (!info) {
      panel.innerHTML = '<em>Añade criaturas para ver la dificultad del encuentro.</em>';
      return;
    }

    const ttkText = info.ttk != null
      ? `${info.ttk} turno${info.ttk === 1 ? '' : 's'}`
      : (info.hostileCount > 0 ? 'sin datos suficientes' : '—');

    panel.innerHTML = `
      <strong>Dificultad (reglas 2014):</strong> ${info.difficulty}
      <span style="opacity:.7">(Fácil ${info.thresholds.easySum} · Medio ${info.thresholds.mediumSum} · Difícil ${info.thresholds.hardSum} · Mortal ${info.thresholds.deadlySum}, ${info.partySize} jugador${info.partySize === 1 ? '' : 'es'})</span><br>
      <strong>XP total:</strong> ${info.xpTotal} &nbsp; <strong>XP por jugador:</strong> ${info.xpPerPlayer}<br>
      <strong>XP ajustada a repartir:</strong> ${info.adjustedXp} &nbsp; <strong>XP ajustada por jugador:</strong> ${info.adjustedXpPerPlayer}
      <span style="opacity:.7">(con el multiplicador de dificultad aplicado)</span><br>
      <strong>TTK estimado:</strong> ${ttkText}
      <span style="opacity:.7">(turnos del grupo para derrotar a las criaturas, basado solo en el nivel de cada PJ)</span>
      ${info.missingData ? '<br><span style="color:#b45309">⚠ No se pudieron obtener los datos de alguna criatura.</span>' : ''}
    `;
  }

  // ---------------------------------------------------------------------
  // Orquestacion: recalcular cuando cambia algo en el modal
  // ---------------------------------------------------------------------

  let recomputeTimer = null;
  function scheduleRecompute() {
    clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(runRecompute, 200);
  }

  async function runRecompute() {
    const modal = getEncounterModal();
    if (!modal || !modal.classList.contains('show')) return;
    const panel = ensurePanel(modal);
    try {
      const info = await computeEncounterInfo();
      renderPanel(panel, info);
    } catch (e) {
      if (panel) panel.innerHTML = `<span style="color:#b91c1c">Error calculando el encuentro: ${e.message}</span>`;
      console.error('[Nivel20 Encounter Helper]', e);
    }
  }

  function init() {
    const modal = getEncounterModal();
    if (!modal) return;

    // Recalcular al abrir el modal
    if (window.jQuery) {
      window.jQuery(modal).on('shown.bs.modal', scheduleRecompute);
    }

    // Recalcular ante cualquier cambio dentro del modal (añadir/quitar/editar criaturas)
    document.addEventListener('change', (e) => {
      if (modal.contains(e.target)) scheduleRecompute();
    });
    document.addEventListener('click', (e) => {
      if (modal.contains(e.target) && (e.target.matches('.remove-item, .add-nested') || e.target.closest('.remove-item, .add-nested'))) {
        scheduleRecompute();
      }
    });

    const observer = new MutationObserver(() => scheduleRecompute());
    observer.observe(modal, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // Por si el modal ya esta abierto cuando carga el script
    if (modal.classList.contains('show')) scheduleRecompute();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();
