// 3D Park Engine (Overworld, Catch Mini-Game, Wild AI, Single Buddy Follower) - Pure Vanilla JS
(function (root) {
  const THREE = root.THREE;
  const RoomEnvironment = root.RoomEnvironment;
  const POKEMON_SPECIES = root.POKEMON_SPECIES;
  const {
    AUTO_SPAWN_SEC,
    BALL_CONFIG,
    BALL_REST_COORDS,
    BALLOON_INTERVAL_SEC,
    BATTLE_DURATION_SEC,
    BERRY_CONFIG,
    MAX_WILD_ON_MAP,
    NATURES,
    PARK_RADIUS,
    PLAYER_RADIUS,
    WILD_DESPAWN_SEC,
    computeBuddyFollowStep,
    computeEffectiveCatchRate,
    computeSwipeThrowParamsPure,
    isPointOpenInPark,
    lerpAngle,
    resolveActiveBallSelection,
    rollNature,
    rollStarRating,
    shouldShowFourStarAura,
    tickBallRespawnsPure,
    tickBerryRespawnsPure,
  } = root.ParkRules;
  const {
    addPart,
    attachEdgeOnlyFourStarAura,
    buildPokeball3D,
    buildPokemon3D,
    buildRocketBalloon3D,
    getBasicMat,
    getSharedGeo,
    getStdMat,
    getTexturedMat,
    makeBlobShadow,
  } = root.PokemonBuilder;
  const { getMeadowGrassTexture } = root.ParkTextures;
  const SFX = root.ParkSFX;

  const isSoftwareWebGL = (() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      const loseExt = gl.getExtension('WEBGL_lose_context');
      if (loseExt) loseExt.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  })();

  const CAM_OFFSET = new THREE.Vector3(0, 12.2, 13.8);
  const CAM_LOOK_OFFSET = new THREE.Vector3(0, 0.65, 0);
  const PLAYER_SPEED = 5.4;

  const CANDIDATE_STEER_ANGLES = [
    0, 0.436, -0.436, 0.873, -0.873, 1.396, -1.396, 2.007, -2.007, 2.618, -2.618,
  ];

  const BALL_REST_VEC = new THREE.Vector3(
    BALL_REST_COORDS.x,
    BALL_REST_COORDS.y,
    BALL_REST_COORDS.z
  );
  const POKEMON_STAGE_VEC = new THREE.Vector3(0, 1.45, -1.65);
  const POKEMON_HIT_VEC = new THREE.Vector3(0, 2.12, -1.65);

  class ParkEngine {
    constructor(container, initialBalls, initialBerries, initialWorldState, callbacks) {
      this.container = container;
      this.callbacks = callbacks;
      this.ballState = {
        selected: initialBalls.selected,
        counts: Object.assign({}, initialBalls.counts),
        timers: Object.assign({}, initialBalls.timers),
      };
      this.berryState = {
        counts: Object.assign({}, initialBerries.counts),
        timers: Object.assign({}, initialBerries.timers),
      };
      this.renderedBallType = null;

      this.parkObstacles = [];
      this.wildSpawns = [];
      this.buddy = null;
      this.ripples = [];
      this.clouds = [];
      this.buddyHearts = [];
      this.rocketBalloon = null;
      this.battleCtrl = null;

      this.gameMode = 'overworld';
      this.activeEncounter = null;
      this.autoSpawnTimer = initialWorldState ? initialWorldState.autoSpawnTimer || 0 : 0;
      this.balloonTimer = initialWorldState ? initialWorldState.balloonTimer || 0 : 0;
      this.walkAnimPhase = 0;
      this.stepSoundTimer = 0;
      this.hudSyncTimer = 0;
      this.worldSaveTimer = 0;
      this.playerTargetPos = null;
      this.playerHeading = 0;

      this.catchSparkles = [];
      this.trajectoryDots = [];

      this.keysPressed = new Set();
      this.raycaster = new THREE.Raycaster();
      this.pointerNDC = new THREE.Vector2();
      this.scratchDelta = new THREE.Vector3();

      this.throwCtrl = {
        dragging: false,
        startX: 0,
        startY: 0,
        lastX: 0,
        curveAccumX: 0,
        samples: [],
        phase: 'idle',
        phaseTime: 0,
        flightDuration: 0.62,
        startPos: new THREE.Vector3(),
        endPos: new THREE.Vector3(),
        bendCurveX: 0,
        arcPeak: 1.45,
        willHit: false,
        willCatch: false,
        lastShakeSoundIndex: -1,
      };

      this.frameId = 0;
      this.lastFrameMs = performance.now();
      this.destroyed = false;

      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerUp = this.onPointerUp.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyUp = this.onKeyUp.bind(this);
      this.clearInputs = this.clearInputs.bind(this);
      this.onResize = this.onResize.bind(this);
      this.tick = this.tick.bind(this);

      this.initRenderer();
      this.setupOverworldScene();
      this.setupCatchScene();
      this.setupBattleScene();
      this.bindEvents();

      if (initialWorldState && initialWorldState.hasPersistedState) {
        const list = initialWorldState.wildSpawns || [];
        for (const saved of list) {
          const sp = POKEMON_SPECIES.find((s) => s.id === saved.speciesId);
          if (!sp) continue;
          const nat = NATURES.find((n) => n.name === saved.natureName) || NATURES[0];
          this.spawnWildPokemon(false, null, Object.assign({}, saved, { species: sp, nature: nat }));
        }
        if (initialWorldState.balloonDue) {
          this.spawnRocketBalloon();
        }
      } else {
        // Brand-new park: seed 8 initial Pokémon (Squirtle first near the trainer)
        this.spawnWildPokemon(false, POKEMON_SPECIES[0]);
        for (let i = 1; i < 8; i++) {
          this.spawnWildPokemon(false);
        }
      }

      this.renderer.render(this.scene, this.camera);
      this.callbacks.onHudTick(
        this.wildSpawns.length,
        Math.max(0, AUTO_SPAWN_SEC - this.autoSpawnTimer),
        this.cloneBallState(),
        this.cloneBerryState()
      );
      this.scheduleNextFrame();
    }

    cloneBallState() {
      return {
        selected: this.ballState.selected,
        counts: Object.assign({}, this.ballState.counts),
        timers: Object.assign({}, this.ballState.timers),
      };
    }

    cloneBerryState() {
      return {
        counts: Object.assign({}, this.berryState.counts),
        timers: Object.assign({}, this.berryState.timers),
      };
    }

    getWorldSnapshot() {
      return {
        savedAt: Date.now(),
        autoSpawnTimer: this.autoSpawnTimer,
        balloonTimer: this.balloonTimer,
        wildSpawns: this.wildSpawns.map((w) => ({
          id: w.id,
          speciesId: w.species.id,
          isShiny: Boolean(w.isShiny),
          isDark: Boolean(w.isDark),
          natureName: w.nature.name,
          stars: w.stars,
          maxAttempts: w.maxAttempts,
          attemptsUsed: w.attemptsUsed,
          ageSec: w.ageSec,
          x: w.group.position.x,
          z: w.group.position.z,
          heading: w.heading,
        })),
      };
    }

    initRenderer() {
      const w = Math.max(1, this.container.clientWidth || window.innerWidth);
      const h = Math.max(1, this.container.clientHeight || window.innerHeight);

      this.renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareWebGL,
        powerPreference: 'high-performance',
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.96;
      this.renderer.setPixelRatio(isSoftwareWebGL ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(w, h);
      this.renderer.shadowMap.enabled = false;

      const canvas = this.renderer.domElement;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.touchAction = 'none';
      canvas.setAttribute('data-testid', 'park-canvas');
      this.container.appendChild(canvas);
    }

    setupStudioEnvironment(targetScene) {
      if (!isSoftwareWebGL && typeof RoomEnvironment === 'function') {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        targetScene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
      }
    }

    setupOverworldScene() {
      const geo = getSharedGeo();
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('#87d8fa');
      this.scene.fog = new THREE.Fog('#bae6fd', 26, 56);
      this.setupStudioEnvironment(this.scene);

      const w = Math.max(1, this.container.clientWidth || window.innerWidth);
      const h = Math.max(1, this.container.clientHeight || window.innerHeight);
      this.camera = new THREE.PerspectiveCamera(44, w / h, 0.1, 130);
      this.camera.position.copy(CAM_OFFSET);
      this.camera.lookAt(CAM_LOOK_OFFSET);

      const hemi = new THREE.HemisphereLight('#ffffff', '#34a853', 0.85);
      hemi.position.set(0, 28, 0);
      this.scene.add(hemi);

      const sun = new THREE.DirectionalLight('#fffbeb', 0.98);
      sun.position.set(14, 24, 12);
      this.scene.add(sun);

      const rimLight = new THREE.DirectionalLight('#e0f2fe', 0.36);
      rimLight.position.set(-10, 10, -14);
      this.scene.add(rimLight);

      const grassTex = getMeadowGrassTexture();
      grassTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const groundMat = getTexturedMat(grassTex, 'meadow_ground_mat_v3', 0.92, 0.18);
      this.groundMesh = new THREE.Mesh(geo.disc, groundMat);
      this.groundMesh.rotation.x = -Math.PI / 2;
      this.groundMesh.scale.setScalar(30);
      this.scene.add(this.groundMesh);

      const clearing = new THREE.Mesh(geo.ring, getStdMat('#eab308', 0.9, 0, 0, 0, 0.2));
      clearing.rotation.x = -Math.PI / 2;
      clearing.position.y = 0.014;
      clearing.scale.setScalar(6.2);
      this.scene.add(clearing);

      const stoneMat = getStdMat('#cbd5e1', 0.85, 0.04, 0, 0, 0.25);
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        addPart(
          this.scene,
          geo.cyl,
          stoneMat,
          [Math.cos(a) * 5.5, 0.022, Math.sin(a) * 5.5],
          [0, 0, 0],
          [0.46, 0.05, 0.46]
        );
      }

      const pondX = -8.2;
      const pondZ = -7.2;
      const pondR = 3.5;
      const pond = new THREE.Mesh(geo.disc, getStdMat('#0ea5e9', 0.18, 0.12, 0, 0, 0.55));
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(pondX, 0.024, pondZ);
      pond.scale.setScalar(pondR);
      this.scene.add(pond);
      this.parkObstacles.push({ x: pondX, z: pondZ, r: pondR + 0.35 });

      const lilyMat = getStdMat('#16a34a', 0.65, 0, 0, 0, 0.25);
      for (const [lx, lz] of [[-7.2, -6.5], [-9.0, -7.8], [-8.0, -8.4]]) {
        const lily = new THREE.Mesh(geo.disc, lilyMat);
        lily.rotation.x = -Math.PI / 2;
        lily.position.set(lx, 0.036, lz);
        lily.scale.setScalar(0.42);
        this.scene.add(lily);
      }

      const trunkMat = getStdMat('#92400e', 0.85, 0, 0, 0, 0.2);
      const leafMats = [
        getStdMat('#16a34a', 0.72, 0, 0, 0, 0.22),
        getStdMat('#22c55e', 0.72, 0, 0, 0, 0.22),
      ];
      const treeSpots = [
        [-12.5, -10.5],
        [0, -13.5],
        [11.8, -10.5],
        [14.2, 3.8],
        [10.8, 12.2],
        [-11.5, 11.8],
        [-14.2, 1.2],
        [6.2, -14.0],
      ];
      treeSpots.forEach(([tx, tz], idx) => {
        const tree = new THREE.Group();
        tree.add(makeBlobShadow(1.65));
        addPart(tree, geo.cyl, trunkMat, [0, 0.9, 0], [0, 0, 0], [0.35, 1.8, 0.35]);
        addPart(tree, geo.dodeca, leafMats[idx % 2], [0, 2.3, 0], [0, 0, 0], [1.4, 1.4, 1.4]);
        addPart(tree, geo.dodeca, leafMats[(idx + 1) % 2], [0.55, 2.9, 0.25], [0, 0, 0], [1.0, 1.0, 1.0]);
        tree.position.set(tx, 0, tz);
        this.scene.add(tree);
        this.parkObstacles.push({ x: tx, z: tz, r: 0.85 });
      });

      const rockMat = getStdMat('#94a3b8', 0.88, 0, 0, 0, 0.22);
      const woodMat = getStdMat('#b45309', 0.78, 0, 0, 0, 0.22);
      const darkMat = getStdMat('#1e293b', 0.55, 0, 0, 0, 0.25);

      for (const [rx, rz] of [[8.6, -5.2], [-4.5, 9.8], [9.5, 6.2]]) {
        const rg = new THREE.Group();
        rg.add(makeBlobShadow(1.1));
        addPart(rg, geo.dodeca, rockMat, [0, 0.42, 0], [0.2, 0.6, 0.1], [0.92, 0.58, 0.78]);
        rg.position.set(rx, 0, rz);
        this.scene.add(rg);
        this.parkObstacles.push({ x: rx, z: rz, r: 0.95 });
      }

      for (const [bx, bz] of [[-9.8, 4.2], [4.6, -9.2], [7.8, 1.5]]) {
        const bush = new THREE.Group();
        bush.add(makeBlobShadow(1.15));
        addPart(bush, geo.dodeca, leafMats[1], [0, 0.55, 0], [0, 0, 0], [0.72, 0.72, 0.72]);
        addPart(bush, geo.dodeca, leafMats[0], [0.42, 0.44, 0.18], [0, 0, 0], [0.52, 0.52, 0.52]);
        bush.position.set(bx, 0, bz);
        this.scene.add(bush);
        this.parkObstacles.push({ x: bx, z: bz, r: 0.95 });
      }

      const bench = new THREE.Group();
      bench.add(makeBlobShadow(1.2));
      addPart(bench, geo.box, woodMat, [0, 0.48, 0], [0, 0, 0], [1.8, 0.12, 0.65]);
      addPart(bench, geo.box, woodMat, [0, 0.78, -0.26], [-0.15, 0, 0], [1.8, 0.48, 0.12]);
      for (const lx of [-0.72, 0.72]) {
        addPart(bench, geo.box, darkMat, [lx, 0.24, 0], [0, 0, 0], [0.14, 0.48, 0.56]);
      }
      bench.position.set(0, 0, -7.8);
      this.scene.add(bench);
      this.parkObstacles.push({ x: 0, z: -7.8, r: 1.05 });

      const flowerColors = ['#f43f5e', '#facc15', '#c084fc', '#fb923c', '#ffffff'];
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const r = 3.2 + ((i * 5) % 13);
        const fx = Math.cos(a) * r;
        const fz = Math.sin(a) * r;
        if (Math.hypot(fx - pondX, fz - pondZ) < pondR + 0.6) continue;
        addPart(
          this.scene,
          geo.sphereLow,
          getBasicMat(flowerColors[i % flowerColors.length]),
          [fx, 0.1, fz],
          [0, 0, 0],
          [0.16, 0.16, 0.16]
        );
      }

      const cloudMat = getBasicMat('#ffffff', 0.86);
      for (let i = 0; i < 6; i++) {
        const cg = new THREE.Group();
        addPart(cg, geo.sphereLow, cloudMat, [0, 0, 0], [0, 0, 0], [1.4, 1.1, 1.2]);
        addPart(cg, geo.sphereLow, cloudMat, [1.2, -0.15, 0.2], [0, 0, 0], [1.05, 0.85, 0.95]);
        addPart(cg, geo.sphereLow, cloudMat, [-1.15, -0.1, -0.1], [0, 0, 0], [1.1, 0.9, 1.0]);
        cg.position.set(-18 + i * 7.5, 13 + (i % 2) * 1.5, -14 - (i % 3) * 4);
        this.scene.add(cg);
        this.clouds.push(cg);
      }

      this.buildExplorerTrainer();
      this.playerGroup.position.set(0, 0, 3.6);
      this.scene.add(this.playerGroup);
    }

    buildExplorerTrainer() {
      const geo = getSharedGeo();
      const g = new THREE.Group();
      const skinMat = getStdMat('#fed7aa', 0.5);
      const vestMat = getStdMat('#2563eb', 0.48);
      const shirtMat = getStdMat('#ffffff', 0.52);
      const shortsMat = getStdMat('#334155', 0.62);
      const capMat = getStdMat('#ef4444', 0.42);
      const packMat = getStdMat('#f59e0b', 0.52);
      const eyeMat = getBasicMat('#0f172a');

      g.add(makeBlobShadow(0.62));

      this.playerLeftLeg = addPart(g, geo.sphereLow, shortsMat, [-0.16, 0.26, 0], [0, 0, 0], [0.11, 0.24, 0.11]);
      this.playerRightLeg = addPart(g, geo.sphereLow, shortsMat, [0.16, 0.26, 0], [0, 0, 0], [0.11, 0.24, 0.11]);

      addPart(g, geo.sphere, vestMat, [0, 0.72, 0], [0, 0, 0], [0.33, 0.36, 0.29]);
      addPart(g, geo.box, shirtMat, [0, 0.72, 0.25], [0, 0, 0], [0.24, 0.36, 0.12]);
      addPart(g, geo.box, packMat, [0, 0.76, -0.32], [0, 0, 0], [0.42, 0.44, 0.24]);

      this.playerLeftArm = addPart(g, geo.sphereLow, skinMat, [-0.42, 0.74, 0], [0, 0, 0.25], [0.095, 0.22, 0.095]);
      this.playerRightArm = addPart(g, geo.sphereLow, skinMat, [0.42, 0.74, 0], [0, 0, -0.25], [0.095, 0.22, 0.095]);

      addPart(g, geo.sphere, skinMat, [0, 1.32, 0], [0, 0, 0], [0.36, 0.36, 0.36]);
      addPart(g, geo.hemi, capMat, [0, 1.36, 0], [0, 0, 0], [0.38, 0.38, 0.38]);
      addPart(g, geo.cyl, capMat, [0, 1.38, 0.22], [0, 0, 0], [0.34, 0.05, 0.26]);

      addPart(g, geo.sphereLow, eyeMat, [-0.12, 1.3, 0.34], [0, 0, 0], [0.042, 0.042, 0.042]);
      addPart(g, geo.sphereLow, eyeMat, [0.12, 1.3, 0.34], [0, 0, 0], [0.042, 0.042, 0.042]);

      this.playerGroup = g;
    }

    setupCatchScene() {
      const geo = getSharedGeo();
      this.catchScene = new THREE.Scene();
      this.catchScene.background = new THREE.Color('#a7e2fc');
      this.setupStudioEnvironment(this.catchScene);

      const w = Math.max(1, this.container.clientWidth || window.innerWidth);
      const h = Math.max(1, this.container.clientHeight || window.innerHeight);
      this.catchCamera = new THREE.PerspectiveCamera(44, w / h, 0.1, 60);
      this.catchCamera.position.set(0, 2.75, 9.5);
      this.catchCamera.lookAt(0, 1.82, 0);

      this.catchScene.add(new THREE.HemisphereLight('#ffffff', '#34a853', 0.88));
      const dir = new THREE.DirectionalLight('#fffbeb', 1.02);
      dir.position.set(5, 10, 7);
      this.catchScene.add(dir);

      const rim = new THREE.DirectionalLight('#e0f2fe', 0.38);
      rim.position.set(-5, 6, -8);
      this.catchScene.add(rim);

      const grassTex = getMeadowGrassTexture();
      const floorMat = getTexturedMat(grassTex, 'catch_meadow_mat_v3', 0.92, 0.18);
      const meadowFloor = new THREE.Mesh(geo.disc, floorMat);
      meadowFloor.rotation.x = -Math.PI / 2;
      meadowFloor.position.set(0, 0.35, -2);
      meadowFloor.scale.setScalar(16);
      this.catchScene.add(meadowFloor);

      const pedestal = new THREE.Mesh(geo.cyl, getStdMat('#3ea81e', 0.86, 0, 0, 0, 0.2));
      pedestal.position.set(0, 1.32, -1.65);
      pedestal.scale.set(2.4, 0.25, 2.4);
      this.catchScene.add(pedestal);

      const aimRing = new THREE.Mesh(
        geo.ring,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
        })
      );
      aimRing.rotation.x = -Math.PI / 2;
      aimRing.position.set(0, 1.46, -1.65);
      aimRing.scale.setScalar(1.65);
      this.catchScene.add(aimRing);

      this.catchTargetHolder = new THREE.Group();
      this.catchTargetHolder.position.copy(POKEMON_STAGE_VEC);
      this.catchScene.add(this.catchTargetHolder);

      this.catchBallGroup = null;
      this.syncSelectedBallAndVisual();

      this.trajectoryDotMatHit = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
      });
      this.trajectoryDotMatMiss = new THREE.MeshBasicMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.62,
      });
      for (let i = 0; i < 10; i++) {
        const dot = new THREE.Mesh(geo.sphereLow, this.trajectoryDotMatHit);
        dot.scale.setScalar(0.068 * (1 - i * 0.045));
        dot.visible = false;
        this.catchScene.add(dot);
        this.trajectoryDots.push(dot);
      }

      this.catchFlashSphere = new THREE.Mesh(
        geo.sphereLow,
        new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0 })
      );
      this.catchFlashSphere.position.copy(POKEMON_HIT_VEC);
      this.catchFlashSphere.scale.setScalar(0.95);
      this.catchScene.add(this.catchFlashSphere);
    }

    setupBattleScene() {
      const geo = getSharedGeo();
      this.battleScene = new THREE.Scene();
      this.battleScene.background = new THREE.Color('#7dd3fc');
      this.setupStudioEnvironment(this.battleScene);

      const w = Math.max(1, this.container.clientWidth || window.innerWidth);
      const h = Math.max(1, this.container.clientHeight || window.innerHeight);
      this.battleCamera = new THREE.PerspectiveCamera(44, w / h, 0.1, 70);
      this.battleCamera.position.set(0, 3.0, 9.6);
      this.battleCamera.lookAt(0, 1.35, 0);

      this.battleScene.add(new THREE.HemisphereLight('#ffffff', '#34a853', 0.9));
      const dir = new THREE.DirectionalLight('#fffbeb', 1.05);
      dir.position.set(5, 11, 7);
      this.battleScene.add(dir);

      const grassTex = getMeadowGrassTexture();
      const floorMat = getTexturedMat(grassTex, 'battle_meadow_mat_v1', 0.92, 0.18);
      const floor = new THREE.Mesh(geo.disc, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, 0, -1);
      floor.scale.setScalar(18);
      this.battleScene.add(floor);

      const arenaRing = new THREE.Mesh(
        geo.ring,
        new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
      );
      arenaRing.rotation.x = -Math.PI / 2;
      arenaRing.position.set(0, 0.02, 0);
      arenaRing.scale.setScalar(4.2);
      this.battleScene.add(arenaRing);

      const bgBalloon = buildRocketBalloon3D();
      bgBalloon.position.set(0, 3.6, -9.5);
      bgBalloon.scale.setScalar(0.75);
      this.battleScene.add(bgBalloon);
      this.battleBgBalloon = bgBalloon;

      this.battlePlayerHolder = new THREE.Group();
      this.battleScene.add(this.battlePlayerHolder);

      this.battleEnemyHolder = new THREE.Group();
      this.battleScene.add(this.battleEnemyHolder);

      this.battleOrb = new THREE.Mesh(
        geo.sphereLow,
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.95 })
      );
      this.battleOrb.scale.setScalar(0.28);
      this.battleOrb.visible = false;
      this.battleScene.add(this.battleOrb);

      this.battleBurst = new THREE.Mesh(
        geo.sphereLow,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
      );
      this.battleBurst.scale.setScalar(0.8);
      this.battleScene.add(this.battleBurst);
    }

    setBuddyFollower(record) {
      if (this.buddy) {
        this.scene.remove(this.buddy.group);
        this.buddy = null;
      }
      if (!record) return;

      const geo = getSharedGeo();
      const holder = new THREE.Group();
      holder.add(makeBlobShadow(0.76 * (record.species.scale || 1)));

      const buddyRing = new THREE.Mesh(geo.ring, getBasicMat('#fde047', 0.55, THREE.DoubleSide));
      buddyRing.rotation.x = -Math.PI / 2;
      buddyRing.position.y = 0.025;
      buddyRing.scale.setScalar(0.75 * (record.species.scale || 1));
      holder.add(buddyRing);

      const model = buildPokemon3D(record.species, record.isShiny, record.nature, record.isDark);
      holder.add(model);

      let auraUpdater = null;
      if (shouldShowFourStarAura(record.stars, 'buddy')) {
        auraUpdater = attachEdgeOnlyFourStarAura(model, record.species, record.isShiny, record.nature);
      }

      const hitbox = new THREE.Mesh(geo.sphereLow, new THREE.MeshBasicMaterial({ visible: false }));
      hitbox.position.y = 0.95;
      hitbox.scale.setScalar(1.2);
      holder.add(hitbox);

      const px = this.playerGroup.position.x;
      const pz = this.playerGroup.position.z;
      const spawnX = px - Math.sin(this.playerHeading) * 1.45 + Math.cos(this.playerHeading) * 0.95;
      const spawnZ = pz - Math.cos(this.playerHeading) * 1.45 - Math.sin(this.playerHeading) * 0.95;
      holder.position.set(spawnX, 0, spawnZ);
      holder.rotation.y = this.playerHeading;
      holder.userData.isBuddy = true;
      this.scene.add(holder);

      this.buddy = {
        record,
        group: holder,
        model,
        auraUpdater,
        heading: this.playerHeading,
        hopPhase: 0,
        cheerTimer: 0.9,
      };
      this.spawnBuddyHearts(spawnX, spawnZ);
    }

    spawnBuddyHearts(x, z) {
      const geo = getSharedGeo();
      const heartMat = getBasicMat('#fb7185');
      for (let i = 0; i < 4; i++) {
        const mesh = new THREE.Mesh(geo.octa, heartMat);
        mesh.position.set(x + (Math.random() - 0.5) * 0.6, 1.3 + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.6);
        mesh.scale.setScalar(0.11);
        this.scene.add(mesh);
        this.buddyHearts.push({
          mesh,
          age: 0,
          vy: 1.4 + Math.random() * 0.6,
          vx: (Math.random() - 0.5) * 0.5,
        });
      }
    }

    syncSelectedBallAndVisual() {
      const nextKey = resolveActiveBallSelection(this.ballState);
      if (!nextKey) {
        if (this.catchBallGroup) {
          this.catchBallGroup.visible = false;
        }
        return null;
      }
      if (this.ballState.selected !== nextKey) {
        this.ballState.selected = nextKey;
      }
      if (!this.catchBallGroup || this.renderedBallType !== nextKey) {
        this.updateEncounterBallVisual(nextKey);
      }
      if (this.catchBallGroup) {
        this.catchBallGroup.visible = true;
        if (this.throwCtrl.phase === 'idle' && !this.throwCtrl.dragging) {
          this.catchBallGroup.position.copy(BALL_REST_VEC);
          this.catchBallGroup.rotation.set(0, 0, 0);
          this.catchBallGroup.scale.setScalar(0.72);
        }
      }
      return nextKey;
    }

    selectBall(type) {
      if (!this.ballState.counts || !(this.ballState.counts[type] > 0)) {
        this.callbacks.onToast('Out of that Poké Ball! Recharging...', 1400);
        this.syncSelectedBallAndVisual();
      } else {
        this.ballState.selected = type;
        this.syncSelectedBallAndVisual();
      }
      this.callbacks.onHudTick(
        this.wildSpawns.length,
        Math.max(0, AUTO_SPAWN_SEC - this.autoSpawnTimer),
        this.cloneBallState(),
        this.cloneBerryState()
      );
    }

    applyBerry(berryKey) {
      if (this.gameMode !== 'catch' || !this.activeEncounter) return false;
      if (this.throwCtrl.phase !== 'idle') return false;
      const cfg = BERRY_CONFIG[berryKey];
      if (!cfg) return false;
      if (this.activeEncounter.activeBerryKey) {
        this.callbacks.onToast('A berry is already active for this throw!', 1400);
        return false;
      }
      if (!this.berryState.counts || !(this.berryState.counts[berryKey] > 0)) {
        this.callbacks.onToast(`Out of ${cfg.label} Berries! Recharging...`, 1400);
        return false;
      }
      this.berryState.counts[berryKey] -= 1;
      this.activeEncounter.activeBerryKey = berryKey;
      this.activeEncounter.activeBerryBonus = cfg.bonus;
      SFX.buddyCheer();
      this.callbacks.onToast(
        `${cfg.label} Berry fed! Catch rate +${Math.round(cfg.bonus * 100)}%`,
        1600
      );
      this.callbacks.onHudTick(
        this.wildSpawns.length,
        Math.max(0, AUTO_SPAWN_SEC - this.autoSpawnTimer),
        this.cloneBallState(),
        this.cloneBerryState()
      );
      this.callbacks.onEncounterUpdate?.({
        activeBerryKey: this.activeEncounter.activeBerryKey,
        activeBerryBonus: this.activeEncounter.activeBerryBonus,
      });
      return true;
    }

    getBallState() {
      return this.cloneBallState();
    }

    getBerryState() {
      return this.cloneBerryState();
    }

    exitCatchToOverworld() {
      this.returnToOverworld();
    }

    pickOpenWaypoint(fromX, fromZ, awayBiasX, awayBiasZ) {
      const abx = awayBiasX || 0;
      const abz = awayBiasZ || 0;
      let bestX = 0;
      let bestZ = 0;
      let bestScore = -Infinity;

      for (let attempt = 0; attempt < 28; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const r = 1.8 + Math.random() * (PARK_RADIUS - 2.6);
        const cx = Math.cos(a) * r;
        const cz = Math.sin(a) * r;
        if (!isPointOpenInPark(cx, cz, this.parkObstacles, this.playerGroup && this.playerGroup.position, 1.15)) {
          continue;
        }

        let minClearance = 99;
        for (const obs of this.parkObstacles) {
          const d = Math.hypot(cx - obs.x, cz - obs.z) - obs.r;
          if (d < minClearance) minClearance = d;
        }
        for (const other of this.wildSpawns) {
          const d = Math.hypot(cx - other.group.position.x, cz - other.group.position.z);
          if (d < minClearance) minClearance = d;
        }

        const dirX = cx - fromX;
        const dirZ = cz - fromZ;
        const dist = Math.hypot(dirX, dirZ);
        if (dist < 2.2) continue;

        const awayAlign = abx !== 0 || abz !== 0 ? (dirX * abx + dirZ * abz) / Math.max(0.01, dist) : 0;
        const score = minClearance * 1.4 + awayAlign * 2.5 + Math.min(dist, 8) * 0.25;
        if (score > bestScore) {
          bestScore = score;
          bestX = cx;
          bestZ = cz;
        }
      }
      return new THREE.Vector3(bestX, 0, bestZ);
    }

    findClearSpawnSpot(nearPlayer) {
      for (let attempt = 0; attempt < 35; attempt++) {
        let x;
        let z;
        if (nearPlayer && this.playerGroup) {
          const a = Math.random() * Math.PI * 2;
          const r = 2.6 + Math.random() * 4.4;
          x = this.playerGroup.position.x + Math.cos(a) * r;
          z = this.playerGroup.position.z + Math.sin(a) * r;
        } else {
          const a = Math.random() * Math.PI * 2;
          const r = 2.0 + Math.random() * (PARK_RADIUS - 2.8);
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
        }
        if (!isPointOpenInPark(x, z, this.parkObstacles, this.playerGroup && this.playerGroup.position, 1.35)) {
          continue;
        }
        const tooClose = this.wildSpawns.some(
          (w) => Math.hypot(w.group.position.x - x, w.group.position.z - z) < 2.4
        );
        if (!tooClose) return { x, z };
      }
      const wp = this.pickOpenWaypoint(0, 0);
      return { x: wp.x, z: wp.z };
    }

    removeWildPokemonById(id) {
      const idx = this.wildSpawns.findIndex((w) => w.id === id);
      if (idx === -1) return;
      const entry = this.wildSpawns[idx];
      this.scene.remove(entry.group);
      this.wildSpawns.splice(idx, 1);
      this.callbacks.onWorldDirty?.(this.getWorldSnapshot());
    }

    spawnWildPokemon(nearPlayer, forcedSpecies, persistedData) {
      while (this.wildSpawns.length >= MAX_WILD_ON_MAP) {
        const oldest = this.wildSpawns[0];
        if (!oldest) break;
        this.removeWildPokemonById(oldest.id);
      }

      const geo = getSharedGeo();
      const species =
        (persistedData && persistedData.species) ||
        forcedSpecies ||
        POKEMON_SPECIES[Math.floor(Math.random() * POKEMON_SPECIES.length)];
      const isShiny = persistedData
        ? Boolean(persistedData.isShiny)
        : forcedSpecies
          ? false
          : Math.random() < 0.05;
      const isDark = persistedData ? Boolean(persistedData.isDark) : false;
      const nature =
        (persistedData && persistedData.nature) || (forcedSpecies ? NATURES[0] : rollNature());
      const stars =
        persistedData && typeof persistedData.stars === 'number'
          ? persistedData.stars
          : rollStarRating();
      const maxAttempts =
        persistedData && typeof persistedData.maxAttempts === 'number'
          ? persistedData.maxAttempts
          : 2 + Math.floor(Math.random() * 4);
      const attemptsUsed =
        persistedData && typeof persistedData.attemptsUsed === 'number'
          ? persistedData.attemptsUsed
          : 0;
      const ageSec =
        persistedData && typeof persistedData.ageSec === 'number' ? persistedData.ageSec : 0;

      const holder = new THREE.Group();
      holder.add(makeBlobShadow(0.75 * (species.scale || 1)));

      const model = buildPokemon3D(species, false, nature, isDark);
      holder.add(model);

      const tapHitbox = new THREE.Mesh(geo.sphereLow, new THREE.MeshBasicMaterial({ visible: false }));
      tapHitbox.position.y = 0.95;
      tapHitbox.scale.setScalar(1.25);
      holder.add(tapHitbox);

      let spot = null;
      if (
        persistedData &&
        typeof persistedData.x === 'number' &&
        typeof persistedData.z === 'number'
      ) {
        spot = { x: persistedData.x, z: persistedData.z };
      } else if (forcedSpecies) {
        spot = { x: 2.1, z: 1.5 };
      } else {
        spot = this.findClearSpawnSpot(nearPlayer);
      }
      holder.position.set(spot.x, 0, spot.z);
      const id =
        (persistedData && persistedData.id) ||
        `${species.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      holder.userData.wildId = id;
      this.scene.add(holder);

      const wp = this.pickOpenWaypoint(spot.x, spot.z);
      const initHeading =
        persistedData && typeof persistedData.heading === 'number'
          ? persistedData.heading
          : forcedSpecies
            ? 0
            : Math.atan2(wp.x - spot.x, wp.z - spot.z);
      holder.rotation.y = initHeading;

      const entry = {
        id,
        species,
        isShiny,
        isDark,
        nature,
        stars,
        maxAttempts,
        attemptsUsed,
        ageSec,
        group: holder,
        model,
        radius: species.radius || 0.78,
        speed: 1.5 + Math.random() * 0.65,
        heading: initHeading,
        vx: Math.sin(initHeading) * 1.55,
        vz: Math.cos(initHeading) * 1.55,
        waypoint: wp,
        hopPhase: Math.random() * Math.PI * 2,
        watchdogTimer: 0,
        watchdogAnchor: new THREE.Vector3(spot.x, 0, spot.z),
      };
      this.wildSpawns.push(entry);
      if (!persistedData) {
        this.callbacks.onWorldDirty?.(this.getWorldSnapshot());
      }
      return entry;
    }

    spawnRocketBalloon() {
      if (this.rocketBalloon) return;
      const group = buildRocketBalloon3D();
      const playerZ = this.playerGroup ? this.playerGroup.position.z : 0;
      const laneZ = Math.max(-9, Math.min(7, playerZ - 3.2));
      group.position.set(-19, 5.8, laneZ);
      this.scene.add(group);

      const shadow = makeBlobShadow(2.4);
      shadow.position.set(-19, 0.03, laneZ);
      this.scene.add(shadow);

      this.rocketBalloon = {
        group,
        shadow,
        elapsed: 0,
        duration: 24,
        startX: -19,
        endX: 19,
        laneZ,
      };
      SFX.shiny();
      this.callbacks.onBalloonChange?.(true);
      this.callbacks.onToast('🎈 Team Rocket Balloon spotted! Tap it to battle!', 3200);
    }

    removeRocketBalloon() {
      if (!this.rocketBalloon) return;
      this.scene.remove(this.rocketBalloon.group);
      this.scene.remove(this.rocketBalloon.shadow);
      this.rocketBalloon = null;
      this.callbacks.onBalloonChange?.(false);
    }

    enterRocketBattle(battleConfig) {
      if (this.gameMode !== 'overworld') return;
      this.removeRocketBalloon();
      this.gameMode = 'battle';
      this.playerTargetPos = null;
      this.clearInputs();

      while (this.battlePlayerHolder.children.length > 0) {
        this.battlePlayerHolder.remove(this.battlePlayerHolder.children[0]);
      }
      while (this.battleEnemyHolder.children.length > 0) {
        this.battleEnemyHolder.remove(this.battleEnemyHolder.children[0]);
      }

      const pModel = buildPokemon3D(
        battleConfig.playerRecord.species,
        battleConfig.playerRecord.isShiny,
        battleConfig.playerRecord.nature,
        battleConfig.playerRecord.isDark
      );
      pModel.rotation.y = Math.PI * 0.45;
      this.battlePlayerHolder.add(pModel);
      this.battlePlayerHolder.position.set(-2.1, 0, 0.2);
      this.battlePlayerHolder.scale.setScalar(1);

      const eModel = buildPokemon3D(
        battleConfig.enemyCandidate.species,
        battleConfig.enemyCandidate.isShiny,
        battleConfig.enemyCandidate.nature,
        true
      );
      eModel.rotation.y = -Math.PI * 0.45;
      this.battleEnemyHolder.add(eModel);
      this.battleEnemyHolder.position.set(2.1, 0, -0.2);
      this.battleEnemyHolder.scale.setScalar(1);

      this.battleOrb.visible = false;
      this.battleBurst.material.opacity = 0;

      this.battleCtrl = {
        elapsed: 0,
        duration: BATTLE_DURATION_SEC,
        playerRecord: battleConfig.playerRecord,
        enemyCandidate: battleConfig.enemyCandidate,
        outcome: battleConfig.outcome,
        lastStepIdx: -1,
      };

      SFX.tapPokemon();
      this.renderer.render(this.battleScene, this.battleCamera);
      this.callbacks.onBattleStart?.(battleConfig);
      this.callbacks.onModeChange('battle', null);
    }

    spawnGroundRipple(x, z) {
      const geo = getSharedGeo();
      const ring = new THREE.Mesh(
        geo.ring,
        new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.038, z);
      ring.scale.setScalar(0.36);
      this.scene.add(ring);
      this.ripples.push({ mesh: ring, age: 0 });
    }

    computePredictiveSteering(me, dt) {
      const pos = me.group.position;
      const wpDist = Math.hypot(me.waypoint.x - pos.x, me.waypoint.z - pos.z);
      if (wpDist < 0.85) {
        me.waypoint = this.pickOpenWaypoint(pos.x, pos.z);
      }

      const desiredHeading = Math.atan2(me.waypoint.x - pos.x, me.waypoint.z - pos.z);
      const lookaheadSec = 1.65;
      const safetyMargin = 0.42;

      const hazards = [];
      for (const obs of this.parkObstacles) {
        hazards.push({ x: obs.x, z: obs.z, vx: 0, vz: 0, r: obs.r });
      }
      hazards.push({
        x: this.playerGroup.position.x,
        z: this.playerGroup.position.z,
        vx: 0,
        vz: 0,
        r: PLAYER_RADIUS + 0.15,
      });
      if (this.buddy) {
        hazards.push({
          x: this.buddy.group.position.x,
          z: this.buddy.group.position.z,
          vx: 0,
          vz: 0,
          r: (this.buddy.record.species.radius || 0.72) + 0.1,
        });
      }
      for (const other of this.wildSpawns) {
        if (other.id === me.id) continue;
        hazards.push({
          x: other.group.position.x,
          z: other.group.position.z,
          vx: other.vx,
          vz: other.vz,
          r: other.radius,
        });
      }

      const evalHeading = (candHeading) => {
        const cvx = Math.sin(candHeading) * me.speed;
        const cvz = Math.cos(candHeading) * me.speed;
        let minMargin = 99;
        let collisionRisk = 0;

        const endX = pos.x + cvx * lookaheadSec;
        const endZ = pos.z + cvz * lookaheadSec;
        const boundaryMargin = PARK_RADIUS - me.radius - Math.hypot(endX, endZ);
        if (boundaryMargin < minMargin) minMargin = boundaryMargin;
        if (boundaryMargin < 0.35) {
          collisionRisk += (0.35 - boundaryMargin) * 14;
        }

        for (const h of hazards) {
          const dpx = h.x - pos.x;
          const dpz = h.z - pos.z;
          const rvx = h.vx - cvx;
          const rvz = h.vz - cvz;
          const rvSq = rvx * rvx + rvz * rvz;

          let tca = 0;
          if (rvSq > 0.0001) {
            tca = Math.max(0, Math.min(lookaheadSec, -(dpx * rvx + dpz * rvz) / rvSq));
          }

          const cax = dpx + rvx * tca;
          const caz = dpz + rvz * tca;
          const distCA = Math.hypot(cax, caz);
          const reqDist = me.radius + h.r + safetyMargin;
          const margin = distCA - reqDist;

          if (margin < minMargin) minMargin = margin;
          if (margin < 0) {
            const urgency = 1 + (lookaheadSec - tca) / lookaheadSec;
            collisionRisk += -margin * 16 * urgency;
          }
        }

        const angleDiff = Math.abs(((candHeading - desiredHeading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const turnSmoothness = Math.abs(((candHeading - me.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        return -collisionRisk - angleDiff * 1.4 - turnSmoothness * 0.35 + Math.min(minMargin, 2.0) * 0.5;
      };

      let bestHeading = desiredHeading;
      let bestScore = -Infinity;

      for (const offset of CANDIDATE_STEER_ANGLES) {
        const cand = desiredHeading + offset;
        const sc = evalHeading(cand);
        if (sc > bestScore) {
          bestScore = sc;
          bestHeading = cand;
        }
      }

      me.heading = lerpAngle(me.heading, bestHeading, dt * 5.2);
      me.vx = Math.sin(me.heading) * me.speed;
      me.vz = Math.cos(me.heading) * me.speed;

      pos.x += me.vx * dt;
      pos.z += me.vz * dt;

      for (const h of hazards) {
        const dx = pos.x - h.x;
        const dz = pos.z - h.z;
        const dist = Math.hypot(dx, dz);
        const minSep = me.radius + h.r + 0.12;
        if (dist > 0.0001 && dist < minSep) {
          const push = (minSep - dist) * 0.55;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        }
      }

      const radial = Math.hypot(pos.x, pos.z);
      if (radial > PARK_RADIUS - me.radius) {
        const scaleBack = (PARK_RADIUS - me.radius) / radial;
        pos.x *= scaleBack;
        pos.z *= scaleBack;
        me.waypoint = this.pickOpenWaypoint(pos.x, pos.z, -pos.x, -pos.z);
      }

      me.group.rotation.y = me.heading;
    }

    enterCatchMiniGame(wildEntry) {
      this.gameMode = 'catch';
      this.activeEncounter = wildEntry;
      this.throwCtrl.phase = 'idle';
      this.throwCtrl.dragging = false;
      this.hideTrajectoryGuide();

      while (this.catchTargetHolder.children.length > 0) {
        this.catchTargetHolder.remove(this.catchTargetHolder.children[0]);
      }

      const model = buildPokemon3D(
        wildEntry.species,
        wildEntry.isShiny,
        wildEntry.nature,
        wildEntry.isDark
      );
      model.scale.multiplyScalar(0.92);
      if (shouldShowFourStarAura(wildEntry.stars, 'catch')) {
        attachEdgeOnlyFourStarAura(model, wildEntry.species, wildEntry.isShiny, wildEntry.nature);
      }
      this.catchTargetHolder.add(model);
      this.catchTargetHolder.visible = true;
      this.catchTargetHolder.scale.setScalar(1);
      this.catchTargetHolder.position.copy(POKEMON_STAGE_VEC);

      this.clearCatchSparkles();
      if (wildEntry.isShiny) {
        this.spawnEncounterShinyBurst();
        SFX.shiny();
        this.callbacks.onToast(
          `✨ A Shiny ${wildEntry.isDark ? 'Dark ' : ''}${wildEntry.species.name} appeared!`,
          2400
        );
      } else if (wildEntry.isDark) {
        SFX.tapPokemon();
        this.callbacks.onToast(`Catch Dark ${wildEntry.species.name}!`, 2000);
      } else {
        SFX.tapPokemon();
      }

      this.throwCtrl.dragging = false;
      this.throwCtrl.samples = [];
      this.throwCtrl.curveAccumX = 0;
      this.resetBallToRest();
      this.updateCatchMiniGame(0.016);
      this.renderer.render(this.catchScene, this.catchCamera);
      this.callbacks.onModeChange('catch', {
        id: wildEntry.id,
        species: wildEntry.species,
        isShiny: wildEntry.isShiny,
        isDark: Boolean(wildEntry.isDark),
        isBalloonReward: Boolean(wildEntry.isBalloonReward),
        nature: wildEntry.nature,
        stars: wildEntry.stars,
        attemptsUsed: wildEntry.attemptsUsed,
        maxAttempts: wildEntry.maxAttempts,
        activeBerryKey: wildEntry.activeBerryKey || null,
        activeBerryBonus: wildEntry.activeBerryBonus || 0,
      });
    }

    returnToOverworld() {
      this.gameMode = 'overworld';
      this.activeEncounter = null;
      this.battleCtrl = null;
      this.throwCtrl.phase = 'idle';
      this.throwCtrl.dragging = false;
      this.throwCtrl.samples = [];
      this.throwCtrl.curveAccumX = 0;
      this.hideTrajectoryGuide();
      this.clearCatchSparkles();
      this.resetBallToRest();
      this.renderer.render(this.scene, this.camera);
      this.callbacks.onModeChange('overworld', null);
    }

    updateEncounterBallVisual(type) {
      if (this.catchBallGroup) this.catchScene.remove(this.catchBallGroup);
      this.renderedBallType = type;
      this.catchBallGroup = buildPokeball3D(type);
      this.catchBallGroup.scale.setScalar(0.72);
      this.catchBallGroup.position.copy(BALL_REST_VEC);
      this.catchScene.add(this.catchBallGroup);
    }

    hideTrajectoryGuide() {
      for (const d of this.trajectoryDots) d.visible = false;
    }

    clearCatchSparkles() {
      for (const s of this.catchSparkles) this.catchScene.remove(s.mesh);
      this.catchSparkles = [];
    }

    spawnEncounterShinyBurst() {
      const geo = getSharedGeo();
      this.clearCatchSparkles();
      const colors = ['#facc15', '#f472b6', '#38bdf8', '#c084fc', '#ffffff'];
      for (let i = 0; i < 22; i++) {
        const mesh = new THREE.Mesh(geo.octa, getBasicMat(colors[i % colors.length]));
        const angle = (i / 22) * Math.PI * 2;
        mesh.position.set(Math.cos(angle) * 1.2, 2.25 + Math.sin(angle * 2) * 0.5, -1.4);
        mesh.scale.setScalar(0.11);
        this.catchScene.add(mesh);
        this.catchSparkles.push({ mesh, angle, speed: 2.4 + Math.random() * 1.4 });
      }
    }

    resetBallToRest() {
      this.throwCtrl.phase = 'idle';
      this.throwCtrl.phaseTime = 0;
      this.hideTrajectoryGuide();
      this.syncSelectedBallAndVisual();
      if (this.catchBallGroup) {
        this.catchBallGroup.position.copy(BALL_REST_VEC);
        this.catchBallGroup.rotation.set(0, 0, 0);
        this.catchBallGroup.scale.setScalar(0.72);
      }
      this.catchFlashSphere.material.opacity = 0;
    }

    triggerPokemonFlee() {
      if (!this.activeEncounter) return;
      const fledName = this.activeEncounter.species.name;
      const fledId = this.activeEncounter.id;
      const isReward = Boolean(this.activeEncounter.isBalloonReward);
      SFX.flee();
      this.callbacks.onToast(`💨 Oh no! ${this.activeEncounter.isDark ? 'Dark ' : ''}${fledName} ran away!`, 2300);
      if (!isReward) {
        this.removeWildPokemonById(fledId);
      }
      this.returnToOverworld();
    }

    updateOverworldTap(clientX, clientY) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);

      if (this.rocketBalloon) {
        const balloonHits = this.raycaster.intersectObject(this.rocketBalloon.group, true);
        if (balloonHits.length > 0) {
          this.callbacks.onBalloonTap?.();
          return;
        }
      }

      if (this.buddy) {
        const buddyHits = this.raycaster.intersectObject(this.buddy.group, true);
        if (buddyHits.length > 0) {
          this.buddy.cheerTimer = 0.85;
          this.spawnBuddyHearts(this.buddy.group.position.x, this.buddy.group.position.z);
          SFX.buddyCheer();
          this.callbacks.onToast(`❤️ ${this.buddy.record.species.name} is happy to walk with you!`, 1600);
          return;
        }
      }

      const wildGroups = this.wildSpawns.map((w) => w.group);
      const hits = this.raycaster.intersectObjects(wildGroups, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj && !obj.userData.wildId && obj.parent) {
          obj = obj.parent;
        }
        const matched = this.wildSpawns.find((w) => w.id === (obj && obj.userData && obj.userData.wildId));
        if (matched) {
          this.enterCatchMiniGame(matched);
          return;
        }
      }

      const gHits = this.raycaster.intersectObject(this.groundMesh, false);
      if (gHits.length > 0) {
        const p = gHits[0].point;
        const clampedR = Math.min(PARK_RADIUS - 0.5, Math.hypot(p.x, p.z));
        const angle = Math.atan2(p.z, p.x);
        this.playerTargetPos = new THREE.Vector3(Math.cos(angle) * clampedR, 0, Math.sin(angle) * clampedR);
        this.spawnGroundRipple(this.playerTargetPos.x, this.playerTargetPos.z);
      }
    }

    onPointerDown(e) {
      if (this.gameMode === 'overworld') {
        this.updateOverworldTap(e.clientX, e.clientY);
      } else if (this.gameMode === 'catch') {
        if (this.throwCtrl.phase !== 'idle' || !this.activeEncounter) return;
        const activeKey = this.syncSelectedBallAndVisual();
        if (!activeKey) {
          this.callbacks.onToast('Out of Poké Balls! Waiting for recharge...', 1800);
          return;
        }
        this.throwCtrl.dragging = true;
        this.throwCtrl.startX = e.clientX;
        this.throwCtrl.startY = e.clientY;
        this.throwCtrl.lastX = e.clientX;
        this.throwCtrl.curveAccumX = 0;
        this.throwCtrl.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      }
    }

    onPointerMove(e) {
      if (this.gameMode !== 'catch' || !this.throwCtrl.dragging) return;
      const stepDx = e.clientX - this.throwCtrl.lastX;
      const dx = e.clientX - this.throwCtrl.startX;
      const dy = e.clientY - this.throwCtrl.startY;

      const rect = this.renderer.domElement.getBoundingClientRect();
      const viewH = Math.max(540, rect.height);
      const upwardProgress = Math.max(0, (this.throwCtrl.startY - e.clientY) / (viewH * 0.16));
      if (upwardProgress > 0.18 && upwardProgress < 0.92) {
        this.throwCtrl.curveAccumX += stepDx;
      }
      this.throwCtrl.lastX = e.clientX;
      this.throwCtrl.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (this.throwCtrl.samples.length > 20) this.throwCtrl.samples.shift();

      const dragScale = 5.8 / viewH;
      const centerDx = e.clientX - (rect.left + rect.width * 0.5);
      const blendedDx = dx * 0.45 + centerDx * 0.55;
      const clampedWorldX = Math.max(-2.1, Math.min(2.1, blendedDx * dragScale));
      const clampedUpWorld = Math.max(-0.35, Math.min(1.45, -dy * dragScale * 0.65));
      this.catchBallGroup.position.x = BALL_REST_VEC.x + clampedWorldX;
      this.catchBallGroup.position.y = BALL_REST_VEC.y + clampedUpWorld;
      this.catchBallGroup.position.z = BALL_REST_VEC.z - Math.max(0, clampedUpWorld) * 0.72;
      this.catchBallGroup.rotation.z = Math.max(-0.6, Math.min(0.6, -stepDx * 0.015));
      this.catchBallGroup.rotation.x -= Math.max(0, -dy) * 0.0005;

      const previewParams = computeSwipeThrowParamsPure({
        startX: this.throwCtrl.startX,
        startY: this.throwCtrl.startY,
        endX: e.clientX,
        endY: e.clientY,
        curveAccumX: this.throwCtrl.curveAccumX,
        samples: this.throwCtrl.samples,
        viewportWidth: rect.width,
        viewportHeight: rect.height,
        ballKey: this.ballState.selected,
      });

      const isMasterThrow = this.ballState.selected === 'master' && previewParams.willHit;
      if (previewParams.upwardFlick <= 18 && !isMasterThrow) {
        this.hideTrajectoryGuide();
      } else {
        const endP = new THREE.Vector3(previewParams.landingX, previewParams.landingY, previewParams.landingZ);
        const dotMat = previewParams.willHit ? this.trajectoryDotMatHit : this.trajectoryDotMatMiss;
        for (let i = 0; i < this.trajectoryDots.length; i++) {
          const p = (i + 1) / (this.trajectoryDots.length + 1);
          const dot = this.trajectoryDots[i];
          dot.material = dotMat;
          dot.position.lerpVectors(this.catchBallGroup.position, endP, p);
          dot.position.x += Math.sin(p * Math.PI) * previewParams.bendCurveX;
          dot.position.y += Math.sin(p * Math.PI) * previewParams.arcPeak;
          dot.visible = true;
        }
      }
    }

    onPointerUp(e) {
      if (this.gameMode !== 'catch' || !this.throwCtrl.dragging) return;
      this.throwCtrl.dragging = false;
      this.hideTrajectoryGuide();

      const rect = this.renderer.domElement.getBoundingClientRect();
      const activeBallKey = this.ballState.selected;
      const params = computeSwipeThrowParamsPure({
        startX: this.throwCtrl.startX,
        startY: this.throwCtrl.startY,
        endX: e.clientX,
        endY: e.clientY,
        curveAccumX: this.throwCtrl.curveAccumX,
        samples: this.throwCtrl.samples,
        viewportWidth: rect.width,
        viewportHeight: rect.height,
        ballKey: activeBallKey,
      });

      if (params.upwardFlick > 20 || (activeBallKey === 'master' && params.willHit)) {
        this.throwCtrl.phase = 'flying';
        this.throwCtrl.phaseTime = 0;
        this.throwCtrl.flightDuration = Math.max(0.42, Math.min(0.68, 0.62 - params.upwardFlick * 0.00055));
        this.throwCtrl.startPos.copy(this.catchBallGroup.position);
        this.throwCtrl.endPos.set(params.landingX, params.landingY, params.landingZ);
        this.throwCtrl.bendCurveX = params.bendCurveX;
        this.throwCtrl.arcPeak = params.arcPeak;
        this.throwCtrl.willHit = params.willHit;
        SFX.throwBall();
      } else {
        this.resetBallToRest();
      }
    }

    onKeyDown(e) {
      this.keysPressed.add(e.code);
    }

    onKeyUp(e) {
      this.keysPressed.delete(e.code);
    }

    clearInputs() {
      this.keysPressed.clear();
    }

    onResize() {
      const w = Math.max(1, this.container.clientWidth || window.innerWidth);
      const h = Math.max(1, this.container.clientHeight || window.innerHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.catchCamera.aspect = w / h;
      this.catchCamera.updateProjectionMatrix();
      this.battleCamera.aspect = w / h;
      this.battleCamera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      // Immediately render resized frame so buffer never flashes blank
      if (this.gameMode === 'overworld') {
        this.renderer.render(this.scene, this.camera);
      } else if (this.gameMode === 'battle') {
        this.renderer.render(this.battleScene, this.battleCamera);
      } else {
        this.renderer.render(this.catchScene, this.catchCamera);
      }
    }

    bindEvents() {
      const canvas = this.renderer.domElement;
      canvas.addEventListener('pointerdown', this.onPointerDown);
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
      window.addEventListener('pointercancel', this.onPointerUp);

      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.clearInputs);
      document.addEventListener('visibilitychange', this.clearInputs);
      window.addEventListener('resize', this.onResize);
    }

    updateOverworld(dt, nowSec) {
      for (const c of this.clouds) {
        c.position.x += dt * 0.45;
        if (c.position.x > 26) c.position.x = -26;
      }

      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        r.age += dt;
        const p = r.age / 0.55;
        if (p >= 1) {
          this.scene.remove(r.mesh);
          this.ripples.splice(i, 1);
        } else {
          r.mesh.scale.setScalar(0.36 * (1 + p * 2.6));
          r.mesh.material.opacity = (1 - p) * 0.9;
        }
      }

      for (let i = this.buddyHearts.length - 1; i >= 0; i--) {
        const h = this.buddyHearts[i];
        h.age += dt;
        if (h.age >= 0.85) {
          this.scene.remove(h.mesh);
          this.buddyHearts.splice(i, 1);
        } else {
          h.mesh.position.y += h.vy * dt;
          h.mesh.position.x += h.vx * dt;
          h.mesh.rotation.y += dt * 4;
          h.mesh.scale.setScalar(0.11 * (1 - h.age / 0.85));
        }
      }

      let kbX = 0;
      let kbZ = 0;
      if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) kbZ -= 1;
      if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) kbZ += 1;
      if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) kbX -= 1;
      if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) kbX += 1;

      let playerMoved = false;
      if (kbX !== 0 || kbZ !== 0) {
        this.playerTargetPos = null;
        const len = Math.hypot(kbX, kbZ);
        this.scratchDelta.set(kbX / len, 0, kbZ / len);
        this.playerGroup.position.addScaledVector(this.scratchDelta, PLAYER_SPEED * dt);
        this.playerHeading = Math.atan2(this.scratchDelta.x, this.scratchDelta.z);
        this.playerGroup.rotation.y = this.playerHeading;
        playerMoved = true;
      } else if (this.playerTargetPos) {
        this.scratchDelta.subVectors(this.playerTargetPos, this.playerGroup.position);
        this.scratchDelta.y = 0;
        const dist = this.scratchDelta.length();
        if (dist > 0.14) {
          this.scratchDelta.normalize();
          this.playerGroup.position.addScaledVector(this.scratchDelta, Math.min(dist, PLAYER_SPEED * dt));
          this.playerHeading = Math.atan2(this.scratchDelta.x, this.scratchDelta.z);
          this.playerGroup.rotation.y = this.playerHeading;
          playerMoved = true;
        } else {
          this.playerTargetPos = null;
        }
      }

      if (playerMoved) {
        for (const obs of this.parkObstacles) {
          const dx = this.playerGroup.position.x - obs.x;
          const dz = this.playerGroup.position.z - obs.z;
          const d = Math.hypot(dx, dz);
          const minD = obs.r + PLAYER_RADIUS;
          if (d > 0.001 && d < minD) {
            this.playerGroup.position.x = obs.x + (dx / d) * minD;
            this.playerGroup.position.z = obs.z + (dz / d) * minD;
          }
        }
        const rad = Math.hypot(this.playerGroup.position.x, this.playerGroup.position.z);
        if (rad > PARK_RADIUS - PLAYER_RADIUS) {
          const k = (PARK_RADIUS - PLAYER_RADIUS) / rad;
          this.playerGroup.position.x *= k;
          this.playerGroup.position.z *= k;
        }

        this.walkAnimPhase += dt * 14;
        this.playerLeftLeg.rotation.x = Math.sin(this.walkAnimPhase) * 0.55;
        this.playerRightLeg.rotation.x = -Math.sin(this.walkAnimPhase) * 0.55;
        this.playerLeftArm.rotation.x = -Math.sin(this.walkAnimPhase) * 0.45;
        this.playerRightArm.rotation.x = Math.sin(this.walkAnimPhase) * 0.45;
        this.stepSoundTimer += dt;
        if (this.stepSoundTimer >= 0.28) {
          this.stepSoundTimer = 0;
          SFX.step();
        }
      } else {
        this.playerLeftLeg.rotation.x = 0;
        this.playerRightLeg.rotation.x = 0;
        this.playerLeftArm.rotation.x = 0;
        this.playerRightArm.rotation.x = 0;
      }

      if (this.buddy) {
        const b = this.buddy;
        const step = computeBuddyFollowStep({
          buddyX: b.group.position.x,
          buddyZ: b.group.position.z,
          buddyHeading: b.heading,
          buddyRadius: b.record.species.radius || 0.72,
          playerX: this.playerGroup.position.x,
          playerZ: this.playerGroup.position.z,
          playerHeading: this.playerHeading,
          obstacles: this.parkObstacles,
          dt,
        });

        b.group.position.x = step.x;
        b.group.position.z = step.z;
        b.heading = step.heading;
        b.group.rotation.y = step.heading;

        if (b.cheerTimer > 0) {
          b.cheerTimer = Math.max(0, b.cheerTimer - dt);
          b.model.position.y = Math.abs(Math.sin(b.cheerTimer * Math.PI * 3)) * 0.36;
          b.model.rotation.z = Math.sin(b.cheerTimer * Math.PI * 4) * 0.08;
        } else if (step.isMoving) {
          b.hopPhase += dt * (6.2 + step.speed * 1.4);
          b.model.position.y = Math.abs(Math.sin(b.hopPhase)) * 0.2;
          b.model.rotation.z = Math.sin(b.hopPhase * 0.5) * 0.07;
        } else {
          b.hopPhase += dt * 3.0;
          b.model.position.y = Math.abs(Math.sin(b.hopPhase)) * 0.05;
          b.model.rotation.z = 0;
        }

        if (b.auraUpdater) {
          b.auraUpdater.update(nowSec);
        }
      }

      const targetCamX = this.playerGroup.position.x + CAM_OFFSET.x;
      const targetCamZ = this.playerGroup.position.z + CAM_OFFSET.z;
      const dampAlpha = 1 - Math.exp(-8 * dt);
      this.camera.position.x += (targetCamX - this.camera.position.x) * dampAlpha;
      this.camera.position.y = CAM_OFFSET.y;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * dampAlpha;
      this.camera.lookAt(
        this.playerGroup.position.x + CAM_LOOK_OFFSET.x,
        CAM_LOOK_OFFSET.y,
        this.playerGroup.position.z + CAM_LOOK_OFFSET.z
      );

      this.autoSpawnTimer += dt;
      if (this.autoSpawnTimer >= AUTO_SPAWN_SEC) {
        this.autoSpawnTimer -= AUTO_SPAWN_SEC;
        this.spawnWildPokemon(false);
      }

      if (!this.rocketBalloon) {
        this.balloonTimer += dt;
        if (this.balloonTimer >= BALLOON_INTERVAL_SEC) {
          this.balloonTimer = 0;
          this.spawnRocketBalloon();
        }
      } else {
        const rb = this.rocketBalloon;
        rb.elapsed += dt;
        const p = rb.elapsed / rb.duration;
        if (p >= 1) {
          this.removeRocketBalloon();
        } else {
          const x = rb.startX + (rb.endX - rb.startX) * p;
          const y = 5.6 + Math.sin(p * Math.PI) * 1.1 + Math.sin(nowSec * 2.2) * 0.25;
          rb.group.position.set(x, y, rb.laneZ);
          rb.group.rotation.y = Math.sin(nowSec * 0.9) * 0.18;
          rb.group.rotation.z = Math.sin(nowSec * 1.4) * 0.06;
          rb.shadow.position.set(x, 0.03, rb.laneZ);
        }
      }

      for (let i = this.wildSpawns.length - 1; i >= 0; i--) {
        const w = this.wildSpawns[i];
        w.ageSec += dt;
        if (w.ageSec >= WILD_DESPAWN_SEC) {
          this.removeWildPokemonById(w.id);
          continue;
        }

        this.computePredictiveSteering(w, dt);
        w.watchdogTimer += dt;
        if (w.watchdogTimer >= 3.0) {
          const moved = w.group.position.distanceTo(w.watchdogAnchor);
          if (moved < 0.25) {
            let awayX = 0;
            let awayZ = 0;
            for (const obs of this.parkObstacles) {
              const dx = w.group.position.x - obs.x;
              const dz = w.group.position.z - obs.z;
              const d = Math.max(0.2, Math.hypot(dx, dz));
              if (d < 4.5) {
                awayX += dx / d;
                awayZ += dz / d;
              }
            }
            w.waypoint = this.pickOpenWaypoint(w.group.position.x, w.group.position.z, awayX, awayZ);
            w.heading = Math.atan2(w.waypoint.x - w.group.position.x, w.waypoint.z - w.group.position.z);
          }
          w.watchdogAnchor.copy(w.group.position);
          w.watchdogTimer = 0;
        }

        w.hopPhase += dt * (5.2 + w.speed * 1.4);
        w.model.position.y = Math.abs(Math.sin(w.hopPhase)) * 0.16;
        w.model.rotation.z = Math.sin(w.hopPhase * 0.5) * 0.065;
      }
    }

    updateBattleScene(dt) {
      if (this.gameMode !== 'battle' || !this.battleCtrl) return;
      const b = this.battleCtrl;
      b.elapsed += dt;
      const t = b.elapsed;
      const p = Math.min(1, t / b.duration);

      if (this.battleBgBalloon) {
        this.battleBgBalloon.position.y = 3.6 + Math.sin(t * 1.8) * 0.22;
        this.battleBgBalloon.rotation.y = Math.sin(t * 0.7) * 0.15;
      }

      // Dramatic 10-second battle choreography
      const stepIdx = Math.floor(t / 2.0);
      if (stepIdx !== b.lastStepIdx && stepIdx < 5) {
        b.lastStepIdx = stepIdx;
        if (stepIdx % 2 === 0) SFX.throwBall();
        else SFX.bounce();
      }

      const cycle = t % 2.0;
      const isPlayerAttacking = stepIdx % 2 === 0;
      const playerName = b.playerRecord.species.name;
      const enemyName = `Dark ${b.enemyCandidate.species.name}`;

      let playerHp = 100;
      let enemyHp = 100;
      let banner = `${playerName} vs ${enemyName}!`;

      if (p < 0.85) {
        const dmgProgress = p / 0.85;
        if (b.outcome.playerWon) {
          playerHp = Math.round(100 - dmgProgress * 55);
          enemyHp = Math.round(100 - dmgProgress * 82);
        } else {
          playerHp = Math.round(100 - dmgProgress * 82);
          enemyHp = Math.round(100 - dmgProgress * 55);
        }

        if (cycle < 1.1) {
          this.battleOrb.visible = true;
          const orbP = cycle / 1.1;
          this.battleOrb.material.color.set(isPlayerAttacking ? '#38bdf8' : '#a855f7');
          const fromX = isPlayerAttacking ? -1.6 : 1.6;
          const toX = isPlayerAttacking ? 1.8 : -1.8;
          this.battleOrb.position.set(
            fromX + (toX - fromX) * orbP,
            1.15 + Math.sin(orbP * Math.PI) * 0.55,
            0
          );
          this.battleBurst.material.opacity = 0;
          banner = isPlayerAttacking
            ? `${playerName} launches an attack!`
            : `${enemyName} strikes back!`;
        } else {
          this.battleOrb.visible = false;
          const hitP = (cycle - 1.1) / 0.9;
          this.battleBurst.position.set(isPlayerAttacking ? 2.0 : -2.0, 1.15, 0);
          this.battleBurst.material.opacity = Math.sin(hitP * Math.PI) * 0.7;
          this.battleBurst.scale.setScalar(0.6 + hitP * 0.9);
          banner = isPlayerAttacking ? `Direct hit on ${enemyName}!` : `${playerName} braces for impact!`;
        }

        this.battlePlayerHolder.position.y = Math.abs(Math.sin(t * 4.5)) * 0.16;
        this.battleEnemyHolder.position.y = Math.abs(Math.sin(t * 4.5 + 1.2)) * 0.16;
      } else {
        this.battleOrb.visible = false;
        const finP = (p - 0.85) / 0.15;
        if (b.outcome.playerWon) {
          playerHp = 45;
          enemyHp = Math.max(0, Math.round(18 * (1 - finP)));
          this.battlePlayerHolder.position.y = Math.abs(Math.sin(t * 9)) * 0.35;
          this.battleEnemyHolder.scale.setScalar(Math.max(0.2, 1 - finP * 0.65));
          this.battleEnemyHolder.rotation.z = finP * 0.6;
          banner = `${playerName} defeated ${enemyName}!`;
        } else {
          playerHp = Math.max(0, Math.round(18 * (1 - finP)));
          enemyHp = 45;
          this.battleEnemyHolder.position.y = Math.abs(Math.sin(t * 9)) * 0.35;
          this.battlePlayerHolder.scale.setScalar(Math.max(0.2, 1 - finP * 0.65));
          this.battlePlayerHolder.rotation.z = -finP * 0.6;
          banner = `${enemyName} overwhelmed ${playerName}!`;
        }
      }

      this.callbacks.onBattleTick?.({
        remainingSec: Math.max(0, Math.ceil(b.duration - t)),
        playerHp,
        enemyHp,
        banner,
      });

      if (t >= b.duration) {
        const won = b.outcome.playerWon;
        const cand = b.enemyCandidate;
        this.battleCtrl = null;
        if (won) {
          SFX.catchFanfare(cand.stars);
          this.enterCatchMiniGame({
            id: `dark_${cand.species.id}_${Date.now()}`,
            species: cand.species,
            isShiny: cand.isShiny,
            isDark: true,
            isBalloonReward: true,
            nature: cand.nature,
            stars: cand.stars,
            attemptsUsed: 0,
            maxAttempts: 5,
          });
        } else {
          SFX.flee();
          this.callbacks.onToast(`Team Rocket won and escaped with Dark ${cand.species.name}!`, 2600);
          this.returnToOverworld();
        }
      }
    }

    updateCatchMiniGame(dt) {
      if (this.gameMode !== 'catch' || !this.activeEncounter) return;

      for (const sp of this.catchSparkles) {
        sp.angle += sp.speed * dt;
        sp.mesh.position.x = Math.cos(sp.angle) * 1.25;
        sp.mesh.position.y = 2.25 + Math.sin(sp.angle * 2) * 0.45;
        sp.mesh.rotation.y += dt * 4;
      }

      if (this.catchTargetHolder.visible && this.throwCtrl.phase === 'idle') {
        const t = performance.now() * 0.0042;
        this.catchTargetHolder.position.y = POKEMON_STAGE_VEC.y + Math.abs(Math.sin(t)) * 0.14;
      }

      if (this.throwCtrl.phase === 'flying') {
        this.throwCtrl.phaseTime += dt;
        const p = Math.min(1, this.throwCtrl.phaseTime / this.throwCtrl.flightDuration);

        this.catchBallGroup.position.lerpVectors(this.throwCtrl.startPos, this.throwCtrl.endPos, p);
        this.catchBallGroup.position.x += Math.sin(p * Math.PI) * this.throwCtrl.bendCurveX;
        this.catchBallGroup.position.y += Math.sin(p * Math.PI) * this.throwCtrl.arcPeak;
        this.catchBallGroup.rotation.x -= 12 * dt;
        this.catchBallGroup.rotation.z -= this.throwCtrl.bendCurveX * 4.5 * dt;

        if (p >= 1) {
          const bKey = this.ballState.selected;
          const cfg = BALL_CONFIG[bKey];
          if (this.ballState.counts[bKey] > 0) {
            this.ballState.counts[bKey] -= 1;
          }
          this.activeEncounter.attemptsUsed += 1;
          this.callbacks.onHudTick(
            this.wildSpawns.length,
            Math.max(0, AUTO_SPAWN_SEC - this.autoSpawnTimer),
            this.cloneBallState(),
            this.cloneBerryState()
          );

          if (this.throwCtrl.willHit) {
            this.throwCtrl.phase = 'absorb';
            this.throwCtrl.phaseTime = 0;
            const effectiveRate = computeEffectiveCatchRate(
              cfg.catchRate,
              this.activeEncounter.activeBerryBonus || 0
            );
            this.throwCtrl.willCatch = Math.random() < effectiveRate;
            this.catchBallGroup.position.copy(POKEMON_HIT_VEC);
            this.catchBallGroup.rotation.set(0, 0, 0);
            SFX.absorb();
          } else {
            this.throwCtrl.phase = 'bounceMiss';
            this.throwCtrl.phaseTime = 0;
            SFX.bounce();
            this.callbacks.onToast('Missed! Swipe toward the Pokémon.', 1400);
          }
        }
      } else if (this.throwCtrl.phase === 'bounceMiss') {
        this.throwCtrl.phaseTime += dt;
        const p = Math.min(1, this.throwCtrl.phaseTime / 0.45);
        this.catchBallGroup.position.y = Math.max(
          1.48,
          this.throwCtrl.endPos.y + Math.sin(p * Math.PI) * 0.55 - p * 0.5
        );
        this.catchBallGroup.position.x += this.throwCtrl.bendCurveX * 0.45 * dt;
        if (p >= 1) {
          if (this.activeEncounter.attemptsUsed >= this.activeEncounter.maxAttempts) {
            this.triggerPokemonFlee();
          } else {
            this.resetBallToRest();
          }
        }
      } else if (this.throwCtrl.phase === 'absorb') {
        this.throwCtrl.phaseTime += dt;
        const p = Math.min(1, this.throwCtrl.phaseTime / 0.36);
        this.catchFlashSphere.material.opacity = Math.sin(p * Math.PI) * 0.85;
        this.catchFlashSphere.scale.setScalar(0.7 + p * 0.8);
        this.catchTargetHolder.scale.setScalar(Math.max(0.01, 1 - p));
        this.catchTargetHolder.position.y = POKEMON_STAGE_VEC.y + p * 0.65;

        if (p >= 1) {
          this.catchTargetHolder.visible = false;
          this.catchFlashSphere.material.opacity = 0;
          this.throwCtrl.phase = 'wobble';
          this.throwCtrl.phaseTime = 0;
          this.throwCtrl.lastShakeSoundIndex = -1;
          this.catchBallGroup.position.set(0, 1.62, -1.65);
        }
      } else if (this.throwCtrl.phase === 'wobble') {
        this.throwCtrl.phaseTime += dt;
        const totalWobbleSec = 1.65;
        const shakeIdx = Math.floor(this.throwCtrl.phaseTime / 0.55);
        if (shakeIdx < 3 && shakeIdx !== this.throwCtrl.lastShakeSoundIndex) {
          this.throwCtrl.lastShakeSoundIndex = shakeIdx;
          SFX.shake();
        }
        const localCycle = (this.throwCtrl.phaseTime % 0.55) / 0.55;
        const wobbleAngle = localCycle < 0.65 ? Math.sin(localCycle * Math.PI * 3.07) * 0.36 : 0;
        this.catchBallGroup.rotation.z = wobbleAngle;

        if (this.throwCtrl.phaseTime >= totalWobbleSec) {
          this.catchBallGroup.rotation.z = 0;
          if (this.throwCtrl.willCatch) {
            const caught = this.activeEncounter;
            if (!caught.isBalloonReward) {
              this.removeWildPokemonById(caught.id);
            }
            const record = {
              uid: `caught_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              species: caught.species,
              isShiny: caught.isShiny,
              isDark: Boolean(caught.isDark),
              nature: caught.nature,
              stars: caught.stars,
              caughtAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            SFX.catchFanfare(record.stars);
            this.returnToOverworld();
            this.callbacks.onCatchSuccess(record);
          } else {
            SFX.breakFree();
            this.activeEncounter.activeBerryKey = null;
            this.activeEncounter.activeBerryBonus = 0;
            this.callbacks.onEncounterUpdate?.({
              activeBerryKey: null,
              activeBerryBonus: 0,
            });
            this.catchTargetHolder.visible = true;
            this.catchTargetHolder.scale.setScalar(1);
            this.catchTargetHolder.position.copy(POKEMON_STAGE_VEC);
            if (this.activeEncounter.attemptsUsed >= this.activeEncounter.maxAttempts) {
              this.triggerPokemonFlee();
            } else {
              this.callbacks.onToast(`${this.activeEncounter.species.name} popped out! Try again!`, 1400);
              this.resetBallToRest();
            }
          }
        }
      }
    }

    afterDraw(cb) {
      const gl = this.renderer.getContext();
      if (!gl || typeof gl.fenceSync !== 'function') {
        this.frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.destroyed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    }

    scheduleNextFrame() {
      if (this.destroyed) return;
      if (isSoftwareWebGL) {
        this.afterDraw(this.tick);
      } else {
        this.frameId = requestAnimationFrame(this.tick);
      }
    }

    tick() {
      if (this.destroyed) return;
      const now = performance.now();
      const rawDt = Math.max(0.001, (now - this.lastFrameMs) / 1000);
      const dt = Math.min(isSoftwareWebGL ? 0.085 : 0.05, rawDt);
      const catchDt = Math.min(isSoftwareWebGL ? 0.22 : 0.05, rawDt);
      this.lastFrameMs = now;
      const nowSec = now * 0.001;

      const respawnStep = rawDt > 1 ? dt : catchDt;
      const ballRespawned = tickBallRespawnsPure(this.ballState, respawnStep);
      const berryRespawned = tickBerryRespawnsPure(this.berryState, respawnStep);
      const respawned = ballRespawned || berryRespawned;
      if (ballRespawned && this.gameMode === 'catch' && this.throwCtrl.phase === 'idle') {
        this.syncSelectedBallAndVisual();
      }

      if (this.gameMode === 'overworld') {
        this.updateOverworld(dt, nowSec);
        this.renderer.render(this.scene, this.camera);
      } else if (this.gameMode === 'battle') {
        this.updateBattleScene(catchDt);
        this.renderer.render(this.battleScene, this.battleCamera);
      } else {
        this.updateCatchMiniGame(catchDt);
        this.renderer.render(this.catchScene, this.catchCamera);
      }

      this.hudSyncTimer += dt;
      if (respawned || this.hudSyncTimer >= 0.45) {
        this.hudSyncTimer = 0;
        this.callbacks.onHudTick(
          this.wildSpawns.length,
          Math.max(0, AUTO_SPAWN_SEC - this.autoSpawnTimer),
          this.cloneBallState(),
          this.cloneBerryState()
        );
      }

      this.worldSaveTimer += dt;
      if (this.worldSaveTimer >= 2.0) {
        this.worldSaveTimer = 0;
        this.callbacks.onWorldDirty?.(this.getWorldSnapshot());
      }

      this.scheduleNextFrame();
    }

    destroy() {
      this.destroyed = true;
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);

      const canvas = this.renderer.domElement;
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);

      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.clearInputs);
      document.removeEventListener('visibilitychange', this.clearInputs);
      window.removeEventListener('resize', this.onResize);

      this.renderer.dispose();
      if (canvas.parentElement === this.container) {
        this.container.removeChild(canvas);
      }
    }
  }

  root.isSoftwareWebGL = isSoftwareWebGL;
  root.ParkEngine = ParkEngine;
})(window);
