import { Search } from 'lucide-react';
import { CloudSky } from './CloudSky';

/**
 * Full-screen "find a match" moment, like the attack search in the game: drifting clouds and a
 * scanning magnifier while the player or clan page loads. Shown by TagSearch on submit and by the
 * loading states of /player/[tag] and /clan/[tag].
 */
export function SearchOverlay({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="search-overlay fade-in" role="status" aria-label={label}>
      <CloudSky />
      <div className="radar">
        <Search size={40} strokeWidth={2.2} className="mag" aria-hidden />
      </div>
      <p className="search-label">
        {label}
        <span className="search-dots" aria-hidden />
      </p>
      {detail && <p className="search-detail">{detail}</p>}
    </div>
  );
}
