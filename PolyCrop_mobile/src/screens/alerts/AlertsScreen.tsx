import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { useTunnel } from "../../context/TunnelContext";
import { db } from "../../firebase/firebase";

type AlertType = "DISEASE" | "WATER_STRESS" | "SENSOR_ANOMALY" | "SYSTEM";
type AlertSeverity = "CRITICAL" | "WARNING" | "INFO";

interface AlertItem {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  timestamp?: string;
  createdAt?: any;
  updatedAt?: any;
  severity: AlertSeverity;
  tunnelId?: string;
  tunnelName?: string;
  plantId?: string;
  captureId?: string;
  faultType?: string;
  gatewayId?: string;
  s1_temp?: number | null;
  s1_hum?: number | null;
  s2_temp?: number | null;
  s2_hum?: number | null;
  tempDiff?: number | null;
  humDiff?: number | null;
  read?: boolean;
  status?: string;
}

function timestampToMs(ts: any): number {
  if (!ts) return 0;

  if (typeof ts.toMillis === "function") {
    return ts.toMillis();
  }

  if (typeof ts.seconds === "number") {
    return ts.seconds * 1000;
  }

  if (typeof ts === "string") {
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  return 0;
}

function getAlertTimeMs(alert: AlertItem) {
  return timestampToMs(alert.updatedAt) || timestampToMs(alert.createdAt);
}

function formatTimeAgo(alert: AlertItem) {
  if (alert.timestamp) return alert.timestamp;

  const ms = getAlertTimeMs(alert);
  if (!ms) return "Just now";

  const diffMs = Date.now() - ms;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";

  return `${diffDays} days ago`;
}

function getIcon(type: AlertType) {
  switch (type) {
    case "DISEASE":
      return "alert-circle";
    case "WATER_STRESS":
      return "water";
    case "SENSOR_ANOMALY":
      return "hardware-chip";
    case "SYSTEM":
      return "checkmark-circle";
    default:
      return "notifications";
  }
}

function getColor(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "#D32F2F";
    case "WARNING":
      return "#EF6C00";
    case "INFO":
      return "#1976D2";
    default:
      return "#555";
  }
}

function getBgColor(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "#FFEBEE";
    case "WARNING":
      return "#FFF3E0";
    case "INFO":
      return "#E3F2FD";
    default:
      return "#F5F5F5";
  }
}

function getFaultLabel(faultType?: string) {
  switch (faultType) {
    case "TEMPERATURE_MISMATCH":
      return "Temperature Mismatch";
    case "HUMIDITY_MISMATCH":
      return "Humidity Mismatch";
    case "INVALID_SENSOR_READING":
      return "Invalid Sensor Reading";
    case "INVALID_TEMPERATURE_READING":
      return "Invalid Temperature Reading";
    case "INVALID_HUMIDITY_READING":
      return "Invalid Humidity Reading";
    case "SENSOR_TIMEOUT":
      return "Sensor Timeout";
    case "SENSOR_FAULT":
      return "Sensor Fault";
    default:
      return "";
  }
}

function formatNumber(value: any, decimals = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  return n.toFixed(decimals);
}

