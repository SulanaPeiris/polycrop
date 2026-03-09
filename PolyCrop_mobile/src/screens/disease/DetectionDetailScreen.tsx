import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase/firebase";

type FilterMode = "LEAF" | "CUCUMBER" | "ALL";

function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts === "string") return Date.parse(ts) || 0;
  return 0;
}

function timeAgo(ms: number) {
  if (!ms) return "N/A";
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function bgrToRgbCss(bgr: number[]) {
  const [b, g, r] = bgr;
  return `rgb(${r}, ${g}, ${b})`;
}

function getLeafCount(docAny: any) {
  return Number(docAny?.outputs?.summary?.counts?.leaf ?? 0);
}
function getCucumberCount(docAny: any) {
  return Number(docAny?.outputs?.summary?.counts?.cucumber ?? 0);
}

function matchesFilter(docAny: any, filterMode: FilterMode) {
  if (filterMode === "ALL") return true;
  if (filterMode === "LEAF") return getLeafCount(docAny) > 0;
  if (filterMode === "CUCUMBER") return getCucumberCount(docAny) > 0;
  return true;
}

function CapturePreview({ data }: { data: any }) {
  const annotatedUrl = data?.annotatedUrl || data?.imageUrl || "";
  const imgW = data?.outputs?.image?.width ?? 1;
  const imgH = data?.outputs?.image?.height ?? 1;
  const aspectRatio = imgW / imgH;

  const createdAtMs = tsToMs(data?.createdAt) || tsToMs(data?.updatedAt);

  const counts = data?.outputs?.summary?.counts ?? {};
  const diseases: string[] = data?.outputs?.summary?.diseases ?? [];
  const sprayRecommended: boolean = !!data?.outputs?.summary?.sprayRecommended;

  const legend: Array<{ name: string; colorBGR: number[] }> = data?.outputs?.disease?.legend ?? [];
  const perLeaf: any[] = data?.outputs?.disease?.perLeaf ?? [];

  const topLeaves = useMemo(() => {
    const sorted = [...perLeaf].sort((a, b) => (b.totalSeverityPercent ?? 0) - (a.totalSeverityPercent ?? 0));
    return sorted.slice(0, 8);
  }, [perLeaf]);

  const ripeness = data?.outputs?.ripeness;
  const cm = ripeness?.cm;
  const ripe = ripeness?.ripe;

  return (
    <View>
      {annotatedUrl ? (
        <Image source={{ uri: annotatedUrl }} style={[styles.image, { aspectRatio }]} resizeMode="contain" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.helper}>No image available</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.title}>Summary</Text>
        <Text style={styles.line}>
          Time: {createdAtMs ? new Date(createdAtMs).toLocaleString() : "N/A"} ({timeAgo(createdAtMs)})
        </Text>
        <Text style={styles.line}>
          Cucumber: {counts.cucumber ?? 0} | Leaf: {counts.leaf ?? 0} | Flower: {counts.flower ?? 0}
        </Text>
        <Text style={styles.line}>Diseases: {diseases.length ? diseases.join(", ") : "None"}</Text>
        <Text style={[styles.line, sprayRecommended ? styles.sprayYes : styles.sprayNo]}>
          Spray: {sprayRecommended ? "Recommended" : "Not needed"}
        </Text>

        {/* Cucumber size */}
        {cm ? (
          <Text style={styles.line}>
            Size: {cm.lengthCm}cm × {cm.diameterCm}cm •{" "}
            {ripe === true ? "RIPE" : ripe === false ? "NOT RIPE" : "N/A"}
          </Text>
        ) : null}
      </View>

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

      <View style={styles.card}>
        <Text style={styles.title}>Leaf Severity (Top)</Text>
        {topLeaves.length === 0 ? (
          <Text style={styles.helper}>No disease detected on leaves.</Text>
        ) : (
          topLeaves.map((l) => (
            <View key={String(l.leafIndex)} style={styles.leafRow}>
              <Text style={styles.leafName}>Leaf #{(l.leafIndex ?? 0) + 1}</Text>
              <Text style={styles.leafSev}>{(l.totalSeverityPercent ?? 0).toFixed(2)}%</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export default function DetectionDetailScreen({ route, navigation }: any) {
  // Backward compatible
  const captureId: string | undefined =
    route?.params?.captureId ?? route?.params?.imageId ?? route?.params?.id;

  const tunnelId: string | undefined = route?.params?.tunnelId;
  const plantId: string | undefined = route?.params?.plantId;

  // ✅ This controls which scans are shown when in plant mode
  const initialFilter: FilterMode = (route?.params?.filterMode ?? "LEAF") as FilterMode;
  const [filterMode, setFilterMode] = useState<FilterMode>(initialFilter);

  // -----------------------
  // MODE A: Plant scan list (tunnelId+plantId)
  // -----------------------
  const [list, setList] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [activeDoc, setActiveDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const inPlantMode = !!tunnelId && !!plantId;

  const filteredList = useMemo(() => {
    if (!inPlantMode) return [];
    return list.filter((x) => matchesFilter(x, filterMode));
  }, [list, filterMode, inPlantMode]);

  // Load plant captures list
  useEffect(() => {
    if (!inPlantMode) return;

    setLoading(true);
    const ref = collection(db, "tunnels", tunnelId!, "plants", plantId!, "captures");
    const q = query(ref, orderBy("updatedAt", "desc"), limit(200));

    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setList(items);
        setLoading(false);

        // choose active
        const filtered = items.filter((x) => matchesFilter(x, filterMode));
        const preferred = captureId && filtered.some((x) => x.id === captureId) ? captureId : filtered[0]?.id;

        setActiveId(preferred ?? "");
      },
      (err) => {
        console.log("plant captures error:", err?.message);
        setLoading(false);
      }
    );
  }, [inPlantMode, tunnelId, plantId, captureId, filterMode]);

  // Subscribe active capture doc (prefer plant path; fallback top-level)
  useEffect(() => {
    if (!inPlantMode) return;
    if (!activeId) {
      setActiveDoc(null);
      return;
    }

    let unsub1: any = null;
    let unsub2: any = null;

    const plantRef = doc(db, "tunnels", tunnelId!, "plants", plantId!, "captures", activeId);
    unsub1 = onSnapshot(plantRef, (snap) => {
      if (snap.exists()) {
        setActiveDoc({ id: snap.id, ...(snap.data() as any) });
        unsub2?.();
        return;
      }
      // fallback to top-level
      const topRef = doc(db, "captures", activeId);
      unsub2 = onSnapshot(topRef, (snap2) => {
        setActiveDoc(snap2.exists() ? { id: snap2.id, ...(snap2.data() as any) } : null);
      });
    });

    return () => {
      unsub1?.();
      unsub2?.();
    };
  }, [inPlantMode, tunnelId, plantId, activeId]);

  // -----------------------
  // MODE B: Single capture (only captureId)
  // -----------------------
  const [singleDoc, setSingleDoc] = useState<any>(null);
  const [singleLoading, setSingleLoading] = useState(false);

  useEffect(() => {
    if (inPlantMode) return;
    if (!captureId) return;

    setSingleLoading(true);
    const ref = doc(db, "captures", captureId);
    return onSnapshot(
      ref,
      (snap) => {
        setSingleDoc(snap.exists() ? snap.data() : null);
        setSingleLoading(false);
      },
      () => setSingleLoading(false)
    );
  }, [inPlantMode, captureId]);

  // -----------------------
  // UI
  // -----------------------
  if (inPlantMode) {
    if (loading) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.helper}>Loading plant scans…</Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Detection Detail</Text>
          <Text style={styles.sub}>
            Plant: {plantId} • Showing {filteredList.length}/{list.length}
          </Text>

          {/* Filter tabs */}
          <View style={styles.tabs}>
            {(["LEAF", "CUCUMBER", "ALL"] as FilterMode[]).map((m) => {
              const active = filterMode === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setFilterMode(m)}
                  style={[styles.tab, active && styles.tabActive]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {m === "LEAF" ? "Leaf" : m === "CUCUMBER" ? "Cucumber" : "All"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeDoc ? (
            <CapturePreview data={activeDoc} />
          ) : (
            <View style={styles.card}>
              <Text style={styles.helper}>No scan selected.</Text>
            </View>
          )}

          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={[styles.title, { marginBottom: 10 }]}>Scans for this Plant</Text>

            {filteredList.length === 0 ? (
              <Text style={styles.helper}>
                {filterMode === "LEAF"
                  ? "No leaf-detected scans for this plant."
                  : filterMode === "CUCUMBER"
                  ? "No cucumber-detected scans for this plant."
                  : "No scans yet."}
              </Text>
            ) : (
              <FlatList
                data={filteredList}
                keyExtractor={(it) => it.id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const isActive = item.id === activeId;
                  const thumb = item.annotatedUrl || item.imageUrl || "";
                  const ms = tsToMs(item.updatedAt) || tsToMs(item.createdAt);

                  const spray = !!item.outputs?.summary?.sprayRecommended;
                  const leaf = getLeafCount(item);
                  const cuc = getCucumberCount(item);

                  return (
                    <TouchableOpacity
                      onPress={() => setActiveId(item.id)}
                      style={[styles.scanRow, isActive && styles.scanRowActive]}
                      activeOpacity={0.85}
                    >
                      <View style={styles.thumbBox}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.thumb} />
                        ) : (
                          <View style={[styles.thumb, { alignItems: "center", justifyContent: "center" }]}>
                            <Ionicons name="image-outline" size={18} color="#9E9E9E" />
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.scanTitle} numberOfLines={1}>
                          {item.id}
                        </Text>
                        <Text style={styles.scanMeta}>
                          {ms ? timeAgo(ms) : "N/A"} • {spray ? "SPRAY" : "NO SPRAY"} • Leaf {leaf} • Cuc {cuc}
                        </Text>
                      </View>

                      <Ionicons name="chevron-forward" size={18} color={isActive ? "#2E7D32" : "#BDBDBD"} />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Single capture mode (backward compatible)
  if (!captureId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={styles.center}>
          <Text style={styles.helper}>Missing captureId (or tunnelId/plantId).</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (singleLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.helper}>Loading scan…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!singleDoc) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={styles.center}>
          <Text style={styles.helper}>Scan not found.</Text>
          <Text style={styles.helperSmall}>captureId: {captureId}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Detection Detail</Text>
        <Text style={styles.sub}>captureId: {captureId}</Text>
        <CapturePreview data={singleDoc} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff", flexGrow: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  helper: { color: "#757575", marginTop: 8, fontWeight: "700" },
  helperSmall: { color: "#9E9E9E", marginTop: 8, fontSize: 12 },

  h1: { fontSize: 18, fontWeight: "900", color: "#1B5E20" },
  sub: { marginTop: 6, color: "#777", fontWeight: "700" },

  image: { width: "100%", backgroundColor: "#000", borderRadius: 14, marginTop: 12 },
  imagePlaceholder: { height: 240, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F5" },

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

  tabs: { flexDirection: "row", gap: 10, marginTop: 12 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#EEEEEE",
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#2E7D32" },
  tabText: { fontWeight: "900", color: "#333" },
  tabTextActive: { color: "#fff" },

  scanRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  scanRowActive: { backgroundColor: "#E8F5E9", borderRadius: 12, paddingHorizontal: 10 },

  thumbBox: { width: 54, height: 54, borderRadius: 12, overflow: "hidden", backgroundColor: "#F5F5F5" },
  thumb: { width: "100%", height: "100%" },

  scanTitle: { fontWeight: "900", color: "#333", fontSize: 12 },
  scanMeta: { color: "#777", marginTop: 2, fontWeight: "700", fontSize: 11 },
});