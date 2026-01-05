import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

export default function SensorFaultLogsScreen() {
  useTunnelHeader("Sensor Downtime Logs");

  // Mock Data - Only Timeouts/Downs
  const logs = [
    { id: '1', sensor: 'Temp-004', time: '10 mins ago' },
    { id: '2', sensor: 'Hum-002', time: 'Yesterday, 2:00 PM' },
    { id: '3', sensor: 'Flow-01', time: 'Oct 24, 09:30 AM' },
    { id: '4', sensor: 'Temp-001', time: 'Oct 20, 04:15 PM' },
  ];

  const renderItem = ({ item }: { item: any }) => {
    return (
      <View style={styles.logCard}>
        <View style={styles.iconBox}>
          <Ionicons name="cloud-offline-outline" size={20} color="#D32F2F" />
        </View>
        <View style={styles.content}>
          <Text style={styles.sensorName}>{item.sensor}</Text>
          <Text style={styles.errType}>Connection Timeout</Text>
        </View>
        <Text style={styles.timeText}>{item.time}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  listContent: { padding: 16 },

  logCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }
  },

  iconBox: {
    width: 40, height: 40,
    borderRadius: 14,
    backgroundColor: "#FFEBEE",
    alignItems: "center", justifyContent: "center",
    marginRight: 16
  },

  content: { flex: 1 },
  sensorName: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 2 },
  errType: { fontSize: 12, color: "#D32F2F", fontWeight: "600" },

  timeText: { fontSize: 12, color: "#9E9E9E", fontWeight: "500" }
});
