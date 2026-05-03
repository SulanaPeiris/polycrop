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
import {
  buildPlantDiseaseMetrics,
  diseaseBg,
  diseaseColor,
  getDotColor,
  getPlantColor,
  niceDiseaseName,
  parseIdToRowCol,
  PlantDiseaseMetrics,
  PlantDoc,
  pumpTextForDisease,
  statusText,
  timeAgo,
  toShortPlantLabel,
  toPlantTitle,
} from "../../services/diseaseScanUtils";

const CELL_SIZE = 54;

type PlantWithMetrics = PlantDoc & {
  metrics: PlantDiseaseMetrics;
};

function withRowColumn(plant: PlantDoc): PlantDoc {
  const parsed = parseIdToRowCol(plant.id);
  return {
    ...plant,
    row: plant.row ?? parsed.row,
    column: plant.column ?? parsed.column,
  };
}

function diseaseIcon(disease: string) {
  if (disease === "powdery_mildew") return "snow-outline";
  if (disease === "water_stress") return "water-outline";
  return "leaf-outline";
}

function issueList(metrics: PlantDiseaseMetrics) {
  const diseases = metrics.diseases.length ? metrics.diseases : [];

  if (!metrics.scanned) return [];

  if (diseases.length === 0) {
    return [
      {
        key: "healthy",
        title: "No disease detected",
        subtitle: "Latest scan did not detect downy mildew, powdery mildew, or water stress.",
        meta: "No robot action required",
        icon: "shield-checkmark-outline",
        color: "#2E7D32",
        bg: "#E8F5E9",
      },
    ];
  }

  return diseases.map((disease) => ({
    key: disease,
    title: niceDiseaseName(disease),
    subtitle:
      disease === "water_stress"
        ? "Water stress alert detected in the latest scan."
        : "Disease detected in the latest scan.",
    meta: pumpTextForDisease(disease, metrics.pump1Ms, metrics.pump2Ms),
    icon: diseaseIcon(disease),
    color: diseaseColor(disease),
    bg: diseaseBg(disease),
  }));
}

