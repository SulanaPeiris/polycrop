import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { useNavigation } from "@react-navigation/native";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { useTunnel } from "../../context/TunnelContext";
import { db } from "../../firebase/firebase";

const screenWidth = Dimensions.get("window").width;

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

export default function SensorDetailsScreen({ route }: any) {
  const { title, sensorId } = route.params;
  const navigation = useNavigation();
  const { selectedTunnel } = useTunnel();

  const tunnelId = selectedTunnel?.id ?? "";
  const tunnelName = selectedTunnel?.name ?? "N/A";

  // "Day" | "Month" | "Year"
  const [filter, setFilter] = useState<"Day" | "Month" | "Year">("Day");

  const isHumidity = (sensorId ?? "").toLowerCase().includes("hum") || (title ?? "").toLowerCase().includes("humidity");
  const unit = isHumidity ? "%" : "°C";

  const [summary, setSummary] = useState<any>(null);
  const [readings, setReadings] = useState<any[]>([]);

  // ✅ live summary
  useEffect(() => {
    if (!tunnelId) {
      setSummary(null);
      return;
    }
    return onSnapshot(doc(db, "tunnels", tunnelId, "sensorSummary", "latest"), (snap) => {
      setSummary(snap.exists() ? snap.data() : null);
    });
  }, [tunnelId]);

  // ✅ readings based on filter
  const limitN = filter === "Day" ? 24 : filter === "Month" ? 120 : 240;

  useEffect(() => {
    if (!tunnelId) {
      setReadings([]);
      return;
    }
    const q = query(
      collection(db, "tunnels", tunnelId, "loraReadings"),
      orderBy("ts", "desc"),
      limit(limitN)
    );

    return onSnapshot(
      q,
      (snap) => setReadings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).reverse()),
      (err) => {
        console.log("SensorDetails loraReadings error:", err);
        setReadings([]);
      }
    );
  }, [tunnelId, limitN]);

  // values from summary (live)
  const s1 = isHumidity ? summary?.s1_hum : summary?.s1_temp;
  const s2 = isHumidity ? summary?.s2_hum : summary?.s2_temp;
  const avg = isHumidity ? summary?.avg_hum : summary?.avg_temp;

  // connectivity
  const gatewayId = summary?.gatewayId ?? "N/A";
  const counter = summary?.counter ?? "—";
  const rssi = summary?.rssi ?? null;
  const snr = summary?.snr ?? null;
  const lastSeenAtMs = tsToMs(summary?.lastSeenAt);
  const online = lastSeenAtMs ? Date.now() - lastSeenAtMs < 60_000 : false;

  // chart series
  const s1Series = useMemo(
    () => readings.map((r) => Number((isHumidity ? r.s1_hum : r.s1_temp) ?? 0)),
    [readings, isHumidity]
  );
  const s2Series = useMemo(
    () => readings.map((r) => Number((isHumidity ? r.s2_hum : r.s2_temp) ?? 0)),
    [readings, isHumidity]
  );
  const avgSeries = useMemo(
    () => readings.map((r) => Number((isHumidity ? r.avg_hum : r.avg_temp) ?? 0)),
    [readings, isHumidity]
  );

  const labels = useMemo(() => readings.map((r: any, idx: number) => (idx % 4 === 0 ? fmtTime(r.ts) : "")), [readings]);

  const stats = useMemo(() => {
    const arr = avgSeries.filter((n) => Number.isFinite(n));
    if (!arr.length) return { avg: 0, min: 0, max: 0 };
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { avg: mean, min, max };
  }, [avgSeries]);

  const getColor = (opacity = 1) => {
    if (isHumidity) return `rgba(2, 136, 209, ${opacity})`;
    return `rgba(239, 108, 0, ${opacity})`;
  };

  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
    labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,
    strokeWidth: 2,
    decimalPlaces: 1,
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#fff" },
  };

  const chartData = {
    labels,
    datasets: [
      {
        data: s1Series.length ? s1Series : [0],
        color: (opacity = 1) => getColor(opacity),
        strokeWidth: 2,
      },
      {
        data: s2Series.length ? s2Series : [0],
        color: (opacity = 1) => (isHumidity ? `rgba(3, 169, 244, ${opacity})` : `rgba(255, 193, 7, ${opacity})`),
        strokeWidth: 2,
      },
      {
        data: avgSeries.length ? avgSeries : [0],
        color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
        strokeWidth: 3,
      },
    ],
    legend: ["Sensor 1", "Sensor 2", "Average"],
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            Tunnel: {tunnelName} • ID: {(sensorId ?? "sensor").toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Time Filter Tabs */}
      <View style={styles.tabContainer}>
        {(["Day", "Month", "Year"] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, filter === t && styles.activeTab]} onPress={() => setFilter(t)}>
            <Text style={[styles.tabText, filter === t && styles.activeTabText]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Live Values (two sensors + avg) */}
      <SectionTitle title="Live Readings" />
      <View style={styles.liveRow}>
        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>Sensor 1</Text>
          <Text style={styles.liveValue}>{s1 != null ? `${Number(s1).toFixed(1)}${unit}` : "—"}</Text>
        </View>
        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>Sensor 2</Text>
          <Text style={styles.liveValue}>{s2 != null ? `${Number(s2).toFixed(1)}${unit}` : "—"}</Text>
        </View>
        <View style={[styles.liveCard, { backgroundColor: "#F1F8E9" }]}>
          <Text style={styles.liveLabel}>Average</Text>
          <Text style={[styles.liveValue, { color: "#2E7D32" }]}>{avg != null ? `${Number(avg).toFixed(1)}${unit}` : "—"}</Text>
        </View>
      </View>

      {/* Main Chart */}
      <Card>
        <Text style={styles.sectionHeader}>{filter} Overview</Text>
        <LineChart data={chartData} width={screenWidth - 48} height={240} chartConfig={chartConfig} bezier style={{ borderRadius: 16 }} />
        <Text style={styles.chartNote}>Showing last {limitN} readings (approx.)</Text>
      </Card>

      {/* Report Summary */}
      <SectionTitle title="Report Summary (Average Series)" />
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Average</Text>
          <Text style={styles.statValue}>{stats.avg.toFixed(1)}{unit}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>{stats.min.toFixed(1)}{unit}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>{stats.max.toFixed(1)}{unit}</Text>
        </View>
      </View>

      {/* Technical Details (LoRa Connectivity) */}
      <SectionTitle title="LoRa Connectivity & Details" />
      <View style={styles.specContainer}>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Gateway ID</Text>
          <Text style={styles.specValue}>{gatewayId}</Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Status</Text>
          <Text style={[styles.specValue, online ? { color: "#2E7D32" } : { color: "#D32F2F" }]}>
            {online ? "ONLINE" : "OFFLINE"}
          </Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Packet Counter</Text>
          <Text style={styles.specValue}>{counter}</Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>RSSI</Text>
          <Text style={styles.specValue}>{rssi != null ? `${rssi} dBm` : "N/A"}</Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>SNR</Text>
          <Text style={styles.specValue}>{snr != null ? `${Number(snr).toFixed(1)} dB` : "N/A"}</Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Last Seen</Text>
          <Text style={styles.specValue}>{lastSeenAtMs ? new Date(lastSeenAtMs).toLocaleString() : "N/A"}</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F5F5F5", flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backButton: { marginRight: 16, padding: 8, backgroundColor: "#fff", borderRadius: 12 },
  title: { fontSize: 22, fontWeight: "800", color: "#1B5E20" },
  subtitle: { fontSize: 12, color: "#666", fontWeight: "600", marginTop: 2 },

  tabContainer: { flexDirection: "row", backgroundColor: "#E0E0E0", borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  activeTab: { backgroundColor: "#fff", elevation: 2 },
  tabText: { fontWeight: "600", color: "#757575" },
  activeTabText: { color: "#1B5E20", fontWeight: "800" },

  liveRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  liveCard: { flex: 1, backgroundColor: "#fff", padding: 14, borderRadius: 16, elevation: 1, alignItems: "center" },
  liveLabel: { fontSize: 12, color: "#888", marginBottom: 6, fontWeight: "700" },
  liveValue: { fontSize: 18, fontWeight: "900", color: "#333" },

  sectionHeader: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#444" },
  chartNote: { marginTop: 10, color: "#757575", fontSize: 12, fontWeight: "600" },

  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: "#fff", padding: 16, borderRadius: 16, alignItems: "center", elevation: 1 },
  statLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#333" },

  specContainer: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 24 },
  specRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  specLabel: { color: "#666", fontSize: 15 },
  specValue: { fontWeight: "700", color: "#333", fontSize: 15 },
});