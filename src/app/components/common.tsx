import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { logoUrls, teamInfo, TEAMS } from '../../shared/teams';
import { HEADSHOTS_ENABLED } from '../../shared/config';
import { headshot } from '../api/endpoints';
import { useTheme } from '../api/hooks';
import { href } from '../router';
import type { Tag as TagT } from '../model/game';

/** Team logo with fallback chain -> colored abbreviation badge. */
export function TeamLogo({ id, size = 20, abbr }: { id: number; size?: number; abbr?: string }) {
  const theme = useTheme();
  const urls = logoUrls(id, theme);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [theme, id]);
  const t = TEAMS[id];
  const label = abbr ?? t?.abbr ?? '';
  if (i >= urls.length) {
    return (
      <span class="badge" style={{ background: t?.color ?? '#777', minWidth: `${size}px`, height: `${size}px`, padding: '0 2px', fontSize: `${Math.max(8, size * 0.42)}px` }} aria-hidden="true">
        {label}
      </span>
    );
  }
  return (
    <img
      class="logo"
      src={urls[i]}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      onError={() => setI(i + 1)}
    />
  );
}

export function TeamLink({ team, show = 'club', logo = 0 }: { team: any; show?: 'abbr' | 'club' | 'name'; logo?: number }) {
  const t = team?.abbr ? team : teamInfo(team);
  if (!t?.id) return <span>{t?.name ?? 'TBD'}</span>;
  return (
    <a class="team-link" href={href.team(t.id)} title={t.name}>
      {logo > 0 && <TeamLogo id={t.id} size={logo} />}
      <span>{show === 'abbr' ? t.abbr : show === 'name' ? t.name : t.club}</span>
    </a>
  );
}

export function PlayerLink({ p, full = false }: { p?: { id: number; name: string; short?: string }; full?: boolean }) {
  if (!p?.id) return <span class="muted">—</span>;
  return <a href={href.player(p.id)} title={p.name}>{full ? p.name : (p.short || p.name)}</a>;
}

export function Headshot({ id, size = 64 }: { id: number; size?: number }) {
  const [ok, setOk] = useState(true);
  if (!HEADSHOTS_ENABLED || !ok) return <div class="headshot ph" style={{ width: `${size}px`, height: `${size * 1.2}px` }} />;
  return <img class="headshot" src={headshot(id, size * 2)} width={size} height={Math.round(size * 1.2)} alt="" onError={() => setOk(false)} />;
}

/** Box with a classic gradient title bar. */
export function Section({ title, right, children, class: cls = '', flush = false }: {
  title?: ComponentChildren; right?: ComponentChildren; children: ComponentChildren; class?: string; flush?: boolean;
}) {
  return (
    <section class={`box ${cls}`}>
      {title !== undefined && (
        <header class="bar">
          <h2>{title}</h2>
          {right && <div class="bar-right">{right}</div>}
        </header>
      )}
      <div class={flush ? 'box-body flush' : 'box-body'}>{children}</div>
    </section>
  );
}

export function Tabs({ items, active }: { items: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <nav class="tabs">
      {items.map((t) => (
        <a key={t.key} href={t.href} class={t.key === active ? 'tab on' : 'tab'}>{t.label}</a>
      ))}
    </nav>
  );
}

export function Tag({ tag }: { tag?: TagT }) {
  if (!tag) return null;
  return <span class={`tag ${tag.cls}`} title={tag.label}>{tag.code}</span>;
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return <div class="loading">{what}…</div>;
}

export function ErrorBox({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div class="errorbox">
      <b>Couldn't reach the MLB data feed.</b> <span class="muted">{error.message}</span>
      {retry && <> <button class="btn" onClick={retry}>Try again</button></>}
    </div>
  );
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <div class="empty">{children}</div>;
}
