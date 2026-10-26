export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201B\u00B4`]/g, "'");
}

export function normalizeWord(value: string): string {
  return normalizeText(value).trim().toLowerCase();
}
