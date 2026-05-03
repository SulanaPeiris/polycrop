export type DiseaseKey = "downy_mildew" | "powdery_mildew" | "water_stress" | string;

export type PlantDoc = {
  id: string;
  row?: number;
  column?: number;
  plantUid?: string;
  plantName?: string;
  rfidA?: string | null;
  rfidB?: string | null;

  lastScanAt?: any;
  lastCaptureId?: string | null;
  lastAnnotatedUrl?: string | null;
  lastDiseases?: string[];
  lastCounts?: { cucumber?: number; leaf?: number; flower?: number } | null;

  lastSprayRecommended?: boolean;
  lastCaptureDecision?: string | null;
  lastPump1DurationMs?: number | null;
  lastPump2DurationMs?: number | null;
  lastWaterStressAlert?: boolean;
  lastDiseaseSeverity?: Record<string, DiseaseSeverityStat> | null;
  lastActionLabel?: string | null;
};

export type DiseaseSeverityStat = {
  affectedLeaves?: number;
  severityLevel?: string;
  maxSeverityPercent?: number;
  avgSeverityPercent?: number;
  totalSeverityPercent?: number;
  [key: string]: any;
};

export type LeafSeverityRow = {
  index: number;
  label: string;
  diseases: string[];
  totalSeverityPercent: number | null;
  maxSeverityPercent: number | null;
  severityLevel: string;
  raw: any;
};

export type LegendItem = {
  name: string;
  colorBGR?: number[];
  color?: string;
};

export type DiseaseStatus =
  | "Healthy"
  | "Infected"
  | "WaterStress"
  | "Multiple"
  | "NotScanned";

export type CaptureMetrics = {
  id?: string;
  captureId?: string | null;
  imageUrl: string;
  annotatedUrl: string;
  createdAtMs: number;
  updatedAtMs: number;
  scanned: boolean;

  counts: {
    leaf: number;
    flower: number;
    cucumber: number;
  };

  diseases: string[];
  status: DiseaseStatus;
  affected: boolean;

  diseaseSeverity: Record<string, DiseaseSeverityStat>;
  perLeaf: LeafSeverityRow[];
  legend: LegendItem[];

  captureDecision: string;
  actionLabel: string;
  pump1Ms: number;
  pump2Ms: number;
  waterStressAlert: boolean;
  sprayRecommended: boolean;

  raw: any;
};

export type PlantDiseaseMetrics = CaptureMetrics & {
  plantId: string;
  plantTitle: string;
  row?: number;
  column?: number;
  rfidA?: string | null;
  rfidB?: string | null;
  scanCount: number;
};

export function parseIdToRowCol(id: string): { row?: number; column?: number } {
  const m = /^r(\d+)_c(\d+)$/i.exec(id || "");
  if (!m) return {};
  return { row: Number(m[1]), column: Number(m[2]) };
}

export function toPlantTitle(plant: PlantDoc) {
  return plant.plantUid ?? plant.plantName ?? plant.id.toUpperCase();
}

export function toShortPlantLabel(plant: PlantDoc) {
  const row = plant.row ?? parseIdToRowCol(plant.id).row;
  const column = plant.column ?? parseIdToRowCol(plant.id).column;

  if (row && column) return `R${row}C${column}`;
  return (plant.plantUid ?? plant.id).replace("P-", "");
}

