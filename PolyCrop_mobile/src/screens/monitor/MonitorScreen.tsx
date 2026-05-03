// src/screens/monitor/MonitorScreen.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { createSensorFaultAlert } from "../../services/sensorFaultAlertService";

const screenWidth = Dimensions.get("window").width;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Level = "OK" | "WARN" | "FAULT";

function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts === "string") {
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
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

function safeNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function MonitorScreen() {
  const { selectedTunnel } = useTunnel();
  useTunnelHeader("Monitor");

  const navigation = useNavigation<NavigationProp>();

  const tunnelId = selectedTunnel?.id ?? "";

  const [summary, setSummary] = useState<any>(null);
  const [readings, setReadings] = useState<any[]>([]);
  const [banner, setBanner] = useState<{ level: Level; msg: string } | null>(
    null
  );

  const lastPopupKeyRef = useRef("");

  // live summary
  useEffect(() => {
    if (!tunnelId) {
      setSummary(null);
      return;
    }

    return onSnapshot(
      doc(db, "tunnels", tunnelId, "sensorSummary", "latest"),
      (snap) => {
        setSummary(snap.exists() ? snap.data() : null);
      },
      (err) => {
        console.log("sensorSummary listener error:", err);
        setSummary(null);
      }
    );
  }, [tunnelId]);

  // last 24 readings for charts
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
      (snap) => {
        setReadings(
          snap.docs
            .map((d) => ({
              id: d.id,
              ...(d.data() as any),
            }))
            .reverse()
        );
      },
      (err) => {
        console.log("loraReadings listener error:", err);
        setReadings([]);
      }
    );
  }, [tunnelId]);

  // anomaly banner logic
  useEffect(() => {
    if (!tunnelId) {
      setBanner({
        level: "FAULT",
        msg: "No tunnel selected.",
      });
      return;
    }

    const lastSeenMs = tsToMs(summary?.lastSeenAt);

    if (!lastSeenMs) {
      setBanner({
        level: "FAULT",
        msg: "No LoRa data yet. Assign gateway to this tunnel.",
      });
      return;
    }

    const timeout = Date.now() - lastSeenMs > 60_000;

    if (timeout) {
      setBanner({
        level: "FAULT",
        msg: "LoRa timeout: no updates > 60 seconds.",
      });
      return;
    }

    const anLevel: Level = (summary?.an_level as Level) || "OK";
    const anMsg: string = summary?.an_message || "";

    if (anLevel === "FAULT") {
      setBanner({
        level: "FAULT",
        msg: anMsg || "Sensor fault detected.",
      });
    } else if (anLevel === "WARN") {
      setBanner({
        level: "WARN",
        msg: anMsg || "Sensor mismatch detected.",
      });
    } else {
      setBanner(null);
      lastPopupKeyRef.current = "";
    }
  }, [summary?.lastSeenAt, summary?.an_level, summary?.an_message, tunnelId]);

  // popup alert + Firestore alert creation
  useEffect(() => {
    if (!tunnelId || !banner) return;
    if (banner.level !== "FAULT" && banner.level !== "WARN") return;

    const popupKey = `${tunnelId}_${banner.level}_${banner.msg}`;

    // prevent repeated popup for same fault
    if (lastPopupKeyRef.current === popupKey) return;
    lastPopupKeyRef.current = popupKey;

    const alertSummary = {
      ...(summary || {}),
      an_level: banner.level,
      an_message: banner.msg,
    };

    createSensorFaultAlert({
      tunnelId,
      tunnelName:
        selectedTunnel?.name ??
        selectedTunnel?.tunnelName ??
        "Selected Tunnel",
      summary: alertSummary,
    }).catch((err) => {
      console.log("createSensorFaultAlert error:", err);
    });

    Alert.alert(
      banner.level === "FAULT" ? "Sensor Fault Detected" : "Sensor Warning",
      banner.msg,
      [
        {
          text: "View Details",
          onPress: () => navigateToDetail("Sensor Fault", "fault-001"),
        },
        {
          text: "OK",
          style: "cancel",
        },
      ]
    );
  }, [
    tunnelId,
    banner?.level,
    banner?.msg,
    summary,
    selectedTunnel?.name,
    selectedTunnel?.tunnelName,
  ]);

  const avgTemp = summary?.avg_temp ?? null;
  const avgHum = summary?.avg_hum ?? null;

  const labels = useMemo(
    () => readings.map((r, idx) => (idx % 4 === 0 ? fmtTime(r.ts) : "")),
    [readings]
  );

  const tempSeries = useMemo(
    () => readings.map((r) => safeNumber(r.avg_temp)),
    [readings]
  );

  const humSeries = useMemo(
    () => readings.map((r) => safeNumber(r.avg_hum)),
    [readings]
  );

  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    strokeWidth: 2,
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: "#fff",
    },
  };

  const navigateToDetail = (title: string, sensorId: string) => {
    navigation.navigate("SensorDetails", { title, sensorId });
  };

  const bannerColors =
    banner?.level === "FAULT"
      ? ["#FFEBEE", "#FFCDD2"]
      : banner?.level === "WARN"
      ? ["#FFF8E1", "#FFECB3"]
      : ["#E8F5E9", "#C8E6C9"];

  const bannerIconColor =
    banner?.level === "FAULT" ? "#D32F2F" : "#FB8C00";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Anomaly Banner */}
      {banner && (
        <View style={styles.anomalyBanner}>
          <LinearGradient
            colors={bannerColors as any}
            style={styles.anomalyGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.anomalyContent}>
              <View style={styles.anomalyIcon}>
                <Ionicons name="warning" size={24} color={bannerIconColor} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.anomalyTitle}>
                  {banner.level === "FAULT"
                    ? "Sensor Fault Detected!"
                    : "Sensor Warning"}
                </Text>

                <Text style={styles.anomalyText}>{banner.msg}</Text>

                <TouchableOpacity
                  onPress={() => navigateToDetail("Sensor Fault", "fault-001")}
                >
                  <Text style={styles.actionText}>
                    View Technical Details →
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setBanner(null)}>
                <Ionicons name="close" size={20} color={bannerIconColor} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Live Sensors */}
      <SectionTitle title="Live Sensors" />

      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.sensorCard}
          activeOpacity={0.9}
          onPress={() => navigateToDetail("Temperature Sensor", "temp-001")}
        >
          <View style={[styles.iconCircle, { backgroundColor: "#FFF3E0" }]}>
            <Ionicons name="thermometer-outline" size={28} color="#EF6C00" />
          </View>

          <View>
            <Text style={styles.sensorValue}>
              {avgTemp != null ? `${Number(avgTemp).toFixed(1)}°C` : "—"}
            </Text>
            <Text style={styles.sensorLabel}>Temperature Avg</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sensorCard}
          activeOpacity={0.9}
          onPress={() => navigateToDetail("Humidity Sensor", "hum-001")}
        >
          <View style={[styles.iconCircle, { backgroundColor: "#E1F5FE" }]}>
            <Ionicons name="water-outline" size={28} color="#0288D1" />
          </View>

          <View>
            <Text style={styles.sensorValue}>
              {avgHum != null ? `${Number(avgHum).toFixed(1)}%` : "—"}
            </Text>
            <Text style={styles.sensorLabel}>Humidity Avg</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Node Readings */}
      <SectionTitle title="Node Readings" />

      <View style={styles.nodeGrid}>
        <View style={styles.nodeCard}>
          <Text style={styles.nodeTitle}>Sensor Node 01</Text>
          <Text style={styles.nodeValue}>
            Temp:{" "}
            {summary?.s1_temp != null
              ? `${Number(summary.s1_temp).toFixed(1)}°C`
              : "—"}
          </Text>
          <Text style={styles.nodeValue}>
            Humidity:{" "}
            {summary?.s1_hum != null
              ? `${Number(summary.s1_hum).toFixed(1)}%`
              : "—"}
          </Text>
        </View>

        <View style={styles.nodeCard}>
          <Text style={styles.nodeTitle}>Sensor Node 02</Text>
          <Text style={styles.nodeValue}>
            Temp:{" "}
            {summary?.s2_temp != null
              ? `${Number(summary.s2_temp).toFixed(1)}°C`
              : "—"}
          </Text>
          <Text style={styles.nodeValue}>
            Humidity:{" "}
            {summary?.s2_hum != null
              ? `${Number(summary.s2_hum).toFixed(1)}%`
              : "—"}
          </Text>
        </View>
      </View>

      {/* Charts */}
      <SectionTitle title="24 Readings Trends" />

      <Card>
        <Text style={styles.chartTitle}>Temperature Trend</Text>

        <LineChart
          data={{
            labels,
            datasets: [
              {
                data: tempSeries.length ? tempSeries : [0],
              },
            ],
          }}
          width={screenWidth - 64}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(239, 108, 0, ${opacity})`,
          }}
          bezier
          style={styles.chart}
        />
      </Card>

      <Card>
        <Text style={styles.chartTitle}>Humidity Trend</Text>

        <LineChart
          data={{
            labels,
            datasets: [
              {
                data: humSeries.length ? humSeries : [0],
              },
            ],
          }}
          width={screenWidth - 64}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(2, 136, 209, ${opacity})`,
          }}
          bezier
          style={styles.chart}
        />
      </Card>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 10,
  },

  anomalyBanner: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  anomalyGradient: {
    padding: 16,
  },
  anomalyContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  anomalyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  anomalyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#333",
  },
  anomalyText: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginTop: 8,
    textDecorationLine: "underline",
  },

  grid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  sensorCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    height: 150,
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sensorValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#212121",
  },
  sensorLabel: {
    fontSize: 14,
    color: "#757575",
    fontWeight: "600",
  },

  nodeGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  nodeCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    elevation: 2,
  },
  nodeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1B5E20",
    marginBottom: 8,
  },
  nodeValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginTop: 4,
  },

  chartTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#37474F",
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});