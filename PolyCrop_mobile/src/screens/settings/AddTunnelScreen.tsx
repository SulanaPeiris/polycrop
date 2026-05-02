import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { useTunnel } from "../../context/TunnelContext";
import { bindRobotToTunnel } from "../../services/robots";
import { CameraCalib } from "../../services/tunnels";

function parseOptionalPositiveNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const num = Number(trimmed);
  return Number.isFinite(num) && num > 0 ? num : NaN;
}

export default function AddTunnelScreen({ navigation }: any) {
  useTunnelHeader("Add New Tunnel");
  const { createTunnel } = useTunnel();

  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    cropType: "",
    rows: "10",
    columns: "20",
    size: "",
    sensorCount: "",
    robotId: "",
    fertigationUnitId: "",
    baseDistanceCm: "",
    cmPerPxAtBaseDistance: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const buildCameraCalib = (): CameraCalib | null => {
    const hasAnyCalibration =
      formData.baseDistanceCm.trim().length > 0 ||
      formData.cmPerPxAtBaseDistance.trim().length > 0;

    if (!hasAnyCalibration) return null;

    const baseDistanceCm = parseOptionalPositiveNumber(formData.baseDistanceCm);
    const cmPerPxAtBaseDistance = parseOptionalPositiveNumber(
      formData.cmPerPxAtBaseDistance
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

  const handleSubmit = async () => {
    const name = formData.name.trim();
    const cropType = formData.cropType.trim();

    const rows = parseInt(formData.rows || "0", 10);
    const columns = parseInt(formData.columns || "0", 10);

    if (name.length < 3) {
      Alert.alert("Error", "Tunnel Name must be at least 3 characters");
      return;
    }
    if (cropType.length < 3) {
      Alert.alert("Error", "Crop Type must be at least 3 characters");
      return;
    }
    if (!Number.isFinite(rows) || rows <= 0 || rows > 200) {
      Alert.alert("Error", "Rows must be between 1 and 200");
      return;
    }
    if (!Number.isFinite(columns) || columns <= 0 || columns > 200) {
      Alert.alert("Error", "Columns must be between 1 and 200");
      return;
    }

    const sensorCount = formData.sensorCount
      ? parseInt(formData.sensorCount, 10)
      : undefined;
    if (
      formData.sensorCount &&
      (!Number.isFinite(sensorCount) || sensorCount! < 0 || sensorCount! > 200)
    ) {
      Alert.alert("Error", "Sensor Count must be between 0 and 200");
      return;
    }

    const hasAnyCalibration =
      formData.baseDistanceCm.trim().length > 0 ||
      formData.cmPerPxAtBaseDistance.trim().length > 0;
    const cameraCalib = buildCameraCalib();

    if (hasAnyCalibration && !cameraCalib) return;

    try {
      setSaving(true);

      const tunnelId = await createTunnel({
        name,
        cropType,
        rows,
        columns,
        size: formData.size.trim() || undefined,
        sensorCount,
        robotId: formData.robotId.trim() || undefined,
        fertigationUnitId: formData.fertigationUnitId.trim() || undefined,
        cameraCalib,
      });

      // If robotId provided, bind it immediately (robot can fetch assignedTunnelId)
      if (formData.robotId.trim()) {
        await bindRobotToTunnel(formData.robotId.trim(), tunnelId);
      }

      Alert.alert("Success", "Tunnel added successfully!", [
        { text: "Setup plants", onPress: () => navigation.replace("TunnelSetup", { tunnelId }) },
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to create tunnel");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tunnel Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Tunnel D"
            value={formData.name}
            onChangeText={(val) => updateField("name", val)}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Crop Type *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Cucumber"
            value={formData.cropType}
            onChangeText={(val) => updateField("cropType", val)}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Size (m²)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 500"
            value={formData.size}
            onChangeText={(val) => updateField("size", val)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Plant Layout</Text>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Rows *</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={formData.rows}
              onChangeText={(val) => updateField("rows", val.replace(/[^\d]/g, ""))}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Columns *</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={formData.columns}
              onChangeText={(val) => updateField("columns", val.replace(/[^\d]/g, ""))}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Equipment Configuration</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Sensor Count</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={formData.sensorCount}
            onChangeText={(val) => updateField("sensorCount", val.replace(/[^\d]/g, ""))}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Assigned Robot ID</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., ROBOT_01"
            value={formData.robotId}
            onChangeText={(val) => updateField("robotId", val)}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fertigation Unit ID</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., F-004"
            value={formData.fertigationUnitId}
            onChangeText={(val) => updateField("fertigationUnitId", val)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Camera Calibration</Text>
        <Text style={styles.helperText}>
          These values are used to convert cucumber pixel size into centimeters for ripe detection.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Base Distance From Camera To Plant (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Example: 80"
            value={formData.baseDistanceCm}
            onChangeText={(val) =>
              updateField("baseDistanceCm", val.replace(/[^\d.]/g, ""))
            }
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>cm Per Pixel At Base Distance</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Example: 0.0125"
            value={formData.cmPerPxAtBaseDistance}
            onChangeText={(val) =>
              updateField("cmPerPxAtBaseDistance", val.replace(/[^\d.]/g, ""))
            }
          />
        </View>

        <Text style={styles.noteText}>
          Formula: cmPerPxAtBaseDistance = real object width in cm ÷ object width in pixels. Example: 10 cm ruler ÷ 800 px = 0.0125.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, saving && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Add Tunnel</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} disabled={saving}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },

  section: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#2E7D32", marginBottom: 16 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#555", marginBottom: 8 },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#333",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },

  row: { flexDirection: "row" },

  helperText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    lineHeight: 19,
    marginBottom: 14,
  },
  noteText: {
    fontSize: 12,
    color: "#777",
    fontWeight: "600",
    lineHeight: 18,
    backgroundColor: "#F1F8E9",
    padding: 10,
    borderRadius: 10,
  },

  submitBtn: {
    backgroundColor: "#2E7D32",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  cancelBtn: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  cancelText: { color: "#757575", fontWeight: "700", fontSize: 16 },
});
