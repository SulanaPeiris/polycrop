import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";

type PlantDoc = {
  id: string;
  row?: number;
  column?: number;
  plantUid?: string;
  plantName?: string;
  rfidA?: string | null;
  rfidB?: string | null;

  lastCaptureId?: string | null;
  lastAnnotatedUrl?: string | null;
  lastScanAt?: any;

  lastCounts?: {
    cucumber?: number;
    leaf?: number;
    flower?: number;
  };

  lastDistanceCm?: number | null;
  lastCucumberLengthCm?: number | null;
  lastCucumberDiameterCm?: number | null;

  lastRipe?: boolean | null;
  lastRipeCucumberCount?: number | null;
  lastRipeCucumbers?: any[];
  lastAllCucumbers?: any[];
  lastCucumberMeasurements?: any[];
};

type CucumberMeasurement = {
  index: number;
  label: string;
  lengthCm: number | null;
  diameterCm: number | null;
  lengthPx: number | null;
  diameterPx: number | null;
  confidence: number | null;
  ripe: boolean | null;
};

type DisplayMetrics = {
  cucumberCount: number;
  ripeCucumberCount: number;
  distanceCm: number | null;
  lengthCm: number | null;
  diameterCm: number | null;
  ripe: boolean;
  cucumbers: CucumberMeasurement[];
  scanCount?: number;
};

function parseIdToRowCol(id: string): { row?: number; column?: number } {
  const m = /^r(\d+)_c(\d+)$/i.exec(id || "");
  if (!m) return {};
  return { row: Number(m[1]), column: Number(m[2]) };
}

function isPlantRFIDAssigned(plant: PlantDoc) {
  return Boolean((plant.rfidA || "").trim() || (plant.rfidB || "").trim());
}