export function toNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toNumberOrNull(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function roundNumber(value: any, decimals = 1, fallback = 0): number {
  const n = toNumber(value, fallback);
  return Number(n.toFixed(decimals));
}

export function formatPercent(value: any, decimals = 1) {
  const n = toNumberOrNull(value);
  if (n === null) return "N/A";
  return `${n.toFixed(decimals)}%`;
}

export function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function timeAgo(ms: number) {
  if (!ms) return "N/A";
  const diff = Date.now() - ms;
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

export function normalizeDiseaseName(value: string): string {
  const v = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_");

  if (v === "downey_mildew") return "downy_mildew";
  if (v === "downy") return "downy_mildew";
  if (v === "downy_mildew_leaf") return "downy_mildew";
  if (v === "powdery") return "powdery_mildew";
  if (v === "powdery_mildew_leaf") return "powdery_mildew";
  if (v === "waterstress") return "water_stress";
  if (v === "water_stress_leaf") return "water_stress";
  return v;
}

export function niceDiseaseName(value: string) {
  const v = normalizeDiseaseName(value);
  if (v === "downy_mildew") return "Downy Mildew";
  if (v === "powdery_mildew") return "Powdery Mildew";
  if (v === "water_stress") return "Water Stress";
  return v
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}


function getSeverityLevelFromPercent(percent: any): string {
  const p = toNumber(percent, 0);
  if (p >= 25) return "HIGH";
  if (p >= 10) return "MEDIUM";
  if (p >= 1) return "LOW";
  return "NONE";
}

function normalizeSeverityStat(raw: any): DiseaseSeverityStat {
  const maxSeverityPercent = roundNumber(
    raw?.maxSeverityPercent ??
      raw?.max_severity_percent ??
      raw?.severityPercent ??
      raw?.severity_percent ??
      raw?.percent ??
      raw?.scorePercent ??
      0,
    2,
    0
  );

  const avgSeverityPercent = roundNumber(
    raw?.avgSeverityPercent ??
      raw?.averageSeverityPercent ??
      raw?.meanSeverityPercent ??
      raw?.avg_severity_percent ??
      maxSeverityPercent,
    2,
    maxSeverityPercent
  );

  const totalSeverityPercent = roundNumber(
    raw?.totalSeverityPercent ??
      raw?.total_severity_percent ??
      avgSeverityPercent,
    2,
    avgSeverityPercent
  );

  const rawLevel = String(
    raw?.severityLevel ??
      raw?.severity_level ??
      raw?.level ??
      raw?.riskLevel ??
      raw?.status ??
      ""
  ).toUpperCase();

  const severityLevel =
    rawLevel && rawLevel !== "N/A" && rawLevel !== "UNKNOWN"
      ? rawLevel
      : getSeverityLevelFromPercent(maxSeverityPercent);

  return {
    ...raw,
    affectedLeaves: toNumber(
      raw?.affectedLeaves ?? raw?.leafCount ?? raw?.leavesAffected,
      0
    ),
    totalSeverityPercent,
    maxSeverityPercent,
    avgSeverityPercent,
    severityLevel,
  };
}

function normalizeSeverityMap(raw: any): Record<string, DiseaseSeverityStat> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: Record<string, DiseaseSeverityStat> = {};

  Object.entries(raw).forEach(([key, value]: any) => {
    const normalizedKey = normalizeDiseaseName(key);
    if (!normalizedKey) return;

    if (value && typeof value === "object") {
      result[normalizedKey] = normalizeSeverityStat(value);
      return;
    }

    const percent = toNumber(value, 0);
    result[normalizedKey] = normalizeSeverityStat({
      affectedLeaves: percent > 0 ? 1 : 0,
      maxSeverityPercent: percent,
      avgSeverityPercent: percent,
      totalSeverityPercent: percent,
    });
  });

  return result;
}

function getLeafSeverityByDisease(leaf: any): Record<string, number> {
  const raw =
    leaf?.severityByDiseasePercent ??
    leaf?.severityByDisease ??
    leaf?.diseaseSeverity ??
    leaf?.diseasesSeverity ??
    leaf?.severity_by_disease_percent ??
    {};

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: Record<string, number> = {};

  Object.entries(raw).forEach(([key, value]) => {
    const normalizedKey = normalizeDiseaseName(key);
    const percent = toNumber(value, 0);
    if (!normalizedKey) return;
    result[normalizedKey] = Math.max(result[normalizedKey] ?? 0, percent);
  });

  return result;
}

function buildSeverityFromPerLeaf(perLeaf: LeafSeverityRow[]): Record<string, DiseaseSeverityStat> {
  const temp: Record<
    string,
    {
      affectedLeaves: number;
      totalSeverityPercent: number;
      maxSeverityPercent: number;
    }
  > = {};

  perLeaf.forEach((leaf) => {
    const severityByDisease = getLeafSeverityByDisease(leaf.raw);

    Object.entries(severityByDisease).forEach(([disease, percent]) => {
      if (!temp[disease]) {
        temp[disease] = {
          affectedLeaves: 0,
          totalSeverityPercent: 0,
          maxSeverityPercent: 0,
        };
      }

      if (percent > 0) {
        temp[disease].affectedLeaves += 1;
      }

      temp[disease].totalSeverityPercent += percent;
      temp[disease].maxSeverityPercent = Math.max(
        temp[disease].maxSeverityPercent,
        percent
      );
    });
  });

  const result: Record<string, DiseaseSeverityStat> = {};

  Object.entries(temp).forEach(([disease, stat]) => {
    const affectedLeaves = Math.max(1, stat.affectedLeaves);
    const avgSeverityPercent = stat.totalSeverityPercent / affectedLeaves;

    result[disease] = normalizeSeverityStat({
      affectedLeaves,
      totalSeverityPercent: stat.totalSeverityPercent,
      maxSeverityPercent: stat.maxSeverityPercent,
      avgSeverityPercent,
    });
  });

  return result;
}

export function bgrToRgbCss(bgr?: number[]) {
  if (!Array.isArray(bgr) || bgr.length < 3) return "#9E9E9E";
  const [b, g, r] = bgr;
  return `rgb(${r}, ${g}, ${b})`;
}

export function diseaseColor(disease: string) {
  const key = normalizeDiseaseName(disease);
  if (key === "downy_mildew") return "#D32F2F";
  if (key === "powdery_mildew") return "#7B1FA2";
  if (key === "water_stress") return "#EF6C00";
  return "#455A64";
}

export function diseaseBg(disease: string) {
  const key = normalizeDiseaseName(disease);
  if (key === "downy_mildew") return "#FFEBEE";
  if (key === "powdery_mildew") return "#F3E5F5";
  if (key === "water_stress") return "#FFF3E0";
  return "#ECEFF1";
}

export function getDotColor(status: DiseaseStatus, scanned: boolean) {
  if (!scanned || status === "NotScanned") return "#9E9E9E";
  if (status === "Healthy") return "#2E7D32";
  if (status === "WaterStress") return "#EF6C00";
  if (status === "Infected") return "#D32F2F";
  if (status === "Multiple") return "#8E24AA";
  return "#999";
}

export function getPlantColor(status: DiseaseStatus, scanned: boolean) {
  if (!scanned || status === "NotScanned") return "#F5F5F5";
  if (status === "Healthy") return "#E8F5E9";
  if (status === "WaterStress") return "#FFF3E0";
  if (status === "Infected") return "#FFEBEE";
  if (status === "Multiple") return "#F3E5F5";
  return "#eee";
}

export function classifyFromDiseases(diseases: string[], scanned: boolean): DiseaseStatus {
  if (!scanned) return "NotScanned";

  const normalized = diseases.map(normalizeDiseaseName);
  const hasDowny = normalized.includes("downy_mildew");
  const hasPowdery = normalized.includes("powdery_mildew");
  const hasStress = normalized.includes("water_stress");
  const count = [hasDowny, hasPowdery, hasStress].filter(Boolean).length;

  if (count === 0) return "Healthy";
  if (count >= 2) return "Multiple";
  if (hasStress) return "WaterStress";
  return "Infected";
}

export function riskLabel(count: number, total: number) {
  if (total <= 0) return "N/A";
  if (count <= 0) return "None";
  const pct = (count / total) * 100;
  if (pct <= 10) return "Low";
  if (pct <= 30) return "Moderate";
  return "High";
}

function getSummary(data: any) {
  return data?.outputs?.summary && typeof data.outputs.summary === "object"
    ? data.outputs.summary
    : {};
}

function getDiseaseOutput(data: any) {
  return data?.outputs?.disease && typeof data.outputs.disease === "object"
    ? data.outputs.disease
    : {};
}

function getWaterStressOutput(data: any) {
  return data?.outputs?.waterStress || data?.outputs?.water_stress || data?.outputs?.stress || {};
}

export function getActionLabel(decision: string) {
  switch (String(decision || "").toUpperCase()) {
    case "PUMP1":
      return "Downy mildew treatment: Pump 1";
    case "PUMP2":
      return "Powdery mildew treatment: Pump 2";
    case "PUMP1_PUMP2":
      return "Both disease treatments: Pump 1 then Pump 2";
    case "ALERT_ONLY":
      return "Water stress alert only";
    case "SPRAY":
      return "Spray treatment required";
    case "NO_SPRAY":
    default:
      return "No spray needed";
  }
}

function normalizeDiseaseList(raw: any, waterStressAlert: boolean): string[] {
  const fromArray = Array.isArray(raw) ? raw : [];
  const normalized = fromArray
    .map((item) => normalizeDiseaseName(String(item)))
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));

  if (waterStressAlert && !unique.includes("water_stress")) {
    unique.push("water_stress");
  }

  return unique;
}

