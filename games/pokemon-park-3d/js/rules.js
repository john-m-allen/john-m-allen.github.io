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

  const PARK_RADIUS = 16.2;
  const MAX_WILD_ON_MAP = 10;
  const WILD_DESPAWN_SEC = 120;
  const AUTO_SPAWN_SEC = 30;
  const PLAYER_RADIUS = 0.55;

  // Elevated ball rest coordinates so the 3D Poké Ball sits cleanly above the bottom HUD dock
  const BALL_REST_COORDS = { x: 0, y: 1.44, z: 4.85 };
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
    const { startX, startY, endX, endY, curveAccumX, samples, viewportWidth, viewportHeight } = params;
    const upwardFlick = startY - endY;
    const totalDx = endX - startX;

    const viewW = Math.max(320, viewportWidth);
    const viewH = Math.max(540, viewportHeight);

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

    const distPower = upwardFlick / (viewH * 0.23);
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

    const depthError = Math.abs(landingZ - POKEMON_HIT_COORDS.z);
    const willHit =
      clampedPower >= 0.48 &&
      clampedPower <= 1.55 &&
      Math.abs(effectiveAimX) <= 1.65 &&
      depthError <= 2.45;

    // Both preview arc and actual ball flight use landingX so the thrown ball matches the guide 1:1
    const landingX = willHit
      ? Math.max(-1.1, Math.min(1.1, effectiveAimX * 0.62))
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
    PARK_RADIUS,
    MAX_WILD_ON_MAP,
    WILD_DESPAWN_SEC,
    AUTO_SPAWN_SEC,
    PLAYER_RADIUS,
    BALL_REST_COORDS,
    POKEMON_HIT_COORDS,
    rollNature,
    rollStarRating,
    formatStars,
    getStarLabel,
    shouldShowFourStarAura,
    formatCountdown,
    createInitialBallState,
    tickBallRespawnsPure,
    resolveActiveBallSelection,
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
