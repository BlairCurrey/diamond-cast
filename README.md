# Diamond Cast

A static MLB site: a marketing home page at `/` and a single-page app at `/app/`
(scoreboard, live gamecast, box scores, play-by-play, player/team pages, standings,
and a docked chat). Data comes straight from the browser to MLB's public Stats API.
No backend.

```
pnpm install
pnpm dev              # http://localhost:5173/  and  /app/
pnpm build            # static output in dist/ — deploy anywhere (Netlify, Pages, S3…)
```

Add `?mock` to the app URL (`/app/?mock`) to run on a built-in simulated slate of
games (live games advance in real time). Useful in the offseason and for design work.
`?mock=0` switches back. The "DEMO DATA" badge in the app bar shows when it's on.

More in `docs/`: [layout](docs/architecture.md), [MLB Stats API](docs/mlb-api.md),
[chat](docs/chat.md), [deploy](docs/deploy.md).

## Legal

The Stats API is unofficial and its copyright notice limits use to individual,
non-commercial, non-bulk purposes. Team logos are MLB trademarks. Fine for a
personal/fan project; get a licensed data feed before charging money or running ads.