export default function DetectionFeedScreen({ navigation }: any) {
  useTunnelHeader("Detection Feed");

  const { selectedTunnel } = useTunnel();
  const tunnelId = selectedTunnel?.id ?? "";
  const rows = selectedTunnel?.rows ?? 0;
  const cols = selectedTunnel?.columns ?? 0;

  const [plants, setPlants] = useState<PlantDoc[]>([]);
  const [captureMetricsByPlant, setCaptureMetricsByPlant] = useState<
    Record<string, PlantDiseaseMetrics>
  >({});
  const [selectedPlant, setSelectedPlant] = useState<PlantWithMetrics | null>(null);

  useEffect(() => {
    if (!tunnelId) {
      setPlants([]);
      return;
    }

    const ref = collection(db, "tunnels", tunnelId, "plants");

    return onSnapshot(ref, (snap) => {
      const list = snap.docs.map((d) =>
        withRowColumn({ id: d.id, ...(d.data() as any) } as PlantDoc)
      );
      setPlants(list);
    });
  }, [tunnelId]);

  useEffect(() => {
    if (!tunnelId || plants.length === 0) {
      setCaptureMetricsByPlant({});
      return;
    }

    const unsubscribers = plants.map((plant) => {
      const ref = collection(db, "tunnels", tunnelId, "plants", plant.id, "captures");

      return onSnapshot(ref, (snap) => {
        const metrics = buildPlantDiseaseMetrics(plant, snap.docs);
        setCaptureMetricsByPlant((prev) => ({ ...prev, [plant.id]: metrics }));
      });
    });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [plants, tunnelId]);

  const plantsByCoord = useMemo(() => {
    const map: Record<string, PlantWithMetrics> = {};

    for (const plant of plants) {
      const row = plant.row ?? parseIdToRowCol(plant.id).row;
      const column = plant.column ?? parseIdToRowCol(plant.id).column;
      if (!row || !column) continue;

      const metrics = captureMetricsByPlant[plant.id] ?? buildPlantDiseaseMetrics(plant, []);

      map[`r${row}_c${column}`] = {
        ...plant,
        row,
        column,
        metrics,
      };
    }

    return map;
  }, [plants, captureMetricsByPlant]);

  useEffect(() => {
    if (!selectedPlant) return;
    const updated = Object.values(plantsByCoord).find((p) => p.id === selectedPlant.id);
    if (updated) setSelectedPlant(updated);
  }, [plantsByCoord, selectedPlant?.id]);

  const selectedMetrics = selectedPlant?.metrics ?? null;
  const selectedIssues = selectedMetrics ? issueList(selectedMetrics) : [];

  const scannedCount = Object.values(plantsByCoord).filter((p) => p.metrics.scanned).length;
  const affectedCount = Object.values(plantsByCoord).filter((p) => p.metrics.affected).length;

  function goToCaptureScans() {
    if (!selectedPlant || !tunnelId) return;

    const plant = selectedPlant;
    setSelectedPlant(null);

    const params = {
      tunnelId,
      plantId: plant.id,
      captureId: undefined,
      filterMode: "LEAF" as const,
    };

    let rootNavigation = navigation;
    while (rootNavigation?.getParent?.()) {
      rootNavigation = rootNavigation.getParent();
    }

    rootNavigation.navigate("DetectionDetail", params);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconBox}>
            <Ionicons name="analytics-outline" size={28} color="#fff" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Plant Detection Map</Text>
            <Text style={styles.headerSub}>
              {selectedTunnel
                ? `${scannedCount} scanned • ${affectedCount} affected • tap a plant for latest leaf outputs`
                : "Select a tunnel first from Home"}
            </Text>
          </View>
        </View>

        {rows <= 0 || cols <= 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="map-outline" size={28} color="#90A4AE" />
            <Text style={styles.emptyTitle}>No tunnel layout found</Text>
            <Text style={styles.emptyText}>Set rows and columns in tunnel setup first.</Text>
          </View>
        ) : (
          <View style={styles.tunnelMapCard}>
            <View style={styles.mapHeader}>
              <View>
                <Text style={styles.mapTitle}>
                  {selectedTunnel?.tunnelName ?? selectedTunnel?.name ?? "Tunnel"}
                </Text>
                <Text style={styles.mapSubTitle}>
                  {rows} rows × {cols} columns • leaf disease scan view
                </Text>
              </View>

              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
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
                            <View key={id} style={[styles.plantNode, styles.emptyNode]}>
                              <Text style={styles.emptyNodeText}>—</Text>
                            </View>
                          );
                        }

                        const metrics = plant.metrics;
                        const isSelected = selectedPlant?.id === plant.id;
                        const nodeColor = getPlantColor(metrics.status, metrics.scanned);
                        const dotColor = getDotColor(metrics.status, metrics.scanned);

                        return (
                          <TouchableOpacity
                            key={id}
                            activeOpacity={0.85}
                            onPress={() => setSelectedPlant(plant)}
                            style={[
                              styles.plantNode,
                              {
                                backgroundColor: nodeColor,
                                borderColor: isSelected ? "#2E7D32" : `${dotColor}55`,
                              },
                              isSelected && styles.selectedNode,
                            ]}
                          >
                            <View style={[styles.dot, { backgroundColor: dotColor }]} />

                            {metrics.scanned && metrics.diseases.length > 0 ? (
                              <View style={[styles.issueBadge, { backgroundColor: diseaseColor(metrics.diseases[0]) }]}>
                                <Text style={styles.issueBadgeText}>{metrics.diseases.length}</Text>
                              </View>
                            ) : null}

                            {metrics.waterStressAlert ? (
                              <Ionicons
                                name="water-outline"
                                size={16}
                                color="#EF6C00"
                                style={styles.stressIcon}
                              />
                            ) : null}

                            {metrics.sprayRecommended ? (
                              <View style={styles.sprayBadge}>
                                <Ionicons name="flame-outline" size={11} color="#fff" />
                              </View>
                            ) : null}

                            <Text style={styles.nodeLabel}>{toShortPlantLabel(plant)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.entrancePill}>
              <Ionicons name="walk-outline" size={15} color="#2E7D32" />
              <Text style={styles.entranceText}>Entrance</Text>
            </View>
          </View>
        )}

        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#2E7D32" }]} />
            <Text style={styles.legendText}>Healthy</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#D32F2F" }]} />
            <Text style={styles.legendText}>Disease</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF6C00" }]} />
            <Text style={styles.legendText}>Water stress</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#8E24AA" }]} />
            <Text style={styles.legendText}>Multiple</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#9E9E9E" }]} />
            <Text style={styles.legendText}>Not scanned</Text>
          </View>
        </View>
      </ScrollView>

      {selectedPlant && selectedMetrics ? (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{toPlantTitle(selectedPlant)}</Text>
              <Text style={styles.sheetSub}>
                {selectedPlant.row && selectedPlant.column
                  ? `Row ${selectedPlant.row} • Column ${selectedPlant.column}`
                  : selectedPlant.id}
              </Text>
            </View>

            <TouchableOpacity onPress={() => setSelectedPlant(null)}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: getPlantColor(selectedMetrics.status, selectedMetrics.scanned) },
              ]}
            >
              <View
                style={[
                  styles.statusPillDot,
                  { backgroundColor: getDotColor(selectedMetrics.status, selectedMetrics.scanned) },
                ]}
              />
              <Text
                style={[
                  styles.statusPillText,
                  { color: getDotColor(selectedMetrics.status, selectedMetrics.scanned) },
                ]}
              >
                {statusText(selectedMetrics.status)}
              </Text>
            </View>

            <Text style={styles.lastScanText}>
              Last scan: {selectedMetrics.scanned ? timeAgo(selectedMetrics.updatedAtMs || selectedMetrics.createdAtMs) : "N/A"}
            </Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{selectedMetrics.scanCount}</Text>
              <Text style={styles.metricLabel}>Capture Scans</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{selectedMetrics.diseases.length}</Text>
              <Text style={styles.metricLabel}>Issues Found</Text>
            </View>
          </View>

          <ScrollView style={styles.issueScroll} nestedScrollEnabled>
            {selectedIssues.length === 0 ? (
              <View style={styles.notScannedBox}>
                <Ionicons name="time-outline" size={24} color="#90A4AE" />
                <Text style={styles.notScannedTitle}>Not scanned yet</Text>
                <Text style={styles.notScannedText}>No leaf capture output was found for this plant.</Text>
              </View>
            ) : (
              selectedIssues.map((issue) => (
                <View key={issue.key} style={styles.issueRow}>
                  <View style={[styles.issueIconBox, { backgroundColor: issue.bg }]}>
                    <Ionicons name={issue.icon as any} size={22} color={issue.color} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.issueTitle}>{issue.title}</Text>
                    <Text style={styles.issueMeta}>{issue.subtitle}</Text>
                    <Text style={styles.issueAction}>{issue.meta}</Text>
                  </View>
                </View>
              ))
            )}

            <View style={styles.robotActionCard}>
              <View style={styles.robotHeader}>
                <Text style={styles.robotTitle}>Robot Activity</Text>
                {selectedMetrics.sprayRecommended ? (
                  <View style={styles.sprayTag}>
                    <Ionicons name="flame-outline" size={14} color="#2E7D32" />
                    <Text style={styles.sprayTagText}>Spray Required</Text>
                  </View>
                ) : selectedMetrics.waterStressAlert ? (
                  <View style={styles.alertTag}>
                    <Ionicons name="notifications-outline" size={14} color="#EF6C00" />
                    <Text style={styles.alertTagText}>Alert Only</Text>
                  </View>
                ) : (
                  <View style={styles.pendingTag}>
                    <Text style={styles.pendingText}>No action needed</Text>
                  </View>
                )}
              </View>

              <Text style={styles.actionLabel}>{selectedMetrics.actionLabel}</Text>
              <Text style={styles.actionMeta}>
                Decision: {selectedMetrics.captureDecision} • Pump 1: {selectedMetrics.pump1Ms}ms • Pump 2: {selectedMetrics.pump2Ms}ms
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.viewBtn} activeOpacity={0.9} onPress={goToCaptureScans}>
            <Ionicons name="images-outline" size={18} color="#fff" />
            <Text style={styles.viewBtnText}>See Capture Scans</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  scrollContent: { padding: 16, paddingBottom: 150 },
  headerCard: {
    backgroundColor: "#2E7D32",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  headerSub: { color: "#E8F5E9", fontSize: 12, marginTop: 4, lineHeight: 17 },
  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    alignItems: "center",
  },
  emptyTitle: { color: "#263238", fontSize: 16, fontWeight: "900", marginTop: 8 },
  emptyText: { color: "#78909C", fontSize: 12, marginTop: 4 },
  tunnelMapCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#ECECEC",
    overflow: "hidden",
    marginBottom: 20,
  },
  mapHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mapTitle: { fontSize: 17, fontWeight: "900", color: "#1E1E1E" },
  mapSubTitle: { fontSize: 12, color: "#777", marginTop: 3 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#2E7D32", marginRight: 6 },
  liveText: { color: "#2E7D32", fontWeight: "900", fontSize: 12 },
  horizontalPad: { paddingHorizontal: 16, paddingBottom: 10 },
  columnHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  axisCorner: { width: 34 },
  columnHeaderCell: { width: CELL_SIZE, alignItems: "center", marginRight: 10 },
  rowHeaderCell: { width: 34, alignItems: "center", justifyContent: "center" },
  axisText: { fontSize: 12, fontWeight: "800", color: "#7A7A7A" },
  mapRowWrap: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  mapRow: { flexDirection: "row" },
  plantNode: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 18,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  emptyNode: { backgroundColor: "#F5F5F5", borderColor: "#EEEEEE" },
  emptyNodeText: { color: "#C5C5C5", fontSize: 14, fontWeight: "800" },
  selectedNode: { borderWidth: 3, transform: [{ scale: 1.04 }] },
  dot: { width: 12, height: 12, borderRadius: 6 },
  nodeLabel: { position: "absolute", bottom: 4, fontSize: 9, color: "#455A64", fontWeight: "900" },
  issueBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  issueBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  stressIcon: { position: "absolute", bottom: 1, right: 3 },
  sprayBadge: {
    position: "absolute",
    bottom: -5,
    left: -5,
    backgroundColor: "#2E7D32",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  entrancePill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDF7EE",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  entranceText: { color: "#2E7D32", fontSize: 12, fontWeight: "800", marginLeft: 6 },
  legendContainer: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "center",
    flexWrap: "wrap",
    paddingHorizontal: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: "#616161", fontWeight: "700" },
  bottomSheet: {
    position: "absolute",
    maxHeight: "82%",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    padding: 22,
    paddingBottom: 34,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sheetTitle: { fontSize: 23, fontWeight: "900", color: "#212121" },
  sheetSub: { fontSize: 12, color: "#78909C", fontWeight: "700", marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  statusPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  statusPillDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  statusPillText: { fontSize: 12, fontWeight: "900" },
  lastScanText: { color: "#78909C", fontSize: 12, fontWeight: "700" },
  metricsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  metricBox: { flex: 1, backgroundColor: "#FAFAFA", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#EEEEEE" },
  metricValue: { fontSize: 20, fontWeight: "900", color: "#263238" },
  metricLabel: { color: "#78909C", fontSize: 11, fontWeight: "800", marginTop: 2 },
  issueScroll: { maxHeight: 310 },
  notScannedBox: { alignItems: "center", backgroundColor: "#FAFAFA", borderRadius: 18, padding: 16, marginBottom: 12 },
  notScannedTitle: { marginTop: 6, fontSize: 14, fontWeight: "900", color: "#263238" },
  notScannedText: { marginTop: 3, fontSize: 12, color: "#78909C" },
  issueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 10,
  },
  issueIconBox: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  issueTitle: { fontSize: 15, fontWeight: "900", color: "#212121" },
  issueMeta: { fontSize: 12, color: "#757575", marginTop: 2, lineHeight: 17 },
  issueAction: { fontSize: 12, color: "#424242", marginTop: 3, fontWeight: "800" },
  robotActionCard: { paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F5F5F5", marginTop: 2 },
  robotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  robotTitle: { fontSize: 14, color: "#616161", fontWeight: "900" },
  sprayTag: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E8F5E9", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  sprayTagText: { color: "#2E7D32", fontWeight: "900", fontSize: 12 },
  alertTag: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF3E0", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  alertTagText: { color: "#EF6C00", fontWeight: "900", fontSize: 12 },
  pendingTag: { backgroundColor: "#F5F5F5", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  pendingText: { color: "#9E9E9E", fontWeight: "800", fontSize: 12 },
  actionLabel: { marginTop: 10, fontSize: 13, color: "#424242", fontWeight: "800", lineHeight: 19 },
  actionMeta: { marginTop: 4, fontSize: 12, color: "#757575", fontWeight: "700" },
  viewBtn: { marginTop: 14, backgroundColor: "#2E7D32", paddingVertical: 14, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  viewBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});