import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { LinearGradient } from "expo-linear-gradient";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnel } from "../../context/TunnelContext";

const { width } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2;

type PlantDoc = {
  id: string;
  row: number;
  column: number;
  lastDiseases?: string[];
  lastSprayRecommended?: boolean;
  lastScanAt?: any;
};

function normalizeDiseaseName(x: string) {
  const v = (x || "").toLowerCase().trim();
  // ✅ handle your common dataset typo
  if (v === "downey_mildew") return "downy_mildew";
  return v;
}

function riskLabel(count: number, total: number) {
  if (total <= 0) return "N/A";
  if (count === 0) return "None";
  const pct = (count / total) * 100;
  if (pct <= 2) return "Low";
  if (pct <= 8) return "Moderate";
  return "High";
}

export default function DiseaseDashboardScreen({ navigation }: any) {
  useTunnelHeader("Disease & Stress");
  const { selectedTunnel } = useTunnel();

  const tunnelId = selectedTunnel?.id ?? "";
  const totalPlants = (selectedTunnel?.rows ?? 0) * (selectedTunnel?.columns ?? 0);

  const [plants, setPlants] = useState<PlantDoc[]>([]);

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

  const stats = useMemo(() => {
    let downy = 0;
    let powdery = 0;
    let stress = 0;
    let affected = 0;
    let spray = 0;

    for (const p of plants) {
      const diseases = (p.lastDiseases ?? []).map(normalizeDiseaseName);
      const hasAnyDisease = diseases.length > 0;

      if (diseases.includes("downy_mildew")) downy++;
      if (diseases.includes("powdery_mildew")) powdery++;
      if (diseases.includes("water_stress")) stress++;

      if (p.lastSprayRecommended) spray++;

      // ✅ affected if disease list exists OR spray recommended (some runs may not populate lastDiseases)
      if (hasAnyDisease || !!p.lastSprayRecommended) affected++;
    }

    const healthPct = totalPlants > 0 ? Math.round(((totalPlants - affected) / totalPlants) * 100) : 0;

    return { downy, powdery, stress, affected, spray, healthPct };
  }, [plants, totalPlants]);

  const metrics = [
    {
      title: "Downy Mildew",
      status: `${riskLabel(stats.downy, totalPlants)} • ${stats.downy} plants`,
      icon: "leaf",
      color: stats.downy ? "#D32F2F" : "#2E7D32",
      bg: stats.downy ? "#FFEBEE" : "#E8F5E9",
    },
    {
      title: "Powdery Mildew",
      status: `${riskLabel(stats.powdery, totalPlants)} • ${stats.powdery} plants`,
      icon: "snow",
      color: stats.powdery ? "#7B1FA2" : "#2E7D32",
      bg: stats.powdery ? "#F3E5F5" : "#E8F5E9",
    },
    {
      title: "Water Stress",
      status: `${riskLabel(stats.stress, totalPlants)} • ${stats.stress} plants`,
      icon: "water",
      color: stats.stress ? "#EF6C00" : "#2E7D32",
      bg: stats.stress ? "#FFF3E0" : "#E8F5E9",
    },
    {
      title: "Spray Needed",
      status: `${stats.spray} scans`,
      icon: "alert-circle",
      color: stats.spray ? "#1565C0" : "#2E7D32",
      bg: stats.spray ? "#E3F2FD" : "#E8F5E9",
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.scoreContainer}>
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreValue}>
            {stats.healthPct}
            <Text style={{ fontSize: 14 }}>%</Text>
          </Text>
          <Text style={styles.scoreLabel}>Health</Text>
        </View>

        <View style={styles.headerTexts}>
          <Text style={styles.headerTitle}>{selectedTunnel?.tunnelName ?? selectedTunnel?.name ?? "Select a tunnel"}</Text>

          <Text style={styles.headerSubtitle}>
            {totalPlants ? `${totalPlants} plants • ${stats.affected} affected` : "No layout yet"}
          </Text>

          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: stats.affected ? "#FB8C00" : "#2E7D32" }]} />
            <Text style={styles.statusText}>{stats.affected ? "Monitoring Alerts" : "Stable Condition"}</Text>
          </View>
        </View>
      </View>

      <SectionTitle title="Real-time Metrics" />
      <View style={styles.grid}>
        {metrics.map((m, index) => (
          <View key={index} style={[styles.card, { width: CARD_WIDTH }]}>
            <View style={[styles.iconContainer, { backgroundColor: m.bg }]}>
              <Ionicons name={m.icon as any} size={28} color={m.color} />
            </View>
            <View>
              <Text style={styles.cardStatus}>{m.status}</Text>
              <Text style={styles.cardTitle}>{m.title}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.ctaSection}>
        <SectionTitle title="Visual Detection" />
        <TouchableOpacity
          style={styles.mapCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("DetectionFeed")}
        >
          <LinearGradient
            colors={["#66BB6A", "#2E7D32"]}
            style={styles.mapBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.mapContent}>
              <View style={styles.mapIconBox}>
                <Ionicons name="scan" size={32} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mapTitle}>Tunnel Map</Text>
                <Text style={styles.mapSubtitle}>Tap a plant to see latest scan</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#E8F5E9" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#FAFAFA", flexGrow: 1 },

  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 28,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#E0F2F1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 20,
  },
  scoreValue: { fontSize: 28, fontWeight: "800", color: "#00695C" },
  scoreLabel: { fontSize: 10, color: "#80CBC4", fontWeight: "700", textTransform: "uppercase" },
  headerTexts: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#212121", marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: "#757575", marginBottom: 8 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: "700", color: "#2E7D32" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP, marginBottom: 32 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 16,
    height: 160,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  iconContainer: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cardStatus: { fontSize: 14, fontWeight: "800", color: "#263238", marginBottom: 6 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#90A4AE" },

  ctaSection: { marginTop: 0 },
  mapCard: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  mapBackground: { padding: 24 },
  mapContent: { flexDirection: "row", alignItems: "center", gap: 16 },
  mapIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  mapSubtitle: { fontSize: 13, color: "#E8F5E9", marginTop: 4 },
});