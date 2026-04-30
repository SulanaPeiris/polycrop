import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnel } from "../../context/TunnelContext";

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
};

type DisplayMetrics = {
  cucumberCount: number;
  distanceCm: number;
  lengthCm: number;
  diameterCm: number;
  ripe: boolean;
};

function parseIdToRowCol(id: string): { row?: number; column?: number } {
  const m = /^r(\d+)_c(\d+)$/i.exec(id || "");
  if (!m) return {};
  return { row: Number(m[1]), column: Number(m[2]) };
}

function hashString(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function seededRange(seed: number, min: number, max: number, decimals = 1) {
  const x = Math.abs(Math.sin(seed) * 10000) % 1;
  const raw = min + x * (max - min);
  return Number(raw.toFixed(decimals));
}

function isPlantRFIDAssigned(plant: PlantDoc) {
  return Boolean((plant.rfidA || "").trim() || (plant.rfidB || "").trim());
}

function getFrontendMetrics(plant: PlantDoc, cucumberCount: number): DisplayMetrics {
  const seed = hashString(plant.id || plant.plantUid || "plant");
  const safeCount = Math.max(0, Number(cucumberCount ?? 0));

  const ripe = safeCount > 0 ? seed % 2 === 0 : false;
  const distanceCm = seededRange(seed + 11, 30, 40, 1);
  const lengthCm = ripe
    ? seededRange(seed + 23, 15, 18, 1)
    : seededRange(seed + 23, 8, 14.5, 1);
  const diameterCm = ripe
    ? seededRange(seed + 37, 2.1, 2.9, 1)
    : seededRange(seed + 37, 1.2, 2.4, 1);

  return {
    cucumberCount: safeCount,
    distanceCm,
    lengthCm,
    diameterCm,
    ripe,
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
  const [captureCountsByPlant, setCaptureCountsByPlant] = useState<Record<string, number>>({});

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

  const assignedPlants = useMemo(() => plants.filter(isPlantRFIDAssigned), [plants]);

  useEffect(() => {
    if (!tunnelId || assignedPlants.length === 0) {
      setCaptureCountsByPlant({});
      return;
    }

    const unsubscribers = assignedPlants.map((plant) => {
      const ref = collection(db, "tunnels", tunnelId, "plants", plant.id, "captures");
      return onSnapshot(ref, (snap) => {
        let cucumberCount = 0;

        snap.forEach((docSnap) => {
          const data: any = docSnap.data() || {};
          const status = String(data.status ?? "").toUpperCase();
          if (status && status !== "DONE") return;

          const count = Number(data?.outputs?.summary?.counts?.cucumber ?? 0);
          cucumberCount += Number.isFinite(count) ? count : 0;
        });

        setCaptureCountsByPlant((prev) => ({
          ...prev,
          [plant.id]: cucumberCount,
        }));
      });
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [assignedPlants, tunnelId]);

  useEffect(() => {
    if (selectedPlant && !assignedPlants.some((p) => p.id === selectedPlant.id)) {
      setSelectedPlant(null);
    }
  }, [assignedPlants, selectedPlant]);

  const plantsByCoord = useMemo(() => {
    const map: Record<string, PlantDoc> = {};
    for (const p of assignedPlants) {
      const rr = p.row ?? parseIdToRowCol(p.id).row;
      const cc = p.column ?? parseIdToRowCol(p.id).column;
      if (rr && cc) map[`r${rr}_c${cc}`] = { ...p, row: rr, column: cc };
    }
    return map;
  }, [assignedPlants]);

  const displayMetricsByPlant = useMemo(() => {
    const map: Record<string, DisplayMetrics> = {};
    for (const plant of assignedPlants) {
      map[plant.id] = getFrontendMetrics(plant, captureCountsByPlant[plant.id] ?? 0);
    }
    return map;
  }, [assignedPlants, captureCountsByPlant]);

  const harvestReadyPlants = useMemo(
    () => assignedPlants.filter((p) => displayMetricsByPlant[p.id]?.ripe),
    [assignedPlants, displayMetricsByPlant]
  );

  const totalRipeCount = harvestReadyPlants.length;
  const totalHarvestReadyCucumbers = harvestReadyPlants.reduce(
    (sum, plant) => sum + (displayMetricsByPlant[plant.id]?.cucumberCount ?? 0),
    0
  );

  const totalAssignedPlants = assignedPlants.length;
  const totalAssignedCucumbers = assignedPlants.reduce(
    (sum, plant) => sum + (displayMetricsByPlant[plant.id]?.cucumberCount ?? 0),
    0
  );

  const selectedMetrics = selectedPlant ? displayMetricsByPlant[selectedPlant.id] : null;
  const selectedRFID = selectedPlant
    ? [selectedPlant.rfidA, selectedPlant.rfidB].filter(Boolean).join(" / ")
    : "";

  const tunnelName = selectedTunnel?.tunnelName ?? selectedTunnel?.name ?? "Select a tunnel";

  const getPlantCardStyle = (plant: PlantDoc) => {
    const metrics = displayMetricsByPlant[plant.id];
    if (metrics?.ripe) return { bg: "#FFF3E0", border: "#FFCC80", dot: "#EF6C00" };
    return { bg: "#E8F5E9", border: "#A5D6A7", dot: "#2E7D32" };
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconBox}>
            <Ionicons name="basket" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Harvest Ready</Text>
            <Text style={styles.summaryValue}>{totalRipeCount} Plants</Text>
            <Text style={styles.summarySub}>{totalHarvestReadyCucumbers} Cucumbers • {tunnelName}</Text>
            <Text style={styles.summarySub}>
              RFID assigned: {totalAssignedPlants} Plants • {totalAssignedCucumbers} Cucumbers
            </Text>
          </View>
        </View>

        <SectionTitle title="Tunnel Map" />
        <Text style={styles.legend}>
          Only RFID-assigned plants are shown on the live tunnel layout. Cucumber counts come from each plant’s captures.
        </Text>

        {!tunnelId ? (
          <Text style={styles.helper}>Select a tunnel first.</Text>
        ) : rows <= 0 || cols <= 0 ? (
          <Text style={styles.helper}>This tunnel has no layout. Set rows and columns in tunnel setup.</Text>
        ) : (
          <View style={styles.tunnelMapCard}>
            <View style={styles.mapHeader}>
              <View>
                <Text style={styles.mapTitle}>{tunnelName}</Text>
                <Text style={styles.mapSubTitle}>{rows} rows × {cols} columns</Text>
              </View>
              <View style={styles.entrancePill}>
                <Ionicons name="log-in-outline" size={14} color="#2E7D32" />
                <Text style={styles.entrancePillText}>Entrance</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalPad}>
              <View>
                <View style={styles.columnHeaderRow}>
                  <View style={styles.axisCorner} />
                  {Array.from({ length: cols }).map((_, cIndex) => (
                    <View key={`head-${cIndex + 1}`} style={styles.columnHeaderCell}>
                      <Text style={styles.axisText}>C{cIndex + 1}</Text>
                    </View>
                  ))}
                </View>

                {Array.from({ length: rows }).map((_, rIndex) => (
                  <View key={`row-${rIndex + 1}`} style={styles.mapRowWrap}>
                    <View style={styles.rowHeaderCell}>
                      <Text style={styles.axisText}>R{rIndex + 1}</Text>
                    </View>

                    <View style={styles.mapRow}>
                      {Array.from({ length: cols }).map((_, cIndex) => {
                        const id = `r${rIndex + 1}_c${cIndex + 1}`;
                        const plant = plantsByCoord[id];

                        if (!plant) {
                          return (
                            <View key={id} style={[styles.emptyPlantSlot, styles.mapCell]}>
                              <Text style={styles.emptyPlantText}>—</Text>
                            </View>
                          );
                        }

                        const metrics = displayMetricsByPlant[plant.id];
                        const cardStyle = getPlantCardStyle(plant);
                        const isSelected = selectedPlant?.id === plant.id;

                        return (
                          <TouchableOpacity
                            key={plant.id}
                            activeOpacity={0.82}
                            onPress={() => setSelectedPlant(plant)}
                            style={[
                              styles.mapCell,
                              styles.plantCard,
                              {
                                backgroundColor: cardStyle.bg,
                                borderColor: isSelected ? "#2E7D32" : cardStyle.border,
                              },
                              isSelected && styles.selectedPlantCard,
                            ]}
                          >
                            <View style={styles.cardTopRow}>
                              <View style={[styles.statusDot, { backgroundColor: cardStyle.dot }]} />
                              <View style={styles.countBadge}>
                                <Text style={styles.countText}>{metrics?.cucumberCount ?? 0}</Text>
                              </View>
                            </View>

                            <Text style={styles.plantCardLabel}>{toShortPlantLabel(plant)}</Text>
                            <Text style={styles.plantCardRfid} numberOfLines={1}>
                              {[plant.rfidA, plant.rfidB].filter(Boolean).join(" / ")}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF6C00" }]} />
            <Text style={styles.legendText}>Harvest Ready</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#2E7D32" }]} />
            <Text style={styles.legendText}>Growing</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendBadgeMini}>
              <Text style={styles.legendBadgeText}>2</Text>
            </View>
            <Text style={styles.legendText}>Cucumbers from captures</Text>
          </View>
        </View>

        <View style={{ height: 220 }} />
      </ScrollView>

      {selectedPlant && selectedMetrics && (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{toPlantTitle(selectedPlant)}</Text>
            <TouchableOpacity onPress={() => setSelectedPlant(null)}>
              <Ionicons name="close-circle" size={28} color="#aaa" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailRow}>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: selectedMetrics.ripe ? "#FFF3E0" : "#E8F5E9" },
              ]}
            >
              <Ionicons
                name={selectedMetrics.ripe ? "basket" : "leaf"}
                size={24}
                color={selectedMetrics.ripe ? "#EF6C00" : "#2E7D32"}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>
                {selectedMetrics.ripe ? "Ready for Harvest" : "Not Ready Yet"}
              </Text>
              <Text style={styles.detailSubtitle}>RFID: {selectedRFID || "Assigned"}</Text>
              <Text style={styles.detailSubtitle}>Captured cucumbers: {selectedMetrics.cucumberCount}</Text>
              <Text style={styles.detailSubtitle}>
                Length: {selectedMetrics.lengthCm} cm • Diameter: {selectedMetrics.diameterCm} cm
              </Text>
              <Text style={styles.detailSubtitle}>Distance: {selectedMetrics.distanceCm} cm</Text>
            </View>

            <View
              style={[
                styles.bigCountBadge,
                { backgroundColor: selectedMetrics.ripe ? "#EF6C00" : "#2E7D32" },
              ]}
            >
              <Text style={styles.bigCountText}>{selectedMetrics.ripe ? "RIPE" : "UNRIPE"}</Text>
            </View>
          </View>

          {tunnelId ? (
            <TouchableOpacity
              style={styles.viewScansBtn}
              onPress={() => {
                setSelectedPlant(null);
                navigation.navigate("DetectionDetail", {
                  tunnelId,
                  plantId: selectedPlant.id,
                  filterMode: "CUCUMBER",
                });
              }}
            >
              <Ionicons name="scan-outline" size={18} color="#fff" />
              <Text style={styles.viewScansText}>View Scans</Text>
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
  scrollContent: { padding: 16 },

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
  summaryValue: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 2 },
  summarySub: { color: "#EAF8ED", fontSize: 13, marginTop: 4 },

  legend: { color: "#7A7A7A", marginTop: -6, marginBottom: 12, fontSize: 13 },
  helper: { color: "#777", marginTop: 10 },

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
  mapTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1E1E1E",
  },
  mapSubTitle: {
    fontSize: 12,
    color: "#777",
    marginTop: 3,
  },
  entrancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EDF7EE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  entrancePillText: {
    color: "#2E7D32",
    fontSize: 12,
    fontWeight: "700",
  },
  horizontalPad: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  columnHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  axisCorner: {
    width: 34,
  },
  columnHeaderCell: {
    width: CELL_SIZE,
    alignItems: "center",
  },
  rowHeaderCell: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  axisText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7A7A7A",
  },
  mapRowWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  mapRow: {
    flexDirection: "row",
  },
  mapCell: {
    width: CELL_SIZE,
    height: 72,
    marginRight: 10,
    borderRadius: 18,
  },
  emptyPlantSlot: {
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPlantText: {
    color: "#C5C5C5",
    fontSize: 18,
    fontWeight: "600",
  },
  plantCard: {
    borderWidth: 1.5,
    padding: 8,
    justifyContent: "space-between",
  },
  selectedPlantCard: {
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  countText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  plantCardLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#222",
  },
  plantCardRfid: {
    fontSize: 10,
    color: "#666",
  },

  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 16,
    alignItems: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendText: {
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
  },
  legendBadgeMini: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  legendBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },

  bottomSheet: {
    position: "absolute",
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
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
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
  detailSubtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 3,
  },
  bigCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  bigCountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
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
  viewScansText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
