/**
 * ORB NANO WEBGL (three.js) — versi "film" orb asisten di dalam web toko.
 *
 * Dimuat BELAKANGAN (dynamic import setelah halaman tampil) agar toko tetap cepat.
 * Tiap orb asisten (.kc-orb.has-nano) mendapat kanvas WebGL sendiri: ribuan partikel
 * dengan lipatan organik (simplex noise di GPU), tepi lebih pekat, pita cincin, mata,
 * dan morf ke bintang ✦. Bila WebGL tidak tersedia, orb kanvas 2D (nano-orb.js) tetap dipakai.
 */
import * as THREE from "three";

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

function buildGeometry(count) {
    const dir = new Float32Array(count * 3);
    const star = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const th = i * 2.399963229728653;
        const x = Math.cos(th) * r;
        const z = Math.sin(th) * r;
        dir.set([x, y, z], i * 3);
        const a = Math.atan2(y, x);
        const q = 0.55;
        const f = 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), q) + Math.pow(Math.abs(Math.sin(a)), q), 1 / q);
        star.set([x * f * 1.45, y * f * 1.45, z * f * 0.32], i * 3);
        rnd[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(dir, 3));
    geo.setAttribute("aStar", new THREE.BufferAttribute(star, 3));
    geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));
    return geo;
}

function makeMaterial(px) {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        premultipliedAlpha: true,
        uniforms: { uTime: { value: 0 }, uMorph: { value: 0 }, uPx: { value: px } },
        vertexShader: /* glsl */ `
        ${NOISE}
        uniform float uTime, uMorph, uPx;
        attribute vec3 aStar; attribute float aRnd;
        varying vec3 vCol; varying float vA;
        void main(){
          vec3 d = position;
          float n = snoise(d*1.4 + vec3(0., uTime*.25, uTime*.18))*.28
                  + snoise(d*3.1 - vec3(uTime*.35))*.10
                  + snoise(d*7.0 + uTime*.6)*.025;
          vec3 orb = d * (1.25 + n);
          float k = clamp(uMorph*1.6 - aRnd*.6, 0., 1.);
          k = k*k*(3.-2.*k);
          vec3 p = mix(orb, aStar*(1.+n*.15), k);
          vec4 mv = modelViewMatrix * vec4(p,1.);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.0 + aRnd*0.8) * uPx;
          float t = clamp((1. - d.y)*.5 + n*.6, 0., 1.);
          vec3 c1 = vec3(.16,.50,1.0), c2 = vec3(.33,.33,.98), c3 = vec3(.58,.22,.95), c4 = vec3(.93,.25,.66);
          vCol = t < .33 ? mix(c1,c2,t/.33) : t < .66 ? mix(c2,c3,(t-.33)/.33) : mix(c3,c4,(t-.66)/.34);
          vec3 vn = normalize(normalMatrix * normalize(orb));
          float rim = 1. - abs(vn.z);
          float back = step(0., -vn.z) * .45;
          vA = (.42 + .58 * pow(rim, 1.2)) * (1. - back * .7);
        }`,
        fragmentShader: /* glsl */ `
        varying vec3 vCol; varying float vA;
        void main(){
          float d = length(gl_PointCoord - .5);
          if (d > .5) discard;
          float a = vA * smoothstep(.5, .2, d);
          gl_FragColor = vec4(vCol * a, a);
        }`,
    });
}

const views = new Set();

function attachGL(host) {
    if (host.dataset.nanoGl === "1") return;
    const canvas = document.createElement("canvas");
    canvas.className = "kc-nano-gl";
    canvas.setAttribute("aria-hidden", "true");
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
        return; // tanpa WebGL: tetap orb 2D
    }
    host.dataset.nanoGl = "1";
    host.appendChild(canvas);
    host.classList.add("gl-on");
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 0, 7.2);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mat = makeMaterial(dpr);
    const cloud = new THREE.Points(buildGeometry(7000), mat);
    scene.add(cloud);
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.05, 0.03, 6, 160, Math.PI * 1.2),
        new THREE.MeshBasicMaterial({ color: 0x3d7dff, transparent: true, opacity: 0.75 })
    );
    ring.visible = false; // pita dihapus (permintaan Koko)
    const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(2.3, 0.02, 6, 160, Math.PI * 0.7),
        new THREE.MeshBasicMaterial({ color: 0xe0489f, transparent: true, opacity: 0.55 })
    );
    ring2.visible = false;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1240, transparent: true });
    const eyes = new THREE.Group();
    for (const x of [-0.24, 0.24]) {
        const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 6, 16), eyeMat);
        e.position.set(x, 0.05, 1.6);
        eyes.add(e);
    }
    scene.add(eyes);
    views.add({ host, renderer, scene, camera, mat, cloud, ring, ring2, eyes, eyeMat, morph: 0, morphTo: 0, blink: 0, size: 0 });
}

export function morphGL(shape) {
    views.forEach((v) => {
        v.morphTo = shape === "star" ? 1 : 0;
    });
}

