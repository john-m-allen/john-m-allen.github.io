// Reusable Interactive 3D Stage Turntable for Reveal & Poké Box modals (pure vanilla JS)
(function (root) {
  const THREE = root.THREE;
  const {
    attachEdgeOnlyFourStarAura,
    buildPokemon3D,
    getSharedGeo,
    getStdMat,
  } = root.PokemonBuilder;

  class Stage3D {
    constructor(canvas) {
      this.canvas = canvas;
      this.isSoftware = Boolean(root.isSoftwareWebGL);
      this.destroyed = false;
      this.dragging = false;
      this.lastX = 0;
      this.userYaw = 0.22;
      this.auraUpdater = null;
      this.frameId = 0;

      const geo = getSharedGeo();
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
      this.camera.position.set(0, 1.38, 3.85);
      this.camera.lookAt(0, 1.0, 0);

      this.scene.add(new THREE.HemisphereLight('#ffffff', '#34a853', 0.92));
      const dLight = new THREE.DirectionalLight('#fffbeb', 1.02);
      dLight.position.set(3, 6, 5);
      this.scene.add(dLight);
      const rim = new THREE.DirectionalLight('#e0f2fe', 0.36);
      rim.position.set(-4, 4, -5);
      this.scene.add(rim);

      const pedestal = new THREE.Mesh(geo.cyl, getStdMat('#86efac', 0.78, 0, 0, 0, 0.2));
      pedestal.position.y = -0.06;
      pedestal.scale.set(1.22, 0.12, 1.22);
      this.scene.add(pedestal);

      this.holder = new THREE.Group();
      this.scene.add(this.holder);

      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: !this.isSoftware,
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.98;
      this.renderer.setPixelRatio(this.isSoftware ? 1 : Math.min(window.devicePixelRatio || 1, 2));

      this.onPointerDown = (e) => {
        this.dragging = true;
        this.lastX = e.clientX;
      };
      this.onPointerMove = (e) => {
        if (!this.dragging) return;
        this.userYaw += (e.clientX - this.lastX) * 0.015;
        this.lastX = e.clientX;
      };
      this.onPointerUp = () => {
        this.dragging = false;
      };

      canvas.addEventListener('pointerdown', this.onPointerDown);
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);

      this.renderTick = this.renderTick.bind(this);
      this.renderTick();
    }

    setRecord(record) {
      while (this.holder.children.length > 0) {
        this.holder.remove(this.holder.children[0]);
      }
      this.auraUpdater = null;
      this.userYaw = 0.22;

      if (!record) return;
      const model = buildPokemon3D(record.species, record.isShiny, record.nature);
      this.holder.add(model);
      if (root.ParkRules.shouldShowFourStarAura(record.stars, 'box')) {
        this.auraUpdater = attachEdgeOnlyFourStarAura(
          this.holder,
          record.species,
          record.isShiny,
          record.nature
        );
      }
      this.renderOnce();
    }

    renderOnce() {
      if (this.destroyed) return;
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width >= 10 && rect.height >= 10) {
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        if (this.canvas.width !== w || this.canvas.height !== h) {
          this.renderer.setSize(w, h, false);
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
        }
        this.holder.rotation.y = this.userYaw;
        this.renderer.render(this.scene, this.camera);
      }
    }

    renderTick() {
      if (this.destroyed) return;
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width >= 10 && rect.height >= 10) {
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        if (this.canvas.width !== w || this.canvas.height !== h) {
          this.renderer.setSize(w, h, false);
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
        }
        if (!this.dragging) this.userYaw += this.isSoftware ? 0.03 : 0.012;
        this.holder.rotation.y = this.userYaw;
        if (this.auraUpdater) {
          this.auraUpdater.update(performance.now() * 0.001);
        }
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftware) {
        this.frameId = window.setTimeout(this.renderTick, 120);
      } else {
        this.frameId = requestAnimationFrame(this.renderTick);
      }
    }

    destroy() {
      this.destroyed = true;
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      this.renderer.dispose();
    }
  }

  root.Stage3D = Stage3D;
})(window);
