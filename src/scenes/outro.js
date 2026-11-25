// ── Scene 4 · Outro vortex ─────────────────────────────────────────────────
// A white swirling vortex of thousands of line strands: two interlocking
// spiral arms that tighten into a small white starburst as the camera dives
// into the centre.
import * as THREE from 'three'
import gsap from 'gsap'

// Soft round dot texture — the starburst points render as glowing discs,
// not the dim grey squares a bare PointsMaterial draws.
function makeDotTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.7)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createOutro(config, reducedMotion) {
  const group = new THREE.Group()
  const strandsPerArm = config.outro.strands
  const turns = config.outro.turns
  const R = 16
  const depth = 6
  const dotTex = makeDotTexture()

  // Two interlocking spiral arms, built as line segments.
  const positions = new Float32Array(strandsPerArm * 2 * 2 * 3)
  let p = 0
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < strandsPerArm; i++) {
      const t0 = i / strandsPerArm
      const t1 = (i + 1) / strandsPerArm
      const a0 = t0 * turns * Math.PI * 2 + arm * Math.PI
      const a1 = t1 * turns * Math.PI * 2 + arm * Math.PI
      const r0 = R * (1 - t0 * 0.94)
      const r1 = R * (1 - t1 * 0.94)
      const wobble = (t) => Math.sin(t * 40 + arm * 3) * 0.25 * (1 - t)
      positions[p++] = Math.cos(a0) * r0
      positions[p++] = Math.sin(a0) * r0 + wobble(t0)
      positions[p++] = (t0 - 0.5) * depth
      positions[p++] = Math.cos(a1) * r1
      positions[p++] = Math.sin(a1) * r1 + wobble(t1)
      positions[p++] = (t1 - 0.5) * depth
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const strands = new THREE.LineSegments(geo, mat)
  strands.frustumCulled = false
  group.add(strands)

  // Starburst at the centre — hidden until the dive ends. Round glowing
  // discs (dot texture), not bare squares, so it reads as a bright burst.
  const burstCount = config.outro.burstCount || 1400
  const burstPos = new Float32Array(burstCount * 3)
  for (let i = 0; i < burstCount; i++) {
    const dir = new THREE.Vector3().randomDirection()
    const r = 0.4 + Math.random() * 1.6
    burstPos[i * 3] = dir.x * r
    burstPos[i * 3 + 1] = dir.y * r
    burstPos[i * 3 + 2] = dir.z * r
  }
  const burstGeo = new THREE.BufferGeometry()
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3))
  const burstMat = new THREE.PointsMaterial({
    color: 0xffffff, size: config.outro.burstSize || 0.35, map: dotTex,
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  })
  const burst = new THREE.Points(burstGeo, burstMat)
  burst.frustumCulled = false
  burst.scale.setScalar(0.1)
  group.add(burst)

  // White core glow — fades in as the camera dives so the vortex centre
  // blazes white instead of reading as black with white rings.
  const glowMat = new THREE.SpriteMaterial({
    map: dotTex, color: 0xffffff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const glow = new THREE.Sprite(glowMat)
  glow.scale.set(8, 8, 1)
  glow.frustumCulled = false
  group.add(glow)

  let spinSpeed = reducedMotion ? 0.4 : 2.2
  let diving = false

  function update(dt) {
    group.rotation.z += spinSpeed * dt
    if (diving) spinSpeed = Math.min(spinSpeed + dt * 3.5, 9)
  }

  // Camera dive: spiral tightens, core blazes white, then the starburst flashes.
  function dive(camera, onDone) {
    diving = true
    const tl = gsap.timeline({ onComplete: onDone })
    tl.to(camera.position, { z: 5.5, duration: 2.1, ease: 'power2.in' }, 0)
      .to(group.scale, { x: 0.55, y: 0.55, z: 0.55, duration: 2.1, ease: 'power2.in' }, 0)
      // core glow builds as the camera closes in
      .to(glowMat, { opacity: 0.9, duration: 1.6, ease: 'power1.in' }, 0.6)
      .to(glow.scale, { x: 42, y: 42, z: 42, duration: 2.0, ease: 'power2.in' }, 0.6)
      // starburst: discs fly out and flash, then settle at a bright glow
      // instead of fading out entirely
      .to(burst.scale, { x: 4, y: 4, z: 4, duration: 0.9, ease: 'power3.out' }, 1.9)
      .to(burstMat, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 1.9)
      .to(burstMat, { opacity: 0.5, duration: 1.2, ease: 'power1.out' }, 2.5)
      // The white dive is the climax; the resting state stays DARK, with a
      // soft white core still glowing. An all-white rest would wash out the
      // Esc hint and the return pill and break the dark brand; a core that
      // fades to 0 reads as "it fell back to black". So the strands stay
      // bright (0.75) and the glow settles at a soft 0.3, spread wide
      // (scale 26) instead of blazing at full opacity.
      .to(mat, { opacity: 0.75, duration: 1.0, ease: 'power1.out' }, 2.2)
      .to(glowMat, { opacity: 0.3, duration: 1.2, ease: 'power2.out' }, 2.6)
      .to(glow.scale, { x: 26, y: 26, z: 26, duration: 1.2, ease: 'power2.out' }, 2.6)
    // full-screen white flash at the starburst peak (DOM overlay, if present)
    const flash = document.getElementById('vortex-flash')
    if (flash) {
      tl.to(flash, { opacity: 0.7, duration: 0.15, ease: 'power1.in' }, 1.9)
        .to(flash, { opacity: 0, duration: 0.9, ease: 'power1.out' }, 2.05)
    }
    return tl
  }

  function reset() {
    diving = false
    spinSpeed = reducedMotion ? 0.4 : 2.2
    group.scale.setScalar(1)
    group.rotation.z = 0
    mat.opacity = 1.0
    burst.scale.setScalar(0.1)
    burstMat.opacity = 0
    glowMat.opacity = 0
    glow.scale.set(8, 8, 1)
    const flash = document.getElementById('vortex-flash')
    if (flash) flash.style.opacity = 0
  }

  function dispose() {
    geo.dispose()
    mat.dispose()
    burstGeo.dispose()
    burstMat.dispose()
    group.clear()
  }

  return { group, update, dive, reset, dispose }
}
