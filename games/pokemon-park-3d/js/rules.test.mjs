import test from 'node:test';
import assert from 'node:assert/strict';
import './rules.js';

const {
  BALL_CONFIG,
  BERRY_CONFIG,
  BALLOON_INTERVAL_SEC,
  MAX_WILD_ON_MAP,
  createInitialBallState,
  createInitialBerryState,
  tickBallRespawnsPure,
  tickBerryRespawnsPure,
  computeEffectiveCatchRate,
  darkenHexColor,
  resolveActiveBallSelection,
  resolvePwaInstallUiState,
  resolveRocketBattleOutcome,
  advancePersistedWorldState,
  rollStarRating,
  formatStars,
  getStarLabel,
  shouldShowFourStarAura,
  computeSwipeThrowParamsPure,
  computeBuddyFollowStep,
  isPointOpenInPark,
} = globalThis.ParkRules;

test('rollStarRating covers all weighted tiers deterministically', () => {
  assert.equal(rollStarRating(() => 0.1), 0);
  assert.equal(rollStarRating(() => 0.4), 1);
  assert.equal(rollStarRating(() => 0.7), 2);
  assert.equal(rollStarRating(() => 0.9), 3);
  assert.equal(rollStarRating(() => 0.99), 4);
  assert.equal(formatStars(4), '★★★★');
  assert.equal(formatStars(0), '☆☆☆☆');
  assert.equal(getStarLabel(4), '4★ Perfect!');
});

test('shouldShowFourStarAura hides 4-star aura during catching mini-game and buddy following', () => {
  assert.equal(shouldShowFourStarAura(4, 'catch'), false);
  assert.equal(shouldShowFourStarAura(4, 'buddy'), false);
  assert.equal(shouldShowFourStarAura(4, 'overworld'), false);
  assert.equal(shouldShowFourStarAura(4, 'reveal'), true);
  assert.equal(shouldShowFourStarAura(4, 'box'), true);
  assert.equal(shouldShowFourStarAura(3, 'reveal'), false);
  assert.equal(shouldShowFourStarAura(3, 'box'), false);
});

test('tickBallRespawnsPure replenishes balls over time and caps at maxCount', () => {
  const state = createInitialBallState();
  state.counts.poke = 8;
  state.timers.poke = 0;

  const changed1 = tickBallRespawnsPure(state, BALL_CONFIG.poke.respawnSec);
  assert.equal(changed1, true);
  assert.equal(state.counts.poke, 9);

  const changed2 = tickBallRespawnsPure(state, BALL_CONFIG.poke.respawnSec * 3);
  assert.equal(changed2, true);
  assert.equal(state.counts.poke, BALL_CONFIG.poke.maxCount);
  assert.equal(state.timers.poke, 0);
});

test('resolveActiveBallSelection hides depleted balls and falls back to available stock', () => {
  const state = createInitialBallState();
  assert.equal(resolveActiveBallSelection(state), 'poke');

  state.counts.poke = 0;
  assert.equal(resolveActiveBallSelection(state), 'great');

  state.counts.great = 0;
  state.counts.ultra = 0;
  state.selected = 'ultra';
  assert.equal(resolveActiveBallSelection(state), 'master');

  state.counts.master = 0;
  assert.equal(resolveActiveBallSelection(state), null);
});

test('resolvePwaInstallUiState returns visibility and label for each platform state', () => {
  assert.deepEqual(
    resolvePwaInstallUiState({ isStandalone: true, hasDeferredPrompt: true, isIOS: true }),
    { visible: false, label: '' }
  );
  assert.deepEqual(
    resolvePwaInstallUiState({ isStandalone: false, hasDeferredPrompt: true, isIOS: false }),
    { visible: true, label: 'Install App' }
  );
  assert.deepEqual(
    resolvePwaInstallUiState({ isStandalone: false, hasDeferredPrompt: false, isIOS: true }),
    { visible: true, label: 'Install App' }
  );
  assert.deepEqual(
    resolvePwaInstallUiState({ isStandalone: false, hasDeferredPrompt: false, isIOS: false }),
    { visible: false, label: '' }
  );
});

