'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { normalizeTag, tagSlug } from '@/lib/format';
import { SearchOverlay } from './SearchOverlay';
import { Segmented } from './ui/controls';
import { buttonClass } from './ui/styles';

export function TagSearch() {
  const router = useRouter();
  const [mode, setMode] = useState<'player' | 'clan'>('player');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const tag = normalizeTag(value);
    if (!tag) {
      setError('Tags use only 0 2 8 9 P Y L Q G R J C U V, for example #2PP.');
      return;
    }
    setError(null);
    // The cloud overlay shows at once; the route's loading state keeps it up while the API answers.
    setSearching(tag);
    router.push(`/${mode}/${tagSlug(tag)}`);
  };

  return (
    <form onSubmit={submit} className="w-full max-w-2xl" role="search">
      <div className="mb-4 flex justify-center">
        <Segmented
          label="Search for"
          size="md"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'player', label: 'Player' },
            { value: 'clan', label: 'Clan' },
          ]}
        />
      </div>
      <div
        className={`flex items-center gap-2 rounded-2xl border bg-panel/90 p-2 pl-5 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur transition-colors focus-within:border-[rgba(240,180,41,0.55)] ${
          error ? 'border-critical' : 'border-line'
        }`}
      >
        <Search size={20} className="shrink-0 text-brand" aria-hidden />
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={mode === 'player' ? 'Player tag, e.g. #9Y9PGP9VP' : 'Clan tag, e.g. #2PP'}
          aria-label={`${mode} tag`}
          aria-invalid={!!error}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="h-12 min-w-0 flex-1 bg-transparent font-mono text-base uppercase outline-none placeholder:font-sans placeholder:normal-case placeholder:text-ink-3"
        />
        <button type="submit" className={buttonClass('primary', 'md', 'h-12 rounded-xl px-7 text-[15px] font-semibold')}>
          Search
        </button>
      </div>
      <p className={`mt-2 text-left text-[13px] ${error ? 'text-critical' : 'text-ink-3'}`} aria-live="polite">
        {error ?? 'Find your tag in the game under your name on the profile screen.'}
      </p>
      {searching && <SearchOverlay label={mode === 'player' ? 'Searching for village' : 'Searching for clan'} detail={searching} />}
    </form>
  );
}
