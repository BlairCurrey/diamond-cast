import { useMemo, useState } from 'preact/hooks';
import { header, playLog } from '../../model/game';
import { Section } from '../../components/common';
import { PlayLog } from './PlayLog';

/** Full chronological play-by-play with an inning filter and a scoring-only toggle. */
export function Plays({ feed, version }: { feed: any; version: number }) {
  const h = header(feed);
  const halves = useMemo(() => playLog(feed), [feed, version]);
  const [scoring, setScoring] = useState(false);
  const [inning, setInning] = useState(0);
  const innings = Array.from(new Set(halves.map((x) => x.inning)));
  const shown = inning ? halves.filter((x) => x.inning === inning) : halves;
  return (
    <Section
      title="Play by play"
      flush
      right={
        <span class="plays-ctl">
          <label><input type="checkbox" checked={scoring} onChange={(e) => setScoring((e.target as HTMLInputElement).checked)} /> Scoring plays only</label>
          <select value={inning} onChange={(e) => setInning(Number((e.target as HTMLSelectElement).value))} aria-label="Inning">
            <option value={0}>All innings</option>
            {innings.map((i) => <option value={i}>Inning {i}</option>)}
          </select>
        </span>
      }
    >
      <PlayLog feed={feed} halves={shown} newestFirst={false} abbr={{ away: h.away.abbr, home: h.home.abbr }} scoringOnly={scoring} />
    </Section>
  );
}
