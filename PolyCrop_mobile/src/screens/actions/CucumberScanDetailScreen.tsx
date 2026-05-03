import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import {
  buildCucumberScanVM,
  CucumberItem,
  CucumberScanVM,
  formatCm,
  formatDateTime,
  formatPercent,
  timeAgo,
} from "../../services/cucumberScanUtils";

function statusColors(ripe: boolean | null | undefined) {
  if (ripe === true) {
    return { bg: "#FFF3E0", text: "#EF6C00", border: "#FFE0B2", label: "RIPE" };
  }
  if (ripe === false) {
    return { bg: "#E8F5E9", text: "#2E7D32", border: "#C8E6C9", label: "UNRIPE" };
  }
  return { bg: "#F5F5F5", text: "#777", border: "#EEEEEE", label: "UNKNOWN" };
}

function CucumberCard({ cucumber, fallbackIndex }: { cucumber: CucumberItem; fallbackIndex: number }) {
  const index = Number.isFinite(Number(cucumber?.index)) ? Number(cucumber.index) : fallbackIndex;
  const colors = statusColors(cucumber?.ripe);
  const cm = cucumber?.cm;
  const px = cucumber?.pixel;
  const box = cucumber?.box;

  return (
    <View style={[styles.cucumberCard, { borderColor: colors.border }]}>
      <View style={styles.cucumberHeader}>
        <View style={styles.cucumberIconBox}>
          <Ionicons name="nutrition-outline" size={20} color="#2E7D32" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cucumberTitle}>Cucumber #{index + 1}</Text>
          <Text style={styles.cucumberSub}>Confidence: {formatPercent(cucumber?.conf, 0)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusPillText, { color: colors.text }]}>{colors.label}</Text>
        </View>
      </View>

      <View style={styles.detailGrid}>
        <View style={styles.detailBox}>
          <Text style={styles.detailValue}>{cm ? formatCm(cm.lengthCm, 2) : px?.lengthPx ? `${Math.round(Number(px.lengthPx))} px` : "N/A"}</Text>
          <Text style={styles.detailLabel}>Length</Text>
        </View>
        <View style={styles.detailBox}>
          <Text style={styles.detailValue}>{cm ? formatCm(cm.diameterCm, 2) : px?.diameterPx ? `${Math.round(Number(px.diameterPx))} px` : "N/A"}</Text>
          <Text style={styles.detailLabel}>Diameter</Text>
        </View>
      </View>

      {cm?.cmPerPx ? (
        <Text style={styles.noteText}>Calibration scale: {cm.cmPerPx} cm/px</Text>
      ) : (
        <Text style={styles.noteText}>Centimeter size unavailable if distance or camera calibration is missing.</Text>
      )}

      {box?.length === 4 ? (
        <Text style={styles.boxText}>Box: [{box.map((x) => Math.round(Number(x))).join(", ")}]</Text>
      ) : null}
    </View>
  );
}

