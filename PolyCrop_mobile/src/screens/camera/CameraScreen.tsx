import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { captureUploadAndProcess } from "../../services/capturePipeline";
import { useTunnel } from "../../context/TunnelContext";

async function normalizeToPortraitJpeg(photo: any) {
  // Remove EXIF orientation by re-encoding
  let out = await ImageManipulator.manipulateAsync(photo.uri, [], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  // Force portrait if still landscape
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
  const [lastHandledRequestId, setLastHandledRequestId] = useState<string>("");

  const { selectedTunnel } = useTunnel();
  const tunnelId = selectedTunnel?.id ?? null;
  const robotId = selectedTunnel?.robotId ?? "ROBOT_01";

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission]);

  // ✅ Auto capture when robot requests it
  useEffect(() => {
    if (!robotId) return;

    const rref = doc(db, "robots", robotId);
    const unsub = onSnapshot(
      rref,
      async (snap) => {
        if (!snap.exists()) return;
        const r: any = snap.data();

        const status = r.captureStatus ?? "";
        const requestId = r.captureRequestId ?? "";

        if (status !== "REQUESTED") return;
        if (!requestId) return;

        if (requestId === lastHandledRequestId) return;
        if (processing) return;
        if (!isReady) return;

        const plantId = r.capturePlantId ?? null;

        try {
          setProcessing(true);
          setLastHandledRequestId(requestId);

          // Take photo
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
            plantId,

            robotId,
            requestId,

            rfid: r.captureRFID ?? null,
            side: r.captureSide ?? null,
            positionLabel: r.capturePosition ?? null,
            stopIndex: typeof r.captureStopIndex === "number" ? r.captureStopIndex : null,
            rounds: typeof r.captureRounds === "number" ? r.captureRounds : null,
            direction: r.captureDirection ?? null,
          });

          // ACK robot: capture is ready (backend will later set DECIDED)
          await updateDoc(rref, {
            captureStatus: "CAPTURED",
            captureId: payload.captureId,
            captureImageUrl: payload.imageUrl ?? null,
            updatedAt: serverTimestamp(),
          });
        } catch (e: any) {
          console.log("AUTO CAPTURE ERROR:", e?.message, e);
          Alert.alert("Auto capture failed", e?.message ?? "Unknown error");

          // Ensure robot doesn't wait forever
          try {
            await updateDoc(rref, {
              captureStatus: "DECIDED",
              captureDecision: "NO_SPRAY",
              sprayDurationMs: 0,
              updatedAt: serverTimestamp(),
            });
          } catch {}
        } finally {
          setProcessing(false);
        }
      },
      (err) => console.log("robot listener error:", err)
    );

    return () => unsub();
  }, [robotId, tunnelId, isReady, processing, lastHandledRequestId]);

  const handleManualCapture = async () => {
    try {
      setProcessing(true);

      // @ts-ignore
      const photo = await cameraRef.current?.takePictureAsync?.({
        quality: 0.8,
        exif: false,
        skipProcessing: false,
      });

      if (!photo?.uri) throw new Error("No photo captured");
      const normalizedUri = await normalizeToPortraitJpeg(photo);

      await captureUploadAndProcess({
        photoUri: normalizedUri,
        tunnelId,
        plantId: null,
        robotId: null,
        requestId: null,
        rfid: null,
        side: null,
        positionLabel: null,
        stopIndex: null,
        rounds: null,
        direction: null,
      });

      Alert.alert("Done", "Manual capture processed.");
    } catch (e: any) {
      Alert.alert("Capture failed", e?.message ?? "Unknown error");
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

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setIsReady(true)}
      />

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Robot Auto Capture</Text>
        <Text style={styles.infoText}>Tunnel: {selectedTunnel?.name ?? selectedTunnel?.tunnelName ?? "N/A"}</Text>
        <Text style={styles.infoText}>Robot: {robotId}</Text>

        {processing ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.infoText}>Capturing + Uploading + Detecting…</Text>
          </View>
        ) : (
          <Text style={styles.good}>Waiting for robot stop…</Text>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.controlBtn} disabled={processing}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleManualCapture}
          disabled={!isReady || processing}
          style={[styles.shutter, (!isReady || processing) && { opacity: 0.5 }]}
        />

        <View style={{ width: 56 }} />
      </View>
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
  infoTitle: { color: "#fff", fontWeight: "900", marginBottom: 8 },
  infoText: { color: "#fff", fontWeight: "700", marginTop: 4 },
  good: { color: "#00E676", fontWeight: "900", marginTop: 10 },

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
});
