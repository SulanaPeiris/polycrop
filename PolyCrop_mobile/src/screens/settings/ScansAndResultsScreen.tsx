import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebase";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

type CaptureItem = {
  id: string;
  createdAtMs?: number;
  status?: string;
  imageUrl?: string;
  annotatedUrl?: string;
  outputs?: any;
};

export default function ScansAndResultsScreen({ navigation }: any) {
  useTunnelHeader("Scans & Results");

  const { user } = useAuth();
  const [items, setItems] = useState<CaptureItem[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "captures"), where("ownerId", "==", user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const raw = snap.docs.map((d) => {
          const data = d.data() as any;
          const createdAtMs =
            typeof data?.createdAt?.toMillis === "function"
              ? data.createdAt.toMillis()
              : 0;

          return {
            id: d.id,
            createdAtMs,
            status: data.status,
            imageUrl: data.imageUrl,
            annotatedUrl: data.annotatedUrl,
            outputs: data.outputs,
          } as CaptureItem;
        });

        raw.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
        setItems(raw);
      },
      (err) => {
        console.log("Scans listener error:", err?.code, err?.message, err);
      }
    );

    return () => unsub();
  }, [user]);

  const formatTime = (ms?: number) => {
    if (!ms) return "";
    return new Date(ms).toLocaleString();
  };

  const statusLabel = (s?: string) => {
    if (s === "DONE") return { text: "✅ Done", style: styles.done };
    if (s === "FAILED") return { text: "❌ Failed", style: styles.failed };
    if (s === "PROCESSING" || s === "UPLOADED")
      return { text: "⏳ Processing…", style: styles.processing };
    return { text: "⏳ Processing…", style: styles.processing };
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <Text style={styles.helper}>
            No scans yet. Open Camera and press Capture.
          </Text>
        ) : null}

        {items.map((it) => {
          const counts = it.outputs?.summary?.counts;
          const cuc = counts?.cucumber ?? 0;
          const leaf = counts?.leaf ?? 0;
          const flower = counts?.flower ?? 0;

          // annotated preferred
          const imgToShow = it.annotatedUrl || it.imageUrl;

          const badge = statusLabel(it.status);

          return (
            <TouchableOpacity
              key={it.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("ScanPreview", { captureId: it.id })}
            >
              {imgToShow ? (
                <Image
                  source={{ uri: imgToShow }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Ionicons name="image-outline" size={26} color="#9E9E9E" />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.time}>{formatTime(it.createdAtMs)}</Text>

                <Text style={badge.style}>{badge.text}</Text>

                <Text style={styles.line}>
                  Cucumber: {cuc} | Leaf: {leaf} | Flower: {flower}
                </Text>

                <Text style={styles.small}>
                  Tap to view preview + results
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 16, backgroundColor: "#fff", flexGrow: 1 },
  helper: { color: "#757575", marginTop: 8 },

  card: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 12,
    backgroundColor: "#FAFAFA",
    alignItems: "center",
  },

  thumb: { width: 92, height: 92, borderRadius: 12, backgroundColor: "#eee" },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },

  time: { fontWeight: "900", color: "#1B5E20" },

  line: { marginTop: 6, fontWeight: "700", color: "#333" },
  small: { marginTop: 6, color: "#666", fontSize: 12 },

  processing: { marginTop: 6, fontWeight: "800", color: "#FB8C00" },
  done: { marginTop: 6, fontWeight: "800", color: "#2E7D32" },
  failed: { marginTop: 6, fontWeight: "800", color: "#D32F2F" },
});