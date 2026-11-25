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
// Opens horizontal FOV to ~92° on 16:9 so the whole arc + orbit sway fits at spawn (46, not 48 — 48 showed wide-angle edge stretch).
function fitFov() {
  const aspect = window.innerWidth / window.innerHeight
  let v = 66
  if (aspect >= 1) {
    v = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(46)) / aspect))
    v = THREE.MathUtils.clamp(v, 58, 66)
  }
  camera.fov = v
  camera.aspect = aspect
  camera.updateProjectionMatrix()
}
// Intro ring: same size as before on desktop; pulls back on portrait phones so it isn't cropped.
function introZ() {
  const aspect = window.innerWidth / window.innerHeight
  const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const target = aspect >= 1 ? 8.3 : 6.8
  return target / (halfTan * Math.min(1, aspect))
}
fitFov()
camera.position.set(0, 0.4, introZ())
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
let returnSpot = null // { pos, heading } — where we re-enter the world
let projectCleanup = null
// Click-to-open: the beacon under the pointer when it went down (confirmed
// as a tap on pointerup), and the spot to return to, captured at click time.
let clickedBeacon = null
let clickedAt = null // { x, y } pointerdown position, for the tap-vs-drag check
let pendingReturnSpot = null
let flyLookAt = null // Vector3 the camera looks at during a fly-to (else the avatar)

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
let lastNearestText = ''
let lastNearId = null // id of the beacon the rail is highlighting as nearest
let hoveredBeacon = null // beacon record under the mouse (desktop hover)

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
  camera.position.set(0, 0.4, introZ())
  camera.lookAt(0, 0, 0)

  const tw = runTypewriter(CONFIG, $('intro-caption'), () => finishIntro())
  $('skip-intro').addEventListener('click', () => { tw.cancel(); skipIntroNow() }, { once: true })
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

// Skip cuts straight to the world — no 1.1s ring collapse, no 1.8s camera
// drop. The camera is placed directly at the follow position.
function skipIntroNow() {
  if (introFinished) return
  introFinished = true
  hide('skip-intro')
  hide('intro-caption')
  intro.group.visible = false
  enterWorld(true, true)
}

