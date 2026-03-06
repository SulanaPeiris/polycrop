import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";

function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return 0;
}

export default function ZoneNodesScreen() {
  useTunnelHeader("Zones / Nodes");

  // ✅ assumes TunnelContext provides these (recommended)
  const {
    tunnels = [],
    selectedTunnel,
    selectedTunnelId,
    setSelectedTunnelId,
  }: any = useTunnel();

  // Target tunnel for assignment (dropdown)
  const [targetTunnelId, setTargetTunnelId] = useState<string>(selectedTunnel?.id ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Keep target tunnel synced when global selection changes
  useEffect(() => {
    if (selectedTunnel?.id) setTargetTunnelId(selectedTunnel.id);
  }, [selectedTunnel?.id]);

  const targetTunnel = useMemo(
    () => tunnels.find((t: any) => t.id === targetTunnelId) || selectedTunnel,
    [tunnels, targetTunnelId, selectedTunnel]
  );

  const tunnelId = targetTunnel?.id ?? "";
  const tunnelName = targetTunnel?.name ?? "Select a tunnel";

  const [gateways, setGateways] = useState<any[]>([]);
  const [assigningId, setAssigningId] = useState<string>("");

  useEffect(() => {
    return onSnapshot(
      collection(db, "loraGateways"),
      (snap) => setGateways(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
      (err) => {
        console.log("loraGateways listener error:", err);
        setGateways([]);
      }
    );
  }, []);

  const assignGateway = async (gatewayId: string) => {
    if (!tunnelId) {
      Alert.alert("No tunnel selected", "Select a tunnel first from the dropdown.");
      return;
    }
    try {
      setAssigningId(gatewayId);

      await setDoc(
        doc(db, "loraGateways", gatewayId),
        {
          gatewayId,
          assignedTunnelId: tunnelId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      Alert.alert("Assigned", `${gatewayId} assigned to ${tunnelName}`);
    } catch (e: any) {
      console.log("assignGateway error:", e);
      Alert.alert("Error", e?.message ?? "Failed to assign gateway.");
    } finally {
      setAssigningId("");
    }
  };

  const onlineText = (g: any) => {
    const ms = tsToMs(g.lastSeenAt);
    if (!ms) return "UNKNOWN";
    return Date.now() - ms < 60_000 ? "ONLINE" : "OFFLINE";
  };

  const assignedToThisTunnel = useMemo(() => {
    if (!tunnelId) return [];
    return gateways.filter((g) => (g.assignedTunnelId ?? "") === tunnelId);
  }, [gateways, tunnelId]);

  const pickTunnel = (t: any) => {
    setTargetTunnelId(t.id);

    // ✅ Optional: also update global selected tunnel so other screens stay consistent
    if (typeof setSelectedTunnelId === "function") {
      setSelectedTunnelId(t.id);
    }

    setPickerOpen(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Tunnel Dropdown */}
      <SectionTitle title="Assign To Tunnel" />
      <View style={styles.card}>
        <Text style={styles.small}>Target Tunnel</Text>
        <Text style={styles.big}>{tunnelName}</Text>
        <Text style={styles.small}>Tunnel ID: {tunnelId || "N/A"}</Text>

        <TouchableOpacity style={styles.changeBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.85}>
          <Ionicons name="chevron-down" size={18} color="#fff" />
          <Text style={styles.changeBtnText}>Select Tunnel</Text>
        </TouchableOpacity>

        <Text style={styles.tip}>
          Select a tunnel here, then press the link button on a gateway to assign it.
        </Text>
      </View>

      {/* Tunnel picker modal */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Tunnel</Text>

            {tunnels.length === 0 ? (
              <Text style={styles.small}>No tunnels found. Create a tunnel first.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {tunnels.map((t: any) => {
                  const active = t.id === (targetTunnelId || selectedTunnelId);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.modalRow, active && styles.modalRowActive]}
                      onPress={() => pickTunnel(t)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.modalRowText, active && styles.modalRowTextActive]}>{t.name}</Text>
                      {active ? <Ionicons name="checkmark-circle" size={20} color="#2E7D32" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalClose} onPress={() => setPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Assigned Gateways */}
      <SectionTitle title="Assigned Gateways (to selected tunnel)" />
      <View style={styles.card}>
        {assignedToThisTunnel.length === 0 ? (
          <Text style={styles.small}>No gateway assigned to this tunnel.</Text>
        ) : (
          assignedToThisTunnel.map((g) => (
            <View key={g.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{g.gatewayId ?? g.id}</Text>
                <Text style={styles.rowSub}>
                  {onlineText(g)} • RSSI {g.lastRssi ?? "N/A"} • SNR {g.lastSnr ?? "N/A"}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color="#2E7D32" />
            </View>
          ))
        )}
      </View>

      {/* All Gateways */}
      <SectionTitle title="All Gateways" />
      <View style={styles.card}>
        {gateways.length === 0 ? (
          <Text style={styles.small}>No gateways found. Receiver will create it when running.</Text>
        ) : (
          gateways.map((g) => {
            const gid = g.gatewayId ?? g.id;
            const status = onlineText(g);
            const isThis = g.assignedTunnelId === tunnelId;

            return (
              <View key={g.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{gid}</Text>
                  <Text style={styles.rowSub}>
                    {status} • RSSI {g.lastRssi ?? "N/A"} • SNR {g.lastSnr ?? "N/A"}
                  </Text>
                  <Text style={styles.rowSub}>
                    AssignedTunnelId: {g.assignedTunnelId ?? "NOT SET"} {isThis ? "(this tunnel)" : ""}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.assignBtn, isThis && { backgroundColor: "#E8F5E9" }]}
                  onPress={() => assignGateway(gid)}
                  disabled={assigningId === gid}
                  activeOpacity={0.85}
                >
                  {assigningId === gid ? (
                    <ActivityIndicator />
                  ) : (
                    <Ionicons
                      name={isThis ? "link" : "link-outline"}
                      size={18}
                      color={isThis ? "#2E7D32" : "#333"}
                    />
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },

  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, elevation: 1, marginBottom: 16 },
  big: { fontSize: 16, fontWeight: "900", color: "#333", marginTop: 4 },
  small: { marginTop: 6, color: "#757575", fontWeight: "600" },
  tip: { marginTop: 10, color: "#9E9E9E", fontSize: 12, fontWeight: "600" },

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

  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  rowTitle: { fontSize: 14, fontWeight: "800", color: "#333" },
  rowSub: { marginTop: 4, color: "#757575", fontSize: 12, fontWeight: "600" },

  assignBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },

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
});