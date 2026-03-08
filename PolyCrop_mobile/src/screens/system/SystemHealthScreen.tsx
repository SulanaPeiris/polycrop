import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { useTunnel } from "../../context/TunnelContext";
import { bindRobotToTunnel } from "../../services/robots";

const { width } = Dimensions.get("window");

function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts === "string") return Date.parse(ts) || 0;
  return 0;
}

function timeAgo(ms: number) {
  if (!ms) return "N/A";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export default function SystemHealthScreen({ navigation }: any) {
  useTunnelHeader("System Health");

  const { tunnels, selectedTunnel, selectedTunnelId, setSelectedTunnelId } = useTunnel();

  const tunnelId = selectedTunnel?.id ?? null;
  const currentRobotId = selectedTunnel?.robotId ?? "";

  const [robotIdInput, setRobotIdInput] = useState(currentRobotId);

  const [pickOpen, setPickOpen] = useState(false);

  const [robot, setRobot] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    setRobotIdInput(currentRobotId || "");
  }, [currentRobotId]);

  // subscribe robot doc
  useEffect(() => {
    const rid = (robotIdInput || "").trim();
    if (!rid) {
      setRobot(null);
      return;
    }

    return onSnapshot(doc(db, "robots", rid), (snap) => {
      setRobot(snap.exists() ? snap.data() : null);
    });
  }, [robotIdInput]);

  // subscribe scan events under selected tunnel
  useEffect(() => {
    if (!tunnelId) {
      setEvents([]);
      return;
    }

    const qy = query(collection(db, "tunnels", tunnelId, "scanEvents"), orderBy("ts", "desc"), limit(15));
    return onSnapshot(qy, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  }, [tunnelId]);

  const updatedAtMs = useMemo(() => tsToMs(robot?.updatedAt), [robot?.updatedAt]);
  const online = useMemo(() => (updatedAtMs ? Date.now() - updatedAtMs < 60_000 : false), [updatedAtMs]);

  const rssi = robot?.rssi ?? null;
  const moving = robot?.moving ?? "N/A";
  const scanning = robot?.scanning ?? "N/A";
  const actuator = robot?.actuator ?? "N/A";
  const lastRFID = robot?.rfid ?? "NONE";
  const mode = robot?.mode ?? "N/A";
  const pos = robot?.currentPosition ?? "N/A";

  const rssiPercent = useMemo(() => {
    if (rssi === null || typeof rssi !== "number") return 0;
    return Math.min(100, Math.max(5, (rssi + 100) * 2)); // -100..-50 => 0..100
  }, [rssi]);

  const handleAssign = async () => {
    const rid = robotIdInput.trim();
    if (!tunnelId) return Alert.alert("No tunnel", "Select a tunnel first.");
    if (!rid) return Alert.alert("Robot ID required", "Enter the robot ID (e.g., ROBOT_01).");

    try {
      await bindRobotToTunnel(rid, tunnelId);
      Alert.alert("Assigned", `Robot ${rid} assigned to ${selectedTunnel?.name ?? selectedTunnel?.tunnelName}.`);
    } catch (e: any) {
      Alert.alert("Failed", e?.message ?? "Failed to assign robot.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Tunnel picker */}
      <TouchableOpacity style={styles.pickBtn} onPress={() => setPickOpen(true)} activeOpacity={0.85}>
        <Ionicons name="leaf-outline" size={18} color="#2E7D32" />
        <Text style={styles.pickText}>
          {selectedTunnel ? `Tunnel: ${selectedTunnel.name ?? selectedTunnel.tunnelName}` : "Select a tunnel"}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#2E7D32" />
      </TouchableOpacity>

      <Modal visible={pickOpen} transparent animationType="fade" onRequestClose={() => setPickOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Tunnel</Text>

            {tunnels.length === 0 ? <Text style={{ color: "#757575", marginTop: 10 }}>No tunnels yet.</Text> : null}

            {tunnels.map((t) => {
              const active = t.id === selectedTunnelId;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.modalItem, active && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedTunnelId(t.id);
                    setPickOpen(false);
                  }}
                >
                  <Text style={[styles.modalItemText, active && { color: "#fff" }]}>{t.name ?? t.tunnelName}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={18} color="#fff" /> : null}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.modalClose} onPress={() => setPickOpen(false)}>
              <Text style={{ fontWeight: "900", color: "#757575" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Assign robot */}
      <View style={styles.assignCard}>
        <Text style={styles.assignTitle}>Assign Robot to Tunnel</Text>
        <Text style={styles.assignSub}>Robot needs this to write scan events and to resolve RFIDs.</Text>

        <TextInput
          style={styles.input}
          value={robotIdInput}
          onChangeText={setRobotIdInput}
          placeholder="Robot ID (e.g., ROBOT_01)"
          autoCapitalize="characters"
        />

        <TouchableOpacity style={styles.assignBtn} onPress={handleAssign} activeOpacity={0.85}>
          <Ionicons name="link-outline" size={18} color="#fff" />
          <Text style={styles.assignBtnText}>Assign</Text>
        </TouchableOpacity>
      </View>

      {/* Robot Header Card */}
      <LinearGradient colors={["#2E7D32", "#66BB6A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.robotCard}>
        <View style={styles.robotHeader}>
          <View style={styles.robotIconBox}>
            <Ionicons name="hardware-chip-outline" size={24} color="#E8F5E9" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.robotTitle}>{robotIdInput ? `Robot ${robotIdInput}` : "No robot selected"}</Text>
            <Text style={styles.robotSubtitle}>
              {robotIdInput ? `${online ? "ONLINE" : "OFFLINE"} • Updated ${timeAgo(updatedAtMs)}` : "Enter a robot id above"}
            </Text>
          </View>

          <View style={styles.statusTag}>
            <View style={[styles.dot, { backgroundColor: online ? "#69F0AE" : "#FF5252" }]} />
            <Text style={styles.statusTagText}>{online ? "ONLINE" : "OFFLINE"}</Text>
          </View>
        </View>

        <View style={styles.rssiRow}>
          <View>
            <Text style={styles.rssiLabel}>WiFi RSSI</Text>
            <Text style={styles.rssiValue}>{rssi !== null ? `${rssi} dBm` : "N/A"}</Text>
          </View>

          <View style={styles.rssiBarContainer}>
            <View style={[styles.rssiFill, { width: `${rssiPercent}%` }]} />
          </View>
        </View>

        <View style={styles.modeRow}>
          <Text style={styles.modeText}>Mode: {mode}</Text>
          <Text style={styles.modeText}>Pos: {pos}</Text>
        </View>
      </LinearGradient>

      {/* Live Metrics */}
      <SectionTitle title="Robot Live Data" />
      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <View style={[styles.iconCircle, { backgroundColor: "#E1F5FE" }]}>
            <Ionicons name="walk-outline" size={20} color="#0288D1" />
          </View>
          <Text style={styles.metricVal}>{moving}</Text>
          <Text style={styles.metricLabel}>Moving</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.iconCircle, { backgroundColor: "#FFF3E0" }]}>
            <Ionicons name="scan-outline" size={20} color="#EF6C00" />
          </View>
          <Text style={styles.metricVal}>{scanning}</Text>
          <Text style={styles.metricLabel}>Scanning</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.iconCircle, { backgroundColor: "#E8F5E9" }]}>
            <Ionicons name="water-outline" size={20} color="#2E7D32" />
          </View>
          <Text style={styles.metricVal}>{actuator}</Text>
          <Text style={styles.metricLabel}>Actuator</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.iconCircle, { backgroundColor: "#F3E5F5" }]}>
            <Ionicons name="card-outline" size={20} color="#7B1FA2" />
          </View>
          <Text style={styles.metricVal} numberOfLines={1}>
            {lastRFID}
          </Text>
          <Text style={styles.metricLabel}>Last RFID</Text>
        </View>
      </View>

      {/* Recent Events */}
      <SectionTitle title="Recent Scan Events" />
      <View style={styles.section}>
        {!tunnelId ? (
          <Text style={styles.empty}>No tunnel selected.</Text>
        ) : events.length === 0 ? (
          <Text style={styles.empty}>No scan events yet.</Text>
        ) : (
          events.map((e) => (
            <View key={e.id} style={styles.eventRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventType}>{e.eventType ?? "EVENT"}</Text>
                <Text style={styles.eventMeta}>
                  RFID: {e.rfid ?? "NONE"} • {e.note ?? ""}
                </Text>
                <Text style={styles.eventMetaSmall}>
                  {e.moving ?? ""} • {e.scanning ?? ""} • {e.actuator ?? ""} • RSSI {e.rssi ?? "N/A"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#BDBDBD" />
            </View>
          ))
        )}
      </View>

      {/* Diagnostics */}
      <SectionTitle title="Diagnostics" />
      <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate("SensorFaultLogs")}>
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

  pickBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  pickText: { flex: 1, fontWeight: "900", color: "#1B5E20" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 16 },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#eee" },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#1B5E20" },
  modalItem: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalItemActive: { backgroundColor: "#2E7D32", borderColor: "#2E7D32" },
  modalItemText: { fontWeight: "900", color: "#333" },
  modalClose: { marginTop: 14, paddingVertical: 12, alignItems: "center" },

  assignCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 16,
  },
  assignTitle: { fontSize: 15, fontWeight: "900", color: "#1B5E20" },
  assignSub: { marginTop: 4, color: "#757575", fontWeight: "600", fontSize: 12 },
  input: { marginTop: 12, backgroundColor: "#F5F5F5", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E0E0E0" },
  assignBtn: { marginTop: 12, backgroundColor: "#2E7D32", borderRadius: 14, paddingVertical: 12, flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
  assignBtnText: { color: "#fff", fontWeight: "900" },

  robotCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    elevation: 3,
    shadowColor: "#2E7D32",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  robotHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  robotIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  robotTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  robotSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusTagText: { color: "#fff", fontWeight: "700", fontSize: 10, letterSpacing: 0.5 },

  rssiRow: { marginTop: 4 },
  rssiLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  rssiValue: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 2 },

  rssiBarContainer: {
    height: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 3,
    width: "100%",
    overflow: "hidden",
    marginTop: 10,
  },
  rssiFill: { height: "100%", backgroundColor: "#fff", borderRadius: 3 },

  modeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  modeText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  metricCard: { width: (width - 44) / 2, backgroundColor: "#fff", padding: 16, borderRadius: 20, elevation: 1 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricVal: { fontSize: 16, fontWeight: "800", color: "#333", marginBottom: 2 },
  metricLabel: { fontSize: 12, color: "#757575" },

  section: { backgroundColor: "#fff", borderRadius: 20, padding: 16, elevation: 1, marginBottom: 24 },
  empty: { color: "#757575" },

  eventRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  eventType: { fontWeight: "800", color: "#333" },
  eventMeta: { color: "#757575", marginTop: 2, fontSize: 12 },
  eventMetaSmall: { color: "#9E9E9E", marginTop: 4, fontSize: 11 },

  actionRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 16, borderRadius: 20, gap: 16, elevation: 1 },
  actionIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#FFEBEE", alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 15, fontWeight: "700", color: "#333" },
  actionSub: { fontSize: 12, color: "#757575" },
});
