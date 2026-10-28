# تمريني — Adaptive training plan

Personal, single-user Arabic (RTL) web app for three goals: 5 km in 25:00, 70 strict push-ups, and 70 sit-ups in one set.
No accounts or server; data stays in the browser's localStorage.

## Structure

```
src/
  domain/      pure rules, no React — testable on their own
    training/  curricula (running, push-ups, sit-ups), placement, progression, review
    calendar/  Kuwait dates, absence fallback, schedule replay and projection
    progress/  records, milestones, statistics and goal progress
    program/   stored data types and the commands that enforce edit rules
  data/        versioned localStorage + repository
  app/         React wiring (store hook, Kuwait "today")
  features/    page sections (calendar, daily card, stats, progress, dialogs)
  components/  UI primitives and formatting
  styles/      design tokens and global styles
  tests/       Vitest suites for the domain
```

The engine stores only facts (placements, pauses, per-day inputs) and replays them day by day in
Asia/Kuwait dates, so missed days are derived (never double-counted) and editing today recomputes
progress without counting the same session twice. Past days are read-only and future days view-only,
enforced in `domain/program/commands.ts`, not only in the UI.

## Scripts

```
npm install
npm test          # domain tests
npm run dev
npm run build     # type-check + production build in dist/
```

Pushing to `main` or the working branch runs the tests, builds, and publishes `dist/` to GitHub Pages.
