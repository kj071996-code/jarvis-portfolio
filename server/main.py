"""JARVIS portfolio — paper/simulated backend (FastAPI).

This is a *paper* engine, not real trading and not real speech analysis:

- Trading Bots runs a simulated paper balance that drifts with a small
  random walk while paper trading is "running". No real funds, no exchange,
  no orders ever leave this process.
- Speaking Coach grades drills with simple rules (transcript length and
  filler-word count), not speech recognition or an LLM.

All seed data mirrors ``src/config.js`` exactly — the same $250.00 starting
balance, the same bots, positions, trades, equity series, coach stats,
radar values, drills, sessions and history. Change the figures in
``src/config.js`` and mirror them here (or extend ``/api/trading/status``
and ``/api/coach/stats`` to read them from a shared file).

Run from the repo root:

    pip install -r server/requirements.txt
    python -m uvicorn server.main:app --reload --port 8000

The frontend only calls this when ``CONFIG.apiBase`` is set (e.g.
``'http://localhost:8000'``). With ``apiBase`` empty it uses the simulated
data in ``config.js`` instead, which is how the site works on GitHub Pages.
"""

from __future__ import annotations

import copy
import random
import threading
import time
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Seed data — mirrors src/config.js exactly ──────────────────────────────

START_BALANCE = 250.0

BOTS = [
    {"name": "Momentum Scout", "pair": "BTC / USD", "status": "live", "pnl": "+$12.40"},
    {"name": "Range Rider", "pair": "ETH / USD", "status": "live", "pnl": "+$4.18"},
    {"name": "Night Owl", "pair": "SOL / USD", "status": "paused", "pnl": "−$1.02"},
    {"name": "Mean Reverter", "pair": "XRP / USD", "status": "idle", "pnl": "$0.00"},
]

EQUITY_SERIES = [
    250, 251, 249, 252, 254, 253, 256, 258, 257, 260, 262, 261,
    264, 266, 265, 268, 270, 269, 272, 274, 273, 276, 278, 281,
]

POSITIONS = [
    {"pair": "BTC / USD", "side": "long", "size": "0.012", "entry": "$97,420", "pnl": "+$8.60"},
    {"pair": "ETH / USD", "side": "long", "size": "0.18", "entry": "$3,412", "pnl": "+$3.80"},
    {"pair": "SOL / USD", "side": "short", "size": "1.4", "entry": "$212.30", "pnl": "−$1.02"},
]

TRADES = [
    {"pair": "BTC / USD", "side": "buy", "price": "$97,420", "time": "09:41", "pnl": "+$8.60"},
    {"pair": "ETH / USD", "side": "buy", "price": "$3,412", "time": "09:12", "pnl": "+$3.80"},
    {"pair": "SOL / USD", "side": "sell", "price": "$212.30", "time": "08:57", "pnl": "−$1.02"},
    {"pair": "BTC / USD", "side": "sell", "price": "$96,980", "time": "08:20", "pnl": "+$4.10"},
]

COACH_STATS = [
    {"label": "last grade", "value": "C+/A−", "sub": "fluency / close"},
    {"label": "streak", "value": "12", "sub": "days in a row"},
    {"label": "score", "value": "0", "sub": "points this week"},
    {"label": "best grade", "value": "A−", "sub": "all time"},
]

RADAR_AXES = ["Fluidity", "Conviction", "Confidence", "Clarity", "Close"]
RADAR_VALUES = [62, 48, 55, 71, 44]

SHINE = [
    "Clarity — your points land in one breath",
    "Pace — you slow down at the right moments",
]

IMPROVE = [
    "Close — ask for the next step out loud",
    "Conviction — hold the last word a beat longer",
]

DRILLS = [
    "Pitch the product in 30 seconds, no filler words",
    "Handle the objection: “we already have someone”",
    "Close a call: name the next step and the date",
    "Explain the price before they ask",
]

