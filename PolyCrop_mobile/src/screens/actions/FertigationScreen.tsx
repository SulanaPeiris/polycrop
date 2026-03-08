import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { LinearGradient } from "expo-linear-gradient";
import { setDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";

type DeviceStatusDoc = {
  deviceId: string;
  busy: boolean;
  state: string;
  lastCommandId: string;
  lastLogId: string;
  lastExecutionStatus: string;
  updatedAt: string;
  lastSeenEpochMs: number;
  offlineTimeoutMs: number;
};

type DeviceCommand = {
  commandId: string;
  type: string;
  c1ml: number | null;
  c2ml: number | null;
  c3ml: number | null;
  status: string;
  requestedBy: string;
  requestedAt: string;
  lastUpdatedAt: string;
  startedAt: string;
  completedAt: string;
  executionStatus: string;
  lastLogId: string;
};

function safeFormatTimestamp(ts: any): string {
  if (!ts) return "—";
  if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
  if (typeof ts === "number") return new Date(ts).toLocaleString();

  if (typeof ts === "string") {
    const date = new Date(ts);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
    return ts;
  }

  return "—";
}

const MockSlider = ({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (value: number) => void;
}) => {
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
        <View
          style={[
            styles.fill,
            { width: `${(value / 10) * 100}%`, backgroundColor: color },
          ]}
        />
        <View
          style={[
            styles.thumb,
            { left: `${(value / 10) * 100}%`, borderColor: color },
          ]}
        />
      </TouchableOpacity>

      <View style={styles.buttons}>
        <TouchableOpacity
          onPress={() =>
            onChange(Math.max(0, parseFloat((value - 0.5).toFixed(1))))
          }
          style={styles.adjBtn}
        >
          <Ionicons name="remove" size={16} color="#555" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            onChange(Math.min(10, parseFloat((value + 0.5).toFixed(1))))
          }
          style={styles.adjBtn}
        >
          <Ionicons name="add" size={16} color="#555" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function FertigationScreen() {
  useTunnelHeader("AI Fertigation");

  const [stage, setStage] = useState(2);
  const [npk, setNpk] = useState({ n: 7.0, p: 5.0, k: 5.0 });
  const [isFlowering, setIsFlowering] = useState(false);

  const [c1Value, setC1Value] = useState("");
  const [c2Value, setC2Value] = useState("");
  const [c3Value, setC3Value] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatusDoc | null>(null);
  const [currentCommand, setCurrentCommand] = useState<DeviceCommand | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const statusRef = doc(db, "deviceStatus", "liquid-system-01");

    return onSnapshot(
      statusRef,
      (snap) => {
        if (!snap.exists()) {
          setDeviceStatus(null);
          return;
        }

        const data = snap.data();
        const lastSeenEpochMs = Number(data?.lastSeenEpochMs ?? 0);
        const offlineTimeoutMs = Number(data?.offlineTimeoutMs ?? 30000);

        setDeviceStatus({
          deviceId: data?.deviceId ?? "—",
          busy: Boolean(data?.busy),
          state: data?.state ?? "—",
          lastCommandId: data?.lastCommandId ?? "—",
          lastLogId: data?.lastLogId ?? "—",
          lastExecutionStatus: data?.lastExecutionStatus ?? "—",
          updatedAt: safeFormatTimestamp(data?.updatedAt),
          lastSeenEpochMs: Number.isFinite(lastSeenEpochMs) ? lastSeenEpochMs : 0,
          offlineTimeoutMs: Number.isFinite(offlineTimeoutMs)
            ? offlineTimeoutMs
            : 30000,
        });
      },
      (err) => {
        console.log("deviceStatus listener error:", err);
        setDeviceStatus(null);
      }
    );
  }, []);

  useEffect(() => {
    const commandRef = doc(db, "deviceCommands", "liquid-system-01");

    return onSnapshot(
      commandRef,
      (snap) => {
        if (!snap.exists()) {
          setCurrentCommand(null);
          return;
        }

        const data = snap.data();

        setCurrentCommand({
          commandId: data?.commandId ?? "—",
          type: data?.type ?? "—",
          c1ml: typeof data?.c1ml === "number" ? data.c1ml : null,
          c2ml: typeof data?.c2ml === "number" ? data.c2ml : null,
          c3ml: typeof data?.c3ml === "number" ? data.c3ml : null,
          status: data?.status ?? "—",
          requestedBy: data?.requestedBy ?? "—",
          requestedAt: safeFormatTimestamp(data?.requestedAt),
          lastUpdatedAt: safeFormatTimestamp(data?.lastUpdatedAt),
          startedAt: safeFormatTimestamp(data?.startedAt),
          completedAt: safeFormatTimestamp(data?.completedAt),
          executionStatus: data?.executionStatus ?? "—",
          lastLogId: data?.lastLogId ?? "—",
        });
      },
      (err) => {
        console.log("deviceCommands listener error:", err);
        setCurrentCommand(null);
      }
    );
  }, []);

  const computedOnline = useMemo(() => {
    if (!deviceStatus?.lastSeenEpochMs) return false;
    return (
      nowMs - deviceStatus.lastSeenEpochMs <=
      (deviceStatus.offlineTimeoutMs || 30000)
    );
  }, [deviceStatus, nowMs]);

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

  const sendFirestoreCommand = async (
    type: "dispense_all" | "stop_all",
    payload: { c1ml: number; c2ml: number; c3ml: number }
  ) => {
    const nowIso = new Date().toISOString();

    await setDoc(
      doc(db, "deviceCommands", "liquid-system-01"),
      {
        commandId: `cmd_${Date.now()}`,
        type,
        c1ml: payload.c1ml,
        c2ml: payload.c2ml,
        c3ml: payload.c3ml,
        status: "PENDING",
        requestedAt: nowIso,
        lastUpdatedAt: nowIso,
      },
      { merge: true }
    );
  };

  const handleSendCommand = async () => {
    const c1 = c1Value.trim();
    const c2 = c2Value.trim();
    const c3 = c3Value.trim();

    const parsedC1 = c1 === "" ? 0 : Number(c1);
    const parsedC2 = c2 === "" ? 0 : Number(c2);
    const parsedC3 = c3 === "" ? 0 : Number(c3);

    if (
      !Number.isFinite(parsedC1) ||
      parsedC1 < 0 ||
      !Number.isFinite(parsedC2) ||
      parsedC2 < 0 ||
      !Number.isFinite(parsedC3) ||
      parsedC3 < 0
    ) {
      Alert.alert(
        "Invalid Input",
        "Please enter valid positive numbers for all containers."
      );
      return;
    }

    if (parsedC1 === 0 && parsedC2 === 0 && parsedC3 === 0) {
      Alert.alert(
        "Invalid Input",
        "At least one container value must be greater than 0."
      );
      return;
    }

    if (!computedOnline) {
      Alert.alert(
        "Device Offline",
        "The device is offline. Please reconnect it and try again."
      );
      return;
    }

    if (deviceStatus?.busy) {
      Alert.alert(
        "Device Busy",
        "The device is currently running another task."
      );
      return;
    }

    setIsSending(true);

    try {
      await sendFirestoreCommand("dispense_all", {
        c1ml: parsedC1,
        c2ml: parsedC2,
        c3ml: parsedC3,
      });

      Alert.alert("Success", "Dispense command sent");
      setC1Value("");
      setC2Value("");
      setC3Value("");
    } catch (error) {
      console.error("Failed to send dispense command:", error);
      Alert.alert("Error", "Failed to send dispense command");
    } finally {
      setIsSending(false);
    }
  };

  const handleStopAllOutputs = async () => {
    if (!computedOnline && !deviceStatus?.busy) {
      Alert.alert("Device Offline", "The device is offline.");
      return;
    }

    Alert.alert(
      "Stop All Outputs",
      "Are you sure you want to stop all pumps and solenoids?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: async () => {
            setIsSending(true);
            try {
              await sendFirestoreCommand("stop_all", {
                c1ml: 0,
                c2ml: 0,
                c3ml: 0,
              });

              Alert.alert("Success", "Stop command sent");
            } catch (error) {
              console.error("Failed to send stop command:", error);
              Alert.alert("Error", "Failed to send stop command");
            } finally {
              setIsSending(false);
            }
          },
        },
      ]
    );
  };

  const sendDisabled =
    isSending || !computedOnline || Boolean(deviceStatus?.busy);

  const stopDisabled = isSending || (!computedOnline && !deviceStatus?.busy);

  const currentCommandTypeLabel =
    currentCommand?.type === "dispense_all"
      ? "Dispense All"
      : currentCommand?.type === "stop_all"
      ? "Stop All Outputs"
      : currentCommand?.type ?? "—";

  const currentCommandStatusColor =
    currentCommand?.status === "DONE"
      ? "#2E7D32"
      : currentCommand?.status === "FAILED"
      ? "#D32F2F"
      : currentCommand?.status === "RUNNING"
      ? "#F57C00"
      : "#333";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.manualDispenseCard}>
        <View style={styles.manualDispenseHeader}>
          <View style={styles.manualDispenseIcon}>
            <Ionicons name="flask" size={18} color="#2E7D32" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manualDispenseTitle}>Manual Dispense</Text>
            <Text style={styles.manualDispenseSubtitle}>
              Send dispense values or stop command to the device
            </Text>
          </View>
        </View>

        {deviceStatus && (
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusChip,
                computedOnline ? styles.statusOnline : styles.statusOffline,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: computedOnline ? "#4CAF50" : "#9E9E9E" },
                ]}
              />
              <Text style={styles.statusChipText}>
                {computedOnline ? "Online" : "Offline"}
              </Text>
            </View>

            <View
              style={[
                styles.statusChip,
                deviceStatus.busy ? styles.statusBusy : styles.statusIdle,
              ]}
            >
              <Ionicons
                name={
                  deviceStatus.busy
                    ? "hourglass-outline"
                    : "checkmark-circle-outline"
                }
                size={12}
                color={deviceStatus.busy ? "#FF9800" : "#4CAF50"}
              />
              <Text style={styles.statusChipText}>
                {deviceStatus.busy ? "Busy" : "Idle"}
              </Text>
            </View>

            <View style={styles.statusChip}>
              <Text style={styles.statusStateText}>{deviceStatus.state}</Text>
            </View>
          </View>
        )}

        <View style={styles.inputRow}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Nitrogen (N)</Text>
            <TextInput
              style={styles.input}
              placeholder="N mL"
              keyboardType="numeric"
              value={c1Value}
              onChangeText={setC1Value}
              editable={!isSending}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Phosphorus (P)</Text>
            <TextInput
              style={styles.input}
              placeholder="P mL"
              keyboardType="numeric"
              value={c2Value}
              onChangeText={setC2Value}
              editable={!isSending}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Potassium (K)</Text>
            <TextInput
              style={styles.input}
              placeholder="K mL"
              keyboardType="numeric"
              value={c3Value}
              onChangeText={setC3Value}
              editable={!isSending}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.sendButton, sendDisabled && styles.sendButtonDisabled]}
          onPress={handleSendCommand}
          disabled={sendDisabled}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              sendDisabled
                ? ["#A5D6A7", "#A5D6A7"]
                : ["#2E7D32", "#1B5E20"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sendButtonGradient}
          >
            {isSending ? (
              <Text style={styles.sendButtonText}>Sending...</Text>
            ) : !computedOnline ? (
              <Text style={styles.sendButtonText}>Device Offline</Text>
            ) : deviceStatus?.busy ? (
              <Text style={styles.sendButtonText}>Device Busy...</Text>
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={styles.sendButtonText}>Send Dispense Command</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.deviceStatusCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.deviceStatusIcon}>
            <Ionicons
              name="hardware-chip-outline"
              size={18}
              color="#2E7D32"
            />
          </View>
          <Text style={styles.deviceStatusTitle}>Device Status</Text>

          <TouchableOpacity
            style={[
              styles.stopButtonHeader,
              stopDisabled && styles.sendButtonDisabled,
            ]}
            onPress={handleStopAllOutputs}
            disabled={stopDisabled}
            activeOpacity={0.85}
          >
            <Ionicons name="stop-circle-outline" size={12} color="#C62828" />
            <Text style={styles.stopButtonHeaderText}>Stop All</Text>
          </TouchableOpacity>
        </View>

        {deviceStatus ? (
          <>
            <View style={styles.statusChipsRow}>
              <View
                style={[
                  styles.statusChipLarge,
                  computedOnline ? styles.chipOnline : styles.chipOffline,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: computedOnline ? "#4CAF50" : "#9E9E9E" },
                  ]}
                />
                <Text style={styles.chipText}>
                  {computedOnline ? "Online" : "Offline"}
                </Text>
              </View>

              <View
                style={[
                  styles.statusChipLarge,
                  deviceStatus.busy ? styles.chipBusy : styles.chipIdle,
                ]}
              >
                <Ionicons
                  name={
                    deviceStatus.busy
                      ? "time-outline"
                      : "checkmark-circle-outline"
                  }
                  size={12}
                  color={deviceStatus.busy ? "#FF9800" : "#4CAF50"}
                />
                <Text style={styles.chipText}>
                  {deviceStatus.busy ? "Busy" : "Idle"}
                </Text>
              </View>

              <View style={styles.statusChipLarge}>
                <Text style={styles.chipText}>{deviceStatus.state}</Text>
              </View>
            </View>

            <View style={styles.statusDetailsGrid}>
              <View style={styles.statusDetail}>
                <Text style={styles.statusDetailLabel}>Device ID</Text>
                <Text style={styles.statusDetailValue}>
                  {deviceStatus.deviceId}
                </Text>
              </View>

              <View style={styles.statusDetail}>
                <Text style={styles.statusDetailLabel}>Last Command</Text>
                <Text style={styles.statusDetailValue}>
                  {deviceStatus.lastCommandId}
                </Text>
              </View>

              <View style={styles.statusDetail}>
                <Text style={styles.statusDetailLabel}>Last Log</Text>
                <Text style={styles.statusDetailValue}>
                  {deviceStatus.lastLogId}
                </Text>
              </View>

              <View style={styles.statusDetail}>
                <Text style={styles.statusDetailLabel}>Execution Status</Text>
                <Text style={styles.statusDetailValue}>
                  {deviceStatus.lastExecutionStatus}
                </Text>
              </View>

              <View style={styles.statusDetail}>
                <Text style={styles.statusDetailLabel}>Updated At</Text>
                <Text style={styles.statusDetailValue}>
                  {deviceStatus.updatedAt}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>No device status available</Text>
        )}
      </View>

      <View style={styles.currentCommandCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.commandIcon}>
            <Ionicons name="git-commit-outline" size={18} color="#2E7D32" />
          </View>
          <Text style={styles.commandTitle}>Current Command</Text>
        </View>

        {currentCommand ? (
          <>
            <View style={styles.statusDetailsGrid}>
              <View style={styles.statusDetail}>
                <Text style={styles.statusDetailLabel}>Command ID</Text>
                <Text style={styles.statusDetailValue}>
                  {currentCommand.commandId}
                </Text>
              </View>

              <View style={styles.statusDetail}>
                <Text style={styles.statusDetailLabel}>Type</Text>
                <Text style={styles.statusDetailValue}>
                  {currentCommandTypeLabel}
                </Text>
              </View>

              <View style={styles.statusDetail}>
                <Text style={styles.statusDetailLabel}>Status</Text>
                <Text
                  style={[
                    styles.statusDetailValue,
                    { color: currentCommandStatusColor, fontWeight: "700" },
                  ]}
                >
                  {currentCommand.status}
                </Text>
              </View>
            </View>

            {currentCommand.type === "dispense_all" ? (
              <View style={styles.commandValuesRow}>
                <View style={styles.commandValueItem}>
                  <View style={styles.commandCircle}>
                    <Text style={styles.commandCircleValue}>
                      {currentCommand.c1ml ?? "—"}
                    </Text>
                  </View>
                  <Text style={styles.commandCircleLabel}>N</Text>
                </View>

                <View style={styles.commandValueItem}>
                  <View style={styles.commandCircle}>
                    <Text style={styles.commandCircleValue}>
                      {currentCommand.c2ml ?? "—"}
                    </Text>
                  </View>
                  <Text style={styles.commandCircleLabel}>P</Text>
                </View>

                <View style={styles.commandValueItem}>
                  <View style={styles.commandCircle}>
                    <Text style={styles.commandCircleValue}>
                      {currentCommand.c3ml ?? "—"}
                    </Text>
                  </View>
                  <Text style={styles.commandCircleLabel}>K</Text>
                </View>
              </View>
            ) : (
              <View >
                {/* <Ionicons name="stop-circle-outline" size={28} color="#D32F2F" />
                <Text style={styles.stopCommandText}>Stop All Outputs</Text> */}
              </View>
            )}

            <View style={styles.commandTimestamps}>
              <View style={styles.timestampItem}>
                <Text style={styles.timestampLabel}>Requested</Text>
                <Text style={styles.timestampValue}>
                  {currentCommand.requestedAt}
                </Text>
              </View>

              <View style={styles.timestampItem}>
                <Text style={styles.timestampLabel}>Last Updated</Text>
                <Text style={styles.timestampValue}>
                  {currentCommand.lastUpdatedAt}
                </Text>
              </View>

              {currentCommand.startedAt !== "—" && (
                <View style={styles.timestampItem}>
                  <Text style={styles.timestampLabel}>Started</Text>
                  <Text style={styles.timestampValue}>
                    {currentCommand.startedAt}
                  </Text>
                </View>
              )}

              {currentCommand.completedAt !== "—" && (
                <View style={styles.timestampItem}>
                  <Text style={styles.timestampLabel}>Completed</Text>
                  <Text style={styles.timestampValue}>
                    {currentCommand.completedAt}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.commandFooter}>
              <Text style={styles.commandFooterLabel}>
                Execution Status: {currentCommand.executionStatus}
              </Text>
              <Text style={styles.commandFooterLabel}>
                Last Log ID: {currentCommand.lastLogId}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyCommandState}>
            <Ionicons name="document-outline" size={32} color="#BDBDBD" />
            <Text style={styles.emptyText}>No command yet</Text>
          </View>
        )}
      </View>

      <SectionTitle title="Configure Mix" />

      <View style={styles.configCard}>
        <View style={styles.timeline}>
          {stages.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.stageStep, stage === s.id && styles.activeStep]}
              onPress={() => handleStageChange(s.id)}
            >
              <Text
                style={[
                  styles.stepNum,
                  stage === s.id && styles.activeStepNum,
                ]}
              >
                {s.id}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.timelineLine} />
        </View>

        <View style={styles.stageMeta}>
          <Text style={styles.stageName}>{stages[stage - 1].title}</Text>
          <Text style={styles.stageDesc}>{stages[stage - 1].subtitle}</Text>
        </View>

        <View style={styles.divider} />

        {stage === 3 && (
          <View style={styles.dynamicBox}>
            <View style={styles.row}>
              <Ionicons name="flower-outline" size={20} color="#D81B60" />
              <Text style={styles.dynamicText}>Flowering Detected?</Text>
            </View>

            <Switch
              value={isFlowering}
              onValueChange={(v) => {
                setIsFlowering(v);
                if (v) setNpk({ n: 3, p: 9, k: 6 });
              }}
              trackColor={{ false: "#767577", true: "#F48FB1" }}
              thumbColor={isFlowering ? "#D81B60" : "#f4f3f4"}
            />
          </View>
        )}

        <MockSlider
          label="Nitrogen (N)"
          value={npk.n}
          color="#2E7D32"
          onChange={(v) => setNpk({ ...npk, n: v })}
        />
        <MockSlider
          label="Phosphorus (P)"
          value={npk.p}
          color="#F57C00"
          onChange={(v) => setNpk({ ...npk, p: v })}
        />
        <MockSlider
          label="Potassium (K)"
          value={npk.k}
          color="#7B1FA2"
          onChange={(v) => setNpk({ ...npk, k: v })}
        />
      </View>

      <TouchableOpacity style={styles.applyBtn} activeOpacity={0.8}>
        <Text style={styles.applyText}>Apply Configuration</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },

  configCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    elevation: 2,
    marginBottom: 16,
  },

  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 12,
    marginBottom: 16,
    position: "relative",
  },
  timelineLine: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#E0E0E0",
    zIndex: -1,
  },
  stageStep: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  activeStep: {
    backgroundColor: "#2E7D32",
    borderColor: "#A5D6A7",
    transform: [{ scale: 1.1 }],
  },
  stepNum: { fontWeight: "700", color: "#BDBDBD" },
  activeStepNum: { color: "#fff" },

  stageMeta: { alignItems: "center", marginBottom: 20 },
  stageName: { fontSize: 16, fontWeight: "800", color: "#2E7D32" },
  stageDesc: { fontSize: 12, color: "#757575" },

  divider: { height: 1, backgroundColor: "#F5F5F5", marginBottom: 20 },

  dynamicBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FCE4EC",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dynamicText: { fontWeight: "700", color: "#D81B60", fontSize: 13 },

  sliderContainer: { marginBottom: 20 },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sliderLabel: { fontWeight: "700", fontSize: 13, color: "#555" },
  sliderValue: { fontWeight: "800", color: "#333" },
  track: {
    height: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
    position: "relative",
    marginBottom: 16,
    justifyContent: "center",
  },
  fill: { height: 12, borderRadius: 6 },
  thumb: {
    position: "absolute",
    top: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    elevation: 3,
  },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  adjBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F3F4",
    alignItems: "center",
    justifyContent: "center",
  },

  applyBtn: {
    backgroundColor: "#2E7D32",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  applyText: { color: "#fff", fontWeight: "800", fontSize: 16 },

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
  statusOnline: { backgroundColor: "#E8F5E9" },
  statusOffline: { backgroundColor: "#EEEEEE" },
  statusBusy: { backgroundColor: "#FFF3E0" },
  statusIdle: { backgroundColor: "#E8F5E9" },
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
  inputWrapper: { flex: 1 },
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
  sendButtonDisabled: { opacity: 0.6 },
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

  deviceStatusCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  deviceStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  deviceStatusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },
  stopButtonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#FFEBEE",
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  stopButtonHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#C62828",
  },

  statusChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  statusChipLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  chipOnline: { backgroundColor: "#E8F5E9" },
  chipOffline: { backgroundColor: "#FFEBEE" },
  chipBusy: { backgroundColor: "#FFF3E0" },
  chipIdle: { backgroundColor: "#E8F5E9" },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#555",
  },

  statusDetailsGrid: {
    gap: 10,
  },
  statusDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    gap: 12,
  },
  statusDetailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#757575",
  },
  statusDetailValue: {
    fontSize: 12,
    color: "#333",
    flex: 1,
    textAlign: "right",
  },
  emptyText: {
    color: "#9E9E9E",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },

  currentCommandCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  commandIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  commandTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },

  commandValuesRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
  },
  commandValueItem: {
    alignItems: "center",
    gap: 6,
  },
  commandCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F1F8E9",
    borderWidth: 1,
    borderColor: "#A5D6A7",
    alignItems: "center",
    justifyContent: "center",
  },
  commandCircleValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2E7D32",
  },
  commandCircleLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4CAF50",
  },

  stopCommandBox: {
    marginTop: 16,
    marginBottom: 16,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: "#FFEBEE",
    borderWidth: 1,
    borderColor: "#FFCDD2",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stopCommandText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#C62828",
  },

  commandTimestamps: {
    gap: 8,
    marginBottom: 12,
  },
  timestampItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  timestampLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#757575",
  },
  timestampValue: {
    fontSize: 11,
    color: "#333",
    flex: 1,
    textAlign: "right",
  },

  commandFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 4,
  },
  commandFooterLabel: {
    fontSize: 11,
    color: "#757575",
  },

  emptyCommandState: {
    alignItems: "center",
    paddingVertical: 24,
  },
});