import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import { collection, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { captureUploadAndProcess } from "../../services/capturePipeline";
import { useTunnel } from "../../context/TunnelContext";

type ScanSummary = {
  counts?: { cucumber?: number; leaf?: number; flower?: number };
  sprayRecommended?: boolean;
  diseases?: string[];
};

type PlantListItem = {
  id: string; // doc id (e.g. r1_c2)
  plantUid?: string;
  plantName?: string;
  row?: number;
  column?: number;
};

async function normalizeToPortraitJpeg(photo: any) {
  // re-encode to remove EXIF orientation
  let out = await ImageManipulator.manipulateAsync(photo.uri, [], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  // force portrait if still landscape
  if (out.width > out.height) {
    out = await ImageManipulator.manipulateAsync(out.uri, [{ rotate: -90 }], {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    });
  }
  return out.uri;
}

export default function CameraScreen({ navigation }: any) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [lastSummary, setLastSummary] = useState<ScanSummary | null>(null);
  const [lastStatus, setLastStatus] = useState<"IDLE" | "DONE" | "FAILED">("IDLE");
  const [lastCaptureId, setLastCaptureId] = useState<string>("");

  // ✅ tunnels from context
  const { tunnels, selectedTunnelId, setSelectedTunnelId, selectedTunnel } = useTunnel();
  const tunnelId = selectedTunnel?.id ?? null;

  // ✅ plant selection
  const [plantId, setPlantId] = useState<string>(""); // doc id: r1_c2
  const [plants, setPlants] = useState<PlantListItem[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(false);

  // pickers
  const [showTunnelModal, setShowTunnelModal] = useState(false);
  const [showPlantModal, setShowPlantModal] = useState(false);
  const [plantSearch, setPlantSearch] = useState("");

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission]);

  // ✅ load plants for selected tunnel
  useEffect(() => {
    setPlantId(""); // reset when tunnel changes
    setPlantSearch("");
    setPlants([]);

    if (!tunnelId) return;

    setPlantsLoading(true);
    const ref = collection(db, "tunnels", tunnelId, "plants");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            plantUid: data.plantUid,
            plantName: data.plantName,
            row: data.row,
            column: data.column,
          } as PlantListItem;
        });

        // stable sort by row/col
        list.sort((a, b) => ((a.row ?? 0) - (b.row ?? 0)) || ((a.column ?? 0) - (b.column ?? 0)));
        setPlants(list);
        setPlantsLoading(false);
      },
      (err) => {
        console.log("plants snapshot error:", err?.code, err?.message);
        setPlantsLoading(false);
      }
    );

    return () => unsub();
  }, [tunnelId]);

  const filteredPlants = useMemo(() => {
    const q = plantSearch.trim().toLowerCase();
    if (!q) return plants;
    return plants.filter((p) => {
      const a = (p.id ?? "").toLowerCase();
      const b = (p.plantUid ?? "").toLowerCase();
      const c = (p.plantName ?? "").toLowerCase();
      return a.includes(q) || b.includes(q) || c.includes(q);
    });
  }, [plants, plantSearch]);

  const selectedPlantLabel = useMemo(() => {
    if (!plantId) return "Not selected";
    const p = plants.find((x) => x.id === plantId);
    if (!p) return plantId;
    return `${p.plantUid ?? p.id} (${p.id})`;
  }, [plantId, plants]);

  const handleCapture = async () => {
    try {
      setProcessing(true);
      setLastSummary(null);
      setLastStatus("IDLE");
      setLastCaptureId("");

      if (!tunnelId) {
        Alert.alert("Select tunnel", "Please select a tunnel first.");
        return;
      }
      if (!plantId.trim()) {
        Alert.alert("Select plant", "Please select a plant (or type a plant id like r1_c2) for testing.");
        return;
      }

      // @ts-ignore
      const photo = await cameraRef.current?.takePictureAsync?.({
        quality: 0.8,
        exif: false,
        skipProcessing: false,
      });

      if (!photo?.uri) throw new Error("No photo captured");
      const normalizedUri = await normalizeToPortraitJpeg(photo);

      const payload = await captureUploadAndProcess({
        photoUri: normalizedUri,
        tunnelId,
        plantId: plantId.trim(), // ✅ assigned
        robotId: null,
        requestId: null,
        rfid: null,
        side: null,
        positionLabel: "MANUAL",
        stopIndex: null,
        rounds: null,
        direction: null,
      });

      const summary = payload?.outputs?.summary ?? null;

      setLastSummary(summary);
      setLastCaptureId(payload.captureId);
      setLastStatus("DONE");
    } catch (e: any) {
      console.log("CAPTURE ERROR:", e?.message, e);
      setLastStatus("FAILED");
      Alert.alert("Scan failed", e?.message ?? "Unknown error");
    } finally {
      setProcessing(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 10 }}>Camera permission is required.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.btn}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const c = lastSummary?.counts ?? {};
  const cuc = c.cucumber ?? 0;
  const leaf = c.leaf ?? 0;
  const flower = c.flower ?? 0;

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" onCameraReady={() => setIsReady(true)} />

      {/* ✅ Testing assignment controls */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Manual Test Capture</Text>

        {/* Tunnel selector */}
        <View style={styles.row}>
          <Text style={styles.infoText}>
            Tunnel: {selectedTunnel?.name ?? selectedTunnel?.tunnelName ?? "Not selected"}
          </Text>
          <TouchableOpacity onPress={() => setShowTunnelModal(true)} disabled={processing} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Plant selector */}
        <View style={[styles.row, { marginTop: 8 }]}>
          <Text style={styles.infoText} numberOfLines={1}>
            Plant: {selectedPlantLabel}
          </Text>
          <TouchableOpacity
            onPress={() => setShowPlantModal(true)}
            disabled={processing || !tunnelId}
            style={[styles.smallBtn, (!tunnelId || plantsLoading) && { opacity: 0.6 }]}
          >
            <Text style={styles.smallBtnText}>{plantsLoading ? "Loading..." : "Pick"}</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          value={plantId}
          onChangeText={setPlantId}
          placeholder="Or type plant id (e.g. r1_c2)"
          placeholderTextColor="rgba(255,255,255,0.55)"
          autoCapitalize="none"
          style={styles.input}
          editable={!processing}
        />

        {/* Status */}
        <View style={{ marginTop: 10 }}>
          <Text style={styles.infoText}>Status:</Text>

          {processing ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.infoText}>Uploading + Detecting…</Text>
            </View>
          ) : lastStatus === "DONE" ? (
            <>
              <Text style={styles.good}>✅ Scan Complete</Text>
              <Text style={styles.infoText}>Cucumber: {cuc} • Leaf: {leaf} • Flower: {flower}</Text>

              {!!lastCaptureId && (
                <TouchableOpacity
                  style={[styles.resultBtn]}
                  onPress={() => navigation.navigate("ScanPreview", { captureId: lastCaptureId })}
                >
                  <Ionicons name="image-outline" size={16} color="#fff" />
                  <Text style={styles.resultBtnText}>View Result</Text>
                </TouchableOpacity>
              )}
            </>
          ) : lastStatus === "FAILED" ? (
            <Text style={styles.bad}>❌ Scan Failed</Text>
          ) : (
            <Text style={styles.infoText}>Press capture to scan.</Text>
          )}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.controlBtn} disabled={processing}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCapture}
          disabled={!isReady || processing}
          style={[styles.shutter, (!isReady || processing) && { opacity: 0.5 }]}
        />

        <View style={{ width: 56 }} />
      </View>

      {/* Tunnel picker modal */}
      <Modal visible={showTunnelModal} transparent animationType="slide" onRequestClose={() => setShowTunnelModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Tunnel</Text>
              <TouchableOpacity onPress={() => setShowTunnelModal(false)}>
                <Ionicons name="close-circle" size={28} color="#9E9E9E" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={tunnels}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => {
                const active = item.id === selectedTunnelId;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, active && styles.modalItemActive]}
                    onPress={() => {
                      setSelectedTunnelId(item.id);
                      setShowTunnelModal(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, active && { color: "#fff" }]}>
                      {item.name ?? item.tunnelName ?? "Tunnel"}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Plant picker modal */}
      <Modal visible={showPlantModal} transparent animationType="slide" onRequestClose={() => setShowPlantModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Plant</Text>
              <TouchableOpacity onPress={() => setShowPlantModal(false)}>
                <Ionicons name="close-circle" size={28} color="#9E9E9E" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={plantSearch}
              onChangeText={setPlantSearch}
              placeholder="Search (r1_c2, Plant name, UID)"
              style={styles.search}
              editable={!processing}
            />

            <FlatList
              data={filteredPlants}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => {
                const active = item.id === plantId;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, active && styles.modalItemActive]}
                    onPress={() => {
                      setPlantId(item.id);
                      setShowPlantModal(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, active && { color: "#fff" }]}>
                      {item.plantUid ?? item.id} • {item.id}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={{ color: "#757575", padding: 12 }}>No plants found.</Text>}
            />

            <TouchableOpacity
              style={[styles.clearBtn]}
              onPress={() => {
                setPlantId("");
                setShowPlantModal(false);
              }}
            >
              <Text style={{ fontWeight: "900", color: "#757575" }}>Clear Plant</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  infoCard: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  infoTitle: { color: "#fff", fontWeight: "900", marginBottom: 8, fontSize: 15 },
  infoText: { color: "#fff", fontWeight: "700", marginTop: 4, flex: 1 },
  good: { color: "#00E676", fontWeight: "900", marginTop: 8 },
  bad: { color: "#FF5252", fontWeight: "900", marginTop: 8 },

  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  smallBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  input: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    color: "#fff",
    fontWeight: "800",
  },

  resultBtn: {
    marginTop: 10,
    backgroundColor: "#2E7D32",
    borderRadius: 14,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  resultBtnText: { color: "#fff", fontWeight: "900" },

  controls: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 18,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 6,
    borderColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  btn: { backgroundColor: "#1E88E5", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },

  // modals
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: "75%",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#1B5E20" },

  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F5F5F5",
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalItemActive: { backgroundColor: "#2E7D32" },
  modalItemText: { fontWeight: "900", color: "#333" },

  search: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    padding: 12,
    marginBottom: 12,
    fontWeight: "800",
  },

  clearBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#EEE",
    alignItems: "center",
  },
});