function normalizeLegend(raw: any): LegendItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item: any, idx: number) => ({
    name: String(item?.name ?? item?.label ?? `Class ${idx + 1}`),
    colorBGR: Array.isArray(item?.colorBGR)
      ? item.colorBGR
      : Array.isArray(item?.color_bgr)
      ? item.color_bgr
      : Array.isArray(item?.color)
      ? item.color
      : undefined,
    color: typeof item?.color === "string" ? item.color : undefined,
  }));
}

function normalizePerLeaf(raw: any): LeafSeverityRow[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((leaf: any, idx: number): LeafSeverityRow => {
      const severityByDisease = getLeafSeverityByDisease(leaf);

      const diseaseKeysFromObject =
        severityByDisease && typeof severityByDisease === "object"
          ? Object.keys(severityByDisease)
          : [];

      const rawDiseases = Array.isArray(leaf?.diseases)
        ? leaf.diseases
        : Array.isArray(leaf?.detectedDiseases)
        ? leaf.detectedDiseases
        : diseaseKeysFromObject;

      const diseases = rawDiseases.map((d: any) => normalizeDiseaseName(String(d))).filter(Boolean);

      const totalSeverityPercent = toNumberOrNull(
        leaf?.totalSeverityPercent ?? leaf?.severityPercent ?? leaf?.total_severity_percent
      );

      const maxFromDiseaseMap = Object.values(severityByDisease).reduce(
        (max, value) => Math.max(max, toNumber(value, 0)),
        0
      );

      const maxSeverityPercent = toNumberOrNull(
        leaf?.maxSeverityPercent ?? leaf?.max_severity_percent ?? maxFromDiseaseMap
      );

      const effectivePercent = maxSeverityPercent ?? totalSeverityPercent ?? 0;
      const rawLevel = String(leaf?.severityLevel ?? leaf?.severity_level ?? "").toUpperCase();

      return {
        index: toNumber(leaf?.index ?? leaf?.leafIndex ?? leaf?.leaf_id ?? idx + 1, idx + 1),
        label: String(leaf?.label ?? `Leaf ${toNumber(leaf?.index ?? leaf?.leafIndex ?? idx + 1, idx + 1)}`),
        diseases,
        totalSeverityPercent,
        maxSeverityPercent,
        severityLevel:
          rawLevel && rawLevel !== "N/A"
            ? rawLevel
            : getSeverityLevelFromPercent(effectivePercent),
        raw: leaf,
      };
    })
    .sort(
      (a, b) =>
        toNumber(b.totalSeverityPercent ?? b.maxSeverityPercent, 0) -
        toNumber(a.totalSeverityPercent ?? a.maxSeverityPercent, 0)
    );
}

