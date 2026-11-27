// Procedural CanvasTexture generators (pure vanilla JS, zero 404 external textures)
(function (root) {
  const THREE = root.THREE;
  const textureCache = new Map();

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return [canvas, ctx];
  }

  function finalizeColorTexture(canvas, repeat, anisotropy) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy || 4;
    if (repeat) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    } else {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }
    tex.needsUpdate = true;
    return tex;
  }

  function getBlobShadowTexture() {
    const key = 'blob_shadow';
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(128, 128);
    const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
    grad.addColorStop(0, 'rgba(6, 78, 59, 0.45)');
    grad.addColorStop(0.55, 'rgba(6, 78, 59, 0.22)');
    grad.addColorStop(1, 'rgba(6, 78, 59, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    textureCache.set(key, tex);
    return tex;
  }

  // Toroidally wrapped seamless meadow grass texture (zero tile seams)
  function getMeadowGrassTexture() {
    const key = 'meadow_grass_seamless_v3';
    if (textureCache.has(key)) return textureCache.get(key);

    const S = 512;
    const [c, ctx] = makeCanvas(S, S);
    ctx.fillStyle = '#4ec41e';
    ctx.fillRect(0, 0, S, S);

    const patches = [
      { x: 110, y: 120, r: 150, c: 'rgba(138, 232, 42, 0.34)' },
      { x: 390, y: 180, r: 165, c: 'rgba(128, 224, 38, 0.28)' },
      { x: 240, y: 380, r: 170, c: 'rgba(154, 240, 56, 0.25)' },
      { x: 420, y: 420, r: 135, c: 'rgba(30, 146, 28, 0.22)' },
      { x: 70, y: 340, r: 140, c: 'rgba(30, 146, 28, 0.18)' },
    ];

    for (const p of patches) {
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          const px = p.x + ox;
          const py = p.y + oy;
          if (px + p.r < 0 || px - p.r > S || py + p.r < 0 || py - p.r > S) continue;
          const g = ctx.createRadialGradient(px, py, 10, px, py, p.r);
          g.addColorStop(0, p.c);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, S, S);
        }
      }
    }

    for (let i = 0; i < 240; i++) {
      const gx = (i * 73) % S;
      const gy = (i * 137) % S;
      const rot = (i % 5) * 0.25 - 0.5;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(176, 248, 72, 0.28)' : 'rgba(26, 128, 24, 0.20)';
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          const px = gx + ox;
          const py = gy + oy;
          if (px < -16 || px > S + 16 || py < -16 || py > S + 16) continue;
          ctx.beginPath();
          ctx.ellipse(px, py, 2.8, 8.5, rot, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const tex = finalizeColorTexture(c, true, 4);
    tex.repeat.set(7, 7);
    textureCache.set(key, tex);
    return tex;
  }

  function getFaceProfile(speciesId) {
    // Soft, warm, cute, toddler-friendly eye proportions with instant species recognition
    const profiles = {
      squirtle: { rx: 13.0, ry: 18.0, spread: 27, eyeY: -7, nose: 'nostrils', mouth: 'wideSmile', cheeks: 'pink' },
      pikachu: { rx: 12.6, ry: 13.4, spread: 27, eyeY: -7, nose: 'triangle', mouth: 'catSmile', style: 'button', cheeks: 'red' },
      eevee: { rx: 12.8, ry: 16.0, spread: 26, eyeY: -6, nose: 'triangle', mouth: 'catSmile', style: 'anime', cheeks: 'pink' },
      espeon: { rx: 12.8, ry: 12.8, spread: 27, eyeY: -6, nose: 'triangle', mouth: 'smallSmile', style: 'almond' },
      mew: { rx: 13.5, ry: 18.4, spread: 25, eyeY: -4, nose: 'none', mouth: 'none', style: 'anime', cheeks: 'pink' },
      blastoise: { rx: 12.6, ry: 12.2, spread: 30, eyeY: -10, nose: 'nostrils', mouth: 'gentleSmile', style: 'fierce', fangs: true },
      applin: { rx: 11.4, ry: 13.6, spread: 24, eyeY: -6, nose: 'none', mouth: 'smallSmile', style: 'anime', cheeks: 'pink' },
      zapdos: { rx: 12.8, ry: 11.4, spread: 28, eyeY: -8, nose: 'none', mouth: 'none', style: 'almond' },
      fuecoco: { rx: 10.6, ry: 11.6, spread: 29, eyeY: -10, nose: 'none', mouth: 'none', style: 'button', cheeks: 'pink' },
      charizard: { rx: 12.8, ry: 12.0, spread: 28, eyeY: -11, nose: 'nostrils', mouth: 'gentleSmile', style: 'fierce', fangs: true },
      venusaur: { rx: 13.0, ry: 11.8, spread: 32, eyeY: -10, nose: 'nostrils', mouth: 'wideSmile', style: 'fierce', fangs: true },
      lucario: { rx: 12.6, ry: 14.2, spread: 27, eyeY: -10, nose: 'none', mouth: 'smallSmile', style: 'anime' },
      greninja: { rx: 13.4, ry: 12.2, spread: 30, eyeY: -8, nose: 'nostrils', mouth: 'none', style: 'almond' },
      dragonite: { rx: 11.6, ry: 13.8, spread: 26, eyeY: -9, nose: 'nostrils', mouth: 'gentleSmile', style: 'anime', cheeks: 'pink' },
      gyarados: { rx: 12.8, ry: 11.2, spread: 30, eyeY: -12, nose: 'none', mouth: 'none', style: 'fierce', slit: true },
      rayquaza: { rx: 13.8, ry: 12.6, spread: 29, eyeY: -11, nose: 'none', mouth: 'gentleSmile', style: 'almond', slit: true },
      gardevoir: { rx: 11.8, ry: 13.8, spread: 25, eyeY: -2, nose: 'none', mouth: 'smallSmile', style: 'anime' },
      arcanine: { rx: 12.0, ry: 11.8, spread: 27, eyeY: -8, nose: 'none', mouth: 'gentleSmile', style: 'almond', fangs: true },
      tyranitar: { rx: 12.4, ry: 12.2, spread: 28, eyeY: -11, nose: 'nostrils', mouth: 'gentleSmile', style: 'almond', fangs: true },
      salamence: { rx: 12.4, ry: 11.6, spread: 29, eyeY: -10, nose: 'nostrils', mouth: 'gentleSmile', style: 'almond', fangs: true },
      garchomp: { rx: 12.6, ry: 11.4, spread: 30, eyeY: -10, nose: 'nostrils', mouth: 'gentleSmile', style: 'almond', fangs: true },
      togepi: { rx: 12.0, ry: 15.0, spread: 27, eyeY: -6, nose: 'none', mouth: 'happyOpen', style: 'anime', cheeks: 'pink' },
      jigglypuff: { rx: 18.0, ry: 19.6, spread: 32, eyeY: -4, nose: 'none', mouth: 'happyOpen', style: 'anime', cheeks: 'pink' },
      meowth: { rx: 12.8, ry: 16.2, spread: 28, eyeY: -4, nose: 'none', mouth: 'catSmile', style: 'anime', slit: true },
      machamp: { rx: 12.6, ry: 11.6, spread: 28, eyeY: -9, nose: 'nostrils', mouth: 'gentleSmile', style: 'almond' },
      alakazam: { rx: 12.4, ry: 9.8, spread: 28, eyeY: -9, nose: 'nostrils', mouth: 'none', style: 'almond' },
      lapras: { rx: 12.8, ry: 14.4, spread: 27, eyeY: -8, nose: 'nostrils', mouth: 'gentleSmile', style: 'anime', cheeks: 'pink' },
      aerodactyl: { rx: 12.2, ry: 11.2, spread: 29, eyeY: -9, nose: 'nostrils', mouth: 'none', style: 'almond' },
      articuno: { rx: 12.0, ry: 11.8, spread: 27, eyeY: -8, nose: 'none', mouth: 'none', style: 'almond' },
      moltres: { rx: 12.0, ry: 11.6, spread: 27, eyeY: -8, nose: 'none', mouth: 'none', style: 'almond' },
      mewtwo: { rx: 12.8, ry: 12.4, spread: 26, eyeY: -6, nose: 'nostrils', mouth: 'smallSmile', style: 'almond' },
      totodile: { rx: 13.6, ry: 15.8, spread: 26, eyeY: -13, nose: 'none', mouth: 'none', style: 'anime' },
      lugia: { rx: 11.6, ry: 11.6, spread: 27, eyeY: -8, nose: 'nostrils', mouth: 'none', style: 'almond' },
      'ho-oh': { rx: 11.8, ry: 11.2, spread: 27, eyeY: -8, nose: 'none', mouth: 'none', style: 'almond' },
      mudkip: { rx: 10.8, ry: 13.6, spread: 26, eyeY: -8, nose: 'nostrils', mouth: 'wideSmile', style: 'button', cheeks: 'pink' },
      torchic: { rx: 11.4, ry: 14.0, spread: 25, eyeY: -7, nose: 'none', mouth: 'none', style: 'anime', cheeks: 'pink' },
      treecko: { rx: 15.0, ry: 16.0, spread: 29, eyeY: -8, nose: 'nostrils', mouth: 'smallSmile', style: 'anime', slit: true },
      piplup: { rx: 11.8, ry: 14.6, spread: 26, eyeY: -4, nose: 'none', mouth: 'none', style: 'anime', cheeks: 'pink' },
      tinkaton: { rx: 12.2, ry: 14.4, spread: 25, eyeY: -4, nose: 'none', mouth: 'catSmile', style: 'anime', cheeks: 'pink' },
      scizor: { rx: 12.4, ry: 10.8, spread: 29, eyeY: -8, nose: 'none', mouth: 'none', style: 'almond' },
      absol: { rx: 12.6, ry: 12.2, spread: 27, eyeY: -6, nose: 'triangle', mouth: 'smallSmile', style: 'almond' },
    };
    return profiles[speciesId] || { rx: 12, ry: 14, spread: 28, eyeY: -8, nose: 'nostrils', mouth: 'gentleSmile', style: 'anime' };
  }

  function getPokemonFaceTexture(species, isShiny, natureName) {
    const key = `face_v8_${species.id}_${isShiny ? 's' : 'n'}_${natureName}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const W = 512;
    const H = 256;
    const [c, ctx] = makeCanvas(W * 2, H * 2);
    ctx.scale(2, 2);

    const skin = isShiny ? species.shinyBody : species.body;
    const belly = isShiny ? species.shinyBelly : species.belly;
    const accent = isShiny ? species.shinyAccent : species.accent;
    const detail = isShiny ? species.shinyDetail : species.detail;
    const iris = isShiny && species.shinyIris ? species.shinyIris : species.iris;

    let baseHeadColor = skin;
    if (species.id === 'absol') baseHeadColor = accent;
    if (species.id === 'ceruledge') baseHeadColor = '#2e2a6b';
    if (species.id === 'piplup') baseHeadColor = accent;

    ctx.fillStyle = baseHeadColor;
    ctx.fillRect(0, 0, W, H);

    const sheen = ctx.createRadialGradient(W * 0.5, H * 0.28, 12, W * 0.5, H * 0.45, 130);
    sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);

    const cx = W * 0.5;
    const cy = H * 0.52;

    // Species-specific facial masks / markings BEFORE eyes
    if (species.id === 'rowlet') {
      // Crisp heart-shaped white owl face mask
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx - 25, cy - 2, 34, 34, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 25, cy - 2, 34, 34, 0, 0, Math.PI * 2);
      ctx.ellipse(cx, cy + 16, 42, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (species.id === 'snorlax') {
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.moveTo(cx - 82, cy + 56);
      ctx.quadraticCurveTo(cx - 78, cy - 32, cx - 28, cy - 22);
      ctx.lineTo(cx, cy - 8);
      ctx.lineTo(cx + 28, cy - 22);
      ctx.quadraticCurveTo(cx + 78, cy - 32, cx + 82, cy + 56);
      ctx.closePath();
      ctx.fill();
    } else if (species.id === 'fuecoco') {
      // Iconic white skull-heart face mask
      ctx.fillStyle = detail;
      ctx.beginPath();
      ctx.ellipse(cx - 28, cy + 2, 33, 35, -0.08, 0, Math.PI * 2);
      ctx.ellipse(cx + 28, cy + 2, 33, 35, 0.08, 0, Math.PI * 2);
      ctx.ellipse(cx, cy + 18, 54, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (species.id === 'piplup') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx - 25, cy + 8, 29, 34, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 25, cy + 8, 29, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 28);
      ctx.lineTo(cx + 10, cy - 28);
      ctx.lineTo(cx, cy - 2);
      ctx.closePath();
      ctx.fill();
    } else if (species.id === 'lucario') {
      // Sleek black aura mask around eyes leaving blue cheeks & bright ruby eyes visible
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(cx - 26, cy - 8, 19, 13, -0.14, 0, Math.PI * 2);
      ctx.ellipse(cx + 26, cy - 8, 19, 13, 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 16, cy - 12, 32, 8);
      ctx.fillRect(cx - 6, cy - 8, 12, 16);
    } else if (species.id === 'greninja') {
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 16, 66, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (species.id === 'cyndaquil') {
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 16, 86, 44, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (species.id === 'salamence' || species.id === 'dragonite' || species.id === 'charizard') {
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 32, 50, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (species.id === 'lugia') {
      ctx.fillStyle = accent;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * 13, cy - 10);
        ctx.lineTo(cx + s * 48, cy - 24);
        ctx.lineTo(cx + s * 42, cy + 6);
        ctx.lineTo(cx + s * 16, cy + 4);
        ctx.closePath();
        ctx.fill();
      }
    } else if (species.id === 'ho-oh') {
      ctx.fillStyle = '#0f172a';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * 28, cy - 8, 19, 11, s * -0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (species.id === 'zapdos') {
      ctx.fillStyle = '#0f172a';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * 11, cy - 8);
        ctx.lineTo(cx + s * 45, cy - 16);
        ctx.lineTo(cx + s * 38, cy + 4);
        ctx.lineTo(cx + s * 13, cy + 4);
        ctx.closePath();
        ctx.fill();
      }
    } else if (species.id === 'arcanine') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx - 26, cy - 38, 52, 5);
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 16, 42, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (species.id === 'absol') {
      ctx.fillStyle = detail;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 30, 5, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (species.id === 'gardevoir') {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(cx - 90, 0);
      ctx.lineTo(cx + 90, 0);
      ctx.lineTo(cx + 76, cy - 12);
      ctx.quadraticCurveTo(cx + 22, cy - 34, cx, cy - 16);
      ctx.quadraticCurveTo(cx - 22, cy - 34, cx - 76, cy - 12);
      ctx.closePath();
      ctx.fill();
    } else if (species.id === 'gyarados') {
      // Cream lower cheek trim
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 28, 66, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (species.id === 'rayquaza') {
      // Iconic glowing yellow crest lines & red lip trim
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * 12, cy - 34);
        ctx.lineTo(cx + s * 44, cy - 22);
        ctx.stroke();
      }
      ctx.strokeStyle = detail;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 46, cy + 18);
      ctx.quadraticCurveTo(cx, cy + 28, cx + 46, cy + 18);
      ctx.stroke();
    }

    // Specialized complete face species
    if (species.id === 'ditto') {
      ctx.fillStyle = '#111827';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + s * 22, cy - 10, 4.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (natureName === 'Sassy') {
        ctx.moveTo(cx - 22, cy + 10);
        ctx.quadraticCurveTo(cx + 4, cy + 18, cx + 24, cy + 4);
        ctx.stroke();
      } else if (natureName === 'Sleepy') {
        ctx.ellipse(cx, cy + 12, 6.5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(cx - 28, cy + 6);
        ctx.quadraticCurveTo(cx, cy + 20, cx + 28, cy + 6);
        ctx.stroke();
      }
      const tex = finalizeColorTexture(c, false, 4);
      textureCache.set(key, tex);
      return tex;
    }

    if (species.id === 'mimikyu') {
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, 12);
      ctx.lineTo(cx, H - 12);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + s * 28, cy - 6);
        ctx.rotate(s * 0.14);
        ctx.fillStyle = '#1e1b18';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 13.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.2;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(-8, k * 5);
          ctx.lineTo(8, k * 4 + 2);
          ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 3.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const chx = cx + s * 42;
        const chy = cy + 14;
        ctx.moveTo(chx - 8, chy - 5);
        ctx.lineTo(chx + 8, chy - 3);
        ctx.lineTo(chx - 9, chy + 2);
        ctx.lineTo(chx + 9, chy + 4);
        ctx.lineTo(chx - 6, chy + 8);
        ctx.stroke();
      }

      ctx.strokeStyle = '#1e1b18';
      ctx.lineWidth = 3.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy + 18);
      ctx.lineTo(cx - 12, cy + 25);
      ctx.lineTo(cx, cy + 17);
      ctx.lineTo(cx + 12, cy + 25);
      ctx.lineTo(cx + 24, cy + 17);
      ctx.stroke();

      const tex = finalizeColorTexture(c, false, 4);
      textureCache.set(key, tex);
      return tex;
    }

    if (species.id === 'ceruledge') {
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, 58, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + s * 25, cy - 4);
        ctx.rotate(s * -0.1);
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.45, '#a5f3fc');
        grad.addColorStop(0.78, iris);
        grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 14.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-2 * s, -2, 7.5, 4.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const tex = finalizeColorTexture(c, false, 4);
      textureCache.set(key, tex);
      return tex;
    }

    if (species.id === 'metagross') {
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.ellipse(cx + s * 38, cy + 6, 15, 9.5, s * 0.12, 0, Math.PI * 2);
        ctx.fill();

        const g = ctx.createRadialGradient(cx + s * 38, cy + 6, 2, cx + s * 38, cy + 6, 12);
        g.addColorStop(0, '#fecaca');
        g.addColorStop(0.45, '#ef4444');
        g.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx + s * 38, cy + 6, 11, 7, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = finalizeColorTexture(c, false, 4);
      textureCache.set(key, tex);
      return tex;
    }

    if (species.id === 'snorlax' || species.id === 'cyndaquil') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4.0;
      ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        if (species.id === 'cyndaquil') {
          ctx.arc(cx + s * 28, cy - 8, 10.5, Math.PI * 1.14, Math.PI * 1.86);
        } else {
          ctx.moveTo(cx + s * 20, cy - 8);
          ctx.quadraticCurveTo(cx + s * 32, cy - 12, cx + s * 44, cy - 6);
        }
        ctx.stroke();
      }

      if (species.id === 'cyndaquil') {
        ctx.fillStyle = 'rgba(244, 114, 182, 0.35)';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(cx + s * 42, cy + 6, 8, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy + 18);
      ctx.quadraticCurveTo(cx, cy + 24, cx + 20, cy + 18);
      ctx.stroke();
      if (species.id === 'snorlax') {
        ctx.fillStyle = '#ffffff';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + s * 15, cy + 20);
          ctx.lineTo(cx + s * 11, cy + 11);
          ctx.lineTo(cx + s * 7, cy + 21);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }

      const tex = finalizeColorTexture(c, false, 4);
      textureCache.set(key, tex);
      return tex;
    }

    if (species.id === 'psyduck') {
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(cx + s * 28, cy - 12, 16, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(cx + s * 27, cy - 11, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = finalizeColorTexture(c, false, 4);
      textureCache.set(key, tex);
      return tex;
    }

    if (species.id === 'gengar') {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + s * 32, cy - 15);
        ctx.rotate(s * 0.34);
        ctx.fillStyle = iris;
        ctx.strokeStyle = '#12071f';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-22 * s, -12);
        ctx.lineTo(20 * s, -1);
        ctx.quadraticCurveTo(0, 22, -22 * s, -12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#090512';
        ctx.beginPath();
        ctx.ellipse(0, 1, 3.8, 7.2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-2.5, -2.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Iconic huge crescent toothy Gengar grin
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(cx - 58, cy + 5);
      ctx.quadraticCurveTo(cx, cy + 52, cx + 58, cy + 5);
      ctx.quadraticCurveTo(cx, cy + 20, cx - 58, cy + 5);
      ctx.fill();
      ctx.stroke();
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 18, cy + 12);
        ctx.lineTo(cx + i * 18, cy + 32);
        ctx.stroke();
      }
      const tex = finalizeColorTexture(c, false, 4);
      textureCache.set(key, tex);
      return tex;
    }

    if (species.id === 'rowlet') {
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(cx + s * 25, cy - 6, 9.8, 12.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx + s * 25 - 2.8, cy - 10, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + s * 25 + 2.8, cy + 1, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = finalizeColorTexture(c, false, 4);
      textureCache.set(key, tex);
      return tex;
    }

    // Calibrated per-species eye & facial rendering
    const prof = getFaceProfile(species.id);
    const eyeRx = prof.rx;
    const eyeRy = prof.ry;
    const eyeSpread = prof.spread;
    const eyeY = cy + prof.eyeY;
    const isFierce = prof.style === 'fierce';
    const isAlmond = prof.style === 'almond';
    const isButton = prof.style === 'button';
    const isSlit = Boolean(prof.slit);

    for (const s of [-1, 1]) {
      const ex = cx + s * eyeSpread;
      ctx.save();
      ctx.translate(ex, eyeY);

      if (isButton) {
        // Crisp dark glossy button eye (Pikachu, Fuecoco, Mudkip)
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeRx, eyeRy, 0, 0, Math.PI * 2);
        ctx.fill();

        if (species.id === 'fuecoco') {
          ctx.fillStyle = iris;
          ctx.beginPath();
          ctx.ellipse(0, 2, eyeRx * 0.65, eyeRy * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#090d16';
          ctx.beginPath();
          ctx.arc(0, 1, eyeRx * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-eyeRx * 0.28, -eyeRy * 0.32, eyeRx * 0.34, 0, Math.PI * 2);
        ctx.fill();

        if (natureName === 'Sleepy') {
          ctx.fillStyle = species.id === 'fuecoco' ? detail : baseHeadColor;
          ctx.fillRect(-eyeRx - 1, -eyeRy - 1, eyeRx * 2 + 2, eyeRy * 0.9);
        }
        ctx.restore();
        continue;
      }

      ctx.beginPath();
      if (isFierce) {
        ctx.moveTo(-eyeRx * s, -eyeRy * 0.42);
        ctx.quadraticCurveTo(0, -eyeRy * 0.72, eyeRx * s, -eyeRy * 0.92);
        ctx.quadraticCurveTo(eyeRx * s * 1.02, eyeRy * 0.54, 0, eyeRy * 0.88);
        ctx.quadraticCurveTo(-eyeRx * s * 0.86, eyeRy * 0.65, -eyeRx * s, -eyeRy * 0.42);
        ctx.closePath();
      } else if (isAlmond) {
        ctx.moveTo(-eyeRx * s, -eyeRy * 0.08);
        ctx.quadraticCurveTo(0, -eyeRy * 0.98, eyeRx * s, -eyeRy * 0.34);
        ctx.quadraticCurveTo(0, eyeRy * 0.96, -eyeRx * s, -eyeRy * 0.08);
        ctx.closePath();
      } else {
        ctx.ellipse(0, 0, eyeRx, eyeRy, 0, 0, Math.PI * 2);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.save();
      ctx.clip();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
      ctx.fillRect(-eyeRx, -eyeRy, eyeRx * 2, eyeRy * 0.28);

      const irisOffsetX = -s * 1.0 + (natureName === 'Sassy' ? 1.5 : 0);
      const irisOffsetY = natureName === 'Sleepy' ? 2.2 : 0.4;
      const irisRx = eyeRx * (isFierce ? 0.64 : 0.74);
      const irisRy = eyeRy * (isFierce ? 0.82 : 0.84);

      const irisGrad = ctx.createLinearGradient(0, -irisRy, 0, irisRy);
      irisGrad.addColorStop(0, iris);
      irisGrad.addColorStop(0.28, iris);
      irisGrad.addColorStop(0.75, iris);
      irisGrad.addColorStop(1, iris);

      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(irisOffsetX, irisOffsetY, irisRx, irisRy, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#05080f';
      ctx.beginPath();
      if (isSlit) {
        ctx.ellipse(irisOffsetX, irisOffsetY, irisRx * 0.28, irisRy * 0.82, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(irisOffsetX, irisOffsetY - 0.8, irisRx * 0.5, irisRy * 0.48, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.beginPath();
      ctx.ellipse(irisOffsetX, irisOffsetY + irisRy * 0.52, irisRx * 0.48, irisRy * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(irisOffsetX - irisRx * 0.28, irisOffsetY - irisRy * 0.36, irisRx * 0.34, irisRy * 0.26, -0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(irisOffsetX + irisRx * 0.28, irisOffsetY + irisRy * 0.24, irisRx * 0.13, 0, Math.PI * 2);
      ctx.fill();

      if (natureName === 'Sleepy' || (natureName === 'Sassy' && s === 1 && !isFierce)) {
        const coverH = natureName === 'Sleepy' ? eyeRy * 0.82 : eyeRy * 0.45;
        ctx.fillStyle = species.id === 'piplup' || species.id === 'gardevoir' ? '#ffffff' : baseHeadColor;
        ctx.fillRect(-eyeRx - 2, -eyeRy - 2, eyeRx * 2 + 4, coverH);
        ctx.strokeStyle = '#141e2e';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-eyeRx, -eyeRy + coverH);
        ctx.lineTo(eyeRx, -eyeRy + coverH);
        ctx.stroke();
      }

      ctx.restore();

      ctx.strokeStyle = '#141e2e';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      if (isFierce) {
        ctx.moveTo(-eyeRx * s, -eyeRy * 0.42);
        ctx.quadraticCurveTo(0, -eyeRy * 0.72, eyeRx * s, -eyeRy * 0.92);
        ctx.quadraticCurveTo(eyeRx * s * 1.02, eyeRy * 0.54, 0, eyeRy * 0.88);
        ctx.quadraticCurveTo(-eyeRx * s * 0.86, eyeRy * 0.65, -eyeRx * s, -eyeRy * 0.42);
        ctx.closePath();
      } else if (isAlmond) {
        ctx.moveTo(-eyeRx * s, -eyeRy * 0.08);
        ctx.quadraticCurveTo(0, -eyeRy * 0.98, eyeRx * s, -eyeRy * 0.34);
        ctx.quadraticCurveTo(0, eyeRy * 0.96, -eyeRx * s, -eyeRy * 0.08);
        ctx.closePath();
      } else {
        ctx.ellipse(0, 0, eyeRx, eyeRy, 0, 0, Math.PI * 2);
      }
      ctx.stroke();

      if (!isFierce && !isAlmond) {
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeRx, eyeRy, 0, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }

      if (isFierce || natureName === 'Fierce' || species.id === 'squirtle') {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (isFierce || natureName === 'Fierce') {
          ctx.moveTo(-eyeRx * 0.72 * s, -eyeRy * 0.62);
          ctx.lineTo(eyeRx * 0.78 * s, -eyeRy * 1.04);
        } else {
          ctx.moveTo(-6 * s, -eyeRy - 6);
          ctx.quadraticCurveTo(0, -eyeRy - 10, 7 * s, -eyeRy - 4);
        }
        ctx.stroke();
      }

      ctx.restore();
    }

    // Nostrils / Nose
    if (prof.nose === 'triangle') {
      ctx.fillStyle = '#1e1b18';
      ctx.beginPath();
      ctx.moveTo(cx - 4.2, cy + 5);
      ctx.lineTo(cx + 4.2, cy + 5);
      ctx.lineTo(cx, cy + 10.5);
      ctx.closePath();
      ctx.fill();
    } else if (prof.nose === 'nostrils') {
      ctx.fillStyle = '#0f2942';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * 6.0, cy + 10, 2.1, 3.0, s * -0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (prof.cheeks === 'red' || prof.cheeks === 'pink') {
      ctx.fillStyle = prof.cheeks === 'red' ? accent : 'rgba(244, 114, 182, 0.5)';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + s * 42, cy + 14, prof.cheeks === 'red' ? 11.5 : 8.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (species.id === 'espeon') {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, cy - 30, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(cx - 2.2, cy - 33, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (species.id === 'meowth') {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 32, 9.5, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 39);
      ctx.lineTo(cx, cy - 25);
      ctx.stroke();
    }

    // Mouth rendering
    const mouthY = cy + 23;
    ctx.save();
    if (prof.mouth === 'catSmile') {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 15, mouthY + 1);
      ctx.quadraticCurveTo(cx - 7.5, mouthY + 8, cx, mouthY + 1);
      ctx.quadraticCurveTo(cx + 7.5, mouthY + 8, cx + 15, mouthY + 1);
      ctx.stroke();
      if (natureName === 'Jolly' || natureName === 'Brave') {
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.ellipse(cx, mouthY + 9, 7.5, 8.5, 0, 0, Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    } else if (prof.mouth === 'smallSmile' || prof.mouth === 'gentleSmile') {
      const span = prof.mouth === 'gentleSmile' ? 24 : 14;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - span, mouthY);
      ctx.quadraticCurveTo(cx, mouthY + 10, cx + span, mouthY);
      ctx.stroke();
    } else if (prof.mouth === 'serious') {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 18, mouthY + 4);
      ctx.quadraticCurveTo(cx, mouthY - 1, cx + 18, mouthY + 4);
      ctx.stroke();
    } else if (prof.mouth === 'wideSmile' || prof.mouth === 'happyOpen') {
      const halfW = prof.mouth === 'wideSmile' ? 32 : 20;
      ctx.beginPath();
      ctx.moveTo(cx - halfW, mouthY - 2);
      ctx.quadraticCurveTo(cx, mouthY + 3, cx + halfW, mouthY - 2);
      ctx.quadraticCurveTo(cx + halfW * 0.72, mouthY + 20, cx, mouthY + 20);
      ctx.quadraticCurveTo(cx - halfW * 0.72, mouthY + 20, cx - halfW, mouthY - 2);
      ctx.closePath();
      ctx.fillStyle = '#9f1239';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.ellipse(cx, mouthY + 14, halfW * 0.75, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.6;
      ctx.stroke();
    } else if (prof.mouth === 'fierce' || prof.mouth === 'wideFierce') {
      const halfW = prof.mouth === 'wideFierce' ? 38 : 28;
      ctx.beginPath();
      ctx.moveTo(cx - halfW, mouthY + 2);
      ctx.quadraticCurveTo(cx, mouthY - 5, cx + halfW, mouthY + 2);
      ctx.quadraticCurveTo(cx + halfW * 0.7, mouthY + 20, cx, mouthY + 20);
      ctx.quadraticCurveTo(cx - halfW * 0.7, mouthY + 20, cx - halfW, mouthY + 2);
      ctx.closePath();
      ctx.fillStyle = '#881337';
      ctx.fill();
      if (prof.fangs) {
        ctx.fillStyle = '#ffffff';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + s * (halfW * 0.56), mouthY + 1);
          ctx.lineTo(cx + s * (halfW * 0.42), mouthY + 11);
          ctx.lineTo(cx + s * (halfW * 0.28), mouthY + 2);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
    ctx.restore();

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  function getShellPlastronTexture(bellyHex, rimHex) {
    const key = `plastron_v2_${bellyHex}_${rimHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = rimHex;
    ctx.fillRect(0, 0, 512, 512);

    const grad = ctx.createLinearGradient(0, 56, 0, 456);
    grad.addColorStop(0, '#f3a847');
    grad.addColorStop(0.5, bellyHex);
    grad.addColorStop(1, '#f8d070');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(256, 256, 188, 208, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#472a13';
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.lineCap = 'round';
    ctx.lineWidth = 8.5;
    ctx.beginPath();
    ctx.moveTo(256, 56);
    ctx.lineTo(256, 456);

    ctx.moveTo(96, 174);
    ctx.quadraticCurveTo(256, 146, 416, 174);

    ctx.moveTo(74, 278);
    ctx.quadraticCurveTo(256, 260, 438, 278);

    ctx.moveTo(114, 376);
    ctx.quadraticCurveTo(256, 362, 398, 376);
    ctx.stroke();

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  function getCarapaceTexture(shellHex) {
    const key = `carapace_${shellHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = shellHex;
    ctx.fillRect(0, 0, 512, 512);

    const g = ctx.createRadialGradient(256, 210, 20, 256, 256, 250);
    g.addColorStop(0, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(40, 18, 8, 0.55)';
    ctx.lineWidth = 9;
    const drawHex = (hx, hy, r) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = hx + Math.cos(a) * r;
        const py = hy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    };

    drawHex(256, 256, 78);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      drawHex(256 + Math.cos(a) * 136, 256 + Math.sin(a) * 136, 74);
    }

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  function getTigerStripeTexture(baseHex, stripeHex) {
    const key = `tiger_${baseHex}_${stripeHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = stripeHex;
    for (let i = 0; i < 8; i++) {
      const x = 32 + i * 62;
      ctx.beginPath();
      ctx.moveTo(x - 10, 20);
      ctx.lineTo(x + 12, 20);
      ctx.lineTo(x - 2, 128);
      ctx.lineTo(x + 16, 228);
      ctx.lineTo(x - 8, 228);
      ctx.lineTo(x - 16, 128);
      ctx.closePath();
      ctx.fill();
    }

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  function getRafflesiaPetalTexture(petalHex) {
    const key = `rafflesia_${petalHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = petalHex;
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#fff8eb';
    const spots = [
      [56, 62, 16], [148, 54, 18], [202, 118, 15], [98, 128, 20],
      [48, 184, 14], [156, 192, 17], [198, 212, 12], [116, 218, 13],
    ];
    for (const [sx, sy, sr] of spots) {
      ctx.beginPath();
      ctx.ellipse(sx, sy, sr, sr * 0.82, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  function getEggShellPatternTexture(shellHex, redHex, blueHex) {
    const key = `eggshell_${shellHex}_${redHex}_${blueHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = shellHex;
    ctx.fillRect(0, 0, 512, 256);

    const shapes = [
      { x: 54, y: 120, color: redHex, rot: 0.2 },
      { x: 136, y: 158, color: blueHex, rot: -0.3 },
      { x: 212, y: 112, color: redHex, rot: 0.4 },
      { x: 294, y: 162, color: blueHex, rot: 0.1 },
      { x: 374, y: 118, color: redHex, rot: -0.2 },
      { x: 448, y: 156, color: blueHex, rot: 0.3 },
    ];
    for (const sh of shapes) {
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.rot);
      ctx.strokeStyle = sh.color;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(22, 18);
      ctx.lineTo(-22, 18);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  function getScaleBellyTexture(bellyHex, lineHex) {
    const key = `scalebelly_${bellyHex}_${lineHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = bellyHex;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = lineHex;
    ctx.lineWidth = 5;
    for (let y = 32; y < 240; y += 34) {
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.quadraticCurveTo(128, y + 14, 240, y);
      ctx.stroke();
    }

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  // Pikachu's back: two smooth brown horizontal stripes wrapped onto torso
  function getPikachuBodyTexture(bodyHex, detailHex) {
    const key = `pikachu_body_${bodyHex}_${detailHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = bodyHex;
    ctx.fillRect(0, 0, 512, 256);

    // Back is centered at u=0.0/1.0 (edges x=0 and x=512 when lathe/sphere has -PI/2 offset, or x=0/512)
    ctx.fillStyle = detailHex;
    for (const bx of [0, 512]) {
      ctx.beginPath();
      ctx.ellipse(bx, 118, 86, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bx, 160, 92, 17, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = finalizeColorTexture(c, true, 4);
    textureCache.set(key, tex);
    return tex;
  }

  // Eevee's fluffy tail: warm brown base with jagged zig-zag cream tip
  function getEeveeTailTexture(bodyHex, accentHex) {
    const key = `eevee_tail_${bodyHex}_${accentHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = bodyHex;
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(256, 0);
    ctx.lineTo(256, 108);
    for (let i = 8; i >= 0; i--) {
      const x = (i / 8) * 256;
      const y = i % 2 === 0 ? 112 : 76;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    const tex = finalizeColorTexture(c, true, 4);
    textureCache.set(key, tex);
    return tex;
  }

  // Snorlax's torso: dark teal with seamless large cream oval belly
  function getSnorlaxBodyTexture(bodyHex, bellyHex) {
    const key = `snorlax_body_${bodyHex}_${bellyHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = bodyHex;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = bellyHex;
    ctx.beginPath();
    ctx.ellipse(256, 146, 105, 86, 0, 0, Math.PI * 2);
    ctx.fill();

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  // Piplup's torso: sky blue chest with royal blue back cape + 2 crisp white buttons
  function getPiplupBodyTexture(bodyHex, accentHex) {
    const key = `piplup_body_${bodyHex}_${accentHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 0, 512, 256);

    // Sky-blue chest oval on front (u=0.5 -> x=256)
    ctx.fillStyle = bodyHex;
    ctx.beginPath();
    ctx.ellipse(256, 152, 118, 92, 0, 0, Math.PI * 2);
    ctx.fill();

    // Two crisp white circular chest buttons
    ctx.fillStyle = '#ffffff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(256 + s * 36, 128, 17, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  // Venusaur's spotted dinosaur skin
  function getSpottedDinoTexture(bodyHex, spotHex) {
    const key = `spotted_dino_${bodyHex}_${spotHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = bodyHex;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = spotHex;
    const spots = [
      [78, 72, 26, 18, 0.3], [148, 148, 32, 22, -0.2], [228, 96, 22, 16, 0.5],
      [310, 142, 34, 24, 0.1], [386, 76, 28, 20, -0.4], [442, 162, 26, 18, 0.25],
      [96, 188, 20, 14, -0.15], [344, 198, 22, 16, 0.35],
    ];
    for (const [x, y, rx, ry, rot] of spots) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = finalizeColorTexture(c, true, 4);
    textureCache.set(key, tex);
    return tex;
  }

  // Fuecoco's crimson body with clean yellow chest square
  function getFuecocoBodyTexture(bodyHex, bellyHex) {
    const key = `fuecoco_body_v2_${bodyHex}_${bellyHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = bodyHex;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = bellyHex;
    ctx.beginPath();
    ctx.roundRect(212, 114, 88, 84, 12);
    ctx.fill();

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  // Serpent coil textures using world-up-stabilized v (v=0.5 is front/belly, v=0/1 is dorsal back)
  function getSerpentBodyTexture(speciesId, bodyHex, bellyHex, accentHex, detailHex) {
    const key = `serpent_v2_${speciesId}_${bodyHex}_${bellyHex}_${accentHex}_${detailHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = bodyHex;
    ctx.fillRect(0, 0, 512, 256);

    if (speciesId === 'gyarados') {
      // Ventral front/underside centered around v=0.5 (y=128)
      ctx.fillStyle = bellyHex;
      ctx.fillRect(0, 76, 512, 104);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.lineWidth = 4;
      for (let x = 20; x < 512; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, 76);
        ctx.lineTo(x + 6, 180);
        ctx.stroke();
      }
    } else if (speciesId === 'rayquaza') {
      // Glowing gold rings around full circumference + red lateral pinstripes
      ctx.strokeStyle = detailHex;
      ctx.lineWidth = 5;
      for (const py of [76, 180]) {
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(512, py);
        ctx.stroke();
      }

      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 10;
      for (let x = 44; x < 512; x += 92) {
        ctx.beginPath();
        ctx.ellipse(x, 128, 12, 112, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  // Applin glossy apple skin
  function getAppleSkinTexture(bodyHex, bellyHex) {
    const key = `apple_${bodyHex}_${bellyHex}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const [c, ctx] = makeCanvas(256, 256);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, bodyHex);
    g.addColorStop(0.8, bodyHex);
    g.addColorStop(1, bellyHex);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (let x = 16; x < 256; x += 42) {
      ctx.beginPath();
      ctx.ellipse(x, 120, 6, 62, 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = finalizeColorTexture(c, true, 4);
    textureCache.set(key, tex);
    return tex;
  }

  function getPokeballTexture(type) {
    const key = `pokeball_v3_${type}`;
    if (textureCache.has(key)) return textureCache.get(key);

    const W = 1024;
    const H = 512;
    const [c, ctx] = makeCanvas(W, H);

    // Top hemisphere gradient (subtle studio gloss & edge darkening)
    const topGrad = ctx.createLinearGradient(0, 0, 0, 240);
    if (type === 'great') {
      topGrad.addColorStop(0, '#3b82f6');
      topGrad.addColorStop(0.65, '#2563eb');
      topGrad.addColorStop(1, '#1d4ed8');
    } else if (type === 'ultra') {
      topGrad.addColorStop(0, '#334155');
      topGrad.addColorStop(0.6, '#1e293b');
      topGrad.addColorStop(1, '#0f172a');
    } else if (type === 'master') {
      topGrad.addColorStop(0, '#9333ea');
      topGrad.addColorStop(0.65, '#7e22ce');
      topGrad.addColorStop(1, '#6b21a8');
    } else {
      topGrad.addColorStop(0, '#f87171');
      topGrad.addColorStop(0.5, '#ef4444');
      topGrad.addColorStop(1, '#dc2626');
    }
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, 246);

    // Bottom pearl-white shell with subtle bounce shading
    const botGrad = ctx.createLinearGradient(0, 266, 0, H);
    botGrad.addColorStop(0, '#ffffff');
    botGrad.addColorStop(0.6, '#f8fafc');
    botGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, 266, W, H - 266);

    // Crisp painted trim behind 3D curved reliefs on Great/Ultra/Master
    if (type === 'great') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 6;
      ctx.fillStyle = '#ef4444';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(512 + s * 165, 58);
        ctx.lineTo(512 + s * 212, 82);
        ctx.lineTo(512 + s * 136, 238);
        ctx.lineTo(512 + s * 96, 226);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (type === 'ultra') {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(352, 26, 56, 214);
      ctx.fillRect(616, 26, 56, 214);
      ctx.fillRect(352, 22, 320, 48);
    } else if (type === 'master') {
      ctx.fillStyle = '#ec4899';
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(512 + s * 150, 128);
        ctx.rotate(s * 0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0, 46, 32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Crisp equatorial groove
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 242, W, 28);

    const tex = finalizeColorTexture(c, false, 4);
    textureCache.set(key, tex);
    return tex;
  }

  root.ParkTextures = {
    getBlobShadowTexture,
    getMeadowGrassTexture,
    getPokemonFaceTexture,
    getShellPlastronTexture,
    getCarapaceTexture,
    getTigerStripeTexture,
    getRafflesiaPetalTexture,
    getEggShellPatternTexture,
    getScaleBellyTexture,
    getPikachuBodyTexture,
    getEeveeTailTexture,
    getSnorlaxBodyTexture,
    getPiplupBodyTexture,
    getSpottedDinoTexture,
    getFuecocoBodyTexture,
    getSerpentBodyTexture,
    getAppleSkinTexture,
    getPokeballTexture,
  };
})(window);
