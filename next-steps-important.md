# Next Steps — Architecture (IMPORTANT)

## Executive Brief

Wonder Workshop works, and people can use it today. But under the hood it has
grown faster than its foundation, and we are now paying a hidden tax on every
change: the same work has to be done in several places, and most of the product
lives in a single enormous file that only a few people can safely touch. The
practical effect is that new features take longer than they should, bugs are
easy to reintroduce, and onboarding a new engineer is slow. None of this is
visible to users yet — which is exactly why it's the right time to fix it,
before the cost compounds.

The fix is **not a rewrite, and not a pause on the roadmap.** It is a focused
cleanup we can do incrementally while continuing to ship. Three moves do most of
the work: (1) collapse three duplicate copies of our server logic into one
source of truth, so a change is made once instead of three or four times; (2)
delete the old version of the app we already replaced but never removed, which
is roughly a third of the codebase sitting dead; and (3) break the one giant
file into normal, reviewable pieces. Each step is independently shippable and
lowers risk rather than adding it.

The payoff is concrete: faster feature delivery, fewer regressions, the ability
for more than one engineer to work in parallel without colliding, and a
foundation we can actually add automated testing and a real backend to. The
investment is measured in days for the high-impact steps and ongoing effort for
the deeper cleanup — small relative to the speed and reliability we get back.
**Recommendation: approve the phased plan below and start with Phase 0 now.**

---

> Instructions for future work on Wonder Workshop. Read this before making
> structural changes. Paths below are relative to the inner `wonder-workshop/`
> app directory unless noted.

## What this project is

A React 19 + Vite "creative brief / storyboard" tool that calls Gemini for
text, image generation, and brand lookup. Two structural problems dominate the
codebase; fix those before anything else.

---

## The two core problems

### 1. `client/src/v2/Workshop.jsx` is a 7,923-line god module

It contains ~80 React components, **92 `useState`**, **33 `useEffect`**, the
reducer (`storyboardReducer` / `applyAction`), AND four homegrown framework
subsystems inlined at module scope:

- a global event bus — `uiBus` (~line 644)
- a pending-operations tracker — `_pending`, `markPending` / `markDone` (~671)
- a log buffer + listeners — `_logBuffer` (~704)
- a toast / confirm / `UIProvider` system (~720–857)
- mock AI — `mockAI`, `mockFrameAI`, `mockImproveText` (~1297–1426)
- chat tool dispatch — `applyChatToolCall` (~1137)

Everything from `WLogo` to `ProductionView` lives in one file. Unmaintainable,
untestable, and a merge-conflict magnet — and it's where active branch work
happens.

### 2. The backend exists in three copies with no single source of truth

- `server.js` — 381-line Express server (local dev, port 4200)
- `api/*` — Vercel serverless functions
- `client/api/*` — a **byte-identical** copy of the same functions

`chat.js`, `image.js`, `ping.js` are IDENTICAL across `api/` and `client/api/`.
The same Gemini-calling logic is maintained in up to 3–4 places (Express
handlers are a 4th re-implementation). Any prompt/model change must be made
everywhere or it silently drifts.

---

## Supporting problems

- **Dead-weight v1/v2 fork.** `App.jsx` defaults to v2 but keeps legacy
  `screens/Board.jsx` (1,033 lines), `screens/Discover.jsx` (1,297),
  `hooks/useProject.js`, `hooks/useBrief.js`, and a parallel
  `components/sections/*` tree alive behind `?v=1`. ~3,000 lines of bitrotting
  parallel code. The in-code comment says it can be deleted "once v2 is signed
  off."
- **Duplicated utilities across the fork.** Two `pptxExport.js`
  (`utils/pptxExport.js` + `v2/pptxExport.js`), two image-gen paths, two
  `EditableText` (a component file *and* an inline copy in Workshop ~line 1473),
  two `parseShareHash`.
- **No real persistence layer.** State lives in localStorage + IndexedDB
  (`v2/persistence.js`, `v2/blobStore.js`), storing ~500KB Gemini data-URLs
  client-side. Acknowledged-temporary ("while v2's backend wires up") — but
  there is no server-side project model at all.
- **No tests anywhere.** The monolith's design makes adding them nearly
  impossible.
- **Secrets in URL query strings.** `server.js:154` puts the Gemini key in the
  request URL. `.env.local` is present in the working dir.

---

## The fix — phased, lowest-risk first

This is **not a rewrite.** It is: consolidate the backend to one copy, delete
the v1 fork, then mechanically decompose `Workshop.jsx`. Everything else is
downstream.

### Phase 0 — Stop the bleeding (hours)

1. Delete `client/api/`. Pick **one** backend model — given `vercel.json`,
   standardize on Vercel serverless functions (`api/*`) and run them locally
   with `vercel dev` instead of maintaining `server.js` separately.
2. Extract shared Gemini logic into `api/_lib/gemini.js` so `chat` / `image` /
   `brand` import it rather than re-implement it.

### Phase 1 — Kill the fork (days)

3. Confirm v2 is signed off, then delete `screens/`, the v1 `hooks/`, v1
   `components/sections/`, the legacy `App.jsx` branch, and the duplicate
   `utils/pptxExport.js`. Removes ~3–4k lines and ends the "which copy is real"
   confusion.

### Phase 2 — Decompose the monolith (the real work)

4. Lift the four inlined subsystems out first (fewest dependencies, cleanly
   separable): `lib/uiBus.js`, `lib/pending.js`, `lib/log.js`,
   `providers/UIProvider.jsx`, `lib/mockAI.js`.
5. Move reducer + constants to `state/storyboardReducer.js` +
   `state/constants.js`. Expose state via context/store so children stop drilling
   props. Consolidating the 92 `useState` into the reducer lets most of them
   disappear.
6. Split components by domain: `components/brand/`, `components/mood/`,
   `components/character/`, `components/shotlist/`, `components/production/`,
   `components/chat/`. **Target: no file over ~400 lines.**
7. Centralize all `fetch("/api/...")` calls into `lib/api.js` so the UI never
   hand-rolls requests.

### Phase 3 — Foundation (ongoing)

8. Add a server-side persistence layer (the acknowledged TODO) so projects /
   images aren't trapped in one browser.
9. Add tests. Once the reducer and api client are extracted they're trivially
   unit-testable — highest-ROI first target.

---

## One-sentence version

Consolidate the backend to one copy, delete the v1 fork, and mechanically
decompose the 7.9k-line `Workshop.jsx` starting with its four inlined
"mini-frameworks" and the reducer. The three moves above unlock everything else.
