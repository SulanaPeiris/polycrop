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
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { useTunnel } from "../../context/TunnelContext";
import { db } from "../../firebase/firebase";

type AlertType = "DISEASE" | "WATER_STRESS" | "SENSOR_ANOMALY" | "SYSTEM";

interface Alert {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  timestamp?: string;
  createdAt?: any;
  severity: "CRITICAL" | "WARNING" | "INFO";
  tunnelId?: string;
  plantId?: string;
  captureId?: string;
  read?: boolean;
}

function getTimestampMs(alert: Alert) {
  const createdAt = alert.createdAt;

  if (!createdAt) return 0;

  if (typeof createdAt.toMillis === "function") {
    return createdAt.toMillis();
  }

  if (typeof createdAt.seconds === "number") {
    return createdAt.seconds * 1000;
  }

  return 0;
}

function formatTimeAgo(alert: Alert) {
  if (alert.timestamp) return alert.timestamp;

  const ms = getTimestampMs(alert);
  if (!ms) return "Just now";

  const diffMs = Date.now() - ms;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";

  return `${diffDays} days ago`;
}

export default function AlertsScreen() {
  useTunnelHeader("Alerts");

  const { selectedTunnel } = useTunnel();

  const selectedTunnelId =
    (selectedTunnel as any)?.id ||
    (selectedTunnel as any)?.tunnelId ||
    "";

  const [uid, setUid] = useState<string>("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
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

    // Query by ownerId only to avoid composite index problems.
    // Then filter selected tunnel locally.
    const q = query(collection(db, "alerts"), where("ownerId", "==", uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        let list: Alert[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;

          return {
            id: docSnap.id,
            type: data.type || "SYSTEM",
            title: data.title || "Alert",
            description: data.description || "",
            timestamp: data.timestamp,
            createdAt: data.createdAt,
            severity: data.severity || "INFO",
            tunnelId: data.tunnelId,
            plantId: data.plantId,
            captureId: data.captureId,
            read: data.read,
          };
        });

        if (selectedTunnelId) {
          list = list.filter((item) => item.tunnelId === selectedTunnelId);
        }

        list.sort((a, b) => getTimestampMs(b) - getTimestampMs(a));

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
    return alerts.filter((alert) => !alert.read).length;
  }, [alerts]);

  const getIcon = (type: AlertType) => {
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
  };

  const getColor = (severity: string) => {
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
  };

  const getBgColor = (severity: string) => {
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
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>Recent Notifications</Text>
        <Text style={styles.headerSubtitle}>
          {alerts.length > 0
            ? `${alerts.length} alerts • ${unreadCount} unread`
            : "Stay updated with your crop health and system status."}
        </Text>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-circle" size={42} color="#2E7D32" />
          <Text style={styles.emptyTitle}>No alerts yet</Text>
          <Text style={styles.emptyText}>
            Water stress and disease alerts will appear here after robot scans.
          </Text>
        </View>
      ) : (
        alerts.map((alert) => (
          <TouchableOpacity key={alert.id} style={styles.card} activeOpacity={0.85}>
            <View style={[styles.iconBox, { backgroundColor: getBgColor(alert.severity) }]}>
              <Ionicons
                name={getIcon(alert.type) as any}
                size={24}
                color={getColor(alert.severity)}
              />
            </View>

            <View style={styles.content}>
              <View style={styles.cardHeader}>
                <Text style={styles.title} numberOfLines={1}>
                  {alert.title}
                </Text>
                <Text style={styles.time}>{formatTimeAgo(alert)}</Text>
              </View>

              <Text style={styles.description} numberOfLines={2}>
                {alert.description}
              </Text>

              {alert.plantId ? (
                <Text style={styles.metaText}>Plant: {alert.plantId}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#F8F9FA",
    flexGrow: 1,
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
    alignItems: "center",
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
    marginRight: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    flex: 1,
    marginRight: 8,
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
});