/** Joins class names, skipping empty values. Variants never pass conflicting utilities. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
