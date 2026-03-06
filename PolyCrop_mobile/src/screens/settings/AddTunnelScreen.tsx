import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { useAuth } from "../../context/AuthContext";
import { createTunnelWithPlants } from "../../services/tunnels";

function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

function toInt(v: string) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

export default function AddTunnelScreen({ navigation }: any) {
  useTunnelHeader("Add New Tunnel");

  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    tunnelName: "",
    cropType: "",
    size: "",
    rows: "",
    columns: "",
    sensorCount: "",
    robotId: "",
    fertigationUnitId: "",
  });

  const totalPlants = useMemo(() => {
    const r = toInt(form.rows || "0");
    const c = toInt(form.columns || "0");
    return r > 0 && c > 0 ? r * c : 0;
  }, [form.rows, form.columns]);

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const tunnelName = form.tunnelName.trim();
    const cropType = form.cropType.trim();

    if (tunnelName.length < 3) return "Tunnel name must be at least 3 characters.";
    if (cropType.length < 3) return "Crop type must be at least 3 characters.";

    const rows = toInt(form.rows);
    const cols = toInt(form.columns);

    if (!rows || !cols) return "Rows and Columns are required.";
    if (rows < 1 || rows > 200) return "Rows must be between 1 and 200.";
    if (cols < 1 || cols > 200) return "Columns must be between 1 and 200.";

    const plants = rows * cols;
    if (plants > 5000) return `Too many plants (${plants}). Reduce layout (max 5000 recommended).`;

    const sensorCount = form.sensorCount ? toInt(form.sensorCount) : 0;
    if (form.sensorCount && (sensorCount < 0 || sensorCount > 200)) return "Sensor count must be 0–200.";

    return null;
  };

  const handleCreate = async () => {
    if (!user) {
      Alert.alert("Not logged in", "Please log in again.");
      return;
    }

    const err = validate();
    if (err) {
      Alert.alert("Invalid input", err);
      return;
    }

    try {
      setLoading(true);

      const tunnelId = await createTunnelWithPlants({
        ownerId: user.uid,
        tunnelName: form.tunnelName.trim(),
        cropType: form.cropType.trim(),
        size: form.size.trim() || undefined,
        rows: toInt(form.rows),
        columns: toInt(form.columns),
        sensorCount: form.sensorCount ? toInt(form.sensorCount) : undefined,
        robotId: form.robotId.trim() || undefined,
        fertigationUnitId: form.fertigationUnitId.trim() || undefined,
        status: "GOOD",
        setupCompleted: false,
      });

      Alert.alert("Tunnel created", "Now assign RFID tags for each plant.", [
        { text: "Open Setup Map", onPress: () => navigation.replace("TunnelSetup", { tunnelId }) },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to create tunnel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tunnel Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tunnel Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Tunnel A (Polytunnel 1)"
              value={form.tunnelName}
              onChangeText={(v) => update("tunnelName", v)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Crop Type *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Cucumber"
              value={form.cropType}
              onChangeText={(v) => update("cropType", v)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Size</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 500 m² or 10m x 50m"
              value={form.size}
              onChangeText={(v) => update("size", v)}
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
                placeholder="e.g., 10"
                keyboardType="number-pad"
                value={form.rows}
                onChangeText={(v) => update("rows", onlyDigits(v))}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Columns *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 20"
                keyboardType="number-pad"
                value={form.columns}
                onChangeText={(v) => update("columns", onlyDigits(v))}
              />
            </View>
          </View>

          <Text style={styles.hint}>
            Plants to be created: <Text style={{ fontWeight: "900" }}>{totalPlants || "-"}</Text>
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipment</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Sensor Count</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 8"
              keyboardType="number-pad"
              value={form.sensorCount}
              onChangeText={(v) => update("sensorCount", onlyDigits(v))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Robot ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., R-001"
              value={form.robotId}
              onChangeText={(v) => update("robotId", v)}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fertigation Unit ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., F-001"
              value={form.fertigationUnitId}
              onChangeText={(v) => update("fertigationUnitId", v)}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleCreate} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Tunnel</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} disabled={loading}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },
  section: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#2E7D32", marginBottom: 16 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "700", color: "#555", marginBottom: 8 },
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
  hint: { marginTop: -6, color: "#757575", fontSize: 12 },

  submitBtn: { backgroundColor: "#2E7D32", paddingVertical: 16, borderRadius: 16, alignItems: "center", marginBottom: 12 },
  submitText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  cancelBtn: { backgroundColor: "#fff", paddingVertical: 16, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#E0E0E0" },
  cancelText: { color: "#757575", fontWeight: "800", fontSize: 16 },
});