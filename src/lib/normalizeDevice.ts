export interface NormalizedSpecs {
  brand: string;
  family: string;
  modelYear: number | null;
  chipset: string | null;
}

interface NinjaDeviceRow {
  deviceMake?: string | null;
  deviceModel?: string | null;
  processorsName?: string | null;
  osName?: string | null;
}

function normalizeAppleChipset(rawModel: string, processor: string): string {
  const siliconMatch = `${rawModel} ${processor}`.match(
    /\b(?:Apple\s+)?(M[1-4])(?:\s+(Pro|Max|Ultra))?\b/i,
  );

  if (siliconMatch) {
    const generation = siliconMatch[1].toUpperCase();
    const variant = siliconMatch[2]
      ? ` ${siliconMatch[2][0].toUpperCase()}${siliconMatch[2].slice(1).toLowerCase()}`
      : "";

    return `Apple ${generation}${variant}`;
  }

  return "Intel";
}

export function normalizeNinjaDevice(row: NinjaDeviceRow): NormalizedSpecs {
  const make = (row.deviceMake || "").trim();
  const rawModel = (row.deviceModel || "").trim();
  const processor = (row.processorsName || "").trim();
  const os = (row.osName || "").trim();

  // Apple Mac laptops and desktops. CPU data can appear in either Ninja field.
  if (/apple/i.test(make) && /mac/i.test(rawModel)) {
    const yearMatch = rawModel.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : null;

    let family = "Mac";
    if (/MacBook\s*Air/i.test(rawModel)) family = "MacBook Air";
    else if (/MacBook\s*Pro/i.test(rawModel)) family = "MacBook Pro";
    else if (/iMac/i.test(rawModel)) family = "iMac";
    else if (/Mac\s*mini/i.test(rawModel)) family = "Mac mini";

    return {
      brand: "Apple",
      family,
      modelYear: year,
      chipset: normalizeAppleChipset(rawModel, processor),
    };
  }

  // Ninja can report iPads using Apple part numbers rather than product names.
  if (/apple/i.test(make) || /ipad/i.test(os)) {
    return {
      brand: "Apple",
      family: "iPad",
      modelYear: null,
      chipset: null,
    };
  }

  // Samsung tablet model numbers, including the Galaxy Tab A7 Lite family.
  if (/samsung/i.test(make) || /^SM-T/i.test(rawModel)) {
    let family = "Galaxy Tab";
    if (/SM-T220|SM-T227/i.test(rawModel)) family = "Galaxy Tab A7 Lite";

    return {
      brand: "Samsung",
      family,
      modelYear: null,
      chipset: null,
    };
  }

  return {
    brand: make || "Generic",
    family: rawModel || "Unknown Device",
    modelYear: null,
    chipset: processor || null,
  };
}