SESSIONS = [
    {"name": "Objection handling", "date": "Nov 24", "grade": "B"},
    {"name": "30-second pitch", "date": "Nov 23", "grade": "C+"},
    {"name": "Discovery call", "date": "Nov 22", "grade": "B−"},
]

HISTORY = [
    {"text": "Streak hit 12 days", "date": "Nov 24"},
    {"text": "Best grade A− on the close drill", "date": "Nov 21"},
    {"text": "First drill completed", "date": "Nov 14"},
]

FILLERS = {"um", "uh", "like", "you know", "basically", "actually", "so", "yeah"}
DRILL_SECONDS = 30

# ── App ────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="jarvis-portfolio backend",
    description="Paper/simulated engine for the JARVIS portfolio dashboards.",
)

# Local dev only: the Vite dev server (5173) and preview server (4173).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── In-memory state ────────────────────────────────────────────────────────

class TradingState:
    """Paper-trading state. A daemon thread ticks the balance while running."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.running = False
        self.balance = START_BALANCE
        self.equity_series = list(EQUITY_SERIES)
        self._thread = threading.Thread(target=self._tick_loop, daemon=True)
        self._thread.start()

    def _tick_loop(self) -> None:
        while True:
            time.sleep(1.2)
            with self.lock:
                if not self.running:
                    continue
                # Small simulated random walk, same shape as the old
                # client-side ticker: slight downward drift, ±$0.60 a tick.
                self.balance += (random.random() - 0.42) * 0.6
                self.equity_series.append(round(self.balance, 2))
                if len(self.equity_series) > 48:
                    self.equity_series = self.equity_series[-48:]

    def status(self) -> dict:
        with self.lock:
            return {
                "running": self.running,
                "balance": round(self.balance, 2),
                "bots": copy.deepcopy(BOTS),
                "positions": copy.deepcopy(POSITIONS),
                "trades": copy.deepcopy(TRADES),
            }

    def equity(self) -> dict:
        with self.lock:
            series = list(self.equity_series)
        first, last = series[0], series[-1]
        delta = last - first
        pct = (delta / first) * 100 if first else 0.0
        sign = "+" if delta >= 0 else "−"
        change = f"{sign}${abs(delta):.2f} ({sign}{abs(pct):.1f}%)"
        return {
            "series": series,
            "change": change,
            "positions": copy.deepcopy(POSITIONS),
            "trades": copy.deepcopy(TRADES),
        }


class CoachState:
    """Speaking-coach state: stats, radar, drills, and rule-based grading."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.stats = copy.deepcopy(COACH_STATS)
        self.radar_values = list(RADAR_VALUES)
        self.shine = list(SHINE)
        self.improve = list(IMPROVE)
        self.sessions = copy.deepcopy(SESSIONS)
        self.history = copy.deepcopy(HISTORY)
        self._drill_index = 0
        self._drills: dict[str, dict] = {}

    def next_prompt(self) -> str:
        prompt = DRILLS[self._drill_index % len(DRILLS)]
        self._drill_index += 1
        return prompt

    def stats_payload(self) -> dict:
        with self.lock:
            return {
                "stats": copy.deepcopy(self.stats),
                "radar": {"axes": list(RADAR_AXES), "values": list(self.radar_values)},
                "shine": list(self.shine),
                "improve": list(self.improve),
                "drills": list(DRILLS),
                "sessions": copy.deepcopy(self.sessions),
                "history": copy.deepcopy(self.history),
            }


trading = TradingState()
coach = CoachState()


# ── Request models ─────────────────────────────────────────────────────────

class DrillSubmit(BaseModel):
    drill_id: str | None = None
    transcript: str | None = None
    notes: str | None = None


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/")
def root() -> dict:
    return {"name": "jarvis-portfolio backend", "ok": True, "docs": "/docs"}


# ── Trading Bots (paper) ───────────────────────────────────────────────────

@app.get("/api/trading/status")
def trading_status() -> dict:
    return trading.status()


