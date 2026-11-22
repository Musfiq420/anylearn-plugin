/**
 * Normalizes a typed answer so "CO₂", "co2 " and "CO2." all match.
 * NFKC folds subscripts and full-width characters; non-Latin digits
 * (Bengali, Devanagari, Arabic-Indic, Persian) become ASCII.
 */
export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLocaleLowerCase()
    .replace(/[\s ]+/g, " ")
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’.,;:!?।]+$/g, "")
    .trim();
}

/** Small, stable string hash (FNV-1a). */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic shuffle of [0..n-1] seeded by a string. Never returns the identity order. */
export function shuffledIndices(n: number, seed: string): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  let s = hash(seed) || 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (n > 1 && out.every((v, i) => v === i)) out.push(out.shift()!);
  return out;
}
