import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import {
  aggregatePlantHarvest,
  buildCucumberScanVM,
  CucumberScanVM,
  formatCm,
  formatDateTime,
  timeAgo,
} from "../../services/cucumberScanUtils";

type PlantDoc = {
  id: string;
  plantUid?: string;
  plantName?: string;
  row?: number;
  column?: number;
  rfidA?: string | null;
  rfidB?: string | null;
};

function plantTitle(plant?: PlantDoc | null, fallback?: string) {
  return plant?.plantUid || plant?.plantName || fallback || plant?.id || "Plant";
}

function plantSubTitle(plant?: PlantDoc | null) {
  if (!plant) return "Plant cucumber scans";
  const rfid = [plant.rfidA, plant.rfidB].filter(Boolean).join(" / ");
  const pos = plant.row && plant.column ? `Row ${plant.row} • Column ${plant.column}` : "";
  if (pos && rfid) return `${pos} • RFID ${rfid}`;
  return pos || (rfid ? `RFID ${rfid}` : "Plant cucumber scans");
}

function ScanCard({ scan, onPress }: { scan: CucumberScanVM; onPress: () => void }) {
  const thumb = scan.annotatedUrl || scan.imageUrl;
  const firstCucumber = scan.cucumbers[0];
  const cm = firstCucumber?.cm;

  return (
    <TouchableOpacity style={styles.scanCard} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.scanThumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.scanThumb} resizeMode="cover" />
        ) : (
          <Ionicons name="image-outline" size={24} color="#2E7D32" />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.scanTopRow}>
          <Text style={styles.scanTitle}>Scan {scan.id.slice(0, 8)}</Text>
          <View style={scan.ripeCount > 0 ? styles.ripePill : styles.unripePill}>
            <Text style={scan.ripeCount > 0 ? styles.ripePillText : styles.unripePillText}>
              {scan.ripeCount > 0 ? `${scan.ripeCount} RIPE` : "NO RIPE"}
            </Text>
          </View>
        </View>

        <Text style={styles.scanMeta}>
          {scan.cucumberCount} cucumbers • {scan.ripeCount} ripe • {scan.unripeCount} unripe
        </Text>
        <Text style={styles.scanMeta}>Distance: {formatCm(scan.distanceCm, 1)}</Text>
        <Text style={styles.scanTime}>
          {scan.displayTimeMs ? `${timeAgo(scan.displayTimeMs)} • ${formatDateTime(scan.displayTimeMs)}` : "Time N/A"}
        </Text>

        {cm ? (
          <Text style={styles.scanSize}>
            First size: {formatCm(cm.lengthCm, 2)} × {formatCm(cm.diameterCm, 2)}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
    </TouchableOpacity>
  );
}

