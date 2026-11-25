// ── Scene 3 · Project screens ──────────────────────────────────────────────
// Full dark-mode dashboard UIs, rendered as plain HTML/CSS overlays over the
// canvas. All copy and data comes from config.js — nothing is hard-coded here
// except structure and styling hooks.
import { CONFIG } from '../config.js'

const fmt = (n) => n.toFixed(2)

function el(tag, cls, html) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (html != null) node.innerHTML = html
  return node
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
  botsCard.innerHTML = `<h3>Live trading bots</h3>` + d.bots.map((b) => `
    <div class="bot-row">
      <span class="dot ${b.status}"></span>
      <span class="name">${b.name}</span>
      <span class="pair">${b.pair}</span>
      <span class="pnl ${b.pnl.startsWith('+') ? 'pos' : b.pnl.startsWith('−') ? 'neg' : ''}">${b.pnl}</span>
    </div>`).join('')
  grid.appendChild(botsCard)
  body.appendChild(grid)

  // Lower panels: equity / positions / trades
  const panels = el('div', 'panels')
  const eq = el('div', 'card')
  eq.innerHTML = `<h3>${d.equity.title}</h3>${sparkline(d.equity.series)}<div class="eq-change">${d.equity.change}</div>`
  panels.appendChild(eq)

  const pos = el('div', 'card')
  pos.innerHTML = `<h3>Open Positions</h3>` + rowsTable(
    ['pair', 'side', 'size', 'pnl'],
    d.positions.map((p) => `<tr>
      <td>${p.pair}</td>
      <td><span class="side ${p.side}">${p.side}</span></td>
      <td>${p.size}</td>
      <td class="${p.pnl.startsWith('+') ? 'pos' : 'neg'}">${p.pnl}</td>
    </tr>`).join('')
  )
  panels.appendChild(pos)

  const tr = el('div', 'card')
  tr.innerHTML = `<h3>Recent Trades</h3>` + rowsTable(
    ['pair', 'side', 'price', 'pnl'],
    d.trades.map((t) => `<tr>
      <td>${t.pair}</td>
      <td><span class="side ${t.side}">${t.side}</span></td>
      <td>${t.price}</td>
      <td class="${t.pnl.startsWith('+') ? 'pos' : 'neg'}">${t.pnl}</td>
    </tr>`).join('')
  )
  panels.appendChild(tr)
  body.appendChild(panels)
  root.appendChild(body)

  // Paper trading toggle — working state, no real funds.
  const cta = balanceCard.querySelector('.cta')
  const note = balanceCard.querySelector('.live-note')
  const balEl = balanceCard.querySelector('.balance-value')
  let running = false
  let tick = null
  let balance = d.balance
  cta.addEventListener('click', () => {
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
  root._cleanup = () => clearInterval(tick)
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

  // Stat cards (always visible)
  const stats = el('div', 'stat-grid')
  d.stats.forEach((s) => {
    stats.innerHTML += `<div class="card stat"><h3>${s.label}</h3><div class="value">${s.value}</div><div class="sub">${s.sub}</div></div>`
  })
  body.appendChild(stats)

  function tabContent(tab) {
    const wrap = el('div')
    if (tab === 'Drill') {
      const grid = el('div', 'coach-grid')
      const chartCard = el('div', 'card')
      chartCard.innerHTML = `<h3>Grade trend</h3><div class="empty-chart">${d.emptyChart}</div>`
      grid.appendChild(chartCard)
      const radarCard = el('div', 'card')
      radarCard.innerHTML = `<h3>Skill radar</h3><div class="radar-wrap">${radarSvg(d.radar.axes, d.radar.values)}</div>`
      grid.appendChild(radarCard)
      wrap.appendChild(grid)

      const drill = el('div', 'card drill-box')
      drill.innerHTML = `<h3>Next drill</h3><div class="drill-prompt">${d.drills[0]}</div>
        <button class="btn-green">Start drill</button>
        <span class="drill-timer muted small" style="margin-left:14px"></span>`
      const btn = drill.querySelector('.btn-green')
      const timerEl = drill.querySelector('.drill-timer')
      let drillTimer = null
      let seconds = 0
      btn.addEventListener('click', () => {
        if (btn.dataset.state === 'running') {
          clearInterval(drillTimer)
          btn.dataset.state = ''
          btn.textContent = 'Start drill'
          timerEl.textContent = 'drill saved — grade B'
          const last = stats.querySelector('.stat .value')
          if (last) last.textContent = 'B/A−'
          chartCard.querySelector('.empty-chart').textContent = 'First drill plotted — 1 grade on the chart'
          return
        }
        btn.dataset.state = 'running'
        btn.textContent = 'Finish drill'
        seconds = 30
        timerEl.textContent = `0:${seconds} remaining`
        drillTimer = setInterval(() => {
          seconds--
          if (seconds <= 0) {
            clearInterval(drillTimer)
            timerEl.textContent = 'time — finish when ready'
            return
          }
          timerEl.textContent = `0:${seconds < 10 ? '0' : ''}${seconds} remaining`
        }, 1000)
      })
      wrap.appendChild(drill)
      wrap._cleanup = () => clearInterval(drillTimer)
    } else if (tab === 'Sessions') {
      const card = el('div', 'card')
      card.innerHTML = `<h3>Past sessions</h3>` + d.sessions.map((s) => `
        <div class="session-row"><span>${s.name}</span><span class="date">${s.date}</span><span class="grade">${s.grade}</span></div>`).join('')
      wrap.appendChild(card)
    } else {
      const card = el('div', 'card')
      card.innerHTML = `<h3>History</h3>` + d.history.map((h) => `
        <div class="session-row"><span>${h.text}</span><span class="date">${h.date}</span></div>`).join('')
      wrap.appendChild(card)
    }
    return wrap
  }
  tabBody.appendChild(tabContent('Drill'))

  // Where you shine / where to improve
  const shine = el('div', 'shine-grid')
  shine.innerHTML = `
    <div class="card good"><h3>Where you shine</h3><ul>${d.shine.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div class="card work"><h3>Where to improve</h3><ul>${d.improve.map((s) => `<li>${s}</li>`).join('')}</ul></div>`
  body.appendChild(shine)

  root.appendChild(body)
  return root
}

// ── Public API ─────────────────────────────────────────────────────────────
export function renderProject(project, onBack) {
  if (project.screen === 'speaking') return renderSpeaking(project, onBack)
  return renderTrading(project, onBack)
}
