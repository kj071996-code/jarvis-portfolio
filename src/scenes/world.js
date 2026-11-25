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

// Draws the label (coloured dot + name, centred as one unit on a dark
// rounded backing) onto a 512×128 canvas context. Split out so the label
// can be redrawn once Inter has loaded — the first draw happens before
// Google Fonts delivers it, so it would otherwise render in fallback sans.
function drawLabel(ctx, text, color) {
  ctx.clearRect(0, 0, 512, 128)
  ctx.shadowBlur = 0
  ctx.font = '600 44px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const tw = ctx.measureText(text.toLowerCase()).width
  const dotR = 11
  const gap = 18
  const padX = 26
  const contentW = dotR * 2 + gap + tw
  const bw = Math.min(512 - 8, contentW + padX * 2)
  const bh = 76
  const bx = (512 - bw) / 2
  const by = (128 - bh) / 2
  const r = 20
  ctx.beginPath()
  ctx.moveTo(bx + r, by)
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r)
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r)
  ctx.arcTo(bx, by + bh, bx, by, r)
  ctx.arcTo(bx, by, bx + bw, by, r)
  ctx.closePath()
  ctx.fillStyle = 'rgba(4,8,20,0.8)'
  ctx.fill()
  const cx = 256 - contentW / 2
  // group-colour dot
  ctx.beginPath()
  ctx.arc(cx + dotR, 64, dotR, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 18
  ctx.fill()
  ctx.shadowBlur = 0
  // name, to the right of the dot
  ctx.shadowColor = color
  ctx.shadowBlur = 22
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text.toLowerCase(), cx + dotR * 2 + gap + tw / 2, 64)
  ctx.shadowBlur = 0
}

function makeLabelSprite(text, color) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const ctx = c.getContext('2d')
  drawLabel(ctx, text, color)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(9, 2.2, 1)
  sprite.userData.redraw = () => { drawLabel(ctx, text, color); tex.needsUpdate = true }
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
    // Normal blending, NOT additive: with a dense grid viewed at a grazing
    // angle, many rows of additive points stack onto the same pixels and sum
    // to white no matter how dim each one is. Normal blending composites
    // overlapping points toward the point colour and can never exceed it,
    // so the plain stays dark. UnrealBloom still glows the bright green
    // highlights and the beacon cores (they sit above its threshold).
    blending: THREE.NormalBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uAvatar;
      uniform float uPixelRatio;
      uniform float uWaveAmp;
      uniform float uRippleAmp;
      varying float vH;
      varying float vGlow;
      varying float vDist;
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
        vDist = -mv.z;
        gl_PointSize = min((2.0 + vH * 2.2) * uPixelRatio * (90.0 / max(1.0, -mv.z)), 48.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vH;
      varying float vGlow;
      varying float vDist;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.05, length(c));
        // Dim base so the plain reads dark; fade with distance so far points
        // vanish into the black instead of stacking at the horizon.
        vec3 base = mix(vec3(0.15, 0.16, 0.18), vec3(0.32, 0.34, 0.38), vH);
        vec3 green = vec3(0.42, 0.95, 0.62);
        vec3 col = mix(base, green, smoothstep(0.74, 0.95, vH) * 0.7);
        col += vec3(0.45, 0.85, 0.55) * vGlow * 0.2;
        float fade = 1.0 - smoothstep(30.0, 70.0, vDist);
        gl_FragColor = vec4(col, a * 0.55 * fade);
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
      transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending,
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
      map: horizonTex, transparent: true, opacity: 0.25,
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
        gl_FragColor = vec4(0.82, 0.88, 1.0, vA * 0.3);
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
  // Clickable: every beacon mesh carries userData.beacon so the main loop
  // can raycast a click/tap against it. hitMeshes is the flat list the
  // raycaster tests.
  const beacons = []
  const hitMeshes = []
  for (const project of config.projects) {
    const bGroup = new THREE.Group()
    const color = new THREE.Color(project.beaconColor)
    const [bx, bz] = project.position

    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.62, 9, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    )
    outer.position.y = 4.5
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 9, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    )
    core.position.y = 4.5
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
    label.position.y = 9.8

    bGroup.add(outer, core, ring, glow, label)
    bGroup.position.set(bx, 0, bz)
    group.add(bGroup)
    const rec = { project, group: bGroup, outer, core, ring, glow, label, phase: Math.random() * Math.PI * 2 }
    for (const m of [outer, core, ring, glow, label]) m.userData.beacon = rec
    hitMeshes.push(outer, core, ring, glow, label)
    beacons.push(rec)
  }

  // Redraw the labels once Inter has loaded — the first draw happens
  // before Google Fonts delivers it, so they would otherwise stay in the
  // fallback sans.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('600 44px Inter').then(() => {
      for (const b of beacons) b.label.userData.redraw()
    }).catch(() => {})
  }

  // Hover state (desktop): the beacon under the mouse brightens and lifts.
  let hovered = null
  function setHovered(rec) { hovered = rec }

  // ── Update loop ─────────────────────────────────────────────────────────
  function update(time, dt, avatarPos, avatarHeading) {
    terrainUniforms.uTime.value = time
    terrainUniforms.uAvatar.value.set(avatarPos.x, avatarPos.z)
    beamUniforms.uTime.value = time

    // gentle breathing on the horizon light
    const breathe = 1 + (reducedMotion ? 0 : 0.03 * Math.sin(time * 0.5))
    horizon.scale.set(W.horizonLight.scale[0] * breathe, W.horizonLight.scale[1] * breathe, 1)

    const k = 1 - Math.exp(-dt * 10)
    for (const b of beacons) {
      b.hover = (b.hover || 0) + ((b === hovered ? 1 : 0) - (b.hover || 0)) * k
      const h = b.hover
      const pulse = 0.3 + 0.07 * Math.sin(time * 1.8 + b.phase)
      b.outer.material.opacity = pulse + 0.2 * h
      b.core.material.opacity = 0.8 + 0.15 * Math.sin(time * 1.8 + b.phase)
      b.label.position.y = 9.8 + Math.sin(time * 0.9 + b.phase) * 0.25 + 0.3 * h
      b.label.scale.set(9 * (1 + 0.08 * h), 2.2 * (1 + 0.08 * h), 1)
      b.glow.material.opacity = 0.7 + 0.1 * Math.sin(time * 1.8 + b.phase) + 0.2 * h
    }

    // avatar gentle bob — a smooth sine, not |sin| (whose cusp at the bottom
    // reverses direction abruptly and reads as a hitch in the walk)
    avatar.position.y = 0.015 + 0.015 * Math.sin(time * 2.2)
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

  return { group, update, setPixelRatio, dispose, beacons, hitMeshes, avatar, setHovered }
}