export default function CucumberScanDetailScreen({ route, navigation }: any) {
  useTunnelHeader("Cucumber Scan Detail");

  const tunnelId: string = route?.params?.tunnelId ?? "";
  const plantId: string = route?.params?.plantId ?? "";
  const captureId: string = route?.params?.captureId ?? "";

  const [scan, setScan] = useState<CucumberScanVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!tunnelId || !plantId || !captureId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    setLoading(true);
    setNotFound(false);

    let unsubscribeTopLevel: undefined | (() => void);

    const plantRef = doc(db, "tunnels", tunnelId, "plants", plantId, "captures", captureId);
    const unsubscribePlant = onSnapshot(
      plantRef,
      (snap) => {
        if (snap.exists()) {
          setScan(buildCucumberScanVM(snap.id, snap.data()));
          setLoading(false);
          setNotFound(false);
          unsubscribeTopLevel?.();
          unsubscribeTopLevel = undefined;
          return;
        }

        if (!unsubscribeTopLevel) {
          const topRef = doc(db, "captures", captureId);
          unsubscribeTopLevel = onSnapshot(
            topRef,
            (topSnap) => {
              if (topSnap.exists()) {
                setScan(buildCucumberScanVM(topSnap.id, topSnap.data()));
                setNotFound(false);
              } else {
                setScan(null);
                setNotFound(true);
              }
              setLoading(false);
            },
            (err) => {
              console.log("top-level capture detail error:", err?.message);
              setLoading(false);
              setNotFound(true);
            }
          );
        }
      },
      (err) => {
        console.log("plant capture detail error:", err?.message);
        setLoading(false);
        setNotFound(true);
      }
    );

    return () => {
      unsubscribePlant();
      unsubscribeTopLevel?.();
    };
  }, [captureId, plantId, tunnelId]);

  const rules = scan?.raw?.outputs?.ripeness?.rules ?? {};
  const imageUri = scan?.annotatedUrl || scan?.imageUrl || "";
  const titleId = captureId ? captureId.slice(0, 10) : "N/A";

  const sortedCucumbers = useMemo(() => {
    if (!scan?.cucumbers) return [];
    return [...scan.cucumbers].sort((a, b) => {
      if (a?.ripe === true && b?.ripe !== true) return -1;
      if (a?.ripe !== true && b?.ripe === true) return 1;
      return Number(a?.index ?? 0) - Number(b?.index ?? 0);
    });
  }, [scan?.cucumbers]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2E7D32" />
        <Text style={styles.emptyText}>Loading cucumber scan…</Text>
      </View>
    );
  }

  if (notFound || !scan) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={42} color="#EF6C00" />
        <Text style={styles.emptyTitle}>Scan not found</Text>
        <Text style={styles.emptyText}>captureId: {captureId || "N/A"}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#2E7D32" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>Scan {titleId}</Text>
            <Text style={styles.screenSub}>Plant {plantId}</Text>
          </View>
        </View>

        <View style={styles.imageCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={38} color="#A5D6A7" />
              <Text style={styles.emptyText}>No annotated image available</Text>
            </View>
          )}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryTitle}>Scan Summary</Text>
              <Text style={styles.summarySub}>
                {scan.displayTimeMs ? `${timeAgo(scan.displayTimeMs)} • ${formatDateTime(scan.displayTimeMs)}` : "Time N/A"}
              </Text>
            </View>
            <View style={scan.ripeCount > 0 ? styles.readyBadge : styles.normalBadge}>
              <Text style={scan.ripeCount > 0 ? styles.readyBadgeText : styles.normalBadgeText}>
                {scan.ripeCount > 0 ? "HARVEST" : "GROWING"}
              </Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{scan.cucumberCount}</Text>
              <Text style={styles.summaryLabel}>Detected</Text>
            </View>
            <View style={styles.summaryBoxOrange}>
              <Text style={[styles.summaryValue, { color: "#EF6C00" }]}>{scan.ripeCount}</Text>
              <Text style={styles.summaryLabel}>Ripe</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{scan.unripeCount}</Text>
              <Text style={styles.summaryLabel}>Unripe</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{formatCm(scan.distanceCm, 1)}</Text>
              <Text style={styles.summaryLabel}>Ultrasonic distance</Text>
            </View>
          </View>

          <View style={styles.ruleBox}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#2E7D32" />
            <Text style={styles.ruleText}>
              Ripe rule: length {formatCm(rules?.minLengthCm, 1)}–{formatCm(rules?.maxLengthCm, 1)} and diameter {formatCm(rules?.minDiameterCm, 1)}–{formatCm(rules?.maxDiameterCm, 1)}.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Individual Cucumber Sizes</Text>

        {sortedCucumbers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="nutrition-outline" size={42} color="#A5D6A7" />
            <Text style={styles.emptyTitle}>No individual cucumber data</Text>
            <Text style={styles.emptyText}>The scan has a count, but the backend did not save per-cucumber size objects.</Text>
          </View>
        ) : (
          sortedCucumbers.map((cucumber, index) => (
            <CucumberCard key={`${cucumber.index ?? index}-${index}`} cucumber={cucumber} fallbackIndex={index} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F9F7" },
  container: { padding: 16, paddingBottom: 34 },
  center: { flex: 1, backgroundColor: "#F7F9F7", alignItems: "center", justifyContent: "center", padding: 22 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  screenTitle: { fontSize: 20, fontWeight: "900", color: "#1B5E20" },
  screenSub: { color: "#777", marginTop: 2, fontWeight: "700" },
  imageCard: { backgroundColor: "#fff", borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "#EAEFEA", marginBottom: 14 },
  image: { width: "100%", height: 360, backgroundColor: "#111" },
  imagePlaceholder: { height: 240, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  summaryCard: { backgroundColor: "#fff", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#EAEFEA", marginBottom: 18 },
  summaryHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 },
  summaryTitle: { fontSize: 18, fontWeight: "900", color: "#222" },
  summarySub: { color: "#777", marginTop: 4, fontSize: 12, fontWeight: "700" },
  readyBadge: { backgroundColor: "#FFF3E0", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  readyBadgeText: { color: "#EF6C00", fontSize: 11, fontWeight: "900" },
  normalBadge: { backgroundColor: "#E8F5E9", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  normalBadgeText: { color: "#2E7D32", fontSize: 11, fontWeight: "900" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryBox: { width: "48%", backgroundColor: "#F7FAF7", borderRadius: 16, padding: 13, borderWidth: 1, borderColor: "#ECF2EC" },
  summaryBoxOrange: { width: "48%", backgroundColor: "#FFF7ED", borderRadius: 16, padding: 13, borderWidth: 1, borderColor: "#FFE0B2" },
  summaryValue: { color: "#1B5E20", fontSize: 18, fontWeight: "900" },
  summaryLabel: { color: "#777", marginTop: 4, fontSize: 11, fontWeight: "800" },
  ruleBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#E8F5E9", borderRadius: 16, padding: 12, marginTop: 12 },
  ruleText: { flex: 1, color: "#2E7D32", fontSize: 12, fontWeight: "800", lineHeight: 18 },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#222", marginBottom: 12 },
  cucumberCard: { backgroundColor: "#fff", borderRadius: 20, padding: 14, borderWidth: 1, marginBottom: 12 },
  cucumberHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  cucumberIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  cucumberTitle: { color: "#222", fontSize: 15, fontWeight: "900" },
  cucumberSub: { color: "#777", fontSize: 12, marginTop: 3, fontWeight: "700" },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusPillText: { fontSize: 11, fontWeight: "900" },
  detailGrid: { flexDirection: "row", gap: 10 },
  detailBox: { flex: 1, backgroundColor: "#F7FAF7", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#ECF2EC" },
  detailValue: { color: "#1B5E20", fontSize: 16, fontWeight: "900" },
  detailLabel: { color: "#777", marginTop: 4, fontSize: 11, fontWeight: "800" },
  noteText: { color: "#777", marginTop: 10, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  boxText: { color: "#999", marginTop: 6, fontSize: 11, fontWeight: "700" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 22, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#EAEFEA" },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#1B5E20", marginTop: 10, textAlign: "center" },
  emptyText: { color: "#777", marginTop: 8, textAlign: "center", lineHeight: 20, fontWeight: "600" },
});
