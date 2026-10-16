# Deploy

`.github/workflows/pages.yml` builds and publishes to GitHub Pages on every push to
`main` (https://blaircurrey.github.io/diamond-cast/). It needs Settings → Pages →
Source set to "GitHub Actions" and a repo variable `VITE_CHAT_SERVER`; the build
fails without it rather than ship a site with no chat. The workflow passes the Pages
subpath in as `BASE_PATH` (any build can use it: `BASE_PATH=/diamond-cast/ pnpm build`).
Links between the home page and the app are relative, so they work from any base.
