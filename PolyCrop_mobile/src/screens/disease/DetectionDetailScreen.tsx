import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import {
  bgrToRgbCss,
  CaptureMetrics,
  diseaseBg,
  diseaseColor,
  extractCaptureMetrics,
  formatPercent,
  getActionLabel,
  getDotColor,
  getSeverityForDisease,
  matchesFilter,
  niceDiseaseName,
  pumpTextForDisease,
  statusText,
  timeAgo,
  toNumber,
} from "../../services/diseaseScanUtils";

type FilterMode = "LEAF" | "CUCUMBER" | "ALL";

type CaptureItem = CaptureMetrics & {
  id: string;
};

function getImageAspectRatio(data: any) {
  const width = Number(data?.outputs?.image?.width ?? data?.image?.width ?? 0);
  const height = Number(data?.outputs?.image?.height ?? data?.image?.height ?? 0);

  if (width > 0 && height > 0) return width / height;
  return 4 / 3;
}

function diseaseIcon(disease: string) {
  if (disease === "powdery_mildew") return "snow-outline";
  if (disease === "water_stress") return "water-outline";
  return "leaf-outline";
}

function decisionColor(decision: string) {
  const d = String(decision || "").toUpperCase();
  if (["PUMP1", "PUMP2", "PUMP1_PUMP2", "SPRAY"].includes(d)) return "#2E7D32";
  if (d === "ALERT_ONLY") return "#EF6C00";
  return "#78909C";
}

function severityLevelOnly(metrics: CaptureMetrics, disease: string) {
  const stat = getSeverityForDisease(metrics.diseaseSeverity, disease);
  return String(stat?.severityLevel ?? "N/A").toUpperCase();
}