export default function CucumberScansScreen({ route, navigation }: any) {
  useTunnelHeader("Cucumber Scans");

  const tunnelId: string = route?.params?.tunnelId ?? "";
  const plantId: string = route?.params?.plantId ?? "";
  const fallbackPlantTitle: string | undefined = route?.params?.plantTitle;
  const fallbackPlant: PlantDoc | null = plantId
    ? {
        id: plantId,
        plantUid: fallbackPlantTitle,
        row: route?.params?.row,
        column: route?.params?.column,
        rfidA: route?.params?.rfidA,
        rfidB: route?.params?.rfidB,
      }
    : null;

  const [plant, setPlant] = useState<PlantDoc | null>(null);
  const [scans, setScans] = useState<CucumberScanVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!tunnelId || !plantId) return;

    const ref = doc(db, "tunnels", tunnelId, "plants", plantId);
    return onSnapshot(ref, (snap) => {
      setPlant(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as PlantDoc) : null);
    });
  }, [plantId, tunnelId]);

  useEffect(() => {
    if (!tunnelId || !plantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(db, "tunnels", tunnelId, "plants", plantId, "captures");

    return onSnapshot(
      ref,
      (snap) => {
        const list = snap.docs
          .map((d) => buildCucumberScanVM(d.id, d.data()))
          .filter((scan) => (scan.status === "DONE" || scan.status === "") && scan.cucumberCount > 0)
          .sort((a, b) => (b.displayTimeMs || 0) - (a.displayTimeMs || 0))
          .slice(0, 200);

        setScans(list);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.log("cucumber scans snapshot error:", err?.message);
        setLoading(false);
        setRefreshing(false);
      }
    );
  }, [plantId, tunnelId]);

  const activePlant = plant ?? fallbackPlant;
  const stats = useMemo(() => aggregatePlantHarvest(scans), [scans]);
  const title = plantTitle(activePlant, fallbackPlantTitle);

  if (!tunnelId || !plantId) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={42} color="#EF6C00" />
        <Text style={styles.emptyTitle}>Missing plant details</Text>
        <Text style={styles.emptyText}>Open this screen from Harvest Ready.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2E7D32" />
        <Text style={styles.emptyText}>Loading cucumber scans…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 600);
            }}
            tintColor="#2E7D32"
          />
        }
      >
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.headerIcon}>
              <Ionicons name="leaf" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerLabel}>Plant Cucumber Scans</Text>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSub}>{plantSubTitle(activePlant)}</Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{stats.totalCucumbers}</Text>
              <Text style={styles.summaryLabel}>Total detected</Text>
            </View>
            <View style={styles.summaryBoxOrange}>
              <Text style={[styles.summaryValue, { color: "#EF6C00" }]}>{stats.totalRipe}</Text>
              <Text style={styles.summaryLabel}>Total ripe</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{stats.totalUnripe}</Text>
              <Text style={styles.summaryLabel}>Unripe</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{stats.cucumberScanCount}</Text>
              <Text style={styles.summaryLabel}>Scans</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoStrip}>
          <Ionicons name="information-circle-outline" size={18} color="#2E7D32" />
          <Text style={styles.infoText}>
            Showing only captures saved under this plant: tunnels/{tunnelId}/plants/{plantId}/captures.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Cucumber Scans</Text>

        {scans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="images-outline" size={42} color="#A5D6A7" />
            <Text style={styles.emptyTitle}>No cucumber scans for this plant</Text>
            <Text style={styles.emptyText}>This plant has no completed scan with cucumber detections yet.</Text>
          </View>
        ) : (
          scans.map((scan) => (
            <ScanCard
              key={scan.id}
              scan={scan}
              onPress={() => {
                navigation.navigate("CucumberScanDetail", {
                  tunnelId,
                  plantId,
                  captureId: scan.id,
                });
              }}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F9F7" },
  container: { padding: 16, paddingBottom: 34 },
  center: { flex: 1, backgroundColor: "#F7F9F7", alignItems: "center", justifyContent: "center", padding: 22 },
  headerCard: { backgroundColor: "#fff", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#EAEFEA", marginBottom: 12 },
  headerTop: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  headerIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#2E7D32", alignItems: "center", justifyContent: "center", marginRight: 12 },
  headerLabel: { color: "#689F38", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  headerTitle: { color: "#1B5E20", fontSize: 22, fontWeight: "900", marginTop: 2 },
  headerSub: { color: "#666", fontSize: 12, fontWeight: "700", marginTop: 3 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryBox: { width: "48%", backgroundColor: "#F7FAF7", borderRadius: 16, padding: 13, borderWidth: 1, borderColor: "#ECF2EC" },
  summaryBoxOrange: { width: "48%", backgroundColor: "#FFF7ED", borderRadius: 16, padding: 13, borderWidth: 1, borderColor: "#FFE0B2" },
  summaryValue: { color: "#1B5E20", fontSize: 22, fontWeight: "900" },
  summaryLabel: { color: "#777", marginTop: 4, fontSize: 11, fontWeight: "800" },
  infoStrip: { flexDirection: "row", gap: 8, backgroundColor: "#E8F5E9", borderRadius: 16, padding: 12, marginBottom: 16, alignItems: "flex-start" },
  infoText: { flex: 1, color: "#2E7D32", fontSize: 12, fontWeight: "700", lineHeight: 18 },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#222", marginBottom: 12 },
  scanCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 20, padding: 12, borderWidth: 1, borderColor: "#EAEFEA", marginBottom: 12 },
  scanThumbWrap: { width: 76, height: 76, borderRadius: 18, backgroundColor: "#E8F5E9", overflow: "hidden", alignItems: "center", justifyContent: "center", marginRight: 12 },
  scanThumb: { width: "100%", height: "100%" },
  scanTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  scanTitle: { flex: 1, color: "#222", fontSize: 14, fontWeight: "900" },
  scanMeta: { color: "#444", marginTop: 4, fontSize: 12, fontWeight: "800" },
  scanTime: { color: "#888", marginTop: 4, fontSize: 11, fontWeight: "700" },
  scanSize: { color: "#2E7D32", marginTop: 4, fontSize: 11, fontWeight: "900" },
  ripePill: { backgroundColor: "#FFF3E0", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  ripePillText: { color: "#EF6C00", fontSize: 10, fontWeight: "900" },
  unripePill: { backgroundColor: "#EEF2EE", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  unripePillText: { color: "#777", fontSize: 10, fontWeight: "900" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 22, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#EAEFEA" },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#1B5E20", marginTop: 10, textAlign: "center" },
  emptyText: { color: "#777", marginTop: 8, textAlign: "center", lineHeight: 20, fontWeight: "600" },
});
