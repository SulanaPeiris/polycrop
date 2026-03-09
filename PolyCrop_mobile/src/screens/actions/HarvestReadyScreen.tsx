import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnel } from "../../context/TunnelContext";

type PlantDoc = {
  id: string; // doc id e.g. r1_c2
  row?: number;
  column?: number;

  plantUid?: string;
  plantName?: string;

  lastRipe?: boolean;
  lastCucumberLengthCm?: number | null;
  lastCucumberDiameterCm?: number | null;
  lastDistanceCm?: number | null;
  lastAnnotatedUrl?: string | null;
  lastScanAt?: any;
};

function parseIdToRowCol(id: string): { row?: number; column?: number } {
  // id like r1_c2
  const m = /^r(\d+)_c(\d+)$/i.exec(id || "");
  if (!m) return {};
  return { row: Number(m[1]), column: Number(m[2]) };
}

export default function HarvestReadyScreen({ navigation }: any) {
  useTunnelHeader("Harvest Ready");

  const { selectedTunnel } = useTunnel();
  const tunnelId = selectedTunnel?.id ?? "";

  const rows = selectedTunnel?.rows ?? 0;
  const cols = selectedTunnel?.columns ?? 0;

  const [plants, setPlants] = useState<PlantDoc[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlantDoc | null>(null);

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
    const map: Record<string, PlantDoc> = {};
    for (const p of plants) {
      const rr = p.row ?? parseIdToRowCol(p.id).row;
      const cc = p.column ?? parseIdToRowCol(p.id).column;
      if (rr && cc) map[`r${rr}_c${cc}`] = { ...p, row: rr, column: cc };
    }
    return map;
  }, [plants]);

  const ripePlants = useMemo(() => plants.filter((p) => !!p.lastRipe), [plants]);
  const totalRipeCount = ripePlants.length;

  const getPlantColor = (p: PlantDoc) => {
    if (p.lastRipe) return "#FFF3E0"; // harvest-ready background
    return "#E8F5E9"; // growing
  };

  const getDotColor = (p: PlantDoc) => {
    if (p.lastRipe) return "#EF6C00"; // orange dot
    return "#2E7D32"; // green dot
  };

  const tunnelName = selectedTunnel?.tunnelName ?? selectedTunnel?.name ?? "Select a tunnel";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconBox}>
            <Ionicons name="basket" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Harvest Ready</Text>
            <Text style={styles.summaryValue}>{totalRipeCount} Plants</Text>
            <Text style={styles.summarySub}>{tunnelName}</Text>
          </View>
        </View>

        <SectionTitle title="Tunnel Map" />
        <Text style={styles.legend}>Tap a plant to view details</Text>

        {!tunnelId ? (
          <Text style={styles.helper}>Select a tunnel first.</Text>
        ) : rows <= 0 || cols <= 0 ? (
          <Text style={styles.helper}>This tunnel has no layout (rows/columns). Set it in Settings → Setup Tunnel.</Text>
        ) : (
          <View style={styles.tunnelMap}>
            <View style={styles.gridContainer}>
              {Array.from({ length: rows }).map((_, rIndex) => (
                <View key={`row-${rIndex}`} style={styles.row}>
                  {Array.from({ length: cols }).map((_, cIndex) => {
                    const id = `r${rIndex + 1}_c${cIndex + 1}`;
                    const plant = plantsByCoord[id];

                    if (!plant) {
                      return (
                        <View
                          key={id}
                          style={[styles.plantNode, { backgroundColor: "#F5F5F5", opacity: 0.55 }]}
                        />
                      );
                    }

                    const isSelected = selectedPlant?.id === plant.id;

                    return (
                      <TouchableOpacity
                        key={plant.id}
                        style={[
                          styles.plantNode,
                          { backgroundColor: getPlantColor(plant) },
                          isSelected && styles.selectedNode,
                        ]}
                        activeOpacity={0.75}
                        onPress={() => setSelectedPlant(plant)}
                      >
                        <View style={[styles.dot, { backgroundColor: isSelected ? "#fff" : getDotColor(plant) }]} />

                        {/* ✅ Badge if ripe */}
                        {plant.lastRipe && (
                          <View style={styles.countBadge}>
                            <Text style={styles.countText}>✓</Text>
                          </View>
                        )}
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
        )}

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#EF6C00" }]} />
            <Text style={styles.legendText}>Harvest Ready</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#2E7D32" }]} />
            <Text style={styles.legendText}>Growing</Text>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom Sheet */}
      {selectedPlant && (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{selectedPlant.plantUid ?? selectedPlant.id}</Text>
            <TouchableOpacity onPress={() => setSelectedPlant(null)}>
              <Ionicons name="close-circle" size={28} color="#aaa" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailRow}>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: selectedPlant.lastRipe ? "#FFF3E0" : "#E8F5E9" },
              ]}
            >
              <Ionicons
                name={selectedPlant.lastRipe ? "basket" : "leaf"}
                size={24}
                color={selectedPlant.lastRipe ? "#EF6C00" : "#2E7D32"}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>
                {selectedPlant.lastRipe ? "Ready for Harvest" : "Not Ready Yet"}
              </Text>

              <Text style={styles.detailSubtitle}>
                Length: {selectedPlant.lastCucumberLengthCm ?? "N/A"} cm • Diameter:{" "}
                {selectedPlant.lastCucumberDiameterCm ?? "N/A"} cm • Distance:{" "}
                {selectedPlant.lastDistanceCm ?? "N/A"} cm
              </Text>
            </View>

            {selectedPlant.lastRipe && (
              <View style={styles.bigCountBadge}>
                <Text style={styles.bigCountText}>RIPE</Text>
              </View>
            )}
          </View>

          {/* Optional: jump to scan list */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  scrollContent: { padding: 16 },

  helper: { color: "#757575", marginTop: 10, textAlign: "center", fontWeight: "700" },

  summaryCard: {
    backgroundColor: "#2E7D32",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    elevation: 4,
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  summaryIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  summaryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600", marginBottom: 2 },
  summaryValue: { color: "#fff", fontSize: 24, fontWeight: "800" },
  summarySub: { color: "rgba(255,255,255,0.8)", marginTop: 6, fontWeight: "700" },

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
    borderColor: "#EF6C00",
    borderWidth: 3,
    backgroundColor: "#EF6C00",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },

  countBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#EF6C00",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 2,
  },
  countText: { color: "#fff", fontSize: 10, fontWeight: "900" },

  labelContainer: {
    marginTop: 24,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
  },
  labelText: { fontSize: 11, fontWeight: "700", color: "#9E9E9E", letterSpacing: 1, textTransform: "uppercase" },

  legendContainer: { flexDirection: "row", gap: 20, justifyContent: "center", flexWrap: "wrap", paddingHorizontal: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendText: { fontSize: 12, color: "#616161", fontWeight: "500" },

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
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: "800", color: "#212121" },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  iconBox: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  detailTitle: { fontSize: 16, fontWeight: "700", color: "#212121", marginBottom: 4 },
  detailSubtitle: { fontSize: 13, color: "#757575", fontWeight: "700" },

  bigCountBadge: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bigCountText: { fontSize: 12, fontWeight: "900", color: "#EF6C00" },

  viewScansBtn: {
    marginTop: 14,
    backgroundColor: "#2E7D32",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  viewScansText: { color: "#fff", fontWeight: "900" },
});