// ── Scene 3 · Project screens ──────────────────────────────────────────────
// Full dark-mode dashboard UIs, rendered as plain HTML/CSS overlays over the
// canvas. All copy and data comes from config.js — nothing is hard-coded here
// except structure and styling hooks.
//
// ── Backend API (optional) ─────────────────────────────────────────────────
// When CONFIG.apiBase is set (e.g. 'http://localhost:8000'), the dashboards
// fetch live data from the FastAPI backend in server/ (paper trading engine
// + rule-based drill grading). When apiBase is empty or a request fails,
// everything falls back to the simulated data in config.js, so the site
// keeps working on GitHub Pages with no backend at all. Layout and copy are
// identical either way — only the data source changes.
import { CONFIG } from '../config.js'

const fmt = (n) => n.toFixed(2)

function el(tag, cls, html) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (html != null) node.innerHTML = html
  return node
}

// ── Optional backend client ────────────────────────────────────────────────
const API_BASE = (CONFIG.apiBase || '').replace(/\/$/, '')

let backendChecked = false
let backendOk = false

async function api(path, opts) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3000)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      ...opts,
    })
    if (!res.ok) throw new Error(`api ${path} → ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function backendAvailable() {
  if (!API_BASE) return false
  if (backendChecked) return backendOk
  backendChecked = true
  try {
    const h = await api('/api/health')
    backendOk = h && h.ok === true
  } catch {
    backendOk = false
  }
  return backendOk
}

function sparkline(series, width = 260, height = 74, stroke = '#2dd4bf') {
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  const pts = series
    .map((v, i) => `${((i / (series.length - 1)) * width).toFixed(1)},${(height - 6 - ((v - min) / span) * (height - 14)).toFixed(1)}`)
    .join(' ')
  const last = series[series.length - 1]
  const lastX = width
  const lastY = height - 6 - ((last - min) / span) * (height - 14)
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lastX - 1}" cy="${lastY}" r="3" fill="${stroke}"/>
  </svg>`
}

function rowsTable(headers, rowsHtml) {
  return `<table class="rows"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>`
}

// ── Trading Bots ───────────────────────────────────────────────────────────
function botsHtml(bots) {
  return `<h3>Live trading bots</h3>` + bots.map((b) => `
    <div class="bot-row">
      <span class="dot ${b.status}"></span>
      <span class="name">${b.name}</span>
      <span class="pair">${b.pair}</span>
      <span class="pnl ${b.pnl.startsWith('+') ? 'pos' : b.pnl.startsWith('−') ? 'neg' : ''}">${b.pnl}</span>
    </div>`).join('')
}

function equityHtml(title, series, change) {
  return `<h3>${title}</h3>${sparkline(series)}<div class="eq-change">${change}</div>`
}

function positionsHtml(positions) {
  return `<h3>Open Positions</h3>` + rowsTable(
    ['pair', 'side', 'size', 'pnl'],
    positions.map((p) => `<tr>
      <td>${p.pair}</td>
      <td><span class="side ${p.side}">${p.side}</span></td>
      <td>${p.size}</td>
      <td class="${p.pnl.startsWith('+') ? 'pos' : 'neg'}">${p.pnl}</td>
    </tr>`).join('')
  )
}

function tradesHtml(trades) {
  return `<h3>Recent Trades</h3>` + rowsTable(
    ['pair', 'side', 'price', 'pnl'],
    trades.map((t) => `<tr>
      <td>${t.pair}</td>
      <td><span class="side ${t.side}">${t.side}</span></td>
      <td>${t.price}</td>
      <td class="${t.pnl.startsWith('+') ? 'pos' : 'neg'}">${t.pnl}</td>
    </tr>`).join('')
  )
}

