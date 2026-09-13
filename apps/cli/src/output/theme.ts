import picocolors from 'picocolors';

export type Tone = 'strong' | 'muted' | 'positive' | 'caution' | 'negative';

/** Semantic text styles. Renderers choose a tone; the theme decides how it looks. */
export type Theme = Readonly<Record<Tone, (text: string) => string>>;

export function createTheme(color: boolean): Theme {
  const colors = picocolors.createColors(color);
  return {
    strong: colors.bold,
    muted: colors.dim,
    positive: colors.green,
    caution: colors.yellow,
    negative: colors.red,
  };
}
