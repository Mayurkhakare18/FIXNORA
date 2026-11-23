import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useApp } from '../../context/AppContext';
import { Btn } from '../ui/Primitives';
import heroInkImg from '../../assets/hero-ink.jpg';

gsap.registerPlugin(ScrollTrigger);

// Helper easing and curves
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sub = (a: number, b: number) => (h: number) => clamp01((h - a) / (b - a));

const bez = (x1: number, y1: number, x2: number, y2: number) => {
  const f = (t: number, a: number, b: number) =>
    3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 40; i++) {
      t = (lo + hi) / 2;
      f(t, x1, x2) < x ? (lo = t) : (hi = t);
    }
    return f(t, y1, y2);
  };
};

const INK_E = bez(0.7, 0, 0.2, 1);
const expoOut = (t: number) => {
  const p = 1 - t;
  return 1 - (Math.pow(2, 10 * (p - 1)) * p + Math.pow(p, 6) * (1 - p));
};

const WN = {
  dev1: [0.04, 0.48],
  dev2: [0.52, 0.96],
  in1: [0.08, 0.5],
  in2: [0.52, 0.92],
  sc1: [0, 0.5],
  sc2: [0.5, 1],
  eb: [0.02, 0.16],
  l1: [0.06, 0.26],
  l2: [0.14, 0.34],
  scrim: [0.6, 0.9],
  cap: [0.78, 0.94],
  cta: [0.84, 0.98],
};

function tracks(h: number) {
  const lg = (w: number[], a: number, b: number) => lerp(a, b, INK_E(sub(w[0], w[1])(h)));
  const rv = (w: number[]) => expoOut(sub(w[0], w[1])(h));
  const isFirstHalf = h < 0.5;

  return {
    develop: isFirstHalf ? lg(WN.dev1, 0, 0.42) : lg(WN.dev2, 0.42, 1),
    inset: isFirstHalf ? lg(WN.in1, 0.22, 0.1) : lg(WN.in2, 0.1, 0),
    wash: isFirstHalf ? lg(WN.dev1, 1, 0.55) : lg(WN.dev2, 0.55, 0),
    scale: isFirstHalf ? lg(WN.sc1, 1.1, 1.05) : lg(WN.sc2, 1.05, 1),
    eb: rv(WN.eb),
    l1: rv(WN.l1),
    l2: rv(WN.l2),
    scrim: lg(WN.scrim, 0, 1),
    cap: rv(WN.cap),
    cta: rv(WN.cta),
    station: h < 0.25 ? 0 : h < 0.75 ? 1 : 2,
  };
}

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uResolution, uCover, uPointer;
uniform float uProgress, uInset, uWash, uScale, uFeather, uGrain, uNoiseScale, uHasImage, uPointerR;
uniform vec3 uPaper, uInk;

uint hashU(uvec2 p){
  uint n = p.x * 1664525u ^ (p.y * 22695477u + 12345u);
  n ^= n >> 15u;
  n *= 2246822519u;
  n ^= n >> 13u;
  n *= 3266489917u;
  n ^= n >> 16u;
  return n;
}

