import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Switch, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { LinearGradient } from "expo-linear-gradient";
import { setDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";

const { width } = Dimensions.get("window");

// Interactive Mock Slider
const MockSlider = ({ label, value, color, onChange }: any) => {
  const [sliderWidth, setSliderWidth] = useState(0);

  const handleTouch = (e: any) => {
    if (sliderWidth === 0) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / sliderWidth));
    const newValue = Math.round(ratio * 10 * 10) / 10;
    onChange(newValue);
  };

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sliderLabel, { color }]}>{label}</Text>
        <Text style={styles.sliderValue}>{value.toFixed(1)}</Text>
      </View>
      <TouchableOpacity
        style={styles.track}
        activeOpacity={1}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        onPress={handleTouch}
      >
        <View style={[styles.fill, { width: `${(value / 10) * 100}%`, backgroundColor: color }]} />
        <View style={[styles.thumb, { left: `${(value / 10) * 100}%`, borderColor: color }]} />
      </TouchableOpacity>
      <View style={styles.buttons}>
        <TouchableOpacity onPress={() => onChange(Math.max(0, parseFloat((value - 0.5).toFixed(1))))} style={styles.adjBtn}>
          <Ionicons name="remove" size={16} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onChange(Math.min(10, parseFloat((value + 0.5).toFixed(1))))} style={styles.adjBtn}>
          <Ionicons name="add" size={16} color="#555" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function FertigationScreen({ navigation }: any) {
  useTunnelHeader("AI Fertigation");

  const [stage, setStage] = useState(2);
  const [npk, setNpk] = useState({ n: 7.0, p: 5.0, k: 5.0 });
  const [isFlowering, setIsFlowering] = useState(false);
  
  // Manual Dispense state
  const [c1Value, setC1Value] = useState("");
  const [c2Value, setC2Value] = useState("");
  const [c3Value, setC3Value] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Device status state
  const [deviceStatus, setDeviceStatus] = useState<{
    online: boolean;
    busy: boolean;
    state: string;
    lastCommandId: string;
  }>({
    online: false,
    busy: false,
    state: "unknown",
    lastCommandId: "",
  });

  // Listen to device status
  useEffect(() => {
    const statusRef = doc(db, "deviceStatus", "liquid-system-01");
    return onSnapshot(
      statusRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setDeviceStatus({
            online: data?.online ?? false,
            busy: data?.busy ?? false,
            state: data?.state ?? "unknown",
            lastCommandId: data?.lastCommandId ?? "",
          });
        } else {
          setDeviceStatus({
            online: false,
            busy: false,
            state: "offline",
            lastCommandId: "",
          });
        }
      },
      (err) => {
        console.log("deviceStatus listener error:", err);
        setDeviceStatus({
          online: false,
          busy: false,
          state: "error",
          lastCommandId: "",
        });
      }
    );
  }, []);

  // Mock Stage Metadata
  const stages = [
    { id: 1, title: "Stage 1", subtitle: "Early Growth (Week 1-2)" },
    { id: 2, title: "Stage 2", subtitle: "Vegetative (Week 3-4)" },
    { id: 3, title: "Stage 3", subtitle: "Flowering Season" },
    { id: 4, title: "Stage 4", subtitle: "Fruiting (AI Detect)" },
  ];

  const handleStageChange = (id: number) => {
    setStage(id);
    if (id === 1) setNpk({ n: 6.0, p: 4.0, k: 4.0 });
    if (id === 2) setNpk({ n: 7.0, p: 5.0, k: 5.0 });
    if (id === 3) setNpk({ n: 4.0, p: 8.0, k: 7.0 });
    if (id === 4) setNpk({ n: 5.0, p: 5.0, k: 8.0 });
  };

  const handleSendCommand = async () => {
    // Trim and parse values
    const c1 = c1Value.trim();
    const c2 = c2Value.trim();
    const c3 = c3Value.trim();

    const parsedC1 = c1 === "" ? 0 : Number(c1);
    const parsedC2 = c2 === "" ? 0 : Number(c2);
    const parsedC3 = c3 === "" ? 0 : Number(c3);

    // Validate numeric and positive
    if (!Number.isFinite(parsedC1) || parsedC1 < 0 ||
        !Number.isFinite(parsedC2) || parsedC2 < 0 ||
        !Number.isFinite(parsedC3) || parsedC3 < 0) {
      Alert.alert("Invalid Input", "Please enter valid positive numbers for all containers.");
      return;
    }

    // Check if all values are 0
    if (parsedC1 === 0 && parsedC2 === 0 && parsedC3 === 0) {
      Alert.alert("Invalid Input", "At least one container value must be greater than 0.");
      return;
    }

    setIsSending(true);

    try {
      const commandRef = doc(db, "deviceCommands", "liquid-system-01");
      await setDoc(
        commandRef,
        {
          commandId: `cmd_${Date.now()}`,
          type: "dispense_all",
          c1ml: parsedC1,
          c2ml: parsedC2,
          c3ml: parsedC3,
          status: "PENDING",
          requestedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      Alert.alert("Success", "Dispense command sent");
      setC1Value("");
      setC2Value("");
      setC3Value("");
    } catch (error) {
      console.error("Failed to send command:", error);
      Alert.alert("Error", "Failed to send dispense command");
    } finally {
      setIsSending(false);
    }
  };


  return (
    <ScrollView contentContainerStyle={styles.container}>

          {/* Manual Dispense Section */}
      <View style={styles.manualDispenseCard}>
        <View style={styles.manualDispenseHeader}>
          <View style={styles.manualDispenseIcon}>
            <Ionicons name="flask" size={18} color="#2E7D32" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manualDispenseTitle}>Manual Dispense</Text>
            <Text style={styles.manualDispenseSubtitle}>Send dispense values to the device</Text>
          </View>
        </View>

        {/* Device Status Row */}
        <View style={styles.statusRow}>
          <View style={[styles.statusChip, deviceStatus.online ? styles.statusOnline : styles.statusOffline]}>
            <View style={[styles.statusDot, { backgroundColor: deviceStatus.online ? "#4CAF50" : "#9E9E9E" }]} />
            <Text style={styles.statusChipText}>{deviceStatus.online ? "Online" : "Offline"}</Text>
          </View>

          <View style={[styles.statusChip, deviceStatus.busy ? styles.statusBusy : styles.statusIdle]}>
            <Ionicons 
              name={deviceStatus.busy ? "hourglass-outline" : "checkmark-circle-outline"} 
              size={12} 
              color={deviceStatus.busy ? "#FF9800" : "#4CAF50"} 
            />
            <Text style={styles.statusChipText}>{deviceStatus.busy ? "Busy" : "Idle"}</Text>
          </View>

          <View style={styles.statusChip}>
            <Text style={styles.statusStateText}>{deviceStatus.state}</Text>
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Nitrogen</Text>
            <TextInput
              style={styles.input}
              placeholder="C1 mL"
              keyboardType="numeric"
              value={c1Value}
              onChangeText={setC1Value}
              editable={!isSending}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Phosphorus</Text>
            <TextInput
              style={styles.input}
              placeholder="C2 mL"
              keyboardType="numeric"
              value={c2Value}
              onChangeText={setC2Value}
              editable={!isSending}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Potassium</Text>
            <TextInput
              style={styles.input}
              placeholder="C3 mL"
              keyboardType="numeric"
              value={c3Value}
              onChangeText={setC3Value}
              editable={!isSending}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.sendButton, (isSending || deviceStatus.busy) && styles.sendButtonDisabled]}
          onPress={handleSendCommand}
          disabled={isSending || deviceStatus.busy}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={(isSending || deviceStatus.busy) ? ['#A5D6A7', '#A5D6A7'] : ['#2E7D32', '#1B5E20']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sendButtonGradient}
          >
            {isSending ? (
              <Text style={styles.sendButtonText}>Sending...</Text>
            ) : deviceStatus.busy ? (
              <Text style={styles.sendButtonText}>Device Busy...</Text>
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={styles.sendButtonText}>Send to Device</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* 2. Configure Mix Section (Inline) */}
      <SectionTitle title="Configure Mix" />

      <View style={styles.configCard}>
        {/* Stage Selector */}
        <View style={styles.timeline}>
          {stages.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.stageStep, stage === s.id && styles.activeStep]}
              onPress={() => handleStageChange(s.id)}
            >
              <Text style={[styles.stepNum, stage === s.id && styles.activeStepNum]}>{s.id}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.timelineLine} />
        </View>
        <View style={styles.stageMeta}>
          <Text style={styles.stageName}>{stages[stage - 1].title}</Text>
          <Text style={styles.stageDesc}>{stages[stage - 1].subtitle}</Text>
        </View>

        <View style={styles.divider} />

        {/* Dynamic Logic */}
        {stage === 3 && (
          <View style={styles.dynamicBox}>
            <View style={styles.row}>
              <Ionicons name="flower-outline" size={20} color="#D81B60" />
              <Text style={styles.dynamicText}>Flowering Detected?</Text>
            </View>
            <Switch
              value={isFlowering}
              onValueChange={(v) => { setIsFlowering(v); if (v) setNpk({ n: 3, p: 9, k: 6 }); }}
              trackColor={{ false: "#767577", true: "#F48FB1" }}
              thumbColor={isFlowering ? "#D81B60" : "#f4f3f4"}
            />
          </View>
        )}

        {/* Sliders */}
        <MockSlider label="Nitrogen (N)" value={npk.n} color="#2E7D32" onChange={(v: any) => setNpk({ ...npk, n: v })} />
        <MockSlider label="Phosphorus (P)" value={npk.p} color="#F57C00" onChange={(v: any) => setNpk({ ...npk, p: v })} />
        <MockSlider label="Potassium (K)" value={npk.k} color="#7B1FA2" onChange={(v: any) => setNpk({ ...npk, k: v })} />

      </View>

      {/* APPLY Button */}
      <TouchableOpacity style={styles.applyBtn} activeOpacity={0.8}>
        <Text style={styles.applyText}>Apply Configuration</Text>
      </TouchableOpacity>



      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },

  aiCard: { borderRadius: 24, padding: 24, marginBottom: 24 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 16 },
  aiIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  aiTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  aiSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },

  configCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, elevation: 2, marginBottom: 16 },

  timeline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 12, marginBottom: 16, position: "relative" },
  timelineLine: { position: "absolute", top: 20, left: 0, right: 0, height: 2, backgroundColor: "#E0E0E0", zIndex: -1 },
  stageStep: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  activeStep: { backgroundColor: "#2E7D32", borderColor: "#A5D6A7", transform: [{ scale: 1.1 }] },
  stepNum: { fontWeight: "700", color: "#BDBDBD" },
  activeStepNum: { color: "#fff" },

  stageMeta: { alignItems: "center", marginBottom: 20 },
  stageName: { fontSize: 16, fontWeight: "800", color: "#2E7D32" },
  stageDesc: { fontSize: 12, color: "#757575" },

  divider: { height: 1, backgroundColor: "#F5F5F5", marginBottom: 20 },

  dynamicBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FCE4EC", padding: 12, borderRadius: 12, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dynamicText: { fontWeight: "700", color: "#D81B60", fontSize: 13 },

  // Slider Styles
  sliderContainer: { marginBottom: 20 },
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  sliderLabel: { fontWeight: "700", fontSize: 13, color: "#555" },
  sliderValue: { fontWeight: "800", color: "#333" },
  track: { height: 12, backgroundColor: "#F5F5F5", borderRadius: 6, position: "relative", marginBottom: 16, justifyContent: "center" },
  fill: { height: 12, borderRadius: 6 },
  thumb: { position: "absolute", top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", borderWidth: 4, shadowColor: "#000", shadowOpacity: 0.2, elevation: 3 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  adjBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F3F4", alignItems: "center", justifyContent: "center" },

  applyBtn: { backgroundColor: "#2E7D32", paddingVertical: 18, borderRadius: 16, alignItems: "center", marginBottom: 16 },
  applyText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  // Manual Dispense Section
  manualDispenseCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  manualDispenseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  manualDispenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  manualDispenseTitle: { fontSize: 15, fontWeight: "700", color: "#333" },
  manualDispenseSubtitle: { fontSize: 12, color: "#757575", marginTop: 2 },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  statusOnline: {
    backgroundColor: "#E8F5E9",
  },
  statusOffline: {
    backgroundColor: "#EEEEEE",
  },
  statusBusy: {
    backgroundColor: "#FFF3E0",
  },
  statusIdle: {
    backgroundColor: "#E8F5E9",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555",
  },
  statusStateText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#757575",
    textTransform: "capitalize",
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#757575",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  sendButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

});
