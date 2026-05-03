import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

function tsToMs(ts: any): number {
  if (!ts) return 0;

  if (typeof ts.toMillis === "function") {
    return ts.toMillis();
  }

  if (typeof ts === "string") {
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  if (typeof ts?.seconds === "number") {
    return ts.seconds * 1000;
  }

  return 0;
}

function formatTime(ts: any) {
  const ms = tsToMs(ts);
  if (!ms) return "N/A";

  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} mins ago`;
  if (hours < 24) return `${hours} hours ago`;

  return new Date(ms).toLocaleString();
}

function getFaultIcon(type?: string) {
  if (type === "TEMPERATURE_MISMATCH") return "thermometer-outline";
  if (type === "HUMIDITY_MISMATCH") return "water-outline";
  if (type === "INVALID_SENSOR_READING") return "alert-circle-outline";
  if (type === "SENSOR_TIMEOUT") return "cloud-offline-outline";
  return "hardware-chip-outline";
}

function getFaultTitle(type?: string) {
  switch (type) {
    case "TEMPERATURE_MISMATCH":
      return "Temperature Mismatch";
    case "HUMIDITY_MISMATCH":
      return "Humidity Mismatch";
    case "INVALID_SENSOR_READING":
      return "Invalid Sensor Reading";
    case "SENSOR_TIMEOUT":
      return "Connection Timeout";
    case "SENSOR_WARNING":
      return "Sensor Warning";
    default:
      return "Sensor Fault";
  }
}

function getLevelColor(level?: string) {
  if (level === "FAULT") return "#D32F2F";
  if (level === "WARN") return "#EF6C00";
  return "#1976D2";
}

function getLevelBg(level?: string) {
  if (level === "FAULT") return "#FFEBEE";
  if (level === "WARN") return "#FFF3E0";
  return "#E3F2FD";
}

export default function SensorFaultLogsScreen() {
  useTunnelHeader("Sensor Fault Logs");

  const { selectedTunnel } = useTunnel();
  const tunnelId = selectedTunnel?.id ?? "";

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tunnelId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "tunnels", tunnelId, "sensorFaultLogs"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setLogs(list);
        setLoading(false);
      },
      (err) => {
        console.log("sensorFaultLogs listener error:", err);
        setLogs([]);
        setLoading(false);
      }
    );
  }, [tunnelId]);

  const markResolved = async (logId: string) => {
    if (!tunnelId) return;

    try {
      await updateDoc(doc(db, "tunnels", tunnelId, "sensorFaultLogs", logId), {
        status: "RESOLVED",
        resolvedAt: new Date(),
      });
    } catch (error) {
      console.log("markResolved error:", error);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const level = item.level || "FAULT";
    const color = getLevelColor(level);
    const bg = getLevelBg(level);

    return (
      <View style={styles.logCard}>
        <View style={[styles.iconBox, { backgroundColor: bg }]}>
          <Ionicons name={getFaultIcon(item.type)} size={22} color={color} />
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.sensorName}>
              {item.gatewayId || item.sensorId || "LoRa Sensor"}
            </Text>

            <View style={[styles.levelBadge, { backgroundColor: bg }]}>
              <Text style={[styles.levelText, { color }]}>{level}</Text>
            </View>
          </View>

          <Text style={[styles.errType, { color }]}>
            {getFaultTitle(item.type)}
          </Text>

          <Text style={styles.messageText}>
            {item.message || "Sensor fault detected"}
          </Text>

          <View style={styles.readingBox}>
            <Text style={styles.readingText}>
              Node 01:{" "}
              {item.s1_temp != null ? `${Number(item.s1_temp).toFixed(1)}°C` : "N/A"}{" "}
              |{" "}
              {item.s1_hum != null ? `${Number(item.s1_hum).toFixed(1)}%` : "N/A"}
            </Text>

            <Text style={styles.readingText}>
              Node 02:{" "}
              {item.s2_temp != null ? `${Number(item.s2_temp).toFixed(1)}°C` : "N/A"}{" "}
              |{" "}
              {item.s2_hum != null ? `${Number(item.s2_hum).toFixed(1)}%` : "N/A"}
            </Text>

            {item.tempDiff != null && (
              <Text style={styles.readingText}>
                Temperature Difference: {Number(item.tempDiff).toFixed(2)}°C
              </Text>
            )}

            {item.humDiff != null && (
              <Text style={styles.readingText}>
                Humidity Difference: {Number(item.humDiff).toFixed(2)}%
              </Text>
            )}
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>

            <Text
              style={[
                styles.statusText,
                item.status === "RESOLVED" && styles.resolvedText,
              ]}
            >
              {item.status || "ACTIVE"}
            </Text>
          </View>

          {item.status !== "RESOLVED" && (
            <TouchableOpacity
              style={styles.resolveButton}
              activeOpacity={0.85}
              onPress={() => markResolved(item.id)}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color="#2E7D32"
              />
              <Text style={styles.resolveButtonText}>Mark as Resolved</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (!tunnelId) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={44} color="#9E9E9E" />
        <Text style={styles.emptyTitle}>No Tunnel Selected</Text>
        <Text style={styles.emptyText}>
          Please select a tunnel to view sensor fault logs.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading sensor fault logs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {logs.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="shield-checkmark-outline" size={48} color="#2E7D32" />
          <Text style={styles.emptyTitle}>No Sensor Faults</Text>
          <Text style={styles.emptyText}>
            All sensor nodes are working normally.
          </Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },

  listContent: {
    padding: 16,
    paddingBottom: 120,
  },

  logCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  content: {
    flex: 1,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  sensorName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },

  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  levelText: {
    fontSize: 10,
    fontWeight: "900",
  },

  errType: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  messageText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
    marginTop: 6,
    lineHeight: 18,
  },

  readingBox: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },

  readingText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "600",
    marginBottom: 3,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    alignItems: "center",
  },

  timeText: {
    fontSize: 12,
    color: "#9E9E9E",
    fontWeight: "500",
  },

  statusText: {
    fontSize: 12,
    color: "#D32F2F",
    fontWeight: "800",
  },

  resolvedText: {
    color: "#2E7D32",
  },

  resolveButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#E8F5E9",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  resolveButtonText: {
    color: "#2E7D32",
    fontWeight: "800",
    fontSize: 12,
  },

  centerContainer: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 10,
    color: "#777",
    fontWeight: "600",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#333",
    marginTop: 12,
  },

  emptyText: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    marginTop: 6,
    fontWeight: "600",
  },
});