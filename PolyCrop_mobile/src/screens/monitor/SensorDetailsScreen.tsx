// src/screens/monitor/SensorDetailsScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";

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

type Level = "OK" | "WARN" | "FAULT";

export default function SensorDetailsScreen({ route }: any) {
  const { title, sensorId } = route.params;
  const navigation = useNavigation();
  const { selectedTunnel } = useTunnel();

  const tunnelId = selectedTunnel?.id ?? "";
  const tunnelName = selectedTunnel?.name ?? "N/A";

  const [filter, setFilter] = useState<"Day" | "Month" | "Year">("Day");
  const limitN = filter === "Day" ? 24 : filter === "Month" ? 120 : 240;

  const isHumidity =
    (sensorId ?? "").toLowerCase().includes("hum") || (title ?? "").toLowerCase().includes("humidity");
  const unit = isHumidity ? "%" : "°C";

  const [summary, setSummary] = useState<any>(null);
  const [readings, setReadings] = useState<any[]>([]);
  const [banner, setBanner] = useState<{ level: Level; msg: string } | null>(null);

  // live summary
  useEffect(() => {
    if (!tunnelId) {
      setSummary(null);
      return;
    }
    return onSnapshot(doc(db, "tunnels", tunnelId, "sensorSummary", "latest"), (snap) => {
      setSummary(snap.exists() ? snap.data() : null);
    });
  }, [tunnelId]);

  // readings
  useEffect(() => {
    if (!tunnelId) {
      setReadings([]);
      return;
    }
    const q = query(collection(db, "tunnels", tunnelId, "loraReadings"), orderBy("ts", "desc"), limit(limitN));
    return onSnapshot(
      q,
      (snap) => setReadings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).reverse()),
      (err) => {
        console.log("SensorDetails loraReadings error:", err);
        setReadings([]);
      }
    );
  }, [tunnelId, limitN]);

  // banner
  useEffect(() => {
    if (!tunnelId) {
      setBanner({ level: "FAULT", msg: "No tunnel selected." });
      return;
    }
    const lastSeenMs = tsToMs(summary?.lastSeenAt);
    if (!lastSeenMs) {
      setBanner({ level: "FAULT", msg: "No LoRa data yet. Assign gateway to this tunnel." });
      return;
    }
    if (Date.now() - lastSeenMs > 60_000) {
      setBanner({ level: "FAULT", msg: "LoRa timeout: no updates > 60 seconds." });
      return;
    }
    const lvl: Level = (summary?.an_level as Level) || "OK";
    const msg: string = summary?.an_message || "";
    if (lvl === "OK") setBanner(null);
    else setBanner({ level: lvl, msg: msg || (lvl === "FAULT" ? "Sensor fault detected." : "Sensor warning.") });
  }, [summary?.lastSeenAt, summary?.an_level, summary?.an_message, tunnelId]);

  // values
  const s1 = isHumidity ? summary?.s1_hum : summary?.s1_temp;
  const s2 = isHumidity ? summary?.s2_hum : summary?.s2_temp;
  const avg = isHumidity ? summary?.avg_hum : summary?.avg_temp;

  // anomaly details
  const diff = isHumidity ? summary?.an_humDiff : summary?.an_tempDiff;
  const mismatch = isHumidity ? summary?.an_humMismatch : summary?.an_tempMismatch;

  const s1Valid = isHumidity ? summary?.an_s1_hum_valid : summary?.an_s1_temp_valid;
  const s2Valid = isHumidity ? summary?.an_s2_hum_valid : summary?.an_s2_temp_valid;

  // connectivity
  const gatewayId = summary?.gatewayId ?? "N/A";
  const counter = summary?.counter ?? "—";
  const rssi = summary?.rssi ?? null;
  const snr = summary?.snr ?? null;
  const lastSeenAtMs = tsToMs(summary?.lastSeenAt);
  const online = lastSeenAtMs ? Date.now() - lastSeenAtMs < 60_000 : false;

  const labels = useMemo(() => readings.map((r: any, idx: number) => (idx % 4 === 0 ? fmtTime(r.ts) : "")), [readings]);
  const avgSeries = useMemo(
    () => readings.map((r: any) => Number((isHumidity ? r.avg_hum : r.avg_temp) ?? 0)),
    [readings, isHumidity]
  );

  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
    labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,
    strokeWidth: 2,
    decimalPlaces: 1,
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#fff" },
  };

  const bannerColors =
    banner?.level === "FAULT"
      ? ["#FFEBEE", "#FFCDD2"]
      : banner?.level === "WARN"
      ? ["#FFF8E1", "#FFECB3"]
      : ["#E8F5E9", "#C8E6C9"];

  const bannerIconColor = banner?.level === "FAULT" ? "#D32F2F" : "#FB8C00";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Tunnel: {tunnelName}</Text>
        </View>
      </View>

      {/* Banner */}
      {banner && (
        <View style={styles.anomalyBanner}>
          <LinearGradient colors={bannerColors as any} style={styles.anomalyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={styles.anomalyContent}>
              <View style={styles.anomalyIcon}>
                <Ionicons name="warning" size={24} color={bannerIconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.anomalyTitle}>{banner.level === "FAULT" ? "Fault" : "Warning"}</Text>
                <Text style={styles.anomalyText}>{banner.msg}</Text>
              </View>
              <TouchableOpacity onPress={() => setBanner(null)}>
                <Ionicons name="close" size={20} color={bannerIconColor} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        {(["Day", "Month", "Year"] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, filter === t && styles.activeTab]} onPress={() => setFilter(t)}>
            <Text style={[styles.tabText, filter === t && styles.activeTabText]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Live Readings */}
      <SectionTitle title="Live Readings" />
      <View style={styles.liveRow}>
        <View style={[styles.liveCard, s1Valid === false && styles.liveCardBad]}>
          <Text style={styles.liveLabel}>Sensor 1</Text>
          <Text style={styles.liveValue}>{s1 != null ? `${Number(s1).toFixed(1)}${unit}` : "—"}</Text>
          <Text style={styles.liveHint}>{s1Valid === false ? "INVALID" : "OK"}</Text>
        </View>

        <View style={[styles.liveCard, s2Valid === false && styles.liveCardBad]}>
          <Text style={styles.liveLabel}>Sensor 2</Text>
          <Text style={styles.liveValue}>{s2 != null ? `${Number(s2).toFixed(1)}${unit}` : "—"}</Text>
          <Text style={styles.liveHint}>{s2Valid === false ? "INVALID" : "OK"}</Text>
        </View>

        <View style={[styles.liveCard, { backgroundColor: "#F1F8E9" }]}>
          <Text style={styles.liveLabel}>Average</Text>
          <Text style={[styles.liveValue, { color: "#2E7D32" }]}>{avg != null ? `${Number(avg).toFixed(1)}${unit}` : "—"}</Text>
          <Text style={[styles.liveHint, { color: "#2E7D32" }]}>AVG</Text>
        </View>
      </View>

      {/* Mismatch Info */}
      <SectionTitle title="Sensor Comparison" />
      <View style={styles.specContainer}>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Mismatch</Text>
          <Text style={[styles.specValue, mismatch ? { color: "#FB8C00" } : { color: "#2E7D32" }]}>
            {mismatch ? "YES" : "NO"}
          </Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Difference</Text>
          <Text style={styles.specValue}>
            {diff != null ? `${Number(diff).toFixed(2)}${unit}` : "N/A"}
          </Text>
        </View>
      </View>

      {/* Chart (Average) */}
      <Card>
        <Text style={styles.sectionHeader}>{filter} Trend (Average)</Text>
        <LineChart
          data={{ labels, datasets: [{ data: avgSeries.length ? avgSeries : [0] }] }}
          width={screenWidth - 48}
          height={240}
          chartConfig={{ ...chartConfig, color: (opacity = 1) => (isHumidity ? `rgba(2,136,209,${opacity})` : `rgba(239,108,0,${opacity})`) }}
          bezier
          style={{ borderRadius: 16 }}
        />
        <Text style={styles.chartNote}>Showing last {limitN} readings</Text>
      </Card>

      {/* LoRa Connectivity */}
      <SectionTitle title="LoRa Connectivity" />
      <View style={styles.specContainer}>
        <View style={styles.specRow}><Text style={styles.specLabel}>Gateway</Text><Text style={styles.specValue}>{gatewayId}</Text></View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Status</Text>
          <Text style={[styles.specValue, online ? { color: "#2E7D32" } : { color: "#D32F2F" }]}>
            {online ? "ONLINE" : "OFFLINE"}
          </Text>
        </View>
        <View style={styles.specRow}><Text style={styles.specLabel}>Counter</Text><Text style={styles.specValue}>{counter}</Text></View>
        <View style={styles.specRow}><Text style={styles.specLabel}>RSSI</Text><Text style={styles.specValue}>{rssi != null ? `${rssi} dBm` : "N/A"}</Text></View>
        <View style={styles.specRow}><Text style={styles.specLabel}>SNR</Text><Text style={styles.specValue}>{snr != null ? `${Number(snr).toFixed(1)} dB` : "N/A"}</Text></View>
        <View style={styles.specRow}><Text style={styles.specLabel}>Last Seen</Text><Text style={styles.specValue}>{lastSeenAtMs ? new Date(lastSeenAtMs).toLocaleString() : "N/A"}</Text></View>
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

  anomalyBanner: { marginBottom: 16, borderRadius: 16, overflow: "hidden", elevation: 2 },
  anomalyGradient: { padding: 14 },
  anomalyContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  anomalyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.6)", alignItems: "center", justifyContent: "center" },
  anomalyTitle: { fontSize: 15, fontWeight: "900", color: "#333" },
  anomalyText: { fontSize: 13, color: "#555", marginTop: 2 },

  tabContainer: { flexDirection: "row", backgroundColor: "#E0E0E0", borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  activeTab: { backgroundColor: "#fff", elevation: 2 },
  tabText: { fontWeight: "600", color: "#757575" },
  activeTabText: { color: "#1B5E20", fontWeight: "800" },

  liveRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  liveCard: { flex: 1, backgroundColor: "#fff", padding: 14, borderRadius: 16, elevation: 1, alignItems: "center" },
  liveCardBad: { borderWidth: 1, borderColor: "#D32F2F" },
  liveLabel: { fontSize: 12, color: "#888", marginBottom: 6, fontWeight: "700" },
  liveValue: { fontSize: 18, fontWeight: "900", color: "#333" },
  liveHint: { marginTop: 6, fontSize: 11, fontWeight: "900", color: "#757575" },

  sectionHeader: { fontSize: 16, fontWeight: "800", marginBottom: 12, color: "#444" },
  chartNote: { marginTop: 10, color: "#757575", fontSize: 12, fontWeight: "600" },

  specContainer: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16 },
  specRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  specLabel: { color: "#666", fontSize: 14, fontWeight: "700" },
  specValue: { fontWeight: "900", color: "#333", fontSize: 14 },
});