// ── Scene 2 · The world ────────────────────────────────────────────────────
function enterWorld(firstTime = false, instant = false) {
  state = 'world'
  world.group.visible = true
  outro.group.visible = false
  intro.group.visible = false
  show('hud')
  show('hint')
  $('hint').textContent = isMobile ? CONFIG.controls.mobileHint : CONFIG.controls.desktopHint
  if (isMobile) show('joystick')
  lastNearId = null // rail highlight resets on entry; updateWorld re-derives it
  // Re-show the nearest-station pill on return: it was hidden when a
  // dashboard/outro opened, and the DOM-write cache (lastNearestText) still
  // holds the old string, so updateWorld would skip the write and the pill
  // would stay hidden until the player moves a step. Show it now with the
  // (still correct — same spot) text, and clear the cache so the next frame
  // refreshes it. (The cache clear here IS the lastNearestText reset — it
  // must stay after the show() check, not before it, or the check reads ''
  // and the pill never re-shows.)
  if (lastNearestText) show('nearest')
  lastNearestText = ''

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
    if (instant) {
      // skip-intro: place the camera straight at the follow position.
      camera.position.set(
        avatarPos.x + Math.sin(settleYaw) * CONFIG.world.camera.distance,
        CONFIG.world.camera.height,
        avatarPos.z + Math.cos(settleYaw) * CONFIG.world.camera.distance,
      )
      camera.lookAt(avatarPos.x, CONFIG.world.camera.lookHeight, avatarPos.z)
      return
    }
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
// Fly the camera to a clicked beacon, then open its dashboard. The camera
// approaches from the avatar's side, slightly above, looking at the pillar
// mid-height — close enough that the pillar and its label fill the frame.
function flyToBeacon(beacon) {
  if (state !== 'world' || flyLookAt) return
  // capture the return spot now — the avatar may drift during the fly
  pendingReturnSpot = { pos: avatarPos.clone(), heading: avatarHeading, camYaw }
  const bp = beacon.group.position
  const dx = avatarPos.x - bp.x
  const dz = avatarPos.z - bp.z
  const dl = Math.hypot(dx, dz) || 1
  flyLookAt = new THREE.Vector3(bp.x, 5, bp.z)
  cameraHeld = true
  gsap.to(camera.position, {
    x: bp.x + (dx / dl) * 12,
    y: 7.5,
    z: bp.z + (dz / dl) * 12,
    duration: 1.0, ease: 'power2.inOut',
    onComplete: () => {
      cameraHeld = false
      flyLookAt = null
      openProject(beacon.project)
    },
  })
}

function clearHover() {
  hoveredBeacon = null
  world.setHovered(null)
  container.classList.remove('pointing')
  renderer.domElement.style.cursor = ''
  container.style.cursor = ''
}

function openProject(project) {
  state = 'project'
  clearHover()
  // The return spot is captured when the beacon is clicked (so walking
  // during the fly-to does not move it); fall back to the current spot.
  returnSpot = pendingReturnSpot || { pos: avatarPos.clone(), heading: avatarHeading, camYaw }
  pendingReturnSpot = null
  // the avatar stops when a dashboard opens — no stale velocity, lean or
  // tap-to-walk target carrying across states
  moveVel.set(0, 0)
  walkTarget = null
  world.avatar.rotation.x = 0
  hide('hud')
  hide('hint')
  hide('nearest')
  hide('joystick')

  const overlay = $('project-overlay')
  overlay.innerHTML = ''
  const node = renderProject(project, closeProject, switchProject)
  overlay.appendChild(node)
  overlay.classList.remove('hidden')
  gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power1.out' })
  overlay.scrollTop = 0
}

// Switch to another group's dashboard from inside the overlay: crossfade
// the content in place (no camera move — the camera stays where the fly-to
// left it; Back to the world flies it back out).
function switchProject(project) {
  const overlay = $('project-overlay')
  const old = overlay.firstChild
  gsap.to(overlay, {
    opacity: 0, duration: 0.25, ease: 'power1.in',
    onComplete: () => {
      if (old && old._cleanup) old._cleanup()
      overlay.innerHTML = ''
      const node = renderProject(project, closeProject, switchProject)
      overlay.appendChild(node)
      overlay.scrollTop = 0
      gsap.to(overlay, { opacity: 1, duration: 0.4, ease: 'power1.out' })
    },
  })
}

function closeProject() {
  const overlay = $('project-overlay')
  const node = overlay.firstChild
  // Fade the dashboard out, and fly the camera back to the follow position
  // at the same time, sweeping its gaze from the beacon back to the avatar
  // as it goes. The follow lerp stays out while the tween owns the camera.
  gsap.to(overlay, {
    opacity: 0, duration: 0.5, ease: 'power1.in',
    onComplete: () => {
      overlay.classList.add('hidden')
      overlay.innerHTML = ''
      if (node && node._cleanup) node._cleanup()
    },
  })
  cameraHeld = true
  const lookPoint = new THREE.Vector3()
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)
  lookPoint.copy(camera.position).addScaledVector(dir, 12)
  const lookTarget = new THREE.Vector3(avatarPos.x, CONFIG.world.camera.lookHeight, avatarPos.z)
  gsap.to(lookPoint, {
    x: lookTarget.x, y: lookTarget.y, z: lookTarget.z,
    duration: 0.9, ease: 'power2.inOut',
    onUpdate: () => camera.lookAt(lookPoint),
  })
  gsap.to(camera.position, {
    x: avatarPos.x + Math.sin(camYaw) * CONFIG.world.camera.distance,
    y: CONFIG.world.camera.height,
    z: avatarPos.z + Math.cos(camYaw) * CONFIG.world.camera.distance,
    duration: 0.9, ease: 'power2.inOut',
    onComplete: () => {
      cameraHeld = false
      enterWorld(false) // back to the exact same spot
    },
  })
}

