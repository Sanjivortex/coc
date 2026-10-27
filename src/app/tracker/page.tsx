import type { Metadata } from 'next';
import { TrackerClient } from '@/components/TrackerClient';

export const metadata: Metadata = {
  title: 'Upgrade Tracker',
  description: 'Paste your Clash of Clans village export to see every defense, trap, wall and hero with the time and resources left to max.',
};

export default function TrackerPage() {
  return <TrackerClient />;
}
