# JARVIS portfolio — backend

A small FastAPI server that makes the two dashboards genuinely functional
instead of simulated. It is a **paper/simulated engine**:

- **Trading Bots** runs a paper balance that drifts with a small random
  walk while paper trading is "running". No real funds, no exchange, no
  orders ever leave this process.
- **Speaking Coach** grades drills with simple rules (transcript length and
  filler-word count), not speech recognition or an LLM.

All seed data mirrors `src/config.js` exactly — the same $250.00 starting
balance, bots, positions, trades, equity series, coach stats, radar values,
drills, sessions and history.

## Run it

From the repo root:

```bash
pip install -r server/requirements.txt
python -m uvicorn server.main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs

## Wire the frontend to it

Set `apiBase` in `src/config.js`:

```js
apiBase: 'http://localhost:8000',
```

Then run the frontend (`npm run dev`) and open the dashboards — they fetch
from the backend. Leave `apiBase` empty (the default) and the dashboards use
the simulated data in `config.js` instead, which is how the site works on
GitHub Pages with no backend.

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/health` | `{"ok": true}` — the frontend uses this to detect the backend |
| GET | `/api/trading/status` | Paper balance, running flag, live bots, open positions, recent trades |
| POST | `/api/trading/start` | Start paper trading (balance ticks up/down); returns the status |
| POST | `/api/trading/stop` | Stop paper trading (balance kept where it is); returns the status |
| GET | `/api/trading/equity` | Paper-equity series (sparkline), change, positions, trades |
| GET | `/api/coach/stats` | Stat cards, 5-axis radar, shine/improve, drills, sessions, history |
| POST | `/api/coach/drill/start` | Start a 30-second drill; returns a drill id and prompt |
| POST | `/api/coach/drill/submit` | Submit a drill id (+ optional transcript/notes); returns a grade, updated radar, shine/improve, stats |

State is in-memory and resets when the server restarts. CORS allows the
Vite dev server (`http://localhost:5173`) and preview server
(`http://localhost:4173`).
