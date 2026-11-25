// ─────────────────────────────────────────────────────────────────────────────
// JARVIS PORTFOLIO — single source of truth
// ─────────────────────────────────────────────────────────────────────────────
// Everything Keith (or anyone) needs to swap in their own work lives here:
// all copy, both sample projects, every colour, every label, every timing.
// The scene code reads from this file only — never edit the scenes to change
// content. Add a project to `projects` and a beacon appears in the world.
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG = {
  meta: {
    title: 'jarvis — portfolio',
    brand: 'jarvis',
    brandSuffix: ' — portfolio',
  },

  // ── Colours ──────────────────────────────────────────────────────────────
  colors: {
    background: '#030308',
    backgroundAlt: '#05050a',
    panel: '#0a0a10',
    panelAlt: '#0e0e16',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.14)',
    ink: '#e8e8ea',
    muted: '#8a8f98',
    faint: '#565b66',
    amber: '#ffb347',
    warmWhite: '#fff3df',
    orange: '#ff5a1f',
    red: '#ff2d55',
    blue: '#4f7cff',
    purple: '#8b5cf6',
    teal: '#14b8a6',
    tealBright: '#2dd4bf',
    green: '#34d399',
    greenDeep: '#0a1f16',
    particleWhite: '#e8e8ea',
    particleGray: '#9aa0a6',
  },

  // ── Scene 1 · Intro ring ─────────────────────────────────────────────────
  intro: {
    // Typewriter caption, streamed line by line beneath the ring.
    lines: [
      'The weekend, sir. Still building, I see.',
      'Systems nominal. Portfolio online.',
      'Two stations active in the field.',
      'Walk to a beacon and press Enter.',
    ],
    typeSpeedMs: 34, // ms per character
    linePauseMs: 420, // pause between lines
    ring: {
      barsDesktop: 2600,
      barsMobile: 1400,
      innerRadius: 2.1, // hollow centre
      outerRadius: 5.4,
      // Colour bands by radius: inner warm orange/red → blue/purple → white/gray spikes
      inner: ['#ff2d55', '#ff5a1f', '#ffb347'],
      mid: ['#4f7cff', '#8b5cf6'],
      outer: ['#e8e8ea', '#9aa0a6', '#ffffff'],
      rotateSpeed: 0.06, // radians per second
      pulseSpeed: 1.4,
    },
  },

  // ── Scene 2 · The world ──────────────────────────────────────────────────
  world: {
    terrain: {
      size: 200, // world units across
      pointsDesktop: 450, // grid points per side → ~202k
      pointsMobile: 225, // grid points per side → ~50k
      waveAmp: 1.1,
      rippleAmp: 0.9,
    },
    horizonLight: {
      // huge warm-white elliptical bloom near the horizon
      position: [0, 6, -88],
      scale: [150, 42],
      color: '#fff3df',
      opacity: 0.95,
    },
    beams: 130, // thin vertical light beams
    avatar: {
      speed: 6.5, // world units per second
      start: [0, 0, 26], // stands in the light, facing the horizon
      color: '#050507',
    },
    camera: {
      distance: 11,
      height: 6.5,
      lookHeight: 1.4,
      orbitSway: 0.16, // radians of slow orbital drift
    },
    bounds: 92, // avatar cannot walk past this radius
    enterDistance: 5, // how close to a beacon before "Enter" appears
  },

  // ── Scene 3 · Project stations ───────────────────────────────────────────
  // Add a project here and it appears as a beacon in the world.
  // `screen` selects which dashboard UI to render: 'trading' or 'speaking'.
  projects: [
    {
      id: 'trading-bots',
      label: 'trading bots',
      screen: 'trading',
      beaconColor: '#14b8a6',
      position: [-20, -16],
      dashboard: {
        eyebrow: 'DASHBOARD',
        title: 'Trading Bots',
        balanceLabel: 'paper balance',
        balance: 250.0,
        currency: '$',
        ctaStart: 'Start paper trading',
        ctaStop: 'Stop paper trading',
        secure: {
          title: 'Secure',
          lines: [
            'Keys encrypted at rest',
            'Paper mode — no real funds',
            'Withdrawals disabled',
          ],
        },
        bots: [
          { name: 'Momentum Scout', pair: 'BTC / USD', status: 'live', pnl: '+$12.40' },
          { name: 'Range Rider', pair: 'ETH / USD', status: 'live', pnl: '+$4.18' },
          { name: 'Night Owl', pair: 'SOL / USD', status: 'paused', pnl: '−$1.02' },
          { name: 'Mean Reverter', pair: 'XRP / USD', status: 'idle', pnl: '$0.00' },
        ],
        equity: {
          title: 'Paper Equity',
          // 24 points, plotted as a sparkline
          series: [250, 251, 249, 252, 254, 253, 256, 258, 257, 260, 262, 261, 264, 266, 265, 268, 270, 269, 272, 274, 273, 276, 278, 281],
          change: '+$31.00 (+12.4%)',
        },
        positions: [
          { pair: 'BTC / USD', side: 'long', size: '0.012', entry: '$97,420', pnl: '+$8.60' },
          { pair: 'ETH / USD', side: 'long', size: '0.18', entry: '$3,412', pnl: '+$3.80' },
          { pair: 'SOL / USD', side: 'short', size: '1.4', entry: '$212.30', pnl: '−$1.02' },
        ],
        trades: [
          { pair: 'BTC / USD', side: 'buy', price: '$97,420', time: '09:41', pnl: '+$8.60' },
          { pair: 'ETH / USD', side: 'buy', price: '$3,412', time: '09:12', pnl: '+$3.80' },
          { pair: 'SOL / USD', side: 'sell', price: '$212.30', time: '08:57', pnl: '−$1.02' },
          { pair: 'BTC / USD', side: 'sell', price: '$96,980', time: '08:20', pnl: '+$4.10' },
        ],
      },
    },
    {
      id: 'speaking-coach',
      label: 'speaking coach',
      screen: 'speaking',
      beaconColor: '#34d399',
      position: [22, -12],
      dashboard: {
        eyebrow: 'COACH',
        title: 'Speaking Coach',
        tabs: ['Drill', 'Sessions', 'History'],
        stats: [
          { label: 'last grade', value: 'C+/A−', sub: 'fluency / close' },
          { label: 'streak', value: '12', sub: 'days in a row' },
          { label: 'score', value: '0', sub: 'points this week' },
          { label: 'best grade', value: 'A−', sub: 'all time' },
        ],
        emptyChart: 'Your grades plot here after your first drill',
        radar: {
          axes: ['Fluidity', 'Conviction', 'Confidence', 'Clarity', 'Close'],
          // 0–100 per axis
          values: [62, 48, 55, 71, 44],
        },
        shine: [
          'Clarity — your points land in one breath',
          'Pace — you slow down at the right moments',
        ],
        improve: [
          'Close — ask for the next step out loud',
          'Conviction — hold the last word a beat longer',
        ],
        drills: [
          'Pitch the product in 30 seconds, no filler words',
          'Handle the objection: “we already have someone”',
          'Close a call: name the next step and the date',
          'Explain the price before they ask',
        ],
        sessions: [
          { name: 'Objection handling', date: 'Nov 24', grade: 'B' },
          { name: '30-second pitch', date: 'Nov 23', grade: 'C+' },
          { name: 'Discovery call', date: 'Nov 22', grade: 'B−' },
        ],
        history: [
          { text: 'Streak hit 12 days', date: 'Nov 24' },
          { text: 'Best grade A− on the close drill', date: 'Nov 21' },
          { text: 'First drill completed', date: 'Nov 14' },
        ],
      },
    },
  ],

  // ── Scene 4 · Outro vortex ───────────────────────────────────────────────
  outro: {
    hint: 'to exit full screen, press and hold esc',
    returnLabel: 'return to the world',
    strands: 2800, // line segments per spiral arm (×2 arms)
    turns: 5.5, // spiral turns per arm
  },

  // ── Controls copy ────────────────────────────────────────────────────────
  controls: {
    desktopHint: 'wasd / arrows to walk · enter to open a station',
    mobileHint: 'drag the stick to walk · tap the ground to walk there',
    enterPrompt: 'Enter',
    backLabel: 'Back to the world',
    leaveLabel: 'leave',
  },
}