test('computeSwipeThrowParamsPure follows swipe trajectory with generous toddler-friendly hitbox', () => {
  // Straight center swipe on mobile
  const hit = computeSwipeThrowParamsPure({
    startX: 195,
    startY: 600,
    endX: 195,
    endY: 390,
    curveAccumX: 0,
    samples: [
      { x: 195, y: 600, t: 0 },
      { x: 195, y: 390, t: 100 },
    ],
    viewportWidth: 390,
    viewportHeight: 844,
  });
  assert.equal(hit.willHit, true);

  // Diagonal swipe starting bottom-left and aimed straight into the center Pokémon
  const diagonalAimHit = computeSwipeThrowParamsPure({
    startX: 480,
    startY: 680,
    endX: 720,
    endY: 420,
    curveAccumX: 0,
    samples: [
      { x: 480, y: 680, t: 0 },
      { x: 600, y: 550, t: 70 },
      { x: 720, y: 420, t: 140 },
    ],
    viewportWidth: 1440,
    viewportHeight: 900,
  });
  assert.equal(diagonalAimHit.willHit, true);

  // Slightly wobbly toddler swipe (gentle upward push, ~70px off-center) still lands
  const toddlerWobbleHit = computeSwipeThrowParamsPure({
    startX: 195,
    startY: 660,
    endX: 255,
    endY: 500,
    curveAccumX: 15,
    samples: [
      { x: 195, y: 660, t: 0 },
      { x: 225, y: 580, t: 90 },
      { x: 255, y: 500, t: 180 },
    ],
    viewportWidth: 390,
    viewportHeight: 844,
  });
  assert.equal(toddlerWobbleHit.willHit, true);

  // Tiny short nudge clearly drops short
  const shortMiss = computeSwipeThrowParamsPure({
    startX: 195,
    startY: 600,
    endX: 195,
    endY: 540,
    curveAccumX: 0,
    samples: [
      { x: 195, y: 600, t: 0 },
      { x: 195, y: 540, t: 100 },
    ],
    viewportWidth: 390,
    viewportHeight: 844,
  });
  assert.equal(shortMiss.willHit, false);

  // Wildly off-target sideways swipe clearly misses
  const wideMiss = computeSwipeThrowParamsPure({
    startX: 200,
    startY: 600,
    endX: 380,
    endY: 390,
    curveAccumX: 120,
    samples: [
      { x: 200, y: 600, t: 0 },
      { x: 380, y: 390, t: 100 },
    ],
    viewportWidth: 390,
    viewportHeight: 844,
  });
  assert.equal(wideMiss.willHit, false);

  // Excessive sky-high fast flick overshoots
  const overshootMiss = computeSwipeThrowParamsPure({
    startX: 720,
    startY: 750,
    endX: 720,
    endY: 330,
    curveAccumX: 0,
    samples: [
      { x: 720, y: 750, t: 0 },
      { x: 720, y: 540, t: 40 },
      { x: 720, y: 330, t: 80 },
    ],
    viewportWidth: 1440,
    viewportHeight: 900,
  });
  assert.equal(overshootMiss.willHit, false);
});

test('computeBuddyFollowStep moves buddy toward trainer and respects obstacles & separation', () => {
  const obstacles = [{ x: 0, z: 0, r: 2.0 }];
  const step1 = computeBuddyFollowStep({
    buddyX: -6,
    buddyZ: 4,
    buddyHeading: 0,
    buddyRadius: 0.72,
    playerX: 0,
    playerZ: 4,
    playerHeading: 0,
    obstacles,
    dt: 0.1,
  });
  assert.equal(step1.isMoving, true);
  assert.ok(step1.x > -6, 'buddy moves right toward trainer');

  const stepObs = computeBuddyFollowStep({
    buddyX: 0.5,
    buddyZ: 0.5,
    buddyHeading: 0,
    buddyRadius: 0.72,
    playerX: 4,
    playerZ: 4,
    playerHeading: 0,
    obstacles,
    dt: 0.05,
  });
  assert.ok(Math.hypot(stepObs.x, stepObs.z) >= 2.0 + 0.72, 'buddy stays outside obstacle');
});

test('isPointOpenInPark rejects obstacles and outer boundary', () => {
  const obs = [{ x: -8, z: -7, r: 3.5 }];
  assert.equal(isPointOpenInPark(-8, -7, obs), false);
  assert.equal(isPointOpenInPark(20, 0, obs), false);
  assert.equal(isPointOpenInPark(2, 2, obs), true);
});

test('berries configure 5/10/15/20% catch boosts, respawn over time, and cap at 10', () => {
  assert.equal(BERRY_CONFIG.oran.bonus, 0.05);
  assert.equal(BERRY_CONFIG.razz.bonus, 0.10);
  assert.equal(BERRY_CONFIG.pinap.bonus, 0.15);
  assert.equal(BERRY_CONFIG.golden.bonus, 0.20);

  const bState = createInitialBerryState();
  assert.equal(bState.counts.oran, 10);
  bState.counts.oran = 7;
  bState.timers.oran = 0;

  const changed = tickBerryRespawnsPure(bState, BERRY_CONFIG.oran.respawnSec * 2 + 1);
  assert.equal(changed, true);
  assert.equal(bState.counts.oran, 9);
  assert.equal(bState.timers.oran, 1);

  tickBerryRespawnsPure(bState, BERRY_CONFIG.oran.respawnSec * 5);
  assert.equal(bState.counts.oran, 10);
  assert.equal(bState.timers.oran, 0);

  assert.ok(Math.abs(computeEffectiveCatchRate(0.25, 0.20) - 0.45) < 1e-9);
  assert.equal(computeEffectiveCatchRate(0.95, 0.20), 1);
});

