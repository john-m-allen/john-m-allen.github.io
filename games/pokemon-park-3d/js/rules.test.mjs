import test from 'node:test';
import assert from 'node:assert/strict';
import './rules.js';

const {
  BALL_CONFIG,
  createInitialBallState,
  tickBallRespawnsPure,
  resolveActiveBallSelection,
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
