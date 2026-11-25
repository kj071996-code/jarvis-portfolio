// ── JARVIS portfolio · entry ───────────────────────────────────────────────
// One continuous scene, no page reloads:
//   intro ring → particle world → project dashboard → world → vortex outro
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import gsap from 'gsap'
import { CONFIG } from './config.js'
import './styles.css'
import { createIntro, runTypewriter } from './scenes/intro.js'
import { createWorld } from './scenes/world.js'
import { createOutro } from './scenes/outro.js'
import { renderProject } from './ui/projects.js'

// ── Environment ────────────────────────────────────────────────────────────
const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const $ = (id) => document.getElementById(id)

// ── Renderer / scene / camera ──────────────────────────────────────────────
const container = $('scene')
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.9
container.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(CONFIG.colors.background)
scene.fog = new THREE.FogExp2(0x030308, 0.0075)

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 600)
camera.position.set(0, 0.4, 15)
camera.lookAt(0, 0, 0)

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5, // strength
  0.5, // radius
  0.55, // threshold — only genuinely bright cores bloom
)
composer.addPass(bloom)
composer.addPass(new OutputPass())

// ── Scene groups ───────────────────────────────────────────────────────────
const intro = createIntro(CONFIG, reducedMotion)
const world = createWorld(CONFIG, reducedMotion)
const outro = createOutro(CONFIG, reducedMotion)
scene.add(intro.group)
scene.add(world.group)
scene.add(outro.group)
world.group.visible = false
outro.group.visible = false

// ── State ──────────────────────────────────────────────────────────────────
let state = 'loading' // loading | intro | world | project | outro
let activeBeacon = null
let returnSpot = null // { pos, heading } — where we re-enter the world
let projectCleanup = null

const avatarPos = new THREE.Vector3(...CONFIG.world.avatar.start)
let avatarHeading = Math.PI // facing the horizon light
let targetHeading = Math.PI // where the heading is easing toward
let camYaw = Math.PI // camera sits behind the avatar
const keys = new Set()
let joystickVec = { x: 0, y: 0 }
let walkTarget = null // tap-to-walk destination (Vector3) or null
// Smoothed movement — the velocity eases toward its target (quick to start,
// smooth to stop) instead of snapping to full speed or stopping dead.
const moveVel = new THREE.Vector2(0, 0) // current velocity, world space (x, z)
// While a GSAP tween owns the camera (first entry drop), the follow lerp
// must not fight it, or the drop arrives early and loses its smooth ease.
let cameraHeld = false
// Cached HUD strings — the DOM is only touched when the text actually
// changes, instead of writing textContent every frame (layout thrash).
let lastPromptText = ''
let lastNearestText = ''

// Ease an angle toward a target along the shortest arc (frame-rate independent).
function dampAngle(current, target, lambda, dt) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + diff * (1 - Math.exp(-dt * lambda))
}

// ── HUD helpers ────────────────────────────────────────────────────────────
function show(id) { $(id).classList.remove('hidden') }
function hide(id) { $(id).classList.add('hidden') }

// ── Scene 1 · Intro ────────────────────────────────────────────────────────
function startIntro() {
  state = 'intro'
  hide('loader')
  show('intro-caption')
  show('skip-intro')
  camera.position.set(0, 0.4, 15)
  camera.lookAt(0, 0, 0)

  const tw = runTypewriter(CONFIG, $('intro-caption'), () => finishIntro())
  $('skip-intro').addEventListener('click', () => { tw.cancel(); finishIntro() }, { once: true })
}

let introFinished = false
function finishIntro() {
  if (introFinished) return
  introFinished = true
  hide('skip-intro')
  gsap.to('#intro-caption', { opacity: 0, duration: 0.6, ease: 'power1.out' })
  intro.collapse(() => {
    hide('intro-caption')
    enterWorld(true)
  })
}

