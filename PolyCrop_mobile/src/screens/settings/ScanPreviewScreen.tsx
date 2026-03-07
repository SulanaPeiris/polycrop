import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, onSnapshot } from "firebase/firestore";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { db } from "../../firebase/firebase";
import { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ScanPreview">;

function bgrToRgbCss(bgr: number[]) {
  const [b, g, r] = bgr;
  return `rgb(${r}, ${g}, ${b})`;
}

export default function ScanPreviewScreen({ route }: Props) {
  const { captureId } = route.params;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "captures", captureId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [captureId]);

  const annotatedUrl = data?.annotatedUrl || data?.imageUrl || "";
  const imgW = data?.outputs?.image?.width ?? 1;
  const imgH = data?.outputs?.image?.height ?? 1;
  const aspectRatio = imgW / imgH;

  const counts = data?.outputs?.summary?.counts ?? {};
  const diseases: string[] = data?.outputs?.summary?.diseases ?? [];
  const sprayRecommended: boolean = !!data?.outputs?.summary?.sprayRecommended;

  const legend: Array<{ name: string; colorBGR: number[] }> = data?.outputs?.disease?.legend ?? [];
  const perLeaf: any[] = data?.outputs?.disease?.perLeaf ?? [];

  const topLeaves = useMemo(() => {
    const sorted = [...perLeaf].sort((a, b) => (b.totalSeverityPercent ?? 0) - (a.totalSeverityPercent ?? 0));
    return sorted.slice(0, 8);
  }, [perLeaf]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.helper}>Loading scan…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={styles.center}>
          <Text style={styles.helper}>Scan not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Annotated Image */}
        {annotatedUrl ? (
          <Image source={{ uri: annotatedUrl }} style={[styles.image, { aspectRatio }]} resizeMode="contain" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.helper}>No image available</Text>
          </View>
        )}

        {/* Summary */}
        <View style={styles.card}>
          <Text style={styles.title}>Summary</Text>
          <Text style={styles.line}>
            Cucumber: {counts.cucumber ?? 0} | Leaf: {counts.leaf ?? 0} | Flower: {counts.flower ?? 0}
          </Text>
          <Text style={styles.line}>Diseases: {diseases.length ? diseases.join(", ") : "None"}</Text>
          <Text style={[styles.line, sprayRecommended ? styles.sprayYes : styles.sprayNo]}>
            Spray: {sprayRecommended ? "Recommended" : "Not needed"}
          </Text>
        </View>

        {/* Legend */}
        {legend.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.title}>Legend</Text>
            {legend.map((it, idx) => (
              <View key={`${it.name}-${idx}`} style={styles.legendRow}>
                <View style={[styles.swatch, { backgroundColor: bgrToRgbCss(it.colorBGR) }]} />
                <Text style={styles.legendText}>{it.name.replaceAll("_", " ")}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Leaf severity */}
        <View style={styles.card}>
          <Text style={styles.title}>Leaf Severity (Top)</Text>

          {topLeaves.length === 0 ? (
            <Text style={styles.helper}>No disease detected on leaves.</Text>
          ) : (
            topLeaves.map((l) => (
              <View key={String(l.leafIndex)} style={styles.leafRow}>
                <Text style={styles.leafName}>Leaf #{l.leafIndex + 1}</Text>
                <Text style={styles.leafSev}>{(l.totalSeverityPercent ?? 0).toFixed(2)}%</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff", flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  helper: { color: "#757575", marginTop: 8 },

  image: {
    width: "100%",
    backgroundColor: "#000",
    borderRadius: 14,
  },
  imagePlaceholder: {
    height: 240,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
  },

  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#FAFAFA",
  },

  title: { fontWeight: "900", color: "#1B5E20", fontSize: 16, marginBottom: 8 },
  line: { marginTop: 6, fontWeight: "700", color: "#333" },

  sprayYes: { color: "#D32F2F" },
  sprayNo: { color: "#2E7D32" },

  legendRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10 },
  swatch: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "#ddd" },
  legendText: { fontWeight: "700", color: "#333" },

  leafRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  leafName: { fontWeight: "800", color: "#333" },
  leafSev: { fontWeight: "900", color: "#D32F2F" },
});