function renderTrading(project, onBack) {
  const d = project.dashboard
  const root = el('div', 'project trading')
  const head = el('div', 'project-head')
  head.innerHTML = `<div><div class="eyebrow">${d.eyebrow}</div><h1>${d.title}</h1></div>`
  const back = el('button', 'pill back-btn', `← ${CONFIG.controls.backLabel}`)
  back.addEventListener('click', onBack)
  head.appendChild(back)
  root.appendChild(head)

  const body = el('div', 'project-body')

  // Top row: balance / secure / live bots
  const grid = el('div', 'trading-grid')
  const balanceCard = el('div', 'card')
  balanceCard.innerHTML = `<h3>${d.balanceLabel}</h3>
    <div class="balance">${d.currency}<span class="balance-value">${fmt(d.balance)}</span></div>
    <button class="btn-teal cta">${d.ctaStart}</button>
    <div class="live-note hidden">● paper trading live — no real funds</div>`
  grid.appendChild(balanceCard)

  const secureCard = el('div', 'card')
  secureCard.innerHTML = `<h3>${d.secure.title}</h3><ul class="secure-list">${d.secure.lines.map((l) => `<li>${l}</li>`).join('')}</ul>`
  grid.appendChild(secureCard)

  const botsCard = el('div', 'card')
  botsCard.innerHTML = botsHtml(d.bots)
  grid.appendChild(botsCard)
  body.appendChild(grid)

  // Lower panels: equity / positions / trades
  const panels = el('div', 'panels')
  const eq = el('div', 'card')
  eq.innerHTML = equityHtml(d.equity.title, d.equity.series, d.equity.change)
  panels.appendChild(eq)

  const pos = el('div', 'card')
  pos.innerHTML = positionsHtml(d.positions)
  panels.appendChild(pos)

  const tr = el('div', 'card')
  tr.innerHTML = tradesHtml(d.trades)
  panels.appendChild(tr)
  body.appendChild(panels)
  root.appendChild(body)

  // Paper trading — backend when configured, client-side ticker otherwise.
  // No real funds either way.
  const cta = balanceCard.querySelector('.cta')
  const note = balanceCard.querySelector('.live-note')
  const balEl = balanceCard.querySelector('.balance-value')
  let running = false
  let tick = null
  let poll = null
  let balance = d.balance
  let dead = false

  function setRunning(r) {
    running = r
    cta.textContent = running ? d.ctaStop : d.ctaStart
    cta.classList.toggle('running', running)
    note.classList.toggle('hidden', !running)
  }

  function applyStatus(status) {
    balEl.textContent = fmt(status.balance)
    botsCard.innerHTML = botsHtml(status.bots)
  }

  function applyEquity(eqData) {
    eq.innerHTML = equityHtml(d.equity.title, eqData.series, eqData.change)
    pos.innerHTML = positionsHtml(eqData.positions)
    tr.innerHTML = tradesHtml(eqData.trades)
  }

  function startPolling() {
    stopPolling()
    poll = setInterval(async () => {
      try {
        const [status, eqData] = await Promise.all([
          api('/api/trading/status'),
          api('/api/trading/equity'),
        ])
        if (dead) return
        applyStatus(status)
        applyEquity(eqData)
      } catch { /* stay on the last good values */ }
    }, 2000)
  }

  function stopPolling() {
    if (poll) clearInterval(poll)
    poll = null
  }

  // If a backend is configured, hydrate from it; otherwise the simulated
  // config.js data above stays as-is.
  ;(async () => {
    if (!(await backendAvailable())) return
    try {
      const [status, eqData] = await Promise.all([
        api('/api/trading/status'),
        api('/api/trading/equity'),
      ])
      if (dead) return
      applyStatus(status)
      applyEquity(eqData)
      if (status.running) {
        setRunning(true)
        startPolling()
      }
    } catch { /* simulated data stays */ }
  })()

  cta.addEventListener('click', async () => {
    if (await backendAvailable()) {
      try {
        const status = running
          ? await api('/api/trading/stop', { method: 'POST' })
          : await api('/api/trading/start', { method: 'POST' })
        if (dead) return
        setRunning(status.running)
        applyStatus(status)
        if (status.running) startPolling()
        else stopPolling()
      } catch { /* backend hiccup: leave the button alone */ }
      return
    }
    // No backend — existing client-side ticker behaviour.
    running = !running
    cta.textContent = running ? d.ctaStop : d.ctaStart
    cta.classList.toggle('running', running)
    note.classList.toggle('hidden', !running)
    if (running) {
      tick = setInterval(() => {
        balance += (Math.random() - 0.42) * 0.6
        balEl.textContent = fmt(balance)
      }, 1200)
    } else {
      clearInterval(tick)
      balance = d.balance
      balEl.textContent = fmt(balance)
    }
  })
  root._cleanup = () => {
    dead = true
    clearInterval(tick)
    stopPolling()
  }
  return root
}

