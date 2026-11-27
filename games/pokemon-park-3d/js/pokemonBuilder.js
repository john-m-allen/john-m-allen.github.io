// High-Detail Pokédex-Fidelity 3D Pokémon & Poké Ball Builder (pure vanilla JS, Three.js global)
(function (root) {
  const THREE = root.THREE;
  const {
    getAppleSkinTexture,
    getBlobShadowTexture,
    getCarapaceTexture,
    getEeveeTailTexture,
    getEggShellPatternTexture,
    getFuecocoBodyTexture,
    getPikachuBodyTexture,
    getPiplupBodyTexture,
    getPokeballTexture,
    getPokemonFaceTexture,
    getRafflesiaPetalTexture,
    getScaleBellyTexture,
    getSerpentBodyTexture,
    getShellPlastronTexture,
    getSnorlaxBodyTexture,
    getSpottedDinoTexture,
    getTigerStripeTexture,
  } = root.ParkTextures;
  const { NATURES } = root.ParkRules;

  let geoCache = null;
  const matCache = new Map();

  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function applySoftPokemonRimShader(mat) {
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        vec3 viewDirRim = normalize(vViewPosition);
        float rimFactor = pow(1.0 - clamp(dot(normalize(normal), viewDirRim), 0.0, 1.0), 2.4);
        gl_FragColor.rgb += gl_FragColor.rgb * rimFactor * 0.16 + vec3(0.024, 0.022, 0.016) * rimFactor;
        #include <dithering_fragment>
        `
      );
    };
    mat.customProgramCacheKey = () => 'pokemon_soft_rim_v4';
  }

  // Sculpted continuous head variants preserving +Z equirectangular face UV mapping (u=0.5 front)
  function createSculptedHeadVariant(type) {
    const geo = new THREE.SphereGeometry(1, 64, 48);
    geo.rotateY(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      if (type === 'squirtle') {
        // Round cranium, soft full cheeks, smooth chin contour so smile & nostrils read clearly
        const cheek = smoothstep(0.1, 0.7, z) * smoothstep(-0.6, 0.05, y) * smoothstep(0.35, -0.1, y);
        x *= 1 + cheek * 0.06;
        if (y < -0.25 && z > 0.2) {
          z *= 1.08;
        }
        if (y > 0.35) x *= 0.94;
      } else if (type === 'pikachu') {
        // Plump lower cheeks, slight pointed muzzle bridge, rounded forehead
        const cheek = smoothstep(0.0, 0.7, z) * smoothstep(-0.7, -0.05, y) * smoothstep(0.28, -0.18, y);
        x *= 1.02 + cheek * 0.1;
        const noseBridge = smoothstep(0.45, 0.98, z) * smoothstep(0.2, -0.06, y) * smoothstep(-0.45, -0.06, y);
        z += noseBridge * 0.14;
        y *= 0.94;
      } else if (type === 'dragon') {
        // Continuous extruded dragon/reptile snout (no floating snout capsule!)
        if (y > 0.18) x *= 0.82;
        if (z < -0.15) z *= 1.12;
        const snoutMask = smoothstep(0.18, 0.92, z) * smoothstep(0.22, -0.25, y);
        z += snoutMask * 0.48;
        x *= 1 - snoutMask * 0.24;
        if (y < -0.22 && z > 0.3) y *= 0.88;
        y *= 0.9;
      } else if (type === 'croc') {
        // Broad continuous rounded-box crocodile snout (Fuecoco / Totodile)
        x *= 1.06;
        const snoutMask = smoothstep(0.15, 0.88, z) * smoothstep(0.18, -0.22, y);
        z += snoutMask * 0.44;
        x *= 1 - snoutMask * 0.08;
        if (y < -0.18) y *= 0.86;
        y *= 0.88;
      } else if (type === 'canine') {
        // Continuous fox/jackal/feline muzzle (Eevee, Espeon, Lucario, Arcanine, Absol, Alakazam, Mewtwo, Mew)
        x *= 0.88;
        const snoutMask = smoothstep(0.24, 0.94, z) * smoothstep(0.16, -0.24, y);
        z += snoutMask * 0.36;
        x *= 1 - snoutMask * 0.34;
        if (y < -0.22) {
          x *= 0.82;
          y *= 0.92;
        }
      } else if (type === 'shrew') {
        // Continuous pointed upturned snout (Cyndaquil, Treecko)
        x *= 0.9;
        const snoutMask = smoothstep(0.2, 0.94, z) * smoothstep(0.2, -0.22, y);
        z += snoutMask * 0.5;
        x *= 1 - snoutMask * 0.42;
        y += snoutMask * 0.06;
      } else if (type === 'frog') {
        // Wide flat angular frog/toad skull (Venusaur, Greninja, Mudkip)
        x *= 1.15;
        y *= 0.79;
        const snoutMask = smoothstep(0.18, 0.9, z) * smoothstep(0.16, -0.25, y);
        z += snoutMask * 0.24;
      } else if (type === 'avian') {
        // Aerodynamic narrow bird skull swept back
        x *= 0.82;
        if (z < 0 && y > 0) {
          z *= 1.14;
          y *= 0.94;
        }
        if (z > 0.25) {
          x *= 0.85;
          y *= 0.94;
        }
      } else if (type === 'human') {
        // Slender oval anime/knight face with tapered chin
        x *= 0.82;
        if (z > 0.62) z = 0.62 + (z - 0.62) * 0.68;
        if (y < -0.14) {
          x *= 0.74;
          z *= 0.88;
        }
      } else if (type === 'heroic') {
        // Broad-jawed wrestler cranium (Machamp — smooth continuous jaw!)
        x *= 0.92;
        if (y < 0 && z > 0.1) {
          x *= 1.06;
          z += smoothstep(0.1, 0.85, z) * 0.18;
        }
        if (y > 0.22) {
          x *= 0.84;
        }
      } else if (type === 'flatWide') {
        // Broad horizontal-oval face (Snorlax, Meowth, Mimikyu, Metagross)
        x *= 1.14;
        y *= 0.84;
        if (y < 0 && z > 0) {
          z *= 1.08;
        }
      } else {
        // Smooth round head
        if (y < 0.05 && z > 0) {
          const cheekFactor = Math.max(0, 1 - Math.abs(y + 0.15) * 1.4);
          x *= 1 + cheekFactor * 0.06;
          z *= 1 + cheekFactor * 0.035;
        }
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Soft pear torso rotated so u=0.5 faces +Z front
  function createPearTorsoGeometry() {
    const pts = [
      new THREE.Vector2(0.001, -1.0),
      new THREE.Vector2(0.46, -0.96),
      new THREE.Vector2(0.78, -0.78),
      new THREE.Vector2(0.96, -0.48),
      new THREE.Vector2(1.0, -0.16),
      new THREE.Vector2(0.92, 0.16),
      new THREE.Vector2(0.8, 0.48),
      new THREE.Vector2(0.64, 0.76),
      new THREE.Vector2(0.4, 0.94),
      new THREE.Vector2(0.001, 1.0),
    ];
    const geo = new THREE.LatheGeometry(pts, 36);
    geo.rotateY(Math.PI);
    geo.scale(1.0, 1.0, 0.9);
    geo.computeVertexNormals();
    return geo;
  }

  function createAthleticTorsoGeometry() {
    const pts = [
      new THREE.Vector2(0.001, -1.0),
      new THREE.Vector2(0.56, -0.92),
      new THREE.Vector2(0.74, -0.68),
      new THREE.Vector2(0.52, -0.28),
      new THREE.Vector2(0.49, 0.0),
      new THREE.Vector2(0.74, 0.42),
      new THREE.Vector2(0.82, 0.68),
      new THREE.Vector2(0.52, 0.88),
      new THREE.Vector2(0.28, 0.98),
      new THREE.Vector2(0.001, 1.0),
    ];
    const geo = new THREE.LatheGeometry(pts, 36);
    geo.rotateY(Math.PI);
    geo.scale(1.0, 1.0, 0.78);
    geo.computeVertexNormals();
    return geo;
  }

  function createHeroicTorsoGeometry() {
    const pts = [
      new THREE.Vector2(0.001, -1.0),
      new THREE.Vector2(0.58, -0.92),
      new THREE.Vector2(0.62, -0.58),
      new THREE.Vector2(0.52, -0.22),
      new THREE.Vector2(0.84, 0.18),
      new THREE.Vector2(1.08, 0.54),
      new THREE.Vector2(0.88, 0.82),
      new THREE.Vector2(0.4, 0.98),
      new THREE.Vector2(0.001, 1.0),
    ];
    const geo = new THREE.LatheGeometry(pts, 36);
    geo.rotateY(Math.PI);
    geo.scale(1.04, 1.0, 0.74);
    geo.computeVertexNormals();
    return geo;
  }

  function createDragonTorsoGeometry() {
    const pts = [
      new THREE.Vector2(0.001, -1.0),
      new THREE.Vector2(0.58, -0.92),
      new THREE.Vector2(0.92, -0.62),
      new THREE.Vector2(0.95, -0.24),
      new THREE.Vector2(0.76, 0.18),
      new THREE.Vector2(0.54, 0.58),
      new THREE.Vector2(0.36, 0.88),
      new THREE.Vector2(0.001, 1.0),
    ];
    const geo = new THREE.LatheGeometry(pts, 36);
    geo.rotateY(Math.PI);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setZ(i, pos.getZ(i) * 0.86 - y * 0.14);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function createAvianTorsoGeometry() {
    const pts = [
      new THREE.Vector2(0.001, -1.0),
      new THREE.Vector2(0.28, -0.84),
      new THREE.Vector2(0.56, -0.48),
      new THREE.Vector2(0.82, 0.05),
      new THREE.Vector2(0.78, 0.45),
      new THREE.Vector2(0.52, 0.78),
      new THREE.Vector2(0.28, 0.96),
      new THREE.Vector2(0.001, 1.0),
    ];
    const geo = new THREE.LatheGeometry(pts, 36);
    geo.rotateY(Math.PI);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) * 0.84;
      const y = pos.getY(i);
      let z = pos.getZ(i);
      if (z > 0) z += Math.max(0, Math.cos(y * 1.3)) * 0.14;
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function createQuadrupedTorsoGeometry() {
    const geo = new THREE.SphereGeometry(1, 48, 32);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) * 0.62;
      let y = pos.getY(i) * 0.56;
      let z = pos.getZ(i) * 1.05;
      if (z > 0.18) {
        y *= 1.12;
        x *= 1.08;
      } else if (z > -0.35 && z <= 0.18) {
        y *= 0.88;
        x *= 0.88;
      } else {
        y *= 1.04;
        x *= 1.02;
      }
      if (y > 0.25) y = 0.25 + (y - 0.25) * 0.78;
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Smooth continuous wavy melted-blob body for Ditto (preserves +Z face UV)
  function createDittoBlobGeometry() {
    const geo = new THREE.SphereGeometry(1, 64, 48);
    geo.rotateY(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      const angle = Math.atan2(z, x);
      const bottomSpread = smoothstep(0.3, -0.95, y);
      const radialWave = 1 + 0.16 * Math.sin(angle * 5 + 0.4) + 0.08 * Math.cos(angle * 3);
      x *= 0.82 + bottomSpread * 0.34 * radialWave;
      z *= 0.68 + bottomSpread * 0.28 * radialWave;

      // Top gentle two-lump silhouette
      if (y > 0.15) {
        const crown = smoothstep(0.15, 0.9, y);
        y += crown * (0.08 * Math.cos(x * 3.2) - 0.05);
      }
      if (y < -0.55) {
        y = -0.55 + (y + 0.55) * 0.22;
      }
      y = (y + 0.55) * 0.68;
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Smooth continuous flared dress gown for Gardevoir
  function createGardevoirGownGeometry() {
    const pts = [
      new THREE.Vector2(0.68, 0.0),
      new THREE.Vector2(0.58, 0.14),
      new THREE.Vector2(0.46, 0.36),
      new THREE.Vector2(0.34, 0.62),
      new THREE.Vector2(0.22, 0.88),
      new THREE.Vector2(0.18, 1.0),
      new THREE.Vector2(0.001, 1.0),
    ];
    const geo = new THREE.LatheGeometry(pts, 44);
    geo.rotateY(Math.PI);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      let y = pos.getY(i);
      const z = pos.getZ(i);
      const ang = Math.atan2(z, x);
      const hemFactor = smoothstep(0.45, 0.0, y);
      y += hemFactor * Math.sin(ang * 6) * 0.04;
      pos.setXYZ(i, x, y, z * 0.88);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function createCurvedMustacheGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.22, -0.06, 0.04),
      new THREE.Vector3(0.42, -0.22, -0.02),
      new THREE.Vector3(0.54, -0.44, -0.06),
    ]);
    const geo = new THREE.TubeGeometry(curve, 24, 0.068, 14, false);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = Math.max(0, pos.getX(i));
      const t = Math.min(1, x / 0.54);
      const taper = 1 - t * 0.72;
      pos.setY(i, pos.getY(i) * (0.7 + taper * 0.3));
      pos.setZ(i, pos.getZ(i) * (0.7 + taper * 0.3));
    }
    geo.computeVertexNormals();
    return geo;
  }

  function createRibbonTailGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.56, -0.3),
      new THREE.Vector3(-0.16, 0.34, -0.66),
      new THREE.Vector3(0.18, 0.16, -0.98),
      new THREE.Vector3(-0.08, 0.24, -1.32),
      new THREE.Vector3(0.1, 0.42, -1.56),
    ]);
    const geo = new THREE.TubeGeometry(curve, 48, 0.085, 16, false);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) * 0.42 + 0.2);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function createLimbLatheGeometry() {
    const pts = [
      new THREE.Vector2(0.001, -0.5),
      new THREE.Vector2(0.14, -0.48),
      new THREE.Vector2(0.24, -0.42),
      new THREE.Vector2(0.27, -0.28),
      new THREE.Vector2(0.28, -0.14),
      new THREE.Vector2(0.26, 0.02),
      new THREE.Vector2(0.23, 0.18),
      new THREE.Vector2(0.2, 0.32),
      new THREE.Vector2(0.15, 0.43),
      new THREE.Vector2(0.08, 0.48),
      new THREE.Vector2(0.001, 0.5),
    ];
    return new THREE.LatheGeometry(pts, 32);
  }

  function createPlastronCapGeometry() {
    return new THREE.SphereGeometry(
      1,
      56,
      44,
      Math.PI * 0.04,
      Math.PI * 0.92,
      0.12,
      Math.PI - 0.24
    );
  }

  function createAppleBodyGeometry() {
    const geo = new THREE.SphereGeometry(1, 48, 36);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      const z = pos.getZ(i);
      const rXZ = Math.hypot(x, z);
      if (Math.abs(y) > 0.45 && rXZ < 0.55) {
        const dimple = Math.pow(1 - rXZ / 0.55, 2) * 0.34;
        y -= Math.sign(y) * dimple;
      }
      if (y < -0.2) {
        x *= 0.92;
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function createSquirtleTailGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.32, -0.34),
      new THREE.Vector3(0, 0.4, -0.68),
      new THREE.Vector3(0, 0.68, -0.84),
      new THREE.Vector3(0, 0.94, -0.63),
      new THREE.Vector3(0, 0.8, -0.44),
      new THREE.Vector3(0, 0.68, -0.54),
    ]);
    const geo = new THREE.TubeGeometry(curve, 48, 0.155, 24, false);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i);
      if (z > -0.45 && y < 0.5) {
        pos.setX(i, pos.getX(i) * 0.62);
      } else if (y > 0.7) {
        pos.setX(i, pos.getX(i) * 1.42);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }

  function createMewTailGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.52, -0.32),
      new THREE.Vector3(-0.18, 0.72, -0.68),
      new THREE.Vector3(0.22, 1.08, -0.82),
      new THREE.Vector3(0.08, 1.38, -0.62),
      new THREE.Vector3(-0.08, 1.46, -0.48),
    ]);
    return new THREE.TubeGeometry(curve, 52, 0.044, 20, false);
  }

  function createMewtwoTubeGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.24, -0.34),
      new THREE.Vector3(0, 1.18, -0.48),
      new THREE.Vector3(0, 1.0, -0.42),
      new THREE.Vector3(0, 0.88, -0.26),
    ]);
    return new THREE.TubeGeometry(curve, 32, 0.062, 18, false);
  }

  function createMewtwoTailGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.34, -0.28),
      new THREE.Vector3(0, 0.24, -0.68),
      new THREE.Vector3(0.16, 0.44, -1.04),
      new THREE.Vector3(0.28, 0.88, -1.02),
      new THREE.Vector3(0.18, 1.26, -0.78),
    ]);
    return new THREE.TubeGeometry(curve, 48, 0.1, 22, false);
  }

  function createTaperedSerpentGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.32, 0.08),
      new THREE.Vector3(-0.14, 0.92, -0.14),
      new THREE.Vector3(-0.42, 0.4, -0.1),
      new THREE.Vector3(0.0, 0.22, 0.14),
      new THREE.Vector3(0.46, 0.26, -0.16),
      new THREE.Vector3(0.28, 0.48, -0.62),
      new THREE.Vector3(-0.2, 0.74, -0.84),
    ]);
    const tubularSegs = 72;
    const radialSegs = 28;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const vertex = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const prevRight = new THREE.Vector3(1, 0, 0);

    for (let i = 0; i <= tubularSegs; i++) {
      const u = i / tubularSegs;
      const P = curve.getPointAt(u);
      const T = curve.getTangentAt(u).normalize();

      // Twist-free world-stabilized frame so v=0.5 consistently stays on ventral/front side
      let frontHint = new THREE.Vector3(0, 0, 1);
      if (Math.abs(T.dot(frontHint)) > 0.85) {
        frontHint.set(0, 1, 0);
      }
      const right = new THREE.Vector3().crossVectors(frontHint, T);
      if (right.lengthSq() < 1e-4) {
        right.copy(prevRight);
      } else {
        right.normalize();
        if (right.dot(prevRight) < 0) right.negate();
        prevRight.copy(right);
      }
      const front = new THREE.Vector3().crossVectors(T, right).normalize();
      const rad = 0.24 * (1 - u * 0.64) + Math.sin(u * Math.PI) * 0.028;

      for (let j = 0; j <= radialSegs; j++) {
        const vFrac = j / radialSegs;
        const theta = (vFrac - 0.5) * Math.PI * 2; // theta=0 -> vFrac=0.5 -> +front
        const c = Math.cos(theta);
        const s = Math.sin(theta);

        normal.x = c * front.x + s * right.x;
        normal.y = c * front.y + s * right.y;
        normal.z = c * front.z + s * right.z;
        normal.normalize();
        normals.push(normal.x, normal.y, normal.z);

        vertex.x = P.x + rad * normal.x;
        vertex.y = P.y + rad * normal.y;
        vertex.z = P.z + rad * normal.z;
        positions.push(vertex.x, vertex.y, vertex.z);
        uvs.push(u, vFrac);
      }
    }

    for (let j = 1; j <= tubularSegs; j++) {
      for (let i = 1; i <= radialSegs; i++) {
        const a = (radialSegs + 1) * (j - 1) + (i - 1);
        const b = (radialSegs + 1) * j + (i - 1);
        const c = (radialSegs + 1) * j + i;
        const d = (radialSegs + 1) * (j - 1) + i;
        indices.push(a, b, d, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geo;
  }

  function createMeowthTailGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.42, -0.32),
      new THREE.Vector3(0, 0.62, -0.64),
      new THREE.Vector3(0, 0.96, -0.68),
      new THREE.Vector3(0, 1.14, -0.48),
      new THREE.Vector3(0, 1.0, -0.36),
    ]);
    return new THREE.TubeGeometry(curve, 40, 0.052, 18, false);
  }

  function createEeveeTailGeometry() {
    const pts = [
      new THREE.Vector2(0.001, -0.5),
      new THREE.Vector2(0.12, -0.42),
      new THREE.Vector2(0.28, -0.2),
      new THREE.Vector2(0.35, 0.06),
      new THREE.Vector2(0.32, 0.28),
      new THREE.Vector2(0.18, 0.44),
      new THREE.Vector2(0.001, 0.56),
    ];
    const geo = new THREE.LatheGeometry(pts, 32);
    geo.rotateY(Math.PI);
    return geo;
  }

  function createCurvedHornGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.04, 0.26, -0.08),
      new THREE.Vector3(0.02, 0.54, -0.22),
      new THREE.Vector3(-0.04, 0.76, -0.36),
    ]);
    const geo = new THREE.TubeGeometry(curve, 28, 0.075, 18, false);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = Math.max(0, Math.min(1, y / 0.76));
      const taper = 1 - t * 0.78;
      pos.setX(i, pos.getX(i) * taper);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function createLightningTailGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.24, 0.12);
    shape.lineTo(0.14, 0.32);
    shape.lineTo(0.42, 0.48);
    shape.lineTo(0.26, 0.72);
    shape.lineTo(0.62, 0.92);
    shape.lineTo(0.36, 1.08);
    shape.lineTo(0.06, 0.78);
    shape.lineTo(0.18, 0.55);
    shape.lineTo(-0.05, 0.34);
    shape.lineTo(0.06, 0.14);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      curveSegments: 16,
      bevelEnabled: true,
      bevelThickness: 0.026,
      bevelSize: 0.026,
      bevelSegments: 4,
    });
    geo.center();
    return geo;
  }

  function createDragonWingGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.42, 0.44, 0.96, 0.55);
    shape.quadraticCurveTo(0.75, 0.14, 0.9, -0.2);
    shape.quadraticCurveTo(0.55, -0.05, 0.42, -0.26);
    shape.quadraticCurveTo(0.2, -0.08, 0, -0.15);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.04,
      curveSegments: 24,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 4,
    });
  }

  function createWingArmStrutGeometry() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0.02),
      new THREE.Vector3(0.42, 0.38, 0.02),
      new THREE.Vector3(0.96, 0.55, 0.02),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.048, 12, false);
  }

  function createBirdWingGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.45, 0.38, 1.04, 0.24);
    shape.lineTo(0.76, 0.07);
    shape.lineTo(0.94, -0.11);
    shape.lineTo(0.58, -0.15);
    shape.lineTo(0.72, -0.3);
    shape.lineTo(0.38, -0.22);
    shape.quadraticCurveTo(0.18, -0.18, 0, -0.18);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.045,
      curveSegments: 24,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 4,
    });
  }

  function createLugiaWingGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.45, 0.45, 1.05, 0.36);
    shape.lineTo(0.84, 0.14);
    shape.lineTo(1.06, 0.02);
    shape.lineTo(0.82, -0.08);
    shape.lineTo(0.96, -0.24);
    shape.lineTo(0.66, -0.22);
    shape.lineTo(0.72, -0.38);
    shape.quadraticCurveTo(0.3, -0.26, 0, -0.16);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.05,
      curveSegments: 24,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.016,
      bevelSegments: 4,
    });
  }

  function createCrescentWingGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.06);
    shape.quadraticCurveTo(0.45, 0.48, 1.08, 0.44);
    shape.quadraticCurveTo(0.85, 0.02, 0.96, -0.32);
    shape.quadraticCurveTo(0.48, -0.14, 0, -0.22);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.048,
      curveSegments: 24,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 4,
    });
  }

  function createLeafBladeGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.3, 0.18, 0.72, 0.08);
    shape.quadraticCurveTo(0.92, 0.02, 1.0, 0);
    shape.quadraticCurveTo(0.92, -0.02, 0.72, -0.08);
    shape.quadraticCurveTo(0.3, -0.18, 0, 0);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.03,
      curveSegments: 20,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 3,
    });
  }

  function createScytheBladeGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.38, 0.36, 0.62, 0.72);
    shape.quadraticCurveTo(0.28, 0.42, -0.08, 0.14);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.042,
      curveSegments: 24,
      bevelEnabled: true,
      bevelThickness: 0.013,
      bevelSize: 0.013,
      bevelSegments: 4,
    });
  }

  function createFinBladeGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.08, 0.42, 0.42, 0.56);
    shape.quadraticCurveTo(0.32, 0.18, 0.38, -0.1);
    shape.lineTo(0, -0.06);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.038,
      curveSegments: 20,
      bevelEnabled: true,
      bevelThickness: 0.013,
      bevelSize: 0.013,
      bevelSegments: 4,
    });
  }

  function createMasterMGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.078, -0.056);
    shape.lineTo(-0.078, 0.068);
    shape.lineTo(-0.05, 0.068);
    shape.lineTo(0.0, 0.01);
    shape.lineTo(0.05, 0.068);
    shape.lineTo(0.078, 0.068);
    shape.lineTo(0.078, -0.056);
    shape.lineTo(0.052, -0.056);
    shape.lineTo(0.052, 0.022);
    shape.lineTo(0.0, -0.032);
    shape.lineTo(-0.052, 0.022);
    shape.lineTo(-0.052, -0.056);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.0025,
      bevelSize: 0.0025,
      bevelSegments: 2,
    });
    // Gently curve the M onto the 0.464 sphere surface
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const bend = (px * px + py * py) * 1.15;
      pos.setZ(i, pz - bend);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Curved spherical-shell fin for Great Ball (hugs R=0.46..0.473 cleanly with zero protruding corners)
  function createGreatBallFinGeometry() {
    const geo = new THREE.BoxGeometry(1, 1, 1, 8, 16, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5;
      const v = pos.getY(i) + 0.5;
      const w = pos.getZ(i) + 0.5;
      const lat = 0.09 + v * 0.84;
      const halfWidth = 0.07 + v * 0.045;
      const lon = 0.36 + v * 0.36 + (u - 0.5) * 2 * halfWidth;
      const r = 0.457 + w * 0.015;
      const x = r * Math.cos(lat) * Math.sin(lon);
      const y = r * Math.sin(lat);
      const z = r * Math.cos(lat) * Math.cos(lon);
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Curved spherical-shell leg for Ultra Ball H-arch (hugs R=0.46..0.471 cleanly)
  function createUltraArchLegGeometry() {
    const geo = new THREE.BoxGeometry(1, 1, 1, 6, 18, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5;
      const v = pos.getY(i) + 0.5;
      const w = pos.getZ(i) + 0.5;
      const lat = 0.08 + v * 1.04;
      const lon = 0.54 + (u - 0.5) * 0.17;
      const r = 0.457 + w * 0.013;
      const x = r * Math.cos(lat) * Math.sin(lon);
      const y = r * Math.sin(lat);
      const z = r * Math.cos(lat) * Math.cos(lon);
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Curved spherical-shell top crown bar for Ultra Ball H-arch
  function createUltraArchTopGeometry() {
    const geo = new THREE.BoxGeometry(1, 1, 1, 18, 6, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5;
      const v = pos.getY(i) + 0.5;
      const w = pos.getZ(i) + 0.5;
      const lon = -0.625 + u * 1.25;
      const lat = 1.02 + v * 0.19;
      const r = 0.457 + w * 0.013;
      const x = r * Math.cos(lat) * Math.sin(lon);
      const y = r * Math.sin(lat);
      const z = r * Math.cos(lat) * Math.cos(lon);
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function getSharedGeo() {
    if (geoCache) return geoCache;
    geoCache = {
      sphere: new THREE.SphereGeometry(1, 48, 36),
      sphereLow: new THREE.SphereGeometry(1, 28, 20),
      headSphere: createSculptedHeadVariant('round'),
      headSquirtle: createSculptedHeadVariant('squirtle'),
      headPikachu: createSculptedHeadVariant('pikachu'),
      headDragon: createSculptedHeadVariant('dragon'),
      headCroc: createSculptedHeadVariant('croc'),
      headCanine: createSculptedHeadVariant('canine'),
      headShrew: createSculptedHeadVariant('shrew'),
      headFrog: createSculptedHeadVariant('frog'),
      headAvian: createSculptedHeadVariant('avian'),
      headHuman: createSculptedHeadVariant('human'),
      headHeroic: createSculptedHeadVariant('heroic'),
      headFlatWide: createSculptedHeadVariant('flatWide'),
      // Aliases kept clean
      headReptile: createSculptedHeadVariant('dragon'),
      headFeline: createSculptedHeadVariant('canine'),
      hemi: new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.5),
      hemiBot: new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      box: new THREE.BoxGeometry(1, 1, 1, 2, 2, 2),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 4),
      cone: new THREE.ConeGeometry(0.5, 1, 28, 4),
      torus: new THREE.TorusGeometry(0.5, 0.16, 24, 48),
      torusThin: new THREE.TorusGeometry(0.5, 0.075, 20, 48),
      torusHalf: new THREE.TorusGeometry(0.5, 0.15, 20, 36, Math.PI),
      pokeballSeam: new THREE.TorusGeometry(0.456, 0.011, 16, 64),
      pokeballBtnRing: new THREE.TorusGeometry(0.044, 0.0045, 12, 36),
      greatBallFin: createGreatBallFinGeometry(),
      ultraArchLeg: createUltraArchLegGeometry(),
      ultraArchTop: createUltraArchTopGeometry(),
      ring: new THREE.RingGeometry(0.68, 1.0, 56),
      disc: new THREE.CircleGeometry(1, 64),
      octa: new THREE.OctahedronGeometry(1, 1),
      dodeca: new THREE.DodecahedronGeometry(1, 1),
      capsule: new THREE.CapsuleGeometry(0.5, 0.9, 16, 32),
      pearTorso: createPearTorsoGeometry(),
      torsoAthletic: createAthleticTorsoGeometry(),
      torsoHeroic: createHeroicTorsoGeometry(),
      torsoDragon: createDragonTorsoGeometry(),
      torsoAvian: createAvianTorsoGeometry(),
      torsoQuadruped: createQuadrupedTorsoGeometry(),
      dittoBlob: createDittoBlobGeometry(),
      gardevoirGown: createGardevoirGownGeometry(),
      curvedMustache: createCurvedMustacheGeometry(),
      ribbonTail: createRibbonTailGeometry(),
      limbLathe: createLimbLatheGeometry(),
      plastronCap: createPlastronCapGeometry(),
      appleBody: createAppleBodyGeometry(),
      squirtleTail: createSquirtleTailGeometry(),
      mewTail: createMewTailGeometry(),
      mewtwoTube: createMewtwoTubeGeometry(),
      mewtwoTail: createMewtwoTailGeometry(),
      serpentCoil: createTaperedSerpentGeometry(),
      meowthTail: createMeowthTailGeometry(),
      eeveeTail: createEeveeTailGeometry(),
      curvedHorn: createCurvedHornGeometry(),
      lightningTail: createLightningTailGeometry(),
      dragonWing: createDragonWingGeometry(),
      wingArmStrut: createWingArmStrutGeometry(),
      birdWing: createBirdWingGeometry(),
      lugiaWing: createLugiaWingGeometry(),
      crescentWing: createCrescentWingGeometry(),
      leafBlade: createLeafBladeGeometry(),
      scytheBlade: createScytheBladeGeometry(),
      finBlade: createFinBladeGeometry(),
      masterM: createMasterMGeometry(),
    };
    return geoCache;
  }

  function getStdMat(color, roughness, metalness, emissive, emissiveIntensity, envMapIntensity) {
    const r = roughness === undefined ? 0.56 : roughness;
    const m = metalness === undefined ? 0.02 : metalness;
    const e = emissive === undefined ? 0x000000 : emissive;
    const ei = emissiveIntensity === undefined ? 0 : emissiveIntensity;
    const emi = envMapIntensity === undefined ? 0.36 : envMapIntensity;

    const key = `std3|${color}|${r}|${m}|${e}|${ei}|${emi}`;
    if (matCache.has(key)) return matCache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: r,
      metalness: m,
      emissive: e,
      emissiveIntensity: ei,
      envMapIntensity: emi,
    });
    applySoftPokemonRimShader(mat);
    matCache.set(key, mat);
    return mat;
  }

  function getTexturedMat(map, cacheKey, roughness, envMapIntensity) {
    if (matCache.has(cacheKey)) return matCache.get(cacheKey);
    const mat = new THREE.MeshStandardMaterial({
      map,
      color: 0xffffff,
      roughness: roughness === undefined ? 0.54 : roughness,
      metalness: 0.02,
      envMapIntensity: envMapIntensity === undefined ? 0.36 : envMapIntensity,
    });
    applySoftPokemonRimShader(mat);
    matCache.set(cacheKey, mat);
    return mat;
  }

  function getBasicMat(color, opacity, side) {
    const op = opacity === undefined ? 1 : opacity;
    const sd = side === undefined ? THREE.FrontSide : side;
    const key = `bas|${color}|${op}|${sd}`;
    if (matCache.has(key)) return matCache.get(key);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: op < 1,
      opacity: op,
      side: sd,
    });
    matCache.set(key, mat);
    return mat;
  }

  function makeBlobShadow(radius) {
    const geo = getSharedGeo();
    const key = 'blobShadowMat';
    let mat = matCache.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        map: getBlobShadowTexture(),
        transparent: true,
        depthWrite: false,
      });
      matCache.set(key, mat);
    }
    const m = new THREE.Mesh(geo.disc, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.015;
    m.scale.setScalar(radius === undefined ? 0.72 : radius);
    return m;
  }

  function addPart(parent, geo, mat, pos, rot, scl) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scl) m.scale.set(scl[0], scl[1], scl[2]);
    parent.add(m);
    return m;
  }

  function addSculptedArm(group, side, mat, clawMat, pos, rot, scale, withFingers) {
    const geo = getSharedGeo();
    const scl = scale || [0.58, 0.56, 0.58];
    const fingers = withFingers === undefined ? true : withFingers;
    const arm = new THREE.Group();
    arm.position.set(pos[0], pos[1], pos[2]);
    arm.rotation.set(rot[0], rot[1], rot[2]);

    addPart(arm, geo.sphereLow, mat, [0, -0.15 * scl[1], 0], [0, 0, 0], [0.22 * scl[0], 0.22 * scl[1], 0.22 * scl[2]]);
    addPart(arm, geo.limbLathe, mat, [0, 0, 0], [0, 0, 0], scl);
    if (fingers) {
      for (const f of [-1, 0, 1]) {
        addPart(
          arm,
          geo.cone,
          clawMat,
          [f * 0.068 * scl[0] * 2, 0.44 * scl[1], 0.04 * f],
          [0.12 * f, 0, -f * 0.28],
          [0.044, 0.11, 0.044]
        );
      }
    }
    arm.userData.side = side;
    group.add(arm);
    return arm;
  }

  function addSculptedFoot(group, side, mat, clawMat, pos, scale, withToes) {
    const geo = getSharedGeo();
    const scl = scale || [0.65, 0.52, 0.65];
    const toes = withToes === undefined ? true : withToes;
    const leg = new THREE.Group();
    leg.position.set(pos[0], pos[1], pos[2]);
    addPart(leg, geo.limbLathe, mat, [0, 0.16, -0.02], [Math.PI, 0, 0], [scl[0] * 0.88, scl[1] * 0.85, scl[2] * 0.88]);
    addPart(leg, geo.sphereLow, mat, [0, 0.03, 0.08], [0, 0, 0], [0.185 * scl[0] * 1.4, 0.1 * scl[1] * 1.4, 0.22 * scl[2] * 1.4]);
    if (toes) {
      for (const t of [-1, 0, 1]) {
        addPart(
          leg,
          geo.cone,
          clawMat,
          [t * 0.075, 0.04, 0.26],
          [Math.PI * 0.46, 0, -t * 0.15],
          [0.04, 0.1, 0.04]
        );
      }
    }
    leg.userData.side = side;
    group.add(leg);
    return leg;
  }

  function addBentArm(group, side, upperMat, handMat, clawMat, shoulderPos, elbowPos, handPos, r, withClaws) {
    const geo = getSharedGeo();
    const s = new THREE.Vector3(...shoulderPos);
    const e = new THREE.Vector3(...elbowPos);
    const h = new THREE.Vector3(...handPos);

    addPart(group, geo.sphereLow, upperMat, shoulderPos, [0, 0, 0], [r * 1.15, r * 1.15, r * 1.15]);

    const addSegment = (p1, p2, mat, rad) => {
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      if (len < 0.01) return;
      const mesh = new THREE.Mesh(geo.cyl, mat);
      mesh.position.copy(mid);
      mesh.scale.set(rad * 2, len, rad * 2);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      group.add(mesh);
    };

    addSegment(s, e, upperMat, r * 0.92);
    addPart(group, geo.sphereLow, upperMat, elbowPos, [0, 0, 0], [r * 0.96, r * 0.96, r * 0.96]);
    addSegment(e, h, handMat, r * 0.85);
    addPart(group, geo.sphereLow, handMat, handPos, [0, 0, 0], [r * 1.15, r * 1.0, r * 1.15]);

    if (withClaws) {
      const fwd = new THREE.Vector3().subVectors(h, e).normalize();
      for (const f of [-1, 0, 1]) {
        const claw = new THREE.Mesh(geo.cone, clawMat);
        claw.position.copy(h).addScaledVector(fwd, r * 1.15);
        claw.position.x += f * r * 0.45 * side;
        claw.scale.set(r * 0.48, r * 1.25, r * 0.48);
        claw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fwd);
        group.add(claw);
      }
    }
  }

  function addMuscularLeg(group, side, thighMat, shinMat, footMat, clawMat, hipPos, kneePos, footPos, r, withClaws) {
    const geo = getSharedGeo();
    const h = new THREE.Vector3(...hipPos);
    const k = new THREE.Vector3(...kneePos);
    const f = new THREE.Vector3(...footPos);

    addPart(group, geo.sphereLow, thighMat, hipPos, [0, 0, 0], [r * 1.35, r * 1.45, r * 1.35]);
    const addSeg = (p1, p2, mat, rad) => {
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      if (len < 0.01) return;
      const mesh = new THREE.Mesh(geo.cyl, mat);
      mesh.position.copy(mid);
      mesh.scale.set(rad * 2, len, rad * 2);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      group.add(mesh);
    };
    addSeg(h, k, thighMat, r * 1.15);
    addPart(group, geo.sphereLow, shinMat, kneePos, [0, 0, 0], [r * 1.0, r * 1.0, r * 1.0]);
    addSeg(k, f, shinMat, r * 0.85);
    addPart(group, geo.sphereLow, footMat, [f.x, f.y, f.z + r * 0.55], [0, 0, 0], [r * 1.18, r * 0.72, r * 1.68]);
    if (withClaws) {
      for (const t of [-1, 0, 1]) {
        addPart(group, geo.cone, clawMat, [f.x + t * r * 0.48, f.y, f.z + r * 2.05], [Math.PI * 0.48, 0, 0], [r * 0.42, r * 1.1, r * 0.42]);
      }
    }
  }

  function addQuadrupedStance(group, mat, pawMat, clawMat, spreadX, frontZ, backZ, legH, legR, withClaws) {
    const geo = getSharedGeo();
    const coords = [
      [-spreadX, frontZ, -1, 1],
      [spreadX, frontZ, 1, 1],
      [-spreadX * 1.05, backZ, -1, -1],
      [spreadX * 1.05, backZ, 1, -1],
    ];
    for (const [lx, lz, side, isFront] of coords) {
      const leg = new THREE.Group();
      leg.position.set(lx, legH * 0.54, lz);
      addPart(leg, geo.sphereLow, mat, [0, legH * 0.28, isFront === 1 ? -0.02 : 0.02], [isFront === 1 ? 0.2 : -0.28, 0, 0], [legR * 1.28, legR * 1.55, legR * 1.38]);
      const shinTilt = isFront === 1 ? -0.08 : 0.16;
      addPart(leg, geo.cyl, mat, [0, -legH * 0.08, isFront === 1 ? 0.02 : -0.03], [shinTilt, 0, 0], [legR * 1.48, legH * 0.68, legR * 1.48]);
      addPart(leg, geo.sphereLow, pawMat, [0, -legH * 0.46, 0.07], [0, 0, 0], [legR * 1.24, legR * 0.72, legR * 1.5]);
      if (withClaws) {
        for (const t of [-1, 0, 1]) {
          addPart(leg, geo.cone, clawMat, [t * legR * 0.45, -legH * 0.48, 0.07 + legR * 1.38], [Math.PI * 0.48, 0, 0], [0.032, 0.08, 0.032]);
        }
      }
      leg.userData.side = side;
      group.add(leg);
    }
  }

  function addBirdTalons(group, talonMat, spreadX, yPos) {
    const geo = getSharedGeo();
    for (const s of [-1, 1]) {
      addPart(group, geo.cyl, talonMat, [s * spreadX, yPos + 0.18, 0.06], [0.1, 0, 0], [0.055, 0.34, 0.055]);
      for (const t of [-1, 0, 1]) {
        addPart(
          group,
          geo.cone,
          talonMat,
          [s * spreadX + t * 0.055, yPos + 0.03, 0.16],
          [Math.PI * 0.48, t * 0.25, 0],
          [0.038, 0.15, 0.038]
        );
      }
      addPart(group, geo.cone, talonMat, [s * spreadX, yPos + 0.03, -0.02], [-Math.PI * 0.48, 0, 0], [0.035, 0.11, 0.035]);
    }
  }

  function buildPokemon3D(species, isShiny, nature) {
    const geo = getSharedGeo();
    const group = new THREE.Group();
    const nat = nature || NATURES[0];
    const shiny = Boolean(isShiny);

    const bodyHex = shiny ? species.shinyBody : species.body;
    const accentHex = shiny ? species.shinyAccent : species.accent;
    const bellyHex = shiny ? species.shinyBelly : species.belly;
    const detailHex = shiny ? species.shinyDetail : species.detail;

    const bodyMat = getStdMat(bodyHex, 0.56, 0.02);
    const accentMat = getStdMat(accentHex, 0.52, 0.04);
    const bellyMat = getStdMat(bellyHex, 0.58, 0.02);
    const detailMat = getStdMat(detailHex, 0.54, 0.04);
    const darkMat = getStdMat('#1e293b', 0.52, 0.02);
    const whiteMat = getStdMat('#ffffff', 0.48, 0.02);
    const goldMat = getStdMat('#facc15', 0.34, 0.32);
    const silverMat = getStdMat('#cbd5e1', 0.3, 0.42);
    const flameMat = getStdMat('#fb923c', 0.32, 0, '#ea580c', 0.5);
    const flameCoreMat = getStdMat('#fef08a', 0.25, 0, '#facc15', 0.62);

    const faceTex = getPokemonFaceTexture(species, shiny, nat.name);
    const headMat = getTexturedMat(faceTex, `head_v6_${species.id}_${shiny ? 's' : 'n'}_${nat.name}`, 0.54);

    const addPaintedHead = (pos, scl, rot, customGeo) => {
      return addPart(group, customGeo || geo.headSphere, headMat, pos, rot || [0, 0, 0], scl);
    };

    switch (species.id) {
      case 'squirtle': {
        // #007 Squirtle: rounded carapace, white rim, segmented plastron, smooth cheek head (no overlapping chin blob) & curled wave tail
        const caraTex = getCarapaceTexture(accentHex);
        const caraMat = getTexturedMat(caraTex, `cara_${accentHex}`, 0.5);
        addPart(group, geo.sphere, caraMat, [0, 0.66, -0.16], [-0.08, 0, 0], [0.54, 0.55, 0.35]);
        addPart(group, geo.torus, detailMat, [0, 0.66, -0.02], [0.05, 0, 0], [0.54, 0.57, 0.44]);

        const plastronTex = getShellPlastronTexture(bellyHex, detailHex);
        const plastronMat = getTexturedMat(plastronTex, `plas_v2_${bellyHex}_${detailHex}`, 0.5);
        addPart(group, geo.plastronCap, plastronMat, [0, 0.66, 0.04], [0, 0, 0], [0.53, 0.55, 0.43]);

        addPart(group, geo.cyl, bodyMat, [0, 1.07, 0.07], [0, 0, 0], [0.27, 0.22, 0.27]);
        addPaintedHead([0, 1.38, 0.12], [0.46, 0.45, 0.45], [0, 0, 0], geo.headSquirtle);

        for (const s of [-1, 1]) {
          addSculptedArm(group, s, bodyMat, bodyMat, [s * 0.52, 0.88, 0.12], [0.22, 0, -s * 0.94], [0.52, 0.56, 0.52], true);
          addSculptedFoot(group, s, bodyMat, whiteMat, [s * 0.27, 0.16, 0.06], [0.62, 0.55, 0.62], true);
        }
        addPart(group, geo.squirtleTail, bodyMat, [0, 0.14, 0], [0, 0, 0], [1, 1, 1]);
        addPart(group, geo.sphereLow, bodyMat, [0, 0.85, -0.58], [0, 0, 0], [0.22, 0.22, 0.22]);
        break;
      }

      case 'pikachu': {
        // #025 Pikachu: plump pear rodent body with 2 brown back stripes, angled black-tipped ears, red cheeks & lightning tail
        const pikaTex = getPikachuBodyTexture(bodyHex, detailHex);
        const pikaBodyMat = getTexturedMat(pikaTex, `pika_body_${bodyHex}_${detailHex}`, 0.54);
        addPart(group, geo.pearTorso, pikaBodyMat, [0, 0.58, 0], [-0.06, 0, 0], [0.46, 0.46, 0.44]);
        addPart(group, geo.cyl, bodyMat, [0, 0.98, 0.04], [0.05, 0, 0], [0.27, 0.16, 0.25]);
        addPaintedHead([0, 1.24, 0.07], [0.44, 0.41, 0.42], [0, 0, 0], geo.headPikachu);
        for (const s of [-1, 1]) {
          addPart(group, geo.capsule, bodyMat, [s * 0.26, 1.7, 0.04], [0, 0, -s * 0.52], [0.13, 0.36, 0.12]);
          addPart(group, geo.cone, darkMat, [s * 0.41, 1.94, 0.04], [0, 0, -s * 0.52], [0.13, 0.24, 0.12]);
          addBentArm(group, s, bodyMat, bodyMat, bodyMat, [s * 0.35, 0.84, 0.08], [s * 0.46, 0.72, 0.22], [s * 0.36, 0.64, 0.34], 0.078, false);
          addPart(group, geo.sphereLow, bodyMat, [s * 0.25, 0.32, 0.0], [0.2, 0, 0], [0.16, 0.18, 0.18]);
          addPart(group, geo.capsule, bodyMat, [s * 0.25, 0.09, 0.14], [Math.PI * 0.5, 0, 0], [0.13, 0.26, 0.095]);
        }
        addPart(group, geo.box, detailMat, [0.02, 0.4, -0.44], [-0.2, 0.2, -0.1], [0.12, 0.22, 0.08]);
        addPart(group, geo.lightningTail, bodyMat, [0.14, 0.82, -0.64], [-0.25, 0.22, -0.1], [0.88, 0.88, 0.88]);
        break;
      }

      case 'eevee': {
        // #133 Eevee: quadruped fox with lush fluffy cream neck ruff, diamond ears, continuous canine muzzle & zig-zag cream-tipped tail
        const eeveeTailTex = getEeveeTailTexture(bodyHex, accentHex);
        const eeveeTailMat = getTexturedMat(eeveeTailTex, `eevee_tail_${bodyHex}_${accentHex}`, 0.56);
        addPart(group, geo.torsoQuadruped, bodyMat, [0, 0.58, -0.06], [-0.08, 0, 0], [0.62, 0.54, 0.5]);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          addPart(group, geo.sphereLow, accentMat, [Math.cos(a) * 0.26, 0.86 + Math.abs(Math.cos(a)) * 0.06, 0.18 + Math.sin(a) * 0.23], [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], [0.17, 0.22, 0.16]);
        }
        addPart(group, geo.sphereLow, accentMat, [0, 0.72, 0.36], [0.3, 0, 0], [0.22, 0.22, 0.18]);
        addPaintedHead([0, 1.22, 0.24], [0.4, 0.38, 0.4], [0, 0, 0], geo.headCanine);
        for (const s of [-1, 1]) {
          addPart(group, geo.capsule, bodyMat, [s * 0.29, 1.65, 0.16], [0, 0, -s * 0.52], [0.21, 0.44, 0.1]);
          addPart(group, geo.capsule, detailMat, [s * 0.28, 1.63, 0.21], [0, 0, -s * 0.52], [0.13, 0.3, 0.06]);
        }
        addQuadrupedStance(group, bodyMat, bodyMat, darkMat, 0.21, 0.24, -0.34, 0.48, 0.095, false);
        addPart(group, geo.eeveeTail, eeveeTailMat, [0, 0.76, -0.62], [-0.48, 0, 0], [1.0, 1.05, 1.0]);
        break;
      }

      case 'espeon': {
        // Espeon: sleek feline quadruped, arched neck, continuous canine head, red gem, large ears & forked tail
        addPart(group, geo.torsoQuadruped, bodyMat, [0, 0.58, -0.08], [-0.06, 0, 0], [0.5, 0.48, 0.56]);
        addPart(group, geo.cyl, bodyMat, [0, 0.94, 0.22], [0.28, 0, 0], [0.2, 0.42, 0.2]);
        addPaintedHead([0, 1.24, 0.3], [0.38, 0.38, 0.39], [0, 0, 0], geo.headCanine);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.28, 1.7, 0.22], [0, 0, -s * 0.42], [0.2, 0.56, 0.12]);
          addPart(group, geo.cone, detailMat, [s * 0.27, 1.67, 0.28], [0, 0, -s * 0.42], [0.12, 0.38, 0.07]);
          addPart(group, geo.cone, bodyMat, [s * 0.34, 1.15, 0.34], [0, 0, -s * 1.25], [0.068, 0.2, 0.068]);
          addPart(group, geo.cyl, bodyMat, [s * 0.11, 1.12, -0.96], [-0.55, 0, -s * 0.42], [0.034, 0.4, 0.034]);
        }
        addPart(group, geo.cyl, bodyMat, [0, 0.74, -0.68], [-0.72, 0, 0], [0.05, 0.62, 0.05]);
        addQuadrupedStance(group, bodyMat, bodyMat, bodyMat, 0.18, 0.26, -0.36, 0.52, 0.072, false);
        break;
      }

      case 'mew': {
        // #151 Mew: cute rounded feline head (no boxy snout), triangular ears, pear body, tucked arms, big hind feet & looping tail
        addPart(group, geo.pearTorso, bodyMat, [0, 0.74, 0], [-0.14, 0, 0], [0.28, 0.36, 0.26]);
        addPart(group, geo.cyl, bodyMat, [0, 1.06, 0.05], [0.1, 0, 0], [0.14, 0.18, 0.14]);
        addPaintedHead([0, 1.32, 0.08], [0.41, 0.36, 0.39], [0, 0, 0], geo.headPikachu);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.26, 1.66, 0.06], [0, 0, -s * 0.48], [0.15, 0.3, 0.12]);
          addBentArm(group, s, bodyMat, bodyMat, bodyMat, [s * 0.22, 0.94, 0.08], [s * 0.3, 0.82, 0.2], [s * 0.18, 0.76, 0.3], 0.048, false);
          addPart(group, geo.sphereLow, bodyMat, [s * 0.19, 0.38, 0.1], [0.34, 0, 0], [0.12, 0.25, 0.18]);
          addPart(group, geo.sphereLow, accentMat, [s * 0.19, 0.32, 0.25], [0.34, 0, 0], [0.065, 0.1, 0.036]);
        }
        addPart(group, geo.mewTail, bodyMat, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
        addPart(group, geo.sphereLow, accentMat, [-0.08, 1.46, -0.48], [0, 0, 0], [0.11, 0.15, 0.11]);
        break;
      }

      case 'gengar': {
        // #094 Gengar: wide-eared mischievous shadow ghost with huge angled cat-like ears, back spines, stubby arms & wide grin
        addPart(group, geo.headFlatWide, headMat, [0, 0.84, 0], [0, 0, 0], [0.72, 0.78, 0.68]);
        for (const s of [-1, 1]) {
          // Huge wide angled triangular Gengar ears
          addPart(group, geo.cone, bodyMat, [s * 0.56, 1.46, 0.02], [-0.06, 0, -s * 0.66], [0.42, 0.72, 0.32]);
          // Side head/back spines
          addPart(group, geo.cone, detailMat, [s * 0.28, 1.46, -0.26], [-0.45, 0, -s * 0.25], [0.15, 0.36, 0.15]);
          addPart(group, geo.cone, detailMat, [s * 0.38, 1.08, -0.52], [-0.85, 0, -s * 0.22], [0.15, 0.34, 0.15]);
          addSculptedArm(group, s, bodyMat, bodyMat, [s * 0.72, 0.82, 0.14], [0.22, 0, -s * 0.92], [0.54, 0.58, 0.54], true);
          addSculptedFoot(group, s, bodyMat, bodyMat, [s * 0.36, 0.14, 0.14], [0.68, 0.48, 0.7], true);
        }
        // Center mohawk & spine ridge
        addPart(group, geo.cone, bodyMat, [0, 1.54, 0.02], [0.05, 0, 0], [0.16, 0.36, 0.16]);
        for (let i = 0; i < 4; i++) {
          addPart(group, geo.cone, detailMat, [0, 1.48 - i * 0.24, -0.22 - i * 0.18], [-0.35 - i * 0.28, 0, 0], [0.17, 0.42, 0.17]);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.34, -0.7], [-1.15, 0, 0], [0.24, 0.46, 0.24]);
        break;
      }

      case 'blastoise': {
        // #009 Blastoise: stout dark-blue tortoise, cream lower jaw, heavy shell + thick twin steel hydro cannons from armored ports
        const caraTex = getCarapaceTexture(accentHex);
        const caraMat = getTexturedMat(caraTex, `cara_${accentHex}`, 0.5);
        const plastronTex = getShellPlastronTexture(bellyHex, '#f8fafc');
        const plastronMat = getTexturedMat(plastronTex, `plas_v2_${bellyHex}_w`, 0.5);

        addPart(group, geo.sphere, caraMat, [0, 0.78, -0.22], [-0.1, 0, 0], [0.68, 0.68, 0.45]);
        addPart(group, geo.torus, whiteMat, [0, 0.78, -0.02], [0.1, 0, 0], [0.62, 0.62, 0.42]);
        addPart(group, geo.plastronCap, plastronMat, [0, 0.76, 0.06], [0, 0, 0], [0.64, 0.62, 0.48]);
        addPart(group, geo.cyl, bodyMat, [0, 1.24, 0.1], [0.12, 0, 0], [0.36, 0.22, 0.34]);
        addPaintedHead([0, 1.46, 0.16], [0.43, 0.4, 0.42], [0, 0, 0], geo.headDragon);
        addPart(group, geo.sphereLow, detailMat, [0, 1.29, 0.36], [0, 0, 0], [0.36, 0.16, 0.26]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.26, 1.84, 0.12], [0, 0, -s * 0.3], [0.12, 0.3, 0.12]);
          addPart(group, geo.sphereLow, whiteMat, [s * 0.4, 1.25, -0.14], [0, 0, 0], [0.18, 0.16, 0.2]);
          addPart(group, geo.cyl, silverMat, [s * 0.46, 1.42, 0.0], [-0.56, 0, -s * 0.14], [0.22, 0.56, 0.22]);
          addPart(group, geo.torus, darkMat, [s * 0.5, 1.66, 0.16], [Math.PI * 0.3, 0, -s * 0.14], [0.23, 0.23, 0.13]);
          addBentArm(group, s, bodyMat, bodyMat, whiteMat, [s * 0.56, 1.04, 0.06], [s * 0.78, 0.86, 0.16], [s * 0.7, 0.68, 0.38], 0.145, true);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, whiteMat, [s * 0.34, 0.42, 0.04], [s * 0.38, 0.24, 0.12], [s * 0.36, 0.08, 0.08], 0.155, true);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.4, -0.76], [-1.1, 0, 0], [0.22, 0.48, 0.22]);
        break;
      }

      case 'applin': {
        const appleTex = getAppleSkinTexture(bodyHex, bellyHex);
        const appleMat = getTexturedMat(appleTex, `apple_${bodyHex}_${bellyHex}`, 0.42);
        addPart(group, geo.appleBody, appleMat, [0, 0.68, 0], [0, 0, 0], [0.72, 0.68, 0.72]);
        addPart(group, geo.disc, bellyMat, [0, 1.15, 0], [-Math.PI * 0.5, 0, 0], [0.24, 0.24, 0.24]);
        addPart(group, geo.cyl, detailMat, [0, 1.38, 0], [0, 0, 0.18], [0.075, 0.34, 0.075]);
        addPart(group, geo.leafBlade, accentMat, [0.06, 1.46, 0], [0.25, 0, 0.2], [0.58, 0.58, 0.58]);
        const wyrmTex = getPokemonFaceTexture(
          Object.assign({}, species, { body: bellyHex, shinyBody: bellyHex }),
          false,
          nat.name
        );
        const wyrmMat = getTexturedMat(wyrmTex, `wyrm_${species.id}_${bellyHex}_${nat.name}`, 0.54);
        addPart(group, geo.cyl, bellyMat, [0, 0.88, 0.4], [0.52, 0, 0], [0.16, 0.28, 0.16]);
        addPart(group, geo.headDragon, wyrmMat, [0, 1.06, 0.56], [0, 0, 0], [0.3, 0.28, 0.3]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cyl, bellyMat, [s * 0.12, 1.38, 0.54], [0, 0, -s * 0.18], [0.036, 0.26, 0.036]);
          addPart(group, geo.sphereLow, darkMat, [s * 0.15, 1.51, 0.56], [0, 0, 0], [0.052, 0.052, 0.052]);
        }
        addPart(group, geo.cone, bellyMat, [0, 0.44, -0.74], [-1.0, 0, 0], [0.14, 0.38, 0.14]);
        break;
      }

      case 'zapdos': {
        // #145 Zapdos: spiky electric raptor with jagged shoulder ruff, wide black+yellow wings, long sharp beak & spiky tail
        addPart(group, geo.torsoAvian, bodyMat, [0, 0.72, -0.02], [0.2, 0, 0], [0.46, 0.48, 0.44]);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          addPart(group, geo.cone, i % 2 === 0 ? bodyMat : accentMat, [Math.cos(a) * 0.34, 1.06, Math.sin(a) * 0.3], [Math.sin(a) * 0.78, 0, -Math.cos(a) * 0.78], [0.15, 0.56, 0.15]);
        }
        addPart(group, geo.cyl, bodyMat, [0, 1.18, 0.06], [0.14, 0, 0], [0.22, 0.24, 0.22]);
        addPaintedHead([0, 1.4, 0.1], [0.37, 0.36, 0.4], [0, 0, 0], geo.headAvian);
        addPart(group, geo.cone, detailMat, [0, 1.3, 0.62], [Math.PI * 0.52, 0, 0], [0.095, 0.6, 0.095]);
        for (let i = -2; i <= 2; i++) {
          addPart(group, geo.cone, bodyMat, [i * 0.14, 1.8, 0.0], [-0.22, 0, -i * 0.3], [0.12, 0.62, 0.12]);
        }
        for (const s of [-1, 1]) {
          addPart(group, geo.birdWing, bodyMat, [s * 0.3, 1.08, -0.08], [0.18, s === -1 ? Math.PI - 0.08 : 0.08, 0.22 * s], [1.22, 1.14, 1.14]);
          addPart(group, geo.birdWing, accentMat, [s * 0.3, 0.96, -0.18], [0.2, s === -1 ? Math.PI - 0.08 : 0.08, 0.08 * s], [1.08, 0.96, 0.96]);
        }
        for (let i = -2; i <= 2; i++) {
          addPart(group, geo.cone, i % 2 === 0 ? bodyMat : accentMat, [i * 0.14, 0.52, -0.58], [-1.15, i * 0.24, 0], [0.14, 0.64, 0.14]);
        }
        addBirdTalons(group, detailMat, 0.22, 0.04);
        break;
      }

      case 'fuecoco': {
        // Fuecoco: crimson dino body with yellow belly square, rounded white skull mask, tucked jaw & 2-tuft yellow flame crest
        const fueTex = getFuecocoBodyTexture(bodyHex, bellyHex);
        const fueMat = getTexturedMat(fueTex, `fue_v2_${bodyHex}_${bellyHex}`, 0.54);
        addPart(group, geo.torsoDragon, fueMat, [0, 0.6, -0.02], [0, 0, 0], [0.52, 0.48, 0.5]);
        addPaintedHead([0, 1.2, 0.06], [0.44, 0.41, 0.45], [0, 0, 0], geo.headCroc);
        addPart(group, geo.capsule, detailMat, [0, 0.96, 0.4], [Math.PI * 0.5, 0, 0], [0.34, 0.2, 0.095]);
        for (const s of [-1, 1]) {
          addPart(group, geo.sphereLow, darkMat, [s * 0.07, 1.11, 0.6], [0, 0, 0], [0.024, 0.022, 0.02]);
          addPart(group, geo.cone, whiteMat, [s * 0.13, 0.99, 0.58], [Math.PI, 0, 0], [0.042, 0.085, 0.042]);
          addPart(group, geo.cone, accentMat, [s * 0.09, 1.74, 0.04], [-0.1, 0, -s * 0.26], [0.09, 0.34, 0.09]);
          addSculptedArm(group, s, bodyMat, bodyMat, [s * 0.46, 0.76, 0.12], [0.2, 0, -s * 0.65], [0.44, 0.46, 0.44], true);
          addSculptedFoot(group, s, bodyMat, whiteMat, [s * 0.24, 0.14, 0.08], [0.54, 0.44, 0.58], true);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.4, -0.64], [-1.05, 0, 0], [0.24, 0.52, 0.24]);
        break;
      }

      case 'charizard': {
        // #006 Charizard: sculpted dragon snout (no floating capsule!), S-neck, orange wing bone struts framing teal membrane + claw tips!
        const bellyTex = getScaleBellyTexture(bellyHex, '#d97706');
        const scaleBellyMat = getTexturedMat(bellyTex, `scalebelly_${bellyHex}`, 0.54);
        addPart(group, geo.torsoDragon, bodyMat, [0, 0.68, -0.04], [0, 0, 0], [0.52, 0.54, 0.54]);
        addPart(group, geo.sphere, scaleBellyMat, [0, 0.58, 0.28], [-0.15, 0, 0], [0.38, 0.44, 0.24]);
        addPart(group, geo.cyl, bodyMat, [0, 1.18, 0.06], [0.2, 0, 0], [0.24, 0.54, 0.24]);
        addPart(group, geo.sphere, scaleBellyMat, [0, 1.14, 0.18], [0.18, 0, 0], [0.14, 0.28, 0.1]);
        addPaintedHead([0, 1.54, 0.14], [0.38, 0.37, 0.42], [0, 0, 0], geo.headDragon);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.19, 1.92, -0.04], [-0.45, 0, -s * 0.22], [0.11, 0.48, 0.11]);
          addPart(group, geo.dragonWing, accentMat, [s * 0.24, 1.14, -0.22], [0.14, s === -1 ? Math.PI - 0.32 : 0.32, 0.12], [1.18, 1.18, 1.18]);
          addPart(group, geo.wingArmStrut, bodyMat, [s * 0.24, 1.14, -0.22], [0.14, s === -1 ? Math.PI - 0.32 : 0.32, 0.12], [1.18, 1.18, 1.18]);
          addPart(group, geo.cone, whiteMat, [s * 1.23, 1.98, -0.43], [-0.1, 0, -s * 0.35], [0.065, 0.16, 0.065]);
          addBentArm(group, s, bodyMat, bodyMat, whiteMat, [s * 0.34, 1.02, 0.1], [s * 0.54, 0.88, 0.2], [s * 0.46, 0.72, 0.38], 0.085, true);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, whiteMat, [s * 0.32, 0.44, 0.02], [s * 0.36, 0.26, 0.12], [s * 0.32, 0.08, 0.08], 0.135, true);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.52, -0.72], [-0.88, 0, 0], [0.24, 0.84, 0.24]);
        addPart(group, geo.cone, flameMat, [0, 0.96, -1.08], [0, 0, 0], [0.28, 0.44, 0.28]);
        addPart(group, geo.sphereLow, flameCoreMat, [0, 0.88, -1.08], [0, 0, 0], [0.12, 0.18, 0.12]);
        break;
      }

      case 'venusaur': {
        // #003 Venusaur: spotted teal dinosaur skin + wide flat frog skull + palm trunk + 6 leaves + spotted Rafflesia flower
        const dinoTex = getSpottedDinoTexture(bodyHex, bellyHex);
        const dinoMat = getTexturedMat(dinoTex, `dino_${bodyHex}_${bellyHex}`, 0.56);
        const petalTex = getRafflesiaPetalTexture(accentHex);
        const petalMat = getTexturedMat(petalTex, `rafflesia_${accentHex}`, 0.52);
        const trunkMat = getStdMat('#78350f', 0.65, 0.02);

        addPart(group, geo.torsoQuadruped, dinoMat, [0, 0.56, -0.06], [-0.08, 0, 0], [1.02, 0.72, 0.74]);
        addPaintedHead([0, 0.98, 0.5], [0.46, 0.4, 0.44], [0, 0, 0], geo.headFrog);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.34, 1.32, 0.46], [0, 0, -s * 0.4], [0.14, 0.26, 0.14]);
          addPart(group, geo.cone, accentMat, [s * 0.33, 1.3, 0.52], [0, 0, -s * 0.4], [0.075, 0.16, 0.075]);
        }
        addPart(group, geo.cyl, trunkMat, [0, 1.24, -0.24], [0, 0, 0], [0.32, 0.58, 0.32]);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          addPart(group, geo.leafBlade, detailMat, [Math.cos(a) * 0.14, 1.34, -0.24 + Math.sin(a) * 0.14], [0.2, -a, 0], [0.96, 0.96, 0.96]);
          addPart(group, geo.sphereLow, petalMat, [Math.cos(a) * 0.42, 1.54, -0.24 + Math.sin(a) * 0.42], [0, -a, 0.14], [0.38, 0.14, 0.28]);
        }
        addPart(group, geo.cyl, goldMat, [0, 1.66, -0.24], [0, 0, 0], [0.24, 0.24, 0.24]);
        addPart(group, geo.sphereLow, goldMat, [0, 1.76, -0.24], [0, 0, 0], [0.17, 0.09, 0.17]);
        addQuadrupedStance(group, dinoMat, bodyMat, whiteMat, 0.48, 0.34, -0.34, 0.42, 0.19, true);
        break;
      }

      case 'snorlax': {
        // #143 Snorlax: seamless cream oval belly texture on dark teal torso + continuous wide face mask + big cream feet
        const snorTex = getSnorlaxBodyTexture(bodyHex, bellyHex);
        const snorMat = getTexturedMat(snorTex, `snor_body_${bodyHex}_${bellyHex}`, 0.58);
        addPart(group, geo.torsoDragon, snorMat, [0, 0.86, -0.04], [0, 0, 0], [0.92, 0.8, 0.84]);
        addPaintedHead([0, 1.56, 0.08], [0.47, 0.44, 0.44], [0, 0, 0], geo.headFlatWide);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.29, 1.96, 0.06], [0, 0, -s * 0.32], [0.15, 0.34, 0.15]);
          addBentArm(group, s, bodyMat, bodyMat, whiteMat, [s * 0.74, 1.08, 0.08], [s * 0.94, 0.88, 0.18], [s * 0.86, 0.64, 0.28], 0.17, true);
          addSculptedFoot(group, s, bellyMat, whiteMat, [s * 0.42, 0.18, 0.18], [0.82, 0.56, 0.84], true);
          addPart(group, geo.sphereLow, getStdMat('#78350f', 0.64), [s * 0.42, 0.16, 0.36], [0, 0, 0], [0.14, 0.1, 0.05]);
        }
        break;
      }

      case 'lucario': {
        // Lucario: continuous canine snout (no extra capsule), black nose tip, aura appendages, chest spike & dorsal paw spikes
        addPart(group, geo.torsoAthletic, bodyMat, [0, 0.82, 0], [0, 0, 0], [0.36, 0.36, 0.34]);
        addPart(group, geo.sphere, bellyMat, [0, 0.84, 0.16], [0, 0, 0], [0.26, 0.32, 0.2]);
        addPart(group, geo.cone, silverMat, [0, 0.9, 0.36], [Math.PI * 0.45, 0, 0], [0.08, 0.24, 0.08]);
        addPart(group, geo.cyl, accentMat, [0, 1.18, 0.04], [0.06, 0, 0], [0.16, 0.16, 0.16]);
        addPaintedHead([0, 1.38, 0.06], [0.37, 0.38, 0.4], [0, 0, 0], geo.headCanine);
        addPart(group, geo.sphereLow, darkMat, [0, 1.33, 0.56], [0, 0, 0], [0.042, 0.036, 0.042]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.2, 1.88, 0.04], [0, 0, -s * 0.16], [0.11, 0.56, 0.11]);
          addPart(group, geo.capsule, accentMat, [s * 0.22, 1.38, -0.32], [-0.48, 0, -s * 0.22], [0.11, 0.32, 0.11]);
          addPart(group, geo.capsule, accentMat, [s * 0.11, 1.3, -0.38], [-0.62, 0, -s * 0.1], [0.095, 0.28, 0.095]);
          addBentArm(group, s, bodyMat, accentMat, accentMat, [s * 0.3, 1.0, 0.04], [s * 0.46, 0.82, 0.12], [s * 0.52, 0.66, 0.26], 0.085, false);
          addPart(group, geo.cone, silverMat, [s * 0.52, 0.74, 0.29], [0.28, 0, -s * 0.22], [0.055, 0.16, 0.055]);
          addPart(group, geo.pearTorso, bodyMat, [s * 0.18, 0.48, 0.02], [0, 0, s * 0.08], [0.18, 0.2, 0.18]);
          addMuscularLeg(group, s, bodyMat, accentMat, accentMat, accentMat, [s * 0.19, 0.46, 0.02], [s * 0.22, 0.28, 0.1], [s * 0.22, 0.08, 0.06], 0.09, false);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.52, -0.48], [-0.92, 0, 0], [0.15, 0.54, 0.15]);
        break;
      }

      case 'greninja': {
        addPart(group, geo.torsoAthletic, bodyMat, [0, 0.74, 0], [0.22, 0, 0], [0.36, 0.4, 0.32]);
        addPart(group, geo.sphere, bellyMat, [0, 0.72, 0.22], [0.15, 0, 0], [0.22, 0.28, 0.14]);
        addPart(group, geo.torus, accentMat, [0, 1.06, 0.08], [Math.PI * 0.48, 0, 0], [0.38, 0.38, 0.5]);
        addPart(group, geo.capsule, accentMat, [0.22, 0.82, -0.4], [-0.38, 0, -0.25], [0.22, 0.66, 0.12]);
        addPaintedHead([0, 1.32, 0.12], [0.41, 0.37, 0.42], [0, 0, 0], geo.headFrog);
        addPart(group, geo.finBlade, detailMat, [0, 1.64, 0.08], [0, Math.PI * 0.5, 0], [0.52, 0.72, 0.52]);
        for (const s of [-1, 1]) {
          addPart(group, geo.finBlade, bodyMat, [s * 0.34, 1.44, 0.08], [0, s === -1 ? Math.PI : 0, -s * 0.25], [0.64, 0.52, 0.64]);
          addPart(group, geo.octa, whiteMat, [s * 0.34, 0.44, 0.08], [0, 0, 0], [0.14, 0.14, 0.06]);
          addBentArm(group, s, bodyMat, bodyMat, bodyMat, [s * 0.3, 0.96, 0.08], [s * 0.48, 0.8, 0.18], [s * 0.4, 0.66, 0.36], 0.072, true);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, bodyMat, [s * 0.24, 0.44, 0.0], [s * 0.34, 0.28, 0.22], [s * 0.24, 0.08, 0.06], 0.1, true);
        }
        break;
      }

      case 'dragonite': {
        // #149 Dragonite: chubby pear belly, cute rounded snout, curvy noodle antennae & rounded dragon wings
        const bellyTex = getScaleBellyTexture(bellyHex, '#d97706');
        const scaleBellyMat = getTexturedMat(bellyTex, `scalebelly_${bellyHex}`, 0.54);
        addPart(group, geo.torsoDragon, bodyMat, [0, 0.68, -0.02], [0, 0, 0], [0.6, 0.56, 0.6]);
        addPart(group, geo.sphere, scaleBellyMat, [0, 0.6, 0.34], [-0.12, 0, 0], [0.41, 0.47, 0.24]);
        addPart(group, geo.cyl, bodyMat, [0, 1.14, 0.04], [0.12, 0, 0], [0.3, 0.32, 0.28]);
        addPaintedHead([0, 1.38, 0.08], [0.42, 0.4, 0.42], [0, 0, 0], geo.headSquirtle);
        addPart(group, geo.cone, detailMat, [0, 1.82, 0.06], [0.1, 0, 0], [0.068, 0.22, 0.068]);
        for (const s of [-1, 1]) {
          addPart(group, geo.curvedHorn, detailMat, [s * 0.19, 1.72, 0.08], [0.28, 0, -s * 0.34], [0.18, 0.52, 0.18]);
          addPart(group, geo.dragonWing, accentMat, [s * 0.26, 1.06, -0.24], [0.16, s === -1 ? Math.PI + 0.24 : -0.24, s * 0.1], [0.78, 0.78, 0.78]);
          addPart(group, geo.wingArmStrut, bodyMat, [s * 0.26, 1.06, -0.24], [0.16, s === -1 ? Math.PI + 0.24 : -0.24, s * 0.1], [0.78, 0.78, 0.78]);
          addBentArm(group, s, bodyMat, bodyMat, whiteMat, [s * 0.44, 0.94, 0.08], [s * 0.62, 0.82, 0.2], [s * 0.52, 0.66, 0.34], 0.1, true);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, whiteMat, [s * 0.31, 0.4, 0.02], [s * 0.34, 0.22, 0.12], [s * 0.3, 0.08, 0.06], 0.135, true);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.46, -0.74], [-0.95, 0, 0], [0.26, 0.78, 0.26]);
        break;
      }

      case 'gyarados': {
        // #130 Gyarados: twist-free sea serpent with ventral cream plates, roaring red-rimmed jaw, 3-prong crest & barbels
        const gyaraTex = getSerpentBodyTexture('gyarados', bodyHex, bellyHex, accentHex, detailHex);
        const gyaraMat = getTexturedMat(gyaraTex, `gyara_v2_${bodyHex}_${bellyHex}`, 0.52);
        addPart(group, geo.serpentCoil, gyaraMat, [0, 0.18, 0], [0, 0, 0], [1.14, 1.08, 1.14]);
        for (let i = 0; i < 4; i++) {
          addPart(group, geo.finBlade, whiteMat, [0, 1.24 - i * 0.26, -0.22 - i * 0.12], [-0.4, Math.PI * 0.5, 0], [0.42, 0.46, 0.42]);
        }
        addPaintedHead([0, 1.54, 0.14], [0.44, 0.39, 0.46], [0, 0, 0], geo.headDragon);
        // Roaring lower jaw & open crimson mouth interior
        addPart(group, geo.capsule, detailMat, [0, 1.32, 0.4], [Math.PI * 0.56, 0, 0], [0.2, 0.22, 0.08]);
        addPart(group, geo.capsule, bodyMat, [0, 1.25, 0.42], [Math.PI * 0.62, 0, 0], [0.24, 0.26, 0.12]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, whiteMat, [s * 0.15, 1.35, 0.6], [0, 0, 0], [0.048, 0.13, 0.048]);
          addPart(group, geo.cone, whiteMat, [s * 0.13, 1.33, 0.6], [Math.PI, 0, 0], [0.044, 0.1, 0.044]);
          addPart(group, geo.finBlade, bodyMat, [s * 0.28, 1.88, 0.04], [0, s === -1 ? Math.PI : 0, -s * 0.35], [0.58, 0.66, 0.58]);
          addPart(group, geo.curvedHorn, bellyMat, [s * 0.36, 1.32, 0.36], [0.55, s * 0.7, -s * 1.1], [0.16, 0.55, 0.16]);
        }
        addPart(group, geo.finBlade, bodyMat, [0, 1.96, 0.06], [0, Math.PI * 0.5, 0], [0.6, 0.74, 0.6]);
        addPart(group, geo.finBlade, whiteMat, [-0.22, 0.84, -0.84], [-0.4, 0.2, 0.4], [0.7, 0.7, 0.7]);
        break;
      }

      case 'rayquaza': {
        // #384 Rayquaza: twist-free emerald sky serpent with gold rings, 4 swept dragon horns, red jaw trim & clawed arms
        const rayTex = getSerpentBodyTexture('rayquaza', bodyHex, bellyHex, accentHex, detailHex);
        const rayMat = getTexturedMat(rayTex, `ray_v2_${bodyHex}_${accentHex}_${detailHex}`, 0.48);
        addPart(group, geo.serpentCoil, rayMat, [0, 0.2, 0], [0, 0, 0], [1.12, 1.12, 1.12]);
        addPaintedHead([0, 1.56, 0.14], [0.4, 0.32, 0.5], [0, 0, 0], geo.headDragon);
        addPart(group, geo.capsule, bodyMat, [0, 1.36, 0.48], [Math.PI * 0.54, 0, 0], [0.22, 0.28, 0.11]);
        for (const s of [-1, 1]) {
          // Upper & lower swept dragon horns
          addPart(group, geo.finBlade, bodyMat, [s * 0.24, 1.8, -0.1], [-0.65, s === -1 ? Math.PI : 0, -s * 0.28], [0.85, 0.58, 0.58]);
          addPart(group, geo.finBlade, bodyMat, [s * 0.3, 1.46, -0.06], [-0.4, s === -1 ? Math.PI : 0, -s * 0.75], [0.68, 0.42, 0.48]);
          addPart(group, geo.finBlade, bodyMat, [s * 0.3, 1.06, -0.06], [0.1, s === -1 ? Math.PI : 0, -s * 0.6], [0.68, 0.52, 0.52]);
          addBentArm(group, s, bodyMat, bodyMat, whiteMat, [s * 0.22, 1.1, 0.1], [s * 0.36, 1.0, 0.26], [s * 0.3, 0.9, 0.38], 0.056, true);
        }
        addPart(group, geo.finBlade, detailMat, [-0.22, 0.82, -0.86], [-0.35, 0.2, 0.3], [0.74, 0.74, 0.74]);
        break;
      }

      case 'gardevoir': {
        // Gardevoir: seamless continuous flared gown, sweeping green hair curls, red chest horns & arms
        addPart(group, geo.gardevoirGown, whiteMat, [0, 0.0, 0], [0, 0, 0], [0.95, 1.02, 0.95]);
        addPart(group, geo.gardevoirGown, accentMat, [0, 0.0, 0.04], [0, 0, 0], [0.72, 0.76, 0.72]);
        addPart(group, geo.torsoAthletic, whiteMat, [0, 0.98, 0], [0, 0, 0], [0.24, 0.26, 0.2]);
        addPart(group, geo.finBlade, detailMat, [0, 0.96, 0.22], [0.4, Math.PI * 0.5, 0], [0.44, 0.52, 0.44]);
        addPart(group, geo.finBlade, detailMat, [0, 1.0, -0.22], [-0.4, -Math.PI * 0.5, 0], [0.38, 0.46, 0.38]);
        addPart(group, geo.cyl, whiteMat, [0, 1.24, 0.02], [0.04, 0, 0], [0.11, 0.2, 0.11]);
        addPaintedHead([0, 1.44, 0.05], [0.36, 0.4, 0.38], [0, 0, 0], geo.headHuman);
        addPart(group, geo.hemi, accentMat, [0, 1.48, -0.02], [-0.26, 0, 0], [0.38, 0.36, 0.4]);
        for (const s of [-1, 1]) {
          addPart(group, geo.curvedHorn, accentMat, [s * 0.25, 1.38, 0.08], [0.3, 0, s * 0.38], [0.34, 0.62, 0.34]);
          addBentArm(group, s, accentMat, whiteMat, whiteMat, [s * 0.24, 1.12, 0.02], [s * 0.4, 0.92, 0.08], [s * 0.34, 0.72, 0.26], 0.052, false);
        }
        break;
      }

      case 'mimikyu': {
        addPart(group, geo.cone, bodyMat, [0, 0.56, 0], [0, 0, 0], [0.76, 0.92, 0.76]);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          addPart(group, geo.cone, bodyMat, [Math.cos(a) * 0.34, 0.16, Math.sin(a) * 0.34], [Math.sin(a) * 0.26, 0, -Math.cos(a) * 0.26], [0.26, 0.28, 0.26]);
        }
        addPart(group, geo.sphereLow, darkMat, [0, 0.08, 0], [0, 0, 0], [0.22, 0.07, 0.22]);
        for (const s of [-1, 1]) {
          addPart(group, geo.sphereLow, whiteMat, [s * 0.07, 0.13, 0.27], [0, 0, 0], [0.026, 0.032, 0.018]);
        }
        const headTilt = new THREE.Group();
        headTilt.position.set(0.05, 1.2, 0.06);
        headTilt.rotation.z = -0.24;
        addPart(headTilt, geo.headFlatWide, headMat, [0, 0, 0], [0, 0, 0], [0.42, 0.44, 0.42]);
        addPart(headTilt, geo.capsule, bodyMat, [-0.22, 0.56, 0], [0, 0, 0.35], [0.18, 0.38, 0.18]);
        addPart(headTilt, geo.cone, accentMat, [-0.34, 0.82, 0], [0, 0, 0.35], [0.14, 0.22, 0.14]);
        addPart(headTilt, geo.capsule, bodyMat, [0.34, 0.34, 0], [0, 0, -1.1], [0.18, 0.36, 0.18]);
        addPart(headTilt, geo.cone, accentMat, [0.54, 0.26, 0], [0, 0, -1.1], [0.14, 0.22, 0.14]);
        group.add(headTilt);
        addPart(group, geo.lightningTail, detailMat, [-0.46, 0.58, -0.34], [-0.25, -0.45, 0.45], [0.74, 0.74, 0.74]);
        break;
      }

      case 'arcanine': {
        // #059 Arcanine: continuous canine snout + black nose tip, lush cream chest/head/leg fur, tiger stripes
        const tigerTex = getTigerStripeTexture(bodyHex, accentHex);
        const tigerMat = getTexturedMat(tigerTex, `tiger_${bodyHex}_${accentHex}`, 0.56);

        addPart(group, geo.torsoQuadruped, tigerMat, [0, 0.66, -0.1], [-0.08, 0, 0], [0.74, 0.68, 0.66]);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          addPart(group, geo.sphereLow, bellyMat, [Math.cos(a) * 0.38, 1.06 + Math.abs(Math.sin(a)) * 0.08, 0.22 + Math.sin(a) * 0.32], [0, 0, 0], [0.22, 0.25, 0.22]);
        }
        addPart(group, geo.sphere, bellyMat, [0, 0.78, 0.38], [0, 0, 0], [0.38, 0.38, 0.26]);
        addPaintedHead([0, 1.34, 0.3], [0.4, 0.39, 0.44], [0, 0, 0], geo.headCanine);
        addPart(group, geo.sphereLow, bellyMat, [0, 1.64, 0.34], [0.2, 0, 0], [0.24, 0.18, 0.2]);
        addPart(group, geo.sphereLow, darkMat, [0, 1.28, 0.82], [0, 0, 0], [0.05, 0.042, 0.042]);
        for (const s of [-1, 1]) {
          addPart(group, geo.capsule, bodyMat, [s * 0.26, 1.72, 0.22], [0, 0, -s * 0.42], [0.2, 0.32, 0.11]);
          addPart(group, geo.capsule, bellyMat, [s * 0.26, 1.7, 0.26], [0, 0, -s * 0.42], [0.12, 0.22, 0.07]);
        }
        addQuadrupedStance(group, tigerMat, bodyMat, darkMat, 0.25, 0.24, -0.44, 0.54, 0.12, true);
        for (const s of [-1, 1]) {
          addPart(group, geo.sphereLow, bellyMat, [s * 0.25, 0.38, 0.16], [0, 0, 0], [0.15, 0.13, 0.17]);
          addPart(group, geo.sphereLow, bellyMat, [s * 0.26, 0.38, -0.52], [0, 0, 0], [0.15, 0.13, 0.17]);
        }
        addPart(group, geo.eeveeTail, bellyMat, [0, 0.94, -0.78], [-0.5, 0, 0], [1.05, 1.05, 1.05]);
        break;
      }

      case 'tyranitar': {
        // Tyranitar: armored Godzilla silhouette with iconic sky-blue diamond belly shield & dorsal spikes
        const slatePlateMat = getStdMat('#334155', 0.54, 0.08);
        addPart(group, geo.torsoDragon, bodyMat, [0, 0.7, -0.04], [0, 0, 0], [0.64, 0.62, 0.62]);
        addPart(group, geo.octa, accentMat, [0, 0.68, 0.45], [-0.14, 0, 0], [0.3, 0.42, 0.13]);
        addPart(group, geo.octa, slatePlateMat, [0, 0.68, 0.41], [-0.14, 0, 0], [0.36, 0.48, 0.1]);
        for (const s of [-1, 1]) {
          addPart(group, geo.sphereLow, detailMat, [s * 0.24, 0.96, 0.38], [0, 0, 0], [0.09, 0.11, 0.06]);
        }
        addPart(group, geo.cyl, bodyMat, [0, 1.2, 0.04], [0.14, 0, 0], [0.34, 0.28, 0.32]);
        addPaintedHead([0, 1.44, 0.12], [0.42, 0.41, 0.45], [0, 0, 0], geo.headDragon);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.2, 1.86, 0.02], [-0.25, 0, -s * 0.25], [0.14, 0.42, 0.14]);
          addBentArm(group, s, bodyMat, bodyMat, whiteMat, [s * 0.46, 0.98, 0.08], [s * 0.64, 0.84, 0.18], [s * 0.56, 0.7, 0.36], 0.11, true);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, whiteMat, [s * 0.34, 0.44, 0.0], [s * 0.38, 0.24, 0.12], [s * 0.34, 0.08, 0.08], 0.15, true);
        }
        for (let i = 0; i < 4; i++) {
          addPart(group, geo.cone, detailMat, [0, 1.86 - i * 0.34, -0.06 - i * 0.24], [-0.45, 0, 0], [0.16, 0.4, 0.16]);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.44, -0.78], [-1.02, 0, 0], [0.28, 0.82, 0.28]);
        break;
      }

      case 'metagross': {
        // #376 Metagross: wide flattened steel saucer hull, flush metallic X face cross & 4 heavy articulated spider-crab legs
        addPart(group, geo.headFlatWide, headMat, [0, 0.86, 0.02], [0, 0, 0], [0.88, 0.46, 0.82]);
        addPart(group, geo.box, silverMat, [0, 0.88, 0.68], [-0.12, 0, 0.62], [0.76, 0.12, 0.1]);
        addPart(group, geo.box, silverMat, [0, 0.88, 0.68], [-0.12, 0, -0.62], [0.76, 0.12, 0.1]);
        addPart(group, geo.sphereLow, silverMat, [0, 0.88, 0.72], [0, 0, 0], [0.12, 0.12, 0.06]);
        for (const [lx, lz] of [[-0.68, 0.46], [0.68, 0.46], [-0.68, -0.46], [0.68, -0.46]]) {
          const sx = Math.sign(lx);
          addPart(group, geo.sphereLow, silverMat, [lx * 0.82, 0.64, lz * 0.82], [0, 0, 0], [0.21, 0.21, 0.21]);
          addPart(group, geo.cyl, bodyMat, [lx * 1.02, 0.34, lz * 0.98], [0, 0, sx * -0.22], [0.3, 0.6, 0.3]);
          addPart(group, geo.cyl, silverMat, [lx * 1.12, 0.1, lz * 1.06], [0, 0, 0], [0.33, 0.18, 0.33]);
          for (const c of [-1, 0, 1]) {
            addPart(group, geo.cone, silverMat, [lx * 1.12 + c * 0.08, 0.04, lz * 1.06 + 0.18], [Math.PI * 0.45, 0, 0], [0.058, 0.14, 0.058]);
          }
        }
        break;
      }

      case 'salamence': {
        // #373 Salamence: low-slung dragon with broad red 3-lobed wings, armored belly plates & sweeping cheek fins
        const bellyTex = getScaleBellyTexture(bellyHex, '#64748b');
        const scaleBellyMat = getTexturedMat(bellyTex, `scalebelly_${bellyHex}`, 0.54);
        addPart(group, geo.torsoQuadruped, bodyMat, [0, 0.62, -0.08], [-0.08, 0, 0], [0.7, 0.6, 0.58]);
        addPart(group, geo.sphere, scaleBellyMat, [0, 0.44, 0.04], [0, 0, 0], [0.46, 0.26, 0.52]);
        addPart(group, geo.cyl, bodyMat, [0, 1.0, 0.32], [0.36, 0, 0], [0.25, 0.48, 0.25]);
        addPaintedHead([0, 1.32, 0.42], [0.43, 0.38, 0.47], [0, 0, 0], geo.headDragon);
        for (const s of [-1, 1]) {
          addPart(group, geo.crescentWing, accentMat, [s * 0.32, 0.96, -0.16], [0.28, s === -1 ? Math.PI + 0.12 : -0.12, s * 0.18], [1.28, 1.22, 1.18]);
          for (let h = 0; h < 3; h++) {
            addPart(group, geo.finBlade, accentMat, [s * 0.36, 1.4 - h * 0.09, 0.3 - h * 0.06], [0.1, s === -1 ? Math.PI : 0, -s * (0.2 + h * 0.14)], [0.58, 0.34, 0.42]);
          }
        }
        addQuadrupedStance(group, bodyMat, bodyMat, whiteMat, 0.28, 0.22, -0.36, 0.48, 0.13, true);
        addPart(group, geo.cone, bodyMat, [0, 0.52, -0.78], [-1.05, 0, 0], [0.24, 0.76, 0.24]);
        break;
      }

      case 'garchomp': {
        // #445 Garchomp: sleek land-shark with bold hammerhead jet pods, red chest stripe + yellow star, arm scythes & dorsal fin
        addPart(group, geo.torsoDragon, bodyMat, [0, 0.7, -0.02], [0.06, 0, 0], [0.46, 0.54, 0.46]);
        addPart(group, geo.box, accentMat, [0, 0.74, 0.28], [0, 0, 0], [0.34, 0.42, 0.22]);
        addPart(group, geo.octa, bellyMat, [0, 0.82, 0.42], [0, 0, 0], [0.17, 0.19, 0.07]);
        addPart(group, geo.cyl, bodyMat, [0, 1.2, 0.06], [0.12, 0, 0], [0.24, 0.24, 0.24]);
        addPaintedHead([0, 1.4, 0.14], [0.4, 0.36, 0.46], [0, 0, 0], geo.headDragon);
        addPart(group, geo.sphereLow, accentMat, [0, 1.24, 0.5], [0, 0, 0], [0.19, 0.1, 0.23]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cyl, bodyMat, [s * 0.44, 1.44, 0.08], [0, 0, s * Math.PI * 0.44], [0.18, 0.52, 0.18]);
          addPart(group, geo.cone, bodyMat, [s * 0.72, 1.49, 0.08], [0, 0, -s * Math.PI * 0.44], [0.18, 0.26, 0.18]);
          addPart(group, geo.torus, bellyMat, [s * 0.56, 1.46, 0.08], [0, Math.PI * 0.5, 0], [0.18, 0.18, 0.09]);
          addBentArm(group, s, bodyMat, bodyMat, whiteMat, [s * 0.34, 0.98, 0.08], [s * 0.54, 0.84, 0.16], [s * 0.62, 0.7, 0.32], 0.095, true);
          addPart(group, geo.finBlade, bodyMat, [s * 0.56, 0.82, 0.08], [0, s === -1 ? Math.PI : 0, -s * 0.6], [0.68, 0.48, 0.5]);
          addPart(group, geo.cone, whiteMat, [s * 0.72, 0.88, 0.18], [0, 0, -s * 0.9], [0.055, 0.18, 0.055]);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, whiteMat, [s * 0.26, 0.44, 0.0], [s * 0.3, 0.26, 0.12], [s * 0.26, 0.08, 0.08], 0.12, true);
        }
        addPart(group, geo.finBlade, bodyMat, [0, 1.08, -0.4], [-0.45, Math.PI * 0.5, 0], [0.68, 0.78, 0.68]);
        addPart(group, geo.cone, bodyMat, [0, 0.46, -0.66], [-0.95, 0, 0], [0.22, 0.68, 0.22]);
        addPart(group, geo.finBlade, bodyMat, [0, 0.64, -0.94], [-0.3, Math.PI * 0.5, 0], [0.54, 0.6, 0.54]);
        break;
      }

      case 'togepi': {
        const eggTex = getEggShellPatternTexture(accentHex, bellyHex, detailHex);
        const eggMat = getTexturedMat(eggTex, `eggshell_${accentHex}_${bellyHex}_${detailHex}`, 0.52);
        addPart(group, geo.sphere, eggMat, [0, 0.54, 0], [0, 0, 0], [0.56, 0.52, 0.56]);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          addPart(group, geo.cone, accentMat, [Math.cos(a) * 0.46, 0.76, Math.sin(a) * 0.46], [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25], [0.16, 0.24, 0.16]);
        }
        addPaintedHead([0, 1.16, 0.06], [0.43, 0.42, 0.42], [0, 0, 0], geo.headHuman);
        for (let i = -2; i <= 2; i++) {
          addPart(group, geo.cone, bodyMat, [i * 0.13, 1.62, 0.04], [0, 0, -i * 0.24], [0.11, 0.3, 0.11]);
        }
        for (const s of [-1, 1]) {
          addSculptedArm(group, s, bodyMat, bodyMat, [s * 0.5, 0.72, 0.1], [0.2, 0, -s * 0.68], [0.4, 0.42, 0.4], false);
          addSculptedFoot(group, s, bodyMat, bodyMat, [s * 0.24, 0.1, 0.08], [0.46, 0.36, 0.5], false);
        }
        break;
      }

      case 'jigglypuff': {
        // #039 Jigglypuff: smooth round pink body, big teal eyes, curled forehead tuft, triangular dark-hollowed ears
        addPart(group, geo.headSphere, headMat, [0, 0.82, 0], [0, 0, 0], [0.78, 0.75, 0.76]);
        addPart(group, geo.torusHalf, accentMat, [0, 1.52, 0.36], [0.22, 0, 0.35], [0.22, 0.22, 0.4]);
        addPart(group, geo.sphereLow, accentMat, [0.06, 1.52, 0.44], [0, 0, 0], [0.13, 0.13, 0.13]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.5, 1.44, 0.04], [0, 0, -s * 0.65], [0.34, 0.46, 0.26]);
          addPart(group, geo.cone, darkMat, [s * 0.48, 1.42, 0.14], [0, 0, -s * 0.65], [0.19, 0.3, 0.12]);
          addSculptedArm(group, s, bodyMat, bodyMat, [s * 0.72, 0.8, 0.16], [0.3, 0, -s * 0.85], [0.38, 0.4, 0.38], false);
          addSculptedFoot(group, s, bodyMat, bodyMat, [s * 0.3, 0.1, 0.12], [0.48, 0.35, 0.56], false);
        }
        break;
      }

      case 'psyduck': {
        // #054 Psyduck: plump yellow duck, wide cream bill with 2 nostrils, 3 head hairs, wide vacant eyes
        addPart(group, geo.torsoAvian, bodyMat, [0, 0.6, 0], [0.08, 0, 0], [0.58, 0.5, 0.56]);
        addPart(group, geo.cyl, bodyMat, [0, 1.02, 0.04], [0, 0, 0], [0.28, 0.16, 0.26]);
        addPaintedHead([0, 1.28, 0.06], [0.44, 0.42, 0.44], [0, 0, 0], geo.headAvian);
        addPart(group, geo.sphereLow, accentMat, [0, 1.14, 0.54], [0, 0, 0], [0.38, 0.11, 0.34]);
        for (const s of [-1, 1]) {
          addPart(group, geo.sphereLow, darkMat, [s * 0.08, 1.22, 0.74], [0, 0, 0], [0.025, 0.02, 0.03]);
        }
        for (let i = -1; i <= 1; i++) {
          addPart(group, geo.cyl, detailMat, [i * 0.08, 1.76, 0.04], [0, 0, -i * 0.25], [0.026, 0.28, 0.026]);
        }
        for (const s of [-1, 1]) {
          addSculptedArm(group, s, bodyMat, bodyMat, [s * 0.48, 0.88, 0.14], [0.35, 0, -s * 0.42], [0.44, 0.48, 0.44], true);
          addSculptedFoot(group, s, accentMat, accentMat, [s * 0.26, 0.12, 0.08], [0.58, 0.4, 0.68], true);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.38, -0.62], [-1.05, 0, 0], [0.16, 0.38, 0.16]);
        break;
      }

      case 'meowth': {
        // #052 Meowth: rounded cream cat cheeks, flush gold koban coin, whiskers, brown-tipped ears, tail & feet
        addPart(group, geo.pearTorso, bodyMat, [0, 0.64, 0], [0, 0, 0], [0.34, 0.36, 0.32]);
        addPart(group, geo.cyl, bodyMat, [0, 0.98, 0.04], [0, 0, 0], [0.18, 0.16, 0.18]);
        addPaintedHead([0, 1.24, 0.08], [0.46, 0.39, 0.4], [0, 0, 0], geo.headFlatWide);
        addPart(group, geo.cyl, goldMat, [0, 1.42, 0.42], [Math.PI * 0.45, 0, 0], [0.14, 0.036, 0.18]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, detailMat, [s * 0.38, 1.58, 0.06], [0, 0, -s * 0.56], [0.22, 0.4, 0.18]);
          for (let w = -1; w <= 1; w++) {
            addPart(group, geo.cyl, detailMat, [s * 0.48, 1.2 + w * 0.045, 0.24], [0, 0, Math.PI * 0.5 - s * (w * 0.18)], [0.014, 0.16, 0.014]);
          }
          addBentArm(group, s, bodyMat, bodyMat, bodyMat, [s * 0.28, 0.84, 0.04], [s * 0.42, 0.72, 0.12], [s * 0.36, 0.58, 0.24], 0.072, true);
          addMuscularLeg(group, s, bodyMat, bodyMat, detailMat, bodyMat, [s * 0.18, 0.38, 0.02], [s * 0.22, 0.22, 0.08], [s * 0.2, 0.08, 0.06], 0.085, true);
        }
        addPart(group, geo.meowthTail, detailMat, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
        addPart(group, geo.sphereLow, detailMat, [0, 0.98, -0.35], [0, 0, 0], [0.09, 0.09, 0.09]);
        break;
      }

      case 'machamp': {
        // #068 Machamp: smooth broad-jawed headHeroic, 3 sculpted head crests, 4 muscular arms & championship belt
        addPart(group, geo.torsoHeroic, bodyMat, [0, 0.82, 0], [0, 0, 0], [0.56, 0.48, 0.48]);
        addPart(group, geo.cyl, detailMat, [0, 0.44, 0], [0, 0, 0], [0.66, 0.18, 0.46]);
        addPart(group, geo.torus, goldMat, [0, 0.52, 0], [Math.PI * 0.5, 0, 0], [0.68, 0.44, 0.24]);
        addPart(group, geo.box, goldMat, [0, 0.52, 0.27], [0, 0, 0], [0.18, 0.14, 0.07]);
        addPart(group, geo.cyl, bodyMat, [0, 1.24, 0.04], [0, 0, 0], [0.24, 0.18, 0.24]);
        addPaintedHead([0, 1.44, 0.08], [0.39, 0.41, 0.39], [0, 0, 0], geo.headHeroic);
        for (let i = -1; i <= 1; i++) {
          addPart(group, geo.finBlade, bellyMat, [i * 0.11, 1.76, -0.02], [-0.15, Math.PI * 0.5, -i * 0.16], [0.54, 0.48, 0.42]);
        }
        for (const s of [-1, 1]) {
          addBentArm(group, s, bodyMat, bodyMat, bodyMat, [s * 0.48, 1.12, 0.04], [s * 0.78, 1.28, 0.08], [s * 0.74, 1.54, 0.22], 0.115, true);
          addBentArm(group, s, bodyMat, bodyMat, bodyMat, [s * 0.44, 0.88, 0.06], [s * 0.72, 0.74, 0.16], [s * 0.64, 0.58, 0.36], 0.11, true);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, bodyMat, [s * 0.24, 0.42, 0.0], [s * 0.3, 0.24, 0.1], [s * 0.28, 0.08, 0.06], 0.13, true);
        }
        break;
      }

      case 'alakazam': {
        // #065 Alakazam: angular fox skull, cheek spikes, tidy swept-down mustache, brown shoulder/chest plates & twin spoons
        addPart(group, geo.torsoAthletic, bodyMat, [0, 0.72, 0], [0, 0, 0], [0.36, 0.4, 0.34]);
        addPart(group, geo.sphere, accentMat, [0, 0.9, 0.06], [0, 0, 0], [0.42, 0.24, 0.34]);
        addPart(group, geo.cyl, bodyMat, [0, 1.14, 0.04], [0, 0, 0], [0.16, 0.18, 0.16]);
        addPaintedHead([0, 1.36, 0.08], [0.38, 0.37, 0.42], [0, 0, 0], geo.headCanine);
        addPart(group, geo.octa, getStdMat('#dc2626', 0.34), [0, 1.5, 0.42], [0, 0, 0], [0.08, 0.08, 0.04]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.22, 1.82, 0.06], [0, 0, -s * 0.24], [0.11, 0.5, 0.11]);
          addPart(group, geo.cone, bodyMat, [s * 0.34, 1.3, 0.16], [0.1, 0, -s * 1.1], [0.09, 0.24, 0.09]);
          // Tidy swept-down mustache tucked cleanly under snout
          addPart(group, geo.curvedMustache, bellyMat, [s * 0.05, 1.24, 0.5], [0.22, s === -1 ? Math.PI - 0.15 : 0.15, -s * 0.25], [0.72, 0.72, s * 0.72]);
          addBentArm(group, s, bodyMat, bodyMat, bodyMat, [s * 0.32, 0.96, 0.04], [s * 0.52, 0.8, 0.14], [s * 0.62, 0.72, 0.28], 0.075, true);
          addPart(group, geo.cyl, accentMat, [s * 0.57, 0.76, 0.21], [0.4, 0, -s * 0.6], [0.14, 0.2, 0.14]);
          addPart(group, geo.cyl, silverMat, [s * 0.64, 0.92, 0.32], [0, 0, 0], [0.025, 0.48, 0.025]);
          addPart(group, geo.sphereLow, silverMat, [s * 0.64, 1.19, 0.32], [0, 0, 0], [0.09, 0.14, 0.048]);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, bodyMat, [s * 0.2, 0.42, 0.02], [s * 0.26, 0.24, 0.1], [s * 0.22, 0.08, 0.06], 0.09, true);
        }
        break;
      }

      case 'lapras': {
        // #131 Lapras: smooth curved cream neck/chest, spotted carapace with rounded knobs, continuous dragon snout & 4 flippers
        const caraTex = getCarapaceTexture(accentHex);
        const caraMat = getTexturedMat(caraTex, `cara_${accentHex}`, 0.52);
        addPart(group, geo.torsoQuadruped, bodyMat, [0, 0.44, -0.06], [0, 0, 0], [0.92, 0.64, 0.74]);
        addPart(group, geo.sphere, bellyMat, [0, 0.4, 0.28], [0, 0, 0], [0.5, 0.32, 0.52]);
        addPart(group, geo.sphere, caraMat, [0, 0.68, -0.14], [0, 0, 0], [0.58, 0.46, 0.64]);
        for (const [kx, ky, kz] of [[0, 1.12, -0.14], [-0.3, 0.94, 0.08], [0.3, 0.94, 0.08], [-0.32, 0.94, -0.34], [0.32, 0.94, -0.34], [0, 0.92, -0.58]]) {
          addPart(group, geo.sphereLow, accentMat, [kx, ky, kz], [0, 0, 0], [0.14, 0.14, 0.14]);
        }
        addPart(group, geo.cyl, bodyMat, [0, 0.98, 0.36], [0.24, 0, 0], [0.24, 0.76, 0.24]);
        addPart(group, geo.sphere, bellyMat, [0, 0.96, 0.48], [0.24, 0, 0], [0.15, 0.34, 0.1]);
        addPaintedHead([0, 1.44, 0.44], [0.36, 0.34, 0.4], [0, 0, 0], geo.headDragon);
        addPart(group, geo.cone, detailMat, [0, 1.78, 0.5], [0, 0, 0], [0.09, 0.26, 0.09]);
        for (const s of [-1, 1]) {
          addPart(group, geo.torus, bodyMat, [s * 0.32, 1.46, 0.4], [0, Math.PI * 0.5, 0], [0.12, 0.12, 0.22]);
          addPart(group, geo.leafBlade, bodyMat, [s * 0.48, 0.16, 0.34], [0.1, s === -1 ? Math.PI - 0.3 : 0.3, -0.12], [0.76, 0.76, 0.76]);
          addPart(group, geo.leafBlade, bodyMat, [s * 0.46, 0.14, -0.34], [0.1, s === -1 ? Math.PI + 0.35 : -0.35, -0.1], [0.54, 0.54, 0.54]);
        }
        break;
      }

      case 'ditto': {
        // #132 Ditto: single organic wavy melted-skirt blob with small dot eyes & simple smile
        addPart(group, geo.dittoBlob, headMat, [0, 0.02, 0], [0, 0, 0], [0.9, 1.0, 0.9]);
        for (const s of [-1, 1]) {
          addPart(group, geo.sphereLow, bodyMat, [s * 0.76, 0.62, 0.06], [0, 0, -s * 0.42], [0.26, 0.16, 0.18]);
        }
        break;
      }

      case 'aerodactyl': {
        // #142 Aerodactyl: sleek pterosaur with continuous long toothed snout, twin horns & bone wing edges
        addPart(group, geo.torsoAvian, bodyMat, [0, 0.72, 0], [0.2, 0, 0], [0.42, 0.48, 0.42]);
        addPart(group, geo.cyl, bodyMat, [0, 1.14, 0.1], [0.24, 0, 0], [0.18, 0.24, 0.18]);
        addPaintedHead([0, 1.34, 0.16], [0.36, 0.33, 0.46], [0, 0, 0], geo.headDragon);
        for (const s of [-1, 1]) {
          for (let t = 0; t < 2; t++) {
            addPart(group, geo.cone, whiteMat, [s * 0.11, 1.2, 0.52 + t * 0.16], [Math.PI, 0, 0], [0.035, 0.09, 0.035]);
          }
          addPart(group, geo.cone, bodyMat, [s * 0.15, 1.72, -0.12], [-0.65, 0, -s * 0.2], [0.11, 0.52, 0.11]);
          addPart(group, geo.dragonWing, accentMat, [s * 0.26, 1.04, -0.14], [0.16, s === -1 ? Math.PI + 0.12 : -0.12, s * 0.12], [1.2, 1.2, 1.2]);
          addPart(group, geo.wingArmStrut, bodyMat, [s * 0.26, 1.04, -0.14], [0.16, s === -1 ? Math.PI + 0.12 : -0.12, s * 0.12], [1.2, 1.2, 1.2]);
          addPart(group, geo.cone, whiteMat, [s * 1.18, 1.56, -0.22], [0, 0, -s * 0.35], [0.06, 0.18, 0.06]);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.44, -0.68], [-1.05, 0, 0], [0.14, 0.68, 0.14]);
        addPart(group, geo.octa, bodyMat, [0, 0.72, -1.04], [0.3, 0, 0], [0.24, 0.08, 0.28]);
        addBirdTalons(group, bodyMat, 0.22, 0.04);
        break;
      }

      case 'articuno': {
        // #144 Articuno: sleek ice phoenix with fluffy pale-blue chest shield, 3-feathered royal crest, sweeping wings & ribbon tail
        addPart(group, geo.torsoAvian, bodyMat, [0, 0.72, 0], [0.16, 0, 0], [0.44, 0.48, 0.42]);
        addPart(group, geo.sphere, bellyMat, [0, 0.78, 0.23], [0, 0, 0], [0.34, 0.38, 0.22]);
        addPart(group, geo.cyl, bodyMat, [0, 1.16, 0.04], [0.14, 0, 0], [0.18, 0.28, 0.18]);
        addPaintedHead([0, 1.4, 0.08], [0.42, 0.4, 0.45], [0, 0, 0], geo.headAvian);
        addPart(group, geo.cone, getStdMat('#475569', 0.48), [0, 1.32, 0.52], [Math.PI * 0.54, 0, 0], [0.11, 0.3, 0.11]);
        for (let i = -1; i <= 1; i++) {
          addPart(group, geo.finBlade, accentMat, [i * 0.11, 1.82, 0.0], [-0.25, Math.PI * 0.5, -i * 0.25], [0.64, 0.84, 0.56]);
        }
        for (const s of [-1, 1]) {
          addPart(group, geo.birdWing, bodyMat, [s * 0.28, 1.04, -0.1], [0.16, s === -1 ? Math.PI + 0.12 : -0.12, s * 0.18], [1.28, 1.22, 1.18]);
        }
        addPart(group, geo.ribbonTail, accentMat, [0, 0.3, -0.14], [-0.14, 0.38, 0], [1.16, 1.16, 1.16]);
        addBirdTalons(group, getStdMat('#64748b', 0.5), 0.2, 0.04);
        break;
      }

      case 'moltres': {
        // #146 Moltres: fiery crane-phoenix with sleek amber body, swept-back flame crest, blazing double wings & flame tail
        addPart(group, geo.torsoAvian, bodyMat, [0, 0.72, 0], [0.16, 0, 0], [0.42, 0.48, 0.42]);
        addPart(group, geo.sphere, bellyMat, [0, 0.74, 0.23], [0, 0, 0], [0.3, 0.34, 0.2]);
        addPart(group, geo.cyl, bodyMat, [0, 1.16, 0.04], [0.16, 0, 0], [0.17, 0.3, 0.17]);
        addPaintedHead([0, 1.42, 0.08], [0.35, 0.35, 0.39], [0, 0, 0], geo.headAvian);
        addPart(group, geo.cone, goldMat, [0, 1.34, 0.52], [Math.PI * 0.52, 0, 0], [0.095, 0.38, 0.095]);
        for (let i = -1; i <= 1; i++) {
          addPart(group, geo.cone, flameMat, [i * 0.1, 1.78, -0.1], [-0.62, 0, -i * 0.24], [0.14, 0.62, 0.14]);
        }
        for (const s of [-1, 1]) {
          addPart(group, geo.birdWing, flameMat, [s * 0.28, 1.04, -0.1], [0.16, s === -1 ? Math.PI + 0.12 : -0.12, s * 0.18], [1.24, 1.18, 1.16]);
          addPart(group, geo.birdWing, flameCoreMat, [s * 0.26, 0.98, -0.06], [0.16, s === -1 ? Math.PI + 0.12 : -0.12, s * 0.18], [0.84, 0.8, 0.78]);
        }
        for (let i = -1; i <= 1; i++) {
          addPart(group, geo.cone, flameMat, [i * 0.16, 0.54, -0.66], [-1.1, i * 0.18, 0], [0.18, 0.74, 0.18]);
        }
        addBirdTalons(group, detailMat, 0.22, 0.04);
        break;
      }

      case 'lugia': {
        addPart(group, geo.torsoAvian, bodyMat, [0, 0.7, -0.02], [0.12, 0, 0], [0.54, 0.56, 0.52]);
        addPart(group, geo.sphere, bellyMat, [0, 0.68, 0.28], [0, 0, 0], [0.36, 0.42, 0.24]);
        addPart(group, geo.cyl, bodyMat, [0, 1.18, 0.06], [0.16, 0, 0], [0.22, 0.48, 0.22]);
        addPaintedHead([0, 1.5, 0.14], [0.43, 0.4, 0.5], [0, 0, 0], geo.headDragon);
        addPart(group, geo.finBlade, bodyMat, [0, 1.78, -0.08], [-0.4, Math.PI * 0.5, 0], [0.6, 0.54, 0.58]);
        for (let i = 0; i < 4; i++) {
          addPart(group, geo.box, accentMat, [0, 1.14 - i * 0.2, -0.34 - i * 0.06], [-0.25, 0, 0], [0.1, 0.18, 0.24]);
        }
        for (const s of [-1, 1]) {
          addPart(group, geo.lugiaWing, bodyMat, [s * 0.3, 1.06, -0.12], [0.12, s === -1 ? Math.PI + 0.12 : -0.12, s * 0.14], [1.36, 1.32, 1.26]);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, bodyMat, [s * 0.26, 0.42, 0.0], [s * 0.3, 0.24, 0.1], [s * 0.26, 0.08, 0.08], 0.12, true);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.42, -0.74], [-1.05, 0, 0], [0.22, 0.76, 0.22]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, accentMat, [s * 0.1, 0.72, -1.04], [-0.7, 0, -s * 0.4], [0.11, 0.4, 0.11]);
        }
        break;
      }

      case 'ho-oh': {
        addPart(group, geo.torsoAvian, bodyMat, [0, 0.72, 0], [0.15, 0, 0], [0.5, 0.5, 0.48]);
        addPart(group, geo.sphere, bellyMat, [0, 0.62, 0.28], [0, 0, 0], [0.34, 0.36, 0.22]);
        addPart(group, geo.cyl, bodyMat, [0, 1.14, 0.04], [0.12, 0, 0], [0.22, 0.24, 0.22]);
        addPart(group, geo.torus, accentMat, [0, 1.1, 0.04], [Math.PI * 0.5, 0, 0], [0.34, 0.34, 0.26]);
        addPaintedHead([0, 1.38, 0.08], [0.38, 0.38, 0.41], [0, 0, 0], geo.headAvian);
        addPart(group, geo.cone, goldMat, [0, 1.3, 0.5], [Math.PI * 0.52, 0, 0], [0.11, 0.36, 0.11]);
        for (let i = -1; i <= 1; i++) {
          addPart(group, geo.finBlade, goldMat, [i * 0.1, 1.78, -0.02], [-0.2, Math.PI * 0.5, -i * 0.22], [0.48, 0.62, 0.48]);
        }
        for (const s of [-1, 1]) {
          addPart(group, geo.birdWing, bodyMat, [s * 0.32, 1.06, -0.14], [0.14, s === -1 ? Math.PI + 0.12 : -0.12, s * 0.14], [1.16, 1.16, 1.16]);
          addPart(group, geo.birdWing, accentMat, [s * 0.34, 0.94, -0.16], [0.14, s === -1 ? Math.PI + 0.12 : -0.12, s * 0.1], [0.95, 0.85, 0.95]);
          addPart(group, geo.birdWing, whiteMat, [s * 0.34, 0.82, -0.18], [0.14, s === -1 ? Math.PI + 0.12 : -0.12, s * 0.06], [0.76, 0.68, 0.76]);
        }
        for (let i = -2; i <= 2; i++) {
          addPart(group, geo.finBlade, goldMat, [i * 0.15, 0.54, -0.66], [-0.85, Math.PI * 0.5 + i * 0.15, 0], [0.68, 0.68, 0.68]);
        }
        addBirdTalons(group, goldMat, 0.22, 0.04);
        break;
      }

      case 'mewtwo': {
        // #150 Mewtwo: sleek pale lilac humanoid, continuous feline-humanoid head, neck tube, sternum, purple pelvis & bulbous thighs
        addPart(group, geo.torsoAthletic, bodyMat, [0, 0.84, 0], [0, 0, 0], [0.3, 0.36, 0.28]);
        addPart(group, geo.sphere, bodyMat, [0, 1.0, 0.06], [0, 0, 0], [0.28, 0.2, 0.25]);
        addPart(group, geo.sphere, accentMat, [0, 0.52, 0], [0, 0, 0], [0.32, 0.26, 0.3]);
        addPart(group, geo.cyl, bodyMat, [0, 1.2, 0.04], [0.06, 0, 0], [0.15, 0.16, 0.15]);
        addPaintedHead([0, 1.4, 0.08], [0.36, 0.38, 0.38], [0, 0, 0], geo.headCanine);
        addPart(group, geo.mewtwoTube, bodyMat, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.21, 1.78, -0.02], [-0.28, 0, -s * 0.26], [0.12, 0.34, 0.12]);
          addBentArm(group, s, bodyMat, bodyMat, bodyMat, [s * 0.26, 1.04, 0.04], [s * 0.44, 0.86, 0.12], [s * 0.38, 0.7, 0.32], 0.068, true);
          addPart(group, geo.sphereLow, bodyMat, [s * 0.21, 0.42, 0.04], [0, 0, 0], [0.17, 0.22, 0.17]);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, bodyMat, [s * 0.21, 0.44, 0.04], [s * 0.24, 0.26, 0.1], [s * 0.22, 0.08, 0.08], 0.088, true);
        }
        addPart(group, geo.mewtwoTail, accentMat, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
        addPart(group, geo.sphereLow, accentMat, [0.18, 1.26, -0.78], [0, 0, 0], [0.12, 0.12, 0.12]);
        break;
      }

      case 'cyndaquil': {
        // Cyndaquil: continuous pointed shrew snout, navy back, cream belly & blazing back flames
        addPart(group, geo.torsoQuadruped, bodyMat, [0, 0.56, -0.06], [-0.14, 0, 0], [0.64, 0.58, 0.54]);
        addPart(group, geo.sphere, bellyMat, [0, 0.46, 0.06], [0, 0, 0], [0.42, 0.3, 0.48]);
        addPaintedHead([0, 1.12, 0.28], [0.41, 0.39, 0.44], [0, 0, 0], geo.headShrew);
        for (let i = -2; i <= 2; i++) {
          const h = 0.78 - Math.abs(i) * 0.12;
          addPart(group, geo.cone, flameMat, [i * 0.2, 1.22, -0.26], [-0.45, 0, -i * 0.36], [0.22, h, 0.22]);
          addPart(group, geo.cone, flameCoreMat, [i * 0.16, 1.14, -0.22], [-0.45, 0, -i * 0.36], [0.12, h * 0.65, 0.12]);
        }
        addQuadrupedStance(group, bodyMat, bellyMat, bellyMat, 0.23, 0.22, -0.3, 0.42, 0.105, false);
        break;
      }

      case 'totodile': {
        // Totodile: cute plump crocodile with distinct protruding snout, red dorsal crests, crisp fangs & yellow chest V
        addPart(group, geo.torsoDragon, bodyMat, [0, 0.6, 0], [0, 0, 0], [0.5, 0.46, 0.48]);
        addPart(group, geo.cone, bellyMat, [0, 0.58, 0.38], [Math.PI, 0, 0], [0.36, 0.4, 0.14]);
        addPaintedHead([0, 1.24, 0.06], [0.37, 0.36, 0.56], [0, 0, 0], geo.headCroc);
        addPart(group, geo.capsule, bodyMat, [0, 1.15, 0.45], [Math.PI * 0.5, 0, 0], [0.31, 0.34, 0.13]);
        addPart(group, geo.capsule, bodyMat, [0, 1.0, 0.46], [Math.PI * 0.5, 0, 0], [0.3, 0.34, 0.11]);
        for (const s of [-1, 1]) {
          addPart(group, geo.sphereLow, accentMat, [s * 0.16, 1.43, 0.24], [0, 0, -s * 0.18], [0.095, 0.075, 0.11]);
          addPart(group, geo.sphereLow, darkMat, [s * 0.08, 1.21, 0.72], [0, 0, 0], [0.024, 0.022, 0.02]);
          addPart(group, geo.cone, whiteMat, [s * 0.14, 1.09, 0.68], [0.12, 0, 0], [0.044, 0.1, 0.044]);
          addPart(group, geo.cone, whiteMat, [s * 0.21, 1.09, 0.54], [0.12, 0, 0], [0.04, 0.09, 0.04]);
          addBentArm(group, s, bodyMat, bodyMat, whiteMat, [s * 0.36, 0.84, 0.08], [s * 0.52, 0.72, 0.18], [s * 0.44, 0.6, 0.34], 0.08, true);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, whiteMat, [s * 0.24, 0.36, 0.02], [s * 0.26, 0.2, 0.08], [s * 0.25, 0.08, 0.06], 0.11, true);
        }
        addPart(group, geo.cone, accentMat, [0, 1.5, -0.12], [-0.45, 0, 0], [0.14, 0.34, 0.14]);
        for (let i = 0; i < 3; i++) {
          addPart(group, geo.cone, accentMat, [0, 1.18 - i * 0.26, -0.34 - i * 0.12], [-0.7, 0, 0], [0.16, 0.4, 0.16]);
        }
        addPart(group, geo.cone, bodyMat, [0, 0.42, -0.66], [-1.05, 0, 0], [0.22, 0.54, 0.22]);
        break;
      }

      case 'mudkip': {
        addPart(group, geo.torsoQuadruped, bodyMat, [0, 0.5, -0.08], [-0.06, 0, 0], [0.6, 0.5, 0.54]);
        addPart(group, geo.sphere, bellyMat, [0, 0.44, 0.04], [0, 0, 0], [0.38, 0.28, 0.42]);
        addPaintedHead([0, 1.08, 0.28], [0.46, 0.42, 0.44], [0, 0, 0], geo.headFrog);
        addPart(group, geo.finBlade, bodyMat, [0, 1.48, 0.26], [0, Math.PI * 0.5, 0], [0.52, 0.62, 0.52]);
        for (const s of [-1, 1]) {
          for (const ang of [-0.45, 0, 0.45]) {
            addPart(group, geo.cone, accentMat, [s * 0.54, 1.02 + ang * 0.22, 0.3], [0, 0, -s * (Math.PI * 0.5 - ang)], [0.09, 0.32, 0.09]);
          }
          addPart(group, geo.sphereLow, accentMat, [s * 0.42, 1.02, 0.3], [0, 0, 0], [0.11, 0.12, 0.11]);
        }
        addQuadrupedStance(group, bodyMat, bodyMat, bodyMat, 0.23, 0.2, -0.32, 0.4, 0.105, false);
        addPart(group, geo.finBlade, bellyMat, [0, 0.64, -0.62], [-0.4, Math.PI * 0.5, 0], [0.78, 0.78, 0.78]);
        break;
      }

      case 'torchic': {
        addPart(group, geo.torsoAvian, bodyMat, [0, 0.58, 0], [0.08, 0, 0], [0.46, 0.44, 0.46]);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          addPart(group, geo.sphereLow, accentMat, [Math.cos(a) * 0.28, 0.9, Math.sin(a) * 0.26], [0, 0, 0], [0.15, 0.14, 0.15]);
        }
        addPaintedHead([0, 1.24, 0.08], [0.43, 0.43, 0.43], [0, 0, 0], geo.headAvian);
        addPart(group, geo.cone, goldMat, [0, 1.16, 0.52], [Math.PI * 0.52, 0, 0], [0.12, 0.2, 0.12]);
        for (let i = -1; i <= 1; i++) {
          addPart(group, geo.cone, accentMat, [i * 0.09, 1.72, 0.06], [0, 0, -i * 0.28], [0.11, 0.34, 0.11]);
        }
        for (const s of [-1, 1]) {
          addPart(group, geo.sphereLow, bodyMat, [s * 0.42, 0.68, 0], [0, 0, -s * 0.3], [0.11, 0.18, 0.14]);
        }
        addBirdTalons(group, accentMat, 0.2, 0.04);
        break;
      }

      case 'treecko': {
        addPart(group, geo.torsoAthletic, bodyMat, [0, 0.68, 0], [0.06, 0, 0], [0.34, 0.4, 0.34]);
        addPart(group, geo.sphere, accentMat, [0, 0.64, 0.2], [0, 0, 0], [0.23, 0.29, 0.15]);
        addPart(group, geo.cyl, bodyMat, [0, 1.04, 0.04], [0.08, 0, 0], [0.17, 0.18, 0.17]);
        addPaintedHead([0, 1.28, 0.08], [0.42, 0.38, 0.46], [0, 0, 0], geo.headShrew);
        addPart(group, geo.finBlade, detailMat, [0, 1.58, 0.02], [-0.2, Math.PI * 0.5, 0], [0.38, 0.38, 0.38]);
        for (const s of [-1, 1]) {
          addBentArm(group, s, bodyMat, bodyMat, bodyMat, [s * 0.26, 0.9, 0.04], [s * 0.42, 0.76, 0.14], [s * 0.36, 0.62, 0.28], 0.065, true);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, bodyMat, [s * 0.18, 0.4, 0.0], [s * 0.24, 0.24, 0.1], [s * 0.22, 0.08, 0.06], 0.085, true);
          // Iconic dual-lobed dark-green gecko leaf tail splayed out cleanly behind Treecko
          addPart(group, geo.leafBlade, detailMat, [s * 0.14, 0.58, -0.34], [-0.32, Math.PI * 0.5 + s * 0.42, -s * 0.22], [1.18, 1.08, 1.08]);
        }
        break;
      }

      case 'piplup': {
        // Piplup: seamless royal-blue back cape + 2 crisp white buttons painted cleanly onto torsoAvian
        const pipTex = getPiplupBodyTexture(bodyHex, accentHex);
        const pipBodyMat = getTexturedMat(pipTex, `pip_body_${bodyHex}_${accentHex}`, 0.54);
        addPart(group, geo.torsoAvian, pipBodyMat, [0, 0.58, 0], [0.08, 0, 0], [0.46, 0.46, 0.46]);
        addPaintedHead([0, 1.24, 0.08], [0.43, 0.42, 0.43], [0, 0, 0], geo.headAvian);
        addPart(group, geo.sphereLow, accentMat, [0, 1.66, 0.08], [0, 0, 0], [0.14, 0.12, 0.14]);
        addPart(group, geo.cone, detailMat, [0, 1.14, 0.54], [Math.PI * 0.52, 0, 0], [0.12, 0.26, 0.1]);
        for (const s of [-1, 1]) {
          addPart(group, geo.capsule, bodyMat, [s * 0.46, 0.66, 0.04], [0.1, 0, -s * 0.55], [0.17, 0.34, 0.11]);
          addSculptedFoot(group, s, detailMat, detailMat, [s * 0.22, 0.1, 0.1], [0.54, 0.36, 0.62], false);
        }
        break;
      }

      case 'rowlet': {
        // #722 Rowlet: plump spherical owl, cream chest oval, two-tone hooked beak, centered double-leaf green bowtie & tucked wings
        addPart(group, geo.headSphere, headMat, [0, 0.86, 0], [0, 0, 0], [0.66, 0.64, 0.64]);
        addPart(group, geo.sphere, bellyMat, [0, 0.58, 0.33], [0, 0, 0], [0.46, 0.4, 0.32]);
        addPart(group, geo.cone, detailMat, [0, 0.84, 0.64], [Math.PI * 0.6, 0, 0], [0.1, 0.16, 0.1]);
        addPart(group, geo.sphereLow, bellyMat, [0, 0.9, 0.62], [0, 0, 0], [0.065, 0.055, 0.06]);
        // Neat double-leaf bowtie centered squarely under beak
        addPart(group, geo.sphereLow, accentMat, [0, 0.64, 0.62], [0, 0, 0], [0.055, 0.055, 0.036]);
        for (const s of [-1, 1]) {
          addPart(group, geo.leafBlade, accentMat, [s * 0.03, 0.64, 0.61], [0.1, s === -1 ? Math.PI - 0.18 : 0.18, s * 0.14], [0.24, 0.34, 0.24]);
          addPart(group, geo.sphereLow, bodyMat, [s * 0.61, 0.82, -0.02], [0, 0, -s * 0.22], [0.14, 0.36, 0.34]);
        }
        addPart(group, geo.leafBlade, accentMat, [0, 0.54, -0.64], [-0.4, Math.PI * 0.5, 0], [0.4, 0.4, 0.4]);
        addBirdTalons(group, detailMat, 0.22, 0.04);
        break;
      }

      case 'tinkaton': {
        // #959 Tinkaton: cute round fairy face, twin-tail pink hair cones/puffs, dark dress & giant steel hammer
        addPart(group, geo.torsoAthletic, bodyMat, [0, 0.62, 0], [0, 0, 0], [0.34, 0.34, 0.32]);
        addPart(group, geo.cone, getStdMat('#be185d', 0.54), [0, 0.36, 0], [0, 0, 0], [0.52, 0.44, 0.48]);
        addPart(group, geo.cyl, bodyMat, [0, 0.96, 0.04], [0, 0, 0], [0.15, 0.14, 0.15]);
        addPaintedHead([0, 1.2, 0.08], [0.42, 0.4, 0.39], [0, 0, 0], geo.headSphere);
        for (const s of [-1, 1]) {
          addPart(group, geo.sphere, bodyMat, [s * 0.46, 1.4, -0.06], [0, 0, -s * 0.35], [0.25, 0.3, 0.24]);
          addPart(group, geo.sphereLow, bodyMat, [s * 0.62, 1.24, -0.08], [0, 0, 0], [0.16, 0.2, 0.16]);
          if (s === 1) {
            addBentArm(group, s, bellyMat, bellyMat, bellyMat, [0.28, 0.84, 0.04], [0.48, 0.94, 0.12], [0.56, 1.04, 0.2], 0.068, false);
          } else {
            addBentArm(group, s, bellyMat, bellyMat, bellyMat, [-0.28, 0.84, 0.04], [-0.44, 0.68, 0.1], [-0.36, 0.52, 0.2], 0.068, false);
          }
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, bodyMat, [s * 0.18, 0.36, 0.02], [s * 0.2, 0.2, 0.06], [s * 0.2, 0.08, 0.06], 0.08, false);
        }
        addPart(group, geo.cyl, detailMat, [0.64, 1.06, 0.22], [0, 0, -0.28], [0.065, 1.15, 0.065]);
        addPart(group, geo.cyl, accentMat, [0.8, 1.56, 0.22], [0, 0, Math.PI * 0.5 - 0.28], [0.42, 0.82, 0.42]);
        for (const endS of [-1, 1]) {
          addPart(group, geo.torus, detailMat, [0.8 + endS * 0.38, 1.56 - endS * 0.1, 0.22], [0, Math.PI * 0.5, -0.28], [0.44, 0.44, 0.26]);
        }
        break;
      }

      case 'ceruledge': {
        // #937 Ceruledge: indigo flame-knight with pale lavender pauldrons, bright violet helm plume & long glowing dual blades
        const bladeGlowMat = getStdMat(detailHex, 0.28, 0.12, accentHex, 0.38);
        const pauldronMat = getStdMat('#93c5fd', 0.44, 0.18);
        addPart(group, geo.torsoAthletic, bodyMat, [0, 0.78, 0], [0, 0, 0], [0.34, 0.42, 0.32]);
        addPart(group, geo.sphere, bellyMat, [0, 0.92, 0.06], [0, 0, 0], [0.36, 0.28, 0.32]);
        addPart(group, geo.cyl, accentMat, [0, 0.74, 0.2], [0, 0, 0], [0.13, 0.28, 0.16]);
        for (const s of [-1, 1]) {
          addPart(group, geo.sphereLow, pauldronMat, [s * 0.36, 1.1, 0], [0, 0, -s * 0.3], [0.22, 0.18, 0.22]);
        }
        addPart(group, geo.cyl, bodyMat, [0, 1.24, 0.04], [0, 0, 0], [0.14, 0.16, 0.14]);
        addPaintedHead([0, 1.46, 0.08], [0.4, 0.46, 0.41], [0, 0, 0], geo.headHuman);
        addPart(group, geo.finBlade, accentMat, [0, 1.98, -0.08], [-0.42, Math.PI * 0.5, 0], [1.05, 1.38, 0.9]);
        addPart(group, geo.finBlade, bladeGlowMat, [0, 1.9, -0.02], [-0.42, Math.PI * 0.5, 0], [0.72, 0.94, 0.64]);
        for (const s of [-1, 1]) {
          addPart(group, geo.box, bellyMat, [s * 0.46, 0.96, 0.14], [0.45, 0, -s * 0.25], [0.15, 0.34, 0.17]);
          addPart(group, geo.finBlade, bladeGlowMat, [s * 0.6, 0.74, 0.38], [0.78, Math.PI * 0.5, -s * 0.16], [1.34, 1.14, 0.68]);
          addPart(group, geo.finBlade, accentMat, [s * 0.6, 0.74, 0.35], [0.78, Math.PI * 0.5, -s * 0.16], [1.4, 0.72, 0.54]);
          addMuscularLeg(group, s, bodyMat, bodyMat, bodyMat, bodyMat, [s * 0.18, 0.44, 0.0], [s * 0.22, 0.25, 0.08], [s * 0.2, 0.08, 0.06], 0.092, false);
        }
        break;
      }

      case 'scizor': {
        // #212 Scizor: sleek armored mantis with sculpted elliptical crimson pincers (eye-spots), segmented abdomen & 4 wings
        const wingMat = getStdMat('#e2e8f0', 0.22, 0.12);
        addPart(group, geo.torsoAthletic, bodyMat, [0, 0.82, 0.04], [0.1, 0, 0], [0.3, 0.38, 0.28]);
        addPart(group, geo.sphere, bodyMat, [0, 0.56, -0.26], [-0.4, 0, 0], [0.34, 0.42, 0.4]);
        addPart(group, geo.torus, accentMat, [0, 0.54, -0.28], [Math.PI * 0.45, 0, 0], [0.33, 0.33, 0.17]);
        addPart(group, geo.torus, detailMat, [0, 0.46, -0.32], [Math.PI * 0.45, 0, 0], [0.28, 0.28, 0.14]);
        addPart(group, geo.cyl, detailMat, [0, 1.18, 0.06], [0.06, 0, 0], [0.12, 0.16, 0.12]);
        addPaintedHead([0, 1.38, 0.08], [0.36, 0.37, 0.41], [0, 0, 0], geo.headDragon);
        addPart(group, geo.cone, bodyMat, [0, 1.76, 0.04], [-0.15, 0, 0], [0.09, 0.32, 0.09]);
        for (const s of [-1, 1]) {
          addPart(group, geo.cone, bodyMat, [s * 0.21, 1.76, 0.06], [0, 0, -s * 0.28], [0.09, 0.38, 0.09]);
          addPart(group, geo.cyl, detailMat, [s * 0.44, 0.98, 0.12], [0.2, 0, -s * 0.85], [0.072, 0.36, 0.072]);
          // Sleek elliptical pincer claws + dark/yellow eye-spots
          addPart(group, geo.sphere, bodyMat, [s * 0.72, 0.8, 0.32], [0.1, 0, -s * 0.15], [0.21, 0.16, 0.34]);
          addPart(group, geo.sphereLow, detailMat, [s * 0.74, 0.86, 0.54], [0, 0, 0], [0.095, 0.095, 0.06]);
          addPart(group, geo.sphereLow, accentMat, [s * 0.74, 0.86, 0.56], [0, 0, 0], [0.05, 0.05, 0.05]);
          addPart(group, geo.dragonWing, wingMat, [s * 0.22, 1.1, -0.24], [0.22, s === -1 ? Math.PI + 0.15 : -0.15, 0.1 * s], [0.84, 0.84, 0.84]);
          addPart(group, geo.dragonWing, wingMat, [s * 0.2, 0.96, -0.26], [0.18, s === -1 ? Math.PI + 0.2 : -0.2, -0.12 * s], [0.58, 0.58, 0.58]);
          addMuscularLeg(group, s, bodyMat, detailMat, bodyMat, silverMat, [s * 0.2, 0.44, 0.02], [s * 0.26, 0.26, 0.12], [s * 0.24, 0.08, 0.06], 0.09, true);
        }
        break;
      }

      case 'absol':
      default: {
        // #359 Absol: sleek white sphinx quadruped, dark slate face mask, fluffy white head crest, sweeping curved scythe-horn & scythe tail
        addPart(group, geo.torsoQuadruped, bodyMat, [0, 0.6, -0.08], [-0.08, 0, 0], [0.62, 0.54, 0.54]);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          addPart(group, geo.sphereLow, bellyMat, [Math.cos(a) * 0.27, 0.9, 0.22 + Math.sin(a) * 0.23], [0, 0, 0], [0.17, 0.21, 0.17]);
        }
        addPaintedHead([0, 1.26, 0.26], [0.38, 0.38, 0.41], [0, 0, 0], geo.headCanine);
        // Fluffy white head hair sweeping over left temple + sweeping black crescent scythe-horn on right temple
        addPart(group, geo.sphereLow, bellyMat, [-0.14, 1.48, 0.3], [0.18, 0, 0.35], [0.24, 0.18, 0.26]);
        addPart(group, geo.sphereLow, bellyMat, [-0.26, 1.38, 0.22], [0, 0, 0.42], [0.16, 0.22, 0.22]);
        addPart(group, geo.scytheBlade, accentMat, [0.24, 1.36, 0.18], [-0.42, Math.PI * 0.5, -0.22], [0.88, 0.88, 0.88]);
        addQuadrupedStance(group, bodyMat, bodyMat, accentMat, 0.22, 0.22, -0.34, 0.5, 0.105, true);
        addPart(group, geo.scytheBlade, accentMat, [0, 0.72, -0.62], [-0.45, Math.PI * 0.5, 0], [0.92, 0.92, 0.92]);
        break;
      }
    }

    group.scale.setScalar(species.scale || 1.0);
    return group;
  }

  function buildPokeball3D(type) {
    const geo = getSharedGeo();
    const g = new THREE.Group();

    const tex = getPokeballTexture(type);
    const shellGeo = geo.sphere.clone();
    shellGeo.rotateY(-Math.PI / 2);

    const shellMat = getTexturedMat(tex, `pokeball_mat_v3_${type}`, 0.22, 0.74);
    const seamMat = getStdMat('#0f172a', 0.34, 0.16);
    const collarMat = getStdMat('#f1f5f9', 0.16, 0.32);
    const btnMat = getStdMat('#ffffff', 0.1, 0.16);

    // Main dual-tone sphere (radius 0.46)
    addPart(g, shellGeo, shellMat, [0, 0, 0], [0, 0, 0], [0.46, 0.46, 0.46]);

    // Precision slim 3D equatorial groove seam (zero spare-tire bulge!)
    addPart(g, geo.pokeballSeam, seamMat, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 1]);

    // Multi-tier front center push button sitting proud of the equatorial seam
    addPart(g, geo.cyl, seamMat, [0, 0, 0.452], [Math.PI / 2, 0, 0], [0.196, 0.036, 0.196]);
    addPart(g, geo.cyl, collarMat, [0, 0, 0.456], [Math.PI / 2, 0, 0], [0.14, 0.038, 0.14]);
    addPart(g, geo.pokeballBtnRing, seamMat, [0, 0, 0.474], [0, 0, 0], [1, 1, 1]);
    addPart(g, geo.sphereLow, btnMat, [0, 0, 0.472], [0, 0, 0], [0.042, 0.042, 0.02]);

    // Ball-specific 3D flush curved reliefs
    if (type === 'great') {
      const flapMat = getStdMat('#ef4444', 0.22, 0.1);
      addPart(g, geo.greatBallFin, flapMat, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
      addPart(g, geo.greatBallFin, flapMat, [0, 0, 0], [0, 0, 0], [-1, 1, 1]);
    } else if (type === 'ultra') {
      const goldBandMat = getStdMat('#facc15', 0.22, 0.28);
      addPart(g, geo.ultraArchLeg, goldBandMat, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
      addPart(g, geo.ultraArchLeg, goldBandMat, [0, 0, 0], [0, 0, 0], [-1, 1, 1]);
      addPart(g, geo.ultraArchTop, goldBandMat, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
    } else if (type === 'master') {
      const padMat = getStdMat('#ec4899', 0.24, 0.08);
      const crestMat = getStdMat('#ffffff', 0.2, 0.12);
      for (const s of [-1, 1]) {
        // Contoured pink shoulder pads hugging the upper dome
        addPart(g, geo.sphereLow, padMat, [s * 0.26, 0.23, 0.27], [-0.48, s * 0.52, -s * 0.34], [0.095, 0.07, 0.034]);
      }
      // Crisp curved white 'M' emblem hugging the front dome above button
      addPart(g, geo.masterM, crestMat, [0, 0.235, 0.395], [-0.54, 0, 0], [1.12, 1.12, 1.12]);
    }

    return g;
  }

  function getFourStarAuraShaderMat(layer) {
    const key = `fourStarSkinAura_${layer}_v2`;
    if (matCache.has(key)) return matCache.get(key);
    const isOuter = layer === 'outer';
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uThickness: { value: isOuter ? 0.095 : 0.042 },
        uWaveAmp: { value: isOuter ? 0.052 : 0.016 },
        uInnerColor: { value: new THREE.Color(isOuter ? '#fde047' : '#fef9c3') },
        uOuterColor: { value: new THREE.Color(isOuter ? '#f59e0b' : '#facc15') },
        uOpacity: { value: isOuter ? 0.68 : 0.94 },
        uFeather: { value: isOuter ? 0.42 : 0.34 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uThickness;
        uniform float uWaveAmp;
        varying float vDot;
        varying float vFlame;
        varying float vWave;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vec3 n = normalMatrix * normal;
          vec3 vNorm = length(n) > 0.0001 ? normalize(n) : vec3(0.0, 1.0, 0.0);
          float w1 = sin(worldPos.y * 9.0 - uTime * 5.6 + worldPos.x * 6.0);
          float w2 = cos(worldPos.z * 8.0 - uTime * 4.2 + worldPos.y * 5.5);
          float wave = (w1 * 0.5 + w2 * 0.5) * 0.5 + 0.5;
          vWave = wave;
          float extrude = uThickness + uWaveAmp * wave;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          mvPos.xyz += vNorm * extrude;
          vec3 viewDir = normalize(-mvPos.xyz);
          vDot = abs(dot(viewDir, vNorm));
          vFlame = sin(worldPos.x * 11.0 + worldPos.z * 9.0 + uTime * 3.8) * 0.5 + 0.5;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uInnerColor;
        uniform vec3 uOuterColor;
        uniform float uOpacity;
        uniform float uFeather;
        varying float vDot;
        varying float vFlame;
        varying float vWave;
        void main() {
          float edge = smoothstep(0.0, uFeather, vDot);
          float streak = mix(0.68, 1.0, vFlame * vWave);
          vec3 col = mix(uOuterColor, uInnerColor, clamp(edge * 1.15, 0.0, 1.0));
          float alpha = edge * uOpacity * streak;
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    matCache.set(key, mat);
    return mat;
  }

  function attachEdgeOnlyFourStarAura(targetGroup, species, isShiny, nature) {
    const geo = getSharedGeo();
    const auraContainer = new THREE.Group();
    auraContainer.name = 'fourStarSkinAura';

    const innerMat = getFourStarAuraShaderMat('inner');
    const outerMat = getFourStarAuraShaderMat('outer');

    const innerShell = buildPokemon3D(species, isShiny, nature);
    innerShell.traverse((child) => {
      if (child.isMesh) {
        child.material = innerMat;
        child.renderOrder = 2;
      }
    });
    auraContainer.add(innerShell);

    const outerShell = buildPokemon3D(species, isShiny, nature);
    outerShell.traverse((child) => {
      if (child.isMesh) {
        child.material = outerMat;
        child.renderOrder = 1;
      }
    });
    auraContainer.add(outerShell);

    // Subtle rising golden energy motes drifting upward close to the body silhouette (zero halo ring)
    const motes = [];
    const moteMat = getBasicMat('#fde047', 0.88);
    for (let i = 0; i < 8; i++) {
      const mote = new THREE.Mesh(geo.octa, moteMat);
      const angle = (i / 8) * Math.PI * 2;
      const rad = 0.58 + (i % 3) * 0.1;
      mote.position.set(Math.cos(angle) * rad, 0.25 + (i / 8) * 1.35, Math.sin(angle) * rad * 0.45);
      mote.scale.setScalar(0.052);
      auraContainer.add(mote);
      motes.push({ mesh: mote, angle, rad, phase: i * 0.78 });
    }

    targetGroup.add(auraContainer);
    return {
      update(t) {
        innerMat.uniforms.uTime.value = t;
        outerMat.uniforms.uTime.value = t;
        for (const m of motes) {
          m.mesh.position.y = 0.22 + ((t * 0.65 + m.phase) % 1.65);
          m.mesh.rotation.y = t * 3 + m.phase;
        }
      },
    };
  }

  root.PokemonBuilder = {
    getSharedGeo,
    getStdMat,
    getTexturedMat,
    getBasicMat,
    makeBlobShadow,
    addPart,
    buildPokemon3D,
    buildPokeball3D,
    attachEdgeOnlyFourStarAura,
  };
})(window);