// ── Scene 4 · Outro vortex ─────────────────────────────────────────────────
function leaveWorld() {
  if (state !== 'world') return
  state = 'outro'
  clearHover()
  // save the spot now — returnSpot was only set when a dashboard opened,
  // so leaving without opening one used to reset the avatar to spawn.
  returnSpot = { pos: avatarPos.clone(), heading: avatarHeading, camYaw }
  hide('hud')
  hide('hint')
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

// ── Input: click / tap a beacon to open it (no walking required) ──────────
// On pointerdown we raycast the beacons; if one is hit we remember it (and
// do NOT start a tap-to-walk). On pointerup, if the pointer barely moved,
// it was a tap/click, so we fly to that beacon and open it. Clicking empty
// space does nothing; a touch tap on empty ground still walks there.
const raycaster = new THREE.Raycaster()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
function pointerNdc(e) {
  return new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  )
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (state !== 'world') return
  clickedAt = { x: e.clientX, y: e.clientY }
  clickedBeacon = null
  raycaster.setFromCamera(pointerNdc(e), camera)
  const hits = raycaster.intersectObjects(world.hitMeshes, false)
  if (hits.length > 0 && hits[0].object.userData.beacon) {
    clickedBeacon = hits[0].object.userData.beacon
    return // a beacon tap — do not start a tap-to-walk
  }
  if (e.pointerType === 'mouse') return // mouse clicks on empty space do nothing
  const hit = new THREE.Vector3()
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    walkTarget = hit
    walkTarget.x = THREE.MathUtils.clamp(walkTarget.x, -CONFIG.world.bounds, CONFIG.world.bounds)
    walkTarget.z = THREE.MathUtils.clamp(walkTarget.z, -CONFIG.world.bounds, CONFIG.world.bounds)
  }
})
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!clickedBeacon || !clickedAt) { clickedBeacon = null; clickedAt = null; return }
  const moved = Math.hypot(e.clientX - clickedAt.x, e.clientY - clickedAt.y)
  const beacon = clickedBeacon
  clickedBeacon = null
  clickedAt = null
  if (state === 'world' && moved < 10) flyToBeacon(beacon)
})
// Hover (desktop): raycast the beacon under the mouse so it brightens and
// lifts and the cursor turns into a pointer. Listened on window (pointermove
// + mousemove) rather than only on the canvas — a canvas-only pointermove
// proved unreliable in the step-12 re-check (cursor stayed an arrow, no
// brightening, even though the identical raycast works for clicks). The
// e.target check keeps HUD/rail hovers from clearing a beacon hover, and
// touch drags are skipped (touch has no hover).
function updateHover(e) {
  if (state !== 'world') return
  if (e.target !== renderer.domElement) return
  if (e.pointerType === 'touch') return
  raycaster.setFromCamera(pointerNdc(e), camera)
  const hits = raycaster.intersectObjects(world.hitMeshes, false)
  const rec = hits.length > 0 ? hits[0].object.userData.beacon : null
  if (rec !== hoveredBeacon) {
    hoveredBeacon = rec
    world.setHovered(rec)
    container.classList.toggle('pointing', !!rec)
    // set the cursor directly on the canvas too — the CSS class alone did
    // not change it in the step-12 browser check
    renderer.domElement.style.cursor = rec ? 'pointer' : ''
    container.style.cursor = rec ? 'pointer' : ''
  }
}
window.addEventListener('pointermove', updateHover)
window.addEventListener('mousemove', updateHover)

// ── Station rail ─────────────────────────────────────────────────────────
// One button per group, always visible and clickable on entry — on a
// portrait phone only ~3 pillars fit in frame whatever the arc, so the rail
// carries the first impression on every screen. Hovering a rail button
// highlights its beacon in the world (desktop); the nearest station is
// marked .near by updateWorld().
const railButtons = new Map()
for (const b of world.beacons) {
  const btn = document.createElement('button')
  btn.className = 'station'
  btn.style.setProperty('--c', b.project.beaconColor)
  btn.innerHTML = `<span class="sdot"></span>${b.project.label}`
  btn.addEventListener('click', () => flyToBeacon(b))
  btn.addEventListener('mouseenter', () => { if (state === 'world') world.setHovered(b) })
  btn.addEventListener('mouseleave', () => world.setHovered(hoveredBeacon))
  $('stations').appendChild(btn)
  railButtons.set(b.project.id, btn)
}

// ── Buttons ────────────────────────────────────────────────────────────────
$('leave-btn').addEventListener('click', leaveWorld)
$('return-world').addEventListener('click', returnToWorld)

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
  if (flyLookAt) camera.lookAt(flyLookAt)
  else camera.lookAt(avatarPos.x, CONFIG.world.camera.lookHeight, avatarPos.z)

  // nearest beacon (for the readout) — no proximity gate; beacons open by
  // click, so there is no "Enter" prompt any more.
  let nearest = null
  let nearestDist = Infinity
  for (const b of world.beacons) {
    const d = Math.hypot(avatarPos.x - b.group.position.x, avatarPos.z - b.group.position.z)
    if (d < nearestDist) { nearestDist = d; nearest = b }
  }

  // nearest-station readout — always a visible destination while in the world.
  let nearestText = ''
  if (nearest) {
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
  // mark the nearest station in the rail (only when it changes)
  const nearId = nearest ? nearest.project.id : null
  if (nearId !== lastNearId) {
    if (lastNearId && railButtons.get(lastNearId)) railButtons.get(lastNearId).classList.remove('near')
    if (nearId && railButtons.get(nearId)) railButtons.get(nearId).classList.add('near')
    lastNearId = nearId
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
  fitFov()
  if (state === 'intro') camera.position.z = introZ()
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
