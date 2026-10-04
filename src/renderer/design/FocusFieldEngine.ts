// Decorative physics only. This scene never reads or changes project data.
type Point = { x: number; y: number };
type Figure = { kind: 'page' | 'note' | 'task' | 'orb'; x: number; y: number; z: number; offset: Point; screen: Point; scale: number; color: string };
type Pulse = Point & { age: number };
const TAU = Math.PI * 2;
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

export class FocusField {
  private ctx: CanvasRenderingContext2D | null;
  private width = 0;
  private height = 0;
  private raf = 0;
  private last = 0;
  private phase = 0;
  private scroll = 0;
  private yaw = -.18;
  private pitch = -.16;
  private pointer: Point = { x: -1000, y: -1000 };
  private gesture?: { id: number; start: Point; last: Point; figure?: Figure };
  private pulses: Pulse[] = [];
  private home = true;
  private paused = false;
  private reduced = false;
  private quiet = false;
  private disposed = false;
  private resize: ResizeObserver;
  private figures: Figure[] = [
    { kind: 'page', x: -192, y: -98, z: 105, color: '#aba9ff' },
    { kind: 'note', x: 143, y: -152, z: 32, color: '#e5c5a3' },
    { kind: 'task', x: 175, y: 125, z: 110, color: '#c4edb1' },
    { kind: 'orb', x: -137, y: 163, z: 80, color: '#8bc7df' },
    { kind: 'orb', x: 224, y: 0, z: -95, color: '#b6a0e3' },
  ].map(figure => ({ ...figure, offset: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, scale: 1 })) as Figure[];

  constructor(private canvas: HTMLCanvasElement, private surface: HTMLElement) {
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(surface);
    surface.addEventListener('pointermove', this.move);
    surface.addEventListener('pointerdown', this.down);
    surface.addEventListener('pointerleave', this.leave);
    surface.addEventListener('pointerup', this.up);
    surface.addEventListener('pointercancel', this.up);
    surface.addEventListener('lostpointercapture', this.up);
    surface.addEventListener('scroll', this.scrolling, { capture: true, passive: true });
    document.addEventListener('visibilitychange', this.visibility);
    this.measure();
    void document.fonts.load('500 12px "Manrope"').then(() => this.restart()).catch(() => {});
  }

  setMode(home: boolean, paused: boolean, reduced: boolean, quiet: boolean) {
    if (home !== this.home) this.scroll = 0;
    this.home = home; this.paused = paused; this.reduced = reduced; this.quiet = quiet;
    if (quiet) this.release();
    this.restart();
  }

  reset() {
    this.yaw = -.18; this.pitch = -.16;
    this.figures.forEach(figure => { figure.offset = { x: 0, y: 0 }; });
    this.pulses = []; this.restart();
  }

