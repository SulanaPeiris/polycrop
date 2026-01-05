import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

type AlertType = "DISEASE" | "WATER_STRESS" | "SENSOR_ANOMALY" | "SYSTEM";

interface Alert {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  timestamp: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
}

const MOCK_ALERTS: Alert[] = [
  {
    id: "1",
    type: "DISEASE",
    title: "Downy Mildew Detected",
    description: "High probability of Downy Mildew in Tunnel 01, Zone A. Immediate inspection recommended.",
    timestamp: "2 hours ago",
    severity: "CRITICAL"
  },
  {
    id: "2",
    type: "WATER_STRESS",
    title: "Low Soil Moisture",
    description: "Soil moisture levels dropped below 40% in Tunnel 02. Irrigation scheduled.",
    timestamp: "5 hours ago",
    severity: "WARNING"
  },
  {
    id: "3",
    type: "SENSOR_ANOMALY",
    title: "Sensor Disconnected",
    description: "Temp sensor T-04 is not responding. Check connection or battery.",
    timestamp: "Yesterday, 4:30 PM",
    severity: "INFO"
  },
  {
    id: "4",
    type: "SYSTEM",
    title: "Fertigation Completed",
    description: "Scheduled fertigation cycle for Tunnel 01 completed successfully.",
    timestamp: "Yesterday, 8:00 AM",
    severity: "INFO"
  }
];

export default function AlertsScreen() {
  useTunnelHeader("Alerts");

  const getIcon = (type: AlertType) => {
    switch (type) {
      case "DISEASE": return "alert-circle";
      case "WATER_STRESS": return "water";
      case "SENSOR_ANOMALY": return "hardware-chip";
      case "SYSTEM": return "checkmark-circle";
      default: return "notifications";
    }
  };

  const getColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "#D32F2F"; // Red
      case "WARNING": return "#EF6C00"; // Orange
      case "INFO": return "#1976D2"; // Blue
      default: return "#555";
    }
  };

  const getBgColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "#FFEBEE";
      case "WARNING": return "#FFF3E0";
      case "INFO": return "#E3F2FD";
      default: return "#F5F5F5";
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Info (Optional) */}
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>Recent Notifications</Text>
        <Text style={styles.headerSubtitle}>Stay updated with your crop health and system status.</Text>
      </View>

      {MOCK_ALERTS.map((alert) => (
        <TouchableOpacity key={alert.id} style={styles.card}>
          <View style={[styles.iconBox, { backgroundColor: getBgColor(alert.severity) }]}>
            <Ionicons name={getIcon(alert.type) as any} size={24} color={getColor(alert.severity)} />
          </View>

          <View style={styles.content}>
            <View style={styles.cardHeader}>
              <Text style={styles.title} numberOfLines={1}>{alert.title}</Text>
              <Text style={styles.time}>{alert.timestamp}</Text>
            </View>
            <Text style={styles.description} numberOfLines={2}>{alert.description}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#F8F9FA",
    flexGrow: 1
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
    shadowOffset: { width: 0, height: 2 }
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16
  },
  content: {
    flex: 1,
    marginRight: 8
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    flex: 1,
    marginRight: 8
  },
  time: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600"
  },
  description: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20
  }
});
