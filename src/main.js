(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / Math.max(1e-6, b - a));
    return t * t * (3 - 2 * t);
  };
  const fadeWindow = (p, start, end, feather = 0.07) => {
    const f = Math.min(feather, (end - start) * 0.34);
    return smoothstep(start, start + f, p) * (1 - smoothstep(end - f, end, p));
  };

  const root = document.documentElement;
  const loader = $('#loader');
  const loaderPercent = $('#loaderPercent');
  const loaderTrack = $('#loaderTrack');
  const heroSection = $('#cinematic');
  const heroVideo = $('#heroVideo');
  const filmCard = $('#filmCard');
  const frameReadout = $('#frameReadout');
  const heroTimecode = $('#heroTimecode');
  const heroProgressEl = $('#heroProgress');
  const railFill = $('#railFill');
  const railIndex = $('#railIndex');
  const heroScenes = $$('.hero-scene');
  const chapters = $$('.chapter');
  const soundButton = $('#soundButton');
  const cursor = $('#cursor');
  const depthCanvas = $('#depthCanvas');
  const confettiCanvas = $('#confettiCanvas');
  const helixCanvas = $('#helixCanvas');
  const ecgPath = $('#ecgPath');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mobile = matchMedia('(max-width: 820px)').matches || coarse;
  const saveData = !!navigator.connection?.saveData;
  const deviceMemory = navigator.deviceMemory || 8;
  const lowPower = saveData || deviceMemory <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  const qaFreeze = new URLSearchParams(location.search).get('freeze') === '1';
  const FPS = 15;
  const TOTAL_FRAMES = 231;
  const VIDEO_DURATION = TOTAL_FRAMES / FPS;

  let viewportH = innerHeight;
  let viewportW = innerWidth;
  let scrollY = window.scrollY;
  let targetHeroP = 0;
  let smoothHeroP = 0;
  let targetFrame = 0;
  let displayedFrame = 0;
  let lastAppliedFrame = -1;
  let heroReady = false;
  let assetsReady = 0;
  let loaderClosed = false;
  let raf = 0;
  let lastScrollY = scrollY;
  let scrollVelocity = 0;
  let pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let chapterMetrics = [];
  let activeChapter = 0;

  function setLoader(p) {
    const v = Math.round(clamp(p) * 100);
    loaderPercent.textContent = String(v).padStart(2, '0');
    loaderTrack.style.width = `${v}%`;
  }

  function closeLoader() {
    if (loaderClosed) return;
    loaderClosed = true;
    setLoader(1);
    setTimeout(() => loader.classList.add('is-hidden'), 260);
  }

  function chooseVideo() {
    const useMobile = mobile || lowPower;
    const src = useMobile ? 'assets/hero-scrub-mobile.mp4' : 'assets/hero-scrub-desktop.mp4';
    heroVideo.src = src;
    heroVideo.muted = true;
    heroVideo.playsInline = true;
    heroVideo.preload = 'auto';
    heroVideo.load();
    heroVideo.pause();

    const done = () => {
      heroReady = true;
      heroVideo.pause();
      try { heroVideo.currentTime = 0; } catch {}
      assetsReady += 0.55;
      setLoader(assetsReady);
      setTimeout(closeLoader, 220);
    };

    if (heroVideo.readyState >= 1) done();
    else heroVideo.addEventListener('loadedmetadata', done, { once: true });
    heroVideo.addEventListener('error', () => {
      heroReady = false;
      closeLoader();
    }, { once: true });
  }

  function preloadImages() {
    const imgs = $$('img');
    if (!imgs.length) return;
    let completed = 0;
    const mark = () => {
      completed += 1;
      assetsReady = Math.max(assetsReady, 0.15 + (completed / imgs.length) * 0.3);
      setLoader(Math.min(0.88, assetsReady));
    };
    imgs.forEach((img) => {
      if (img.complete) mark();
      else {
        img.addEventListener('load', mark, { once: true });
        img.addEventListener('error', mark, { once: true });
      }
    });
  }

  function computeMetrics() {
    viewportH = innerHeight;
    viewportW = innerWidth;
    chapterMetrics = chapters.map((section) => ({
      el: section,
      top: section.offsetTop,
      span: Math.max(1, section.offsetHeight - viewportH),
      chapter: Number(section.dataset.chapter || 0)
    }));
    resizeCanvases();
  }

  function heroProgressFromScroll(y) {
    const span = Math.max(1, heroSection.offsetHeight - viewportH);
    return clamp((y - heroSection.offsetTop) / span);
  }

  function applyHeroFrame() {
    if (!heroReady || reduceMotion) return;
    targetFrame = Math.round(targetHeroP * (TOTAL_FRAMES - 1));
    const diff = targetFrame - displayedFrame;
    if (Math.abs(diff) >= 0.5) {
      const maxStep = mobile ? 2.25 : 3.5;
      displayedFrame += Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
    } else {
      displayedFrame = targetFrame;
    }
    const frame = clamp(Math.round(displayedFrame), 0, TOTAL_FRAMES - 1);
    if (frame !== lastAppliedFrame && heroVideo.readyState >= 1) {
      const t = Math.min((frame / FPS), Math.max(0, (heroVideo.duration || VIDEO_DURATION) - 0.034));
      try {
        heroVideo.pause();
        heroVideo.currentTime = t;
      } catch {}
      lastAppliedFrame = frame;
      frameReadout.textContent = `FRAME ${String(frame).padStart(3, '0')} / ${TOTAL_FRAMES - 1}`;
      const sec = frame / FPS;
      const s = Math.floor(sec);
      const ff = frame % FPS;
      heroTimecode.textContent = `00:${String(s).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
    }
  }

  function updateHeroUI(p) {
    heroProgressEl.style.width = `${p * 100}%`;
    heroScenes.forEach((scene, i) => {
      const start = Number(scene.dataset.start || 0);
      const end = Number(scene.dataset.end || 1);
      const a = reduceMotion ? (i === 0 ? 1 : 0) : fadeWindow(p, start, end, 0.075);
      const mid = (start + end) / 2;
      const local = clamp((p - start) / Math.max(1e-6, end - start));
      const y = (0.5 - local) * (mobile ? 22 : 46);
      const blur = (1 - a) * (mobile ? 6 : 11);
      const scale = 0.985 + a * 0.015;
      scene.style.opacity = a.toFixed(3);
      scene.style.filter = `blur(${blur.toFixed(2)}px)`;
      if (innerWidth > 820) scene.style.transform = `translate3d(0, calc(-50% + ${y}px), 0) scale(${scale})`;
      else scene.style.transform = `translate3d(0, ${y}px, 0) scale(${scale})`;
      scene.classList.toggle('is-live', a > 0.55);
      if (a < 0.04) scene.setAttribute('aria-hidden', 'true');
      else scene.setAttribute('aria-hidden', 'false');
    });

    const tiltX = pointer.sy * (mobile ? 0.4 : 1.2) + scrollVelocity * 0.002;
    const tiltY = pointer.sx * (mobile ? 0.55 : 1.5);
    const z = Math.sin(p * Math.PI) * (mobile ? 7 : 18);
    const roll = (p - 0.5) * (mobile ? 0.35 : 0.7);
    filmCard.style.transform = `translate(-50%,-50%) perspective(1500px) translateZ(${z}px) rotateX(${tiltX}deg) rotateY(${-2 + tiltY}deg) rotateZ(${roll}deg)`;
    const shine = $('.film-card__shine');
    shine.style.transform = `translateX(${(-130 + p * 260).toFixed(1)}%)`;
  }

  function chapterProgress(metric, y) {
    return clamp((y - metric.top) / metric.span);
  }

  function updateChapters(y) {
    let best = { idx: 0, dist: Infinity };
    chapterMetrics.forEach((m, index) => {
      const p = chapterProgress(m, y);
      const localCenter = Math.abs(p - 0.5);
      const isNear = y >= m.top - viewportH * 0.4 && y <= m.top + m.span + viewportH * 0.4;
      if (isNear && localCenter < best.dist) best = { idx: m.chapter, dist: localCenter };

      const contentA = fadeWindow(p, 0.10, 0.91, 0.14);
      const contentY = lerp(44, -28, p);
      const bgScale = lerp(1.12, 1.025, p);
      const bgX = (p - 0.5) * (mobile ? 1.2 : 2.6);
      const bgY = (p - 0.5) * (mobile ? -1.5 : -3.4);
      const numX = (p - 0.5) * (mobile ? 18 : 52);
      m.el.style.setProperty('--content-alpha', contentA.toFixed(3));
      m.el.style.setProperty('--content-y', `${contentY.toFixed(1)}px`);
      m.el.style.setProperty('--content-blur', `${((1 - contentA) * 7).toFixed(1)}px`);
      const content = $('.chapter__content', m.el);
      if (content) {
        const ty = innerWidth > 820 ? `calc(-50% + ${contentY.toFixed(1)}px)` : `${contentY.toFixed(1)}px`;
        content.style.transform = `translate3d(0,${ty},0)`;
      }
      m.el.style.setProperty('--bg-scale', bgScale.toFixed(4));
      m.el.style.setProperty('--bg-x', `${bgX.toFixed(2)}%`);
      m.el.style.setProperty('--bg-y', `${bgY.toFixed(2)}%`);
      m.el.style.setProperty('--num-x', `${numX.toFixed(1)}px`);
      m.el.style.setProperty('--card-alpha', fadeWindow(p, 0.22, 0.84, 0.12).toFixed(3));

      if (m.el.classList.contains('chapter--campus')) {
        m.el.style.setProperty('--steth-dash', `${(1500 * (1 - smoothstep(0.12, 0.62, p))).toFixed(0)}`);
        m.el.style.setProperty('--steth-alpha', `${0.07 + smoothstep(0.18, 0.6, p) * 0.34}`);
        m.el.style.setProperty('--steth-x', `${lerp(60, -20, p)}px`);
        m.el.style.setProperty('--steth-y', `${lerp(-20, 40, p)}px`);
      }

      if (m.el.classList.contains('chapter--learning')) {
        m.el.style.setProperty('--helix-alpha', `${fadeWindow(p, 0.12, 0.9, 0.18) * 0.88}`);
        drawHelix(p);
      }

      if (m.el.classList.contains('chapter--clinical')) {
        const a = fadeWindow(p, 0.16, 0.88, 0.12);
        m.el.style.setProperty('--monitor-alpha', a.toFixed(3));
        m.el.style.setProperty('--monitor-y', `${lerp(-34, 24, p)}px`);
        m.el.style.setProperty('--ecg-dash', `${(1100 * (1 - smoothstep(0.18, 0.72, p))).toFixed(0)}`);
        m.el.style.setProperty('--beam-alpha', `${0.09 + a * 0.38}`);
      }

      if (m.el.classList.contains('chapter--graduation')) {
        drawConfetti(p, aFromRange(p, 0.28, 0.92));
      }

      $$('[data-tilt]', m.el).forEach((card, k) => {
        const a = fadeWindow(p, 0.18, 0.88, 0.15);
        const ry = (pointer.sx * (mobile ? 2 : 6)) + (p - 0.5) * (k ? 5 : -5);
        const rx = (-pointer.sy * (mobile ? 1.5 : 4)) + (0.5 - p) * 2;
        const ty = (0.5 - p) * (mobile ? 26 : 58);
        card.style.transform = `translate3d(0,${ty}px,${a * 34}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${k ? 1.5 : -1.8}deg)`;
      });
    });

    const finale = $('#finale');
    if (finale) {
      const r = finale.getBoundingClientRect();
      if (r.top < viewportH * 0.6) best = { idx: 5, dist: 0 };
    }

    if (best.idx !== activeChapter) activeChapter = best.idx;
    railIndex.textContent = String(activeChapter).padStart(2, '0');
    const docMax = Math.max(1, document.documentElement.scrollHeight - viewportH);
    railFill.style.height = `${clamp(y / docMax) * 100}%`;
  }

  function aFromRange(p, start, end) {
    return fadeWindow(p, start, end, 0.12);
  }

  // Reversible depth particle field — tied to scroll and pointer, not a looping novelty animation.
  const dctx = depthCanvas.getContext('2d');
  const particleCount = lowPower ? 120 : (mobile ? 220 : 420);
  const particles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: Math.random(),
    size: 0.35 + Math.random() * 1.4,
    tone: Math.random()
  }));

  function resizeCanvas(canvas, ctx, dprCap = 1.5) {
    const dpr = Math.min(devicePixelRatio || 1, dprCap);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resizeCanvases() {
    resizeCanvas(depthCanvas, dctx, mobile ? 1.1 : 1.5);
    resizeCanvas(confettiCanvas, confettiCanvas.getContext('2d'), mobile ? 1 : 1.35);
    if (helixCanvas) resizeCanvas(helixCanvas, helixCanvas.getContext('2d'), mobile ? 1 : 1.3);
  }

  function drawDepth() {
    dctx.clearRect(0, 0, viewportW, viewportH);
    const heroA = 1 - smoothstep(0.94, 1, targetHeroP);
    const amount = mobile ? 0.55 : 0.8;
    const cx = viewportW * (0.5 + pointer.sx * 0.035);
    const cy = viewportH * (0.48 + pointer.sy * 0.025);
    const speedBias = Math.min(1, Math.abs(scrollVelocity) / 80);
    for (const p of particles) {
      const z = ((p.z + scrollY * 0.000055) % 1 + 1) % 1;
      const depth = 0.18 + z * 1.15;
      const x = cx + p.x * viewportW * depth * 0.64;
      const y = cy + p.y * viewportH * depth * 0.55;
      if (x < -20 || x > viewportW + 20 || y < -20 || y > viewportH + 20) continue;
      const a = (0.05 + z * 0.2) * amount * (0.75 + heroA * 0.25);
      const r = p.size * (0.4 + z * 1.5 + speedBias * 0.3);
      dctx.beginPath();
      dctx.arc(x, y, r, 0, Math.PI * 2);
      dctx.fillStyle = p.tone > 0.86 ? `rgba(201,169,97,${a})` : `rgba(207,230,232,${a * 0.7})`;
      dctx.fill();
    }
  }

  const hctx = helixCanvas?.getContext('2d');
  function drawHelix(p) {
    if (!helixCanvas || !hctx) return;
    const w = helixCanvas.clientWidth || 400;
    const h = helixCanvas.clientHeight || 500;
    hctx.clearRect(0, 0, w, h);
    const cx = w * 0.5;
    const radius = Math.min(w, h) * 0.19;
    const span = h * 0.86;
    const points = 40;
    const phase = p * Math.PI * 3.2;
    for (let i = 0; i < points; i++) {
      const t = i / (points - 1);
      const y = h * 0.07 + t * span;
      const a = phase + t * Math.PI * 5.6;
      const z1 = Math.sin(a);
      const z2 = Math.sin(a + Math.PI);
      const x1 = cx + Math.cos(a) * radius;
      const x2 = cx + Math.cos(a + Math.PI) * radius;
      if (i % 3 === 0) {
        hctx.beginPath();
        hctx.moveTo(x1, y);
        hctx.lineTo(x2, y);
        hctx.strokeStyle = 'rgba(213,233,235,.16)';
        hctx.lineWidth = 1;
        hctx.stroke();
      }
      [[x1,z1],[x2,z2]].forEach(([x,z], j) => {
        const r = 2.4 + (z + 1) * 2.2;
        const alpha = 0.24 + (z + 1) * 0.22;
        hctx.beginPath();
        hctx.arc(x, y, r, 0, Math.PI * 2);
        hctx.fillStyle = (i + j) % 5 === 0 ? `rgba(230,207,145,${alpha})` : `rgba(138,184,194,${alpha})`;
        hctx.shadowBlur = 10;
        hctx.shadowColor = hctx.fillStyle;
        hctx.fill();
        hctx.shadowBlur = 0;
      });
    }
  }

  const cctx = confettiCanvas.getContext('2d');
  const confetti = Array.from({ length: lowPower ? 65 : (mobile ? 110 : 180) }, (_, i) => ({
    x: Math.random(), y: Math.random() * -0.7, speed: 0.42 + Math.random() * 1.05,
    drift: (Math.random() - 0.5) * 0.22, rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 9, size: 4 + Math.random() * 8,
    gold: i % 4 === 0
  }));
  function drawConfetti(p, alpha) {
    cctx.clearRect(0, 0, viewportW, viewportH);
    if (alpha <= 0.005) return;
    const q = smoothstep(0.22, 0.88, p);
    for (const c of confetti) {
      const x = (c.x + c.drift * q + Math.sin((q + c.rot) * 5) * 0.018) * viewportW;
      const y = (c.y + q * c.speed * 1.75) * viewportH;
      if (y < -40 || y > viewportH + 40) continue;
      const rot = c.rot + q * c.spin;
      cctx.save();
      cctx.translate(x, y);
      cctx.rotate(rot);
      cctx.globalAlpha = alpha * 0.78;
      cctx.fillStyle = c.gold ? '#d9bb72' : '#d9d5cb';
      cctx.fillRect(-c.size * 0.5, -c.size * 0.26, c.size, c.size * 0.52);
      cctx.restore();
    }
  }

  // Subtle procedural audio. Off by default.
  const audio = { ctx: null, master: null, drone: null, noise: null, on: false };
  async function enableAudio() {
    if (!audio.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const master = ctx.createGain(); master.gain.value = 0.0; master.connect(ctx.destination);
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 48;
      const og = ctx.createGain(); og.gain.value = 0.08; osc.connect(og).connect(master); osc.start();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 280;
      const ng = ctx.createGain(); ng.gain.value = 0.018; src.connect(filter).connect(ng).connect(master); src.start();
      audio.ctx = ctx; audio.master = master; audio.drone = osc; audio.noise = ng;
    }
    await audio.ctx.resume();
    audio.on = true;
    audio.master.gain.setTargetAtTime(0.16, audio.ctx.currentTime, 0.3);
    soundButton.setAttribute('aria-pressed','true');
  }
  function disableAudio() {
    if (!audio.ctx) return;
    audio.on = false;
    audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.25);
    soundButton.setAttribute('aria-pressed','false');
  }
  soundButton.addEventListener('click', () => audio.on ? disableAudio() : enableAudio());

  function updateAudio() {
    if (!audio.on || !audio.ctx) return;
    const now = audio.ctx.currentTime;
    audio.drone.frequency.setTargetAtTime(46 + activeChapter * 4 + Math.min(8, Math.abs(scrollVelocity) * 0.04), now, 0.3);
    audio.noise.gain.setTargetAtTime(0.012 + (activeChapter === 3 ? 0.012 : 0.004), now, 0.4);
  }

  function onScroll() {
    scrollY = window.scrollY;
    const delta = scrollY - lastScrollY;
    scrollVelocity = lerp(scrollVelocity, delta, 0.32);
    lastScrollY = scrollY;
    targetHeroP = heroProgressFromScroll(scrollY);
  }

  function onPointer(e) {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  }

  function animateCursor(e) {
    if (!cursor || coarse) return;
    cursor.style.transform = `translate3d(${e.clientX - 17}px,${e.clientY - 17}px,0)`;
  }

  function frameLoop() {
    smoothHeroP = reduceMotion ? targetHeroP : lerp(smoothHeroP, targetHeroP, mobile ? 0.27 : 0.18);
    pointer.sx = lerp(pointer.sx, pointer.x, 0.08);
    pointer.sy = lerp(pointer.sy, pointer.y, 0.08);
    scrollVelocity *= 0.88;

    if (!reduceMotion) applyHeroFrame();
    updateHeroUI(smoothHeroP);
    updateChapters(scrollY);
    drawDepth();
    updateAudio();

    if (!qaFreeze) raf = requestAnimationFrame(frameLoop);
  }

  function initCursor() {
    if (coarse || !cursor) return;
    document.addEventListener('pointermove', (e) => { onPointer(e); animateCursor(e); }, { passive: true });
    $$('a,button').forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hot'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hot'));
    });
  }

  function initLinks() {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const target = id && $(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  function applyQAQuery() {
    const q = new URLSearchParams(location.search).get('qa');
    if (!q) return;
    const map = { hero: 0.12, hero2: 0.42, hero3: 0.68, hero4: 0.9 };
    if (q in map) {
      const span = heroSection.offsetHeight - viewportH;
      scrollTo(0, heroSection.offsetTop + span * map[q]);
      return;
    }
    const el = document.getElementById(q);
    if (el) scrollTo(0, el.offsetTop + Math.max(0, el.offsetHeight - viewportH) * 0.45);
  }

  function init() {
    setLoader(0.05);
    preloadImages();
    chooseVideo();
    computeMetrics();
    initCursor();
    initLinks();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('resize', () => { computeMetrics(); targetHeroP = heroProgressFromScroll(window.scrollY); }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        heroVideo.pause();
        if (audio.ctx) audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
      } else if (audio.on) audio.master.gain.setTargetAtTime(0.16, audio.ctx.currentTime, 0.25);
    });
    onScroll();
    if (reduceMotion) {
      heroVideo.poster = 'assets/hero-poster.webp';
      try { heroVideo.currentTime = 0; } catch {}
    }
    requestAnimationFrame(() => {
      applyQAQuery();
      onScroll();
      frameLoop();
      if (qaFreeze) setTimeout(() => { onScroll(); smoothHeroP = targetHeroP; displayedFrame = targetHeroP * (TOTAL_FRAMES - 1); applyHeroFrame(); updateHeroUI(smoothHeroP); updateChapters(scrollY); drawDepth(); }, 900);
    });
    setTimeout(closeLoader, 3600);
  }

  init();
})();