function severityNumbersOnly(metrics: CaptureMetrics, disease: string) {
  const stat = getSeverityForDisease(metrics.diseaseSeverity, disease);
  if (!stat) return "Max N/A • Avg N/A";

  return `Max ${formatPercent(stat.maxSeverityPercent ?? 0, 2)} • Avg ${formatPercent(
    stat.avgSeverityPercent ?? 0,
    2
  )}`;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RobotActionCard({ metrics }: { metrics: CaptureMetrics }) {
  const color = decisionColor(metrics.captureDecision);

  return (
    <View style={styles.robotCard}>
      <View style={styles.robotTopRow}>
        <View>
          <Text style={styles.robotTitle}>Robot Action</Text>
          <Text style={styles.robotSub}>{metrics.actionLabel || getActionLabel(metrics.captureDecision)}</Text>
        </View>

        <View style={[styles.decisionPill, { backgroundColor: `${color}18` }]}>
          <Text style={[styles.decisionPillText, { color }]}>{metrics.captureDecision}</Text>
        </View>
      </View>

      <View style={styles.pumpGrid}>
        <View style={styles.pumpBox}>
          <Ionicons name="flame-outline" size={18} color="#D32F2F" />
          <Text style={styles.pumpTitle}>Pump 1</Text>
          <Text style={styles.pumpValue}>{metrics.pump1Ms}ms</Text>
          <Text style={styles.pumpHint}>Downy mildew</Text>
        </View>

        <View style={styles.pumpBox}>
          <Ionicons name="snow-outline" size={18} color="#7B1FA2" />
          <Text style={styles.pumpTitle}>Pump 2</Text>
          <Text style={styles.pumpValue}>{metrics.pump2Ms}ms</Text>
          <Text style={styles.pumpHint}>Powdery mildew</Text>
        </View>

        <View style={styles.pumpBox}>
          <Ionicons name="water-outline" size={18} color="#EF6C00" />
          <Text style={styles.pumpTitle}>Water Alert</Text>
          <Text style={styles.pumpValue}>{metrics.waterStressAlert ? "Yes" : "No"}</Text>
          <Text style={styles.pumpHint}>User notification</Text>
        </View>
      </View>
    </View>
  );
}

function CaptureScanCard({
  item,
  onPress,
}: {
  item: CaptureItem;
  onPress: () => void;
}) {
  const primaryDisease = item.diseases[0];
  const color = item.affected ? diseaseColor(primaryDisease) : "#2E7D32";
  const bg = item.affected ? diseaseBg(primaryDisease) : "#E8F5E9";

  return (
    <TouchableOpacity style={styles.scanCard} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.scanImageWrap}>
        {item.annotatedUrl ? (
          <Image source={{ uri: item.annotatedUrl }} style={styles.scanImage} />
        ) : (
          <View style={styles.scanImagePlaceholder}>
            <Ionicons name="image-outline" size={26} color="#90A4AE" />
          </View>
        )}
      </View>

      <View style={styles.scanBody}>
        <View style={styles.scanTopRow}>
          <View style={[styles.scanStatusPill, { backgroundColor: bg }]}>
            <View style={[styles.scanDot, { backgroundColor: color }]} />
            <Text style={[styles.scanStatusText, { color }]}>{statusText(item.status)}</Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
        </View>

        <Text style={styles.scanTitle}>{item.captureId || item.id}</Text>
        <Text style={styles.scanMeta}>
          {timeAgo(item.updatedAtMs || item.createdAtMs)} • {new Date(item.updatedAtMs || item.createdAtMs || Date.now()).toLocaleString()}
        </Text>

        <Text style={styles.scanIssues} numberOfLines={2}>
          {item.diseases.length ? item.diseases.map(niceDiseaseName).join(" • ") : "No disease detected"}
        </Text>

        {item.diseases.length > 0 ? (
          <View style={styles.scanSeverityChips}>
            {item.diseases.map((disease) => {
              const chipColor = diseaseColor(disease);
              return (
                <View
                  key={`${item.id}-${disease}`}
                  style={[styles.scanSeverityChip, { backgroundColor: `${chipColor}14` }]}
                >
                  <Text style={[styles.scanSeverityChipText, { color: chipColor }]}>
                    {niceDiseaseName(disease)}: {severityLevelOnly(item, disease)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.scanStatsRow}>
          <Text style={styles.scanStat}>Leaf: {item.counts.leaf}</Text>
          <Text style={styles.scanStat}>Flower: {item.counts.flower}</Text>
          <Text style={styles.scanStat}>Pump: {item.pump1Ms + item.pump2Ms}ms</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DiseaseIssues({ metrics }: { metrics: CaptureMetrics }) {
  if (!metrics.scanned) {
    return (
      <View style={styles.emptyDetailCard}>
        <Ionicons name="time-outline" size={26} color="#90A4AE" />
        <Text style={styles.emptyDetailTitle}>No completed scan data</Text>
        <Text style={styles.emptyDetailText}>This capture has no completed leaf output yet.</Text>
      </View>
    );
  }

  if (metrics.diseases.length === 0) {
    return (
      <View style={styles.healthyCard}>
        <Ionicons name="shield-checkmark-outline" size={28} color="#2E7D32" />
        <View style={{ flex: 1 }}>
          <Text style={styles.healthyTitle}>No disease detected</Text>
          <Text style={styles.healthyText}>The latest leaf scan did not detect downy mildew, powdery mildew, or water stress.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.issuesList}>
      {metrics.diseases.map((disease) => {
        const color = diseaseColor(disease);
        const bg = diseaseBg(disease);

        return (
          <View key={disease} style={styles.issueCard}>
            <View style={[styles.issueIconBox, { backgroundColor: bg }]}>
              <Ionicons name={diseaseIcon(disease) as any} size={23} color={color} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.issueTitle}>{niceDiseaseName(disease)}</Text>
              <Text style={[styles.issueSeverity, { color }]}>
                Severity Level: {severityLevelOnly(metrics, disease)}
              </Text>
              <Text style={styles.issueSeverity}>
                {severityNumbersOnly(metrics, disease)}
              </Text>
              <Text style={styles.issueAction}>{pumpTextForDisease(disease, metrics.pump1Ms, metrics.pump2Ms)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SeverityTable({ metrics }: { metrics: CaptureMetrics }) {
  const entries = Object.entries(metrics.diseaseSeverity ?? {});

  if (entries.length === 0) {
    return (
      <View style={styles.emptySmallCard}>
        <Text style={styles.emptySmallText}>No severity summary saved for this scan.</Text>
      </View>
    );
  }

  return (
    <View style={styles.severityList}>
      {entries.map(([name, stat]: any) => {
        const color = diseaseColor(name);
        const bg = diseaseBg(name);

        return (
          <View key={name} style={styles.severityCard}>
            <View style={[styles.severityIcon, { backgroundColor: bg }]}>
              <Ionicons name={diseaseIcon(name) as any} size={18} color={color} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.severityName}>{niceDiseaseName(name)}</Text>
              <Text style={styles.severityMeta}>
                Affected leaves: {toNumber(stat?.affectedLeaves, 0)}
              </Text>
            </View>

            <View style={styles.severityRight}>
              <Text style={[styles.severityLevel, { color }]}>{String(stat?.severityLevel || "N/A")}</Text>
              <Text style={styles.severityNumbers}>
                Max {formatPercent(stat?.maxSeverityPercent ?? 0, 2)} • Avg {formatPercent(stat?.avgSeverityPercent ?? 0, 2)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PerLeafList({ metrics }: { metrics: CaptureMetrics }) {
  const rows = metrics.perLeaf.slice(0, 25);

  if (rows.length === 0) {
    return (
      <View style={styles.emptySmallCard}>
        <Text style={styles.emptySmallText}>No per-leaf severity rows saved for this scan.</Text>
      </View>
    );
  }

  return (
    <View style={styles.leafList}>
      {rows.map((leaf, idx) => {
        const firstDisease = leaf.diseases[0] ?? "leaf";
        const color = diseaseColor(firstDisease);
        const bg = diseaseBg(firstDisease);

        return (
          <View key={`${leaf.index}-${idx}`} style={styles.leafRow}>
            <View style={[styles.leafIndexBox, { backgroundColor: bg }]}>
              <Text style={[styles.leafIndexText, { color }]}>{leaf.index}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.leafTitle}>{leaf.label}</Text>
              <Text style={styles.leafMeta} numberOfLines={1}>
                {leaf.diseases.length ? leaf.diseases.map(niceDiseaseName).join(" • ") : "No disease class"}
              </Text>
            </View>

            <View style={styles.leafRight}>
              <Text style={[styles.leafSeverityLevel, { color }]}>{leaf.severityLevel}</Text>
              <Text style={styles.leafPercent}>
                {formatPercent(leaf.totalSeverityPercent ?? leaf.maxSeverityPercent ?? 0, 2)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function LegendList({ metrics }: { metrics: CaptureMetrics }) {
  if (metrics.legend.length === 0) return null;

  return (
    <View style={styles.legendWrap}>
      {metrics.legend.map((item, idx) => (
        <View key={`${item.name}-${idx}`} style={styles.legendItem}>
          <View
            style={[
              styles.legendColor,
              { backgroundColor: item.color ?? bgrToRgbCss(item.colorBGR) },
            ]}
          />
          <Text style={styles.legendText}>{niceDiseaseName(item.name)}</Text>
        </View>
      ))}
    </View>
  );
}

function CaptureFullDetail({ metrics }: { metrics: CaptureMetrics }) {
  const aspectRatio = getImageAspectRatio(metrics.raw);
  const statusColor = getDotColor(metrics.status, metrics.scanned);

  return (
    <ScrollView contentContainerStyle={styles.detailContent}>
      <View style={styles.imageCard}>
        {metrics.annotatedUrl ? (
          <Image source={{ uri: metrics.annotatedUrl }} style={[styles.detailImage, { aspectRatio }]} />
        ) : (
          <View style={[styles.noImageBox, { aspectRatio }]}>
            <Ionicons name="image-outline" size={42} color="#90A4AE" />
            <Text style={styles.noImageText}>No image available</Text>
          </View>
        )}
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View>
            <Text style={styles.summaryTitle}>Leaf Scan Summary</Text>
            <Text style={styles.summarySub}>
              {metrics.updatedAtMs || metrics.createdAtMs
                ? `${new Date(metrics.updatedAtMs || metrics.createdAtMs).toLocaleString()} • ${timeAgo(metrics.updatedAtMs || metrics.createdAtMs)}`
                : "Time: N/A"}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText(metrics.status)}</Text>
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatBox value={metrics.counts.leaf} label="Leaves" />
          <StatBox value={metrics.counts.flower} label="Flowers" />
          <StatBox value={metrics.diseases.length} label="Issues" />
        </View>
      </View>

      <SectionHeader title="Detected Disease & Stress" subtitle="Cucumber harvest outputs are hidden here; this screen only shows leaf outputs." />
      <DiseaseIssues metrics={metrics} />

      <SectionHeader title="Disease & Water Stress Severity" subtitle="Severity level is shown for every detected issue saved in the scan output." />
      <SeverityTable metrics={metrics} />

      <SectionHeader title="Pump Status & Alert Output" />
      <RobotActionCard metrics={metrics} />

      <SectionHeader title="Leaf Severity Details" subtitle="Top affected leaves from the model output." />
      <PerLeafList metrics={metrics} />

      <LegendList metrics={metrics} />
    </ScrollView>
  );
}

export default function DetectionDetailScreen({ route, navigation }: any) {
  const tunnelId: string = route?.params?.tunnelId ?? "";
  const plantId: string = route?.params?.plantId ?? "";
  const captureId: string | undefined = route?.params?.captureId;
  const filterMode: FilterMode = route?.params?.filterMode ?? "LEAF";

  const [loading, setLoading] = useState(true);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [selectedCapture, setSelectedCapture] = useState<CaptureMetrics | null>(null);

  useEffect(() => {
    if (!tunnelId || !plantId) {
      setCaptures([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = collection(db, "tunnels", tunnelId, "plants", plantId, "captures");

    return onSnapshot(
      ref,
      (snap) => {
        const list = snap.docs
          .map((docSnap) => {
            const metrics = extractCaptureMetrics(docSnap.data(), docSnap.id) as CaptureItem;
            return { ...metrics, id: docSnap.id };
          })
          .filter((item) => matchesFilter(item, filterMode))
          .sort((a, b) => (b.updatedAtMs || b.createdAtMs) - (a.updatedAtMs || a.createdAtMs));

        setCaptures(list);
        setLoading(false);
      },
      () => {
        setCaptures([]);
        setLoading(false);
      }
    );
  }, [tunnelId, plantId, filterMode]);

  useEffect(() => {
    if (!tunnelId || !plantId || !captureId) {
      setSelectedCapture(null);
      return;
    }

    const ref = doc(db, "tunnels", tunnelId, "plants", plantId, "captures", captureId);

    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setSelectedCapture(null);
        return;
      }

      setSelectedCapture(extractCaptureMetrics(snap.data(), snap.id));
    });
  }, [tunnelId, plantId, captureId]);

  const screenTitle = captureId ? "Capture Scan Detail" : "Capture Scans";
  const filteredCount = useMemo(() => captures.length, [captures.length]);

  function openCapture(item: CaptureItem) {
    navigation.navigate("DetectionDetail", {
      tunnelId,
      plantId,
      captureId: item.id,
      filterMode,
    });
  }

  if (loading && !captureId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.centerText}>Loading plant capture scans...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (captureId) {
    return (
      <SafeAreaView style={styles.safe}>
        {!selectedCapture ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.centerText}>Loading capture details...</Text>
          </View>
        ) : (
          <CaptureFullDetail metrics={selectedCapture} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.listContent}>
        <View style={styles.listHeaderCard}>
          <View style={styles.listIconBox}>
            <Ionicons name="images-outline" size={28} color="#fff" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.listTitle}>{screenTitle}</Text>
            <Text style={styles.listSub}>
              Plant {plantId} • {filteredCount} leaf scan{filteredCount === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <Text style={styles.helpText}>
          Showing only leaf-related capture scans: downy mildew, powdery mildew, water stress, severity, pump status, and leaf counts.
        </Text>

        {captures.length === 0 ? (
          <View style={styles.emptyListCard}>
            <Ionicons name="leaf-outline" size={36} color="#90A4AE" />
            <Text style={styles.emptyListTitle}>No leaf capture scans found</Text>
            <Text style={styles.emptyListText}>
              This plant has no completed leaf output in its captures subcollection yet.
            </Text>
          </View>
        ) : (
          <View style={styles.scanList}>
            {captures.map((item) => (
              <CaptureScanCard key={item.id} item={item} onPress={() => openCapture(item)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9F9F9" },
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  centerText: { marginTop: 12, color: "#78909C", fontWeight: "700" },
  listContent: { padding: 16, paddingBottom: 30 },
  listHeaderCard: {
    backgroundColor: "#2E7D32",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  listIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  listTitle: { color: "#fff", fontSize: 21, fontWeight: "900" },
  listSub: { color: "#E8F5E9", fontSize: 13, marginTop: 4, fontWeight: "700" },
  helpText: { color: "#78909C", fontSize: 12, lineHeight: 18, marginBottom: 14, fontWeight: "700" },
  scanList: { gap: 12 },
  scanCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  scanImageWrap: { width: "100%", height: 170, backgroundColor: "#ECEFF1" },
  scanImage: { width: "100%", height: "100%", resizeMode: "cover" },
  scanImagePlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  scanBody: { padding: 14 },
  scanTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  scanStatusPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  scanDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  scanStatusText: { fontSize: 12, fontWeight: "900" },
  scanTitle: { fontSize: 15, fontWeight: "900", color: "#263238" },
  scanMeta: { color: "#90A4AE", fontSize: 11, fontWeight: "700", marginTop: 3 },
  scanIssues: { color: "#424242", fontSize: 13, fontWeight: "800", marginTop: 8, lineHeight: 18 },
  scanSeverityChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  scanSeverityChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  scanSeverityChipText: { fontSize: 10, fontWeight: "900" },
  scanStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  scanStat: { backgroundColor: "#F5F5F5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, color: "#616161", fontWeight: "800" },
  emptyListCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  emptyListTitle: { marginTop: 10, color: "#263238", fontSize: 16, fontWeight: "900" },
  emptyListText: { marginTop: 5, color: "#78909C", fontSize: 12, textAlign: "center", lineHeight: 18 },
  detailContent: { padding: 16, paddingBottom: 34 },
  imageCard: { backgroundColor: "#fff", borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "#EEEEEE", marginBottom: 14 },
  detailImage: { width: "100%", resizeMode: "cover" },
  noImageBox: { width: "100%", justifyContent: "center", alignItems: "center", backgroundColor: "#ECEFF1" },
  noImageText: { marginTop: 8, color: "#78909C", fontWeight: "800" },
  summaryCard: { backgroundColor: "#fff", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: "#EEEEEE", marginBottom: 18 },
  summaryTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  summaryTitle: { fontSize: 18, fontWeight: "900", color: "#263238" },
  summarySub: { fontSize: 12, color: "#78909C", marginTop: 4, fontWeight: "700", lineHeight: 17 },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: "900" },
  statGrid: { flexDirection: "row", gap: 10, marginTop: 14 },
  statBox: { flex: 1, backgroundColor: "#FAFAFA", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#EEEEEE" },
  statValue: { color: "#263238", fontSize: 20, fontWeight: "900" },
  statLabel: { color: "#78909C", fontSize: 11, fontWeight: "800", marginTop: 2 },
  sectionHeader: { marginTop: 4, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#263238" },
  sectionSubtitle: { color: "#78909C", fontSize: 12, marginTop: 3, lineHeight: 17 },
  emptyDetailCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "#EEEEEE", marginBottom: 16 },
  emptyDetailTitle: { marginTop: 6, color: "#263238", fontSize: 15, fontWeight: "900" },
  emptyDetailText: { marginTop: 3, color: "#78909C", fontSize: 12 },
  healthyCard: { backgroundColor: "#E8F5E9", borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  healthyTitle: { color: "#2E7D32", fontSize: 15, fontWeight: "900" },
  healthyText: { color: "#2E7D32", fontSize: 12, marginTop: 2, lineHeight: 17 },
  issuesList: { gap: 10, marginBottom: 16 },
  issueCard: { backgroundColor: "#fff", borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: "#EEEEEE" },
  issueIconBox: { width: 44, height: 44, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  issueTitle: { color: "#263238", fontSize: 15, fontWeight: "900" },
  issueSeverity: { color: "#757575", fontSize: 12, marginTop: 3, lineHeight: 17 },
  issueAction: { color: "#424242", fontSize: 12, marginTop: 3, fontWeight: "800" },
  severityList: { gap: 10, marginBottom: 16 },
  severityCard: { backgroundColor: "#fff", borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#EEEEEE" },
  severityIcon: { width: 38, height: 38, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  severityName: { color: "#263238", fontSize: 14, fontWeight: "900" },
  severityMeta: { color: "#78909C", fontSize: 11, marginTop: 2, fontWeight: "700" },
  severityRight: { alignItems: "flex-end", maxWidth: 132 },
  severityLevel: { fontSize: 13, fontWeight: "900" },
  severityNumbers: { color: "#78909C", fontSize: 10, marginTop: 2, fontWeight: "700", textAlign: "right" },
  emptySmallCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#EEEEEE", marginBottom: 16 },
  emptySmallText: { color: "#78909C", fontSize: 12, fontWeight: "700" },
  robotCard: { backgroundColor: "#fff", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: "#EEEEEE", marginBottom: 16 },
  robotTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  robotTitle: { color: "#263238", fontSize: 16, fontWeight: "900" },
  robotSub: { color: "#78909C", fontSize: 12, marginTop: 3, lineHeight: 17, fontWeight: "700" },
  decisionPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  decisionPillText: { fontSize: 11, fontWeight: "900" },
  pumpGrid: { flexDirection: "row", gap: 10, marginTop: 14 },
  pumpBox: { flex: 1, backgroundColor: "#FAFAFA", borderRadius: 16, padding: 10, borderWidth: 1, borderColor: "#EEEEEE" },
  pumpTitle: { color: "#263238", fontSize: 12, fontWeight: "900", marginTop: 5 },
  pumpValue: { color: "#111", fontSize: 14, fontWeight: "900", marginTop: 2 },
  pumpHint: { color: "#90A4AE", fontSize: 9, fontWeight: "700", marginTop: 2 },
  leafList: { gap: 8, marginBottom: 16 },
  leafRow: { backgroundColor: "#fff", borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#EEEEEE" },
  leafIndexBox: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  leafIndexText: { fontSize: 13, fontWeight: "900" },
  leafTitle: { color: "#263238", fontSize: 13, fontWeight: "900" },
  leafMeta: { color: "#78909C", fontSize: 11, marginTop: 2, fontWeight: "700" },
  leafRight: { alignItems: "flex-end" },
  leafSeverityLevel: { fontSize: 12, fontWeight: "900" },
  leafPercent: { color: "#78909C", fontSize: 11, marginTop: 2, fontWeight: "800" },
  legendWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#EEEEEE" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendColor: { width: 14, height: 14, borderRadius: 7 },
  legendText: { color: "#616161", fontSize: 12, fontWeight: "800" },
});
