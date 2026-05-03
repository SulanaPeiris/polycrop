import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import {
  buildPlantDiseaseMetrics,
  diseaseBg,
  diseaseColor,
  getHealthScore,
  niceDiseaseName,
  parseIdToRowCol,
  PlantDiseaseMetrics,
  PlantDoc,
  riskLabel,
  severityText,
  statusText,
  timeAgo,
} from "../../services/diseaseScanUtils";

const { width } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2;

function withRowColumn(plant: PlantDoc): PlantDoc {
  const parsed = parseIdToRowCol(plant.id);
  return {
    ...plant,
    row: plant.row ?? parsed.row,
    column: plant.column ?? parsed.column,
  };
}

function hasDisease(metrics: PlantDiseaseMetrics, disease: string) {
  return metrics.diseases.includes(disease);
}

function countHighSeverity(metrics: PlantDiseaseMetrics[]) {
  return metrics.filter((m) => {
    const values = Object.values(m.diseaseSeverity ?? {});
    return values.some((stat: any) => {
      const level = String(stat?.severityLevel ?? "").toLowerCase();
      const max = Number(stat?.maxSeverityPercent ?? 0);
      return level.includes("high") || level.includes("severe") || max >= 40;
    });
  }).length;
}

export default function DiseaseDashboardScreen({ navigation }: any) {
  useTunnelHeader("Disease & Stress");

  const { selectedTunnel } = useTunnel();
  const tunnelId = selectedTunnel?.id ?? "";
  const totalLayoutPlants = (selectedTunnel?.rows ?? 0) * (selectedTunnel?.columns ?? 0);

  const [plants, setPlants] = useState<PlantDoc[]>([]);
  const [captureMetricsByPlant, setCaptureMetricsByPlant] = useState<
    Record<string, PlantDiseaseMetrics>
  >({});

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

        setCaptureMetricsByPlant((prev) => ({
          ...prev,
          [plant.id]: metrics,
        }));
      });
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [plants, tunnelId]);

  const plantMetrics = useMemo(() => {
    return plants.map((plant) => {
      return captureMetricsByPlant[plant.id] ?? buildPlantDiseaseMetrics(plant, []);
    });
  }, [plants, captureMetricsByPlant]);

  const stats = useMemo(() => {
    const totalPlants = totalLayoutPlants || plants.length;
    const scanned = plantMetrics.filter((m) => m.scanned).length;
    const affected = plantMetrics.filter((m) => m.affected).length;
    const healthy = plantMetrics.filter((m) => m.scanned && !m.affected).length;
    const downy = plantMetrics.filter((m) => hasDisease(m, "downy_mildew")).length;
    const powdery = plantMetrics.filter((m) => hasDisease(m, "powdery_mildew")).length;
    const waterStress = plantMetrics.filter((m) => hasDisease(m, "water_stress") || m.waterStressAlert).length;
    const sprayNeeded = plantMetrics.filter((m) => m.sprayRecommended).length;
    const highSeverity = countHighSeverity(plantMetrics);
    const scans = plantMetrics.reduce((sum, m) => sum + (m.scanCount ?? 0), 0);
    const leafCount = plantMetrics.reduce((sum, m) => sum + (m.counts.leaf ?? 0), 0);

    return {
      totalPlants,
      scanned,
      affected,
      healthy,
      downy,
      powdery,
      waterStress,
      sprayNeeded,
      highSeverity,
      scans,
      leafCount,
      healthPct: getHealthScore(totalPlants, affected),
    };
  }, [plantMetrics, plants.length, totalLayoutPlants]);

  const latestAffected = useMemo(() => {
    return [...plantMetrics]
      .filter((m) => m.affected)
      .sort((a, b) => (b.updatedAtMs || b.createdAtMs) - (a.updatedAtMs || a.createdAtMs))
      .slice(0, 4);
  }, [plantMetrics]);

  const tunnelName = selectedTunnel?.tunnelName ?? selectedTunnel?.name ?? "Select a tunnel";

  const healthColor = stats.healthPct >= 80 ? "#2E7D32" : stats.healthPct >= 55 ? "#EF6C00" : "#D32F2F";

  const cards = [
    {
      title: "Downy Mildew",
      status: `${riskLabel(stats.downy, stats.totalPlants)} • ${stats.downy} plants`,
      icon: "leaf-outline",
      color: diseaseColor("downy_mildew"),
      bg: stats.downy ? diseaseBg("downy_mildew") : "#E8F5E9",
    },
    {
      title: "Powdery Mildew",
      status: `${riskLabel(stats.powdery, stats.totalPlants)} • ${stats.powdery} plants`,
      icon: "snow-outline",
      color: diseaseColor("powdery_mildew"),
      bg: stats.powdery ? diseaseBg("powdery_mildew") : "#E8F5E9",
    },
    {
      title: "Water Stress",
      status: `${riskLabel(stats.waterStress, stats.totalPlants)} • ${stats.waterStress} plants`,
      icon: "water-outline",
      color: diseaseColor("water_stress"),
      bg: stats.waterStress ? diseaseBg("water_stress") : "#E8F5E9",
    },
    {
      title: "Spray Needed",
      status: `${stats.sprayNeeded} plants • ${stats.highSeverity} high severity`,
      icon: "flame-outline",
      color: stats.sprayNeeded ? "#1565C0" : "#2E7D32",
      bg: stats.sprayNeeded ? "#E3F2FD" : "#E8F5E9",
    },
  ];

  function goToFeed() {
    let rootNavigation = navigation;
    while (rootNavigation?.getParent?.()) {
      rootNavigation = rootNavigation.getParent();
    }
    rootNavigation.navigate("DetectionFeed");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.scoreCard}>
        <View style={[styles.scoreCircle, { borderColor: `${healthColor}33` }]}>
          <Text style={[styles.scoreValue, { color: healthColor }]}>{stats.healthPct}</Text>
          <Text style={styles.scoreLabel}>Health</Text>
        </View>

        <View style={styles.headerTexts}>
          <Text style={styles.headerTitle}>{tunnelName}</Text>
          <Text style={styles.headerSubtitle}>
            {stats.totalPlants
              ? `${stats.totalPlants} plants • ${stats.scanned} scanned • ${stats.affected} affected`
              : "No tunnel layout yet"}
          </Text>

          <View style={[styles.statusBadge, { backgroundColor: stats.affected ? "#FFF3E0" : "#E8F5E9" }]}>
            <View style={[styles.statusDot, { backgroundColor: stats.affected ? "#EF6C00" : "#2E7D32" }]} />
            <Text style={[styles.statusText, { color: stats.affected ? "#EF6C00" : "#2E7D32" }]}>
              {stats.affected ? "Monitoring Alerts" : "Stable Condition"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.dataStrip}>
        <View style={styles.dataItem}>
          <Text style={styles.dataNumber}>{stats.scans}</Text>
          <Text style={styles.dataLabel}>Capture scans</Text>
        </View>
        <View style={styles.dataDivider} />
        <View style={styles.dataItem}>
          <Text style={styles.dataNumber}>{stats.leafCount}</Text>
          <Text style={styles.dataLabel}>Leaves detected</Text>
        </View>
        <View style={styles.dataDivider} />
        <View style={styles.dataItem}>
          <Text style={styles.dataNumber}>{stats.healthy}</Text>
          <Text style={styles.dataLabel}>Healthy plants</Text>
        </View>
      </View>

      <SectionTitle title="Disease & Stress Overview" />

      <View style={styles.grid}>
        {cards.map((card) => (
          <View key={card.title} style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: card.bg }]}>
              <Ionicons name={card.icon as any} size={24} color={card.color} />
            </View>

            <View>
              <Text style={styles.cardStatus}>{card.status}</Text>
              <Text style={styles.cardTitle}>{card.title}</Text>
            </View>
          </View>
        ))}
      </View>

      <SectionTitle title="Latest Affected Plants" />

      {latestAffected.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="shield-checkmark-outline" size={28} color="#2E7D32" />
          <Text style={styles.emptyTitle}>No active disease or stress detected</Text>
          <Text style={styles.emptySub}>Latest plant outputs are healthy or no scans have been saved yet.</Text>
        </View>
      ) : (
        <View style={styles.affectedList}>
          {latestAffected.map((item) => (
            <TouchableOpacity
              key={item.plantId}
              activeOpacity={0.85}
              style={styles.affectedCard}
              onPress={goToFeed}
            >
              <View style={[styles.affectedIcon, { backgroundColor: diseaseBg(item.diseases[0]) }]}>
                <Ionicons
                  name={item.waterStressAlert ? "water-outline" : "leaf-outline"}
                  size={20}
                  color={diseaseColor(item.diseases[0])}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.affectedTitle}>{item.plantTitle}</Text>
                <Text style={styles.affectedSub}>
                  {item.diseases.length
                    ? item.diseases.map(niceDiseaseName).join(" • ")
                    : statusText(item.status)}
                </Text>
                <Text style={styles.affectedMeta}>
                  {item.counts.leaf} leaves • {timeAgo(item.updatedAtMs || item.createdAtMs)}
                </Text>
                {item.diseases[0] ? (
                  <Text style={styles.affectedSeverity} numberOfLines={1}>
                    {severityText(item.diseaseSeverity, item.diseases[0])}
                  </Text>
                ) : null}
              </View>

              <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.ctaCard} activeOpacity={0.9} onPress={goToFeed}>
        <View style={styles.ctaIconBox}>
          <Ionicons name="map-outline" size={28} color="#fff" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>Open Plant Detection Map</Text>
          <Text style={styles.ctaSub}>Tap a plant to view downy mildew, powdery mildew, water stress, severity, pump status and scans.</Text>
        </View>

        <Ionicons name="chevron-forward" size={24} color="#fff" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#FAFAFA",
    flexGrow: 1,
    paddingBottom: 28,
  },
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 28,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  scoreCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 18,
    backgroundColor: "#fff",
  },
  scoreValue: { fontSize: 30, fontWeight: "900" },
  scoreLabel: {
    fontSize: 10,
    color: "#78909C",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  headerTexts: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#212121", marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: "#757575", marginBottom: 8, lineHeight: 18 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: "800" },
  dataStrip: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingVertical: 16,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  dataItem: { flex: 1, alignItems: "center" },
  dataNumber: { fontSize: 20, fontWeight: "900", color: "#263238" },
  dataLabel: { fontSize: 11, color: "#78909C", fontWeight: "700", marginTop: 3 },
  dataDivider: { width: 1, backgroundColor: "#EEEEEE" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
    marginBottom: 24,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 16,
    height: 152,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#F1F1F1",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardStatus: { fontSize: 14, fontWeight: "900", color: "#263238", marginBottom: 6 },
  cardTitle: { fontSize: 13, fontWeight: "800", color: "#90A4AE" },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: { marginTop: 8, fontSize: 15, fontWeight: "900", color: "#263238" },
  emptySub: { marginTop: 4, fontSize: 12, color: "#78909C", textAlign: "center", lineHeight: 17 },
  affectedList: { gap: 10, marginBottom: 24 },
  affectedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  affectedIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  affectedTitle: { fontSize: 15, fontWeight: "900", color: "#212121" },
  affectedSub: { fontSize: 12, fontWeight: "800", color: "#616161", marginTop: 2 },
  affectedMeta: { fontSize: 11, color: "#90A4AE", marginTop: 2, fontWeight: "700" },
  affectedSeverity: { fontSize: 11, color: "#757575", marginTop: 3 },
  ctaCard: {
    backgroundColor: "#2E7D32",
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  ctaTitle: { color: "#fff", fontSize: 17, fontWeight: "900" },
  ctaSub: { color: "#E8F5E9", fontSize: 12, marginTop: 4, lineHeight: 17 },
});
