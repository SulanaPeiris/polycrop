import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnel } from "../../context/TunnelContext";

const { width } = Dimensions.get("window");

type PlantDoc = {
  id: string;
  plantUid?: string;
  plantName?: string;
  row: number;
  column: number;

  lastScanAt?: any; // Firestore timestamp
  lastDiseases?: string[];
  lastCounts?: { cucumber?: number; leaf?: number; flower?: number } | null;
  lastSprayRecommended?: boolean;
  lastCaptureId?: string | null;

  // New fields written by inference-api/main.py
  lastCaptureDecision?: string | null;
  lastPump1DurationMs?: number | null;
  lastPump2DurationMs?: number | null;
  lastWaterStressAlert?: boolean;
  lastDiseaseSeverity?: Record<string, any> | null;
  lastActionLabel?: string | null;
};

type PlantStatus = "Healthy" | "Infected" | "WaterStress" | "Multiple" | "NotScanned";

type PlantVM = PlantDoc & {
  status: PlantStatus;
  scanned: boolean;
  scannedAtMs: number;
  sprayedRecommended: boolean; // we show as "Robot Activity"
  leafCount: number;
  diseases: string[]; // normalized list

  captureDecision: string;
  pump1Ms: number;
  pump2Ms: number;
  waterStressAlert: boolean;
  diseaseSeverity: Record<string, any>;
  actionLabel: string;
};

function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return 0;
}