function toNumberOrNull(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundOrNull(value: any, decimals = 1): number | null {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  return Number(n.toFixed(decimals));
}

function formatCm(value: number | null, decimals = 1) {
  if (value === null || value <= 0) return "N/A";
  return `${value.toFixed(decimals)} cm`;
}

function formatPx(value: number | null) {
  if (value === null || value <= 0) return "N/A";
  return `${Math.round(value)} px`;
}

function normalizeCucumberArray(sourceRaw: any[]): CucumberMeasurement[] {
  const source = Array.isArray(sourceRaw) ? sourceRaw : [];

  return source
    .map((cucumber: any, idx: number): CucumberMeasurement => {
      const index = toNumberOrNull(cucumber?.index);
      const cm =
        cucumber?.cm && typeof cucumber.cm === "object" ? cucumber.cm : {};
      const pixel =
        cucumber?.pixel && typeof cucumber.pixel === "object"
          ? cucumber.pixel
          : {};

      return {
        index: index !== null ? index : idx,
        label: `Cucumber ${(index !== null ? index : idx) + 1}`,
        lengthCm: roundOrNull(cm?.lengthCm, 2),
        diameterCm: roundOrNull(cm?.diameterCm, 2),
        lengthPx: roundOrNull(pixel?.lengthPx, 0),
        diameterPx: roundOrNull(pixel?.diameterPx, 0),
        confidence: roundOrNull(cucumber?.conf, 2),
        ripe: typeof cucumber?.ripe === "boolean" ? cucumber.ripe : null,
      };
    })
    .sort((a, b) => a.index - b.index);
}

function normalizeCucumberMeasurements(plant: PlantDoc): CucumberMeasurement[] {
  const source = Array.isArray(plant.lastAllCucumbers)
    ? plant.lastAllCucumbers
    : Array.isArray(plant.lastCucumberMeasurements)
    ? plant.lastCucumberMeasurements
    : Array.isArray(plant.lastRipeCucumbers)
    ? plant.lastRipeCucumbers
    : [];

  const measurements = normalizeCucumberArray(source);

  if (
    measurements.length === 0 &&
    (plant.lastCucumberLengthCm || plant.lastCucumberDiameterCm)
  ) {
    measurements.push({
      index: 0,
      label: "Cucumber 1",
      lengthCm: roundOrNull(plant.lastCucumberLengthCm, 2),
      diameterCm: roundOrNull(plant.lastCucumberDiameterCm, 2),
      lengthPx: null,
      diameterPx: null,
      confidence: null,
      ripe: typeof plant.lastRipe === "boolean" ? plant.lastRipe : null,
    });
  }

  return measurements;
}

function timestampToMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getCaptureSummary(data: any) {
  return data?.outputs?.summary && typeof data.outputs.summary === "object"
    ? data.outputs.summary
    : {};
}

function getCaptureCucumbers(data: any): CucumberMeasurement[] {
  const summary = getCaptureSummary(data);
  const ripeness =
    data?.outputs?.ripeness && typeof data.outputs.ripeness === "object"
      ? data.outputs.ripeness
      : {};

  const source = Array.isArray(summary.allCucumbers)
    ? summary.allCucumbers
    : Array.isArray(ripeness.cucumbers)
    ? ripeness.cucumbers
    : Array.isArray(data?.allCucumbers)
    ? data.allCucumbers
    : Array.isArray(summary.ripeCucumbers)
    ? summary.ripeCucumbers
    : Array.isArray(data?.ripeCucumbers)
    ? data.ripeCucumbers
    : [];

  return normalizeCucumberArray(source);
}

function getCaptureOutputMetrics(data: any): DisplayMetrics {
  const summary = getCaptureSummary(data);
  const cucumbers = getCaptureCucumbers(data);

  const countFromSummary = toNumberOrNull(summary?.counts?.cucumber);
  const cucumberCount =
    countFromSummary !== null
      ? Math.max(0, countFromSummary)
      : Math.max(0, cucumbers.length);

  const ripeFromSummary = toNumberOrNull(
    summary?.ripeCucumberCount ?? data?.ripeCucumberCount
  );

  const ripeFromCucumbers = cucumbers.filter((c) => c.ripe === true).length;

  const ripeCucumberCount =
    ripeFromSummary !== null
      ? Math.max(0, ripeFromSummary)
      : Math.max(0, ripeFromCucumbers);

  return {
    cucumberCount,
    ripeCucumberCount,
    distanceCm: roundOrNull(summary?.distanceCm ?? data?.distanceCm, 1),
    lengthCm: roundOrNull(
      summary?.cucumberLengthCm ?? data?.cucumberLengthCm,
      2
    ),
    diameterCm: roundOrNull(
      summary?.cucumberDiameterCm ?? data?.cucumberDiameterCm,
      2
    ),
    ripe:
      ripeCucumberCount > 0 ||
      summary?.ripe === true ||
      data?.ripe === true,
    cucumbers,
  };
}

function buildPlantMetricsFromCaptureDocs(docs: any[]): DisplayMetrics {
  let totalCucumberCount = 0;
  let totalRipeCucumberCount = 0;
  let scanCount = 0;

  let latestMillis = -1;
  let latestDistanceCm: number | null = null;
  let latestLengthCm: number | null = null;
  let latestDiameterCm: number | null = null;
  let latestCucumbers: CucumberMeasurement[] = [];

  docs.forEach((docSnap: any) => {
    const data: any = docSnap.data() || {};
    const status = String(data.status ?? "").toUpperCase();

    if (status && status !== "DONE") return;

    const metrics = getCaptureOutputMetrics(data);

    scanCount += 1;
    totalCucumberCount += metrics.cucumberCount;
    totalRipeCucumberCount += metrics.ripeCucumberCount;

    const millis = timestampToMillis(
      data.updatedAt ??
        data.createdAt ??
        data.processedAt ??
        data.outputs?.meta?.createdAt
    );

    if (millis >= latestMillis) {
      latestMillis = millis;
      latestDistanceCm = metrics.distanceCm;
      latestLengthCm = metrics.lengthCm;
      latestDiameterCm = metrics.diameterCm;
      latestCucumbers = metrics.cucumbers;
    }
  });

  return {
    cucumberCount: totalCucumberCount,
    ripeCucumberCount: totalRipeCucumberCount,
    distanceCm: latestDistanceCm,
    lengthCm: latestLengthCm,
    diameterCm: latestDiameterCm,
    ripe: totalRipeCucumberCount > 0,
    cucumbers: latestCucumbers,
    scanCount,
  };
}

function getBackendMetrics(
  plant: PlantDoc,
  fallbackCucumberCount: number
): DisplayMetrics {
  const cucumbers = normalizeCucumberMeasurements(plant);

  const countFromPlant = toNumberOrNull(plant?.lastCounts?.cucumber);
  const cucumberCount =
    countFromPlant !== null
      ? Math.max(0, countFromPlant)
      : cucumbers.length > 0
      ? cucumbers.length
      : Math.max(0, Number(fallbackCucumberCount ?? 0));

  const ripeFromMeasurements = cucumbers.filter((c) => c.ripe === true).length;
  const ripeCountFromPlant = toNumberOrNull(plant?.lastRipeCucumberCount);

  const ripeCucumberCount =
    ripeCountFromPlant !== null
      ? Math.max(0, ripeCountFromPlant)
      : ripeFromMeasurements > 0
      ? ripeFromMeasurements
      : plant?.lastRipe === true
      ? 1
      : 0;

  const ripe = plant?.lastRipe === true || ripeCucumberCount > 0;

  return {
    cucumberCount,
    ripeCucumberCount,
    distanceCm: roundOrNull(plant?.lastDistanceCm, 1),
    lengthCm: roundOrNull(plant?.lastCucumberLengthCm, 2),
    diameterCm: roundOrNull(plant?.lastCucumberDiameterCm, 2),
    ripe,
    cucumbers,
    scanCount: plant.lastCaptureId ? 1 : 0,
  };
}

function toPlantTitle(plant: PlantDoc) {
  return plant.plantUid ?? plant.plantName ?? plant.id.toUpperCase();
}

function toShortPlantLabel(plant: PlantDoc) {
  const row = plant.row ?? parseIdToRowCol(plant.id).row;
  const column = plant.column ?? parseIdToRowCol(plant.id).column;

  if (row && column) return `R${row}C${column}`;
  return (plant.plantUid ?? plant.id).replace("P-", "");
}

export default function HarvestReadyScreen({ navigation }: any) {
  useTunnelHeader("Harvest Ready");

  const { selectedTunnel } = useTunnel();

  const tunnelId = selectedTunnel?.id ?? "";
  const rows = selectedTunnel?.rows ?? 0;
  const cols = selectedTunnel?.columns ?? 0;

  const [plants, setPlants] = useState<PlantDoc[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlantDoc | null>(null);
  const [captureMetricsByPlant, setCaptureMetricsByPlant] = useState<
    Record<string, DisplayMetrics>
  >({});

  useEffect(() => {
    if (!tunnelId) {
      setPlants([]);
      return;
    }

    const ref = collection(db, "tunnels", tunnelId, "plants");

    return onSnapshot(ref, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as PlantDoc[];

      setPlants(list);
    });
  }, [tunnelId]);

  const assignedPlants = useMemo(
    () => plants.filter(isPlantRFIDAssigned),
    [plants]
  );

  useEffect(() => {
    if (!tunnelId || assignedPlants.length === 0) {
      setCaptureMetricsByPlant({});
      return;
    }

    const unsubscribers = assignedPlants.map((plant) => {
      const ref = collection(
        db,
        "tunnels",
        tunnelId,
        "plants",
        plant.id,
        "captures"
      );

      return onSnapshot(ref, (snap) => {
        const metrics = buildPlantMetricsFromCaptureDocs(snap.docs);

        setCaptureMetricsByPlant((prev) => ({
          ...prev,
          [plant.id]: metrics,
        }));
      });
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [assignedPlants, tunnelId]);

  useEffect(() => {
    if (
      selectedPlant &&
      !assignedPlants.some((p) => p.id === selectedPlant.id)
    ) {
      setSelectedPlant(null);
    }
  }, [assignedPlants, selectedPlant]);

  const plantsByCoord = useMemo(() => {
    const map: Record<string, PlantDoc> = {};

    for (const p of assignedPlants) {
      const rr = p.row ?? parseIdToRowCol(p.id).row;
      const cc = p.column ?? parseIdToRowCol(p.id).column;

      if (rr && cc) {
        map[`r${rr}_c${cc}`] = { ...p, row: rr, column: cc };
      }
    }

    return map;
  }, [assignedPlants]);

  const displayMetricsByPlant = useMemo(() => {
    const map: Record<string, DisplayMetrics> = {};

    for (const plant of assignedPlants) {
      const captureMetrics = captureMetricsByPlant[plant.id];

      if (captureMetrics && (captureMetrics.scanCount ?? 0) > 0) {
        map[plant.id] = captureMetrics;
        continue;
      }

      map[plant.id] = getBackendMetrics(plant, 0);
    }

    return map;
  }, [assignedPlants, captureMetricsByPlant]);

  const harvestReadyPlants = useMemo(
    () => assignedPlants.filter((p) => displayMetricsByPlant[p.id]?.ripe),
    [assignedPlants, displayMetricsByPlant]
  );

  const totalRipePlants = harvestReadyPlants.length;

  const totalHarvestReadyCucumbers = harvestReadyPlants.reduce(
    (sum, plant) =>
      sum + (displayMetricsByPlant[plant.id]?.ripeCucumberCount ?? 0),
    0
  );

  const totalAssignedPlants = assignedPlants.length;

  const totalAssignedCucumbers = assignedPlants.reduce(
    (sum, plant) => sum + (displayMetricsByPlant[plant.id]?.cucumberCount ?? 0),
    0
  );

  const selectedMetrics = selectedPlant
    ? displayMetricsByPlant[selectedPlant.id]
    : null;

  const selectedCucumbers = selectedMetrics?.cucumbers ?? [];

  const selectedRFID = selectedPlant
    ? [selectedPlant.rfidA, selectedPlant.rfidB].filter(Boolean).join(" / ")
    : "";

  const tunnelName =
    selectedTunnel?.tunnelName ?? selectedTunnel?.name ?? "Select a tunnel";

  const getPlantCardStyle = (plant: PlantDoc) => {
    const metrics = displayMetricsByPlant[plant.id];

    if (metrics?.ripe) {
      return { bg: "#FFF3E0", border: "#FFCC80", dot: "#EF6C00" };
    }

    return { bg: "#E8F5E9", border: "#A5D6A7", dot: "#2E7D32" };
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconBox}>
            <Ionicons name="basket" size={28} color="#fff" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Harvest Ready</Text>
            <Text style={styles.summaryValue}>{totalRipePlants} Plants</Text>
            <Text style={styles.summarySub}>
              {totalHarvestReadyCucumbers} ripe cucumbers • {tunnelName}
            </Text>
          </View>
        </View>

        <Text style={styles.legend}>
          RFID assigned: {totalAssignedPlants} Plants • {totalAssignedCucumbers}{" "}
          Detected Cucumbers
        </Text>

        <Text style={styles.helper}>
          Only RFID-assigned plants are shown on the live tunnel layout.
        </Text>

        <Text style={styles.helper}>
          Ripe status comes from backend detection: length 15–16 cm and diameter
          2.5–3.0 cm.
        </Text>

        <SectionTitle title="Live Tunnel Layout" />

        {!tunnelId ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Select a tunnel first.</Text>
          </View>
        ) : rows <= 0 || cols <= 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              This tunnel has no layout. Set rows and columns in tunnel setup.
            </Text>
          </View>
        ) : (
          <View style={styles.tunnelMapCard}>
            <View style={styles.mapHeader}>
              <View>
                <Text style={styles.mapTitle}>{tunnelName}</Text>
                <Text style={styles.mapSubTitle}>
                  {rows} rows × {cols} columns
                </Text>
              </View>

              <View style={styles.entrancePill}>
                <Ionicons name="walk-outline" size={15} color="#2E7D32" />
                <Text style={styles.entrancePillText}>Entrance</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.horizontalPad}>
                <View style={styles.columnHeaderRow}>
                  <View style={styles.axisCorner} />
                  {Array.from({ length: cols }).map((_, cIndex) => (
                    <View key={`c-${cIndex}`} style={styles.columnHeaderCell}>
                      <Text style={styles.axisText}>C{cIndex + 1}</Text>
                    </View>
                  ))}
                </View>

                {Array.from({ length: rows }).map((_, rIndex) => (
                  <View key={`r-${rIndex}`} style={styles.mapRowWrap}>
                    <View style={styles.rowHeaderCell}>
                      <Text style={styles.axisText}>R{rIndex + 1}</Text>
                    </View>

                    <View style={styles.mapRow}>
                      {Array.from({ length: cols }).map((_, cIndex) => {
                        const id = `r${rIndex + 1}_c${cIndex + 1}`;
                        const plant = plantsByCoord[id];

                        if (!plant) {
                          return (
                            <View
                              key={id}
                              style={[styles.mapCell, styles.emptyPlantSlot]}
                            >
                              <Text style={styles.emptyPlantText}>—</Text>
                            </View>
                          );
                        }

                        const metrics = displayMetricsByPlant[plant.id];
                        const cardStyle = getPlantCardStyle(plant);
                        const isSelected = selectedPlant?.id === plant.id;

                        return (
                          <TouchableOpacity
                            key={id}
                            activeOpacity={0.85}
                            onPress={() => setSelectedPlant(plant)}
                            style={[
                              styles.mapCell,
                              styles.plantCard,
                              {
                                backgroundColor: cardStyle.bg,
                                borderColor: isSelected
                                  ? "#2E7D32"
                                  : cardStyle.border,
                              },
                              isSelected && styles.selectedPlantCard,
                            ]}
                          >
                            <View style={styles.cardTopRow}>
                              <View
                                style={[
                                  styles.statusDot,
                                  { backgroundColor: cardStyle.dot },
                                ]}
                              />

                              <View style={styles.countBadge}>
                                <Text style={styles.countText}>
                                  {`${metrics?.ripeCucumberCount ?? 0}/${
                                    metrics?.cucumberCount ?? 0
                                  }`}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.plantCardLabel}>
                              {toShortPlantLabel(plant)}
                            </Text>

                            <Text
                              style={styles.plantCardRfid}
                              numberOfLines={1}
                            >
                              {[plant.rfidA, plant.rfidB]
                                .filter(Boolean)
                                .join(" / ")}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#EF6C00" }]}
                />
                <Text style={styles.legendText}>Harvest Ready</Text>
              </View>

              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#2E7D32" }]}
                />
                <Text style={styles.legendText}>Growing</Text>
              </View>

              <View style={styles.legendItem}>
                <View style={styles.legendBadgeMini}>
                  <Text style={styles.legendBadgeText}>1/3</Text>
                </View>
                <Text style={styles.legendText}>Ripe / total</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {selectedPlant && selectedMetrics && (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{toPlantTitle(selectedPlant)}</Text>

            <TouchableOpacity onPress={() => setSelectedPlant(null)}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailRow}>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: selectedMetrics.ripe
                    ? "#FFF3E0"
                    : "#E8F5E9",
                },
              ]}
            >
              <Ionicons
                name={selectedMetrics.ripe ? "basket" : "leaf-outline"}
                size={26}
                color={selectedMetrics.ripe ? "#EF6C00" : "#2E7D32"}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>
                {selectedMetrics.ripe ? "Ready for Harvest" : "Not Ready Yet"}
              </Text>

              <Text style={styles.detailSubtitle}>
                RFID: {selectedRFID || "Assigned"}
              </Text>

              <Text style={styles.detailSubtitle}>
                Detected cucumbers: {selectedMetrics.cucumberCount}
              </Text>

              <Text style={styles.detailSubtitle}>
                Ripe cucumbers: {selectedMetrics.ripeCucumberCount}
              </Text>

              <Text style={styles.detailSubtitle}>
                Scans used: {selectedMetrics.scanCount ?? 0}
              </Text>

              <Text style={styles.detailSubtitle}>
                Latest scan length: {formatCm(selectedMetrics.lengthCm, 2)} •
                Diameter: {formatCm(selectedMetrics.diameterCm, 2)}
              </Text>

              <Text style={styles.detailSubtitle}>
                Distance: {formatCm(selectedMetrics.distanceCm, 1)}
              </Text>
            </View>

            <View
              style={[
                styles.bigCountBadge,
                {
                  backgroundColor: selectedMetrics.ripe
                    ? "#EF6C00"
                    : "#2E7D32",
                },
              ]}
            >
              <Text style={styles.bigCountText}>
                {selectedMetrics.ripe ? "RIPE" : "UNRIPE"}
              </Text>
            </View>
          </View>

          <View style={styles.cucumberList}>
            <Text style={styles.cucumberListTitle}>
              Individual cucumber outputs
            </Text>

            {selectedCucumbers.length > 0 ? (
              <ScrollView style={styles.cucumberScroll} nestedScrollEnabled>
                {selectedCucumbers.map((cucumber) => {
                  const isRipe = cucumber.ripe === true;

                  return (
                    <View
                      key={`${selectedPlant.id}-${cucumber.index}`}
                      style={styles.cucumberCard}
                    >
                      <View style={styles.cucumberCardHeader}>
                        <Text style={styles.cucumberTitle}>
                          {cucumber.label}
                        </Text>

                        <View
                          style={[
                            styles.cucumberStatusPill,
                            {
                              backgroundColor: isRipe ? "#FFF3E0" : "#E8F5E9",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.cucumberStatusText,
                              { color: isRipe ? "#EF6C00" : "#2E7D32" },
                            ]}
                          >
                            {cucumber.ripe === null
                              ? "UNKNOWN"
                              : isRipe
                              ? "RIPE"
                              : "UNRIPE"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cucumberMetricGrid}>
                        <Text style={styles.cucumberMetric}>
                          Length: {formatCm(cucumber.lengthCm, 2)}
                        </Text>

                        <Text style={styles.cucumberMetric}>
                          Diameter: {formatCm(cucumber.diameterCm, 2)}
                        </Text>

                        <Text style={styles.cucumberMetric}>
                          Length Px: {formatPx(cucumber.lengthPx)}
                        </Text>

                        <Text style={styles.cucumberMetric}>
                          Diameter Px: {formatPx(cucumber.diameterPx)}
                        </Text>

                        <Text style={styles.cucumberMetric}>
                          Confidence:{" "}
                          {cucumber.confidence !== null
                            ? `${Math.round(cucumber.confidence * 100)}%`
                            : "N/A"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.noCucumberText}>
                No separate cucumber size measurements saved yet. Capture again
                after updating the backend.
              </Text>
            )}
          </View>

          {tunnelId ? (
            <TouchableOpacity
              style={styles.viewScansBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (!selectedPlant || !tunnelId) return;

                const plant = selectedPlant;

                setSelectedPlant(null);

                const params = {
                  tunnelId,
                  plantId: plant.id,
                  plantTitle: toPlantTitle(plant),
                  row: plant.row,
                  column: plant.column,
                  rfidA: plant.rfidA,
                  rfidB: plant.rfidB,
                };

                let rootNavigation = navigation;

                while (rootNavigation?.getParent?.()) {
                  rootNavigation = rootNavigation.getParent();
                }

                rootNavigation.navigate("CucumberScans", params);
              }}
            >
              <Ionicons name="images-outline" size={18} color="#fff" />
              <Text style={styles.viewScansText}>View Cucumber Scans</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const CELL_SIZE = 84;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  scrollContent: { padding: 16, paddingBottom: 150 },

  summaryCard: {
    backgroundColor: "#2E7D32",
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  summaryIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  summaryLabel: { color: "#D7F5DD", fontSize: 13, fontWeight: "600" },
  summaryValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 2,
  },
  summarySub: { color: "#EAF8ED", fontSize: 13, marginTop: 4 },

  legend: { color: "#7A7A7A", marginTop: -6, marginBottom: 12, fontSize: 13 },
  helper: { color: "#777", marginBottom: 8, fontSize: 13 },

  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  emptyText: {
    color: "#777",
    fontWeight: "700",
  },

  tunnelMapCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#ECECEC",
    overflow: "hidden",
  },
  mapHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapTitle: { fontSize: 17, fontWeight: "800", color: "#1E1E1E" },
  mapSubTitle: { fontSize: 12, color: "#777", marginTop: 3 },
  entrancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EDF7EE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  entrancePillText: { color: "#2E7D32", fontSize: 12, fontWeight: "700" },

  horizontalPad: { paddingHorizontal: 16, paddingBottom: 4 },
  columnHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  axisCorner: { width: 34 },
  columnHeaderCell: { width: CELL_SIZE, alignItems: "center" },
  rowHeaderCell: { width: 34, alignItems: "center", justifyContent: "center" },
  axisText: { fontSize: 12, fontWeight: "700", color: "#7A7A7A" },
  mapRowWrap: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  mapRow: { flexDirection: "row" },

  mapCell: { width: CELL_SIZE, height: 72, marginRight: 10, borderRadius: 18 },
  emptyPlantSlot: {
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPlantText: { color: "#C5C5C5", fontSize: 18, fontWeight: "600" },
  plantCard: { borderWidth: 1.5, padding: 8, justifyContent: "space-between" },
  selectedPlantCard: { borderWidth: 2, transform: [{ scale: 1.02 }] },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  countBadge: {
    minWidth: 34,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  countText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  plantCardLabel: { fontSize: 13, fontWeight: "800", color: "#222" },
  plantCardRfid: { fontSize: 10, color: "#666" },

  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 16,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendText: { color: "#666", fontSize: 13, fontWeight: "600" },
  legendBadgeMini: {
    minWidth: 30,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  legendBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  bottomSheet: {
    position: "absolute",
    maxHeight: "78%",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#222",
    flex: 1,
    marginRight: 10,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#222",
    marginBottom: 4,
  },
  detailSubtitle: { fontSize: 13, color: "#666", marginBottom: 3 },
  bigCountBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  bigCountText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  cucumberList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingTop: 12,
  },
  cucumberListTitle: {
    color: "#222",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  cucumberScroll: { maxHeight: 180 },
  cucumberCard: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#ECECEC",
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  cucumberCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cucumberTitle: { color: "#222", fontSize: 13, fontWeight: "800" },
  cucumberStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  cucumberStatusText: { fontSize: 11, fontWeight: "900" },
  cucumberMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cucumberMetric: {
    width: "47%",
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
  },
  noCucumberText: {
    color: "#777",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  viewScansBtn: {
    marginTop: 16,
    backgroundColor: "#2E7D32",
    borderRadius: 14,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  viewScansText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});