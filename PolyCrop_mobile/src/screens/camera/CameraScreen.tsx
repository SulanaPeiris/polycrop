// src/screens/camera/CameraScreen.tsx
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
import { useIsFocused } from "@react-navigation/native";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";

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

export default function CameraScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);

  // shared processing lock
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  // ✅ Auto capture ON by default
  const [autoEnabled, setAutoEnabled] = useState(true);

  // prevent duplicate handling (auto capture)
  const [lastHandledRequestId, setLastHandledRequestId] = useState<string>("");
  const lastHandledRequestIdRef = useRef("");
  useEffect(() => {
    lastHandledRequestIdRef.current = lastHandledRequestId;
  }, [lastHandledRequestId]);

  // manual result
  const [lastSummary, setLastSummary] = useState<ScanSummary | null>(null);
  const [lastStatus, setLastStatus] = useState<"IDLE" | "DONE" | "FAILED">("IDLE");
  const [lastCaptureId, setLastCaptureId] = useState<string>("");

  // tunnels from context
  const { tunnels, selectedTunnelId, setSelectedTunnelId, selectedTunnel } = useTunnel();
  const tunnelId = selectedTunnel?.id ?? null;
  const robotId = selectedTunnel?.robotId ?? "ROBOT_01";

  // manual plant selection
  const [plantId, setPlantId] = useState<string>(""); // doc id: r1_c2
  const [plants, setPlants] = useState<PlantListItem[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(false);

  // pickers
  const [showTunnelModal, setShowTunnelModal] = useState(false);
  const [showPlantModal, setShowPlantModal] = useState(false);
  const [plantSearch, setPlantSearch] = useState("");

  // permissions
  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted]);

  // ✅ load plants for selected tunnel (manual mode)
  useEffect(() => {
    setPlantId("");
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

  // ✅ Robust capture helper (prevents "Image could not be captured")
  const takePhotoSafe = async (): Promise<string> => {
    const cam: any = cameraRef.current;

    if (!isFocused) throw new Error("Camera screen not focused");
    if (!isReady) throw new Error("Camera not ready");

    if (!cam?.takePictureAsync) throw new Error("Camera not ready");

    // small delay helps a lot (Android warm-up)
    await new Promise((r) => setTimeout(r, 250));

    let lastErr: any = null;

    for (let i = 0; i < 3; i++) {
      try {
        const photo = await cam.takePictureAsync({
          quality: 0.75,
          exif: false,
          // ✅ more reliable than true on many Android devices
          skipProcessing: false,
        });

        if (photo?.uri) return photo.uri;
        lastErr = new Error("No photo uri");
      } catch (e: any) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    throw new Error(lastErr?.message ?? "Image could not be captured");
  };

  // ✅ AUTO CAPTURE: listens to Firestore robots/{robotId}
  useEffect(() => {
    if (!robotId) return;

    const rref = doc(db, "robots", robotId);

    const unsub = onSnapshot(
      rref,
      async (snap) => {
        try {
          if (!snap.exists()) return;
          if (!autoEnabled) return;
          if (!isFocused) return;
          if (!isReady) return;

          const r: any = snap.data();
          const status = r.captureStatus ?? "";
          const requestId = r.captureRequestId ?? "";

          if (status !== "REQUESTED") return;
          if (!requestId) return;

          // prevent duplicates
          if (requestId === lastHandledRequestIdRef.current) return;

          // ✅ immediate lock (before setState)
          if (processingRef.current) return;
          processingRef.current = true;

          setProcessing(true);
          setLastHandledRequestId(requestId);

          // Prefer robot-provided ids
          const reqTunnelId = r.captureTunnelId ?? tunnelId;
          const reqPlantId = r.capturePlantId ?? null;

          if (!reqTunnelId || !reqPlantId) {
            // don't keep robot waiting forever
            try {
              await updateDoc(rref, {
                captureStatus: "DECIDED",
                captureDecision: "NO_SPRAY",
                sprayDurationMs: 0,
                updatedAt: serverTimestamp(),
              });
            } catch {}
            return;
          }

          // take photo
          const uri = await takePhotoSafe();

          const payload = await captureUploadAndProcess({
            photoUri: uri, // ✅ capturePipeline will resize/compress (768px, 0.7)
            tunnelId: reqTunnelId,
            plantId: reqPlantId,

            robotId,
            requestId,

            rfid: r.captureRFID ?? null,
            side: r.captureSide ?? null,
            positionLabel: r.capturePosition ?? null,
            stopIndex: typeof r.captureStopIndex === "number" ? r.captureStopIndex : null,
            rounds: typeof r.captureRounds === "number" ? r.captureRounds : null,
            direction: r.captureDirection ?? null,
          });

          // ACK robot: capture uploaded; backend will publish DECIDED to RTDB
          await updateDoc(rref, {
            captureStatus: "CAPTURED",
            captureId: payload.captureId,
            captureImageUrl: payload.imageUrl ?? null,
            updatedAt: serverTimestamp(),
          });
        } catch (e: any) {
          console.log("AUTO CAPTURE ERROR:", e?.message, e);
          Alert.alert("Auto capture failed", e?.message ?? "Unknown error");

          // ensure robot doesn't wait forever
          try {
            await updateDoc(doc(db, "robots", robotId), {
              captureStatus: "DECIDED",
              captureDecision: "NO_SPRAY",
              sprayDurationMs: 0,
              updatedAt: serverTimestamp(),
            });
          } catch {}
        } finally {
          processingRef.current = false;
          setProcessing(false);
        }
      },
      (err) => console.log("robot listener error:", err)
    );

    return () => unsub();
  }, [robotId, tunnelId, isReady, autoEnabled, isFocused]);

  // ✅ MANUAL CAPTURE (uses selected tunnel/plant)
  const handleManualCapture = async () => {
    try {
      setProcessing(true);
      processingRef.current = true;

      setLastSummary(null);
      setLastStatus("IDLE");
      setLastCaptureId("");

      if (!tunnelId) {
        Alert.alert("Select tunnel", "Please select a tunnel first.");
        return;
      }
      if (!plantId.trim()) {
        Alert.alert("Select plant", "Please select a plant (or type a plant id like r1_c2).");
        return;
      }

      const uri = await takePhotoSafe();

      const payload = await captureUploadAndProcess({
        photoUri: uri, // ✅ capturePipeline will resize/compress (768px, 0.7)
        tunnelId,
        plantId: plantId.trim(),
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
      console.log("MANUAL CAPTURE ERROR:", e?.message, e);
      setLastStatus("FAILED");
      Alert.alert("Scan failed", e?.message ?? "Unknown error");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  // UI guards
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
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        active={isFocused} // ✅ prevents capture when unfocused
        mode="picture"
        onCameraReady={() => setIsReady(true)}
      />

      {/* Combined Info */}
      <View style={styles.infoCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.infoTitle}>Camera</Text>

          <TouchableOpacity
            style={[styles.autoToggle, { backgroundColor: autoEnabled ? "#2E7D32" : "rgba(255,255,255,0.15)" }]}
            onPress={() => setAutoEnabled((v) => !v)}
            disabled={processing}
          >
            <Ionicons name={autoEnabled ? "radio" : "radio-outline"} size={16} color="#fff" />
            <Text style={styles.autoToggleText}>{autoEnabled ? "AUTO ON" : "AUTO OFF"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.infoText}>Tunnel: {selectedTunnel?.name ?? selectedTunnel?.tunnelName ?? "N/A"}</Text>
        <Text style={styles.infoText}>Robot: {robotId}</Text>

        {processing ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.infoText}>Capturing + Uploading + Detecting…</Text>
          </View>
        ) : autoEnabled ? (
          <Text style={styles.good}>Waiting for robot stop…</Text>
        ) : (
          <Text style={styles.infoText}>Auto capture is OFF (manual only)</Text>
        )}

        {/* Manual assignment row */}
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 10 }}>
          <Text style={[styles.infoTitle, { fontSize: 13 }]}>Manual Test</Text>

          <View style={styles.row}>
            <Text style={styles.infoText} numberOfLines={1}>
              Plant: {selectedPlantLabel}
            </Text>

            <TouchableOpacity onPress={() => setShowTunnelModal(true)} disabled={processing} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Tunnel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowPlantModal(true)}
              disabled={processing || !tunnelId}
              style={[styles.smallBtn, (!tunnelId || plantsLoading) && { opacity: 0.6 }]}
            >
              <Text style={styles.smallBtnText}>{plantsLoading ? "Loading" : "Plant"}</Text>
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

          {lastStatus === "DONE" ? (
            <>
              <Text style={styles.good}>✅ Manual Scan Complete</Text>
              <Text style={styles.infoText}>Cucumber: {cuc} • Leaf: {leaf} • Flower: {flower}</Text>

              {!!lastCaptureId && (
                <TouchableOpacity
                  style={styles.resultBtn}
                  onPress={() => navigation.navigate("ScanPreview", { captureId: lastCaptureId })}
                >
                  <Ionicons name="image-outline" size={16} color="#fff" />
                  <Text style={styles.resultBtnText}>View Result</Text>
                </TouchableOpacity>
              )}
            </>
          ) : lastStatus === "FAILED" ? (
            <Text style={styles.bad}>❌ Manual Scan Failed</Text>
          ) : null}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.controlBtn} disabled={processing}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Shutter = manual capture */}
        <TouchableOpacity
          onPress={handleManualCapture}
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
              keyExtractor={(t: any) => t.id}
              renderItem={({ item }: any) => {
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
              style={styles.clearBtn}
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
  good: { color: "#00E676", fontWeight: "900", marginTop: 10 },
  bad: { color: "#FF5252", fontWeight: "900", marginTop: 10 },

  autoToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  autoToggleText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },

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