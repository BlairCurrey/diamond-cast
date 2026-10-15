// Single place for site-wide knobs. Rename the product here.
export const SITE_NAME = "Diamond Cast";
export const SITE_DOMAIN = "dmdcast.com"; // shown on the app's "back to home" link

// MLB Stats API origin. It sends permissive CORS headers, so the browser can call it
// directly and no backend is needed. Point this at your own pass-through proxy/cache
// (e.g. a Cloudflare Worker) if you ever need one: VITE_MLB_API=https://my-proxy.example
export const MLB_API: string =
  import.meta.env.VITE_MLB_API ?? "https://statsapi.mlb.com";

// Team logos and player headshots are hot-linked from MLB's public image CDN.
// Set VITE_LOGOS=off to fall back to plain colored abbreviation badges everywhere.
export const LOGOS_ENABLED = (import.meta.env.VITE_LOGOS ?? "on") !== "off";
export const HEADSHOTS_ENABLED =
  (import.meta.env.VITE_HEADSHOTS ?? "on") !== "off";

// Chat backend: a hobbychat server (https://github.com/BlairCurrey/hobbychat), e.g.
// VITE_CHAT_SERVER=http://localhost:8787. Unset, the site has no chat at all (no dock,
// no "Game chat" buttons); ?mock still shows the simulated demo chat.
export const CHAT_SERVER: string | undefined =
  import.meta.env.VITE_CHAT_SERVER || undefined;
