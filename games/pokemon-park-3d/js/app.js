// Pure Vanilla JS UI Controller & State Manager (Zero Node / Zero TypeScript / Zero React)
(function (root) {
  const POKEMON_SPECIES = root.POKEMON_SPECIES;
  const {
    BALL_CONFIG,
    BALL_ORDER,
    BERRY_CONFIG,
    BERRY_ORDER,
    MAX_WILD_ON_MAP,
    NATURES,
    computeEffectiveCatchRate,
    createInitialBallState,
    createInitialBerryState,
    darkenHexColor,
    formatCountdown,
    formatStars,
    getStarLabel,
    resolveActiveBallSelection,
    resolvePwaInstallUiState,
    resolveRocketBattleOutcome,
    rollNature,
    rollStarRating,
    tickBallRespawnsPure,
    tickBerryRespawnsPure,
    advancePersistedWorldState,
  } = root.ParkRules;
  const SFX = root.ParkSFX;
  const ParkEngine = root.ParkEngine;
  const Stage3D = root.Stage3D;

  const BOX_STORAGE_KEY = 'pokemon_park_3d_box_v5';
  const LEGACY_BOX_STORAGE_KEY = 'pokemon_park_3d_box_v4';
  const BALL_STORAGE_KEY = 'pokemon_park_3d_balls_v5';
  const BERRY_STORAGE_KEY = 'pokemon_park_3d_berries_v1';
  const WORLD_STORAGE_KEY = 'pokemon_park_3d_world_v1';
  const BUDDY_STORAGE_KEY = 'pokemon_park_3d_buddy_v1';

  // Crisp inline SVG Icons
  const ICONS = {
    soundOn: `<svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    soundOff: `<svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>`,
    heart: `<svg class="icon-sm" viewBox="0 0 24 24" fill="#f43f5e" stroke="#f43f5e" stroke-width="2" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
    x: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    footprints: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/></svg>`,
    check: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  };

  function getBallSwatchSVG(ballKey) {
    if (ballKey === 'great') {
      return `<svg viewBox="0 0 36 36" class="ball-swatch-svg" aria-hidden="true">
        <circle cx="18" cy="18" r="16" fill="#f8fafc" stroke="#1e293b" stroke-width="2.4"/>
        <path d="M2 18a16 16 0 0 1 32 0z" fill="#2563eb"/>
        <path d="M6.2 9.5l5.4 5.4-2.3 1.7-4.8-4.7zM29.8 9.5l-5.4 5.4 2.3 1.7 4.8-4.7z" fill="#ef4444" stroke="#1e293b" stroke-width="0.9"/>
        <ellipse cx="13" cy="8.5" rx="3.2" ry="1.6" transform="rotate(-25 13 8.5)" fill="rgba(255,255,255,0.45)"/>
        <rect x="2" y="16.4" width="32" height="3.2" fill="#1e293b"/>
        <circle cx="18" cy="18" r="5.2" fill="#fff" stroke="#1e293b" stroke-width="2.4"/>
        <circle cx="18" cy="18" r="2.4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
      </svg>`;
    }
    if (ballKey === 'ultra') {
      return `<svg viewBox="0 0 36 36" class="ball-swatch-svg" aria-hidden="true">
        <circle cx="18" cy="18" r="16" fill="#f8fafc" stroke="#1e293b" stroke-width="2.4"/>
        <path d="M2 18a16 16 0 0 1 32 0z" fill="#1e293b"/>
        <path d="M8.5 5.8v10.6h3.2V8.6c2-.9 4.1-1.4 6.3-1.4s4.3.5 6.3 1.4v7.8h3.2V5.8c-2.8-1.9-6-2.9-9.5-2.9s-6.7 1-9.5 2.9z" fill="#facc15"/>
        <rect x="2" y="16.4" width="32" height="3.2" fill="#1e293b"/>
        <circle cx="18" cy="18" r="5.2" fill="#fff" stroke="#1e293b" stroke-width="2.4"/>
        <circle cx="18" cy="18" r="2.4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
      </svg>`;
    }
    if (ballKey === 'master') {
      return `<svg viewBox="0 0 36 36" class="ball-swatch-svg" aria-hidden="true">
        <circle cx="18" cy="18" r="16" fill="#f8fafc" stroke="#1e293b" stroke-width="2.4"/>
        <path d="M2 18a16 16 0 0 1 32 0z" fill="#7e22ce"/>
        <ellipse cx="8.6" cy="9.2" rx="4.2" ry="3.2" transform="rotate(-35 8.6 9.2)" fill="#ec4899" stroke="#1e293b" stroke-width="0.9"/>
        <ellipse cx="27.4" cy="9.2" rx="4.2" ry="3.2" transform="rotate(35 27.4 9.2)" fill="#ec4899" stroke="#1e293b" stroke-width="0.9"/>
        <path d="M13.5 13V7l4.5 4.2L22.5 7v6" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="2" y="16.4" width="32" height="3.2" fill="#1e293b"/>
        <circle cx="18" cy="18" r="5.2" fill="#fff" stroke="#1e293b" stroke-width="2.4"/>
        <circle cx="18" cy="18" r="2.4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
      </svg>`;
    }
    return `<svg viewBox="0 0 36 36" class="ball-swatch-svg" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#f8fafc" stroke="#1e293b" stroke-width="2.4"/>
      <path d="M2 18a16 16 0 0 1 32 0z" fill="#ef4444"/>
      <ellipse cx="13" cy="8.5" rx="3.2" ry="1.6" transform="rotate(-25 13 8.5)" fill="rgba(255,255,255,0.45)"/>
      <rect x="2" y="16.4" width="32" height="3.2" fill="#1e293b"/>
      <circle cx="18" cy="18" r="5.2" fill="#fff" stroke="#1e293b" stroke-width="2.4"/>
      <circle cx="18" cy="18" r="2.4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
    </svg>`;
  }

  function getBerrySwatchSVG(berryKey) {
    const colorMap = {
      oran: { fill: '#38bdf8', stroke: '#0284c7', leaf: '#22c55e' },
      razz: { fill: '#fb7185', stroke: '#e11d48', leaf: '#22c55e' },
      pinap: { fill: '#facc15', stroke: '#ca8a04', leaf: '#16a34a' },
      golden: { fill: '#f59e0b', stroke: '#b45309', leaf: '#fef08a' },
    };
    const c = colorMap[berryKey] || colorMap.oran;
    return `<svg viewBox="0 0 32 32" class="berry-swatch-svg" aria-hidden="true">
      <path d="M16 7c-2-3.5-6-4-7-2.5 1.5 1.8 4 3 7 3.2 3-.2 5.5-1.4 7-3.2-1-1.5-5-1-7 2.5z" fill="${c.leaf}" stroke="#14532d" stroke-width="1.2"/>
      <circle cx="16" cy="18.5" r="10.2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2"/>
      <ellipse cx="12.5" cy="14.5" rx="2.6" ry="1.6" transform="rotate(-28 12.5 14.5)" fill="rgba(255,255,255,0.5)"/>
    </svg>`;
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getRecordSwatchColor(rec) {
    const base = rec.isShiny ? rec.species.shinyBody : rec.species.body;
    return rec.isDark ? darkenHexColor(base, 0.3) : base;
  }

  function loadInitialCollection() {
    try {
      const raw =
        localStorage.getItem(BOX_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_BOX_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const out = [];
      for (const item of parsed) {
        const speciesId = item.speciesId || (item.species && item.species.id);
        const species = POKEMON_SPECIES.find((s) => s.id === speciesId);
        if (!species) continue;
        const nature = NATURES.find((n) => n.name === item.natureName) || NATURES[0];
        out.push({
          uid: item.uid || `caught_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          species,
          isShiny: Boolean(item.isShiny),
          isDark: Boolean(item.isDark),
          nature,
          stars: typeof item.stars === 'number' ? Math.max(0, Math.min(4, item.stars)) : 1,
          caughtAt: item.caughtAt || 'Earlier',
        });
      }
      return out;
    } catch {
      return [];
    }
  }

  function saveCollection(collection) {
    try {
      const payload = collection.map((c) => ({
        uid: c.uid,
        speciesId: c.species.id,
        isShiny: c.isShiny,
        isDark: Boolean(c.isDark),
        natureName: c.nature.name,
        stars: c.stars,
        caughtAt: c.caughtAt,
      }));
      localStorage.setItem(BOX_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }

  function loadInitialBallState() {
    const base = createInitialBallState();
    try {
      const raw = localStorage.getItem(BALL_STORAGE_KEY);
      if (!raw) return base;
      const data = JSON.parse(raw);
      if (data.selected && BALL_ORDER.includes(data.selected)) {
        base.selected = data.selected;
      }
      for (const key of BALL_ORDER) {
        const cfg = BALL_CONFIG[key];
        if (data.counts && typeof data.counts[key] === 'number') {
          base.counts[key] = Math.max(0, Math.min(cfg.maxCount, data.counts[key]));
        }
        if (data.timers && typeof data.timers[key] === 'number') {
          base.timers[key] = Math.max(0, data.timers[key]);
        }
      }
      if (typeof data.savedAt === 'number' && data.savedAt > 0) {
        const elapsedSec = Math.max(0, (Date.now() - data.savedAt) / 1000);
        tickBallRespawnsPure(base, elapsedSec);
      }
    } catch {
      // Ignore malformed cache
    }
    return base;
  }

  function saveBallState(ballState) {
    try {
      localStorage.setItem(
        BALL_STORAGE_KEY,
        JSON.stringify({
          selected: ballState.selected,
          counts: ballState.counts,
          timers: ballState.timers,
          savedAt: Date.now(),
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  function loadInitialBerryState() {
    const base = createInitialBerryState();
    try {
      const raw = localStorage.getItem(BERRY_STORAGE_KEY);
      if (!raw) return base;
      const data = JSON.parse(raw);
      for (const key of BERRY_ORDER) {
        const cfg = BERRY_CONFIG[key];
        if (data.counts && typeof data.counts[key] === 'number') {
          base.counts[key] = Math.max(0, Math.min(cfg.maxCount, data.counts[key]));
        }
        if (data.timers && typeof data.timers[key] === 'number') {
          base.timers[key] = Math.max(0, data.timers[key]);
        }
      }
      if (typeof data.savedAt === 'number' && data.savedAt > 0) {
        const elapsedSec = Math.max(0, (Date.now() - data.savedAt) / 1000);
        tickBerryRespawnsPure(base, elapsedSec);
      }
    } catch {
      // Ignore malformed cache
    }
    return base;
  }

  function saveBerryState(berryState) {
    try {
      localStorage.setItem(
        BERRY_STORAGE_KEY,
        JSON.stringify({
          counts: berryState.counts,
          timers: berryState.timers,
          savedAt: Date.now(),
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  function loadInitialWorldState() {
    try {
      const raw = localStorage.getItem(WORLD_STORAGE_KEY);
      if (!raw) return { hasPersistedState: false };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.savedAt !== 'number' || !Array.isArray(parsed.wildSpawns)) {
        return { hasPersistedState: false };
      }
      const advanced = advancePersistedWorldState(parsed, Date.now(), POKEMON_SPECIES);
      return Object.assign({ hasPersistedState: true }, advanced);
    } catch {
      return { hasPersistedState: false };
    }
  }

  function saveWorldState(snapshot) {
    if (!snapshot) return;
    try {
      localStorage.setItem(WORLD_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota errors
    }
  }

  function loadInitialBuddyUid(collection) {
    try {
      const uid = localStorage.getItem(BUDDY_STORAGE_KEY);
      if (!uid) return null;
      return collection.some((c) => c.uid === uid) ? uid : null;
    } catch {
      return null;
    }
  }

  function initApp() {
    const collection = loadInitialCollection();
    const initialWorldState = loadInitialWorldState();
    const state = {
      collection,
      buddyUid: loadInitialBuddyUid(collection),
      ballState: loadInitialBallState(),
      berryState: loadInitialBerryState(),
      gameMode: 'overworld',
      encounter: null,
      balloonVisible: false,
      battleConfig: null,
      wildCount: 8,
      nextSpawnSec: 30,
      soundEnabled: true,
      revealRecord: null,
      boxOpen: false,
      boxFilter: 'all',
      boxSelectedUid: null,
    };

    const el = {
      canvasMount: document.getElementById('canvas-mount'),
      toast: document.getElementById('toast-banner'),
      overworldHud: document.getElementById('overworld-hud'),
      wildCount: document.getElementById('wild-count'),
      nextSpawn: document.getElementById('next-spawn'),
      buddySlot: document.getElementById('buddy-hud-slot'),
      btnInstallApp: document.getElementById('btn-install-app'),
      btnInstallLabel: document.getElementById('btn-install-label'),
      btnSound: document.getElementById('btn-sound'),
      btnOpenBox: document.getElementById('btn-open-box'),
      boxBtnSub: document.getElementById('box-btn-sub'),
      btnBalloonAlert: document.getElementById('btn-balloon-alert'),
      offlineBanner: document.getElementById('offline-banner'),
      iosInstallModal: document.getElementById('ios-install-modal'),
      btnIosInstallClose: document.getElementById('btn-ios-install-close'),

      battleOverlay: document.getElementById('battle-overlay'),
      battlePlayerName: document.getElementById('battle-player-name'),
      battlePlayerTypes: document.getElementById('battle-player-types'),
      battlePlayerHp: document.getElementById('battle-player-hp'),
      battleTimer: document.getElementById('battle-timer'),
      battleMatchupBadge: document.getElementById('battle-matchup-badge'),
      battleEnemyName: document.getElementById('battle-enemy-name'),
      battleEnemyTypes: document.getElementById('battle-enemy-types'),
      battleEnemyHp: document.getElementById('battle-enemy-hp'),
      battleBanner: document.getElementById('battle-banner'),

      catchOverlay: document.getElementById('catch-overlay'),
      btnBackPark: document.getElementById('btn-back-park'),
      encounterName: document.getElementById('encounter-name'),
      encounterDark: document.getElementById('encounter-dark'),
      encounterShiny: document.getElementById('encounter-shiny'),
      encounterSub: document.getElementById('encounter-sub'),
      encounterBerryActive: document.getElementById('encounter-berry-active'),
      catchRateValue: document.getElementById('catch-rate-value'),
      berryDock: document.getElementById('berry-dock'),
      ballDock: document.getElementById('ball-dock'),

      revealModal: document.getElementById('reveal-modal'),
      revealCard: document.getElementById('reveal-card'),
      revealKicker: document.getElementById('reveal-kicker'),
      revealTitle: document.getElementById('reveal-title'),
      revealCanvas: document.getElementById('reveal-stage-canvas'),
      revealStars: document.getElementById('reveal-stars'),
      revealStarLabel: document.getElementById('reveal-star-label'),
      revealNatureName: document.getElementById('reveal-nature-name'),
      revealNatureDesc: document.getElementById('reveal-nature-desc'),
      revealPalette: document.getElementById('reveal-palette'),
      revealAppraisalNote: document.getElementById('reveal-appraisal-note'),
      btnWalkWithMe: document.getElementById('btn-walk-with-me'),
      btnRevealContinue: document.getElementById('btn-reveal-continue'),

      boxModal: document.getElementById('box-modal'),
      boxSub: document.getElementById('box-sub'),
      btnBoxDone: document.getElementById('btn-box-done'),
      boxStageFrame: document.getElementById('box-stage-frame'),
      boxStageCanvas: document.getElementById('box-stage-canvas'),
      showcaseName: document.getElementById('showcase-name'),
      showcaseDark: document.getElementById('showcase-dark'),
      showcaseShiny: document.getElementById('showcase-shiny'),
      showcaseStars: document.getElementById('showcase-stars'),
      showcaseDetail: document.getElementById('showcase-detail'),
      btnShowcaseFollow: document.getElementById('btn-showcase-follow'),
      boxFilterTabs: document.getElementById('box-filter-tabs'),
      boxGrid: document.getElementById('box-grid'),
    };

    let toastTimer = null;
    let revealStage = null;
    let boxStage = null;

    function getActiveBuddy() {
      return state.collection.find((c) => c.uid === state.buddyUid) || null;
    }

    function syncBodyState() {
      document.body.dataset.state = state.boxOpen
        ? 'box'
        : state.revealRecord
          ? 'reveal'
          : state.gameMode === 'battle'
            ? 'battle'
            : state.gameMode === 'catch'
              ? 'catch'
              : 'overworld';
    }

    function showToast(message, durationMs) {
      el.toast.textContent = message;
      el.toast.classList.remove('hidden');
      if (toastTimer !== null) {
        clearTimeout(toastTimer);
      }
      toastTimer = window.setTimeout(() => {
        el.toast.classList.add('hidden');
        toastTimer = null;
      }, durationMs || 2000);
    }

    function renderOverworldHud() {
      const visible = state.gameMode === 'overworld';
      el.overworldHud.classList.toggle('hidden', !visible);
      if (!visible) return;

      el.wildCount.textContent = `Wild: ${state.wildCount}/${MAX_WILD_ON_MAP}`;
      el.nextSpawn.textContent = `Next: ${formatCountdown(state.nextSpawnSec)}`;

      const uniqueCount = new Set(state.collection.map((c) => c.species.id)).size;
      el.boxBtnSub.textContent = `${state.collection.length} · ${uniqueCount}/${POKEMON_SPECIES.length}`;

      el.btnSound.innerHTML = state.soundEnabled ? ICONS.soundOn : ICONS.soundOff;
      el.btnSound.classList.toggle('muted', !state.soundEnabled);
      el.btnSound.setAttribute('aria-label', state.soundEnabled ? 'Mute sound' : 'Unmute sound');

      const buddy = getActiveBuddy();
      if (!buddy) {
        el.buddySlot.innerHTML = '';
      } else {
        const swatch = getRecordSwatchColor(buddy);
        el.buddySlot.innerHTML = `
          <div data-testid="buddy-hud-card" class="buddy-card">
            <span class="swatch-dot" style="background-color: ${escapeHTML(swatch)}"></span>
            <div class="buddy-meta">
              <div class="buddy-label">${ICONS.heart}<span>Partner</span></div>
              <div class="buddy-name-row">
                ${escapeHTML(buddy.species.name)}
                ${buddy.isDark ? '<span class="dark-tag">· Dark</span>' : ''}
                <span class="star-amber">${formatStars(buddy.stars)}</span>
              </div>
            </div>
            <button
              type="button"
              id="btn-recall-buddy"
              class="btn-recall"
              aria-label="Recall ${escapeHTML(buddy.species.name)}"
              title="Put back in Poké Box"
            >${ICONS.x}</button>
          </div>
        `;
        const recallBtn = document.getElementById('btn-recall-buddy');
        if (recallBtn) {
          recallBtn.addEventListener('click', () => {
            const name = buddy.species.name;
            setBuddyUid(null);
            showToast(`${name} returned safely to your Poké Box.`, 1800);
          });
        }
      }

      if (el.btnBalloonAlert) {
        el.btnBalloonAlert.classList.toggle('hidden', !state.balloonVisible);
      }
    }

    function renderBattleOverlay(tick) {
      const visible = state.gameMode === 'battle' && Boolean(state.battleConfig);
      if (el.battleOverlay) {
        el.battleOverlay.classList.toggle('hidden', !visible);
      }
      if (!visible) return;
      const cfg = state.battleConfig;
      if (!tick) {
        el.battlePlayerName.textContent = cfg.playerRecord.species.name;
        el.battlePlayerTypes.textContent = (cfg.playerRecord.species.types || []).join(' / ');
        el.battleEnemyName.textContent = `Dark ${cfg.enemyCandidate.species.name}`;
        el.battleEnemyTypes.textContent = (cfg.enemyCandidate.species.types || []).join(' / ');
        el.battleMatchupBadge.textContent =
          cfg.outcome.reason === 'type-advantage'
            ? 'Type Advantage!'
            : cfg.outcome.reason === 'type-disadvantage'
              ? 'Tough Matchup!'
              : 'Even Fight · 70%';
        el.battlePlayerHp.style.width = '100%';
        el.battleEnemyHp.style.width = '100%';
        el.battleTimer.textContent = '10s';
        el.battleBanner.textContent = `Team Rocket sent out Dark ${cfg.enemyCandidate.species.name}!`;
        return;
      }
      el.battleTimer.textContent = `${tick.remainingSec}s`;
      el.battlePlayerHp.style.width = `${Math.max(0, Math.min(100, tick.playerHp))}%`;
      el.battleEnemyHp.style.width = `${Math.max(0, Math.min(100, tick.enemyHp))}%`;
      el.battleBanner.textContent = tick.banner;
    }

    function renderCatchOverlay() {
      const visible = state.gameMode === 'catch' && Boolean(state.encounter);
      el.catchOverlay.classList.toggle('hidden', !visible);
      if (!visible) return;

      const enc = state.encounter;
      el.encounterName.textContent = enc.species.name;
      if (el.encounterDark) {
        el.encounterDark.classList.toggle('hidden', !enc.isDark);
      }
      el.encounterShiny.classList.toggle('hidden', !enc.isShiny);
      if (el.encounterSub) {
        el.encounterSub.textContent = enc.isDark ? 'Team Rocket Dark Encounter' : 'Wild Encounter';
      }
      if (el.encounterBerryActive) {
        if (enc.activeBerryKey && BERRY_CONFIG[enc.activeBerryKey]) {
          const bCfg = BERRY_CONFIG[enc.activeBerryKey];
          el.encounterBerryActive.textContent = `${bCfg.label} Berry (+${Math.round(enc.activeBerryBonus * 100)}%)`;
          el.encounterBerryActive.classList.remove('hidden');
        } else {
          el.encounterBerryActive.classList.add('hidden');
        }
      }

      const activeKey = resolveActiveBallSelection(state.ballState);
      if (activeKey) {
        const activeCfg = BALL_CONFIG[activeKey];
        const eff = computeEffectiveCatchRate(activeCfg.catchRate, enc.activeBerryBonus || 0);
        el.catchRateValue.textContent = `${Math.round(eff * 100)}%`;
      } else {
        el.catchRateValue.textContent = '0%';
      }

      if (el.berryDock) {
        el.berryDock.innerHTML = BERRY_ORDER.map((key) => {
          const cfg = BERRY_CONFIG[key];
          const count = state.berryState.counts[key] || 0;
          const isEmpty = count <= 0;
          const isActive = enc.activeBerryKey === key;
          const remSec = count < cfg.maxCount ? Math.max(0, cfg.respawnSec - state.berryState.timers[key]) : 0;
          const timerText = count < cfg.maxCount ? `+${formatCountdown(remSec)}` : 'Full';

          return `
            <button
              type="button"
              data-berry-key="${key}"
              class="berry-btn ${isActive ? 'active' : ''} ${isEmpty ? 'empty' : ''}"
            >
              ${getBerrySwatchSVG(key)}
              <div class="ball-name">${escapeHTML(cfg.label)}</div>
              <div class="berry-bonus">+${Math.round(cfg.bonus * 100)}%</div>
              <div class="ball-count tabular-nums ${isEmpty ? 'no-stock' : 'has-stock'}">${count}/${cfg.maxCount}</div>
              <div class="ball-timer tabular-nums">${timerText}</div>
            </button>
          `;
        }).join('');
      }

      el.ballDock.innerHTML = BALL_ORDER.map((key) => {
        const cfg = BALL_CONFIG[key];
        const count = state.ballState.counts[key] || 0;
        const isEmpty = count <= 0;
        const isSelected = activeKey === key;
        const remSec = count < cfg.maxCount ? Math.max(0, cfg.respawnSec - state.ballState.timers[key]) : 0;
        const timerText = count < cfg.maxCount ? `+${formatCountdown(remSec)}` : 'Full';

        return `
          <button
            type="button"
            data-ball-key="${key}"
            class="ball-btn ${isSelected ? 'selected' : ''} ${isEmpty ? 'empty' : ''}"
          >
            ${getBallSwatchSVG(key)}
            <div class="ball-name">${escapeHTML(cfg.label)}</div>
            <div class="ball-count tabular-nums ${isEmpty ? 'no-stock' : 'has-stock'}">${count}/${cfg.maxCount}</div>
            <div class="ball-timer tabular-nums">${timerText}</div>
          </button>
        `;
      }).join('');
    }

    function renderRevealModal() {
      const rec = state.revealRecord;
      if (!rec) {
        el.revealModal.classList.add('hidden');
        if (revealStage) {
          revealStage.destroy();
          revealStage = null;
        }
        return;
      }

      const is4Star = rec.stars === 4;
      const tags = [rec.isDark ? 'Dark' : '', rec.isShiny ? 'Rare Shiny' : ''].filter(Boolean);
      el.revealModal.classList.remove('hidden');
      el.revealModal.setAttribute('aria-label', `Caught ${rec.isDark ? 'Dark ' : ''}${rec.species.name}`);
      el.revealCard.classList.toggle('card-4star-rim', is4Star);
      el.revealKicker.textContent = tags.length > 0 ? `Gotcha! · ${tags.join(' · ')}` : 'Gotcha!';
      el.revealTitle.textContent = rec.isDark ? `Dark ${rec.species.name}` : rec.species.name;
      el.revealStars.textContent = formatStars(rec.stars);
      el.revealStarLabel.textContent = getStarLabel(rec.stars);
      el.revealNatureName.textContent = rec.nature.name;
      el.revealNatureDesc.textContent = rec.nature.desc;
      el.revealPalette.textContent =
        [rec.isDark ? 'Dark Shadow' : '', rec.isShiny ? 'Shiny' : ''].filter(Boolean).join(' · ') ||
        'Standard';
      el.revealAppraisalNote.textContent = is4Star
        ? '4★ Golden Edge Aura'
        : rec.isDark
          ? 'Rescued Dark Pokémon'
          : rec.isShiny
            ? 'Rare Shiny Variant'
            : 'Added to Poké Box';

      if (!revealStage) {
        revealStage = new Stage3D(el.revealCanvas);
      }
      revealStage.setRecord(rec);
    }

    function renderBoxModal() {
      if (!state.boxOpen) {
        el.boxModal.classList.add('hidden');
        if (boxStage) {
          boxStage.destroy();
          boxStage = null;
        }
        return;
      }

      el.boxModal.classList.remove('hidden');

      const uniqueCount = new Set(state.collection.map((r) => r.species.id)).size;
      el.boxSub.innerHTML = `Caught: <strong>${state.collection.length}</strong> · Park Pokédex: <strong class="dex-green">${uniqueCount}</strong>/${POKEMON_SPECIES.length}`;

      const filtered = state.collection.filter((rec) => {
        if (state.boxFilter === '4star') return rec.stars === 4;
        if (state.boxFilter === 'shiny') return rec.isShiny;
        if (state.boxFilter === 'dark') return Boolean(rec.isDark);
        return true;
      });

      const activeRecord =
        filtered.find((r) => r.uid === state.boxSelectedUid) ||
        filtered[0] ||
        state.collection[0] ||
        null;
      const activeIsBuddy = Boolean(activeRecord && activeRecord.uid === state.buddyUid);

      el.boxStageFrame.classList.toggle('card-4star-rim', Boolean(activeRecord && activeRecord.stars === 4));
      el.showcaseName.textContent = activeRecord ? activeRecord.species.name : 'No Pokémon Yet';
      if (el.showcaseDark) {
        el.showcaseDark.classList.toggle('hidden', !(activeRecord && activeRecord.isDark));
      }
      el.showcaseShiny.classList.toggle('hidden', !(activeRecord && activeRecord.isShiny));
      el.showcaseStars.textContent = activeRecord ? formatStars(activeRecord.stars) : '☆☆☆☆';
      el.showcaseDetail.textContent = activeRecord
        ? `${getStarLabel(activeRecord.stars)} · ${activeRecord.nature.name} Nature`
        : 'Tap any wild Pokémon in the park to catch one!';

      if (activeRecord) {
        el.btnShowcaseFollow.classList.remove('hidden');
        el.btnShowcaseFollow.classList.toggle('active', activeIsBuddy);
        el.btnShowcaseFollow.innerHTML = activeIsBuddy
          ? `${ICONS.check}<span>Following You (Tap to Recall)</span>`
          : `${ICONS.footprints}<span>Follow Me in Park</span>`;
        el.btnShowcaseFollow.dataset.targetUid = activeRecord.uid;
      } else {
        el.btnShowcaseFollow.classList.add('hidden');
      }

      if (!boxStage) {
        boxStage = new Stage3D(el.boxStageCanvas);
      }
      boxStage.setRecord(activeRecord);

      const tabBtns = el.boxFilterTabs.querySelectorAll('[data-filter]');
      tabBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === state.boxFilter);
      });

      if (filtered.length === 0) {
        el.boxGrid.innerHTML = `
          <div class="box-empty">
            <div class="box-empty-title">No Pokémon in this view yet!</div>
            <div class="box-empty-sub">Tap a Pokémon in the park and swipe a Poké Ball to catch it.</div>
          </div>
        `;
        return;
      }

      el.boxGrid.innerHTML = filtered
        .map((rec) => {
          const isSelected = activeRecord && activeRecord.uid === rec.uid;
          const isBuddy = state.buddyUid === rec.uid;
          const is4Star = rec.stars === 4;
          const swatch = getRecordSwatchColor(rec);

          return `
            <div class="poke-card ${isSelected ? 'selected' : ''} ${is4Star ? 'card-4star-rim' : ''}">
              <button type="button" class="poke-card-select" data-select-uid="${escapeHTML(rec.uid)}">
                <div class="poke-card-top">
                  <span class="swatch-dot" style="background-color: ${escapeHTML(swatch)}"></span>
                  ${rec.isDark ? '<span class="dark-tag">Dark</span>' : ''}
                  ${rec.isShiny ? '<span class="shiny-tag">Shiny</span>' : ''}
                </div>
                <div class="poke-card-name font-display">${escapeHTML(rec.species.name)}</div>
                <div class="poke-card-stars">${formatStars(rec.stars)}</div>
                <div class="poke-card-nature">${escapeHTML(rec.nature.name)}</div>
              </button>
              <button
                type="button"
                data-follow-uid="${escapeHTML(rec.uid)}"
                aria-label="${isBuddy ? `Stop ${escapeHTML(rec.species.name)} from following` : `Have ${escapeHTML(rec.species.name)} follow you`}"
                class="btn-card-follow ${isBuddy ? 'active' : ''}"
              >
                ${isBuddy ? `${ICONS.check}<span>Following</span>` : `${ICONS.footprints}<span>Follow</span>`}
              </button>
            </div>
          `;
        })
        .join('');
    }

    function setBuddyUid(nextUid) {
      state.buddyUid = nextUid;
      const buddy = getActiveBuddy();
      engine.setBuddyFollower(buddy);
      try {
        if (nextUid && buddy) {
          localStorage.setItem(BUDDY_STORAGE_KEY, nextUid);
        } else {
          localStorage.removeItem(BUDDY_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
      renderOverworldHud();
      if (state.boxOpen) renderBoxModal();
    }

    function toggleBuddy(record) {
      if (!record) return;
      if (state.buddyUid === record.uid) {
        setBuddyUid(null);
        showToast(`${record.species.name} returned to your Poké Box.`, 1800);
      } else {
        setBuddyUid(record.uid);
        SFX.buddyCheer();
        showToast(`${record.species.name} is now following you!`, 2000);
      }
    }

    function handleRocketBalloonActivate() {
      const playerRecord = getActiveBuddy() || state.collection[0] || null;
      if (!playerRecord) {
        showToast('Catch a Pokémon first to battle Team Rocket!', 2200);
        return;
      }
      const enemySpecies = POKEMON_SPECIES[Math.floor(Math.random() * POKEMON_SPECIES.length)];
      const enemyCandidate = {
        species: enemySpecies,
        isShiny: Math.random() < 0.05,
        isDark: true,
        nature: rollNature(),
        stars: rollStarRating(),
      };
      const outcome = resolveRocketBattleOutcome(
        playerRecord.species.types,
        enemyCandidate.species.types
      );
      engine.enterRocketBattle({
        playerRecord,
        enemyCandidate,
        outcome,
      });
    }

    let engine = null;
    engine = new ParkEngine(
      el.canvasMount,
      state.ballState,
      state.berryState,
      initialWorldState,
      {
        onModeChange: (mode, nextEncounter) => {
          state.gameMode = mode;
          state.encounter = nextEncounter;
          if (mode !== 'battle') {
            state.battleConfig = null;
          }
          renderOverworldHud();
          renderBattleOverlay();
          renderCatchOverlay();
          syncBodyState();
        },
        onHudTick: (count, nextSec, nextBalls, nextBerries) => {
          state.wildCount = count;
          state.nextSpawnSec = nextSec;
          state.ballState = nextBalls;
          if (nextBerries) {
            state.berryState = nextBerries;
            saveBerryState(nextBerries);
          }
          saveBallState(nextBalls);
          if (state.gameMode === 'overworld') {
            renderOverworldHud();
          } else if (state.gameMode === 'catch') {
            renderCatchOverlay();
          }
        },
        onEncounterUpdate: (patch) => {
          if (state.encounter && patch) {
            Object.assign(state.encounter, patch);
            renderCatchOverlay();
          }
        },
        onWorldDirty: (snapshot) => {
          if (snapshot) {
            saveWorldState(snapshot);
          } else if (engine) {
            saveWorldState(engine.getWorldSnapshot());
          }
        },
        onBalloonChange: (visible) => {
          state.balloonVisible = Boolean(visible);
          renderOverworldHud();
        },
        onBalloonTap: () => {
          handleRocketBalloonActivate();
        },
        onBattleStart: (cfg) => {
          state.battleConfig = cfg;
          state.gameMode = 'battle';
          renderBattleOverlay();
          syncBodyState();
        },
        onBattleTick: (tick) => {
          renderBattleOverlay(tick);
        },
        onToast: (message, durationMs) => {
          showToast(message, durationMs);
        },
        onCatchSuccess: (record) => {
          state.collection.unshift(record);
          saveCollection(state.collection);
          state.revealRecord = record;
          renderOverworldHud();
          renderRevealModal();
          syncBodyState();
        },
      }
    );

    // Persist initial snapshot immediately so even rapid reloads preserve exact map spawns
    saveWorldState(engine.getWorldSnapshot());

    // Restore saved buddy follower immediately on boot
    if (state.buddyUid) {
      engine.setBuddyFollower(getActiveBuddy());
    }

    // Event Bindings
    el.btnSound.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      SFX.enabled = state.soundEnabled;
      if (state.soundEnabled) SFX.tapPokemon();
      renderOverworldHud();
    });

    el.btnOpenBox.addEventListener('click', () => {
      state.boxOpen = true;
      renderBoxModal();
      syncBodyState();
    });

    if (el.btnBalloonAlert) {
      el.btnBalloonAlert.addEventListener('click', () => {
        handleRocketBalloonActivate();
      });
    }

    el.btnBackPark.addEventListener('click', () => {
      engine.exitCatchToOverworld();
    });

    if (el.berryDock) {
      el.berryDock.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-berry-key]');
        if (!btn) return;
        const key = btn.getAttribute('data-berry-key');
        if (key) {
          engine.applyBerry(key);
        }
      });
    }

    el.ballDock.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ball-key]');
      if (!btn) return;
      const key = btn.getAttribute('data-ball-key');
      if (key) {
        engine.selectBall(key);
      }
    });

    el.btnWalkWithMe.addEventListener('click', () => {
      if (!state.revealRecord) return;
      const rec = state.revealRecord;
      state.revealRecord = null;
      renderRevealModal();
      setBuddyUid(rec.uid);
      SFX.buddyCheer();
      showToast(`${rec.species.name} is walking beside you!`, 2200);
      syncBodyState();
    });

    el.btnRevealContinue.addEventListener('click', () => {
      state.revealRecord = null;
      renderRevealModal();
      syncBodyState();
    });

    el.btnBoxDone.addEventListener('click', () => {
      state.boxOpen = false;
      renderBoxModal();
      syncBodyState();
    });

    el.btnShowcaseFollow.addEventListener('click', () => {
      const uid = el.btnShowcaseFollow.dataset.targetUid;
      const rec = state.collection.find((c) => c.uid === uid);
      if (rec) toggleBuddy(rec);
    });

    el.boxFilterTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      state.boxFilter = btn.getAttribute('data-filter') || 'all';
      renderBoxModal();
    });

    el.boxGrid.addEventListener('click', (e) => {
      const followBtn = e.target.closest('[data-follow-uid]');
      if (followBtn) {
        const uid = followBtn.getAttribute('data-follow-uid');
        const rec = state.collection.find((c) => c.uid === uid);
        if (rec) {
          state.boxSelectedUid = rec.uid;
          toggleBuddy(rec);
        }
        return;
      }
      const selectBtn = e.target.closest('[data-select-uid]');
      if (selectBtn) {
        state.boxSelectedUid = selectBtn.getAttribute('data-select-uid');
        renderBoxModal();
      }
    });

    // PWA install & offline experience
    let deferredInstallPrompt = null;
    const standaloneMedia = window.matchMedia
      ? window.matchMedia('(display-mode: standalone)')
      : null;

    function isAppStandalone() {
      return (
        Boolean(standaloneMedia && standaloneMedia.matches) ||
        window.navigator.standalone === true
      );
    }

    function isIOSDevice() {
      const ua = (window.navigator && window.navigator.userAgent || '').toLowerCase();
      return /iphone|ipad|ipod/.test(ua);
    }

    function syncPwaInstallUi() {
      if (!el.btnInstallApp) return;
      const uiState = resolvePwaInstallUiState({
        isStandalone: isAppStandalone(),
        hasDeferredPrompt: Boolean(deferredInstallPrompt),
        isIOS: isIOSDevice(),
      });
      el.btnInstallApp.classList.toggle('hidden', !uiState.visible);
      if (uiState.visible && el.btnInstallLabel) {
        el.btnInstallLabel.textContent = uiState.label;
      }
    }

    function syncOfflineUi() {
      if (!el.offlineBanner) return;
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      el.offlineBanner.classList.toggle('hidden', !offline);
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      deferredInstallPrompt = e;
      syncPwaInstallUi();
    }

    function handleAppInstalled() {
      deferredInstallPrompt = null;
      syncPwaInstallUi();
      showToast('Pokémon Park 3D installed!', 2400);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', syncOfflineUi);
    window.addEventListener('offline', syncOfflineUi);
    if (standaloneMedia && typeof standaloneMedia.addEventListener === 'function') {
      standaloneMedia.addEventListener('change', syncPwaInstallUi);
    }

    if (el.btnInstallApp) {
      el.btnInstallApp.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          await deferredInstallPrompt.prompt();
          try {
            const choice = await deferredInstallPrompt.userChoice;
            if (choice && choice.outcome === 'accepted') {
              deferredInstallPrompt = null;
            }
          } catch {
            deferredInstallPrompt = null;
          }
          syncPwaInstallUi();
          return;
        }
        if (isIOSDevice() && el.iosInstallModal) {
          el.iosInstallModal.classList.remove('hidden');
        }
      });
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
          console.warn('Service worker registration failed:', err);
        });
      });
    }

    if (el.btnIosInstallClose && el.iosInstallModal) {
      el.btnIosInstallClose.addEventListener('click', () => {
        el.iosInstallModal.classList.add('hidden');
      });
    }

    syncPwaInstallUi();
    syncOfflineUi();

    // Initial render
    renderOverworldHud();
    syncBodyState();

    function flushAllPersistence() {
      saveBallState(engine.getBallState());
      saveBerryState(engine.getBerryState());
      saveWorldState(engine.getWorldSnapshot());
    }

    function handleVisibilitySave() {
      if (document.visibilityState === 'hidden') {
        flushAllPersistence();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilitySave);
    window.addEventListener('pagehide', flushAllPersistence);

    window.addEventListener('beforeunload', () => {
      flushAllPersistence();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', syncOfflineUi);
      window.removeEventListener('offline', syncOfflineUi);
      window.removeEventListener('pagehide', flushAllPersistence);
      document.removeEventListener('visibilitychange', handleVisibilitySave);
      if (revealStage) revealStage.destroy();
      if (boxStage) boxStage.destroy();
      engine.destroy();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})(window);
