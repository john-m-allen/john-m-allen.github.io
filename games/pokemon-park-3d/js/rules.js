// Pure game rules, ball physics, star appraisal, and buddy follower kinematics.
// Works directly in browser (<script>) and in Node unit tests (via global/CommonJS export).
(function (root) {
  const NATURES = [
    { name: 'Jolly', desc: 'Cheerful & bouncy' },
    { name: 'Brave', desc: 'Bold & heroic' },
    { name: 'Sleepy', desc: 'Cozy & yawning' },
    { name: 'Sassy', desc: 'Cheeky & playful' },
    { name: 'Timid', desc: 'Sweet & shy' },
    { name: 'Fierce', desc: 'Spirited & roaring' },
  ];

  const BALL_CONFIG = {
    poke: { key: 'poke', label: 'Poké', color: '#ef4444', catchRate: 0.25, maxCount: 10, respawnSec: 10 },
    great: { key: 'great', label: 'Great', color: '#2563eb', stripe: '#ef4444', catchRate: 0.4, maxCount: 10, respawnSec: 30 },
    ultra: { key: 'ultra', label: 'Ultra', color: '#1e293b', stripe: '#facc15', catchRate: 0.65, maxCount: 10, respawnSec: 300 },
    master: { key: 'master', label: 'Master', color: '#7e22ce', stripe: '#ec4899', catchRate: 1.0, maxCount: 10, respawnSec: 1200 },
  };

  const BALL_ORDER = ['poke', 'great', 'ultra', 'master'];

  const BERRY_CONFIG = {
    oran: { key: 'oran', label: 'Oran', bonus: 0.05, color: '#38bdf8', maxCount: 10, respawnSec: 15 },
    razz: { key: 'razz', label: 'Razz', bonus: 0.10, color: '#fb7185', maxCount: 10, respawnSec: 45 },
    pinap: { key: 'pinap', label: 'Pinap', bonus: 0.15, color: '#facc15', maxCount: 10, respawnSec: 180 },
    golden: { key: 'golden', label: 'Golden', bonus: 0.20, color: '#f59e0b', maxCount: 10, respawnSec: 600 },
  };

  const BERRY_ORDER = ['oran', 'razz', 'pinap', 'golden'];

  const PARK_RADIUS = 16.2;
  const MAX_WILD_ON_MAP = 10;
  const WILD_DESPAWN_SEC = 120;
  const AUTO_SPAWN_SEC = 30;
  const BALLOON_INTERVAL_SEC = 120;
  const BATTLE_DURATION_SEC = 10;
  const PLAYER_RADIUS = 0.55;

  // Elevated ball rest coordinates so the 3D Poké Ball sits cleanly above the berry & ball docks
  const BALL_REST_COORDS = { x: 0, y: 1.74, z: 4.85 };
  const POKEMON_HIT_COORDS = { x: 0, y: 2.12, z: -1.65 };

  function rollNature(rng) {
    const fn = rng || Math.random;
    const idx = Math.min(NATURES.length - 1, Math.floor(fn() * NATURES.length));
    return NATURES[idx];
  }

  function rollStarRating(rng) {
    const fn = rng || Math.random;
    const r = fn();
    if (r < 0.25) return 0;
    if (r < 0.55) return 1;
    if (r < 0.80) return 2;
    if (r < 0.97) return 3;
    return 4;
  }

  function formatStars(stars) {
    const clamped = Math.max(0, Math.min(4, Math.round(stars)));
    return '★'.repeat(clamped) + '☆'.repeat(4 - clamped);
  }

  function getStarLabel(stars) {
    if (stars === 4) return '4★ Perfect!';
    if (stars === 3) return '3★ Amazing!';
    if (stars === 2) return '2★ Great!';
    if (stars === 1) return '1★ Nice!';
    return '0★ Cute!';
  }

  function shouldShowFourStarAura(stars, context) {
    if (stars !== 4) return false;
    return context === 'reveal' || context === 'box';
  }

  function formatCountdown(sec) {
    const s = Math.max(0, Math.ceil(sec));
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return `${m}:${String(rem).padStart(2, '0')}`;
    }
    return `${s}s`;
  }

  function createInitialBallState() {
    return {
      selected: 'poke',
      counts: { poke: 10, great: 10, ultra: 10, master: 10 },
      timers: { poke: 0, great: 0, ultra: 0, master: 0 },
    };
  }

  function tickBallRespawnsPure(state, dt) {
    let dirty = false;
    for (const key of BALL_ORDER) {
      const cfg = BALL_CONFIG[key];
      if (state.counts[key] >= cfg.maxCount) {
        state.timers[key] = 0;
        continue;
      }
      state.timers[key] += dt;
      while (state.timers[key] >= cfg.respawnSec && state.counts[key] < cfg.maxCount) {
        state.timers[key] -= cfg.respawnSec;
        state.counts[key] += 1;
        dirty = true;
      }
      if (state.counts[key] >= cfg.maxCount) {
        state.timers[key] = 0;
      }
    }
    return dirty;
  }

  function resolveActiveBallSelection(state) {
    if (!state || !state.counts) return null;
    if (state.selected && state.counts[state.selected] > 0) {
      return state.selected;
    }
    for (const key of BALL_ORDER) {
      if (state.counts[key] > 0) {
        return key;
      }
    }
    return null;
  }

  function resolvePwaInstallUiState(opts) {
    const { isStandalone, hasDeferredPrompt, isIOS } = opts || {};
    if (isStandalone) {
      return { visible: false, label: '' };
    }
    if (hasDeferredPrompt || isIOS) {
      return { visible: true, label: 'Install App' };
    }
    return { visible: false, label: '' };
  }

  function createInitialBerryState() {
    return {
      counts: { oran: 10, razz: 10, pinap: 10, golden: 10 },
      timers: { oran: 0, razz: 0, pinap: 0, golden: 0 },
    };
  }

  function tickBerryRespawnsPure(state, dt) {
    let dirty = false;
    for (const key of BERRY_ORDER) {
      const cfg = BERRY_CONFIG[key];
      if (state.counts[key] >= cfg.maxCount) {
        state.timers[key] = 0;
        continue;
      }
      state.timers[key] += dt;
      while (state.timers[key] >= cfg.respawnSec && state.counts[key] < cfg.maxCount) {
        state.timers[key] -= cfg.respawnSec;
        state.counts[key] += 1;
        dirty = true;
      }
      if (state.counts[key] >= cfg.maxCount) {
        state.timers[key] = 0;
      }
    }
    return dirty;
  }

  function computeEffectiveCatchRate(baseCatchRate, berryBonus) {
    const base = typeof baseCatchRate === 'number' ? baseCatchRate : 0;
    const bonus = typeof berryBonus === 'number' ? berryBonus : 0;
    return Math.max(0, Math.min(1, base + bonus));
  }

  function darkenHexColor(hex, factor) {
    const f = factor === undefined ? 0.3 : factor;
    if (typeof hex !== 'string') return hex;
    const cleaned = hex.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return hex;
    const scale = Math.max(0, Math.min(1, 1 - f));
    const r = Math.round(parseInt(cleaned.slice(0, 2), 16) * scale);
    const g = Math.round(parseInt(cleaned.slice(2, 4), 16) * scale);
    const b = Math.round(parseInt(cleaned.slice(4, 6), 16) * scale);
    return (
      '#' +
      [r, g, b]
        .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
        .join('')
    );
  }

  const TYPE_CHART = {
    normal: { rock: 0.5, ghost: 0, steel: 0.5 },
    fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon: { dragon: 2, steel: 0.5, fairy: 0 },
    dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
  };

  function computeTypeEffectiveness(attackerTypes, defenderTypes) {
    const atk = Array.isArray(attackerTypes) && attackerTypes.length > 0 ? attackerTypes : ['normal'];
    const def = Array.isArray(defenderTypes) && defenderTypes.length > 0 ? defenderTypes : ['normal'];
    let bestMult = 1;
    for (const aType of atk) {
      let mult = 1;
      const chart = TYPE_CHART[aType] || {};
      for (const dType of def) {
        if (chart[dType] !== undefined) {
          mult *= chart[dType];
        }
      }
      if (mult > bestMult) bestMult = mult;
    }
    return bestMult;
  }

  function resolveRocketBattleOutcome(playerTypes, enemyTypes, rng) {
    const fn = rng || Math.random;
    const playerEff = computeTypeEffectiveness(playerTypes, enemyTypes);
    const enemyEff = computeTypeEffectiveness(enemyTypes, playerTypes);
    const playerAdvantage = playerEff > 1;
    const enemyAdvantage = enemyEff > 1;

    if (playerAdvantage && !enemyAdvantage) {
      return {
        playerWon: true,
        reason: 'type-advantage',
        winChance: 1.0,
        playerEff,
        enemyEff,
      };
    }
    if (enemyAdvantage && !playerAdvantage) {
      return {
        playerWon: false,
        reason: 'type-disadvantage',
        winChance: 0.0,
        playerEff,
        enemyEff,
      };
    }
    // Neutral / tied advantage: player wins 70% of the time
    const winChance = 0.7;
    return {
      playerWon: fn() < winChance,
      reason: 'neutral',
      winChance,
      playerEff,
      enemyEff,
    };
  }

  function advancePersistedWorldState(savedState, nowMs, speciesList, rng) {
    const fn = rng || Math.random;
    const list = Array.isArray(speciesList) ? speciesList : [];
    const safeSaved = savedState || {};
    const savedAt = typeof safeSaved.savedAt === 'number' && safeSaved.savedAt > 0 ? safeSaved.savedAt : nowMs;
    const elapsedSec = Math.max(0, (nowMs - savedAt) / 1000);

    const surviving = [];
    const rawSpawns = Array.isArray(safeSaved.wildSpawns) ? safeSaved.wildSpawns : [];
    for (const w of rawSpawns) {
      const nextAge = (typeof w.ageSec === 'number' ? w.ageSec : 0) + elapsedSec;
      if (nextAge < WILD_DESPAWN_SEC) {
        surviving.push(Object.assign({}, w, { ageSec: nextAge }));
      }
    }

    const prevAuto = typeof safeSaved.autoSpawnTimer === 'number' ? Math.max(0, safeSaved.autoSpawnTimer) : 0;
    const totalAutoTime = prevAuto + elapsedSec;
    const spawnCount = Math.floor(totalAutoTime / AUTO_SPAWN_SEC);
    const nextAutoSpawnTimer = totalAutoTime % AUTO_SPAWN_SEC;

    if (spawnCount > 0 && list.length > 0) {
      const maxRelevant = Math.ceil(WILD_DESPAWN_SEC / AUTO_SPAWN_SEC) + 2;
      const startIdx = Math.max(0, spawnCount - maxRelevant);
      for (let i = startIdx; i < spawnCount; i++) {
        const ageSec = totalAutoTime - (i + 1) * AUTO_SPAWN_SEC;
        if (ageSec >= WILD_DESPAWN_SEC) continue;
        while (surviving.length >= MAX_WILD_ON_MAP) {
          surviving.shift();
        }
        const species = list[Math.floor(fn() * list.length)];
        const isShiny = fn() < 0.05;
        const nature = rollNature(fn);
        const stars = rollStarRating(fn);
        const maxAttempts = 2 + Math.floor(fn() * 4);
        surviving.push({
          id: `${species.id}_${Math.round(nowMs)}_${i}_${Math.floor(fn() * 10000)}`,
          speciesId: species.id,
          isShiny,
          isDark: false,
          natureName: nature.name,
          stars,
          maxAttempts,
          attemptsUsed: 0,
          ageSec,
          x: null,
          z: null,
          heading: fn() * Math.PI * 2,
        });
      }
    }

    const prevBalloon = typeof safeSaved.balloonTimer === 'number' ? Math.max(0, safeSaved.balloonTimer) : 0;
    const totalBalloon = prevBalloon + elapsedSec;
    const balloonDue = totalBalloon >= BALLOON_INTERVAL_SEC;
    const nextBalloonTimer = balloonDue ? 0 : totalBalloon;

    return {
      wildSpawns: surviving,
      autoSpawnTimer: nextAutoSpawnTimer,
      balloonTimer: nextBalloonTimer,
      balloonDue,
      elapsedSec,
    };
  }

  function lerpAngle(current, target, t) {
    const diff = ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return current + diff * Math.min(1, t);
  }

  function isPointOpenInPark(x, z, obstacles, playerPos, clearance) {
    const clr = clearance === undefined ? 1.25 : clearance;
    if (Math.hypot(x, z) > PARK_RADIUS - clr) return false;
    for (const obs of obstacles) {
      if (Math.hypot(x - obs.x, z - obs.z) < obs.r + clr) return false;
    }
    if (playerPos && Math.hypot(x - playerPos.x, z - playerPos.z) < PLAYER_RADIUS + clr) {
      return false;
    }
    return true;
  }

  function computeSwipeThrowParamsPure(params) {
    const {
      startX,
      startY,
      endX,
      endY,
      curveAccumX,
      samples,
      viewportWidth,
      viewportHeight,
      ballKey,
    } = params;
    const upwardFlick = startY - endY;
    const totalDx = endX - startX;
    const totalSwipeDist = Math.hypot(totalDx, upwardFlick);

    const viewW = Math.max(320, viewportWidth);
    const viewH = Math.max(540, viewportHeight);
    const isLargeDevice = viewW >= 600;

    let tailDx = totalDx;
    let tailDy = upwardFlick;
    let upwardSpeed = 0;

    if (samples && samples.length >= 2) {
      const last = samples[samples.length - 1];
      let anchorIdx = Math.max(0, samples.length - 6);
      for (let i = samples.length - 2; i >= 0; i--) {
        if (last.t - samples[i].t <= 140) {
          anchorIdx = i;
        } else {
          break;
        }
      }
      const anchor = samples[anchorIdx];
      tailDx = endX - anchor.x;
      tailDy = anchor.y - endY;
      const dtMs = Math.max(16, (last.t - anchor.t) || 100);
      upwardSpeed = Math.max(0, tailDy) / dtMs;
    }

    const overallSlope = totalDx / Math.max(36, upwardFlick);
    const tailSlope = tailDy > 16 ? tailDx / Math.max(26, tailDy) : overallSlope;
    const aimSlope = Math.max(-2.4, Math.min(2.4, tailSlope * 0.62 + overallSlope * 0.38));

    // Extrapolate swipe trajectory onto the Pokémon's screen plane (center X, ~44% height)
    const targetScreenX = viewW * 0.5;
    const targetScreenY = viewH * 0.44;
    const remY = Math.max(0, Math.min(viewH * 0.25, endY - targetScreenY));
    const projectedScreenX = endX + aimSlope * remY;

    // Perspective camera at FOV 44°, distance 11.15 spans ~9.0 world units vertically at z = -1.65
    const worldPerPx = 9.0 / viewH;
    const rawAimX = (projectedScreenX - targetScreenX) * worldPerPx;
    const bendCurveX = Math.max(-1.8, Math.min(1.8, (curveAccumX / viewH) * 5.2));
    const rawLandingX = Math.max(-5.2, Math.min(5.2, rawAimX + aimSlope * 0.55));
    const effectiveAimX = rawLandingX + bendCurveX * 0.35;

    // Master Balls always home onto the Pokémon on any deliberate swipe, even a bad one
    if (ballKey === 'master' && (upwardFlick > 16 || totalSwipeDist > 20)) {
      return {
        upwardFlick: Math.max(upwardFlick, 24),
        landingX: Math.max(-0.35, Math.min(0.35, effectiveAimX * 0.12)),
        landingY: POKEMON_HIT_COORDS.y,
        landingZ: POKEMON_HIT_COORDS.z,
        bendCurveX: bendCurveX * 0.2,
        effectiveAimX,
        arcPeak: 0.95,
        willHit: true,
      };
    }

    // Cap vertical flick distance scaling on tablets so thumb swipes feel identical to phones
    const refFlickHeight = isLargeDevice ? Math.min(viewH, 860) : viewH;
    const distPower = upwardFlick / (refFlickHeight * 0.23);
    const speedBonus =
      upwardFlick > 80 ? Math.min(0.22, Math.max(0, (upwardSpeed - 0.85) * 0.14)) : 0;
    const clampedPower = Math.max(0.25, Math.min(1.75, distPower + speedBonus));

    const landingZ = POKEMON_HIT_COORDS.z + (1.0 - clampedPower) * 4.4;
    const landingY =
      clampedPower < 0.48
        ? 1.48
        : clampedPower > 1.55
          ? 3.25
          : POKEMON_HIT_COORDS.y + (clampedPower - 1.0) * 0.32;

    // Larger devices (tablets/desktops) get a proportionally wider hitbox so physical swipe effort matches phones
    const tabletHitboxMult = isLargeDevice ? Math.min(1.45, 1.2 + (viewW - 600) * 0.0004) : 1.0;
    const maxAimX = 1.65 * tabletHitboxMult;
    const maxDepthError = 2.45 * (isLargeDevice ? 1.2 : 1.0);
    const minPower = isLargeDevice ? 0.42 : 0.48;
    const maxPower = isLargeDevice ? 1.62 : 1.55;

    const depthError = Math.abs(landingZ - POKEMON_HIT_COORDS.z);
    const willHit =
      clampedPower >= minPower &&
      clampedPower <= maxPower &&
      Math.abs(effectiveAimX) <= maxAimX &&
      depthError <= maxDepthError;

    // Both preview arc and actual ball flight use landingX so the thrown ball matches the guide 1:1
    const landingX = willHit
      ? Math.max(-1.1, Math.min(1.1, effectiveAimX * 0.55))
      : rawLandingX;

    return {
      upwardFlick,
      landingX,
      landingY,
      landingZ,
      bendCurveX,
      effectiveAimX,
      arcPeak: Math.max(0.68, Math.min(1.42, 0.72 + clampedPower * 0.36)),
      willHit,
    };
  }

  function computeBuddyFollowStep(input) {
    const {
      buddyX,
      buddyZ,
      buddyHeading,
      buddyRadius,
      playerX,
      playerZ,
      playerHeading,
      obstacles,
      dt,
    } = input;

    const backX = -Math.sin(playerHeading) * 1.45 + Math.cos(playerHeading) * 0.85;
    const backZ = -Math.cos(playerHeading) * 1.45 - Math.sin(playerHeading) * 0.85;
    const targetX = playerX + backX;
    const targetZ = playerZ + backZ;

    const dxToTarget = targetX - buddyX;
    const dzToTarget = targetZ - buddyZ;
    const distToTarget = Math.hypot(dxToTarget, dzToTarget);

    const dxToPlayer = playerX - buddyX;
    const dzToPlayer = playerZ - buddyZ;
    const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);

    if (distToPlayer > 14) {
      return {
        x: targetX,
        z: targetZ,
        heading: playerHeading,
        speed: 0,
        isMoving: false,
      };
    }

    let nextX = buddyX;
    let nextZ = buddyZ;
    let nextHeading = buddyHeading;
    let moveSpeed = 0;
    let isMoving = false;

    if (distToTarget > 0.45) {
      isMoving = true;
      const baseSpeed = distToTarget > 4.0 ? 6.2 : distToTarget > 2.0 ? 5.2 : 3.9;
      moveSpeed = Math.min(baseSpeed, distToTarget / Math.max(0.016, dt));
      const step = Math.min(distToTarget, moveSpeed * dt);
      const dirX = dxToTarget / distToTarget;
      const dirZ = dzToTarget / distToTarget;

      nextX += dirX * step;
      nextZ += dirZ * step;

      const desiredHeading = Math.atan2(dirX, dirZ);
      nextHeading = lerpAngle(buddyHeading, desiredHeading, dt * 8.5);
    } else {
      const lookHeading = distToPlayer > 0.25 ? Math.atan2(dxToPlayer, dzToPlayer) : playerHeading;
      nextHeading = lerpAngle(buddyHeading, lookHeading, dt * 4.0);
    }

    const minPlayerSep = PLAYER_RADIUS + buddyRadius + 0.35;
    const pDx = nextX - playerX;
    const pDz = nextZ - playerZ;
    const pDist = Math.hypot(pDx, pDz);
    if (pDist > 0.0001 && pDist < minPlayerSep) {
      const push = minPlayerSep - pDist;
      nextX += (pDx / pDist) * push;
      nextZ += (pDz / pDist) * push;
    }

    for (const obs of obstacles) {
      const oDx = nextX - obs.x;
      const oDz = nextZ - obs.z;
      const oDist = Math.hypot(oDx, oDz);
      const minObsSep = obs.r + buddyRadius + 0.12;
      if (oDist > 0.0001 && oDist < minObsSep) {
        const push = minObsSep - oDist;
        nextX += (oDx / oDist) * push;
        nextZ += (oDz / oDist) * push;
      }
    }

    const radial = Math.hypot(nextX, nextZ);
    if (radial > PARK_RADIUS - buddyRadius) {
      const k = (PARK_RADIUS - buddyRadius) / radial;
      nextX *= k;
      nextZ *= k;
    }

    return {
      x: nextX,
      z: nextZ,
      heading: nextHeading,
      speed: moveSpeed,
      isMoving,
    };
  }

  const api = {
    NATURES,
    BALL_CONFIG,
    BALL_ORDER,
    BERRY_CONFIG,
    BERRY_ORDER,
    PARK_RADIUS,
    MAX_WILD_ON_MAP,
    WILD_DESPAWN_SEC,
    AUTO_SPAWN_SEC,
    BALLOON_INTERVAL_SEC,
    BATTLE_DURATION_SEC,
    PLAYER_RADIUS,
    BALL_REST_COORDS,
    POKEMON_HIT_COORDS,
    TYPE_CHART,
    rollNature,
    rollStarRating,
    formatStars,
    getStarLabel,
    shouldShowFourStarAura,
    formatCountdown,
    createInitialBallState,
    tickBallRespawnsPure,
    resolveActiveBallSelection,
    createInitialBerryState,
    tickBerryRespawnsPure,
    computeEffectiveCatchRate,
    darkenHexColor,
    computeTypeEffectiveness,
    resolveRocketBattleOutcome,
    advancePersistedWorldState,
    resolvePwaInstallUiState,
    lerpAngle,
    isPointOpenInPark,
    computeSwipeThrowParamsPure,
    computeBuddyFollowStep,
  };

  root.ParkRules = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