export function getSeverityForDisease(
  diseaseSeverity: Record<string, DiseaseSeverityStat> | null | undefined,
  disease: string
): DiseaseSeverityStat | null {
  if (!diseaseSeverity || typeof diseaseSeverity !== "object") return null;

  const key = normalizeDiseaseName(disease);
  const entries = Object.entries(diseaseSeverity);

  for (const [rawKey, value] of entries) {
    if (normalizeDiseaseName(rawKey) === key) return value;
  }

  return null;
}

export function severityText(
  diseaseSeverity: Record<string, DiseaseSeverityStat> | null | undefined,
  disease: string
) {
  const stat = getSeverityForDisease(diseaseSeverity, disease);
  if (!stat) return "Severity: N/A";

  const level = String(stat.severityLevel || "N/A");
  const max = formatPercent(stat.maxSeverityPercent ?? 0, 2);
  const avg = formatPercent(stat.avgSeverityPercent ?? 0, 2);
  const leaves = toNumber(stat.affectedLeaves, 0);

  return `${level} • Max ${max} • Avg ${avg} • ${leaves} leaves`;
}

export function pumpTextForDisease(disease: string, pump1Ms: number, pump2Ms: number) {
  const d = normalizeDiseaseName(disease);

  if (d === "downy_mildew") {
    return pump1Ms > 0 ? `Pump 1 active • ${pump1Ms}ms` : "Pump 1 not triggered";
  }

  if (d === "powdery_mildew") {
    return pump2Ms > 0 ? `Pump 2 active • ${pump2Ms}ms` : "Pump 2 not triggered";
  }

  if (d === "water_stress") {
    return "User alert only • No pump";
  }

  return "Action pending";
}