export default function AlertsScreen() {
  useTunnelHeader("Alerts");

  const { selectedTunnel } = useTunnel();

  const selectedTunnelId =
    (selectedTunnel as any)?.id ||
    (selectedTunnel as any)?.tunnelId ||
    "";

  const [uid, setUid] = useState<string>("");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || "");
    });

    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!uid) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Query only by ownerId to avoid composite index errors.
    // Tunnel filtering and sorting are done locally.
    const q = query(collection(db, "alerts"), where("ownerId", "==", uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        let list: AlertItem[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;

          return {
            id: docSnap.id,
            type: data.type || "SYSTEM",
            title: data.title || "Alert",
            description: data.description || "",
            timestamp: data.timestamp,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            severity: data.severity || "INFO",
            tunnelId: data.tunnelId,
            tunnelName: data.tunnelName,
            plantId: data.plantId,
            captureId: data.captureId,
            faultType: data.faultType,
            gatewayId: data.gatewayId,
            s1_temp: data.s1_temp,
            s1_hum: data.s1_hum,
            s2_temp: data.s2_temp,
            s2_hum: data.s2_hum,
            tempDiff: data.tempDiff,
            humDiff: data.humDiff,
            read: data.read,
            status: data.status,
          };
        });

        if (selectedTunnelId) {
          list = list.filter((item) => item.tunnelId === selectedTunnelId);
        }

        list.sort((a, b) => getAlertTimeMs(b) - getAlertTimeMs(a));

        setAlerts(list);
        setLoading(false);
      },
      (error) => {
        console.log("[AlertsScreen] Firestore alert listener error:", error);
        setAlerts([]);
        setLoading(false);
      }
    );

    return unsub;
  }, [uid, selectedTunnelId]);

  const unreadCount = useMemo(() => {
    return alerts.filter((alert) => !alert.read && alert.status !== "RESOLVED")
      .length;
  }, [alerts]);

  const markAsRead = async (alertId: string) => {
    try {
      await updateDoc(doc(db, "alerts", alertId), {
        read: true,
      });
    } catch (error) {
      console.log("[AlertsScreen] markAsRead error:", error);
    }
  };

  const renderSensorDetails = (alert: AlertItem) => {
    if (alert.type !== "SENSOR_ANOMALY") return null;

    return (
      <View style={styles.sensorDetailsBox}>
        {alert.faultType ? (
          <Text style={styles.sensorDetailText}>
            Fault Type: {getFaultLabel(alert.faultType) || alert.faultType}
          </Text>
        ) : null}

        {alert.gatewayId ? (
          <Text style={styles.sensorDetailText}>
            Gateway: {alert.gatewayId}
          </Text>
        ) : null}

        <Text style={styles.sensorDetailText}>
          Node 01: {formatNumber(alert.s1_temp)}°C |{" "}
          {formatNumber(alert.s1_hum)}%
        </Text>

        <Text style={styles.sensorDetailText}>
          Node 02: {formatNumber(alert.s2_temp)}°C |{" "}
          {formatNumber(alert.s2_hum)}%
        </Text>

        {alert.tempDiff != null ? (
          <Text style={styles.sensorDetailText}>
            Temp Difference: {formatNumber(alert.tempDiff, 2)}°C
          </Text>
        ) : null}

        {alert.humDiff != null ? (
          <Text style={styles.sensorDetailText}>
            Humidity Difference: {formatNumber(alert.humDiff, 2)}%
          </Text>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1B5E20" />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>Recent Notifications</Text>
        <Text style={styles.headerSubtitle}>
          {alerts.length > 0
            ? `${alerts.length} alerts • ${unreadCount} active unread`
            : "Stay updated with your crop health and system status."}
        </Text>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-circle" size={42} color="#2E7D32" />
          <Text style={styles.emptyTitle}>No alerts yet</Text>
          <Text style={styles.emptyText}>
            Disease, water stress, sensor fault, and system alerts will appear
            here.
          </Text>
        </View>
      ) : (
        alerts.map((alert) => {
          const color = getColor(alert.severity);
          const bgColor = getBgColor(alert.severity);
          const isUnread = !alert.read && alert.status !== "RESOLVED";

          return (
            <TouchableOpacity
              key={alert.id}
              style={[
                styles.card,
                isUnread && styles.unreadCard,
              ]}
              activeOpacity={0.85}
              onPress={() => markAsRead(alert.id)}
            >
              <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
                <Ionicons
                  name={getIcon(alert.type) as any}
                  size={24}
                  color={color}
                />
              </View>

              <View style={styles.content}>
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    {isUnread ? <View style={styles.unreadDot} /> : null}

                    <Text style={styles.title} numberOfLines={1}>
                      {alert.title}
                    </Text>
                  </View>

                  <Text style={styles.time}>{formatTimeAgo(alert)}</Text>
                </View>

                <Text style={styles.description} numberOfLines={3}>
                  {alert.description}
                </Text>

                {alert.tunnelName ? (
                  <Text style={styles.metaText}>Tunnel: {alert.tunnelName}</Text>
                ) : null}

                {alert.plantId ? (
                  <Text style={styles.metaText}>Plant: {alert.plantId}</Text>
                ) : null}

                {renderSensorDetails(alert)}

                <View style={styles.footerRow}>
                  <View
                    style={[
                      styles.severityBadge,
                      { backgroundColor: bgColor },
                    ]}
                  >
                    <Text style={[styles.severityText, { color }]}>
                      {alert.severity}
                    </Text>
                  </View>

                  {alert.status ? (
                    <Text
                      style={[
                        styles.statusText,
                        alert.status === "RESOLVED" && styles.resolvedText,
                      ]}
                    >
                      {alert.status}
                    </Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#F8F9FA",
    flexGrow: 1,
    paddingBottom: 120,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },

  headerInfo: {
    marginBottom: 24,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B5E20",
    marginBottom: 4,
  },

  headerSubtitle: {
    fontSize: 14,
    color: "#666",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: "#1B5E20",
  },

  emptyText: {
    marginTop: 6,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },

  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#2E7D32",
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },

  content: {
    flex: 1,
    marginRight: 4,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2E7D32",
    marginRight: 7,
  },

  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },

  time: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
  },

  description: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },

  metaText: {
    marginTop: 6,
    fontSize: 12,
    color: "#2E7D32",
    fontWeight: "700",
  },

  sensorDetailsBox: {
    marginTop: 10,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 10,
  },

  sensorDetailText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "600",
    marginBottom: 3,
  },

  footerRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },

  severityText: {
    fontSize: 11,
    fontWeight: "900",
  },

  statusText: {
    fontSize: 12,
    color: "#D32F2F",
    fontWeight: "800",
  },

  resolvedText: {
    color: "#2E7D32",
  },
});