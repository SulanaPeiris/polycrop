import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

const screenWidth = Dimensions.get("window").width;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return 0;
}

function fmtTime(ts: any) {
  const ms = tsToMs(ts);
  if (!ms) return "";
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function MonitorScreen() {
  const { selectedTunnel } = useTunnel();
  useTunnelHeader("Monitor");
  const navigation = useNavigation<NavigationProp>();

  const tunnelId = selectedTunnel?.id ?? "";

  const [summary, setSummary] = useState<any>(null);
  const [readings, setReadings] = useState<any[]>([]);
  const [fault, setFault] = useState<string | null>(null);

  // ✅ live summary (fast UI)
  useEffect(() => {
    if (!tunnelId) {
      setSummary(null);
      return;
    }
    return onSnapshot(
      doc(db, "tunnels", tunnelId, "sensorSummary", "latest"),
      (snap) => setSummary(snap.exists() ? snap.data() : null),
      (err) => {
        console.log("sensorSummary listener error:", err);
        setSummary(null);
      }
    );
  }, [tunnelId]);

  // ✅ last 24 readings for charts
  useEffect(() => {
    if (!tunnelId) {
      setReadings([]);
      return;
    }
    const q = query(
      collection(db, "tunnels", tunnelId, "loraReadings"),
      orderBy("ts", "desc"),
      limit(24)
    );
    return onSnapshot(
      q,
      (snap) => setReadings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).reverse()),
      (err) => {
        console.log("loraReadings listener error:", err);
        setReadings([]);
      }
    );
  }, [tunnelId]);

  // ✅ fault detection if no updates
  useEffect(() => {
    const lastSeenMs = tsToMs(summary?.lastSeenAt);
    if (!tunnelId) {
      setFault("No tunnel selected.");
      return;
    }
    if (!lastSeenMs) {
      setFault("No LoRa data yet. Assign receiver gateway to this tunnel.");
      return;
    }
    const diff = Date.now() - lastSeenMs;
    setFault(diff > 60_000 ? "LoRa data timeout (no updates > 60s)" : null);
  }, [summary?.lastSeenAt, tunnelId]);

  const avgTemp = summary?.avg_temp ?? null;
  const avgHum = summary?.avg_hum ?? null;

  const labels = useMemo(() => {
    if (!readings.length) return [];
    return readings.map((r, idx) => (idx % 4 === 0 ? fmtTime(r.ts) : ""));
  }, [readings]);

  const tempSeries = useMemo(() => readings.map((r) => Number(r.avg_temp ?? 0)), [readings]);
  const humSeries = useMemo(() => readings.map((r) => Number(r.avg_hum ?? 0)), [readings]);

  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    strokeWidth: 2,
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#fff" },
  };

  const navigateToDetail = (title: string, sensorId: string) => {
    navigation.navigate("SensorDetails", { title, sensorId });
  };

  // simple status tag
  const tempStatus = avgTemp == null ? "—" : avgTemp >= 18 && avgTemp <= 30 ? "Optimal" : "Attention";
  const humStatus = avgHum == null ? "—" : avgHum >= 50 && avgHum <= 85 ? "Good" : "Attention";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 1. Sensor Fault Alert */}
      {fault && (
        <View style={styles.anomalyBanner}>
          <LinearGradient
            colors={["#FFEBEE", "#FFCDD2"]}
            style={styles.anomalyGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.anomalyContent}>
              <View style={styles.anomalyIcon}>
                <Ionicons name="warning" size={24} color="#D32F2F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.anomalyTitle}>Sensor Fault Detected!</Text>
                <Text style={styles.anomalyText}>{fault}</Text>
                <TouchableOpacity onPress={() => navigateToDetail("Sensor Fault", "fault-001")}>
                  <Text style={styles.actionText}>View Technical Details →</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setFault(null)}>
                <Ionicons name="close" size={20} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* 2. Live Sensors Grid */}
      <SectionTitle title="Live Sensors" />
      <View style={styles.grid}>
        {/* Temperature */}
        <TouchableOpacity style={styles.sensorCard} activeOpacity={0.9} onPress={() => navigateToDetail("Temperature Sensor", "temp-001")}>
          <View style={[styles.iconCircle, { backgroundColor: "#FFF3E0" }]}>
            <Ionicons name="thermometer-outline" size={28} color="#EF6C00" />
          </View>
          <View>
            <Text style={styles.sensorValue}>{avgTemp != null ? `${avgTemp.toFixed(1)}°C` : "—"}</Text>
            <Text style={styles.sensorLabel}>Temperature (Avg)</Text>
          </View>
          <View style={styles.statusTag}>
            <Text style={styles.statusText}>{tempStatus}</Text>
          </View>
        </TouchableOpacity>

        {/* Humidity */}
        <TouchableOpacity style={styles.sensorCard} activeOpacity={0.9} onPress={() => navigateToDetail("Humidity Sensor", "hum-001")}>
          <View style={[styles.iconCircle, { backgroundColor: "#E1F5FE" }]}>
            <Ionicons name="water-outline" size={28} color="#0288D1" />
          </View>
          <View>
            <Text style={styles.sensorValue}>{avgHum != null ? `${avgHum.toFixed(1)}%` : "—"}</Text>
            <Text style={styles.sensorLabel}>Humidity (Avg)</Text>
          </View>
          <View style={[styles.statusTag, { backgroundColor: "#E1F5FE" }]}>
            <Text style={[styles.statusText, { color: "#0288D1" }]}>{humStatus}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 3. Analytics Charts */}
      <SectionTitle title="24 readings Trends" />

      <Card>
        <Text style={styles.chartTitle}>Temperature Trend</Text>
        <LineChart
          data={{ labels, datasets: [{ data: tempSeries.length ? tempSeries : [0] }] }}
          width={screenWidth - 64}
          height={220}
          chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(239, 108, 0, ${opacity})` }}
          bezier
          style={styles.chart}
        />
      </Card>

      <Card>
        <Text style={styles.chartTitle}>Humidity Trend</Text>
        <LineChart
          data={{ labels, datasets: [{ data: humSeries.length ? humSeries : [0] }] }}
          width={screenWidth - 64}
          height={220}
          chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(2, 136, 209, ${opacity})` }}
          bezier
          style={styles.chart}
        />
      </Card>