export function extractCaptureMetrics(data: any, id?: string): CaptureMetrics {
  const summary = getSummary(data);
  const diseaseOutput = getDiseaseOutput(data);
  const waterStressOutput = getWaterStressOutput(data);

  const counts = {
    leaf: toNumber(summary?.counts?.leaf ?? data?.counts?.leaf, 0),
    flower: toNumber(summary?.counts?.flower ?? data?.counts?.flower, 0),
    cucumber: toNumber(summary?.counts?.cucumber ?? data?.counts?.cucumber, 0),
  };

  const createdAtMs =
    tsToMs(data?.createdAt) ||
    tsToMs(data?.processedAt) ||
    tsToMs(data?.updatedAt) ||
    tsToMs(summary?.createdAt) ||
    0;

  const updatedAtMs =
    tsToMs(data?.updatedAt) || tsToMs(data?.processedAt) || tsToMs(data?.createdAt) || createdAtMs;

  const captureDecision = String(
    summary?.captureDecision ??
      summary?.decision ??
      data?.captureDecision ??
      data?.decision ??
      "NO_SPRAY"
  ).toUpperCase();

  const pump1Ms = toNumber(
    summary?.pump1DurationMs ?? data?.pump1DurationMs ?? data?.lastPump1DurationMs,
    0
  );

  const pump2Ms = toNumber(
    summary?.pump2DurationMs ?? data?.pump2DurationMs ?? data?.lastPump2DurationMs,
    0
  );

  const waterStressAlert = Boolean(
    summary?.waterStressAlert ??
      data?.waterStressAlert ??
      waterStressOutput?.alert ??
      waterStressOutput?.waterStressAlert ??
      false
  );

  const diseases = normalizeDiseaseList(
    summary?.diseases ?? data?.diseases ?? diseaseOutput?.diseases,
    waterStressAlert
  );

  const scanned = Boolean(createdAtMs || updatedAtMs || data?.status === "DONE" || id);
  const status = classifyFromDiseases(diseases, scanned);

  const perLeaf = normalizePerLeaf(
    diseaseOutput?.perLeaf ?? summary?.perLeaf ?? data?.perLeaf ?? []
  );

  const diseaseSeveritySource =
    summary?.diseaseSeverity && typeof summary.diseaseSeverity === "object"
      ? summary.diseaseSeverity
      : data?.diseaseSeverity && typeof data.diseaseSeverity === "object"
      ? data.diseaseSeverity
      : diseaseOutput?.diseaseSeverity && typeof diseaseOutput.diseaseSeverity === "object"
      ? diseaseOutput.diseaseSeverity
      : diseaseOutput?.severity && typeof diseaseOutput.severity === "object"
      ? diseaseOutput.severity
      : {};

  const diseaseSeverity: Record<string, DiseaseSeverityStat> = {
    ...buildSeverityFromPerLeaf(perLeaf),
    ...normalizeSeverityMap(diseaseSeveritySource),
  };

  const existingWaterStressSeverity = getSeverityForDisease(
    diseaseSeverity,
    "water_stress"
  );

  if (waterStressAlert && !existingWaterStressSeverity) {
    const waterSeverityRaw =
      summary?.waterStressSeverity && typeof summary.waterStressSeverity === "object"
        ? summary.waterStressSeverity
        : waterStressOutput?.severity && typeof waterStressOutput.severity === "object"
        ? waterStressOutput.severity
        : waterStressOutput && typeof waterStressOutput === "object"
        ? waterStressOutput
        : {};

    const waterMax = toNumberOrNull(
      waterSeverityRaw?.maxSeverityPercent ??
        waterSeverityRaw?.severityPercent ??
        waterSeverityRaw?.stressPercent ??
        waterSeverityRaw?.confidencePercent ??
        waterSeverityRaw?.scorePercent
    );

    const waterAvg = toNumberOrNull(
      waterSeverityRaw?.avgSeverityPercent ??
        waterSeverityRaw?.averageSeverityPercent ??
        waterSeverityRaw?.meanSeverityPercent
    );

    diseaseSeverity.water_stress = {
      affectedLeaves: toNumber(
        waterSeverityRaw?.affectedLeaves ??
          waterSeverityRaw?.leafCount ??
          waterSeverityRaw?.leavesAffected,
        0
      ),
      severityLevel: String(
        waterSeverityRaw?.severityLevel ??
          waterSeverityRaw?.severity_level ??
          waterSeverityRaw?.level ??
          waterSeverityRaw?.riskLevel ??
          waterSeverityRaw?.status ??
          "ALERT"
      ).toUpperCase(),
      maxSeverityPercent: waterMax ?? 0,
      avgSeverityPercent: waterAvg ?? waterMax ?? 0,
    };
  }

  const legend = normalizeLegend(diseaseOutput?.legend ?? summary?.legend ?? data?.legend ?? []);

  const actionLabel = String(summary?.actionLabel ?? data?.actionLabel ?? getActionLabel(captureDecision));

  const explicitSprayRecommended =
    data?.lastSprayRecommended ?? data?.sprayRecommended ?? summary?.sprayRecommended ?? null;

  const sprayRecommended = Boolean(
    explicitSprayRecommended ??
      (pump1Ms > 0 ||
        pump2Ms > 0 ||
        ["PUMP1", "PUMP2", "PUMP1_PUMP2", "SPRAY"].includes(captureDecision))
  );

  const affected = diseases.length > 0 || sprayRecommended || waterStressAlert;

  return {
    id,
    captureId: String(data?.captureId ?? id ?? ""),
    imageUrl: String(data?.imageUrl ?? data?.originalUrl ?? ""),
    annotatedUrl: String(data?.annotatedUrl ?? data?.imageUrl ?? data?.originalUrl ?? ""),
    createdAtMs,
    updatedAtMs,
    scanned,
    counts,
    diseases,
    status,
    affected,
    diseaseSeverity,
    perLeaf,
    legend,
    captureDecision,
    actionLabel,
    pump1Ms,
    pump2Ms,
    waterStressAlert,
    sprayRecommended,
    raw: data,
  };
}

