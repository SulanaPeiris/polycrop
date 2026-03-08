import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebase";
import { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ScansAndResults">;

type CaptureItem = {
  id: string;
  createdAtMs: number;
  status?: "UPLOADED" | "PROCESSING" | "DONE" | "FAILED" | string;
  imageUrl?: string;
  annotatedUrl?: string;
  outputs?: any;
};

function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return 0;
}

function formatTime(ms: number) {
  try {
    return ms ? new Date(ms).toLocaleString() : "";
  } catch {
    return "";
  }
}

export default function ScansAndResultsScreen({ navigation }: Props) {
  const { user } = useAuth();

  const [items, setItems] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // ✅ No orderBy => no composite index needed
    const q = query(
      collection(db, "captures"),
      where("ownerId", "==", user.uid),
      limit(200)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const raw: CaptureItem[] = snap.docs.map((d) => {
          const data: any = d.data();
          const createdAtMs = tsToMs(data?.createdAt) || data?.createdAtMs || 0;

          return {
            id: d.id,
            createdAtMs,
            status: data.status,
            imageUrl: data.imageUrl,
            annotatedUrl: data.annotatedUrl,
            outputs: data.outputs,
          };
        });

        // ✅ Sort client-side
        raw.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

        setItems(raw);
        setLoading(false);
      },
      (err) => {
        console.log("Scans listener error:", err);
        setLoading(false);

        // Show the real reason (index / permission / etc.)
        Alert.alert("Scans Error", err?.message ?? "Failed to load scans.");
      }
    );

    return () => unsub();
  }, [user]);

  const empty = !loading && items.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.helper}>Loading scans…</Text>
          </View>
        ) : null}

        {empty ? <Text style={styles.helper}>No scans yet. Open Camera and press Capture.</Text> : null}

        {items.map((it) => {
          const counts = it.outputs?.summary?.counts ?? {};
          const cuc = counts.cucumber ?? 0;
          const leaf = counts.leaf ?? 0;
          const flower = counts.flower ?? 0;

          const diseases: string[] = it.outputs?.summary?.diseases ?? [];
          const sprayRecommended: boolean = !!it.outputs?.summary?.sprayRecommended;

          const imgToShow = it.annotatedUrl || it.imageUrl;

          return (
            <TouchableOpacity
              key={it.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("ScanPreview", { captureId: it.id })}
            >
              {imgToShow ? (
                <Image source={{ uri: imgToShow }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Ionicons name="image-outline" size={26} color="#9E9E9E" />
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.time}>{formatTime(it.createdAtMs)}</Text>

                <Text
                  style={[
                    styles.status,
                    it.status === "DONE"
                      ? styles.done
                      : it.status === "FAILED"
                      ? styles.failed
                      : styles.processing,
                  ]}
                >
                  {it.status === "DONE"
                    ? "✅ Done"
                    : it.status === "FAILED"
                    ? "❌ Failed"
                    : "⏳ Processing…"}
                </Text>

                <Text style={styles.line}>
                  Cucumber: {cuc} | Leaf: {leaf} | Flower: {flower}
                </Text>

                <Text style={styles.small}>
                  Diseases: {diseases.length ? diseases.join(", ") : "None"}
                </Text>

                <Text style={[styles.small, sprayRecommended ? styles.sprayYes : styles.sprayNo]}>
                  Spray: {sprayRecommended ? "Recommended" : "Not needed"}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff", flexGrow: 1 },
  helper: { color: "#757575", marginTop: 8 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 18 },

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
  status: { marginTop: 6, fontWeight: "800" },
  processing: { color: "#FB8C00" },
  done: { color: "#2E7D32" },
  failed: { color: "#D32F2F" },

  line: { marginTop: 6, fontWeight: "700", color: "#333" },
  small: { marginTop: 6, color: "#666", fontSize: 12 },
  sprayYes: { color: "#D32F2F", fontWeight: "800" },
  sprayNo: { color: "#2E7D32", fontWeight: "800" },
});