// ── Scene 2 · The world ────────────────────────────────────────────────────
function enterWorld(firstTime = false) {
  state = 'world'
  world.group.visible = true
  outro.group.visible = false
  intro.group.visible = false
  show('hud')
  show('hint')
  $('hint').textContent = isMobile ? CONFIG.controls.mobileHint : CONFIG.controls.desktopHint
  if (isMobile) show('joystick')

  // restore the exact spot we left (or the spawn on first entry)
  if (returnSpot) {
    avatarPos.copy(returnSpot.pos)
    avatarHeading = returnSpot.heading
    camYaw = returnSpot.camYaw
  } else {
    avatarPos.set(...CONFIG.world.avatar.start)
    avatarHeading = Math.PI
    camYaw = Math.PI
  }
  targetHeading = avatarHeading
  moveVel.set(0, 0)
  world.avatar.position.copy(avatarPos)

  if (firstTime) {
    // camera drops from the collapsed ring into the world.
    // Land exactly where the follow camera holds it (behind the avatar):
    // the follow logic recomputes camYaw as avatarHeading + PI every frame
    // (line 319), so the tween must target that same yaw. Targeting the stale
    // initial camYaw (PI) put the camera on the opposite side of the avatar,
    // and the follow lerp then dragged it through the avatar — where lookAt
    // points straight down — which is why the view settled looking down and
    // the sky, horizon glow and beacon labels left the frame.
    const settleYaw = avatarHeading + Math.PI
    camera.position.set(avatarPos.x, 26, avatarPos.z + 34)
    camera.lookAt(avatarPos.x, 0, avatarPos.z - 10)
    cameraHeld = true
    gsap.to(camera.position, {
      x: avatarPos.x + Math.sin(settleYaw) * CONFIG.world.camera.distance,
      y: CONFIG.world.camera.height,
      z: avatarPos.z + Math.cos(settleYaw) * CONFIG.world.camera.distance,
      duration: reducedMotion ? 0.4 : 1.8,
      ease: 'power2.inOut',
      onComplete: () => { cameraHeld = false },
    })
  }
}

// ── Scene 3 · Project screens ──────────────────────────────────────────────
function openProject(project) {
  state = 'project'
  returnSpot = { pos: avatarPos.clone(), heading: avatarHeading, camYaw }
  // the avatar stops when a dashboard opens — no stale velocity or lean
  moveVel.set(0, 0)
  world.avatar.rotation.x = 0
  hide('hud')
  hide('hint')
  hide('prompt')
  hide('nearest')
  hide('joystick')

  const overlay = $('project-overlay')
  overlay.innerHTML = ''
  const node = renderProject(project, closeProject)
  overlay.appendChild(node)
  overlay.classList.remove('hidden')
  gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power1.out' })
  overlay.scrollTop = 0
}

function closeProject() {
  const overlay = $('project-overlay')
  const node = overlay.firstChild
  gsap.to(overlay, {
    opacity: 0, duration: 0.5, ease: 'power1.in',
    onComplete: () => {
      overlay.classList.add('hidden')
      overlay.innerHTML = ''
      if (node && node._cleanup) node._cleanup()
      enterWorld(false) // back to the exact same spot
    },
  })
}

// ── Scene 4 · Outro vortex ─────────────────────────────────────────────────
function leaveWorld() {
  if (state !== 'world') return
  state = 'outro'
  hide('hud')
  hide('hint')
  hide('prompt')
  hide('nearest')
  hide('joystick')
  world.group.visible = false
  outro.group.visible = true
  outro.reset()

  // try fullscreen (best effort — iOS Safari may refuse; the vortex plays anyway)
  if (document.fullscreenEnabled && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {})
  }

  camera.position.set(0, 2, 26)
  camera.lookAt(0, 0, 0)
  show('vortex-hint')
  outro.dive(camera, () => {
    show('return-world')
    $('return-world').textContent = CONFIG.outro.returnLabel
  })
}

function returnToWorld() {
  hide('vortex-hint')
  hide('return-world')
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  outro.group.visible = false
  gsap.to(camera.position, {
    x: avatarPos.x + Math.sin(camYaw) * CONFIG.world.camera.distance,
    y: CONFIG.world.camera.height,
    z: avatarPos.z + Math.cos(camYaw) * CONFIG.world.camera.distance,
    duration: 1.2, ease: 'power2.inOut',
    onComplete: () => enterWorld(false),
  })
}

// ── Input: keyboard ────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && state === 'world' && activeBeacon) { openProject(activeBeacon.project); return }
  if (e.key === 'Escape' && state === 'outro') return // browser exits fullscreen; hint explains it
  keys.add(e.key.toLowerCase())
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault()
  walkTarget = null // keys override tap-to-walk
})
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

// ── Input: virtual joystick ────────────────────────────────────────────────
const joy = $('joystick')
const knob = $('joystick-knob')
let joyActive = false
function joySet(e) {
  const rect = joy.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let dx = (e.clientX - cx) / (rect.width / 2)
  let dy = (e.clientY - cy) / (rect.height / 2)
  const len = Math.hypot(dx, dy)
  if (len > 1) { dx /= len; dy /= len }
  joystickVec = { x: dx, y: dy }
  knob.style.transform = `translate(calc(-50% + ${dx * 30}px), calc(-50% + ${dy * 30}px))`
  walkTarget = null
}
joy.addEventListener('pointerdown', (e) => { joyActive = true; joy.setPointerCapture(e.pointerId); joySet(e) })
joy.addEventListener('pointermove', (e) => { if (joyActive) joySet(e) })
joy.addEventListener('pointerup', () => {
  joyActive = false
  joystickVec = { x: 0, y: 0 }
  knob.style.transform = 'translate(-50%, -50%)'
})

