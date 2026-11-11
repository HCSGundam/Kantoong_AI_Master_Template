/**
 * KANTOONG KENZO AI — ORB NANO versi layar pameran (three.js, open source).
 * Puluhan ribu partikel: lipatan organik (simplex noise di GPU), pendar (bloom),
 * pita cincin biru, mata, berubah jadi bintang ✦ berkala, bereaksi pada mouse/sentuhan.
 * Tombol: F = layar penuh, H = sembunyikan tulisan, Spasi/klik = jadi bintang.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const COUNT = window.innerWidth < 900 ? 16000 : 30000;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 7.2);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.45, 0.12);
composer.addPass(bloom);
composer.addPass(new OutputPass());
addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
});

/* ---------- partikel ---------- */
const dir = new Float32Array(COUNT * 3);
const star = new Float32Array(COUNT * 3);
const rnd = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.399963229728653;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    dir.set([x, y, z], i * 3);
    // bintang ✦ empat ujung (astroid), tebal di tengah
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

const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uPointer: { value: new THREE.Vector3(9, 9, 9) },
        uAgitate: { value: 0 },
        uPx: { value: Math.min(devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
    ${NOISE}
    uniform float uTime, uMorph, uAgitate, uPx;
    uniform vec3 uPointer;
    attribute vec3 aStar; attribute float aRnd;
    varying vec3 vCol; varying float vA;
    void main(){
      vec3 d = position;
      // lipatan organik bertingkat (seperti kain/cairan)
      float n = snoise(d*1.4 + vec3(0., uTime*.25, uTime*.18))*.28
              + snoise(d*3.1 - vec3(uTime*.35))*.10
              + snoise(d*7.0 + uTime*.6)*.025;
      n *= 1. + uAgitate*1.4;
      vec3 orb = d * (1.25 + n);
      // morf bergelombang per partikel (mengalir, tidak serentak)
      float k = clamp(uMorph*1.6 - aRnd*.6, 0., 1.);
      k = k*k*(3.-2.*k);
      vec3 p = mix(orb, aStar*(1.+n*.15), k);
      // didorong pointer (mouse/sentuhan)
      vec3 toP = p - uPointer; float dist = length(toP);
      p += normalize(toP) * .35 * exp(-dist*dist*3.);
      vec4 mv = modelViewMatrix * vec4(p,1.);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (1.7 + aRnd*1.1) * uPx * (6.5 / -mv.z);
      // warna: biru (atas) → ungu → merah muda (bawah), digeser lipatan
      float t = clamp((1. - d.y)*.5 + n*.6, 0., 1.);
      vec3 c1 = vec3(.27,.67,1.0), c2 = vec3(.45,.45,1.0), c3 = vec3(.72,.33,1.0), c4 = vec3(1.0,.36,.78);
      vCol = t < .33 ? mix(c1,c2,t/.33) : t < .66 ? mix(c2,c3,(t-.33)/.33) : mix(c3,c4,(t-.66)/.34);
      vCol += vec3(.18) * pow(max(0., n*3.), 2.);   // puncak lipatan lebih terang
      // tepi menyala, tengah lebih gelap (seperti foto referensi)
      vec3 vn = normalize(normalMatrix * normalize(orb));
      float rim = 1. - abs(vn.z);
      float back = step(0., -vn.z) * .35;              // sisi belakang redup
      vA = (.32 + .95 * pow(rim, 1.3)) * (1. - back);
    }`,
    fragmentShader: /* glsl */ `
    varying vec3 vCol; varying float vA;
    void main(){
      float d = length(gl_PointCoord - .5);
      if (d > .5) discard;
      gl_FragColor = vec4(vCol * vA, 1.) * smoothstep(.5, .15, d);
    }`,
});
const cloud = new THREE.Points(geo, mat);
scene.add(cloud);

/* ---------- pita cincin biru (seperti di video referensi) ---------- */
const ringGeo = new THREE.TorusGeometry(2.05, 0.011, 8, 220, Math.PI * 1.2);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
const ring = new THREE.Mesh(ringGeo, ringMat);
scene.add(ring);
const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.006, 6, 220, Math.PI * 0.7), new THREE.MeshBasicMaterial({ color: 0xff7ad9, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending }));
scene.add(ring2);

/* ---------- mata ---------- */
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
const eyes = new THREE.Group();
for (const x of [-0.18, 0.18]) {
    const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 6, 16), eyeMat);
    e.position.set(x, 0.05, 1.45);
    eyes.add(e);
}
scene.add(eyes);

/* ---------- interaksi ---------- */
const capMode = document.getElementById("mode");
let morphTo = 0;
let morph = 0;
let agitate = 0;
const pointer = new THREE.Vector2(9, 9);
const pointer3 = new THREE.Vector3(9, 9, 9);
const ray = new THREE.Raycaster();
let lastMove = 0;
addEventListener("pointermove", (e) => {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    lastMove = performance.now();
    agitate = Math.min(1, agitate + 0.08);
});
const toStar = () => {
    morphTo = 1;
    capMode.textContent = "AI ORB · BERPIKIR ✦";
    setTimeout(() => { morphTo = 0; capMode.textContent = "AI ORB · SIAGA"; }, 4200);
};
addEventListener("pointerdown", toStar);
addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") document.documentElement.requestFullscreen?.();
    if (e.key === "h" || e.key === "H") document.body.classList.toggle("hide");
    if (e.key === " ") toStar();
});
setInterval(toStar, 10000);

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let blink = 0;
function frame() {
    requestAnimationFrame(frame);
    const raw = clock.getDelta();
    const dt = Math.min(0.05, raw);
    const realDt = Math.min(0.25, raw); // morf mengikuti waktu nyata (tidak melambat di laptop lemah)
    const t = clock.elapsedTime;
    morph += (morphTo - morph) * Math.min(1, realDt * 1.8);
    agitate *= 0.96;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uMorph.value = morph;
    mat.uniforms.uAgitate.value = agitate;
    // titik pointer di bidang orb
    if (performance.now() - lastMove < 2000) {
        ray.setFromCamera(pointer, camera);
        ray.ray.at(camera.position.z - 0.2, pointer3);
        pointer3.applyMatrix4(cloud.matrixWorld.clone().invert());
    } else pointer3.set(9, 9, 9);
    mat.uniforms.uPointer.value.copy(pointer3);

    // putaran: melambat & menghadap depan saat jadi bintang
    const face = morph;
    cloud.rotation.y = t * 0.22 * (1 - face) + Math.sin(t * 0.8) * 0.25 * face;
    cloud.rotation.x = 0.25 * (1 - face) + pointer.y * 0.08;
    const s = 1 + Math.sin(t * 1.3) * 0.025; // napas
    cloud.scale.setScalar(s);

    ring.rotation.set(1.15 + Math.sin(t * 0.5) * 0.2, t * 0.6, t * 0.35);
    ring2.rotation.set(-0.9 + Math.cos(t * 0.4) * 0.25, -t * 0.45, t * 0.2);

    // mata: berkedip, hilang saat jadi bintang
    blink = (blink + dt) % 4.2;
    eyes.scale.y = blink > 4.05 ? 0.12 : 1;
    eyeMat.opacity = Math.max(0, 1 - morph * 1.8);
    eyes.position.y = Math.sin(t * 1.3) * 0.03;

    composer.render();
}
frame();
