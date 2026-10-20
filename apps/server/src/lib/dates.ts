export const iso = (date: Date): string => date.toISOString();
export const isoOrNull = (date: Date | null | undefined): string | null =>
  date ? date.toISOString() : null;
