'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { normalizeTag, tagSlug } from '@/lib/format';

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return items.map((n) => {
    const active = pathname === n.href || pathname?.startsWith(`${n.href}/`);
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={active ? 'page' : undefined}
        className={`rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${active ? 'text-brand' : 'text-ink-3 hover:text-ink'}`}
      >
        {n.label}
      </Link>
    );
  });
}

export function HeaderSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const tag = normalizeTag(value);
    if (!tag) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setValue('');
    router.push(`/player/${tagSlug(tag)}`);
  };

  return (
    <form onSubmit={submit} className="ml-auto w-full max-w-[15rem]" role="search">
      <label className={`flex h-8 items-center gap-2 rounded-lg border bg-panel px-2.5 transition-colors focus-within:border-[rgba(240,180,41,0.5)] ${invalid ? 'border-critical' : 'border-line'}`}>
        <Search size={14} className="shrink-0 text-ink-3" aria-hidden />
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          placeholder="Player tag"
          aria-label="Search player tag"
          aria-invalid={invalid}
          title={invalid ? 'Tags use only 0 2 8 9 P Y L Q G R J C U V' : undefined}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent font-mono text-[13px] uppercase outline-none placeholder:font-sans placeholder:normal-case placeholder:text-ink-3"
        />
      </label>
    </form>
  );
}
