import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";

const { width } = Dimensions.get("window");

// Mock Plant Interface
interface Plant {
  id: string;
  row: number;
  col: number;
  status: "Healthy" | "Infected" | "WaterStress" | "Multiple";
  diseases?: string[]; // "Downy Mildew", "Powdery Mildew"
  leafCount?: number; // Infected count
  sprayed?: boolean;
}

export default function DetectionFeedScreen() {
  useTunnelHeader("Detection Feed");

  // Mock Grid Data: 10 Rows x 4 Columns
  const rows = 10;
  const cols = 4;

  const initialPlants: Plant[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `R${r + 1}-C${c + 1}`;
      let status: Plant['status'] = "Healthy";
      let diseases: string[] = [];
      let leafCount = 0;
      let sprayed = false;

      // Simulate specific infections
      if (r === 2 && c === 1) {
        status = "Infected";
        diseases = ["Downy Mildew"];
        leafCount = 3;
      }
      if (r === 5 && c === 2) {
        status = "WaterStress";
      }
      if (r === 8 && c === 0) {
        status = "Multiple"; // Both
        diseases = ["Powdery Mildew"];
        leafCount = 5;
        sprayed = true;
      }

      initialPlants.push({ id, row: r, col: c, status, diseases, leafCount, sprayed });
    }
  }

  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);

  const getPlantColor = (p: Plant) => {
    // Highlight selected plant with a distinct border/color logic in the render loop, 
    // but here we define base status colors
    if (p.status === "Healthy") return "#C8E6C9"; // Light Green
    if (p.status === "WaterStress") return "#FFF3E0"; // Light Orange
    if (p.status === "Infected") return "#FFEBEE"; // Light Red
    if (p.status === "Multiple") return "#E1BEE7"; // Light Purple
    return "#eee";
  };

  const getDotColor = (p: Plant) => {
    if (p.status === "Healthy") return "#2E7D32"; // Green Dot
    if (p.status === "WaterStress") return "#EF6C00"; // Orange Dot
    if (p.status === "Infected") return "#D32F2F"; // Red Dot
    if (p.status === "Multiple") return "#8E24AA"; // Purple Dot
    return "#999";
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <SectionTitle title="Tunnel Map" />
        <Text style={styles.legend}>Tap a plant to view details</Text>

        {/* The Tunnel Map */}
        <View style={styles.tunnelMap}>
          {/* Grid */}
          <View style={styles.gridContainer}>
            {Array.from({ length: rows }).map((_, rIndex) => (
              <View key={`row-${rIndex}`} style={styles.row}>
                {Array.from({ length: cols }).map((_, cIndex) => {
                  const plant = initialPlants.find(p => p.row === rIndex && p.col === cIndex);
                  if (!plant) return null;

                  const isSelected = selectedPlant?.id === plant.id;

                  return (
                    <TouchableOpacity
                      key={plant.id}
                      style={[
                        styles.plantNode,
                        { backgroundColor: getPlantColor(plant) },
                        isSelected && styles.selectedNode // Apply selection style
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setSelectedPlant(plant)}
                    >
                      {/* Center Dot - Change color if selected for visibility */}
                      <View style={[
                        styles.dot,
                        { backgroundColor: isSelected ? "#fff" : getDotColor(plant) }
                      ]} />

                      {/* Infected Leaf Count Badge */}
                      {(plant.status === "Infected" || plant.status === "Multiple") && (
                        <View style={styles.leafBadge}>
                          <Text style={styles.leafText}>{plant.leafCount}</Text>
                        </View>
                      )}

                      {/* Water Stress Icon */}
                      {(plant.status === "WaterStress" || plant.status === "Multiple") && (
                        <Ionicons name="water" size={12} color="#EF6C00" style={styles.stressIcon} />
                      )}

                      {/* Sprayed Icon */}
                      {plant.sprayed && (
                        <View style={styles.sprayedBadge}>
                          <Ionicons name="shield-checkmark" size={10} color="#fff" />
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
            <View style={[styles.plantNode, { width: 14, height: 14, borderRadius: 7, borderColor: "#2E7D32", borderWidth: 2, backgroundColor: "transparent" }]} />
            <Text style={styles.legendText}>Selected</Text>
          </View>
        </View>

      </ScrollView>

      {/* Bottom Sheet Modal */}
      {selectedPlant && (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Plant {selectedPlant.id}</Text>
            <TouchableOpacity onPress={() => setSelectedPlant(null)}>
              <Ionicons name="close-circle" size={28} color="#aaa" />
            </TouchableOpacity>
          </View>

          <View style={styles.sheetContent}>
            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: getPlantColor(selectedPlant) }]}>
              <Text style={[styles.statusText, { color: getDotColor(selectedPlant) }]}>
                {selectedPlant.status === "Multiple" ? "Multiple Issues" : selectedPlant.status}
              </Text>
            </View>

            {/* Issues Detail */}
            {(selectedPlant.status !== "Healthy") && (
              <View style={styles.issuesList}>

                {/* Diseases */}
                {selectedPlant.diseases?.map(d => {
                  const isDowny = d.includes("Downy");
                  // Downy = Leaf, Powdery = Frost
                  const iconName = isDowny ? "leaf" : "snow";
                  const iconColor = isDowny ? "#D32F2F" : "#7B1FA2"; // Red for Downy, Purple for Powdery
                  const bg = isDowny ? "#FFEBEE" : "#F3E5F5";

                  return (
                    <View key={d} style={styles.issueRow}>
                      <View style={[styles.issueIconBox, { backgroundColor: bg }]}>
                        <Ionicons name={iconName as any} size={20} color={iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.issueText}>{d}</Text>
                        <Text style={styles.issueMeta}>Fungal Infection detected</Text>
                      </View>
                      <View style={styles.leafCountBadge}>
                        <Text style={styles.leafCountText}>{selectedPlant.leafCount}</Text>
                        <Text style={styles.leafCountLabel}>leaves</Text>
                      </View>
                    </View>
                  );
                })}

                {/* Water Stress */}
                {(selectedPlant.status === "WaterStress" || selectedPlant.status === "Multiple") && (
                  <View style={styles.issueRow}>
                    <View style={[styles.issueIconBox, { backgroundColor: "#FFF3E0" }]}>
                      <Ionicons name="water" size={20} color="#EF6C00" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.issueText}>Water Stress</Text>
                      <Text style={styles.issueMeta}>Soil moisture critically low</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Robot Action */}
            <View style={styles.robotRow}>
              <Text style={styles.robotLabel}>Robot Activity</Text>
              {selectedPlant.sprayed ? (
                <View style={styles.sprayedTag}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={styles.sprayedText}>Treated</Text>
                </View>
              ) : (
                <View style={styles.pendingTag}>
                  <Text style={styles.pendingText}>No action taken</Text>
                </View>
              )}
            </View>
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
    // Premium Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    alignItems: "center",
    marginBottom: 24,
  },
  gridContainer: {
    gap: 14, // Gap between rows
  },
  row: {
    flexDirection: "row",
    gap: 18, // Gap between columns
  },
  plantNode: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.03)",
  },
  // SELECTED STATE: Blue border + Dark blue background (optional, or just border)
  selectedNode: {
    borderColor: "#2E7D32",
    borderWidth: 3,
    backgroundColor: "#2E7D32", // Make background solid blue to make white dot pop? 
    // User said "selected plant dot should display with different color".
    // Let's rely on the dot changing to white (see render logic) and the border.
  },

  dot: {
    width: 10, height: 10, borderRadius: 5,
  },

  // Indicators
  leafBadge: {
    position: "absolute", top: -6, right: -6,
    backgroundColor: "#D32F2F", width: 20, height: 20, borderRadius: 10,
    justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff",
    elevation: 2,
  },
  leafText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  stressIcon: { position: "absolute", bottom: 0, right: 0 },

  sprayedBadge: {
    position: "absolute", bottom: -4, left: -4,
    backgroundColor: "#2E7D32", width: 18, height: 18, borderRadius: 9,
    justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff",
    elevation: 2,
  },

  labelContainer: {
    marginTop: 24,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 20, paddingVertical: 6,
    borderRadius: 20
  },
  labelText: { fontSize: 11, fontWeight: "700", color: "#9E9E9E", letterSpacing: 1, textTransform: "uppercase" },

  legendContainer: { flexDirection: "row", gap: 20, justifyContent: "center", flexWrap: "wrap", paddingHorizontal: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendText: { fontSize: 12, color: "#616161", fontWeight: "500" },


  // Bottom Sheet
  bottomSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    elevation: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 24, fontWeight: "800", color: "#212121" },
  sheetContent: {},
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 24 },
  statusText: { fontWeight: "700", fontSize: 14 },

  issuesList: { gap: 16, marginBottom: 24 },
  issueRow: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: "#fff", padding: 16, borderRadius: 20,
    borderWidth: 1, borderColor: "#F0F0F0"
  },
  issueIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#FFEBEE", alignItems: "center", justifyContent: "center"
  },
  issueText: { fontSize: 16, fontWeight: "700", color: "#212121" },
  issueMeta: { fontSize: 12, color: "#757575", marginTop: 2 },

  leafCountBadge: { alignItems: "center", backgroundColor: "#F5F5F5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  leafCountText: { fontSize: 18, fontWeight: "800", color: "#D32F2F" },
  leafCountLabel: { fontSize: 10, color: "#999", fontWeight: "600" },

  robotRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 20, borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  robotLabel: { fontSize: 14, color: "#616161", fontWeight: "600" },
  sprayedTag: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E8F5E9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  sprayedText: { color: "#2E7D32", fontWeight: "700", fontSize: 13 },
  pendingTag: { backgroundColor: "#F5F5F5", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  pendingText: { color: "#9E9E9E", fontWeight: "600", fontSize: 13 },

});
