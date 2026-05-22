# Roger's design sandbox

This branch (`sandbox/roger`) is your playground. Push anything you want here — it auto-deploys to a preview URL that's totally isolated from the production app. You won't break anything Logan or Atharvaa is working on, and nothing you do here ships to real users until we open a pull request to `main`.

## Your preview URL

Every push to this branch triggers a fresh Vercel deploy. Find the URL in two places:

1. **Vercel dashboard** → `wonder-workshop` project → **Deployments** tab → filter by branch `sandbox/roger`. The most recent green deployment is yours.
2. **Stable alias**: `wonder-workshop-git-sandbox-roger-<team-slug>.vercel.app` (Logan will confirm the exact URL after the first deploy).

Open that URL — same app as production, but with its own browser storage. Projects you create here will not appear on production and vice versa.

## Workflow

```bash
# One-time setup (after Atharvaa adds you as a collaborator)
git clone https://github.com/atharvaarane-cm/wonder-workshop.git
cd wonder-workshop
git checkout sandbox/roger

# Day-to-day
# (edit files in client/src — most visual stuff is in:
#  - client/src/index.css       (all global styles)
#  - client/src/screens/        (Discover home, Board project page)
#  - client/src/components/     (reusable pieces — section cards, image slot, chat panel)
# )

git add .
git commit -m "Describe what you changed"
git push origin sandbox/roger
# Vercel auto-deploys in ~2 minutes. Refresh your preview URL.
```

## Running locally (optional)

If you want hot-reload while you work:

```bash
cd wonder-workshop/client
npm install
npm run dev
# opens http://localhost:5173
```

The serverless `/api/*` endpoints (image generation, brief generation, chat) only run on the deployed Vercel preview — local dev hits production-shared APIs via the same env vars. So image generation works locally too.

## Rules of engagement

- **Don't merge to `main` directly.** Branch protection prevents it anyway. If you want to ship something to production, open a pull request from `sandbox/roger` (or a feature branch off it) into `main` and tag Logan for review.
- **Don't rename or delete the `sandbox/roger` branch.** That's your stable URL — if it disappears, your preview URL changes.
- **Visual changes are encouraged.** Restyling the header, redoing the chat panel, reworking how the image hover-toolbar feels — go for it. Logan and Christy are also iterating on visual design, so check in if you're about to do something large.
- **Functional changes (behavior, data, what fields exist):** check with Logan first. The brief schema and lock system are load-bearing for the festival sizzle work.

## Useful files to know

- `client/src/screens/Discover.jsx` — the home page (prompt input + recent projects sidebar + folders)
- `client/src/screens/Board.jsx` — the project page (sections, topbar, chat panel)
- `client/src/components/ImageSlot.jsx` — every AI image slot in the app (hover toolbar, lightbox, version history)
- `client/src/components/sections/` — one file per brief section (CharacterDesign, ShotList, MoodBoard, etc.)
- `client/src/components/AgentPanel.jsx` — the right-side chat panel
- `client/src/index.css` — every visual style. Searchable by feature; section comments split it up.

## Who to ping

- **Logan** (PM, ships features) — for anything about scope, what to build, why something works the way it does.
- **Atharvaa** (engineer, repo owner) — for access issues, env var problems, anything that needs admin permissions.
- **Christy** — visual design pass collaborator.

Welcome aboard.
