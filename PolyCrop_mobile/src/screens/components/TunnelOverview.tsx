import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  documentId,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

import {
  aggregatePlantHarvest,
  buildCucumberScanVM,
  EMPTY_PLANT_HARVEST_STATS,
  timeAgo,
  toMs,
  type PlantHarvestStats,
} from "../../services/cucumberScanUtils";

import {
  buildPlantDiseaseMetrics,
  type PlantDiseaseMetrics,
  type PlantDoc,
} from "../../services/diseaseScanUtils";

type ExecutionLog = {
  id: string;
  date: string;
  n: number | null;
  p: number | null;
  k: number | null;
  tunnelId?: string;
};

type LiveSummary = {
  avg_temp?: number;
  avg_hum?: number;
  avgTemp?: number;
  avgHum?: number;
  temperature?: number;
  humidity?: number;
  temp?: number;
  hum?: number;
  an_level?: string;
  an_message?: string;
  gatewayId?: string;
  lastSeenAt?: any;
  updatedAt?: any;
  ts?: any;
  [key: string]: any;
};

type OverviewPlant = PlantDoc & {
  id: string;
  lastSeenAt?: any;
  updatedAt?: any;
  lastScannedAt?: any;
  cucumberCount?: number;
  ripeCucumberCount?: number;
  lastRipeCucumberCount?: number;
};

function safeFormatTimestamp(ts: any): string {
  if (!ts) return "-";
  if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
  if (typeof ts === "number") return new Date(ts).toLocaleString();

  if (typeof ts === "string") {
    const date = new Date(ts);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
    return ts;
  }

  return "-";
}

function parseLogDateFromId(id: string): string {
  const m = /^log_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(id);
  if (!m) return id;

  const [, y, mo, d, h, mi, s] = m;
  const dt = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s)
  );
  return dt.toLocaleString();
}

