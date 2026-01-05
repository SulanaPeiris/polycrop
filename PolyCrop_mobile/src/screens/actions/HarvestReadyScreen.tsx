import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";

const { width } = Dimensions.get("window");

// Mock Plant Interface for Harvest
interface Plant {
    id: string;
    row: number;
    col: number;
    ripeCount: number; // Number of harvest-ready cucumbers
}

export default function HarvestReadyScreen() {
    useTunnelHeader("Harvest Ready");

    // Mock Grid Data: 10 Rows x 4 Columns
    const rows = 10;
    const cols = 4;

    const initialPlants: Plant[] = [];
    let totalRipeCount = 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const id = `R${r + 1}-C${c + 1}`;
            let ripeCount = 0;

            // Simulate some having ripe cucumbers
            if ((r + c) % 3 === 0) {
                ripeCount = Math.floor(Math.random() * 4) + 1; // 1 to 4 cucumbers
            }

            // Specifically ensure some have 0 for contrast
            if (r === 0 && c === 0) ripeCount = 0;

            totalRipeCount += ripeCount;
            initialPlants.push({ id, row: r, col: c, ripeCount });
        }
    }

    const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);

    const getPlantColor = (p: Plant) => {
        if (p.ripeCount > 0) return "#FFF3E0"; // Light Orange background for harvest ready
        return "#E8F5E9"; // Light Green for growing/empty
    };

    const getDotColor = (p: Plant) => {
        if (p.ripeCount > 0) return "#EF6C00"; // Orange dot for harvest ready
        return "#2E7D32"; // Green dot for growing
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryIconBox}>
                        <Ionicons name="basket" size={28} color="#fff" />
                    </View>
                    <View>
                        <Text style={styles.summaryLabel}>Total Harvest Ready</Text>
                        <Text style={styles.summaryValue}>{totalRipeCount} Cucumbers</Text>
                    </View>
                </View>

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
                                            {/* Center Dot */}
                                            <View style={[
                                                styles.dot,
                                                { backgroundColor: isSelected ? "#fff" : getDotColor(plant) }
                                            ]} />

                                            {/* Ripe Count Badge */}
                                            {plant.ripeCount > 0 && (
                                                <View style={styles.countBadge}>
                                                    <Text style={styles.countText}>{plant.ripeCount}</Text>
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
                        <View style={[styles.dot, { backgroundColor: "#EF6C00" }]} />
                        <Text style={styles.legendText}>Harvest Ready</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.dot, { backgroundColor: "#2E7D32" }]} />
                        <Text style={styles.legendText}>Growing</Text>
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
                        <View style={styles.detailRow}>
                            <View style={[styles.iconBox, { backgroundColor: selectedPlant.ripeCount > 0 ? "#FFF3E0" : "#E8F5E9" }]}>
                                <Ionicons
                                    name={selectedPlant.ripeCount > 0 ? "basket" : "leaf"}
                                    size={24}
                                    color={selectedPlant.ripeCount > 0 ? "#EF6C00" : "#2E7D32"}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.detailTitle}>
                                    {selectedPlant.ripeCount > 0 ? "Ready for Harvest" : "Growing Phase"}
                                </Text>
                                <Text style={styles.detailSubtitle}>
                                    {selectedPlant.ripeCount > 0
                                        ? `${selectedPlant.ripeCount} cucumbers are ready to accept.`
                                        : "No cucumbers ready yet."
                                    }
                                </Text>
                            </View>
                            {selectedPlant.ripeCount > 0 && (
                                <View style={styles.bigCountBadge}>
                                    <Text style={styles.bigCountText}>{selectedPlant.ripeCount}</Text>
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

    summaryCard: {
        backgroundColor: "#2E7D32", // Dark Green
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
        width: 50, height: 50, borderRadius: 25,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center", justifyContent: "center",
        marginRight: 16
    },
    summaryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600", marginBottom: 2 },
    summaryValue: { color: "#fff", fontSize: 24, fontWeight: "800" },

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
        position: "absolute", top: -6, right: -6,
        backgroundColor: "#EF6C00", width: 20, height: 20, borderRadius: 10,
        justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff",
        elevation: 2,
    },
    countText: { color: "#fff", fontSize: 10, fontWeight: "800" },

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

    detailRow: {
        flexDirection: "row", alignItems: "center", gap: 16,
        backgroundColor: "#fff", padding: 16, borderRadius: 20,
        borderWidth: 1, borderColor: "#F0F0F0"
    },
    iconBox: {
        width: 48, height: 48, borderRadius: 16,
        alignItems: "center", justifyContent: "center"
    },
    detailTitle: { fontSize: 16, fontWeight: "700", color: "#212121", marginBottom: 4 },
    detailSubtitle: { fontSize: 13, color: "#757575" },
    bigCountBadge: {
        backgroundColor: "#FFF3E0", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
        alignItems: "center", justifyContent: "center"
    },
    bigCountText: { fontSize: 20, fontWeight: "800", color: "#EF6C00" }
});
