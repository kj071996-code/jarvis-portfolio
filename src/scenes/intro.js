// ── Scene 1 · Intro ring ───────────────────────────────────────────────────
// A hollow disc of thousands of thin vertical bars, arranged radially like an
// audio visualiser. Inner bars warm orange/red, mid bars blue/purple, outer
// bars white/gray spikes. Slowly pulses and rotates. On finish it collapses
// to a point and the camera drops into the world.
import * as THREE from 'three'
import gsap from 'gsap'

export function createIntro(config, reducedMotion) {
  const group = new THREE.Group()
  const ringCfg = config.intro.ring
  const isMobile = window.innerWidth < 768
  const COUNT = isMobile ? ringCfg.barsMobile : ringCfg.barsDesktop

  const geo = new THREE.BoxGeometry(0.02, 1, 0.02)
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 })
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  const bars = []

  const innerCols = ringCfg.inner.map((c) => new THREE.Color(c))
  const midCols = ringCfg.mid.map((c) => new THREE.Color(c))
  const outerCols = ringCfg.outer.map((c) => new THREE.Color(c))

  for (let i = 0; i < COUNT; i++) {
    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.004
    // even density across the annulus
    const t = Math.sqrt(Math.random())
    const radius = ringCfg.innerRadius + (ringCfg.outerRadius - ringCfg.innerRadius) * t

    let baseHeight
    let col
    if (t < 0.42) {
      // inner band — warm orange/red
      baseHeight = 0.5 + Math.random() * 0.5
      col = innerCols[Math.floor(Math.random() * innerCols.length)]
    } else if (t < 0.74) {
      // mid band — blue/purple
      baseHeight = 0.7 + Math.random() * 0.7
      col = midCols[Math.floor(Math.random() * midCols.length)]
    } else {
      // outer band — white/gray spikes
      baseHeight = 1.0 + Math.random() * 1.5
      col = outerCols[Math.floor(Math.random() * outerCols.length)]
    }
    // a few bars are extra tall, like audio spikes
    if (Math.random() < 0.06) baseHeight *= 1.9

    bars.push({
      angle,
      radius,
      baseHeight,
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.6,
    })
    mesh.setColorAt(i, col)
  }
  mesh.instanceColor.needsUpdate = true
  group.add(mesh)

  const rotateSpeed = reducedMotion ? ringCfg.rotateSpeed * 0.2 : ringCfg.rotateSpeed
  const pulseSpeed = reducedMotion ? ringCfg.pulseSpeed * 0.5 : ringCfg.pulseSpeed

  function update(time) {
    group.rotation.z += 0.0016 * (reducedMotion ? 0.3 : 1)
    const pulse = 1 + 0.025 * Math.sin(time * pulseSpeed)
    group.scale.setScalar(pulse)
    for (let i = 0; i < COUNT; i++) {
      const b = bars[i]
      const wobble = 0.72 + 0.28 * Math.sin(time * b.speed + b.phase)
      const len = b.baseHeight * wobble
      dummy.position.set(Math.cos(b.angle) * b.radius, Math.sin(b.angle) * b.radius, 0)
      dummy.rotation.set(0, 0, b.angle - Math.PI / 2)
      dummy.scale.set(1, len, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  // Collapse to a single point, then hand over.
  function collapse(onDone) {
    gsap.to(group.scale, {
      x: 0.001,
      y: 0.001,
      z: 0.001,
      duration: 1.1,
      ease: 'power2.in',
      onComplete: () => {
        group.visible = false
        onDone()
      },
    })
    gsap.to(mat, { opacity: 0, duration: 0.9, ease: 'power1.in' })
  }

  function dispose() {
    geo.dispose()
    mat.dispose()
    group.clear()
  }

  return { group, update, collapse, dispose }
}

// ── Typewriter caption ─────────────────────────────────────────────────────
// Streams config.intro.lines one by one into #intro-caption.
//
// Time-based, not tick-count-based: each tick works out how many characters
// should be visible from the wall-clock time since the line started, so the
// text catches up instead of stalling if the main thread is busy (the intro
// ring's per-frame update can starve setTimeout on slow devices — that is
// what made the caption take ~45s instead of the ~13s the speed implies).
export function runTypewriter(config, el, onDone) {
  const lines = config.intro.lines
  const typeSpeed = config.intro.typeSpeedMs
  const linePause = config.intro.linePauseMs
  let lineIdx = 0
  let lineStart = 0 // performance.now() when the current line started
  let cancelled = false
  let timer = null

  el.innerHTML = ''
  const lineEls = lines.map(() => {
    const div = document.createElement('div')
    el.appendChild(div)
    return div
  })

  function finish() {
    if (cancelled) return
    cancelled = true
    if (timer) clearTimeout(timer)
    lines.forEach((line, i) => {
      lineEls[i].textContent = line
      lineEls[i].classList.remove('caret')
    })
    onDone()
  }

  function tick() {
    if (cancelled) return
    const now = performance.now()
    if (lineStart === 0) lineStart = now
    const line = lines[lineIdx]
    const current = lineEls[lineIdx]
    current.classList.add('caret')
    // how many chars should be visible by now — delayed ticks jump ahead
    const chars = Math.floor((now - lineStart) / typeSpeed)
    if (chars < line.length) {
      current.textContent = line.slice(0, chars)
      timer = setTimeout(tick, typeSpeed)
    } else {
      current.textContent = line
      current.classList.remove('caret')
      lineIdx++
      lineStart = 0
      if (lineIdx >= lines.length) {
        timer = setTimeout(finish, linePause)
      } else {
        timer = setTimeout(tick, linePause)
      }
    }
  }
  tick()

  // clicking the caption skips to the end
  const skip = () => finish()
  el.addEventListener('click', skip)
  return { cancel: () => { cancelled = true; if (timer) clearTimeout(timer); el.removeEventListener('click', skip) } }
}
