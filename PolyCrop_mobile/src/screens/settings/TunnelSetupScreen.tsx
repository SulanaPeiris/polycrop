import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { updateTunnel } from "../../services/tunnels";
import { bindRFIDToPlantSide, unbindRFIDSide, updatePlant } from "../../services/plants";

type PlantDoc = {
  plantUid: string;
  plantName: string;
  row: number;
  column: number;
  rfidA?: string | null;
  rfidB?: string | null;
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
  const [rfidA, setRfidA] = useState("");
  const [rfidB, setRfidB] = useState("");

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

  const plantsByCoord = useMemo(() => {
    const map: Record<string, { id: string } & PlantDoc> = {};
    for (const p of plants) map[`r${p.row}_c${p.column}`] = p;
    return map;
  }, [plants]);

  // ✅ setup complete if every plant has at least 1 RFID (A or B)
  const assignedCount = useMemo(() => plants.filter((p) => !!p.rfidA || !!p.rfidB).length, [plants]);
  const totalPlants = rows * cols;

  const openPlant = (p: { id: string } & PlantDoc) => {
    setActivePlant(p);
    setPlantName(p.plantName ?? "");
    setRfidA((p.rfidA ?? "") as string);
    setRfidB((p.rfidB ?? "") as string);
    setOpen(true);
  };

  const savePlant = async () => {
    if (!activePlant) return;

    const nextName = plantName.trim();
    const nextA = rfidA.trim().toUpperCase();
    const nextB = rfidB.trim().toUpperCase();

    const prevA = (activePlant.rfidA ?? "").trim().toUpperCase();
    const prevB = (activePlant.rfidB ?? "").trim().toUpperCase();

    if (nextName.length < 2) {
      Alert.alert("Invalid name", "Plant name is too short.");
      return;
    }

    if (nextA && nextB && nextA === nextB) {
      Alert.alert("Invalid RFID", "RFID A and RFID B must be different.");
      return;
    }

    const usedByOtherPlant = (rfid: string) =>
      plants.some((p) => {
        if (p.id === activePlant.id) return false;
        const a = (p.rfidA ?? "").trim().toUpperCase();
        const b = (p.rfidB ?? "").trim().toUpperCase();
        return rfid === a || rfid === b;
      });

    if (nextA && usedByOtherPlant(nextA)) {
      Alert.alert("Duplicate RFID", `RFID A (${nextA}) is already used in another plant.`);
      return;
    }
    if (nextB && usedByOtherPlant(nextB)) {
      Alert.alert("Duplicate RFID", `RFID B (${nextB}) is already used in another plant.`);
      return;
    }

    try {
      // 1) update name always
      await updatePlant(tunnelId, activePlant.id, { plantName: nextName });

      // 2) Side A mapping updates
      if (prevA && prevA !== nextA) await unbindRFIDSide(tunnelId, activePlant.id, prevA, "A");
      if (nextA && prevA !== nextA) await bindRFIDToPlantSide(tunnelId, activePlant.id, nextA, "A");
      if (!nextA && prevA) await unbindRFIDSide(tunnelId, activePlant.id, prevA, "A");

      // 3) Side B mapping updates
      if (prevB && prevB !== nextB) await unbindRFIDSide(tunnelId, activePlant.id, prevB, "B");
      if (nextB && prevB !== nextB) await bindRFIDToPlantSide(tunnelId, activePlant.id, nextB, "B");
      if (!nextB && prevB) await unbindRFIDSide(tunnelId, activePlant.id, prevB, "B");

      setOpen(false);
      setActivePlant(null);
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? "Failed to save plant");
    }
  };

  const markSetupComplete = async () => {
    await updateTunnel(tunnelId, { setupCompleted: true });
    Alert.alert("Done", "Tunnel setup marked as complete.");
  };

  const tagCount = (p?: PlantDoc) => (p?.rfidA ? 1 : 0) + (p?.rfidB ? 1 : 0);
  const nodeBg = (p?: PlantDoc) => (tagCount(p) === 0 ? "#FFF3E0" : tagCount(p) === 1 ? "#FFFDE7" : "#E8F5E9");
  const dotColor = (p?: PlantDoc) => (tagCount(p) === 0 ? "#FB8C00" : tagCount(p) === 1 ? "#FBC02D" : "#2E7D32");

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>{tunnel?.name ?? tunnel?.tunnelName ?? "Tunnel"}</Text>
        <Text style={styles.headerSub}>
          {rows} rows × {cols} columns • RFID assigned {assignedCount}/{totalPlants || 0}
        </Text>

        {totalPlants > 0 && assignedCount === totalPlants ? (
          <TouchableOpacity style={styles.completeBtn} onPress={markSetupComplete}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.completeText}>Mark Setup Complete</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.tip}>Tip: tap a plant and enter RFID A/B (1 or 2 tags).</Text>
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
                    {tagCount(plant) > 0 ? <Ionicons name="radio" size={14} color="#2E7D32" style={{ marginTop: 6 }} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#FB8C00" }]} />
            <Text style={styles.legendText}>No RFID</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#FBC02D" }]} />
            <Text style={styles.legendText}>One side</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: "#2E7D32" }]} />
            <Text style={styles.legendText}>Both sides</Text>
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

            <Text style={styles.modalLabel}>RFID Tag A (Side A)</Text>
            <TextInput value={rfidA} onChangeText={setRfidA} style={styles.input} placeholder="Enter RFID A" autoCapitalize="characters" />

            <Text style={styles.modalLabel}>RFID Tag B (Side B)</Text>
            <TextInput value={rfidB} onChangeText={setRfidB} style={styles.input} placeholder="Enter RFID B" autoCapitalize="characters" />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E0E0E0" }]}
                onPress={() => { setRfidA(""); setRfidB(""); }}
              >
                <Text style={[styles.smallBtnText, { color: "#757575" }]}>Clear RFID</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: "#2E7D32" }]} onPress={savePlant}>
                <Text style={[styles.smallBtnText, { color: "#fff" }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>You can edit RFID anytime later from Settings → Tunnel Settings → Setup Plants.</Text>
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
