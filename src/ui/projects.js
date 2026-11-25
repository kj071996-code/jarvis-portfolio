// ── Scene 3 · Group screens ────────────────────────────────────────────────
// Full dark-mode dashboard UIs, rendered as plain HTML/CSS overlays over the
// canvas. All copy and data comes from config.js — nothing is hard-coded here
// except structure and styling hooks. Each dashboard shows one White
// Technologies agent group and its six agents, with a switcher across all
// seven groups. The data is static (from config.js); there is no backend
// call for group screens. The FastAPI backend in server/ is left untouched
// for the old dashboards and is not used by this file.
import { CONFIG } from '../config.js'

function el(tag, cls, html) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (html != null) node.innerHTML = html
  return node
}

// ── Agent Group ────────────────────────────────────────────────────────────
function renderGroup(project, onBack, onSwitch) {
  const root = el('div', 'project group')
  // the group's beacon colour accents this dashboard (active tab, dots)
  root.style.setProperty('--group', project.beaconColor)

  const head = el('div', 'project-head')
  const idx = CONFIG.projects.findIndex((p) => p.id === project.id) + 1
  const pad = (n) => String(n).padStart(2, '0')
  head.innerHTML = `<div><div class="eyebrow">white technologies / agent team / <span class="idx">station ${pad(idx)} of ${pad(CONFIG.projects.length)}</span></div><h1>${project.name}</h1></div>`
  const back = el('button', 'pill back-btn', `← ${CONFIG.controls.backLabel}`)
  back.addEventListener('click', onBack)
  head.appendChild(back)
  root.appendChild(head)

  const body = el('div', 'project-body')

  // Team headline + what this group does.
  const headline = el('div', 'team-headline', CONFIG.team.headline)
  body.appendChild(headline)
  const desc = el('div', 'group-desc', project.tagline)
  body.appendChild(desc)

  // Switcher across all seven groups — clicking one crossfades to it.
  const switcher = el('div', 'group-switch')
  for (const p of CONFIG.projects) {
    const b = el('button', `group-tab${p.id === project.id ? ' active' : ''}`, `<span class="tdot"></span>${p.name}`)
    b.style.setProperty('--c', p.beaconColor)
    b.addEventListener('click', () => { if (p.id !== project.id) onSwitch(p) })
    switcher.appendChild(b)
  }
  body.appendChild(switcher)

  // The group's six agents.
  const grid = el('div', 'agent-grid')
  project.agents.forEach((a, i) => {
    const card = el('div', 'card agent-card')
    card.innerHTML = `<div class="agent-top"><span class="agent-name"><span class="agent-idx">${String(i + 1).padStart(2, '0')}</span>${a.name}</span><span class="agent-status"><span class="dot ready"></span>${a.status}</span></div><div class="agent-role">${a.role}</div>`
    grid.appendChild(card)
  })
  body.appendChild(grid)

  // Nothing leaves without approval.
  const note = el('div', 'team-note', CONFIG.team.note)
  body.appendChild(note)

  root.appendChild(body)
  return root
}

// ── Public API ─────────────────────────────────────────────────────────────
export function renderProject(project, onBack, onSwitch) {
  return renderGroup(project, onBack, onSwitch)
}
