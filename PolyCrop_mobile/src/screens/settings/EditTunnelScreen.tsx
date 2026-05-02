import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { CameraCalib, deleteTunnelCascade, updateTunnel } from "../../services/tunnels";
import { bindRobotToTunnel } from "../../services/robots";

function parseOptionalPositiveNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const num = Number(trimmed);
  return Number.isFinite(num) && num > 0 ? num : NaN;
}

export default function EditTunnelScreen({ navigation, route }: any) {
  const { tunnelId } = route.params as { tunnelId: string };
  useTunnelHeader("Edit Tunnel");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [origRobotId, setOrigRobotId] = useState<string>("");

  const [form, setForm] = useState({
    tunnelName: "",
    cropType: "",
    size: "",
    sensorCount: "",
    robotId: "",
    fertigationUnitId: "",
    status: "GOOD" as "GOOD" | "NEED_ATTENTION",
    rows: 0,
    columns: 0,
    baseDistanceCm: "",
    cmPerPxAtBaseDistance: "",
  });

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "tunnels", tunnelId));
      if (!snap.exists()) {
        Alert.alert("Not found", "Tunnel not found.");
        navigation.goBack();
        return;
      }

      const t = snap.data() as any;
      const name = t.name ?? t.tunnelName ?? "";
      const cameraCalib = t.cameraCalib ?? null;

      setOrigRobotId((t.robotId ?? "").trim());

      setForm({
        tunnelName: name,
        cropType: t.cropType ?? "",
        size: t.size ?? "",
        sensorCount: t.sensorCount ? String(t.sensorCount) : "",
        robotId: t.robotId ?? "",
        fertigationUnitId: t.fertigationUnitId ?? "",
        status: (t.status ?? "GOOD") as any,
        rows: t.rows ?? 0,
        columns: t.columns ?? 0,
        baseDistanceCm: cameraCalib?.baseDistanceCm
          ? String(cameraCalib.baseDistanceCm)
          : "",
        cmPerPxAtBaseDistance: cameraCalib?.cmPerPxAtBaseDistance
          ? String(cameraCalib.cmPerPxAtBaseDistance)
          : "",
      });

      setLoading(false);
    })();
  }, [tunnelId, navigation]);

  const buildCameraCalib = (): CameraCalib | null => {
    const hasAnyCalibration =
      form.baseDistanceCm.trim().length > 0 ||
      form.cmPerPxAtBaseDistance.trim().length > 0;

    if (!hasAnyCalibration) return null;

    const baseDistanceCm = parseOptionalPositiveNumber(form.baseDistanceCm);
    const cmPerPxAtBaseDistance = parseOptionalPositiveNumber(
      form.cmPerPxAtBaseDistance
    );

    if (baseDistanceCm === null || Number.isNaN(baseDistanceCm)) {
      Alert.alert(
        "Invalid Calibration",
        "Base Distance must be a valid positive number. Example: 80"
      );
      return null;
    }

    if (cmPerPxAtBaseDistance === null || Number.isNaN(cmPerPxAtBaseDistance)) {
      Alert.alert(
        "Invalid Calibration",
        "cm Per Pixel at Base Distance must be a valid positive number. Example: 0.0125"
      );
      return null;
    }

    return {
      baseDistanceCm,
      cmPerPxAtBaseDistance,
    };
  };

  const save = async () => {
    const name = form.tunnelName.trim();
    const crop = form.cropType.trim();

    if (name.length < 3) return Alert.alert("Invalid", "Tunnel name must be at least 3 characters.");
    if (crop.length < 3) return Alert.alert("Invalid", "Crop type must be at least 3 characters.");

    const sensorCount = form.sensorCount ? parseInt(form.sensorCount, 10) : undefined;
    if (form.sensorCount && (!Number.isFinite(sensorCount) || sensorCount! < 0 || sensorCount! > 200)) {
      return Alert.alert("Invalid", "Sensor count must be 0–200.");
    }

    const hasAnyCalibration =
      form.baseDistanceCm.trim().length > 0 ||
      form.cmPerPxAtBaseDistance.trim().length > 0;
    const cameraCalib = buildCameraCalib();

    if (hasAnyCalibration && !cameraCalib) return;

    const nextRobotId = form.robotId.trim();

    try {
      setSaving(true);

      await updateTunnel(tunnelId, {
        name,
        tunnelName: name,
        cropType: crop,
        size: form.size.trim() || undefined,
        sensorCount,
        robotId: nextRobotId || undefined,
        fertigationUnitId: form.fertigationUnitId.trim() || undefined,
        status: form.status,
        cameraCalib,
      } as any);

      // If robotId changed and provided, bind robot to this tunnel (robot reads assignedTunnelId)
      if (nextRobotId && nextRobotId !== origRobotId) {
        await bindRobotToTunnel(nextRobotId, tunnelId);
        setOrigRobotId(nextRobotId);
      }

      Alert.alert("Saved", "Tunnel updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update tunnel");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete Tunnel", "This will delete the tunnel and ALL plants inside it. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await deleteTunnelCascade(tunnelId);
            Alert.alert("Deleted", "Tunnel deleted.");
            navigation.popToTop();
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to delete");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>

        <Text style={styles.label}>Tunnel Name</Text>
        <TextInput style={styles.input} value={form.tunnelName} onChangeText={(v) => update("tunnelName", v)} />

        <Text style={styles.label}>Crop Type</Text>
        <TextInput style={styles.input} value={form.cropType} onChangeText={(v) => update("cropType", v)} />

        <Text style={styles.label}>Size</Text>
        <TextInput style={styles.input} value={form.size} onChangeText={(v) => update("size", v)} />

        <Text style={styles.label}>Layout</Text>
        <Text style={styles.readonly}>{form.rows} rows × {form.columns} columns (layout not editable)</Text>

        <Text style={styles.label}>Status</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.statusBtn, form.status === "GOOD" && styles.statusBtnActive]}
            onPress={() => setForm((p) => ({ ...p, status: "GOOD" }))}
          >
            <Text style={[styles.statusText, form.status === "GOOD" && styles.statusTextActive]}>GOOD</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusBtn, form.status === "NEED_ATTENTION" && styles.statusBtnActiveWarn]}
            onPress={() => setForm((p) => ({ ...p, status: "NEED_ATTENTION" }))}
          >
            <Text style={[styles.statusText, form.status === "NEED_ATTENTION" && styles.statusTextActive]}>NEED ATTENTION</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Equipment</Text>

        <Text style={styles.label}>Sensor Count</Text>
        <TextInput
          style={styles.input}
          value={form.sensorCount}
          onChangeText={(v) => update("sensorCount", v.replace(/[^\d]/g, ""))}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Robot ID</Text>
        <TextInput style={styles.input} value={form.robotId} onChangeText={(v) => update("robotId", v)} autoCapitalize="characters" />

        <Text style={styles.label}>Fertigation Unit ID</Text>
        <TextInput style={styles.input} value={form.fertigationUnitId} onChangeText={(v) => update("fertigationUnitId", v)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Camera Calibration</Text>
        <Text style={styles.helperText}>
          These values are used by the inference API to calculate cucumber length and diameter in centimeters.
        </Text>

        <Text style={styles.label}>Base Distance From Camera To Plant (cm)</Text>
        <TextInput
          style={styles.input}
          value={form.baseDistanceCm}
          onChangeText={(v) => update("baseDistanceCm", v.replace(/[^\d.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="Example: 80"
        />

        <Text style={styles.label}>cm Per Pixel At Base Distance</Text>
        <TextInput
          style={styles.input}
          value={form.cmPerPxAtBaseDistance}
          onChangeText={(v) => update("cmPerPxAtBaseDistance", v.replace(/[^\d.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="Example: 0.0125"
        />

        <Text style={styles.noteText}>
          Formula: cmPerPxAtBaseDistance = real object width in cm ÷ object width in pixels. Clear both fields to remove calibration.
        </Text>
      </View>

      <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save Changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate("TunnelSetup", { tunnelId })} disabled={saving}>
        <Text style={styles.secondaryText}>Setup Plants (RFID Map)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete} disabled={saving}>
        <Text style={styles.deleteText}>Delete Tunnel</Text>
      </TouchableOpacity>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },
  section: { backgroundColor: "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#eee", marginBottom: 12 },
  sectionTitle: { fontWeight: "900", color: "#1B5E20", marginBottom: 12, fontSize: 16 },
  label: { marginTop: 10, fontWeight: "800", color: "#333" },
  input: { marginTop: 8, backgroundColor: "#F5F5F5", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E0E0E0" },
  readonly: { marginTop: 8, color: "#757575", fontWeight: "700" },

  helperText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    lineHeight: 19,
    marginBottom: 10,
  },
  noteText: {
    fontSize: 12,
    color: "#777",
    fontWeight: "600",
    lineHeight: 18,
    backgroundColor: "#F1F8E9",
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },

  statusBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: "#F5F5F5", alignItems: "center", borderWidth: 1, borderColor: "#E0E0E0" },
  statusBtnActive: { backgroundColor: "#E8F5E9", borderColor: "#2E7D32" },
  statusBtnActiveWarn: { backgroundColor: "#FFF3E0", borderColor: "#FB8C00" },
  statusText: { fontWeight: "900", color: "#555", fontSize: 12 },
  statusTextActive: { color: "#1B5E20" },

  primaryBtn: { backgroundColor: "#2E7D32", paddingVertical: 16, borderRadius: 16, alignItems: "center", marginTop: 6 },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondaryBtn: { backgroundColor: "#fff", paddingVertical: 16, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#E0E0E0", marginTop: 10 },
  secondaryText: { fontWeight: "900", color: "#1565C0" },

  deleteBtn: { backgroundColor: "#FFEBEE", paddingVertical: 16, borderRadius: 16, alignItems: "center", marginTop: 10 },
  deleteText: { fontWeight: "900", color: "#D32F2F" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
});