<SectionTitle title="LoRa / Gateways" />

<TouchableOpacity
  style={styles.zoneBtn}
  onPress={() => navigation.navigate("ZoneNodes")}
  activeOpacity={0.85}
>
  <Ionicons name="git-network-outline" size={22} color="#2E7D32" />
  <View style={{ flex: 1 }}>
    <Text style={styles.zoneBtnTitle}>Zones / Nodes</Text>
    <Text style={styles.zoneBtnSub}>Assign LoRa receiver gateway to this tunnel</Text>
  </View>
  <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
</TouchableOpacity>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 10 },

  anomalyBanner: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#D32F2F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  anomalyGradient: { padding: 16 },
  anomalyContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  anomalyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  anomalyTitle: { fontSize: 16, fontWeight: "800", color: "#B71C1C" },
  anomalyText: { fontSize: 14, color: "#C62828", marginTop: 2 },
  actionText: { fontSize: 14, fontWeight: "700", color: "#B71C1C", marginTop: 8, textDecorationLine: "underline" },

  grid: { flexDirection: "row", gap: 12, marginBottom: 24 },
  sensorCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    alignItems: "flex-start",
    justifyContent: "space-between",
    height: 160,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  sensorValue: { fontSize: 28, fontWeight: "800", color: "#212121" },
  sensorLabel: { fontSize: 14, color: "#757575", fontWeight: "600" },
  statusTag: { position: "absolute", top: 16, right: 16, backgroundColor: "#FFF3E0", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: "700", color: "#EF6C00" },

  chartTitle: { fontSize: 18, fontWeight: "700", color: "#37474F", marginBottom: 16 },
  chart: { marginVertical: 8, borderRadius: 16 },

  zoneBtn: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  backgroundColor: "#fff",
  padding: 16,
  borderRadius: 18,
  elevation: 1,
  marginBottom: 20,
},
zoneBtnTitle: { fontSize: 15, fontWeight: "800", color: "#333" },
zoneBtnSub: { fontSize: 12, color: "#757575", marginTop: 2, fontWeight: "600" },
});