let last = performance.now();
function loop(now) {
    requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    last = now;
    if (document.hidden) return;
    const dt = Math.min(0.05, raw);
    const realDt = Math.min(0.25, raw);
    const t = now / 1000;
    views.forEach((v) => {
        if (!v.host.isConnected) {
            v.renderer.dispose();
            views.delete(v);
            return;
        }
        const base = v.host.clientWidth;
        if (!base || (v.host !== masterHost && v.host.offsetParent === null) || v.host.classList.contains("is-away")) return;
        if (v.host === masterHost && !visibleMinis.size) return;
        const size = Math.round(base * 1.9);
        if (v.size !== size) {
            v.size = size;
            v.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            v.renderer.setSize(size, size, false);
            // titik makin kecil di orb kecil agar tetap halus
            v.mat.uniforms.uPx.value = Math.max(1, (size / 110)) * Math.min(window.devicePixelRatio || 1, 2) * 0.55;
        }
        v.morph += (v.morphTo - v.morph) * Math.min(1, realDt * 1.8);
        v.mat.uniforms.uTime.value = t;
        v.mat.uniforms.uMorph.value = v.morph;
        const face = v.morph;
        v.cloud.rotation.y = t * 0.3 * (1 - face) + Math.sin(t * 0.8) * 0.25 * face;
        v.cloud.rotation.x = 0.25 * (1 - face);
        v.cloud.scale.setScalar(1 + Math.sin(t * 1.3) * 0.03);
        v.ring.rotation.set(1.15 + Math.sin(t * 0.5) * 0.2, t * 0.7, t * 0.4);
        v.ring2.rotation.set(-0.9 + Math.cos(t * 0.4) * 0.25, -t * 0.5, t * 0.25);
        v.blink = (v.blink + dt) % 4.2;
        v.eyes.scale.y = v.blink > 4.05 ? 0.12 : 1;
        v.eyeMat.opacity = Math.max(0, 1 - v.morph * 1.8);
        v.renderer.render(v.scene, v.camera);
    });
    drawMinis(now);
}

/* ============================================================
   ORB MINI (kartu produk, avatar chat, tombol Chat AI)
   SATU mesin 3D (orb "induk" tersembunyi) menggambar orb sekali per frame,
   lalu gambarnya DISALIN ke semua ikon kecil yang terlihat. Ringan: berapa pun
   jumlah ikon, tetap hanya 1 mesin WebGL.
   ============================================================ */
const MINI_SELECTOR = "#appRoot .product-ask, .ai-message--ai, .kc-mini-orb-host";
const minis = new Set();
const visibleMinis = new Set();
let masterHost = null;
let lastMini = 0;
const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? visibleMinis.add(e.target) : visibleMinis.delete(e.target))))
    : null;

function ensureMaster() {
    if (masterHost) return;
    masterHost = document.createElement("div");
    masterHost.setAttribute("aria-hidden", "true");
    Object.assign(masterHost.style, { position: "absolute", left: "-9999px", top: "0", width: "56px", height: "56px", pointerEvents: "none" });
    document.body.appendChild(masterHost);
    attachGL(masterHost);
}

function attachMini(host) {
    if (host.dataset.miniOrb === "1") return;
    host.dataset.miniOrb = "1";
    const c = document.createElement("canvas");
    c.className = "kc-mini-orb";
    c.setAttribute("aria-hidden", "true");
    if (host.classList.contains("ai-message--ai")) host.prepend(c);
    else host.appendChild(c);
    host.classList.add("has-mini-orb");
    minis.add(c);
    if (io) io.observe(c);
    else visibleMinis.add(c);
}

function drawMinis(now) {
    if (!visibleMinis.size || now - lastMini < 40) return; // ±24 fps cukup untuk ikon kecil
    lastMini = now;
    const src = masterHost?.querySelector("canvas");
    if (!src || !src.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    visibleMinis.forEach((c) => {
        if (!c.isConnected) {
            visibleMinis.delete(c);
            minis.delete(c);
            return;
        }
        const w = Math.round(c.clientWidth * dpr);
        if (!w) return;
        if (c.width !== w) {
            c.width = w;
            c.height = w;
        }
        const g = c.getContext("2d");
        g.clearRect(0, 0, w, w);
        g.drawImage(src, 0, 0, w, w);
    });
}

function scanMinis() {
    document.querySelectorAll(MINI_SELECTOR).forEach(attachMini);
}

export function startGL() {
    document.querySelectorAll(".kc-orb.has-nano").forEach(attachGL);
    ensureMaster();
    scanMinis();
    // orb/ikon yang dibuat belakangan ikut ditingkatkan (dikumpulkan per frame agar hemat)
    let pending = 0;
    new MutationObserver(() => {
        if (pending) return;
        pending = requestAnimationFrame(() => {
            pending = 0;
            document.querySelectorAll(".kc-orb.has-nano:not([data-nano-gl])").forEach(attachGL);
            scanMinis();
        });
    }).observe(document.body, { subtree: true, childList: true });
    requestAnimationFrame(loop);
}
