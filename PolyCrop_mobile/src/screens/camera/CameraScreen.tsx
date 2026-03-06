import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";

import { captureUploadAndProcess } from "../../services/capturePipeline";
import { useTunnel } from "../../context/TunnelContext";

type ScanSummary = {
  counts?: { cucumber?: number; leaf?: number; flower?: number };
  sprayRecommended?: boolean;
  diseases?: string[];
};

function exifOrientationToDegrees(o?: number) {
  // EXIF Orientation:
  // 1 = normal
  // 3 = 180
  // 6 = 90 CW
  // 8 = 90 CCW
  if (o === 3) return 180;
  if (o === 6) return 90;
  if (o === 8) return -90;
  return 0;
}

async function normalizeToPortraitJpeg(photo: any) {
  // 1) Re-encode to JPEG to remove EXIF orientation (NO rotate)
  let out = await ImageManipulator.manipulateAsync(
    photo.uri,
    [],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 2) If still landscape, force portrait by rotating ONCE
  if (out.width > out.height) {
    // choose -90 (if your device needs the other direction, change to +90)
    out = await ImageManipulator.manipulateAsync(
      out.uri,
      [{ rotate: -90 }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
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

  const { selectedTunnel } = useTunnel();

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission]);

  const handleCapture = async () => {
    try {
      setProcessing(true);
      setLastSummary(null);
      setLastStatus("IDLE");

      // ✅ Capture with EXIF so we can fix orientation
      // ✅ skipProcessing: false is important on Android (keeps correct rotation processing)
      // @ts-ignore
      const photo = await cameraRef.current?.takePictureAsync?.({
        quality: 0.8,
        exif: false,
        skipProcessing: false,
      });

      if (!photo?.uri) throw new Error("No photo captured");

      // ✅ FIX ORIENTATION BEFORE UPLOAD (makes Firebase Storage image stay vertical)
      const normalizedUri = await normalizeToPortraitJpeg(photo);

      // Upload -> Firestore doc -> backend draws boxes -> backend updates Firestore
      const payload = await captureUploadAndProcess({
        photoUri: normalizedUri,
        tunnelId: selectedTunnel?.id ?? null,
      });

      const summary = payload?.outputs?.summary ?? null;

      setLastSummary(summary);
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
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setIsReady(true)}
      />

      {/* Status info only (NO image preview) */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Scan Status</Text>

        {processing ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.infoText}>Uploading + Detecting…</Text>
          </View>
        ) : lastStatus === "DONE" ? (
          <>
            <Text style={styles.good}>✅ Scan Complete</Text>
            <Text style={styles.infoText}>Cucumber: {cuc}</Text>
            <Text style={styles.infoText}>Leaf: {leaf}</Text>
            <Text style={styles.infoText}>Flower: {flower}</Text>
          </>
        ) : lastStatus === "FAILED" ? (
          <Text style={styles.bad}>❌ Scan Failed</Text>
        ) : (
          <Text style={styles.infoText}>Press capture to scan.</Text>
        )}
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
  good: { color: "#00E676", fontWeight: "900", marginTop: 6 },
  bad: { color: "#FF5252", fontWeight: "900", marginTop: 6 },

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