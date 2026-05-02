import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { captureUploadAndProcess } from "../../services/capturePipeline";
import { useTunnel } from "../../context/TunnelContext";

type CaptureMode = "auto" | "manual";

type PlantOption = {
  id: string;
  plantUid?: string | null;
  plantName?: string | null;
  rfidA?: string | null;
  rfidB?: string | null;
  row?: number | null;
  col?: number | null;
};

async function normalizeToPortraitJpeg(photo: any) {
  let out = await ImageManipulator.manipulateAsync(photo.uri, [], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  if (out.width > out.height) {
    out = await ImageManipulator.manipulateAsync(out.uri, [{ rotate: -90 }], {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    });
  }

  return out.uri;
}

export default function CameraScreen({ navigation }: any) {
  const cameraRef = useRef<any>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("auto");

  const [lastHandledRequestId, setLastHandledRequestId] = useState("");
  const [statusText, setStatusText] = useState("Waiting for robot stop…");

  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [selectedRFID, setSelectedRFID] = useState<string>("");

  const { selectedTunnel } = useTunnel();

  const tunnelId = selectedTunnel?.id ?? null;
  const robotId = selectedTunnel?.robotId ?? "ROBOT_01";

  const selectedPlant = useMemo(() => {
    return plants.find((p) => p.id === selectedPlantId) ?? null;
  }, [plants, selectedPlantId]);

  const selectedSide = useMemo(() => {
    if (!selectedPlant || !selectedRFID) return null;
    if (selectedPlant.rfidA === selectedRFID) return "A";
    if (selectedPlant.rfidB === selectedRFID) return "B";
    return null;
  }, [selectedPlant, selectedRFID]);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    async function loadPlants() {
      if (!tunnelId) {
        setPlants([]);
        setSelectedPlantId("");
        setSelectedRFID("");
        return;
      }

      try {
        const snap = await getDocs(collection(db, "tunnels", tunnelId, "plants"));

        const rows: PlantOption[] = snap.docs.map((d) => {
          const data: any = d.data();

          return {
            id: d.id,
            plantUid: data.plantUid ?? data.plantId ?? d.id,
            plantName: data.name ?? data.plantName ?? null,
            rfidA: data.rfidA ?? null,
            rfidB: data.rfidB ?? null,
            row: typeof data.row === "number" ? data.row : null,
            col: typeof data.col === "number" ? data.col : null,
          };
        });

        rows.sort((a, b) => {
          const ar = a.row ?? 9999;
          const br = b.row ?? 9999;
          const ac = a.col ?? 9999;
          const bc = b.col ?? 9999;

          if (ar !== br) return ar - br;
          if (ac !== bc) return ac - bc;
          return a.id.localeCompare(b.id);
        });

        setPlants(rows);

        if (rows.length > 0) {
          setSelectedPlantId((prev) => prev || rows[0].id);
          const firstRFID = rows[0].rfidA || rows[0].rfidB || "";
          setSelectedRFID((prev) => prev || firstRFID);
        }
      } catch (e: any) {
        console.log("[Camera] load plants failed:", e?.message ?? e);
        Alert.alert("Plants load failed", e?.message ?? "Could not load plants.");
      }
    }

    loadPlants();
  }, [tunnelId]);

  useEffect(() => {
    if (!selectedPlant) return;

    const validCurrent =
      selectedRFID &&
      (selectedRFID === selectedPlant.rfidA || selectedRFID === selectedPlant.rfidB);

    if (!validCurrent) {
      setSelectedRFID(selectedPlant.rfidA || selectedPlant.rfidB || "");
    }
  }, [selectedPlant, selectedRFID]);

  async function takePhotoAndProcess(params: {
    tunnelId?: string | null;
    plantId?: string | null;
    robotId?: string | null;
    requestId?: string | null;
    rfid?: string | null;
    side?: string | null;
    positionLabel?: string | null;
    stopIndex?: number | null;
    rounds?: number | null;
    direction?: string | null;
  }) {
    if (!cameraRef.current) throw new Error("Camera is not ready");

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.8,
      exif: false,
      skipProcessing: false,
    });

    if (!photo?.uri) throw new Error("No photo captured");

    const normalizedUri = await normalizeToPortraitJpeg(photo);

    return await captureUploadAndProcess({
      photoUri: normalizedUri,
      tunnelId: params.tunnelId ?? null,
      plantId: params.plantId ?? null,
      robotId: params.robotId ?? null,
      requestId: params.requestId ?? null,
      rfid: params.rfid ?? null,
      side: params.side ?? null,
      positionLabel: params.positionLabel ?? null,
      stopIndex: params.stopIndex ?? null,
      rounds: params.rounds ?? null,
      direction: params.direction ?? null,
    });
  }

  useEffect(() => {
    if (mode !== "auto") return;
    if (!robotId) return;

    const rref = doc(db, "robots", robotId);

    const unsub = onSnapshot(
      rref,
      async (snap) => {
        if (!snap.exists()) return;

        const r: any = snap.data();

        const captureStatus = r.captureStatus ?? "";
        const requestId = r.captureRequestId ?? "";

        console.log("[Camera] robot snapshot:", {
          robotId,
          captureStatus,
          requestId,
          plantId: r.capturePlantId ?? null,
        });

        if (captureStatus !== "REQUESTED") return;
        if (!requestId) return;
        if (requestId === lastHandledRequestId) return;
        if (processing) return;
        if (!isReady) return;

        const plantId = r.capturePlantId ?? null;

        try {
          setProcessing(true);
          setLastHandledRequestId(requestId);
          setStatusText(`Capturing ${r.capturePosition ?? "position"}…`);

          const payload = await takePhotoAndProcess({
            tunnelId,
            plantId,
            robotId,
            requestId,
            rfid: r.captureRFID ?? null,
            side: r.captureSide ?? null,
            positionLabel: r.capturePosition ?? null,
            stopIndex:
              typeof r.captureStopIndex === "number" ? r.captureStopIndex : null,
            rounds: typeof r.captureRounds === "number" ? r.captureRounds : null,
            direction: r.captureDirection ?? null,
          });

          console.log("[Camera] auto capture processed:", payload);

          setStatusText(
            `Processed ${r.capturePosition ?? "position"} - waiting for next robot stop…`
          );

          /**
           * IMPORTANT:
           * Do NOT update robot captureStatus to CAPTURED here.
           * The inference API already updates:
           * robots/{robotId}.captureStatus = "DECIDED"
           * robots/{robotId}.captureDecision = "SPRAY" | "NO_SPRAY"
           *
           * Updating CAPTURED here can overwrite DECIDED and make the robot wait forever.
           */
        } catch (e: any) {
          console.log("[Camera] AUTO CAPTURE ERROR:", e?.message, e);
          Alert.alert("Auto capture failed", e?.message ?? "Unknown error");

          try {
            await updateDoc(rref, {
              captureStatus: "DECIDED",
              captureDecision: "NO_SPRAY",
              sprayDurationMs: 0,
              captureError: e?.message ?? "Unknown error",
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            console.log("[Camera] failed to send safe decision:", err);
          }

          setStatusText("Auto capture failed. Safe NO_SPRAY decision sent.");
        } finally {
          setProcessing(false);
        }
      },
      (err) => {
        console.log("[Camera] robot listener error:", err);
        setStatusText("Robot listener error.");
      }
    );

    return () => unsub();
  }, [
    mode,
    robotId,
    tunnelId,
    isReady,
    processing,
    lastHandledRequestId,
  ]);

  const handleManualCapture = async () => {
    if (!tunnelId) {
      Alert.alert("No tunnel selected", "Please select a tunnel first.");
      return;
    }

    if (!selectedPlantId) {
      Alert.alert("Select plant", "Please select a plant before capture.");
      return;
    }

    if (!selectedRFID) {
      Alert.alert("Select RFID", "This plant does not have an RFID selected.");
      return;
    }

    try {
      setProcessing(true);
      setStatusText("Manual capture processing…");

      const payload = await takePhotoAndProcess({
        tunnelId,
        plantId: selectedPlantId,
        robotId: null,
        requestId: null,
        rfid: selectedRFID,
        side: selectedSide,
        positionLabel: "MANUAL",
        stopIndex: null,
        rounds: null,
        direction: null,
      });

      console.log("[Camera] manual capture processed:", payload);

      Alert.alert(
        "Done",
        `Manual capture processed for ${selectedPlant?.plantUid ?? selectedPlantId}.`
      );

      setStatusText("Manual capture completed.");
    } catch (e: any) {
      console.log("[Camera] MANUAL CAPTURE ERROR:", e?.message, e);
      Alert.alert("Manual capture failed", e?.message ?? "Unknown error");
      setStatusText("Manual capture failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePlantSelect = (plant: PlantOption) => {
    setSelectedPlantId(plant.id);
    setSelectedRFID(plant.rfidA || plant.rfidB || "");
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.centerText}>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>Camera permission is required.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setIsReady(true)}
      />

      <View style={styles.infoCard}>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "auto" && styles.modeBtnActive]}
            onPress={() => setMode("auto")}
            disabled={processing}
          >
            <Text
              style={[
                styles.modeText,
                mode === "auto" && styles.modeTextActive,
              ]}
            >
              Auto
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, mode === "manual" && styles.modeBtnActive]}
            onPress={() => setMode("manual")}
            disabled={processing}
          >
            <Text
              style={[
                styles.modeText,
                mode === "manual" && styles.modeTextActive,
              ]}
            >
              Manual
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.infoTitle}>
          {mode === "auto" ? "Robot Auto Capture" : "Manual Plant Capture"}
        </Text>

        <Text style={styles.infoText}>
          Tunnel: {selectedTunnel?.name ?? selectedTunnel?.tunnelName ?? "N/A"}
        </Text>

        {mode === "auto" ? (
          <>
            <Text style={styles.infoText}>Robot: {robotId}</Text>
            <Text style={processing ? styles.busy : styles.good}>
              {processing ? "Capturing + uploading + detecting…" : statusText}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.infoText}>Select Plant</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              {plants.map((plant) => {
                const active = plant.id === selectedPlantId;

                return (
                  <TouchableOpacity
                    key={plant.id}
                    style={[styles.plantChip, active && styles.chipActive]}
                    onPress={() => handlePlantSelect(plant)}
                    disabled={processing}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {plant.plantUid ?? plant.id}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.infoText}>Select RFID</Text>

            <View style={styles.rfidRow}>
              <TouchableOpacity
                style={[
                  styles.rfidChip,
                  selectedRFID === selectedPlant?.rfidA && styles.chipActive,
                  !selectedPlant?.rfidA && styles.disabledChip,
                ]}
                disabled={!selectedPlant?.rfidA || processing}
                onPress={() => setSelectedRFID(selectedPlant?.rfidA ?? "")}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedRFID === selectedPlant?.rfidA &&
                      styles.chipTextActive,
                  ]}
                >
                  A: {selectedPlant?.rfidA || "Not set"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.rfidChip,
                  selectedRFID === selectedPlant?.rfidB && styles.chipActive,
                  !selectedPlant?.rfidB && styles.disabledChip,
                ]}
                disabled={!selectedPlant?.rfidB || processing}
                onPress={() => setSelectedRFID(selectedPlant?.rfidB ?? "")}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedRFID === selectedPlant?.rfidB &&
                      styles.chipTextActive,
                  ]}
                >
                  B: {selectedPlant?.rfidB || "Not set"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={processing ? styles.busy : styles.good}>
              {processing ? "Manual capture processing…" : statusText}
            </Text>
          </>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.controlBtn}
          disabled={processing}
        >
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shutter, processing && styles.shutterDisabled]}
          disabled={processing || mode === "auto"}
          onPress={handleManualCapture}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons
              name={mode === "manual" ? "camera" : "radio"}
              size={34}
              color="#fff"
            />
          )}
        </TouchableOpacity>

        <View style={styles.controlBtn}>
          <Ionicons
            name={mode === "auto" ? "hardware-chip" : "leaf"}
            size={26}
            color="#fff"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  infoCard: {
    position: "absolute",
    top: 55,
    left: 14,
    right: 14,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  modeRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: "center",
  },
  modeBtnActive: {
    backgroundColor: "#00C853",
  },
  modeText: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "800",
  },
  modeTextActive: {
    color: "#fff",
  },
  infoTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 8,
  },
  infoText: {
    color: "#fff",
    fontWeight: "700",
    marginTop: 5,
  },
  good: {
    color: "#00E676",
    fontWeight: "900",
    marginTop: 10,
  },
  busy: {
    color: "#FFD54F",
    fontWeight: "900",
    marginTop: 10,
  },
  horizontalScroll: {
    marginTop: 8,
    marginBottom: 8,
  },
  plantChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    marginRight: 8,
  },
  rfidRow: {
    marginTop: 8,
    gap: 8,
  },
  rfidChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  chipActive: {
    backgroundColor: "#00C853",
    borderColor: "#00C853",
  },
  disabledChip: {
    opacity: 0.45,
  },
  chipText: {
    color: "#fff",
    fontWeight: "800",
  },
  chipTextActive: {
    color: "#fff",
  },
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
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 6,
    borderColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterDisabled: {
    opacity: 0.65,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "#000",
  },
  centerText: {
    color: "#fff",
    marginTop: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  btn: {
    backgroundColor: "#1E88E5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  btnText: {
    color: "#fff",
    fontWeight: "800",
  },
});