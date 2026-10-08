import type { Family, Field, Format, Inspection } from "../types";
export interface Region {
  start: number;
  end: number;
  family: Family;
  label: string;
  value?: string;
  replacement?: Uint8Array;
}
export function result(
  format: Format,
  fields: Field[],
  regions: Region[],
  warnings: string[] = [],
  cleanable = true,
): Inspection {
  return {
    format,
    fields,
    families: [...new Set(regions.map((r) => r.family))],
    containers: regions.map((r) => ({
      label: r.label,
      family: r.family,
      size: r.end - r.start,
    })),
    warnings,
    cleanable,
    orientation: 1,
  };
}
export function applyRegions(
  source: Uint8Array,
  regions: Region[],
  families: Family[],
) {
  const output = source.slice(),
    selected = new Set(families);
  for (const r of regions)
    if (selected.has(r.family)) {
      if (r.start < 0 || r.end > source.length || r.end < r.start)
        throw new Error("Invalid metadata range.");
      output.fill(0, r.start, r.end);
      if (r.replacement) {
        if (r.replacement.length !== r.end - r.start)
          throw new Error("Unsafe metadata rewrite.");
        output.set(r.replacement, r.start);
      }
    }
  return output;
}
export function makeField(
  key: string,
  value: unknown,
  group: Field["group"] = "Container",
): Field {
  const text = String(value).slice(0, 4096),
    sensitive = /gps|location|latitude|longitude|©xyz|loci/i.test(
      `${key} ${text}`,
    );
  return {
    key,
    value: text,
    group: sensitive
      ? "Location"
      : /author|creator|copyright|artist/i.test(key)
        ? "Creator & copyright"
        : /software|producer|app|encoder/i.test(key)
          ? "Software"
          : /date|time/i.test(key)
            ? "Date & time"
            : group,
    sensitive,
  };
}