// ── Input: tap-to-walk ─────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (state !== 'world' || e.pointerType === 'mouse') return
  const ndc = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  )
  raycaster.setFromCamera(ndc, camera)
  const hit = new THREE.Vector3()
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    walkTarget = hit
    walkTarget.x = THREE.MathUtils.clamp(walkTarget.x, -CONFIG.world.bounds, CONFIG.world.bounds)
    walkTarget.z = THREE.MathUtils.clamp(walkTarget.z, -CONFIG.world.bounds, CONFIG.world.bounds)
  }
})

// ── Buttons ────────────────────────────────────────────────────────────────
$('leave-btn').addEventListener('click', leaveWorld)
$('return-world').addEventListener('click', returnToWorld)
$('prompt').addEventListener('click', () => { if (activeBeacon) openProject(activeBeacon.project) })

// ── Movement + camera ──────────────────────────────────────────────────────
const tmpV = new THREE.Vector3()
const tmpFwd = new THREE.Vector3()
function updateWorld(dt, time) {
  // input vector in camera space
  let ix = 0
  let iz = 0
  if (keys.has('w') || keys.has('arrowup')) iz -= 1
  if (keys.has('s') || keys.has('arrowdown')) iz += 1
  if (keys.has('a') || keys.has('arrowleft')) ix -= 1
  if (keys.has('d') || keys.has('arrowright')) ix += 1
  ix += joystickVec.x
  iz += joystickVec.y

  // Desired velocity (world space) from the input — zero when there is none.
  // The avatar's velocity eases toward it instead of snapping, so starting
  // and stopping feel smooth rather than robotic.
  let dvx = 0
  let dvz = 0
  if (ix !== 0 || iz !== 0) {
    const len = Math.hypot(ix, iz) || 1
    ix /= len
    iz /= len
    // camera-space → world-space
    const sin = Math.sin(camYaw)
    const cos = Math.cos(camYaw)
    const wx = ix * cos - iz * sin
    const wz = ix * sin + iz * cos
    dvx = wx * CONFIG.world.avatar.speed
    dvz = wz * CONFIG.world.avatar.speed
    targetHeading = Math.atan2(wx, wz)
  } else if (walkTarget) {
    tmpV.copy(walkTarget).sub(avatarPos)
    tmpV.y = 0
    const dist = tmpV.length()
    if (dist > 0.6) {
      tmpV.normalize()
      dvx = tmpV.x * CONFIG.world.avatar.speed * 0.85
      dvz = tmpV.z * CONFIG.world.avatar.speed * 0.85
      targetHeading = Math.atan2(tmpV.x, tmpV.z)
    } else {
      walkTarget = null
    }
  }
  const accelK = 1 - Math.exp(-dt * CONFIG.world.avatar.accel)
  moveVel.x += (dvx - moveVel.x) * accelK
  moveVel.y += (dvz - moveVel.y) * accelK
  avatarPos.x += moveVel.x * dt
  avatarPos.z += moveVel.y * dt
  const moving = moveVel.lengthSq() > 0.001
  // Ease the heading toward the target along the shortest arc — turning is
  // smooth, and the camera orbit (which follows the heading) no longer snaps.
  avatarHeading = dampAngle(avatarHeading, targetHeading, CONFIG.world.avatar.turnRate, dt)

  // clamp to the field
  avatarPos.x = THREE.MathUtils.clamp(avatarPos.x, -CONFIG.world.bounds, CONFIG.world.bounds)
  avatarPos.z = THREE.MathUtils.clamp(avatarPos.z, -CONFIG.world.bounds, CONFIG.world.bounds)
  world.avatar.position.copy(avatarPos)

  // slow, floaty third-person camera with a slight orbit
  const sway = reducedMotion ? 0 : Math.sin(time * 0.07) * CONFIG.world.camera.orbitSway
  camYaw = avatarHeading + Math.PI + sway
  const cx = avatarPos.x + Math.sin(camYaw) * CONFIG.world.camera.distance
  const cz = avatarPos.z + Math.cos(camYaw) * CONFIG.world.camera.distance
  // While the first-entry tween owns the camera, the follow lerp stays out —
  // otherwise it yanks the drop and the smooth ease is lost.
  if (!cameraHeld) {
    const lerpK = 1 - Math.exp(-dt * CONFIG.world.camera.followRate)
    camera.position.x += (cx - camera.position.x) * lerpK
    camera.position.y += (CONFIG.world.camera.height - camera.position.y) * lerpK
    camera.position.z += (cz - camera.position.z) * lerpK
  }
  camera.lookAt(avatarPos.x, CONFIG.world.camera.lookHeight, avatarPos.z)

  // beacon proximity → "Enter" prompt
  let nearest = null
  let nearestDist = Infinity
  for (const b of world.beacons) {
    const d = Math.hypot(avatarPos.x - b.group.position.x, avatarPos.z - b.group.position.z)
    if (d < nearestDist) { nearestDist = d; nearest = b }
  }
  activeBeacon = nearest && nearestDist < CONFIG.world.enterDistance ? nearest : null
  // Only touch the DOM when the prompt text actually changes — writing
  // textContent every frame is layout thrash that drags the frame rate.
  const promptText = activeBeacon ? `open ${activeBeacon.project.label}` : ''
  if (promptText !== lastPromptText) {
    lastPromptText = promptText
    if (promptText) {
      $('prompt-text').textContent = promptText
      show('prompt')
    } else {
      hide('prompt')
    }
  }

  // nearest-station readout — always a visible destination while in the world.
  // Hidden when the "open …" prompt is showing (it already says what to do).
  let nearestText = ''
  if (!activeBeacon && nearest) {
    // bearing of the beacon relative to where the camera is looking
    camera.getWorldDirection(tmpFwd)
    const dx = nearest.group.position.x - avatarPos.x
    const dz = nearest.group.position.z - avatarPos.z
    const dl = Math.hypot(dx, dz) || 1
    const tx = dx / dl
    const tz = dz / dl
    const fl = Math.hypot(tmpFwd.x, tmpFwd.z) || 1
    const fx = tmpFwd.x / fl
    const fz = tmpFwd.z / fl
    const dot = fx * tx + fz * tz
    const cross = fz * tx - fx * tz // > 0 → beacon is to the left
    const angle = Math.atan2(cross, dot)
    let arrow = '▲' // ahead
    if (angle >= Math.PI / 4) arrow = '◀' // left
    else if (angle <= -Math.PI / 4) arrow = '▶' // right
    nearestText = `${arrow} nearest station: ${nearest.project.label} · ${Math.round(nearestDist)}m`
  }
  if (nearestText !== lastNearestText) {
    lastNearestText = nearestText
    if (nearestText) {
      $('nearest').textContent = nearestText
      show('nearest')
    } else {
      hide('nearest')
    }
  }

  world.update(time, dt, avatarPos, avatarHeading)
  // Lean gently into movement — the speed is already smoothed, so the lean is too.
  const speedFrac = Math.min(1, moveVel.length() / CONFIG.world.avatar.speed)
  world.avatar.rotation.x = speedFrac * 0.1
  return moving
}

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  applyPixelRatio()
})

