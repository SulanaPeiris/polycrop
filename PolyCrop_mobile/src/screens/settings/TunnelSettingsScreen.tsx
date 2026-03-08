import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebase";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { deleteTunnelCascade } from "../../services/tunnels";

type TunnelItem = {
  id: string;
  name?: string;
  tunnelName?: string;
  cropType: string;
  rows: number;
  columns: number;
  size?: string;
  status?: "GOOD" | "NEED_ATTENTION";
  setupCompleted?: boolean;
};

export default function TunnelSettingsScreen({ navigation }: any) {
  useTunnelHeader("Tunnel Settings");
  const { user } = useAuth();

  const [tunnels, setTunnels] = useState<TunnelItem[]>([]);

  useEffect(() => {
    if (!user) return;

    const qy = query(collection(db, "tunnels"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TunnelItem[];
        // sort client-side by createdAt desc (no index)
        list.sort((a: any, b: any) => (b?.createdAt?.seconds ?? 0) - (a?.createdAt?.seconds ?? 0));
        setTunnels(list);
      },
      (err) => console.log("tunnel settings snapshot err:", err)
    );

    return () => unsub();
  }, [user]);

  const confirmDelete = (t: TunnelItem) => {
    const title = t.name ?? t.tunnelName ?? "Tunnel";
    Alert.alert("Delete Tunnel", `Delete "${title}"?
This will also delete all plants and RFID map in this tunnel.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTunnelCascade(t.id);
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to delete tunnel");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate("AddTunnel")}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addText}>Add New Tunnel</Text>
      </TouchableOpacity>

      {tunnels.length === 0 ? <Text style={styles.helper}>No tunnels yet. Add one to start.</Text> : null}

      {tunnels.map((t) => {
        const status = t.status ?? "GOOD";
        const statusColor = status === "GOOD" ? "#2E7D32" : "#FB8C00";
        const title = t.name ?? t.tunnelName ?? "Tunnel";

        return (
          <View key={t.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{title}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor }]}>
                  <Text style={styles.badgeText}>{status}</Text>
                </View>
              </View>

              <Text style={styles.sub}>
                {t.cropType} • {t.rows}×{t.columns} {t.size ? `• ${t.size}` : ""}
              </Text>

              {!t.setupCompleted ? (
                <Text style={styles.warn}>Setup required: assign plant RFIDs</Text>
              ) : (
                <Text style={styles.ok}>Setup completed</Text>
              )}

              <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#E8F5E9" }]} onPress={() => navigation.navigate("EditTunnel", { tunnelId: t.id })}>
                  <Ionicons name="create-outline" size={16} color="#2E7D32" />
                  <Text style={[styles.actionText, { color: "#2E7D32" }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#E3F2FD" }]} onPress={() => navigation.navigate("TunnelSetup", { tunnelId: t.id })}>
                  <Ionicons name="grid-outline" size={16} color="#1565C0" />
                  <Text style={[styles.actionText, { color: "#1565C0" }]}>Setup Plants</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#FFEBEE" }]} onPress={() => confirmDelete(t)}>
                  <Ionicons name="trash-outline" size={16} color="#D32F2F" />
                  <Text style={[styles.actionText, { color: "#D32F2F" }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color="#BDBDBD" style={{ marginLeft: 10 }} />
          </View>
        );
      })}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },
  helper: { color: "#757575", marginTop: 10 },

  addBtn: {
    backgroundColor: "#2E7D32",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  addText: { color: "#fff", fontWeight: "900" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontWeight: "900", fontSize: 16, color: "#1B5E20", flex: 1, marginRight: 10 },
  sub: { marginTop: 6, color: "#666", fontWeight: "700" },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  warn: { marginTop: 6, color: "#FB8C00", fontWeight: "900" },
  ok: { marginTop: 6, color: "#2E7D32", fontWeight: "900" },

  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14 },
  actionText: { fontWeight: "900" },
});