@app.post("/api/trading/start")
def trading_start() -> dict:
    with trading.lock:
        trading.running = True
    return trading.status()


@app.post("/api/trading/stop")
def trading_stop() -> dict:
    with trading.lock:
        trading.running = False
    # Balance is kept where it is — paper trading pauses, it does not reset.
    return trading.status()


@app.get("/api/trading/equity")
def trading_equity() -> dict:
    return trading.equity()


# ── Speaking Coach (rule-based drills) ─────────────────────────────────────

@app.get("/api/coach/stats")
def coach_stats() -> dict:
    return coach.stats_payload()


@app.post("/api/coach/drill/start")
def drill_start() -> dict:
    with coach.lock:
        prompt = coach.next_prompt()
        drill_id = uuid.uuid4().hex[:8]
        coach._drills[drill_id] = {"prompt": prompt, "started_at": time.time()}
    return {"drill_id": drill_id, "prompt": prompt, "duration_seconds": DRILL_SECONDS}


def _grade(transcript: str | None, notes: str | None) -> tuple[str, dict]:
    """Rule-based grade. No speech recognition, no LLM.

    With a transcript: score from word count and filler-word rate.
    Without one: a flat 'B', matching the old client-side drill result.
    Returns (grade, per-axis deltas to apply to the radar).
    """
    text = " ".join(t for t in (transcript, notes) if t).strip()
    if not text:
        return "B", {"Close": 4, "Conviction": 2}
    words = text.lower().split()
    fillers = sum(1 for w in words if w.strip(".,!?") in FILLERS)
    filler_rate = fillers / max(len(words), 1)
    # Longer, cleaner delivery scores higher; heavy filler drags it down.
    # Calibrated so a clean ~30-word pitch lands C+, ~60 words B, ~90 A−.
    score = 60 + min(len(words), 100) * 0.35 - filler_rate * 80
    if score >= 85:
        grade = "A−"
    elif score >= 75:
        grade = "B"
    elif score >= 65:
        grade = "C+"
    else:
        grade = "C"
    weakest = "Close" if filler_rate > 0.08 else "Conviction"
    return grade, {weakest: 4, "Fluidity": 2}


@app.post("/api/coach/drill/submit")
def drill_submit(body: DrillSubmit) -> dict:
    with coach.lock:
        drill = coach._drills.get(body.drill_id) if body.drill_id else None
        if body.drill_id and not drill:
            raise HTTPException(status_code=404, detail="unknown drill_id")
        prompt = drill["prompt"] if drill else DRILLS[0]

        grade, deltas = _grade(body.transcript, body.notes)
        # Nudge the radar up on the axes the grade says to work on.
        for axis, delta in deltas.items():
            i = RADAR_AXES.index(axis)
            coach.radar_values[i] = min(100, coach.radar_values[i] + delta)
        # Update the stat cards: last grade becomes "<grade>/A−", score +10.
        for stat in coach.stats:
            if stat["label"] == "last grade":
                stat["value"] = f"{grade}/A−"
            if stat["label"] == "score":
                stat["value"] = str(int(stat["value"]) + 10)
        if grade in ("A−", "A"):
            for stat in coach.stats:
                if stat["label"] == "best grade":
                    stat["value"] = grade
        coach.sessions.insert(
            0, {"name": prompt[:32], "date": "Today", "grade": grade}
        )
        coach.history.insert(
            0, {"text": f"Drill completed — grade {grade}", "date": "Today"}
        )
        if body.drill_id:
            coach._drills.pop(body.drill_id, None)
        return {
            "drill_id": body.drill_id,
            "prompt": prompt,
            "grade": grade,
            "radar": {"axes": list(RADAR_AXES), "values": list(coach.radar_values)},
            "shine": list(coach.shine),
            "improve": list(coach.improve),
            "stats": copy.deepcopy(coach.stats),
            "sessions": copy.deepcopy(coach.sessions),
            "history": copy.deepcopy(coach.history),
        }
