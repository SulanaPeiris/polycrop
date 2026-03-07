import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { LinearGradient } from "expo-linear-gradient";
import { collection, documentId, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase/firebase";

const { width } = Dimensions.get("window");

type NpkReading = {
  n: number | null;
  p: number | null;
  k: number | null;
  ts: string;
};

type ExecutionLog = {
  id: string;
  date: string;
  n: number | null;
  p: number | null;
  k: number | null;
};

function formatReadingTs(ts: any): string {
  if (!ts) return "";
  if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
  if (typeof ts === "number") return new Date(ts).toLocaleString();
  if (typeof ts === "string") return ts;
  return "";
}

function parseLogDateFromId(id: string): string {
  const m = /^log_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(id);
  if (!m) return id;

  const [, y, mo, d, h, mi, s] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return dt.toLocaleString();
}

export default function SchedulesScreen() {
  useTunnelHeader("Schedules & Logs");
  const [currentNpk, setCurrentNpk] = useState<NpkReading>({ n: null, p: null, k: null, ts: "" });
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);

  useEffect(() => {
    const latestNpkQuery = query(
      collection(db, "devices", "npk-esp32-01", "readings"),
      orderBy(documentId(), "desc"),
      limit(1)
    );

    return onSnapshot(
      latestNpkQuery,
      (snap) => {
        const first = snap.docs[0];
        if (!first) {
          setCurrentNpk({ n: null, p: null, k: null, ts: "" });
          return;
        }

        const data = first.data() as any;
        const n = Number(data?.n);
        const p = Number(data?.p);
        const k = Number(data?.k);

        setCurrentNpk({
          n: Number.isFinite(n) ? n : null,
          p: Number.isFinite(p) ? p : null,
          k: Number.isFinite(k) ? k : null,
          ts: formatReadingTs(data?.ts),
        });
      },
      (err) => {
        console.log("npk readings listener error:", err);
        setCurrentNpk({ n: null, p: null, k: null, ts: "" });
      }
    );
  }, []);

  useEffect(() => {
    const logsQuery = query(
      collection(db, "dispenseLogs"),
      orderBy(documentId(), "desc"),
      limit(10)
    );

    return onSnapshot(
      logsQuery,
      (snap) => {
        const logs = snap.docs.map((d) => {
          const data = d.data() as any;
          const n = Number(data?.inputMl1);
          const p = Number(data?.inputMl2);
          const k = Number(data?.inputMl3User);

          return {
            id: d.id,
            date: formatReadingTs(data?.ts) || parseLogDateFromId(d.id),
            n: Number.isFinite(n) ? n : null,
            p: Number.isFinite(p) ? p : null,
            k: Number.isFinite(k) ? k : null,
          } satisfies ExecutionLog;
        });

        setExecutionLogs(logs);
      },
      (err) => {
        console.log("dispenseLogs listener error:", err);
        setExecutionLogs([]);
      }
    );
  }, []);

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

      {/* Current NPK Levels */}
      <View style={styles.currentNpkCard}>
        <View style={styles.currentNpkHeader}>
          <View style={styles.currentNpkIcon}>
            <Ionicons name="flask-outline" size={18} color="#2E7D32" />
          </View>
          <Text style={styles.currentNpkTitle}>Current NPK Levels</Text>
        </View>

        <View style={styles.currentNpkRow}>
          <View style={styles.currentNpkItem}>
            <View style={styles.currentNpkCircle}>
              <Text style={styles.currentNpkValue}>{currentNpk.n ?? "—"}</Text>
            </View>
            <Text style={styles.currentNpkLabel}>N</Text>
          </View>

          <View style={styles.currentNpkItem}>
            <View style={styles.currentNpkCircle}>
              <Text style={styles.currentNpkValue}>{currentNpk.p ?? "—"}</Text>
            </View>
            <Text style={styles.currentNpkLabel}>P</Text>
          </View>

          <View style={styles.currentNpkItem}>
            <View style={styles.currentNpkCircle}>
              <Text style={styles.currentNpkValue}>{currentNpk.k ?? "—"}</Text>
            </View>
            <Text style={styles.currentNpkLabel}>K</Text>
          </View>
        </View>

        {!!currentNpk.ts && <Text style={styles.currentNpkTs}>Updated: {currentNpk.ts}</Text>}
      </View>

      {/* 2. Executed History Logs - Clean List */}
      <View style={styles.historySection}>
        <SectionTitle title="Execution History" />
        <View style={styles.logContainer}>
          {executionLogs.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logMain}>
                <View style={[styles.logIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons
                    name={"checkmark"}
                    size={18}
                    color={"#2E7D32"}
                  />
                </View>
                <View>
                  <Text style={styles.logDate}>{log.date}</Text>
                  <Text style={styles.logStage}>Dispense Log</Text>
                </View>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={styles.miniNpkRow}>
                  <View style={styles.miniCircle}><Text style={styles.miniVal}>{log.n ?? "—"}</Text><Text style={styles.miniLabel}>N</Text></View>
                  <View style={styles.miniCircle}><Text style={styles.miniVal}>{log.p ?? "—"}</Text><Text style={styles.miniLabel}>P</Text></View>
                  <View style={styles.miniCircle}><Text style={styles.miniVal}>{log.k ?? "—"}</Text><Text style={styles.miniLabel}>K</Text></View>
                </View>
                <Text style={[styles.logStatus, { color: "#9E9E9E" }]}>
                  Completed
                </Text>
              </View>
            </View>
          ))}
        </View>
        {executionLogs.length === 0 && <Text style={styles.emptyHistoryText}>No dispense logs found.</Text>}
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

  currentNpkCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  currentNpkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  currentNpkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  currentNpkTitle: { fontSize: 15, fontWeight: "700", color: "#333" },
  currentNpkRow: { flexDirection: "row", justifyContent: "space-around" },
  currentNpkItem: { alignItems: "center", gap: 6 },
  currentNpkCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#F1F8E9",
    borderWidth: 1,
    borderColor: "#A5D6A7",
    alignItems: "center",
    justifyContent: "center",
  },
  currentNpkValue: { fontSize: 20, fontWeight: "800", color: "#2E7D32" },
  currentNpkLabel: { fontSize: 12, fontWeight: "700", color: "#4CAF50" },
  currentNpkTs: { marginTop: 12, fontSize: 12, color: "#757575", textAlign: "center" },

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

  emptyHistoryText: { color: "#9E9E9E", fontSize: 13, textAlign: "center", marginTop: 6 },

  viewAllBtn: { alignItems: "center", paddingVertical: 20 },
  viewAllText: { color: "#757575", fontWeight: "600", fontSize: 13 }
});