// ── Speaking Coach ─────────────────────────────────────────────────────────
function radarSvg(axes, values, size = 280) {
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 34
  const angle = (i) => -Math.PI / 2 + (i / axes.length) * Math.PI * 2
  const pt = (i, r) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r]
  const rings = [0.25, 0.5, 0.75, 1].map((f) => {
    const pts = axes.map((_, i) => pt(i, R * f).join(',')).join(' ')
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>`
  }).join('')
  const spokes = axes.map((_, i) => {
    const [x, y] = pt(i, R)
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>`
  }).join('')
  const labels = axes.map((a, i) => {
    const [x, y] = pt(i, R + 20)
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#8a8f98" font-size="11" font-family="Inter, sans-serif">${a}</text>`
  }).join('')
  const dataPts = axes.map((_, i) => pt(i, (R * values[i]) / 100).join(',')).join(' ')
  return `<svg viewBox="0 0 ${size} ${size}">
    ${rings}${spokes}
    <polygon points="${dataPts}" fill="rgba(52,211,153,0.22)" stroke="#34d399" stroke-width="1.5" stroke-linejoin="round"/>
    ${labels}
  </svg>`
}

function renderSpeaking(project, onBack) {
  const d = project.dashboard
  const root = el('div', 'project speaking')
  const head = el('div', 'project-head')
  head.innerHTML = `<div><div class="eyebrow">${d.eyebrow}</div><h1>${d.title}</h1></div>`
  const back = el('button', 'pill back-btn', `← ${CONFIG.controls.backLabel}`)
  back.addEventListener('click', onBack)
  head.appendChild(back)
  root.appendChild(head)

  const body = el('div', 'project-body')

  // Backend data (when configured) overrides the simulated config.js data.
  let liveCoach = null
  let dead = false
  // Drill state lives here (not inside the tab) so switching tabs mid-drill
  // keeps the timer and the backend drill id.
  let drillTimer = null
  let drillId = null
  let drillSeconds = 0
  let drillPrompt = d.drills[0]
  let drillBtn = null
  let drillTimerEl = null
  let chartCardEl = null
  let radarCardEl = null

  // Tabs
  const tabs = el('div', 'tabs')
  d.tabs.forEach((t, i) => {
    const b = el('button', `tab${i === 0 ? ' active' : ''}`, t)
    b.addEventListener('click', () => {
      tabs.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'))
      b.classList.add('active')
      tabBody.innerHTML = ''
      tabBody.appendChild(tabContent(t))
    })
    tabs.appendChild(b)
  })
  body.appendChild(tabs)
  const tabBody = el('div')
  body.appendChild(tabBody)

  function activeTabName() {
    const active = tabs.querySelector('.tab.active')
    return active ? active.textContent : 'Drill'
  }

  function refreshActiveTab() {
    tabBody.innerHTML = ''
    tabBody.appendChild(tabContent(activeTabName()))
  }

  // Stat cards (always visible)
  const stats = el('div', 'stat-grid')
  function renderStats(statsData) {
    stats.innerHTML = statsData.map((s) =>
      `<div class="card stat"><h3>${s.label}</h3><div class="value">${s.value}</div><div class="sub">${s.sub}</div></div>`
    ).join('')
  }
  renderStats(d.stats)
  body.appendChild(stats)

  function tabContent(tab) {
    const data = liveCoach || d
    const wrap = el('div')
    if (tab === 'Drill') {
      const grid = el('div', 'coach-grid')
      const chartCard = el('div', 'card')
      chartCard.innerHTML = `<h3>Grade trend</h3><div class="empty-chart">${data.emptyChart}</div>`
      grid.appendChild(chartCard)
      chartCardEl = chartCard
      const radarCard = el('div', 'card')
      radarCard.innerHTML = `<h3>Skill radar</h3><div class="radar-wrap">${radarSvg(data.radar.axes, data.radar.values)}</div>`
      grid.appendChild(radarCard)
      radarCardEl = radarCard
      wrap.appendChild(grid)

      const drill = el('div', 'card drill-box')
      drill.innerHTML = `<h3>Next drill</h3><div class="drill-prompt">${drillPrompt}</div>
        <button class="btn-green">${drillTimer ? 'Finish drill' : 'Start drill'}</button>
        <span class="drill-timer muted small" style="margin-left:14px">${drillTimer ? `0:${drillSeconds < 10 ? '0' : ''}${drillSeconds} remaining` : ''}</span>`
      const btn = drill.querySelector('.btn-green')
      const timerEl = drill.querySelector('.drill-timer')
      drillBtn = btn
      drillTimerEl = timerEl
      if (drillTimer) btn.dataset.state = 'running'

      btn.addEventListener('click', async () => {
        if (btn.dataset.state === 'running') {
          clearInterval(drillTimer)
          drillTimer = null
          // Backend finish: submit the drill and apply the graded result.
          if (drillId && (await backendAvailable())) {
            try {
              const res = await api('/api/coach/drill/submit', {
                method: 'POST',
                body: JSON.stringify({ drill_id: drillId }),
              })
              drillId = null
              if (dead) return
              btn.dataset.state = ''
              btn.textContent = 'Start drill'
              timerEl.textContent = `drill saved — grade ${res.grade}`
              applyCoachResult(res)
              return
            } catch { /* fall through to the local finish */ }
          }
          // No backend — existing client-side finish.
          drillId = null
          btn.dataset.state = ''
          btn.textContent = 'Start drill'
          timerEl.textContent = 'drill saved — grade B'
          const last = stats.querySelector('.stat .value')
          if (last) last.textContent = 'B/A−'
          const empty = chartCard.querySelector('.empty-chart')
          if (empty) empty.textContent = 'First drill plotted — 1 grade on the chart'
          return
        }
        // Start: ask the backend for a drill prompt when one is configured.
        if (await backendAvailable()) {
          try {
            const res = await api('/api/coach/drill/start', { method: 'POST' })
            drillId = res.drill_id
            drillPrompt = res.prompt
            const promptEl = drill.querySelector('.drill-prompt')
            if (promptEl) promptEl.textContent = drillPrompt
          } catch { drillId = null }
        }
        btn.dataset.state = 'running'
        btn.textContent = 'Finish drill'
        drillSeconds = 30
        timerEl.textContent = `0:${drillSeconds} remaining`
        drillTimer = setInterval(() => {
          drillSeconds--
          if (drillSeconds <= 0) {
            clearInterval(drillTimer)
            drillTimer = null
            if (drillTimerEl) drillTimerEl.textContent = 'time — finish when ready'
            return
          }
          if (drillTimerEl) drillTimerEl.textContent = `0:${drillSeconds < 10 ? '0' : ''}${drillSeconds} remaining`
        }, 1000)
      })
      wrap.appendChild(drill)
    } else if (tab === 'Sessions') {
      const card = el('div', 'card')
      card.innerHTML = `<h3>Past sessions</h3>` + data.sessions.map((s) => `
        <div class="session-row"><span>${s.name}</span><span class="date">${s.date}</span><span class="grade">${s.grade}</span></div>`).join('')
      wrap.appendChild(card)
    } else {
      const card = el('div', 'card')
      card.innerHTML = `<h3>History</h3>` + data.history.map((h) => `
        <div class="session-row"><span>${h.text}</span><span class="date">${h.date}</span></div>`).join('')
      wrap.appendChild(card)
    }
    return wrap
  }
  tabBody.appendChild(tabContent('Drill'))

  // Where you shine / where to improve
  const shine = el('div', 'shine-grid')
  function renderShineImprove(shineData, improveData) {
    shine.innerHTML = `
    <div class="card good"><h3>Where you shine</h3><ul>${shineData.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div class="card work"><h3>Where to improve</h3><ul>${improveData.map((s) => `<li>${s}</li>`).join('')}</ul></div>`
  }
  renderShineImprove(d.shine, d.improve)
  body.appendChild(shine)

  // Apply a graded drill result from the backend to every visible surface.
  function applyCoachResult(res) {
    liveCoach = liveCoach || {}
    liveCoach.stats = res.stats
    liveCoach.radar = res.radar
    liveCoach.shine = res.shine
    liveCoach.improve = res.improve
    liveCoach.sessions = res.sessions
    liveCoach.history = res.history
    renderStats(res.stats)
    renderShineImprove(res.shine, res.improve)
    const empty = chartCardEl && chartCardEl.querySelector('.empty-chart')
    if (empty) empty.textContent = 'First drill plotted — 1 grade on the chart'
    const radarWrap = radarCardEl && radarCardEl.querySelector('.radar-wrap')
    if (radarWrap) radarWrap.innerHTML = radarSvg(res.radar.axes, res.radar.values)
  }

  // If a backend is configured, hydrate from it; otherwise the simulated
  // config.js data above stays as-is.
  ;(async () => {
    if (!(await backendAvailable())) return
    try {
      const data = await api('/api/coach/stats')
      if (dead) return
      liveCoach = data
      renderStats(data.stats)
      renderShineImprove(data.shine, data.improve)
      refreshActiveTab()
    } catch { /* simulated data stays */ }
  })()

  root.appendChild(body)
  root._cleanup = () => {
    dead = true
    if (drillTimer) clearInterval(drillTimer)
    drillTimer = null
  }
  return root
}

// ── Public API ─────────────────────────────────────────────────────────────
export function renderProject(project, onBack) {
  if (project.screen === 'speaking') return renderSpeaking(project, onBack)
  return renderTrading(project, onBack)
}