function timeAgo(ms: number) {
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

function niceDiseaseName(x: string) {
  return x.replaceAll("_", " ");
}

function getSeverityStat(diseaseSeverity: Record<string, any> | null | undefined, disease: string) {
  if (!diseaseSeverity) return null;

  const key = disease.toLowerCase();
  return diseaseSeverity[key] || diseaseSeverity[key.replaceAll(" ", "_")] || null;
}

function severityText(diseaseSeverity: Record<string, any> | null | undefined, disease: string) {
  const stat = getSeverityStat(diseaseSeverity, disease);
  if (!stat) return "Severity: N/A";

  const level = stat.severityLevel || "N/A";
  const max = Number(stat.maxSeverityPercent ?? 0).toFixed(2);
  const avg = Number(stat.avgSeverityPercent ?? 0).toFixed(2);

  return `Severity: ${level} • Max ${max}% • Avg ${avg}%`;
}

function pumpTextForDisease(disease: string, pump1Ms: number, pump2Ms: number) {
  const d = disease.toLowerCase();

  if (d === "downy_mildew") {
    return pump1Ms > 0 ? `Pump 1 • ${pump1Ms}ms` : "Pump 1 not triggered";
  }

  if (d === "powdery_mildew") {
    return pump2Ms > 0 ? `Pump 2 • ${pump2Ms}ms` : "Pump 2 not triggered";
  }

  if (d === "water_stress") {
    return "User alert only";
  }

  return "Action pending";
}

function classifyFromDiseases(lastDiseases?: string[], scanned?: boolean): PlantStatus {
  if (!scanned) return "NotScanned";

  const dis = (lastDiseases ?? []).map((x) => x.toLowerCase());
  const hasDowny = dis.includes("downy_mildew");
  const hasPowdery = dis.includes("powdery_mildew");
  const hasStress = dis.includes("water_stress");

  const count = [hasDowny, hasPowdery, hasStress].filter(Boolean).length;
  if (count === 0) return "Healthy";
  if (count >= 2) return "Multiple";
  if (hasStress) return "WaterStress";
  return "Infected";
}

function getPlantColor(status: PlantStatus, scanned: boolean) {
  if (!scanned || status === "NotScanned") return "#F5F5F5";
  if (status === "Healthy") return "#C8E6C9";
  if (status === "WaterStress") return "#FFF3E0";
  if (status === "Infected") return "#FFEBEE";
  if (status === "Multiple") return "#E1BEE7";
  return "#eee";
}

function getDotColor(status: PlantStatus, scanned: boolean) {
  if (!scanned || status === "NotScanned") return "#9E9E9E";
  if (status === "Healthy") return "#2E7D32";
  if (status === "WaterStress") return "#EF6C00";
  if (status === "Infected") return "#D32F2F";
  if (status === "Multiple") return "#8E24AA";
  return "#999";
}

export default function DetectionFeedScreen({ navigation }: any) {
  useTunnelHeader("Detection Feed");

  const { selectedTunnel } = useTunnel();
  const tunnelId = selectedTunnel?.id ?? "";
  const rows = selectedTunnel?.rows ?? 0;
  const cols = selectedTunnel?.columns ?? 0;

  const [plants, setPlants] = useState<PlantDoc[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlantVM | null>(null);

  // Load plants from Firestore
  useEffect(() => {
    if (!tunnelId) {
      setPlants([]);
      return;
    }

    const ref = collection(db, "tunnels", tunnelId, "plants");
    return onSnapshot(ref, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PlantDoc[];
      setPlants(list);
    });
  }, [tunnelId]);

  const plantsByCoord = useMemo(() => {
    const map: Record<string, PlantVM> = {};

    for (const p of plants) {
      const scannedAtMs = tsToMs(p.lastScanAt);
      const scanned = scannedAtMs > 0;

      const diseases = (p.lastDiseases ?? []).map((x) => x.toLowerCase());
      const status = classifyFromDiseases(diseases, scanned);

      const leafCount = Number(p.lastCounts?.leaf ?? 0);
      const sprayedRecommended = !!p.lastSprayRecommended;

      const captureDecision = String(p.lastCaptureDecision || "NO_SPRAY");
      const pump1Ms = Number(p.lastPump1DurationMs ?? 0);
      const pump2Ms = Number(p.lastPump2DurationMs ?? 0);
      const waterStressAlert = !!p.lastWaterStressAlert;
      const diseaseSeverity = p.lastDiseaseSeverity ?? {};
      const actionLabel = String(p.lastActionLabel || "No action needed.");

      const vm: PlantVM = {
        ...p,
        diseases,
        status,
        scanned,
        scannedAtMs,
        leafCount,
        sprayedRecommended,
        captureDecision,
        pump1Ms,
        pump2Ms,
        waterStressAlert,
        diseaseSeverity,
        actionLabel,
      };

      map[`r${p.row}_c${p.column}`] = vm;
    }

    return map;
  }, [plants]);

  const selectedStatus = selectedPlant?.status ?? "NotScanned";
  const selectedScanned = !!selectedPlant?.scanned;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SectionTitle title="Tunnel Map" />
        <Text style={styles.legend}>
          {selectedTunnel ? "Tap a plant to view latest scan summary" : "Select a tunnel first (Home tab)"}
        </Text>

        <View style={styles.tunnelMap}>
          <View style={styles.gridContainer}>
            {Array.from({ length: rows }).map((_, rIndex) => (
              <View key={`row-${rIndex}`} style={styles.row}>
                {Array.from({ length: cols }).map((_, cIndex) => {
                  const plant = plantsByCoord[`r${rIndex + 1}_c${cIndex + 1}`];
                  const isSelected = selectedPlant?.id === plant?.id;

                  if (!plant) {
                    return (
                      <View
                        key={`empty-${rIndex}-${cIndex}`}
                        style={[styles.plantNode, { backgroundColor: "#F5F5F5" }]}
                      />
                    );
                  }

                  const status = plant.status;
                  const scanned = plant.scanned;

                  return (
                    <TouchableOpacity
                      key={plant.id}
                      style={[
                        styles.plantNode,
                        { backgroundColor: getPlantColor(status, scanned) },
                        isSelected && styles.selectedNode,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setSelectedPlant(plant)}
                    >
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: isSelected ? "#fff" : getDotColor(status, scanned) },
                        ]}
                      />

                      {/* Disease badge (how many disease types) */}
                      {(status === "Infected" || status === "Multiple") && scanned ? (
                        <View style={styles.leafBadge}>
                          <Text style={styles.leafText}>{(plant.diseases ?? []).length}</Text>
                        </View>
                      ) : null}

                      {/* Water stress icon */}
                      {(status === "WaterStress" || status === "Multiple") && scanned ? (
                        <Ionicons name="water" size={12} color="#EF6C00" style={styles.stressIcon} />
                      ) : null}

                      {/* Spray recommended badge */}
                      {plant.sprayedRecommended && scanned ? (
                        <View style={styles.sprayedBadge}>
                          <Ionicons name="shield-checkmark" size={10} color="#fff" />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.labelContainer}>
            <Text style={styles.labelText}>Entrance</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#2E7D32" }]} />
            <Text style={styles.legendText}>Healthy</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#D32F2F" }]} />
            <Text style={styles.legendText}>Infected</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#EF6C00" }]} />
            <Text style={styles.legendText}>Water Stress</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#8E24AA" }]} />
            <Text style={styles.legendText}>Multiple</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#9E9E9E" }]} />
            <Text style={styles.legendText}>Not scanned</Text>
          </View>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Bottom Sheet Summary (your old UI style) */}
      {selectedPlant && (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{selectedPlant.plantUid ?? selectedPlant.id}</Text>
            <TouchableOpacity onPress={() => setSelectedPlant(null)}>
              <Ionicons name="close-circle" size={28} color="#aaa" />
            </TouchableOpacity>
          </View>

          <View style={styles.sheetContent}>
            {/* Status badge */}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getPlantColor(selectedStatus, selectedScanned) },
              ]}
            >
              <Text style={[styles.statusText, { color: getDotColor(selectedStatus, selectedScanned) }]}>
                {selectedScanned ? selectedStatus : "Not scanned yet"}
              </Text>
            </View>

            <Text style={{ color: "#616161", fontWeight: "700", marginBottom: 14 }}>
              Last scan: {selectedScanned ? timeAgo(selectedPlant.scannedAtMs) : "N/A"}
            </Text>

            {/* Issues list */}
            {selectedScanned ? (
              <View style={styles.issuesList}>
                {/* Fungal diseases (downy/powdery) */}
                {selectedPlant.diseases
                  .filter((d) => d !== "water_stress")
                  .map((d) => (
                    <View key={d} style={styles.issueRow}>
                      <View style={[styles.issueIconBox, { backgroundColor: "#FFEBEE" }]}>
                        <Ionicons name="bug-outline" size={20} color="#D32F2F" />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.issueText}>{niceDiseaseName(d)}</Text>
                        <Text style={styles.issueMeta}>{severityText(selectedPlant.diseaseSeverity, d)}</Text>
                        <Text style={styles.issueMeta}>Action: {pumpTextForDisease(d, selectedPlant.pump1Ms, selectedPlant.pump2Ms)}</Text>
                      </View>

                      <View style={styles.leafCountBadge}>
                        <Text style={styles.leafCountText}>{selectedPlant.leafCount}</Text>
                        <Text style={styles.leafCountLabel}>leaves</Text>
                      </View>
                    </View>
                  ))}

                {/* Water stress */}
                {(selectedPlant.status === "WaterStress" || selectedPlant.status === "Multiple") && (
                  <View style={styles.issueRow}>
                    <View style={[styles.issueIconBox, { backgroundColor: "#FFF3E0" }]}>
                      <Ionicons name="water" size={20} color="#EF6C00" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.issueText}>Water Stress</Text>
                      <Text style={styles.issueMeta}>{severityText(selectedPlant.diseaseSeverity, "water_stress")}</Text>
                      <Text style={styles.issueMeta}>Action: User alert only, no pump</Text>
                    </View>
                  </View>
                )}

                {/* No issues */}
                {selectedPlant.diseases.length === 0 && (
                  <View style={styles.issueRow}>
                    <View style={[styles.issueIconBox, { backgroundColor: "#E8F5E9" }]}>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#2E7D32" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.issueText}>No disease detected</Text>
                      <Text style={styles.issueMeta}>Plant looks healthy</Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <Text style={{ color: "#757575", fontWeight: "700" }}>
                This plant has not been scanned yet.
              </Text>
            )}

            {/* Robot Action */}
            <View style={styles.robotActionCard}>
              <View style={styles.robotRow}>
                <Text style={styles.robotLabel}>Robot Activity</Text>
                {selectedPlant.sprayedRecommended ? (
                  <View style={styles.sprayedTag}>
                    <Ionicons name="alert-circle" size={16} color="#EF6C00" />
                    <Text style={[styles.sprayedText, { color: "#EF6C00" }]}>Spray Required</Text>
                  </View>
                ) : selectedPlant.waterStressAlert ? (
                  <View style={styles.warningTag}>
                    <Ionicons name="water" size={16} color="#EF6C00" />
                    <Text style={[styles.sprayedText, { color: "#EF6C00" }]}>Alert Only</Text>
                  </View>
                ) : (
                  <View style={styles.pendingTag}>
                    <Text style={styles.pendingText}>No action needed</Text>
                  </View>
                )}
              </View>

              <Text style={styles.actionLabel}>{selectedPlant.actionLabel}</Text>
              <Text style={styles.actionMeta}>
                Decision: {selectedPlant.captureDecision} • Pump 1: {selectedPlant.pump1Ms}ms • Pump 2: {selectedPlant.pump2Ms}ms
              </Text>
            </View>

            {/* View last scan */}
            <TouchableOpacity
              style={[styles.viewBtn, !selectedPlant.lastCaptureId && { opacity: 0.5 }]}
              disabled={!selectedPlant.lastCaptureId}
              onPress={() =>
  navigation.navigate("DetectionDetail", {
    tunnelId,
    plantId: selectedPlant.id,
    captureId: selectedPlant.lastCaptureId ? String(selectedPlant.lastCaptureId) : undefined,
    filterMode: "LEAF",
  })
}
            >
              <Ionicons name="image-outline" size={18} color="#fff" />
              <Text style={styles.viewBtnText}>View Last Scan</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  scrollContent: { padding: 16 },
  legend: { fontSize: 13, color: "#777", marginBottom: 16, textAlign: "center" },

  tunnelMap: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    alignItems: "center",
    marginBottom: 24,
  },
  gridContainer: { gap: 14 },
  row: { flexDirection: "row", gap: 18 },

  plantNode: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.03)",
  },
  selectedNode: {
    borderColor: "#2E7D32",
    borderWidth: 3,
    backgroundColor: "#2E7D32",
  },

  dot: { width: 10, height: 10, borderRadius: 5 },

  // Indicators
  leafBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#D32F2F",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 2,
  },
  leafText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  stressIcon: { position: "absolute", bottom: 0, right: 0 },

  sprayedBadge: {
    position: "absolute",
    bottom: -4,
    left: -4,
    backgroundColor: "#2E7D32",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 2,
  },

  labelContainer: {
    marginTop: 24,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
  },
  labelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9E9E9E",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  legendContainer: {
    flexDirection: "row",
    gap: 20,
    justifyContent: "center",
    flexWrap: "wrap",
    paddingHorizontal: 20,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendText: { fontSize: 12, color: "#616161", fontWeight: "500" },

  // Bottom Sheet
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 24, fontWeight: "800", color: "#212121" },
  sheetContent: {},

  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusText: { fontWeight: "700", fontSize: 14 },

  issuesList: { gap: 16, marginBottom: 18 },

  issueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  issueIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFEBEE",
    alignItems: "center",
    justifyContent: "center",
  },
  issueText: { fontSize: 16, fontWeight: "700", color: "#212121" },
  issueMeta: { fontSize: 12, color: "#757575", marginTop: 2 },

  leafCountBadge: {
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  leafCountText: { fontSize: 18, fontWeight: "800", color: "#D32F2F" },
  leafCountLabel: { fontSize: 10, color: "#999", fontWeight: "600" },

  robotActionCard: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
  },

  robotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  robotLabel: { fontSize: 14, color: "#616161", fontWeight: "600" },
  sprayedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sprayedText: { color: "#2E7D32", fontWeight: "700", fontSize: 13 },

  warningTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },

  actionLabel: {
    marginTop: 10,
    fontSize: 13,
    color: "#424242",
    fontWeight: "700",
    lineHeight: 19,
  },
  actionMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#757575",
    fontWeight: "700",
  },

  pendingTag: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pendingText: { color: "#9E9E9E", fontWeight: "600", fontSize: 13 },

  viewBtn: {
    marginTop: 14,
    backgroundColor: "#2E7D32",
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  viewBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});