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

  // ── Backend API (optional) ──────────────────────────────────────────────
  // Set to your FastAPI server URL (e.g. 'http://localhost:8000') to make
  // the dashboards live. Leave '' (the default) for simulated/offline mode
  // — the site then uses only the sample data in this file, which is how it
  // works on GitHub Pages.
  apiBase: '',

  // ── Scene 1 · Intro ring ─────────────────────────────────────────────────
  intro: {
    // Typewriter caption, streamed line by line beneath the ring.
    lines: [
      'The weekend, sir. Still building, I see.',
      'Systems nominal. Portfolio online.',
      'Seven stations active in the field.',
      'Click a beacon to open it.',
    ],
    typeSpeedMs: 80, // ms per character (time-based catch-up keeps it on pace)
    linePauseMs: 350, // pause between lines
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
      scale: [120, 32],
      color: '#fff3df',
      opacity: 0.35,
    },
    beams: 130, // thin vertical light beams
    avatar: {
      speed: 6.5, // world units per second
      // Movement feel — the velocity eases toward its target instead of
      // snapping, so the avatar starts and stops smoothly. Higher = snappier.
      accel: 8, // per-second ease rate toward the target velocity
      turnRate: 6, // per-second ease rate for the heading (smooth turns)
      start: [0, 0, 26], // stands in the light, facing the horizon
      color: '#050507',
    },
    camera: {
      distance: 11,
      height: 6.5,
      lookHeight: 4.5, // camera looks up more — sky, horizon glow and beacon
      // labels sit comfortably in frame instead of near the top edge
      orbitSway: 0.16, // radians of slow orbital drift
      followRate: 2.8, // per-second exponential damping of the follow camera
    },
    bounds: 92, // avatar cannot walk past this radius
  },

  // ── Scene 3 · Agent-group stations ───────────────────────────────────────
  // One beacon per White Technologies marketing agent group. Add a group
  // here and it appears as a beacon in the world. `screen` is 'group' for
  // all of them — the dashboard lists the group's six agents.
  team: {
    headline: '0 employees. 42 AI agents.',
    note: 'Nothing posts or sends without Keith’s approval.',
  },
  projects: [
    {
      id: 'research',
      label: 'research',
      name: 'Research',
      tagline: 'Finds what is trending, who the audience is, and what competitors are doing.',
      screen: 'group',
      beaconColor: '#3b82f6',
      position: [-23.5, 17.5],
      agents: [
        { name: 'Trend Scout', role: 'Finds what local business and AI agent topics are trending this week.', status: 'ready' },
        { name: 'Audience Listener', role: 'Reads public comments and discussion in local business groups.', status: 'ready' },
        { name: 'Comment Miner', role: 'Mines comments on White Technologies posts and on competitor posts.', status: 'ready' },
        { name: 'Competitor Watch', role: 'Tracks what other local AI and automation offers are saying and doing in public.', status: 'ready' },
        { name: 'Post Writer', role: 'Writes short social posts and video hooks for TikTok, Reels and Facebook groups.', status: 'ready' },
        { name: 'Email Writer', role: 'Drafts short outreach and follow-up emails to local businesses.', status: 'ready' },
      ],
    },
    {
      id: 'content',
      label: 'content',
      name: 'Content',
      tagline: 'Makes the visuals, carousels, voiceover and video — and brand-checks everything before it leaves.',
      screen: 'group',
      beaconColor: '#fb923c',
      position: [-17.7, 8.3],
      agents: [
        { name: 'Visual Designer', role: 'Designs static social images for White Technologies in the Tri-Cities.', status: 'ready' },
        { name: 'Carousel Builder', role: 'Builds multi-panel carousel posts for Facebook and Instagram.', status: 'ready' },
        { name: 'Voiceover', role: 'Writes and produces short voiceover narration for Reels and TikTok clips.', status: 'ready' },
        { name: 'Video Editor', role: 'Assembles short video ads and clips for Reels and TikTok.', status: 'ready' },
        { name: 'Brand Check', role: 'Checks every draft and visual against White Technologies branding and voice.', status: 'ready' },
        { name: 'Approval Desk', role: 'The final gate before anything leaves White Technologies.', status: 'ready' },
      ],
    },
    {
      id: 'the-loop',
      label: 'the loop',
      name: 'The Loop',
      tagline: 'Measures posts, revenue, calls and email — and feeds what it learns back into the plan.',
      screen: 'group',
      beaconColor: '#14b8a6',
      position: [-8.6, 2.5],
      agents: [
        { name: 'Post Analyst', role: 'Measures how each published post and video performed.', status: 'ready' },
        { name: 'Revenue Tracker', role: 'Tracks enquiries, calls booked, and revenue that came from the marketing.', status: 'ready' },
        { name: 'Call Tracker', role: 'Logs every inbound call or message that mentions White Technologies.', status: 'ready' },
        { name: 'Email Analyst', role: 'Measures email opens, replies, and outcomes from the outreach emails.', status: 'ready' },
        { name: 'Weekly Report', role: 'Pulls the Loop agents’ numbers together into one short weekly report for Keith.', status: 'ready' },
        { name: 'Loop Feeder', role: 'Turns the week’s learning into next week’s brief for Research and Post Writer.', status: 'ready' },
      ],
    },
    {
      id: 'publish',
      label: 'publish',
      name: 'Publish',
      tagline: 'Schedules and publishes to TikTok, Reels, Shorts, X and newsletter — queue only, nothing posts without approval.',
      screen: 'group',
      beaconColor: '#8b5cf6',
      position: [0, 1],
      agents: [
        { name: 'Scheduler', role: 'Keeps the posting queue and the calendar for White Technologies.', status: 'ready' },
        { name: 'TikTok Poster', role: 'Prepares TikTok posts from approved drafts — caption, hashtags, and video.', status: 'ready' },
        { name: 'Reels Poster', role: 'Prepares Instagram and Facebook Reels posts from approved drafts.', status: 'ready' },
        { name: 'Shorts Poster', role: 'Prepares YouTube Shorts posts from approved drafts.', status: 'ready' },
        { name: 'X Poster', role: 'Prepares X posts from approved drafts.', status: 'ready' },
        { name: 'Newsletter', role: 'Drafts a short email newsletter for people who asked to hear from White Technologies.', status: 'ready' },
      ],
    },
    {
      id: 'sales',
      label: 'sales',
      name: 'Sales',
      tagline: 'Scores leads, books calls, sends reminders and follow-ups, and keeps the CRM current.',
      screen: 'group',
      beaconColor: '#34d399',
      position: [8.6, 2.5],
      agents: [
        { name: 'Lead Scorer', role: 'Scores inbound enquiries and local businesses for fit with White Technologies.', status: 'ready' },
        { name: 'Call Booker', role: 'Prepares a call booking for a scored lead.', status: 'ready' },
        { name: 'Reminder', role: 'Drafts reminders for Keith about calls and follow-ups due today.', status: 'ready' },
        { name: 'Follow-up', role: 'Drafts a short follow-up message after a call or an enquiry.', status: 'ready' },
        { name: 'Payment Link', role: 'Prepares a payment link or invoice draft for an agreed job.', status: 'ready' },
        { name: 'CRM Sync', role: 'Keeps the lead and customer list current from Keith’s own records.', status: 'ready' },
      ],
    },
    {
      id: 'community',
      label: 'community',
      name: 'Community',
      tagline: 'Replies to comments and DMs, builds the FAQ, asks for reviews, and catches leads.',
      screen: 'group',
      beaconColor: '#f59e0b',
      position: [17.7, 8.3],
      agents: [
        { name: 'Comment Replier', role: 'Drafts replies to comments on White Technologies posts and in Facebook groups.', status: 'ready' },
        { name: 'DM Agent', role: 'Drafts replies to direct messages from people asking about White Technologies.', status: 'ready' },
        { name: 'FAQ Builder', role: 'Turns repeated questions from comments and DMs into a short FAQ.', status: 'ready' },
        { name: 'Review Asker', role: 'Drafts a short request asking a happy customer for a review.', status: 'ready' },
        { name: 'Lead Catcher', role: 'Spots people in comments and DMs who want an agent built for their business.', status: 'ready' },
        { name: 'Escalation', role: 'Spots comments and messages that need a human fast and flags them to Keith.', status: 'ready' },
      ],
    },
    {
      id: 'data',
      label: 'data',
      name: 'Data',
      tagline: 'Collects and deciphers the numbers — Research finds, Data deciphers.',
      screen: 'group',
      beaconColor: '#22d3ee',
      position: [23.5, 17.5],
      agents: [
        { name: 'Data Collector', role: 'Gathers raw figures from every channel into one place for the team.', status: 'ready' },
        { name: 'Data Decipherer', role: 'Turns raw figures the team collected into plain-language meaning.', status: 'ready' },
        { name: 'Trend Decoder', role: 'Reads trend data and says what is a real trend and what is only noise.', status: 'ready' },
        { name: 'Competitor Decoder', role: 'Reads competitor moves and says what they mean and how to respond.', status: 'ready' },
        { name: 'Audience Decoder', role: 'Reads audience behaviour and says who to target and what to say to them.', status: 'ready' },
        { name: 'Pattern Spotter', role: 'Finds cross-channel patterns and anomalies across all the data the team collected.', status: 'ready' },
      ],
    },
  ],

  // ── Scene 4 · Outro vortex ───────────────────────────────────────────────
  outro: {
    hint: 'to exit full screen, press and hold esc',
    returnLabel: 'return to the world',
    strands: 2800, // line segments per spiral arm (×2 arms)
    turns: 5.5, // spiral turns per arm
    burstCount: 1400, // starburst particles
    burstSize: 0.35, // starburst particle size
  },

  // ── Controls copy ────────────────────────────────────────────────────────
  controls: {
    desktopHint: 'wasd / arrows to walk · click a beacon to open it',
    mobileHint: 'drag the stick to walk · tap a beacon to open it',
    backLabel: 'Back to the world',
    leaveLabel: 'leave',
  },
}
