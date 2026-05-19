import type { DateWindow } from "../types.js";

export function toUtcStartOfDay(date: string): string {
  if (date.includes("T")) {
    return new Date(date).toISOString();
  }

  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

export function toUtcEndExclusive(date: string): string {
  if (date.includes("T")) {
    return new Date(date).toISOString();
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString();
}

export function normalizeWindow(start: string, end: string): DateWindow {
  return {
    start: toUtcStartOfDay(start),
    end: toUtcEndExclusive(end)
  };
}

export function epochToIso(value: number): string {
  const millis = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Date(millis).toISOString();
}
