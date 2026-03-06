import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { updateTunnel } from "../../services/tunnels";
import { updatePlant } from "../../services/plants";

type PlantDoc = {
  plantUid: string;
  plantName: string;
  row: number;
  column: number;
  rfidTag?: string | null;
};

export default function TunnelSetupScreen({ route }: any) {
  const { tunnelId } = route.params as { tunnelId: string };
  useTunnelHeader("Setup Tunnel");

  const [tunnel, setTunnel] = useState<any>(null);
  const [plants, setPlants] = useState<Array<{ id: string } & PlantDoc>>([]);
  const [loading, setLoading] = useState(true);

  // modal edit
  const [open, setOpen] = useState(false);
  const [activePlant, setActivePlant] = useState<{ id: string } & PlantDoc | null>(null);
  const [plantName, setPlantName] = useState("");
  const [rfidTag, setRfidTag] = useState("");

  useEffect(() => {
    let unsubPlants: any = null;

    (async () => {
      const tSnap = await getDoc(doc(db, "tunnels", tunnelId));
      if (tSnap.exists()) setTunnel({ id: tSnap.id, ...(tSnap.data() as any) });

      const plantsRef = collection(db, "tunnels", tunnelId, "plants");
      unsubPlants = onSnapshot(
        plantsRef,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Array<{ id: string } & PlantDoc>;
          // sort by row/column for stable grid
          list.sort((a, b) => (a.row - b.row) || (a.column - b.column));
          setPlants(list);
          setLoading(false);
        },
        (err) => {
          console.log("plants snapshot error:", err?.code, err?.message);
          setLoading(false);
        }
      );
    })();

    return () => unsubPlants?.();
  }, [tunnelId]);

  const rows = tunnel?.rows ?? 0;
  const cols = tunnel?.columns ?? 0;

  const plantsById = useMemo(() => {
    const map: Record<string, { id: string } & PlantDoc> = {};
    for (const p of plants) map[p.id] = p;
    return map;
  }, [plants]);

  const plantsByCoord = useMemo(() => {
    const map: Record<string, { id: string } & PlantDoc> = {};
    for (const p of plants) map[`r${p.row}_c${p.column}`] = p;
    return map;
  }, [plants]);

  const assignedCount = useMemo(() => plants.filter((p) => !!p.rfidTag).length, [plants]);
  const totalPlants = rows * cols;

  const openPlant = (p: { id: string } & PlantDoc) => {
    setActivePlant(p);
    setPlantName(p.plantName ?? "");
    setRfidTag(p.rfidTag ?? "");
    setOpen(true);
  };

  const savePlant = async () => {
    if (!activePlant) return;

    const nextName = plantName.trim();
    const nextRFID = rfidTag.trim();

    if (nextName.length < 2) {
      Alert.alert("Invalid name", "Plant name is too short.");
      return;
    }

    // prevent duplicate RFID inside the same tunnel (recommended)
    if (nextRFID) {
      const dup = plants.find((p) => p.id !== activePlant.id && (p.rfidTag ?? "").trim() === nextRFID);
      if (dup) {
        Alert.alert("Duplicate RFID", `This RFID is already used by ${dup.plantUid}.`);
        return;
      }
    }

    await updatePlant(tunnelId, activePlant.id, {
      plantName: nextName,
      rfidTag: nextRFID ? nextRFID : null,
    });

    setOpen(false);
    setActivePlant(null);
  };

  const markSetupComplete = async () => {
    await updateTunnel(tunnelId, { setupCompleted: true });
    Alert.alert("Done", "Tunnel setup marked as complete.");
  };

  const nodeBg = (p?: PlantDoc) => (!p?.rfidTag ? "#FFF3E0" : "#E8F5E9");
  const dotColor = (p?: PlantDoc) => (!p?.rfidTag ? "#FB8C00" : "#2E7D32");

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>{tunnel?.tunnelName ?? "Tunnel"}</Text>
        <Text style={styles.headerSub}>
          {rows} rows × {cols} columns • RFID assigned {assignedCount}/{totalPlants || 0}
        </Text>

        {totalPlants > 0 && assignedCount === totalPlants ? (
          <TouchableOpacity style={styles.completeBtn} onPress={markSetupComplete}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.completeText}>Mark Setup Complete</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.tip}>Tip: tap a plant and enter RFID.</Text>
        )}
      </View>

      <View style={styles.mapCard}>
        <Text style={styles.mapTitle}>Tunnel Map</Text>
        {loading ? <Text style={styles.helper}>Loading plants…</Text> : null}
        {!loading && plants.length === 0 ? <Text style={styles.helper}>No plants found for this tunnel.</Text> : null}

        <View style={styles.gridContainer}>
          {Array.from({ length: rows }).map((_, rIndex) => (
            <View key={`row-${rIndex}`} style={styles.row}>
              {Array.from({ length: cols }).map((_, cIndex) => {
                const plant = plantsByCoord[`r${rIndex + 1}_c${cIndex + 1}`];
                if (!plant) {
                  return <View key={`empty-${rIndex}-${cIndex}`} style={[styles.plantNode, { backgroundColor: "#F5F5F5" }]} />;
                }

                return (
                  <TouchableOpacity
                    key={plant.id}
                    style={[styles.plantNode, { backgroundColor: nodeBg(plant) }]}
                    onPress={() => openPlant(plant)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.dot, { backgroundColor: dotColor(plant) }]} />
                    {!!plant.rfidTag && <Ionicons name="radio" size={14} color="#2E7D32" style={{ marginTop: 6 }} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#FB8C00" }]} />
            <Text style={styles.legendText}>RFID missing</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#2E7D32" }]} />
            <Text style={styles.legendText}>RFID assigned</Text>
          </View>
        </View>
      </View>

      {/* Modal editor */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activePlant?.plantUid ?? "Plant"}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close-circle" size={28} color="#9E9E9E" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Plant Name</Text>
            <TextInput value={plantName} onChangeText={setPlantName} style={styles.input} placeholder="Plant name" />

            <Text style={styles.modalLabel}>RFID Tag</Text>
            <TextInput
              value={rfidTag}
              onChangeText={setRfidTag}
              style={styles.input}
              placeholder="Enter RFID (e.g., 04A3F9...)"
              autoCapitalize="characters"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E0E0E0" }]}
                onPress={() => setRfidTag("")}
              >
                <Text style={[styles.smallBtnText, { color: "#757575" }]}>Clear RFID</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: "#2E7D32" }]} onPress={savePlant}>
                <Text style={[styles.smallBtnText, { color: "#fff" }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>
              You can edit RFID anytime later from Settings → Setup Tunnel.
            </Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1, paddingBottom: 40 },

  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#1B5E20" },
  headerSub: { marginTop: 6, color: "#666", fontWeight: "600" },
  tip: { marginTop: 10, color: "#757575" },

  completeBtn: {
    marginTop: 12,
    backgroundColor: "#2E7D32",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  completeText: { color: "#fff", fontWeight: "900" },

  mapCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  mapTitle: { fontSize: 16, fontWeight: "900", color: "#1B5E20", marginBottom: 12 },
  helper: { color: "#757575" },

  gridContainer: { gap: 12, alignSelf: "center" },
  row: { flexDirection: "row", gap: 14, justifyContent: "center" },
  plantNode: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },

  legendRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 14, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendText: { color: "#616161", fontWeight: "600" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#1B5E20" },
  modalLabel: { marginTop: 10, fontWeight: "800", color: "#333" },
  input: {
    marginTop: 8,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 14 },
  smallBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  smallBtnText: { fontWeight: "900" },
  modalHint: { marginTop: 10, color: "#757575", fontSize: 12 },
});