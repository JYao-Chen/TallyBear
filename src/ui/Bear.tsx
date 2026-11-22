'use client';
import { useTheme } from '@/components/ThemeProvider';
import s from './ui.module.css';

export type BearPose =
  | 'cheer'
  | 'groceries'
  | 'hello'
  | 'overalls'
  | 'peek'
  | 'quiet'
  | 'thinking'
  | 'together'
  | 'walk'
  | 'welcome';

/** The companion bear. Only in the bear theme, and only in the four places DESIGN-SYSTEM.md allows. */
export function Bear({ pose = 'together', size = 64 }: { pose?: BearPose; size?: number }) {
  const { theme } = useTheme();
  if (theme === 'minimal') return null;
  return (
    <picture className={s.bear} style={{ width: size, height: size }}>
      <source media="(prefers-reduced-motion: reduce)" srcSet={`/characters/${pose}.png`} />
      <img src={`/characters/${pose}.gif`} width={size} height={size} alt="" />
    </picture>
  );
}