// ── Adaptive quality: step pixel ratio down promptly if fps sags ──────────
let fpsFrames = 0
let fpsTime = 0
let qualityStep = 0
// The stepped-down ratio is the one every consumer uses, so a window resize
// never silently resets the terrain back to full res.
function basePixelRatio() { return Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2) }
function currentPixelRatio() { return Math.max(1, basePixelRatio() - qualityStep * 0.5) }
function applyPixelRatio() {
  const ratio = currentPixelRatio()
  renderer.setPixelRatio(ratio)
  composer.setPixelRatio(ratio)
  world.setPixelRatio(ratio)
}
function adaptiveQuality(dt) {
  fpsFrames++
  fpsTime += dt
  // 2s window (was 3s), 45 fps threshold (was 42), 0.5 steps (was 0.25):
  // a sagging frame rate reaches the floor (1.0) in ~4s instead of ~9s,
  // so the motion stays smooth instead of chopping for most of a walk.
  if (fpsTime >= 2) {
    const fps = fpsFrames / fpsTime
    fpsFrames = 0
    fpsTime = 0
    if (fps < 45 && qualityStep < 2) {
      qualityStep++
      applyPixelRatio()
    }
  }
}

// ── Main loop ──────────────────────────────────────────────────────────────
const clock = new THREE.Clock()
function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const time = clock.elapsedTime

  if (state === 'intro') {
    intro.update(time)
    adaptiveQuality(dt)
  } else if (state === 'world' || state === 'project') {
    if (state === 'world') updateWorld(dt, time)
    else world.update(time, dt, avatarPos, avatarHeading)
    adaptiveQuality(dt)
  } else if (state === 'outro') {
    outro.update(dt)
    adaptiveQuality(dt)
  }

  composer.render()
}

// ── Boot ───────────────────────────────────────────────────────────────────
try {
  animate()
  // small delay so the first frame is up before the caption starts
  setTimeout(startIntro, 350)
} catch (err) {
  const loader = $('loader')
  loader.innerHTML = `<p style="color:#f87171">webgl failed to start — ${err.message}</p>`
  console.error(err)
}
