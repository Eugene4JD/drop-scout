export function formatUsd(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  return `USD ${value.toFixed(2)}`;
}

export function formatPct(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value.toFixed(2)}%`;
}

export function formatInt(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "n/a";
  }

  return Math.round(value).toLocaleString("en-US");
}

export function sparkline(values: number[], width = 24): string {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) {
    return "n/a";
  }

  const sampled = sample(clean, width);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const chars = "._-~=*#";

  if (max === min) {
    return ".".repeat(sampled.length);
  }

  return sampled
    .map((value) => {
      const ratio = (value - min) / (max - min);
      const index = Math.min(chars.length - 1, Math.max(0, Math.round(ratio * (chars.length - 1))));
      return chars[index];
    })
    .join("");
}

function sample(values: number[], width: number): number[] {
  if (values.length <= width) {
    return values;
  }

  const result: number[] = [];
  for (let index = 0; index < width; index += 1) {
    const sourceIndex = Math.floor((index / (width - 1)) * (values.length - 1));
    result.push(values[sourceIndex]);
  }

  return result;
}