float hash2(vec2 p){
  ivec2 ip = ivec2(floor(p)) + 32768;
  return float(hashU(uvec2(ip))) / 4294967295.0;
}

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
  for(int i = 0; i < 5; i++){
    v += a * vnoise(p);
    p = m * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;
  vec2 tuv = 0.5 + (uv - 0.5) * uCover / uScale;
  vec3 img = mix(uPaper, texture(uTex, tuv).rgb, uHasImage);
  vec2 d = min(uv, 1.0 - uv);
  float brush = (vnoise(uv * vec2(aspect, 1.0) * 70.0) - 0.5) * 0.012 * smoothstep(0.0, 0.04, uInset);
  float e = min(d.x, d.y) - uInset + brush;
  float frame = uInset <= 0.0005 ? 1.0 : smoothstep(0.0, 0.006, e);
  vec2 q = uv * vec2(aspect, 1.0);
  float n = fbm(q * uNoiseScale) + (vnoise(q * uNoiseScale * 9.0) - 0.5) * 0.07;
  float w = max(uFeather, 0.002) * 0.5;
  float t = mix(-w - 0.03, 1.0 + w, uProgress);
  vec2 dp = (uv - uPointer) * vec2(aspect, 1.0);
  float touch = uPointerR > 0.0 ? exp(-dot(dp, dp) / (uPointerR * uPointerR)) : 0.0;
  t += touch * 0.28 * (1.0 - uProgress);
  float reveal = 1.0 - smoothstep(t - w, t + w, n);
  float band = smoothstep(t - w * 1.2, t, n) * (1.0 - smoothstep(t, t + w * 0.25, n));
  float rim = 1.0 - smoothstep(0.0, w * 0.35, abs(n - t));
  float lum = dot(img, vec3(0.299, 0.587, 0.114));
  vec3 washed = mix(uPaper, mix(img, vec3(lum), 0.6), 0.45);
  vec3 col = mix(img, washed, uWash);
  col = mix(col, uInk, band * 0.7 * (0.35 + 0.65 * uWash));
  col *= 1.0 - rim * 0.45 * (0.5 + 0.5 * uWash);
  col += (hash2(uv * uResolution * 0.5) - 0.5) * uGrain * 0.12;
  float sheet = 0.07 * (1.0 - uProgress);
  vec3 sheetCol = mix(uPaper, uInk, 0.35);
  float alpha = max(reveal, sheet) * frame;
  vec3 outCol = mix(sheetCol, col, reveal / max(max(reveal, sheet), 0.0001));
  fragColor = vec4(outCol * alpha, alpha);
}`;

class InkGL {
  c: HTMLCanvasElement;
  g: WebGL2RenderingContext | null = null;
  img: HTMLImageElement | null = null;
  p: WebGLProgram | null = null;
  L: Record<string, WebGLUniformLocation | null> = {};
  ok = false;
  last: any = null;

  constructor(c: HTMLCanvasElement, cb: (ok: boolean) => void) {
    this.c = c;
    this.ok = this.init();
    cb(this.ok);
  }

  init(): boolean {
    const g = (this.g = this.c.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
    }));
    if (!g || g.isContextLost()) return false;

    const sh = (ty: number, s: string) => {
      const o = g.createShader(ty);
      if (!o) return null;
      g.shaderSource(o, s);
      g.compileShader(o);
      if (!g.getShaderParameter(o, g.COMPILE_STATUS)) {
        console.error('[SHADER]', g.getShaderInfoLog(o));
        return null;
      }
      return o;
    };

    const vs = sh(g.VERTEX_SHADER, VERT);
    const fs = sh(g.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;

    const p = (this.p = g.createProgram());
    if (!p) return false;
    g.attachShader(p, vs);
    g.attachShader(p, fs);
    g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) return false;

    g.useProgram(p);
    g.bindVertexArray(g.createVertexArray());
    const buf = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
    const a = g.getAttribLocation(p, 'aPos');
    g.enableVertexAttribArray(a);
    g.vertexAttribPointer(a, 2, g.FLOAT, false, 0, 0);

    this.L = {};
    const tex = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, tex);
    [
      [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE],
      [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE],
      [g.TEXTURE_MIN_FILTER, g.LINEAR],
      [g.TEXTURE_MAG_FILTER, g.LINEAR],
    ].forEach(([k, v]) => g.texParameteri(g.TEXTURE_2D, k, v));

    g.texImage2D(
      g.TEXTURE_2D,
      0,
      g.RGBA,
      1,
      1,
      0,
      g.RGBA,
      g.UNSIGNED_BYTE,
      new Uint8Array([128, 128, 128, 255])
    );
    g.uniform1i(this.u('uTex'), 0);
    g.uniform1f(this.u('uHasImage'), 0);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, 1);
    return true;
  }

  u(n: string) {
    if (this.L[n] !== undefined) return this.L[n];
    return (this.L[n] = this.g && this.p ? this.g.getUniformLocation(this.p, n) : null);
  }

  setImage(i: HTMLImageElement) {
    this.img = i;
    const g = this.g;
    if (!this.ok || !g) return;
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, i);
    g.uniform1f(this.u('uHasImage'), 1);
  }

  resize(w: number, h: number, dpr: number) {
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    if (this.c.width !== W || this.c.height !== H) {
      this.c.width = W;
      this.c.height = H;
    }
    this.g?.viewport(0, 0, W, H);
  }

  render(opts: any) {
    this.last = opts;
    const g = this.g;
    if (!this.ok || !g) return;
    g.useProgram(this.p);

    g.uniform2f(this.u('uResolution'), this.c.width, this.c.height);
    const iW = this.img?.naturalWidth || 1;
    const iH = this.img?.naturalHeight || 1;
    const cA = this.c.width / this.c.height;
    const iA = iW / iH;
    const cover = cA > iA ? [1, iA / cA] : [cA / iA, 1];
    g.uniform2f(this.u('uCover'), cover[0], cover[1]);

    g.uniform1f(this.u('uProgress'), opts.p);
    g.uniform1f(this.u('uInset'), opts.inset);
    g.uniform1f(this.u('uWash'), opts.wash);
    g.uniform1f(this.u('uScale'), opts.scale);
    g.uniform1f(this.u('uFeather'), 0.05);
    g.uniform1f(this.u('uGrain'), 0.35);
    g.uniform1f(this.u('uNoiseScale'), 3.6);
    g.uniform2f(this.u('uPointer'), opts.ptr[0], opts.ptr[1]);
    g.uniform1f(this.u('uPointerR'), opts.pr);
    g.uniform3fv(this.u('uPaper'), opts.paper);
    g.uniform3fv(this.u('uInk'), opts.ink);

    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    this.g = null;
    this.ok = false;
  }
}

// Text reveal mask
const Mask: React.FC<{
  r?: (el: HTMLElement | null) => void;
  children: React.ReactNode;
  className?: string;
  inner?: string;
}> = ({ r, children, className = '', inner = '' }) => (
  <span className={`block overflow-clip [overflow-clip-margin:0.12em] ${className}`}>
    <span
      ref={r}
      className={`block will-change-transform ${inner}`}
      style={{ transform: 'translate3d(0, 101%, 0)' }}
    >
      {children}
    </span>
  </span>
);

export const InkHero: React.FC = () => {
  const { t } = useApp();
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const eb = useRef<HTMLSpanElement>(null);
  const cta = useRef<HTMLSpanElement>(null);
  const cap = useRef<HTMLSpanElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLElement>(null);
  const ln = useRef<(HTMLElement | null)[]>([]);
  const [webGlSupported, setWebGlSupported] = useState<boolean | null>(null);

  const headline = t('h1');
  const words = headline.split(' ');
  const mid = Math.ceil(words.length / 2);
  const lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const el = root.current;
    const sg = stage.current;
    const c = cv.current;
    if (!el || !sg || !c) return;

    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const setY = (node: HTMLElement | null) => (val: number) => {
      if (node) node.style.transform = `translate3d(0, ${val}%, 0)`;
    };

    const sE = setY(eb.current);
    const sC = setY(cta.current);
    const sP = setY(cap.current);
    const sL = ln.current.map(setY);

    const gl = new InkGL(c, setWebGlSupported);
    const paper = [246 / 255, 248 / 255, 250 / 255];
    const ink = [38 / 255, 59 / 255, 82 / 255];
    const ptr = [-10, -10];
    let pr = 0;
    let lastH = rm ? 1 : 0;
    let lastStation = -1;

    const paint = (h: number) => {
      lastH = h;
      const v = tracks(h);
      sE((1 - v.eb) * 101);
      sL.forEach((s, idx) => s((1 - (idx ? v.l2 : v.l1)) * 101));
      sC((1 - v.cta) * 101);
      sP((1 - v.cap) * 101);
      if (scrim.current) scrim.current.style.opacity = String(v.scrim);
      if (rail.current && v.station !== lastStation) {
        lastStation = v.station;
        rail.current.dataset.station = String(v.station);
      }

      if (gl.ok) {
        gl.render({
          p: v.develop,
          inset: v.inset,
          wash: v.wash,
          scale: v.scale,
          paper,
          ink,
          ptr,
          pr,
        });
      } else {
        el.style.setProperty('--ink-inset', String(v.inset));
        el.style.setProperty('--ink-develop', String(v.develop));
        el.style.setProperty('--ink-progress', String(h));
      }
    };

    const img = new Image();
    img.onload = () => {
      gl.setImage(img);
      paint(lastH);
    };
    img.src = heroInkImg;

    const ro = new ResizeObserver(([entry]) => {
      const rect = entry?.contentRect;
      if (!rect) return;
      gl.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 1.5));
      paint(lastH);
    });
    ro.observe(sg);

    const isFine = window.matchMedia('(pointer: fine)').matches;
    const onPointerMove = (e: PointerEvent) => {
      if (!gl.ok || rm || !isFine) return;
      const rect = sg.getBoundingClientRect();
      ptr[0] = (e.clientX - rect.left) / rect.width;
      ptr[1] = 1 - (e.clientY - rect.top) / rect.height;
      pr = 0.11;
      paint(lastH);
    };

    const onPointerLeave = () => {
      if (pr) {
        pr = 0;
        paint(lastH);
      }
    };

    sg.addEventListener('pointermove', onPointerMove, { passive: true });
    sg.addEventListener('pointerleave', onPointerLeave, { passive: true });

    let targetP = 0;
    let currentP = 0;
    let rafId = 0;

    const animateProgress = () => {
      rafId = 0;
      const diff = targetP - currentP;
      if (Math.abs(diff) < 0.0006) {
        currentP = targetP;
      } else {
        currentP += diff * 0.16;
        rafId = requestAnimationFrame(animateProgress);
      }
      paint(currentP);
    };

    const kick = () => {
      if (!rafId) rafId = requestAnimationFrame(animateProgress);
    };

    let st: ScrollTrigger | undefined;

    if (rm) {
      paint(1);
    } else {
      paint(0);
      st = ScrollTrigger.create({
        trigger: el,
        start: 'top 60px',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          targetP = self.progress;
          kick();
        },
        onRefresh: (self) => {
          targetP = currentP = self.progress;
          paint(currentP);
        },
      });
    }

    return () => {
      cancelAnimationFrame(rafId);
      sg.removeEventListener('pointermove', onPointerMove);
      sg.removeEventListener('pointerleave', onPointerLeave);
      if (st) st.kill();
      ro.disconnect();
      img.onload = null;
      gl.dispose();
    };
  }, []);

  const goToStation = (idx: number) => {
    const el = root.current;
    const sg = stage.current;
    if (!el || !sg) return;
    const targetY = Math.round(
      el.getBoundingClientRect().top +
        window.scrollY -
        60 +
        (Math.max(0, el.offsetHeight - sg.offsetHeight) * idx) / 2
    );
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  return (
    <section
      ref={root}
      id="home"
      aria-label="Fixnora"
      className="relative w-full bg-background"
      style={{
        height: prefersReduced ? 'auto' : 'calc(100svh - 60px + 240vh)',
        ['--ink-inset' as any]: 0.22,
        ['--ink-develop' as any]: 0,
        ['--ink-progress' as any]: 0,
      }}
    >
      <div ref={stage} className="sticky top-[60px] h-[calc(100svh-60px)] w-full overflow-clip">
        <canvas
          ref={cv}
          aria-hidden="true"
          className={`absolute inset-0 block h-full w-full ${webGlSupported === false ? 'hidden' : ''}`}
        />
        <img
          src={heroInkImg}
          alt="Illustrated neighbourhood with streetlights and marked complaint locations"
          className={`absolute inset-0 h-full w-full object-cover ${webGlSupported !== false ? 'sr-only' : ''}`}
          style={
            webGlSupported === false
              ? {
                  clipPath: 'inset(calc(var(--ink-inset)*100%))',
                  opacity: 'calc(0.15 + 0.85*var(--ink-develop))',
                  transform: 'scale(calc(1.1 - 0.1*var(--ink-progress)))',
                }
              : undefined
          }
        />
        <div
          ref={scrim}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-background via-background/70 to-transparent"
          style={{ opacity: 0 }}
        />
        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-6xl items-end justify-between gap-8 px-5 pb-8 md:pb-12">
          <div className="max-w-3xl">
            <Mask r={(n) => { (eb as any).current = n; }} className="mb-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-bd bg-card px-3 py-1 text-xs font-semibold tracking-wide text-navy shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
                {t('lbl')}
              </span>
            </Mask>
            <h1 className="text-balance text-4xl font-bold leading-[1.04] tracking-tight text-navy md:text-6xl lg:text-7xl">
              {lines.map((l, i) => (
                <Mask key={i} r={(n) => { ln.current[i] = n; }}>
                  {l}
                </Mask>
              ))}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Mask r={(n) => { (cta as any).current = n; }}>
                <Btn as="a" href="#track" v="p" className="rounded-full px-6">
                  {t('c1')} →
                </Btn>
              </Mask>
              <Mask r={(n) => { (cap as any).current = n; }} inner="text-xs text-muted-foreground">
                {t('tag')}
              </Mask>
            </div>
          </div>
          <nav
            ref={rail}
            data-station="0"
            aria-label="Stations"
            className="group hidden flex-col items-end gap-3 text-xs font-semibold text-muted-foreground md:flex"
          >
            {['Report', 'Track', 'Resolve'].map((label, idx) => (
              <button
                key={label}
                type="button"
                aria-label={`Go to the ${label} station`}
                onClick={() => goToStation(idx)}
                className={`flex items-center gap-2 rounded transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100 opacity-40 ${
                  idx === 0
                    ? 'group-data-[station="0"]:opacity-100'
                    : idx === 1
                    ? 'group-data-[station="1"]:opacity-100'
                    : 'group-data-[station="2"]:opacity-100'
                }`}
              >
                {label}
                <span className="block h-1.5 w-1.5 rounded-full bg-teal" />
              </button>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
};
