//src/lib/labels.ts
export function pluralizeSk(n: number, one: string, few: string, many: string) {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  if (abs >= 2 && abs <= 4) return few;
  return many;
}

export function nakupLabel(n: number) {
  return pluralizeSk(n, "nákup", "nákupy", "nákupov");
}

export function nakupLabelCap(n: number) {
  return pluralizeSk(n, "Nákup", "Nákupy", "Nákupov");
}