import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function SchedulesScreen() {
  useTunnelHeader("Schedules & Logs");

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* 1. Next Active Fertigation - Enhanced Design */}
      <LinearGradient
        colors={['#ffffff', '#F1F8E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.nextRunCard}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.iconCircle}>
              <Ionicons name="water" size={20} color="#2E7D32" />
            </View>
            <Text style={styles.cardTitle}>Next Fertigation</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>TODAY</Text>
          </View>
        </View>

        <View style={styles.timeContainer}>
          <Text style={styles.timeLarge}>04:00</Text>
          <Text style={styles.timeAmPm}>PM</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="hourglass-outline" size={14} color="#757575" />
            <Text style={styles.metaText}>15 mins duration</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="leaf-outline" size={14} color="#757575" />
            <Text style={styles.metaText}>Mix: Vegitative</Text>
          </View>
        </View>
      </LinearGradient>

      {/* 2. Executed History Logs - Clean List */}
      <View style={styles.historySection}>
        <SectionTitle title="Execution History" />
        <View style={styles.logContainer}>
          {[
            { id: 1, date: "Today, 10:00 AM", stage: "Stage 2: Vegetative", n: 7, p: 5, k: 5, status: "Completed" },
            { id: 2, date: "Yesterday, 04:00 PM", stage: "Stage 2: Vegetative", n: 7, p: 5, k: 5, status: "Completed" },
            { id: 3, date: "Oct 24, 04:00 PM", stage: "Stage 1: Early Growth", n: 6, p: 4, k: 4, status: "Completed" },
            { id: 4, date: "Oct 23, 04:00 PM", stage: "Stage 1: Early Growth", n: 6, p: 4, k: 4, status: "Skipped" },
          ].map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logMain}>
                <View style={[styles.logIcon, { backgroundColor: log.status === 'Skipped' ? '#FFEBEE' : '#E8F5E9' }]}>
                  <Ionicons
                    name={log.status === 'Skipped' ? "close" : "checkmark"}
                    size={18}
                    color={log.status === 'Skipped' ? "#D32F2F" : "#2E7D32"}
                  />
                </View>
                <View>
                  <Text style={styles.logDate}>{log.date}</Text>
                  <Text style={styles.logStage}>{log.stage}</Text>
                </View>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={styles.miniNpkRow}>
                  <View style={styles.miniCircle}><Text style={styles.miniVal}>{log.n}</Text><Text style={styles.miniLabel}>N</Text></View>
                  <View style={styles.miniCircle}><Text style={styles.miniVal}>{log.p}</Text><Text style={styles.miniLabel}>P</Text></View>
                  <View style={styles.miniCircle}><Text style={styles.miniVal}>{log.k}</Text><Text style={styles.miniLabel}>K</Text></View>
                </View>
                <Text style={[styles.logStatus, { color: log.status === 'Skipped' ? "#D32F2F" : "#9E9E9E" }]}>
                  {log.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.viewAllBtn}>
          <Text style={styles.viewAllText}>View All History</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#FAFAFA", flexGrow: 1 },

  // Next Run Card
  nextRunCard: { borderRadius: 24, padding: 24, marginBottom: 32, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontWeight: "700", color: "#333", fontSize: 16 },

  badge: { backgroundColor: "#E1F5FE", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "800", color: "#0288D1", letterSpacing: 0.5 },

  timeContainer: { flexDirection: "row", alignItems: "baseline", marginBottom: 20 },
  timeLarge: { fontSize: 42, fontWeight: "800", color: "#2E7D32", includeFontPadding: false },
  timeAmPm: { fontSize: 18, fontWeight: "600", color: "#81C784", marginLeft: 6 },

  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 16 },

  metaRow: { flexDirection: "row", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { color: "#757575", fontWeight: "600", fontSize: 13 },

  // History Section
  historySection: { flex: 1 },
  logContainer: { gap: 14 },
  logItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: 16, borderRadius: 20, elevation: 1, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 5 },

  logMain: { flexDirection: "row", alignItems: "center", gap: 14 },
  logIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }, // Bg color handled inline

  logDate: { fontSize: 14, fontWeight: "700", color: "#333" },
  logStage: { fontSize: 12, color: "#9E9E9E", marginTop: 2 },

  // Clean NPK Circles
  miniNpkRow: { flexDirection: "row", gap: 6 },
  miniCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F1F8E9", borderWidth: 1, borderColor: "#A5D6A7", alignItems: "center", justifyContent: "center" },
  miniVal: { fontSize: 11, fontWeight: "800", color: "#2E7D32", lineHeight: 12 },
  miniLabel: { fontSize: 7, fontWeight: "700", color: "#4CAF50", lineHeight: 8 },

  logStatus: { fontSize: 11, fontWeight: "600" },

  viewAllBtn: { alignItems: "center", paddingVertical: 20 },
  viewAllText: { color: "#757575", fontWeight: "600", fontSize: 13 }
});