export function extractPlantFallbackMetrics(plant: PlantDoc): PlantDiseaseMetrics {
  const scannedAtMs = tsToMs(plant.lastScanAt);
  const waterStressAlert = Boolean(plant.lastWaterStressAlert);
  const diseases = normalizeDiseaseList(plant.lastDiseases ?? [], waterStressAlert);
  const scanned = Boolean(scannedAtMs || plant.lastCaptureId || plant.lastCounts);
  const status = classifyFromDiseases(diseases, scanned);
  const pump1Ms = toNumber(plant.lastPump1DurationMs, 0);
  const pump2Ms = toNumber(plant.lastPump2DurationMs, 0);
  const captureDecision = String(plant.lastCaptureDecision || "NO_SPRAY").toUpperCase();
  const diseaseSeverity: Record<string, DiseaseSeverityStat> = {
    ...(plant.lastDiseaseSeverity ?? {}),
  };

  if (waterStressAlert && !getSeverityForDisease(diseaseSeverity, "water_stress")) {
    diseaseSeverity.water_stress = {
      affectedLeaves: 0,
      severityLevel: "ALERT",
      maxSeverityPercent: 0,
      avgSeverityPercent: 0,
    };
  }

  return {
    plantId: plant.id,
    plantTitle: toPlantTitle(plant),
    row: plant.row ?? parseIdToRowCol(plant.id).row,
    column: plant.column ?? parseIdToRowCol(plant.id).column,
    rfidA: plant.rfidA,
    rfidB: plant.rfidB,
    scanCount: plant.lastCaptureId ? 1 : 0,
    id: plant.lastCaptureId ?? undefined,
    captureId: plant.lastCaptureId ?? null,
    imageUrl: plant.lastAnnotatedUrl ?? "",
    annotatedUrl: plant.lastAnnotatedUrl ?? "",
    createdAtMs: scannedAtMs,
    updatedAtMs: scannedAtMs,
    scanned,
    counts: {
      leaf: toNumber(plant.lastCounts?.leaf, 0),
      flower: toNumber(plant.lastCounts?.flower, 0),
      cucumber: toNumber(plant.lastCounts?.cucumber, 0),
    },
    diseases,
    status,
    affected: diseases.length > 0 || Boolean(plant.lastSprayRecommended) || waterStressAlert,
    diseaseSeverity,
    perLeaf: [],
    legend: [],
    captureDecision,
    actionLabel: String(plant.lastActionLabel || getActionLabel(captureDecision)),
    pump1Ms,
    pump2Ms,
    waterStressAlert,
    sprayRecommended: Boolean(
      plant.lastSprayRecommended ||
        pump1Ms > 0 ||
        pump2Ms > 0 ||
        ["PUMP1", "PUMP2", "PUMP1_PUMP2", "SPRAY"].includes(captureDecision)
    ),
    raw: plant,
  };
}

