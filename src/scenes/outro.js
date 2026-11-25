// ── Scene 4 · Outro vortex ─────────────────────────────────────────────────
// A white swirling vortex of thousands of line strands: two interlocking
// spiral arms that tighten into a small white starburst as the camera dives
// into the centre.
import * as THREE from 'three'
import gsap from 'gsap'

export function createOutro(config, reducedMotion) {
  const group = new THREE.Group()
  const strandsPerArm = config.outro.strands
  const turns = config.outro.turns
  const R = 16
  const depth = 6

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
    color: 0xffffff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const strands = new THREE.LineSegments(geo, mat)
  strands.frustumCulled = false
  group.add(strands)

  // Starburst at the centre — hidden until the dive ends.
  const burstCount = 900
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
    color: 0xffffff, size: 0.16, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  })
  const burst = new THREE.Points(burstGeo, burstMat)
  burst.frustumCulled = false
  burst.scale.setScalar(0.1)
  group.add(burst)

  let spinSpeed = reducedMotion ? 0.4 : 2.2
  let diving = false

  function update(dt) {
    group.rotation.z += spinSpeed * dt
    if (diving) spinSpeed = Math.min(spinSpeed + dt * 3.5, 9)
  }

  // Camera dive: spiral tightens, then the starburst flashes.
  function dive(camera, onDone) {
    diving = true
    const tl = gsap.timeline({ onComplete: onDone })
    tl.to(camera.position, { z: 5.5, duration: 2.1, ease: 'power2.in' }, 0)
      .to(group.scale, { x: 0.55, y: 0.55, z: 0.55, duration: 2.1, ease: 'power2.in' }, 0)
      .to(burst.scale, { x: 3.2, y: 3.2, z: 3.2, duration: 0.9, ease: 'power3.out' }, 1.9)
      .to(burstMat, { opacity: 1, duration: 0.35, ease: 'power1.out' }, 1.9)
      .to(burstMat, { opacity: 0, duration: 1.1, ease: 'power1.out' }, 2.5)
      .to(mat, { opacity: 0.25, duration: 1.0, ease: 'power1.out' }, 2.2)
    return tl
  }

  function reset() {
    diving = false
    spinSpeed = reducedMotion ? 0.4 : 2.2
    group.scale.setScalar(1)
    group.rotation.z = 0
    mat.opacity = 0.85
    burst.scale.setScalar(0.1)
    burstMat.opacity = 0
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
