import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { LinearGradient } from "expo-linear-gradient";
import { setDoc, doc, onSnapshot, collection, documentId, limit, orderBy, query } from "firebase/firestore";
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

type ExecutionLog = {
  id: string;
  date: string;
  n: number | null;
  p: number | null;
  k: number | null;
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

function parseLogDateFromId(id: string): string {
  const m = /^log_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(id);
  if (!m) return id;

  const [, y, mo, d, h, mi, s] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return dt.toLocaleString();
}

export default function FertigationScreen() {
  useTunnelHeader("AI Fertigation");

  const [c1Value, setC1Value] = useState("");
  const [c2Value, setC2Value] = useState("");
  const [c3Value, setC3Value] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatusDoc | null>(null);
  const [currentCommand, setCurrentCommand] = useState<DeviceCommand | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
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

  useEffect(() => {
    const logsQuery = query(
      collection(db, "dispenseLogs"),
      orderBy(documentId(), "desc"),
      limit(5)
    );

    return onSnapshot(
      logsQuery,
      (snap) => {
        const logs = snap.docs.map((d) => {
          const data = d.data() as any;
          const n = Number(data?.inputMl1);
          const p = Number(data?.inputMl2);
          const k = Number(data?.inputMl3User);
          const ts = safeFormatTimestamp(data?.ts);

          return {
            id: d.id,
            date: ts !== "—" ? ts : parseLogDateFromId(d.id),
            n: Number.isFinite(n) ? n : null,
            p: Number.isFinite(p) ? p : null,
            k: Number.isFinite(k) ? k : null,
          } satisfies ExecutionLog;
        });

        setExecutionLogs(logs);
      },
      (err) => {
        console.log("dispenseLogs listener error:", err);
        setExecutionLogs([]);
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

      <View style={styles.currentCommandCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.commandIcon}>
            <Ionicons name="time-outline" size={18} color="#2E7D32" />
          </View>
          <Text style={styles.commandTitle}>Execution History</Text>
        </View>

        <View style={styles.logContainer}>
          {executionLogs.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logMain}>
                <View style={[styles.logIcon, { backgroundColor: "#E8F5E9" }]}>
                  <Ionicons name="checkmark" size={18} color="#2E7D32" />
                </View>
                <View>
                  <Text style={styles.logDate}>{log.date}</Text>
                  <Text style={styles.logStage}>Dispense Log</Text>
                </View>
              </View>

              <View style={styles.logRight}>
                <View style={styles.miniNpkRow}>
                  <View style={styles.miniCircle}>
                    <Text style={styles.miniVal}>{log.n ?? "—"}</Text>
                    <Text style={styles.miniLabel}>N</Text>
                  </View>
                  <View style={styles.miniCircle}>
                    <Text style={styles.miniVal}>{log.p ?? "—"}</Text>
                    <Text style={styles.miniLabel}>P</Text>
                  </View>
                  <View style={styles.miniCircle}>
                    <Text style={styles.miniVal}>{log.k ?? "—"}</Text>
                    <Text style={styles.miniLabel}>K</Text>
                  </View>
                </View>
                <Text style={styles.logStatus}>Completed</Text>
              </View>
            </View>
          ))}
        </View>

        {executionLogs.length === 0 && (
          <Text style={styles.emptyHistoryText}>No dispense logs found.</Text>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },

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

  logContainer: { gap: 12 },
  logItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  logMain: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  logDate: { fontSize: 13, fontWeight: "700", color: "#333" },
  logStage: { fontSize: 11, color: "#9E9E9E", marginTop: 2 },
  logRight: { alignItems: "flex-end", gap: 6 },
  miniNpkRow: { flexDirection: "row", gap: 6 },
  miniCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F1F8E9",
    borderWidth: 1,
    borderColor: "#A5D6A7",
    alignItems: "center",
    justifyContent: "center",
  },
  miniVal: { fontSize: 10, fontWeight: "800", color: "#2E7D32", lineHeight: 11 },
  miniLabel: { fontSize: 7, fontWeight: "700", color: "#4CAF50", lineHeight: 8 },
  logStatus: { fontSize: 11, fontWeight: "600", color: "#9E9E9E" },
  emptyHistoryText: { color: "#9E9E9E", fontSize: 13, textAlign: "center", marginTop: 6 },
});