function toNumberOrNull(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatSensorValue(value: any, decimals: number, suffix: string) {
  const n = toNumberOrNull(value);
  if (n === null) return "--";
  return `${n.toFixed(decimals)}${suffix}`;
}

function emptyHarvestStats(): PlantHarvestStats {
  return { ...EMPTY_PLANT_HARVEST_STATS };
}

function fallbackHarvestFromPlant(plant: OverviewPlant): PlantHarvestStats {
  const cucumberCount =
    toNumberOrNull(plant?.lastCounts?.cucumber) ??
    toNumberOrNull(plant?.cucumberCount) ??
    0;

  const ripeCount =
    toNumberOrNull(plant?.lastRipeCucumberCount) ??
    toNumberOrNull(plant?.ripeCucumberCount) ??
    0;

  const latestAtMs = toMs(
    plant?.updatedAt ||
      plant?.lastScannedAt ||
      plant?.lastSeenAt ||
      plant?.lastScanAt
  );

  return {
    ...EMPTY_PLANT_HARVEST_STATS,
    scanCount: plant?.lastCaptureId ? 1 : 0,
    cucumberScanCount: cucumberCount > 0 || ripeCount > 0 ? 1 : 0,
    totalCucumbers: cucumberCount,
    totalRipe: ripeCount,
    totalUnripe: Math.max(cucumberCount - ripeCount, 0),
    latestAtMs,
    latestCaptureId: plant?.lastCaptureId || "",
    latestImageUrl: "",
    latestAnnotatedUrl: "",
    latestDistanceCm: null,
  };
}

function harvestFromCaptureDocs(docs: any[]): PlantHarvestStats {
  const scans = docs.map((captureDoc) =>
    buildCucumberScanVM(captureDoc.id, captureDoc.data() || {})
  );

  return aggregatePlantHarvest(scans);
}

function hasHighSeverity(metrics: PlantDiseaseMetrics) {
  const severityMap = metrics?.diseaseSeverity || {};

  return Object.values(severityMap).some((stat: any) => {
    const level = String(stat?.severityLevel || "").toUpperCase();
    const maxPercent = Number(stat?.maxSeverityPercent || 0);

    return level === "HIGH" || level === "SEVERE" || maxPercent >= 25;
  });
}

function getRobotOnline(robot: any) {
  const ms = toMs(robot?.lastSeenAt || robot?.updatedAt || robot?.ts);
  if (!ms) return false;

  return Date.now() - ms < 2 * 60 * 1000;
}

function getRobotText(robot: any, tunnel: any) {
  if (!tunnel?.robotId) return "Robot: Not assigned";
  if (!robot) return "Robot: Linked";

  const status =
    robot?.status ||
    robot?.state ||
    robot?.mode ||
    robot?.executionStatus ||
    robot?.currentTask;

  return `Robot: ${status || "Active"}`;
}

function getLiveTimeLabel(summary: LiveSummary | null) {
  const ms = toMs(summary?.lastSeenAt || summary?.updatedAt || summary?.ts);
  if (!ms) return "Waiting for LoRa data";
  return `Updated ${timeAgo(ms)}`;
}

export default function TunnelOverview({ tunnel }: any) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const tunnelId = tunnel?.id;

  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [liveSummary, setLiveSummary] = useState<LiveSummary | null>(null);
  const [robot, setRobot] = useState<any | null>(null);
  const [plants, setPlants] = useState<OverviewPlant[]>([]);
  const [harvestByPlant, setHarvestByPlant] = useState<
    Record<string, PlantHarvestStats>
  >({});
  const [diseaseByPlant, setDiseaseByPlant] = useState<
    Record<string, PlantDiseaseMetrics>
  >({});

  // ✅ Kept your fertigation log part unchanged
  useEffect(() => {
    const logsQuery = query(
      collection(db, "dispenseLogs"),
      orderBy(documentId(), "desc"),
      limit(20)
    );

    return onSnapshot(
      logsQuery,
      (snap) => {
        const allLogs = snap.docs.map((d) => {
          const data = d.data() as any;
          const n = Number(data?.inputMl1);
          const p = Number(data?.inputMl2);
          const k = Number(data?.inputMl3User);
          const ts = safeFormatTimestamp(data?.ts);

          return {
            id: d.id,
            date: ts !== "-" ? ts : parseLogDateFromId(d.id),
            n: Number.isFinite(n) ? n : null,
            p: Number.isFinite(p) ? p : null,
            k: Number.isFinite(k) ? k : null,
            tunnelId: data?.tunnelId,
          } satisfies ExecutionLog;
        });

        const byTunnel = allLogs.filter(
          (l) => l.tunnelId && l.tunnelId === tunnel?.id
        );
        const finalLogs = (byTunnel.length > 0 ? byTunnel : allLogs).slice(
          0,
          3
        );
        setExecutionLogs(finalLogs);
      },
      (err) => {
        console.log("overview dispenseLogs listener error:", err);
        setExecutionLogs([]);
      }
    );
  }, [tunnel?.id]);

  // ✅ Live LoRa summary: tunnels/{tunnelId}/sensorSummary/latest
  useEffect(() => {
    if (!tunnelId) {
      setLiveSummary(null);
      return;
    }

    const summaryRef = doc(db, "tunnels", tunnelId, "sensorSummary", "latest");

    return onSnapshot(
      summaryRef,
      (snap) => {
        setLiveSummary(snap.exists() ? (snap.data() as LiveSummary) : null);
      },
      (err) => {
        console.log("overview sensorSummary listener error:", err);
        setLiveSummary(null);
      }
    );
  }, [tunnelId]);

  // ✅ Robot status: robots/{robotId}
  useEffect(() => {
    if (!tunnel?.robotId) {
      setRobot(null);
      return;
    }

    const robotRef = doc(db, "robots", tunnel.robotId);

    return onSnapshot(
      robotRef,
      (snap) => {
        setRobot(snap.exists() ? snap.data() : null);
      },
      (err) => {
        console.log("overview robot listener error:", err);
        setRobot(null);
      }
    );
  }, [tunnel?.robotId]);

  // ✅ Plants: tunnels/{tunnelId}/plants
  useEffect(() => {
    if (!tunnelId) {
      setPlants([]);
      return;
    }

    const plantsRef = collection(db, "tunnels", tunnelId, "plants");

    return onSnapshot(
      plantsRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as OverviewPlant[];

        setPlants(rows);
      },
      (err) => {
        console.log("overview plants listener error:", err);
        setPlants([]);
      }
    );
  }, [tunnelId]);

  // ✅ Plant captures: tunnels/{tunnelId}/plants/{plantId}/captures
  useEffect(() => {
    if (!tunnelId || plants.length === 0) {
      setHarvestByPlant({});
      setDiseaseByPlant({});
      return;
    }

    setHarvestByPlant({});
    setDiseaseByPlant({});

    const unsubs = plants.map((plant) => {
      const capturesRef = collection(
        db,
        "tunnels",
        tunnelId,
        "plants",
        plant.id,
        "captures"
      );

      return onSnapshot(
        capturesRef,
        (snap) => {
          const docs = snap.docs;

          setHarvestByPlant((prev) => ({
            ...prev,
            [plant.id]: harvestFromCaptureDocs(docs),
          }));

          setDiseaseByPlant((prev) => ({
            ...prev,
            [plant.id]: buildPlantDiseaseMetrics(plant, docs),
          }));
        },
        (err) => {
          console.log(`overview captures listener error for ${plant.id}:`, err);

          setHarvestByPlant((prev) => ({
            ...prev,
            [plant.id]: emptyHarvestStats(),
          }));

          setDiseaseByPlant((prev) => ({
            ...prev,
            [plant.id]: buildPlantDiseaseMetrics(plant, []),
          }));
        }
      );
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [tunnelId, plants]);

  const totalPlants = useMemo(() => {
    const rows = Number(tunnel?.rows || 0);
    const columns = Number(tunnel?.columns || 0);
    const layoutTotal = rows * columns;

    return layoutTotal > 0 ? layoutTotal : plants.length;
  }, [tunnel?.rows, tunnel?.columns, plants.length]);

  const harvestSummary = useMemo(() => {
    let totalCucumbers = 0;
    let totalRipe = 0;
    let ripePlants = 0;
    let scanCount = 0;
    let latestAtMs = 0;

    plants.forEach((plant) => {
      const capturedStats = harvestByPlant[plant.id];
      const fallbackStats = fallbackHarvestFromPlant(plant);

      const stats =
        capturedStats &&
        (capturedStats.scanCount > 0 || capturedStats.totalCucumbers > 0)
          ? capturedStats
          : fallbackStats;

      totalCucumbers += Number(stats.totalCucumbers || 0);
      totalRipe += Number(stats.totalRipe || 0);
      scanCount += Number(stats.scanCount || 0);
      latestAtMs = Math.max(latestAtMs, Number(stats.latestAtMs || 0));

      if (Number(stats.totalRipe || 0) > 0) {
        ripePlants += 1;
      }
    });

    return {
      totalCucumbers,
      totalRipe,
      ripePlants,
      scanCount,
      latestAtMs,
    };
  }, [plants, harvestByPlant]);

  const diseaseSummary = useMemo(() => {
    const metricsList = plants.map((plant) => {
      return diseaseByPlant[plant.id] || buildPlantDiseaseMetrics(plant, []);
    });

    const scanned = metricsList.filter((m) => m.scanned).length;
    const affected = metricsList.filter((m) => m.affected).length;
    const waterStress = metricsList.filter((m) => m.waterStressAlert).length;
    const sprayNeeded = metricsList.filter((m) => m.sprayRecommended).length;
    const highSeverity = metricsList.filter(hasHighSeverity).length;

    let risk: "Low" | "Medium" | "High" = "Low";

    if (sprayNeeded > 0 || highSeverity > 0) {
      risk = "High";
    } else if (affected > 0 || waterStress > 0) {
      risk = "Medium";
    }

    let subtitle = "No disease scans yet";

    if (scanned > 0 && affected === 0 && waterStress === 0) {
      subtitle = "No issues detected";
    } else if (affected > 0 || waterStress > 0) {
      subtitle = `${affected} affected plants • ${waterStress} water stress`;
    }

    return {
      scanned,
      affected,
      waterStress,
      sprayNeeded,
      highSeverity,
      risk,
      subtitle,
    };
  }, [plants, diseaseByPlant]);

  if (!tunnel) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Select a tunnel to view details</Text>
      </View>
    );
  }

  const temp =
    liveSummary?.avg_temp ??
    liveSummary?.avgTemp ??
    liveSummary?.temperature ??
    liveSummary?.temp ??
    tunnel?.sensors?.temp;

  const humidity =
    liveSummary?.avg_hum ??
    liveSummary?.avgHum ??
    liveSummary?.humidity ??
    liveSummary?.hum ??
    tunnel?.sensors?.humidity;

  const sensorLevel = String(liveSummary?.an_level || "OK").toUpperCase();
  const lastSeenMs = toMs(
    liveSummary?.lastSeenAt || liveSummary?.updatedAt || liveSummary?.ts
  );

  const sensorTimedOut = lastSeenMs
    ? Date.now() - lastSeenMs > 60 * 1000
    : !liveSummary;

  const sensorHasProblem =
    sensorTimedOut ||
    sensorLevel === "WARN" ||
    sensorLevel === "WARNING" ||
    sensorLevel === "FAULT" ||
    sensorLevel === "ERROR";

  const isHealthy =
    tunnel.status === "GOOD" &&
    !sensorHasProblem &&
    diseaseSummary.risk !== "High";

  const robotOnline = getRobotOnline(robot);
  const robotText = getRobotText(robot, tunnel);

  const cropType = tunnel?.cropType || tunnel?.crop || "Cucumber";

  return (
    <View style={styles.container}>
      {/* Tunnel Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.tunnelName}>{tunnel.name}</Text>
          <Text style={styles.location}>
            {cropType} • {totalPlants || plants.length || 0} plants
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isHealthy ? "#E8F5E9" : "#FFEBEE" },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isHealthy ? "#4CAF50" : "#F44336" },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isHealthy ? "#2E7D32" : "#D32F2F" },
            ]}
          >
            {isHealthy ? "GOOD" : "ATTENTION"}
          </Text>
        </View>
      </View>

      {/* Environment Section */}
      <Text style={styles.sectionLabel}>ENVIRONMENT</Text>

      <View style={styles.envCard}>
        {/* Robot Status Badge */}
        <View
          style={[
            styles.robotBadge,
            { backgroundColor: robotOnline ? "#E8F5E9" : "#E3F2FD" },
          ]}
        >
          <Ionicons
            name="cube-outline"
            size={12}
            color={robotOnline ? "#2E7D32" : "#1565C0"}
          />
          <Text
            style={[
              styles.robotText,
              { color: robotOnline ? "#2E7D32" : "#1565C0" },
            ]}
            numberOfLines={1}
          >
            {robotText}
          </Text>
        </View>

        <View style={styles.envRow}>
          {/* Temperature */}
          <TouchableOpacity
  activeOpacity={0.8}
  style={styles.envItem}
  onPress={() =>
    navigation.navigate("SensorDetails", {
      sensorId: "temperature",
      title: "Temperature Sensor",
    })
  }
>
            <View style={[styles.iconCircle, { backgroundColor: "#FFF3E0" }]}>
              <Ionicons name="thermometer-outline" size={24} color="#FF7043" />
            </View>
            <Text style={styles.envValue}>
              {formatSensorValue(temp, 1, "°C")}
            </Text>
            <Text style={styles.envLabel}>Temperature</Text>
          </TouchableOpacity>

          {/* Divider Line */}
          <View style={styles.verticalDivider} />

          {/* Humidity */}
         <TouchableOpacity
  activeOpacity={0.8}
  style={styles.envItem}
  onPress={() =>
    navigation.navigate("SensorDetails", {
      sensorId: "humidity",
      title: "Humidity Sensor",
    })
  }
>
            <View style={[styles.iconCircle, { backgroundColor: "#E3F2FD" }]}>
              <Ionicons name="water-outline" size={24} color="#1E88E5" />
            </View>
            <Text style={styles.envValue}>
              {formatSensorValue(humidity, 0, "%")}
            </Text>
            <Text style={styles.envLabel}>Humidity</Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.liveStatusBox,
            { backgroundColor: sensorHasProblem ? "#FFEBEE" : "#E8F5E9" },
          ]}
        >
          <Ionicons
            name={sensorHasProblem ? "warning-outline" : "checkmark-circle"}
            size={14}
            color={sensorHasProblem ? "#D32F2F" : "#2E7D32"}
          />
          <Text
            style={[
              styles.liveStatusText,
              { color: sensorHasProblem ? "#D32F2F" : "#2E7D32" },
            ]}
          >
            {liveSummary?.an_message ||
              (sensorHasProblem ? "Sensor update missing" : "Sensors healthy")}
          </Text>
          <Text style={styles.liveStatusTime}>{getLiveTimeLabel(liveSummary)}</Text>
        </View>
      </View>

      {/* Crop & Health Section */}
      <Text style={styles.sectionLabel}>CROP & HEALTH</Text>

      {/* Harvest Ready Card */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate("HarvestReady")}
      >
        <View style={styles.infoCard}>
          <View style={[styles.infoIconBox, { backgroundColor: "#FFF3E0" }]}>
            <Ionicons name="basket" size={20} color="#EF6C00" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Harvest Ready</Text>
            <Text style={styles.infoSubtitle}>
              {harvestSummary.totalRipe} ripe cucumbers detected
            </Text>
            <Text style={styles.infoMeta}>
              {harvestSummary.totalCucumbers} total cucumber detections •{" "}
              {harvestSummary.ripePlants} plants
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
        </View>
      </TouchableOpacity>

      {/* Disease Risk Card */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate("DiseaseDashboard")}
      >
        <View style={styles.infoCard}>
          <View
            style={[
              styles.infoIconBox,
              {
                backgroundColor:
                  diseaseSummary.risk === "High"
                    ? "#FFEBEE"
                    : diseaseSummary.risk === "Medium"
                    ? "#FFF3E0"
                    : "#E8F5E9",
              },
            ]}
          >
            <Ionicons
              name={
                diseaseSummary.risk === "Low"
                  ? "leaf-outline"
                  : "alert-circle"
              }
              size={20}
              color={
                diseaseSummary.risk === "High"
                  ? "#D32F2F"
                  : diseaseSummary.risk === "Medium"
                  ? "#EF6C00"
                  : "#2E7D32"
              }
            />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Disease Risk: {diseaseSummary.risk}
            </Text>
            <Text style={styles.infoSubtitle}>{diseaseSummary.subtitle}</Text>
            <Text style={styles.infoMeta}>
              {diseaseSummary.scanned}/{totalPlants || plants.length || 0} plants scanned •{" "}
              {diseaseSummary.sprayNeeded} spray needed
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
        </View>
      </TouchableOpacity>

      {/* Fertigation Log Section */}
      <Text style={styles.sectionLabel}>RECENT FERTIGATION LOGS</Text>

      {executionLogs.length === 0 ? (
        <View style={styles.fertigationCard}>
          <Text style={styles.emptyLogsText}>
            No fertigation execution history yet.
          </Text>
        </View>
      ) : (
        executionLogs.map((log) => (
          <View style={styles.fertigationCard} key={log.id}>
            <View style={styles.npkContainer}>
              <View style={styles.npkItem}>
                <View style={styles.npkCircle}>
                  <Text style={styles.npkValue}>{log.n ?? "-"}</Text>
                </View>
                <Text style={styles.npkLabel}>N</Text>
              </View>

              <View style={styles.npkItem}>
                <View style={styles.npkCircle}>
                  <Text style={styles.npkValue}>{log.p ?? "-"}</Text>
                </View>
                <Text style={styles.npkLabel}>P</Text>
              </View>

              <View style={styles.npkItem}>
                <View style={styles.npkCircle}>
                  <Text style={styles.npkValue}>{log.k ?? "-"}</Text>
                </View>
                <Text style={styles.npkLabel}>K</Text>
              </View>
            </View>

            <View style={styles.scheduleContainer}>
              <Text style={styles.scheduleLabel}>Completed:</Text>
              <Text style={styles.scheduleTime}>{log.date}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#757575",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  tunnelName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B5E20",
  },
  location: {
    fontSize: 12,
    color: "#757575",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    marginBottom: 10,
    letterSpacing: 1,
    marginTop: 16,
  },

  // Environment Card
  envCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    paddingTop: 32,
    marginBottom: 8,
    position: "relative",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  robotBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    maxWidth: 160,
  },
  robotText: {
    fontSize: 11,
    fontWeight: "700",
  },
  envRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  envItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  envValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#333",
    marginBottom: 4,
  },
  envLabel: {
    fontSize: 13,
    color: "#757575",
    fontWeight: "500",
  },
  verticalDivider: {
    width: 1,
    height: "70%",
    backgroundColor: "#EEEEEE",
  },
  liveStatusBox: {
    marginTop: 16,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveStatusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  liveStatusTime: {
    fontSize: 11,
    fontWeight: "600",
    color: "#757575",
  },

  // Info Cards (Crop & Health)
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  infoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  infoSubtitle: {
    fontSize: 13,
    color: "#757575",
  },
  infoMeta: {
    fontSize: 11,
    color: "#9E9E9E",
    marginTop: 3,
    fontWeight: "600",
  },

  // Fertigation Card
  fertigationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 12,
  },
  npkContainer: {
    flexDirection: "row",
    gap: 12,
  },
  npkItem: {
    alignItems: "center",
    gap: 4,
  },
  npkCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#81C784",
    backgroundColor: "#F1F8E9",
    alignItems: "center",
    justifyContent: "center",
  },
  npkValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2E7D32",
  },
  npkLabel: {
    fontSize: 11,
    color: "#757575",
    fontWeight: "600",
  },
  scheduleContainer: {
    alignItems: "flex-end",
    maxWidth: 150,
  },
  scheduleLabel: {
    fontSize: 12,
    color: "#9E9E9E",
    marginBottom: 4,
  },
  scheduleTime: {
    fontSize: 13,
    fontWeight: "800",
    color: "#333",
    textAlign: "right",
  },
  emptyLogsText: {
    color: "#757575",
    fontSize: 13,
    fontWeight: "600",
  },
});