export function buildPlantDiseaseMetrics(plant: PlantDoc, captureDocs: any[]): PlantDiseaseMetrics {
  let latest: CaptureMetrics | null = null;
  let latestTime = -1;
  let validScanCount = 0;

  captureDocs.forEach((docSnap: any) => {
    const data = docSnap.data() || {};
    const status = String(data.status ?? "").toUpperCase();

    if (status && status !== "DONE") return;

    const metrics = extractCaptureMetrics(data, docSnap.id);
    validScanCount += 1;

    const time = metrics.updatedAtMs || metrics.createdAtMs || 0;
    if (!latest || time >= latestTime) {
      latest = metrics;
      latestTime = time;
    }
  });

  if (!latest) return extractPlantFallbackMetrics(plant);

  const latestMetrics = latest as CaptureMetrics;

  return {
    ...latestMetrics,
    plantId: plant.id,
    plantTitle: toPlantTitle(plant),
    row: plant.row ?? parseIdToRowCol(plant.id).row,
    column: plant.column ?? parseIdToRowCol(plant.id).column,
    rfidA: plant.rfidA,
    rfidB: plant.rfidB,
    scanCount: validScanCount,
  };
}

export function matchesFilter(metrics: CaptureMetrics, filterMode?: "LEAF" | "CUCUMBER" | "ALL") {
  const mode = filterMode ?? "LEAF";
  if (mode === "ALL") return true;
  if (mode === "CUCUMBER") return metrics.counts.cucumber > 0;

  return (
    metrics.counts.leaf > 0 ||
    metrics.diseases.length > 0 ||
    metrics.waterStressAlert ||
    Object.keys(metrics.diseaseSeverity ?? {}).length > 0
  );
}

export function getHealthScore(totalPlants: number, affectedPlants: number) {
  if (totalPlants <= 0) return 0;
  return Math.max(0, Math.round(((totalPlants - affectedPlants) / totalPlants) * 100));
}

export function statusText(status: DiseaseStatus) {
  if (status === "Healthy") return "Healthy";
  if (status === "Infected") return "Disease detected";
  if (status === "WaterStress") return "Water stress";
  if (status === "Multiple") return "Multiple issues";
  return "Not scanned";
}
