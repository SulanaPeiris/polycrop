import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function SystemHealthScreen({ navigation }: any) {
  useTunnelHeader("System Health");

  // Mock Data
  const robotStatus = "Docked & Charging"; // Active, Idle, Error
  const robotBattery = 85;
  const isCharging = true;

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* 1. ROBOT STATUS CARD */}
      <LinearGradient
        colors={['#2E7D32', '#66BB6A']} // Green Gradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.robotCard}
      >
        <View style={styles.robotHeader}>
          <View style={styles.robotIconBox}>
            <Ionicons name="hardware-chip-outline" size={24} color="#E8F5E9" />
          </View>
          <View>
            <Text style={styles.robotTitle}>PolyBot Unit-01</Text>
            <Text style={styles.robotSubtitle}>{robotStatus}</Text>
          </View>
          <View style={styles.statusTag}>
            <View style={styles.dot} />
            <Text style={styles.statusTagText}>ONLINE</Text>
          </View>
        </View>

        <View style={styles.batteryRow}>
          <View>
            <Text style={styles.batteryLabel}>Battery Level</Text>
            <View style={styles.batteryValBox}>
              <Text style={styles.batteryVal}>{robotBattery}%</Text>
              {isCharging && <Ionicons name="flash" size={18} color="#FFD700" />}
            </View>
          </View>
          {/* Visual Battery Bar */}
          <View style={styles.batteryBarContainer}>
            <View style={[styles.batteryFill, { width: `${robotBattery}%` }]} />
          </View>
        </View>
      </LinearGradient>


      {/* 2. SYSTEM METRICS GRID */}
      <SectionTitle title="Network & Hardware" />
      <View style={styles.grid}>
        {/* Signal */}
        <View style={styles.metricCard}>
          <View style={[styles.iconCircle, { backgroundColor: '#E1F5FE' }]}>
            <Ionicons name="wifi" size={20} color="#0288D1" />
          </View>
          <Text style={styles.metricVal}>Excellent</Text>
          <Text style={styles.metricLabel}>Signal Strength</Text>
        </View>

        {/* Gateway */}
        <View style={styles.metricCard}>
          <View style={[styles.iconCircle, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="server-outline" size={20} color="#EF6C00" />
          </View>
          <Text style={styles.metricVal}>Online</Text>
          <Text style={styles.metricLabel}>Gateway Status</Text>
        </View>

        {/* Uptime */}
        <View style={styles.metricCard}>
          <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="time-outline" size={20} color="#2E7D32" />
          </View>
          <Text style={styles.metricVal}>14d 2h</Text>
          <Text style={styles.metricLabel}>System Uptime</Text>
        </View>

        {/* Latency */}
        <View style={styles.metricCard}>
          <View style={[styles.iconCircle, { backgroundColor: '#F3E5F5' }]}>
            <Ionicons name="pulse-outline" size={20} color="#7B1FA2" />
          </View>
          <Text style={styles.metricVal}>24ms</Text>
          <Text style={styles.metricLabel}>Avg Latency</Text>
        </View>
      </View>


      {/* 3. LOGS CTA */}
      <SectionTitle title="Diagnostics" />
      <TouchableOpacity
        style={styles.actionRow}
        onPress={() => navigation.navigate("SensorFaultLogs")}
      >
        <View style={styles.actionIcon}>
          <Ionicons name="warning-outline" size={22} color="#D32F2F" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Sensor Fault Logs</Text>
          <Text style={styles.actionSub}>View past sensor errors and outages</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },

  // Robot Card
  robotCard: { borderRadius: 24, padding: 24, marginBottom: 24, elevation: 3, shadowColor: "#2E7D32", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  robotHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  robotIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  robotTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  robotSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  statusTag: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: "rgba(0,0,0,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#69F0AE" },
  statusTagText: { color: "#fff", fontWeight: "700", fontSize: 10, letterSpacing: 0.5 },

  batteryRow: { marginTop: 8 },
  batteryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600", marginBottom: 4 },
  batteryValBox: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  batteryVal: { fontSize: 32, fontWeight: "800", color: "#fff", includeFontPadding: false },

  batteryBarContainer: { height: 6, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 3, width: "100%", overflow: "hidden" },
  batteryFill: { height: "100%", backgroundColor: "#fff", borderRadius: 3 },

  // Grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  metricCard: { width: (width - 44) / 2, backgroundColor: "#fff", padding: 16, borderRadius: 20, elevation: 1 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricVal: { fontSize: 16, fontWeight: "800", color: "#333", marginBottom: 2 },
  metricLabel: { fontSize: 12, color: "#757575" },

  // Action Row
  actionRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 16, borderRadius: 20, gap: 16, elevation: 1 },
  actionIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#FFEBEE", alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 15, fontWeight: "700", color: "#333" },
  actionSub: { fontSize: 12, color: "#757575" },

});
