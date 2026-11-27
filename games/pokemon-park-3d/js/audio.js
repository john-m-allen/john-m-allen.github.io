// Procedural Web Audio SFX synthesizer (pure vanilla JS, zero external audio assets)
(function (root) {
  class SoundEngine {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    getContext() {
      if (!this.enabled) return null;
      try {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return this.ctx;
      } catch {
        return null;
      }
    }

    tone(freq = 520, duration = 0.12, type = 'sine', delay = 0, gainPeak = 0.08, endFreq = null) {
      const ctx = this.getContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq !== null) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
        }
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
      } catch {
        // Ignore autoplay errors
      }
    }

    step() {
      this.tone(250 + Math.random() * 55, 0.055, 'triangle', 0, 0.022, 175);
    }

    tapPokemon() {
      this.tone(523.25, 0.09, 'triangle', 0, 0.09);
      this.tone(659.25, 0.12, 'triangle', 0.07, 0.09);
    }

    buddyCheer() {
      this.tone(587.33, 0.08, 'triangle', 0, 0.08);
      this.tone(783.99, 0.09, 'triangle', 0.07, 0.08);
      this.tone(1046.5, 0.16, 'sine', 0.14, 0.09);
    }

    shiny() {
      this.tone(880, 0.11, 'sine', 0, 0.08);
      this.tone(1174.66, 0.11, 'sine', 0.08, 0.08);
      this.tone(1567.98, 0.24, 'sine', 0.16, 0.09);
    }

    throwBall() {
      this.tone(360, 0.16, 'sine', 0, 0.08, 720);
    }

    bounce() {
      this.tone(240, 0.12, 'triangle', 0, 0.07, 130);
    }

    absorb() {
      this.tone(480, 0.16, 'sine', 0, 0.09, 960);
      this.tone(720, 0.18, 'triangle', 0.08, 0.07, 1180);
    }

    shake() {
      this.tone(340, 0.08, 'triangle', 0, 0.06, 260);
    }

    breakFree() {
      this.tone(380, 0.18, 'sawtooth', 0, 0.06, 190);
    }

    catchFanfare(stars) {
      this.tone(523.25, 0.13, 'triangle', 0, 0.1);
      this.tone(659.25, 0.13, 'triangle', 0.1, 0.1);
      this.tone(783.99, 0.16, 'triangle', 0.2, 0.11);
      this.tone(1046.5, 0.3, 'triangle', 0.32, 0.12);
      if (stars === 4) {
        this.tone(1318.5, 0.36, 'sine', 0.45, 0.12);
      }
    }

    flee() {
      this.tone(392, 0.13, 'triangle', 0, 0.07, 293.66);
      this.tone(261.63, 0.2, 'triangle', 0.11, 0.07, 174.61);
    }
  }

  root.ParkSFX = new SoundEngine();
})(window);
