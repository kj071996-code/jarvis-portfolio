// ── Scene 2 · The world ────────────────────────────────────────────────────
// A dark plain of glowing points that undulates (vertex-shader noise) and
// ripples around the avatar. Warm elliptical light on the horizon, thin
// vertical beams rising like data rain, a small human silhouette as the
// avatar, and one glowing beacon pillar per project in config.js.
import * as THREE from 'three'

const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
`

function makeRadialTexture(inner, outer) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, inner)
  g.addColorStop(0.35, outer)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeLabelSprite(text, color) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 512, 128)
  ctx.font = '500 44px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = color
  ctx.shadowBlur = 22
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text.toLowerCase(), 256, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(7.5, 1.9, 1)
  return sprite
}

export function createWorld(config, reducedMotion) {
  const group = new THREE.Group()
  const W = config.world
  const isMobile = window.innerWidth < 768
  const gridN = isMobile ? W.terrain.pointsMobile : W.terrain.pointsDesktop
  const size = W.terrain.size
  const half = size / 2

  // ── Terrain points ──────────────────────────────────────────────────────
  const count = gridN * gridN
  const positions = new Float32Array(count * 3)
  let p = 0
  for (let ix = 0; ix < gridN; ix++) {
    for (let iz = 0; iz < gridN; iz++) {
      positions[p++] = -half + (ix / (gridN - 1)) * size
      positions[p++] = 0
      positions[p++] = -half + (iz / (gridN - 1)) * size
    }
  }
  const terrainGeo = new THREE.BufferGeometry()
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const terrainUniforms = {
    uTime: { value: 0 },
    uAvatar: { value: new THREE.Vector2(W.avatar.start[0], W.avatar.start[2]) },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uWaveAmp: { value: reducedMotion ? W.terrain.waveAmp * 0.3 : W.terrain.waveAmp },
    uRippleAmp: { value: reducedMotion ? 0 : W.terrain.rippleAmp },
  }
  const terrainMat = new THREE.ShaderMaterial({
    uniforms: terrainUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uAvatar;
      uniform float uPixelRatio;
      uniform float uWaveAmp;
      uniform float uRippleAmp;
      varying float vH;
      varying float vGlow;
      ${NOISE_GLSL}
      void main() {
        vec3 pos = position;
        float n = noise(pos.xz * 0.045) * 0.6 + noise(pos.xz * 0.12 + 7.3) * 0.4;
        float y = (n - 0.5) * 2.2 * uWaveAmp
                + sin(uTime * 0.6 + pos.x * 0.05 + pos.z * 0.04) * 0.35 * uWaveAmp;
        float d = distance(pos.xz, uAvatar);
        float ripple = sin(d * 0.9 - uTime * 3.0) * exp(-d * 0.22) * uRippleAmp;
        y += ripple;
        vH = n;
        vGlow = exp(-d * 0.18);
        vec4 mv = modelViewMatrix * vec4(pos.x, y, pos.z, 1.0);
        gl_PointSize = (2.0 + vH * 2.2) * uPixelRatio * (170.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vH;
      varying float vGlow;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.05, length(c));
        vec3 base = mix(vec3(0.5, 0.53, 0.58), vec3(0.9, 0.95, 1.0), vH);
        vec3 green = vec3(0.42, 0.95, 0.62);
        vec3 col = mix(base, green, smoothstep(0.74, 0.95, vH) * 0.7);
        col += vec3(0.45, 0.85, 0.55) * vGlow * 0.2;
        gl_FragColor = vec4(col, a * 0.7);
      }
    `,
  })
  const terrain = new THREE.Points(terrainGeo, terrainMat)
  terrain.frustumCulled = false
  group.add(terrain)

  // ── Sky dust (static stars, for depth) ──────────────────────────────────
  {
    const starCount = isMobile ? 400 : 900
    const sp = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 320
      sp[i * 3 + 1] = 12 + Math.random() * 90
      sp[i * 3 + 2] = -40 - Math.random() * 160
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    const sm = new THREE.PointsMaterial({
      color: 0xcfd4da, size: 0.55, sizeAttenuation: true,
      transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    const stars = new THREE.Points(sg, sm)
    stars.frustumCulled = false
    group.add(stars)
  }

  // ── Horizon light (warm-white ellipse, additive sprite) ─────────────────
  const horizonTex = makeRadialTexture('rgba(255,243,223,1)', 'rgba(255,211,140,0.55)')
  const horizon = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: horizonTex, transparent: true, opacity: W.horizonLight.opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  )
  horizon.position.set(...W.horizonLight.position)
  horizon.scale.set(...W.horizonLight.scale, 1)
  group.add(horizon)
  const horizonCore = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: horizonTex, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  )
  horizonCore.position.set(W.horizonLight.position[0], W.horizonLight.position[1] + 1, W.horizonLight.position[2] + 2)
  horizonCore.scale.set(46, 13, 1)
  group.add(horizonCore)

  // ── Vertical beams (thin lines rising like data rain) ───────────────────
  const beamCount = W.beams
  const beamPos = new Float32Array(beamCount * 2 * 3)
  const beamPhase = new Float32Array(beamCount * 2)
  for (let i = 0; i < beamCount; i++) {
    const x = (Math.random() - 0.5) * 170
    const z = -80 + Math.random() * 150
    const h = 14 + Math.random() * 26
    beamPos.set([x, -2, z, x, -2 + h, z], i * 6)
    beamPhase[i * 2] = Math.random()
    beamPhase[i * 2 + 1] = Math.random()
  }
  const beamGeo = new THREE.BufferGeometry()
  beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPos, 3))
  beamGeo.setAttribute('aPhase', new THREE.BufferAttribute(beamPhase, 1))
  const beamUniforms = { uTime: { value: 0 } }
  const beamMat = new THREE.ShaderMaterial({
    uniforms: beamUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      varying float vA;
      void main() {
        vec3 p = position;
        float travel = 44.0;
        float off = mod(uTime * 1.6 + aPhase * travel, travel);
        p.y += off - travel * 0.5;
        float fade = smoothstep(-22.0, -12.0, p.y) * smoothstep(22.0, 12.0, p.y);
        vA = fade * (0.25 + 0.55 * aPhase);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        gl_FragColor = vec4(0.82, 0.88, 1.0, vA * 0.5);
      }
    `,
  })
  const beams = new THREE.LineSegments(beamGeo, beamMat)
  beams.frustumCulled = false
  group.add(beams)

  // ── Avatar (small human silhouette) ─────────────────────────────────────
  const avatar = new THREE.Group()
  const silhouette = new THREE.MeshBasicMaterial({ color: W.avatar.color })
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), silhouette)
  head.position.y = 1.66
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.62, 6, 12), silhouette)
  torso.position.y = 1.02
  const legGeo = new THREE.CapsuleGeometry(0.095, 0.5, 4, 8)
  const legL = new THREE.Mesh(legGeo, silhouette)
  legL.position.set(-0.13, 0.42, 0)
  const legR = new THREE.Mesh(legGeo, silhouette)
  legR.position.set(0.13, 0.42, 0)
  const armGeo = new THREE.CapsuleGeometry(0.07, 0.5, 4, 8)
  const armL = new THREE.Mesh(armGeo, silhouette)
  armL.position.set(-0.34, 1.05, 0)
  const armR = new THREE.Mesh(armGeo, silhouette)
  armR.position.set(0.34, 1.05, 0)
  avatar.add(head, torso, legL, legR, armL, armR)
  // soft warm glow at the feet so the silhouette reads against the light
  const footGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeRadialTexture('rgba(255,243,223,0.85)', 'rgba(255,211,140,0.3)'),
      transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  )
  footGlow.scale.set(4.5, 2.2, 1)
  footGlow.position.y = 0.4
  avatar.add(footGlow)
  avatar.position.set(...W.avatar.start)
  avatar.rotation.y = Math.PI // facing the horizon light (away from spawn camera)
  group.add(avatar)

  // ── Beacons (one glowing pillar per project) ────────────────────────────
  const beacons = []
  for (const project of config.projects) {
    const bGroup = new THREE.Group()
    const color = new THREE.Color(project.beaconColor)
    const [bx, bz] = project.position

    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.62, 11, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    )
    outer.position.y = 5.5
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 11, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    )
    core.position.y = 5.5
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.45, 40),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.06
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeRadialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.25)'),
        color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    )
    glow.scale.set(10, 10, 1)
    glow.position.y = 1.2
    const label = makeLabelSprite(project.label, project.beaconColor)
    label.position.y = 11.6

    bGroup.add(outer, core, ring, glow, label)
    bGroup.position.set(bx, 0, bz)
    group.add(bGroup)
    beacons.push({ project, group: bGroup, outer, core, ring, glow, label, phase: Math.random() * Math.PI * 2 })
  }

  // ── Update loop ─────────────────────────────────────────────────────────
  function update(time, dt, avatarPos, avatarHeading) {
    terrainUniforms.uTime.value = time
    terrainUniforms.uAvatar.value.set(avatarPos.x, avatarPos.z)
    beamUniforms.uTime.value = time

    // gentle breathing on the horizon light
    const breathe = 1 + (reducedMotion ? 0 : 0.03 * Math.sin(time * 0.5))
    horizon.scale.set(W.horizonLight.scale[0] * breathe, W.horizonLight.scale[1] * breathe, 1)

    for (const b of beacons) {
      const pulse = 0.3 + 0.07 * Math.sin(time * 1.8 + b.phase)
      b.outer.material.opacity = pulse
      b.core.material.opacity = 0.8 + 0.15 * Math.sin(time * 1.8 + b.phase)
      b.label.position.y = 11.6 + Math.sin(time * 0.9 + b.phase) * 0.25
      b.glow.material.opacity = 0.7 + 0.1 * Math.sin(time * 1.8 + b.phase)
    }

    // avatar gentle bob + lean into movement
    avatar.position.y = Math.abs(Math.sin(time * 2.2)) * 0.03
    avatar.rotation.y = avatarHeading
  }

  function setPixelRatio(ratio) {
    terrainUniforms.uPixelRatio.value = ratio
  }

  function dispose() {
    terrainGeo.dispose()
    terrainMat.dispose()
    beamGeo.dispose()
    beamMat.dispose()
    group.clear()
  }

  return { group, update, setPixelRatio, dispose, beacons, avatar }
}