test('tablet hitbox scaling allows phone-length swipes on tablets and master balls always hit', () => {
  // Phone-effort 200px upward swipe on an iPad / tablet viewport (820x1180) with slight horizontal offset
  const tabletSwipe = computeSwipeThrowParamsPure({
    startX: 410,
    startY: 920,
    endX: 500,
    endY: 720,
    curveAccumX: 18,
    samples: [
      { x: 410, y: 920, t: 0 },
      { x: 455, y: 820, t: 80 },
      { x: 500, y: 720, t: 160 },
    ],
    viewportWidth: 820,
    viewportHeight: 1180,
    ballKey: 'poke',
  });
  assert.equal(tabletSwipe.willHit, true);

  // Bad short & wildly off-target sideways swipe still hits when using a Master Ball
  const badMasterSwipe = computeSwipeThrowParamsPure({
    startX: 200,
    startY: 700,
    endX: 390,
    endY: 665,
    curveAccumX: 140,
    samples: [
      { x: 200, y: 700, t: 0 },
      { x: 390, y: 665, t: 120 },
    ],
    viewportWidth: 820,
    viewportHeight: 1180,
    ballKey: 'master',
  });
  assert.equal(badMasterSwipe.willHit, true);
});

test('darkenHexColor darkens hex colors by 30% for Dark Pokemon', () => {
  assert.equal(darkenHexColor('#ffffff', 0.3), '#b3b3b3');
  assert.equal(darkenHexColor('#6496c8', 0.3), '#46698c');
});

test('resolveRocketBattleOutcome enforces type advantage and 70% win rate when neutral', () => {
  const adv = resolveRocketBattleOutcome(['water'], ['fire'], () => 0.99);
  assert.equal(adv.playerWon, true);
  assert.equal(adv.reason, 'type-advantage');

  const disadv = resolveRocketBattleOutcome(['grass'], ['fire'], () => 0.01);
  assert.equal(disadv.playerWon, false);
  assert.equal(disadv.reason, 'type-disadvantage');

  let wins = 0;
  for (let i = 0; i < 100; i++) {
    const res = resolveRocketBattleOutcome(['normal'], ['normal'], () => (i + 0.5) / 100);
    if (res.playerWon) wins++;
  }
  assert.equal(wins, 70);
});

test('advancePersistedWorldState preserves spawns across short reload and advances elapsed time', () => {
  const fakeSpecies = [
    { id: 'pikachu', name: 'Pikachu' },
    { id: 'bulbasaur', name: 'Bulbasaur' },
  ];
  const saved = {
    savedAt: 100000,
    autoSpawnTimer: 10,
    balloonTimer: 20,
    wildSpawns: [
      { id: 'p1', speciesId: 'pikachu', ageSec: 15, x: 2, z: 3, heading: 0.5 },
      { id: 'p2', speciesId: 'bulbasaur', ageSec: 110, x: -2, z: 1, heading: 1.0 },
    ],
  };

  // Force reload 2 seconds later: keeps both spawns without creating a full new set of 8
  const shortReload = advancePersistedWorldState(saved, 102000, fakeSpecies, () => 0.4);
  assert.equal(shortReload.wildSpawns.length, 2);
  assert.equal(shortReload.wildSpawns[0].id, 'p1');
  assert.equal(shortReload.wildSpawns[1].id, 'p2');
  assert.equal(shortReload.balloonDue, false);

  // Return 30s later: p2 (>=120s) despawns, autoSpawnTimer (10+30=40s) generates 1 new spawn
  const mediumReturn = advancePersistedWorldState(saved, 130000, fakeSpecies, () => 0.4);
  assert.equal(mediumReturn.wildSpawns.some((w) => w.id === 'p1'), true);
  assert.equal(mediumReturn.wildSpawns.some((w) => w.id === 'p2'), false);
  assert.equal(mediumReturn.wildSpawns.length, 2);
  assert.ok(mediumReturn.wildSpawns.length <= MAX_WILD_ON_MAP);

  // Return after balloon interval (100s+ later -> 20 + 100 = 120s): balloonDue is true
  const balloonReturn = advancePersistedWorldState(
    saved,
    100000 + BALLOON_INTERVAL_SEC * 1000,
    fakeSpecies,
    () => 0.4
  );
  assert.equal(balloonReturn.balloonDue, true);
});
