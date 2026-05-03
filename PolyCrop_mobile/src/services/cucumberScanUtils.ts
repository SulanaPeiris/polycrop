export type CucumberSizeCm = {
  cmPerPx?: number | null;
  lengthCm?: number | null;
  diameterCm?: number | null;
};

export type CucumberPixelSize = {
  lengthPx?: number | null;
  diameterPx?: number | null;
  bboxW?: number | null;
  bboxH?: number | null;
};

export type CucumberItem = {
  index?: number;
  box?: number[];
  conf?: number | null;
  pixel?: CucumberPixelSize | null;
  cm?: CucumberSizeCm | null;
  ripe?: boolean | null;
};

export type CucumberScanVM = {
  id: string;
  raw: any;
  status: string;
  imageUrl: string;
  annotatedUrl: string;
  createdAtMs: number;
  updatedAtMs: number;
  displayTimeMs: number;
  cucumberCount: number;
  ripeCount: number;
  unripeCount: number;
  distanceCm: number | null;
  cucumbers: CucumberItem[];
};

export type PlantHarvestStats = {
  scanCount: number;
  cucumberScanCount: number;
  totalCucumbers: number;
  totalRipe: number;
  totalUnripe: number;
  latestAtMs: number;
  latestCaptureId: string;
  latestImageUrl: string;
  latestAnnotatedUrl: string;
  latestDistanceCm: number | null;
};

export const EMPTY_PLANT_HARVEST_STATS: PlantHarvestStats = {
  scanCount: 0,
  cucumberScanCount: 0,
  totalCucumbers: 0,
  totalRipe: 0,
  totalUnripe: 0,
  latestAtMs: 0,
  latestCaptureId: "",
  latestImageUrl: "",
  latestAnnotatedUrl: "",
  latestDistanceCm: null,
};

export function toNumberOrNull(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  if (typeof ts === "string") return Date.parse(ts) || 0;
  if (typeof ts === "number") return ts;
  return 0;
}

export function timeAgo(ms: number): string {
  if (!ms) return "N/A";

  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);

  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function formatDateTime(ms: number): string {
  if (!ms) return "N/A";
  return new Date(ms).toLocaleString();
}

export function formatCm(value: any, decimals = 1): string {
  const n = toNumberOrNull(value);
  if (n === null || n <= 0) return "N/A";
  return `${n.toFixed(decimals)} cm`;
}

export function formatPercent(value: any, decimals = 0): string {
  const n = toNumberOrNull(value);
  if (n === null) return "N/A";
  return `${(n * 100).toFixed(decimals)}%`;
}

function firstArray(...values: any[]): any[] {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

export function readCucumbers(data: any): CucumberItem[] {
  const summary = data?.outputs?.summary ?? data?.summary ?? {};
  const ripeness = data?.outputs?.ripeness ?? data?.ripeness ?? {};

  return firstArray(
    summary?.allCucumbers,
    ripeness?.cucumbers,
    data?.allCucumbers,
    summary?.ripeCucumbers,
    data?.ripeCucumbers
  ) as CucumberItem[];
}

export function readRipeCucumbers(data: any): CucumberItem[] {
  const summary = data?.outputs?.summary ?? data?.summary ?? {};
  const ripeness = data?.outputs?.ripeness ?? data?.ripeness ?? {};
  const all = readCucumbers(data);

  return firstArray(summary?.ripeCucumbers, data?.ripeCucumbers).length > 0
    ? (firstArray(summary?.ripeCucumbers, data?.ripeCucumbers) as CucumberItem[])
    : all.filter((c) => c?.ripe === true);
}

export function getCucumberCount(data: any): number {
  const summary = data?.outputs?.summary ?? data?.summary ?? {};
  const count = toNumberOrNull(summary?.counts?.cucumber ?? data?.counts?.cucumber);
  const cucumbers = readCucumbers(data);

  if (count !== null) return Math.max(0, count);
  return Math.max(0, cucumbers.length);
}

export function getRipeCount(data: any): number {
  const summary = data?.outputs?.summary ?? data?.summary ?? {};
  const ripeness = data?.outputs?.ripeness ?? data?.ripeness ?? {};
  const count = toNumberOrNull(
    summary?.ripeCucumberCount ??
      ripeness?.ripeCount ??
      data?.ripeCucumberCount
  );

  if (count !== null) return Math.max(0, count);
  return readRipeCucumbers(data).length;
}

export function getDistanceCm(data: any): number | null {
  const summary = data?.outputs?.summary ?? data?.summary ?? {};
  const ripeness = data?.outputs?.ripeness ?? data?.ripeness ?? {};

  return toNumberOrNull(
    summary?.distanceCm ??
      ripeness?.distanceCm ??
      data?.distanceCm ??
      data?.outputs?.meta?.distanceCm ??
      data?.meta?.distanceCm
  );
}

export function isDoneScan(data: any): boolean {
  const status = String(data?.status ?? "DONE").toUpperCase();
  return status === "DONE" || status === "";
}

export function buildCucumberScanVM(id: string, data: any): CucumberScanVM {
  const cucumbers = readCucumbers(data);
  const cucumberCount = Math.max(getCucumberCount(data), cucumbers.length);
  const ripeCount = Math.min(Math.max(0, getRipeCount(data)), cucumberCount);
  const createdAtMs = toMs(data?.createdAt);
  const updatedAtMs = toMs(data?.updatedAt);

  return {
    id,
    raw: data,
    status: String(data?.status ?? "DONE").toUpperCase(),
    imageUrl: String(data?.imageUrl ?? ""),
    annotatedUrl: String(data?.annotatedUrl ?? data?.imageUrl ?? ""),
    createdAtMs,
    updatedAtMs,
    displayTimeMs: updatedAtMs || createdAtMs,
    cucumberCount,
    ripeCount,
    unripeCount: Math.max(0, cucumberCount - ripeCount),
    distanceCm: getDistanceCm(data),
    cucumbers,
  };
}

export function aggregatePlantHarvest(scans: CucumberScanVM[]): PlantHarvestStats {
  const stats: PlantHarvestStats = { ...EMPTY_PLANT_HARVEST_STATS };

  for (const scan of scans) {
    if (scan.status && scan.status !== "DONE") continue;

    stats.scanCount += 1;

    if (scan.cucumberCount <= 0 && scan.ripeCount <= 0) continue;

    stats.cucumberScanCount += 1;
    stats.totalCucumbers += scan.cucumberCount;
    stats.totalRipe += scan.ripeCount;
    stats.totalUnripe += scan.unripeCount;

    if (scan.displayTimeMs >= stats.latestAtMs) {
      stats.latestAtMs = scan.displayTimeMs;
      stats.latestCaptureId = scan.id;
      stats.latestImageUrl = scan.imageUrl;
      stats.latestAnnotatedUrl = scan.annotatedUrl;
      stats.latestDistanceCm = scan.distanceCm;
    }
  }

  return stats;
}