  rotate() { this.yaw += .25; this.restart(); }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.release(); this.resize.disconnect();
    this.surface.removeEventListener('pointermove', this.move);
    this.surface.removeEventListener('pointerdown', this.down);
    this.surface.removeEventListener('pointerleave', this.leave);
    this.surface.removeEventListener('pointerup', this.up);
    this.surface.removeEventListener('pointercancel', this.up);
    this.surface.removeEventListener('lostpointercapture', this.up);
    this.surface.removeEventListener('scroll', this.scrolling, true);
    document.removeEventListener('visibilitychange', this.visibility);
  }

  private get animated() { return !!this.ctx && !this.paused && !this.reduced && !this.quiet && !document.hidden; }
  private visibility = () => { if (document.hidden) { this.release(); cancelAnimationFrame(this.raf); } else this.restart(); };
  private scrolling = (event: Event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.classList.contains('space-home') || this.reduced) return;
    this.scroll = Math.min(event.target.scrollTop, 750);
    if (!this.animated) this.restart();
  };
  private blocked(target: EventTarget | null) {
    return !(target instanceof Element) || !!target.closest('button,a,input,textarea,select,[role="dialog"],[inert],.workspace-canvas,.sidebar,.memory-panel,.editor,.browser-section,.website-card-preview');
  }
  private local(event: PointerEvent): Point {
    const rect = this.surface.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  private move = (event: PointerEvent) => {
    if (this.quiet || (this.gesture && this.gesture.id !== event.pointerId)) return;
    const point = this.local(event);
    if (this.gesture) {
      const drag = this.gesture;
      if (drag.figure) {
        drag.figure.offset.x = clamp(drag.figure.offset.x + point.x - drag.last.x, this.width * .4);
        drag.figure.offset.y = clamp(drag.figure.offset.y + point.y - drag.last.y, this.height * .35);
      } else {
        this.yaw += (point.x - drag.last.x) * .005;
        this.pitch = clamp(this.pitch + (point.y - drag.last.y) * .003, .65);
      }
      drag.last = point;
    } else if (this.blocked(event.target)) {
      const visible = this.pointer.x > 0; this.pointer = { x: -1000, y: -1000 };
      if (visible && !this.animated) this.restart();
      return;
    }
    this.pointer = point;
    if (!this.animated) this.restart();
  };
  private down = (event: PointerEvent) => {
    if (this.quiet || this.gesture || event.button !== 0 || this.blocked(event.target)) return;
    const point = this.local(event);
    const figure = this.home ? [...this.figures].reverse().find(figure => Math.hypot(point.x - figure.screen.x, point.y - figure.screen.y) < (figure.kind === 'orb' ? 32 : 75) * figure.scale) : undefined;
    this.pointer = point;
    this.gesture = { id: event.pointerId, start: point, last: point, figure };
    this.surface.setPointerCapture(event.pointerId);
    if (!this.reduced) this.pulses = [...this.pulses.slice(-5), { ...point, age: 0 }];
    this.restart();
  };
  private release() {
    const id = this.gesture?.id; this.gesture = undefined;
    if (id !== undefined && this.surface.hasPointerCapture(id)) this.surface.releasePointerCapture(id);
  }
  private up = (event: PointerEvent) => { if (this.gesture?.id === event.pointerId) { this.release(); if (!this.animated) this.restart(); } };
  private leave = () => { if (!this.gesture) { this.pointer = { x: -1000, y: -1000 }; if (!this.animated) this.restart(); } };

  private measure() {
    const rect = this.surface.getBoundingClientRect(); this.width = rect.width; this.height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0); this.restart();
  }
  private restart() {
    cancelAnimationFrame(this.raf); this.last = 0;
    if (!this.disposed && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  }
  private frame = (time: number) => {
    if (this.disposed || document.hidden) return;
    if (!this.last || time - this.last >= 32) {
      const dt = this.last ? Math.min((time - this.last) / 1000, .07) : 0;
      this.last = time;
      if (this.animated) { this.phase += dt; this.pulses.forEach(pulse => { pulse.age += dt; }); this.pulses = this.pulses.filter(pulse => pulse.age < 1.6); }
      this.draw();
    }
    if (this.animated) this.raf = requestAnimationFrame(this.frame);
  };

  private project(x: number, y: number, z: number, center: Point, scale: number) {
    const yaw = this.yaw + Math.sin(this.phase * .1) * .08 + this.scroll * .0005;
    const rx = x * Math.cos(yaw) - z * Math.sin(yaw);
    const rz = x * Math.sin(yaw) + z * Math.cos(yaw);
    const ry = y * Math.cos(this.pitch) - rz * Math.sin(this.pitch);
    const depth = y * Math.sin(this.pitch) + rz * Math.cos(this.pitch);
    const perspective = 700 / (700 - depth);
    return { x: center.x + rx * scale * perspective, y: center.y + ry * scale * perspective, depth, scale: scale * perspective };
  }

  private draw() {
    const ctx = this.ctx; if (!ctx || !this.width || !this.height) return;
    const w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h);
    const compact = w < 900;
    const center = { x: compact ? w * .5 : w * .72, y: (compact ? 560 : Math.min(h * .46, 420)) - this.scroll * .1 };
    const scale = compact ? Math.min(.65, w / 580) : Math.min(1.1, w / 1280);
    const driftX = this.pointer.x > 0 ? (this.pointer.x / w - .5) * 14 : 0;
    const driftY = this.pointer.y > 0 ? (this.pointer.y / h - .5) * 10 : 0;
    // Deterministic stars: no random work or allocations in the animation loop.
    for (let i = 0; i < 92; i++) {
      const x = ((i * 137.508) % w) + driftX * (i % 3 + 1);
      const y = ((i * 71.93 + 43) % h) + driftY * (i % 2 + 1);
      ctx.fillStyle = `rgba(191,197,229,${.12 + (Math.sin(this.phase * .5 + i) + 1) * .08})`;
      ctx.beginPath(); ctx.arc(x, y, i % 11 === 0 ? 1.4 : .65, 0, TAU); ctx.fill();
    }
    if (this.home) {
      ctx.save(); ctx.globalAlpha = Math.max(.14, 1 - this.scroll / 450);
      const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, 340 * scale);
      glow.addColorStop(0, '#8580f92a'); glow.addColorStop(.48, '#746df517'); glow.addColorStop(1, '#716af000');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      this.drawOrbit(center, scale, 225, -.55); this.drawOrbit(center, scale, 270, .6);
      this.drawCore(center, scale);
      const sorted = [...this.figures].sort((a, b) => a.z - b.z);
      for (const figure of sorted) {
        const point = this.project(figure.x, figure.y + Math.sin(this.phase * .55 + figure.x) * 7, figure.z, center, scale);
        let x = point.x + figure.offset.x, y = point.y + figure.offset.y;
        const dx = x - this.pointer.x, dy = y - this.pointer.y, distance = Math.hypot(dx, dy);
        if (distance < 140 && this.gesture?.figure !== figure && !this.reduced) { const force = (1 - distance / 140) * 10; x += dx / Math.max(distance, 1) * force; y += dy / Math.max(distance, 1) * force; }
        if (compact) {
          const edge = (figure.kind === 'orb' ? 26 : 74) * point.scale + 12;
          x = Math.max(edge, Math.min(w - edge, x));
          // Keep the compact reading/action area clear, even in a short zoomed viewport.
          y = Math.max(420, Math.min(Math.max(h - 100, 700), y));
        }
        figure.screen = { x, y }; figure.scale = point.scale;
        ctx.strokeStyle = '#a8a0e01a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(x, y); ctx.stroke();
        this.drawFigure(figure, x, y, point.scale, distance < 85 * point.scale);
      }
      ctx.restore();
    }
    if (this.pointer.x > 0 && !this.quiet) {
      const light = ctx.createRadialGradient(this.pointer.x, this.pointer.y, 0, this.pointer.x, this.pointer.y, 160);
      light.addColorStop(0, '#a79cff10'); light.addColorStop(1, '#a79cff00'); ctx.fillStyle = light; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c3b9ff70'; ctx.lineWidth = .75;
      ctx.beginPath(); ctx.arc(this.pointer.x, this.pointer.y, this.gesture ? 16 : 8, 0, TAU); ctx.stroke();
    }
    for (const pulse of this.pulses) {
      ctx.strokeStyle = `rgba(172,160,255,${Math.max(0, .35 * (1 - pulse.age / 1.6))})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(pulse.x, pulse.y, 12 + pulse.age * 115, 0, TAU); ctx.stroke();
    }
  }

  private drawOrbit(center: Point, scale: number, radius: number, tilt: number) {
    const ctx = this.ctx!;
    for (let i = 0; i < 96; i++) {
      const a = i / 96 * TAU, b = (i + 1) / 96 * TAU;
      const p = this.project(Math.cos(a) * radius, Math.sin(a) * radius * Math.sin(tilt), Math.sin(a) * radius * Math.cos(tilt), center, scale);
      const q = this.project(Math.cos(b) * radius, Math.sin(b) * radius * Math.sin(tilt), Math.sin(b) * radius * Math.cos(tilt), center, scale);
      ctx.strokeStyle = p.depth > 0 ? '#b4a7f14a' : '#8882bb22'; ctx.lineWidth = p.depth > 0 ? 1 : .65;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      if (i % 24 === 0) { ctx.fillStyle = '#c7bbf8'; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, TAU); ctx.fill(); }
    }
    // A quiet moving thread connects the scattered pieces of a project.
    for (let i = 7; i >= 0; i--) {
      const angle = this.phase * .22 + tilt * 4 - i * .018;
      const point = this.project(Math.cos(angle) * radius, Math.sin(angle) * radius * Math.sin(tilt), Math.sin(angle) * radius * Math.cos(tilt), center, scale);
      ctx.fillStyle = `rgba(222,211,255,${(1 - i / 8) * .7})`;
      ctx.beginPath(); ctx.arc(point.x, point.y, (i === 0 ? 2.2 : 1.2) * scale, 0, TAU); ctx.fill();
    }
  }

  private drawCore(center: Point, scale: number) {
    const ctx = this.ctx!, r = 118 * scale;
    const gradient = ctx.createRadialGradient(center.x - r * .3, center.y - r * .4, 2, center.x, center.y, r);
    gradient.addColorStop(0, '#a6a5dd'); gradient.addColorStop(.22, '#7777b4'); gradient.addColorStop(.62, '#343857'); gradient.addColorStop(.94, '#171d32'); gradient.addColorStop(1, '#8a83c680');
    ctx.save(); ctx.shadowColor = '#7771f645'; ctx.shadowBlur = 45;
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(center.x, center.y, r, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(center.x, center.y, r, 0, TAU); ctx.clip();
    for (let line = -2; line <= 2; line++) {
      ctx.strokeStyle = '#c8c2ed22'; ctx.lineWidth = .8; ctx.beginPath();
      for (let i = 0; i <= 70; i++) {
        const a = i / 70 * TAU + this.phase * .025;
        const lat = line * .4, ring = Math.cos(lat) * 117;
        const p = this.project(Math.cos(a) * ring, Math.sin(lat) * 117, Math.sin(a) * ring, center, scale);
        if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.restore();
    // A little luminous north star: the place your scattered work returns to.
    ctx.save(); ctx.translate(center.x, center.y); ctx.rotate(this.yaw * .3);
    ctx.fillStyle = '#e9e6ff'; ctx.shadowColor = '#c2b9ff'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(0, -22 * scale); ctx.quadraticCurveTo(4 * scale, -4 * scale, 22 * scale, 0); ctx.quadraticCurveTo(4 * scale, 4 * scale, 0, 22 * scale); ctx.quadraticCurveTo(-4 * scale, 4 * scale, -22 * scale, 0); ctx.quadraticCurveTo(-4 * scale, -4 * scale, 0, -22 * scale); ctx.fill(); ctx.restore();
  }

  private drawFigure(figure: Figure, x: number, y: number, scale: number, hover: boolean) {
    const ctx = this.ctx!; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    if (figure.kind === 'orb') {
      const gradient = ctx.createRadialGradient(-8, -10, 1, 0, 0, 24); gradient.addColorStop(0, figure.color); gradient.addColorStop(1, '#273043');
      ctx.shadowColor = '#0008'; ctx.shadowBlur = 24; ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
    } else {
      const note = figure.kind === 'note', width = note ? 98 : 142, height = note ? 122 : 98;
      ctx.rotate(figure.kind === 'page' ? -.13 : note ? .13 : -.04);
      ctx.shadowColor = hover ? `${figure.color}50` : '#0008'; ctx.shadowBlur = hover ? 26 : 24; ctx.shadowOffsetY = 14;
      const fill = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
      fill.addColorStop(0, note ? '#b69b83' : '#35394f'); fill.addColorStop(1, note ? '#726152' : '#1c2234');
      ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(-width / 2, -height / 2, width, height, 12); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.strokeStyle = hover ? figure.color : '#c2c4e34a'; ctx.lineWidth = 1; ctx.stroke();
      if (figure.kind === 'page') {
        ctx.fillStyle = '#b9b5d4'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-width / 2 + 14 + i * 8, -height / 2 + 12, 1.6, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = '#c0bce122'; ctx.beginPath(); ctx.moveTo(-width / 2, -height / 2 + 24); ctx.lineTo(width / 2, -height / 2 + 24); ctx.stroke();
        ctx.fillStyle = '#b3adf2'; ctx.beginPath(); ctx.roundRect(-width / 2 + 14, -height / 2 + 36, 28, 25, 5); ctx.fill();
        ctx.fillStyle = '#dedbed'; ctx.font = '500 13px "Manrope", "Segoe UI", sans-serif'; ctx.fillText('Explore', -width / 2 + 14, 30);
        ctx.fillStyle = '#888baf'; ctx.fillRect(-width / 2 + 50, -height / 2 + 40, 52, 3); ctx.fillRect(-width / 2 + 50, -height / 2 + 50, 36, 3);
      } else if (note) {
        ctx.fillStyle = '#fff1df'; ctx.font = '500 13px "Manrope", "Segoe UI", sans-serif'; ctx.fillText('Keep', -width / 2 + 13, -height / 2 + 27);
        ctx.strokeStyle = '#ecd7bf65'; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-width / 2 + 13, -height / 2 + 46 + i * 13); ctx.lineTo(width / 2 - 14 - (i === 3 ? 25 : 0), -height / 2 + 46 + i * 13); ctx.stroke(); }
      } else {
        ctx.fillStyle = figure.color; ctx.beginPath(); ctx.arc(-width / 2 + 26, -14, 12, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#354539'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-width / 2 + 21, -14); ctx.lineTo(-width / 2 + 25, -10); ctx.lineTo(-width / 2 + 32, -18); ctx.stroke();
        ctx.fillStyle = '#e2e9df'; ctx.font = '500 13px "Manrope", "Segoe UI", sans-serif'; ctx.fillText('Continue', -width / 2 + 14, 25);
        ctx.fillStyle = '#858d9e'; ctx.fillRect(-width / 2 + 48, -18, 62, 3); ctx.fillRect(-width / 2 + 48, -8, 39, 3);
      }
    }
    ctx.restore();
  }
}
