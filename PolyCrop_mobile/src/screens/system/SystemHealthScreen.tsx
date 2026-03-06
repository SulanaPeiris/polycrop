import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { useTunnel } from "../../context/TunnelContext";

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

  // ✅ now we can load tunnels and select tunnel
  const { tunnels, selectedTunnelId, setSelectedTunnelId, selectedTunnel } = useTunnel();

  const tunnelId = selectedTunnel?.id ?? "";
  const tunnelName = selectedTunnel?.name ?? "Select a tunnel";

  // robot id input (use tunnel.robotId if available)
  const [robotIdInput, setRobotIdInput] = useState("");
  const robotId = robotIdInput.trim();

  // dropdown modal
  const [pickerOpen, setPickerOpen] = useState(false);

  // robot doc + scan events
  const [robot, setRobot] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [lastAssignMsg, setLastAssignMsg] = useState<string>("");

  // when tunnel changes, set robotId input from tunnel (or keep ROBOT_01)
  useEffect(() => {
    const next = (selectedTunnel?.robotId ?? robotIdInput ?? "ROBOT_01").toString().trim();
    setRobotIdInput(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTunnelId]);

  // ✅ subscribe robot live doc
  useEffect(() => {
    if (!robotId) {
      setRobot(null);
      return;
    }
    return onSnapshot(
      doc(db, "robots", robotId),
      (snap) => setRobot(snap.exists() ? snap.data() : null),
      (err) => {
        console.log("robot listener error:", err);
        setRobot(null);
      }
    );
  }, [robotId]);

  // ✅ subscribe last 10 scan events for this tunnel
  useEffect(() => {
    if (!tunnelId) {
      setEvents([]);
      return;
    }

    const q = query(
      collection(db, "tunnels", tunnelId, "scanEvents"),
      orderBy("ts", "desc"),
      limit(10)
    );

    return onSnapshot(
      q,
      (snap) => setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      (err) => {
        console.log("scanEvents listener error:", err);
        setEvents([]);
      }
    );
  }, [tunnelId]);

  const updatedAtMs = useMemo(() => tsToMs(robot?.updatedAt), [robot?.updatedAt]);
  const online = useMemo(() => (updatedAtMs ? Date.now() - updatedAtMs < 60_000 : false), [updatedAtMs]);

  const assignedTunnelId = (robot?.assignedTunnelId ?? "").toString();
  const assignmentOk = !!tunnelId && !!assignedTunnelId && assignedTunnelId === tunnelId;

  const rssi = robot?.rssi ?? null;
  const moving = robot?.moving ?? "N/A";
  const scanning = robot?.scanning ?? "N/A";
  const actuator = robot?.actuator ?? "N/A";
  const lastRFID = robot?.rfid ?? "NONE";
  const mode = robot?.mode ?? "N/A";

  const rssiPercent = useMemo(() => {
    if (rssi === null || typeof rssi !== "number") return 0;
    // rough mapping: -100..-50 -> 0..100
    return Math.min(100, Math.max(5, (rssi + 100) * 2));
  }, [rssi]);

  // ✅ Assign robot to selected tunnel (writes BOTH docs)
  const assignRobotToTunnel = async (nextTunnelId: string, nextTunnelName: string, rid: string) => {
    const cleanRobotId = rid.trim();
    if (!cleanRobotId) {
      Alert.alert("Robot ID missing", "Enter Robot ID (example: ROBOT_01) then select tunnel again.");
      return;
    }

    try {
      setAssigning(true);
      setLastAssignMsg("");

      // 1) set tunnel.robotId (so app shows correct robot)
      await updateDoc(doc(db, "tunnels", nextTunnelId), {
        robotId: cleanRobotId,
        updatedAt: serverTimestamp(),
      });

      // 2) set robot.assignedTunnelId (robot reads this)
      await setDoc(
        doc(db, "robots", cleanRobotId),
        {
          robotId: cleanRobotId,
          assignedTunnelId: nextTunnelId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setLastAssignMsg(`Assigned ${cleanRobotId} → ${nextTunnelName}`);
    } catch (e: any) {
      console.log("assignRobotToTunnel error:", e);
      Alert.alert("Error", e?.message ?? "Failed to assign robot.");
    } finally {
      setAssigning(false);
    }
  };

  // ✅ Dropdown selection handler (select tunnel + immediately assign)
  const onSelectTunnel = async (t: any) => {
    setPickerOpen(false);
    setSelectedTunnelId(t.id);

    // choose robot id for assignment: tunnel.robotId OR input OR default ROBOT_01
    const rid = (t.robotId ?? robotIdInput ?? "ROBOT_01").toString().trim();
    setRobotIdInput(rid);

    if (!rid) return;

    // auto-assign on selection (as you requested)
    await assignRobotToTunnel(t.id, t.name ?? "Tunnel", rid);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* ===== Tunnel dropdown ===== */}
      <SectionTitle title="Assigned Tunnel" />
      <View style={styles.whiteCard}>
        <Text style={styles.smallLabel}>Current Tunnel</Text>
        <Text style={styles.bigValue}>{tunnelName}</Text>

        <TouchableOpacity style={styles.changeBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.85}>
          <Ionicons name="chevron-down" size={18} color="#fff" />
          <Text style={styles.changeBtnText}>Select Tunnel</Text>
        </TouchableOpacity>

        <Text style={[styles.smallLabel, { marginTop: 14 }]}>Robot ID</Text>
        <View style={styles.inputRow}>
          <Ionicons name="hardware-chip-outline" size={18} color="#666" />
          <TextInput
            style={styles.input}
            value={robotIdInput}
            onChangeText={setRobotIdInput}
            placeholder="ROBOT_01"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.assignmentRow}>
          <Text style={styles.assignmentText}>
            robot.assignedTunnelId: <Text style={{ fontWeight: "800" }}>{assignedTunnelId || "NOT SET"}</Text>
          </Text>
          <View style={[styles.assignmentBadge, assignmentOk ? styles.badgeOk : styles.badgeWarn]}>
            <Text style={styles.badgeText}>{assignmentOk ? "MATCH" : "NOT MATCH"}</Text>
          </View>
        </View>

        {assigning ? (
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ActivityIndicator />
            <Text style={styles.helper}>Updating assignment...</Text>
          </View>
        ) : lastAssignMsg ? (
          <Text style={styles.helperOk}>{lastAssignMsg}</Text>
        ) : (
          <Text style={styles.helper}>
            Select a tunnel to assign the robot. This will update Firestore immediately.
          </Text>
        )}
      </View>

      {/* ===== Dropdown Modal ===== */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Tunnel</Text>

            <ScrollView style={{ maxHeight: 360 }}>
              {tunnels.map((t: any) => {
                const active = t.id === selectedTunnelId;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.modalRow, active && styles.modalRowActive]}
                    onPress={() => onSelectTunnel(t)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.modalRowText, active && styles.modalRowTextActive]}>{t.name}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={20} color="#2E7D32" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.modalClose} onPress={() => setPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== Header Card ===== */}
      <LinearGradient
        colors={["#2E7D32", "#66BB6A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.robotCard}
      >
        <View style={styles.robotHeader}>
          <View style={styles.robotIconBox}>
            <Ionicons name="hardware-chip-outline" size={24} color="#E8F5E9" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.robotTitle}>{robotId ? `Robot ${robotId}` : "No robot selected"}</Text>
            <Text style={styles.robotSubtitle}>
              {robotId ? `${online ? "ONLINE" : "OFFLINE"} • Updated ${timeAgo(updatedAtMs)}` : "Enter robot ID above"}
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
          <Text style={styles.modeText}>Tunnel: {tunnelName}</Text>
        </View>
      </LinearGradient>

      {/* ===== Live Metrics ===== */}
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

      {/* ===== Recent Events ===== */}
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
                <Text style={styles.eventMeta}>RFID: {e.rfid ?? "NONE"} • {e.note ?? ""}</Text>
                <Text style={styles.eventMetaSmall}>
                  {e.moving ?? ""} • {e.scanning ?? ""} • {e.actuator ?? ""} • RSSI {e.rssi ?? "N/A"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#BDBDBD" />
            </View>
          ))
        )}
      </View>

      {/* ===== Diagnostics Nav ===== */}
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

  whiteCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, elevation: 1, marginBottom: 16 },
  smallLabel: { color: "#757575", fontSize: 12, fontWeight: "600" },
  bigValue: { fontSize: 16, fontWeight: "800", color: "#333", marginTop: 4 },

  changeBtn: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#2E7D32",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBtnText: { color: "#fff", fontWeight: "800" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: "#333" },

  assignmentRow: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  assignmentText: { color: "#555", fontSize: 12 },
  assignmentBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeOk: { backgroundColor: "#E8F5E9" },
  badgeWarn: { backgroundColor: "#FFF3E0" },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#333" },

  helper: { marginTop: 10, color: "#757575", fontSize: 12, fontWeight: "600" },
  helperOk: { marginTop: 10, color: "#2E7D32", fontSize: 12, fontWeight: "800" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: { width: "100%", backgroundColor: "#fff", borderRadius: 18, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#1B5E20", marginBottom: 12 },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    paddingHorizontal: 6,
  },
  modalRowActive: { backgroundColor: "#F1F8E9" },
  modalRowText: { color: "#333" },
  modalRowTextActive: { color: "#2E7D32", fontWeight: "800" },
  modalClose: { marginTop: 12, paddingVertical: 12, alignItems: "center" },
  modalCloseText: { color: "#2E7D32", fontWeight: "800" },

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

  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  eventType: { fontWeight: "800", color: "#333" },
  eventMeta: { color: "#757575", marginTop: 2, fontSize: 12 },
  eventMetaSmall: { color: "#9E9E9E", marginTop: 4, fontSize: 11 },

  actionRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 16, borderRadius: 20, gap: 16, elevation: 1 },
  actionIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#FFEBEE", alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 15, fontWeight: "700", color: "#333" },
  actionSub: { fontSize: 12, color: "#757575" },
});