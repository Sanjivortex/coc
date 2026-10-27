'use client';

import { useMemo } from 'react';
import { villageFromApi, type ApiPlayer } from '@/lib/village';
import { VillageView } from './village/VillageView';

export function PlayerVillage({ player }: { player: ApiPlayer }) {
  const village = useMemo(() => villageFromApi(player), [player]);
  return <VillageView village={village} />;
}
