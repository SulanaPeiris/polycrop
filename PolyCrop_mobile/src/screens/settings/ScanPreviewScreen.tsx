import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator } from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

export default function ScanPreviewScreen({ route }: any) {
  const { captureId } = route.params;
  useTunnelHeader("Scan Result");

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "captures", captureId);
    const unsub = onSnapshot(ref, (snap) => {
      setItem(snap.exists() ? snap.data() : null);
      setLoading(false);
    });
    return () => unsub();
  }, [captureId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading…</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Capture not found.</Text>
      </View>
    );
  }

  const counts = item?.outputs?.summary?.counts ?? {};
  const cuc = counts.cucumber ?? 0;
  const leaf = counts.leaf ?? 0;
  const flower = counts.flower ?? 0;

  const imageUrl = item.annotatedUrl || item.imageUrl;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>Detected Counts</Text>
        <Text style={styles.row}>Cucumber: {cuc}</Text>
        <Text style={styles.row}>Leaf: {leaf}</Text>
        <Text style={styles.row}>Flower: {flower}</Text>

        <Text style={styles.subTitle}>Thresholds</Text>
        <Text style={styles.small}>
          Cucumber: {item?.outputs?.thresholds?.cucumber ?? "-"} | Leaf: {item?.outputs?.thresholds?.leaf ?? "-"} |
          Flower: {item?.outputs?.thresholds?.flower ?? "-"}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff" },
  image: { width: "100%", height: 420, backgroundColor: "#000", borderRadius: 16 },
  card: { marginTop: 14, borderWidth: 1, borderColor: "#eee", borderRadius: 16, padding: 14, backgroundColor: "#FAFAFA" },
  title: { fontWeight: "900", fontSize: 16, color: "#1B5E20", marginBottom: 10 },
  row: { fontWeight: "800", color: "#333", marginTop: 6 },
  subTitle: { marginTop: 14, fontWeight: "900", color: "#1B5E20" },
  small: { marginTop: 6, color: "#666" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
});