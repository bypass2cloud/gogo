export const defaultExcludedTerms = [
  "교회", "성당", "예배", "미사", "church", "cathedral", "worship", "prayer", "시위", "데모", "protest", "demonstration",
];

export function normalizeExcludedTerms(value: unknown) {
  if (!Array.isArray(value)) return [...defaultExcludedTerms];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 40);
}
