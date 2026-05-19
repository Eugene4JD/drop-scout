export const DEFAULT_CASE_ITEMS = [
  "Kilowatt Case",
  "Revolution Case",
  "Recoil Case",
  "Fever Case",
  "Fracture Case",
  "Dreams & Nightmares Case"
] as const;

export type DefaultCaseItem = (typeof DEFAULT_CASE_ITEMS)[number];

export function parseItems(value: string | undefined): string[] {
  if (!value || value.trim() === "" || value.trim().toLowerCase() === "cases") {
    return [...DEFAULT_CASE_ITEMS];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
