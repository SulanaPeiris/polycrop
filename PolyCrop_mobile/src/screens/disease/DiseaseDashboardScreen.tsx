import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2;

export default function DiseaseDashboardScreen({ navigation }: any) {
  useTunnelHeader("Disease & Stress");

  // Simulated Tunnel Status
  const metrics = [
    {
      title: "Downy Mildew",
      status: "Low Risk",
      icon: "leaf",
      color: "#2E7D32",
      bg: "#E8F5E9" // Green theme
    },
    {
      title: "Powdery Mildew",
      status: "High Risk",
      icon: "snow",
      color: "#D32F2F",
      bg: "#FFEBEE" // Red theme
    },
    {
      title: "Water Stress",
      status: "Moderate",
      icon: "water",
      color: "#EF6C00",
      bg: "#FFF3E0" // Orange theme
    },
    {
      title: "Total Alerts",
      status: "3 Plants",
      icon: "alert-circle",
      color: "#1565C0",
      bg: "#E3F2FD" // Blue theme
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* 1. Header: Health Score */}
      <View style={styles.scoreContainer}>
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreValue}>85<Text style={{ fontSize: 14 }}>%</Text></Text>
          <Text style={styles.scoreLabel}>Health</Text>
        </View>
        <View style={styles.headerTexts}>
          <Text style={styles.headerTitle}>Tunnel Status</Text>
          <Text style={styles.headerSubtitle}>System Monitoring Active</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Stable Condition</Text>
          </View>
        </View>
      </View>

      {/* 2. Grid Dashboard */}
      <SectionTitle title="Real-time Metrics" />
      <View style={styles.grid}>
        {metrics.map((m, index) => (
          <View key={index} style={[styles.card, { width: CARD_WIDTH }]}>
            <View style={[styles.iconContainer, { backgroundColor: m.bg }]}>
              <Ionicons name={m.icon as any} size={28} color={m.color} />
            </View>
            <View>
              <Text style={styles.cardStatus}>{m.status}</Text>
              <Text style={styles.cardTitle}>{m.title}</Text>
            </View>
          </View>
        ))}
      </View>


      {/* 3. CTA to Map */}
      <View style={styles.ctaSection}>
        <SectionTitle title="Visual Detection" />
        <TouchableOpacity
          style={styles.mapCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("DetectionFeed")}
        >
          <LinearGradient
            colors={['#66BB6A', '#2E7D32']}
            style={styles.mapBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.mapContent}>
              <View style={styles.mapIconBox}>
                <Ionicons name="scan" size={32} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mapTitle}>Tunnel Visualization</Text>
                <Text style={styles.mapSubtitle}>Interactive Plant Map & Heatmap</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#E8F5E9" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#FAFAFA", flexGrow: 1 },

  // Header Score
  scoreContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", padding: 24, borderRadius: 28,
    marginBottom: 32,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2
  },
  scoreCircle: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: "#E0F2F1",
    alignItems: "center", justifyContent: "center", marginRight: 20
  },
  scoreValue: { fontSize: 28, fontWeight: "800", color: "#00695C" },
  scoreLabel: { fontSize: 10, color: "#80CBC4", fontWeight: "700", textTransform: "uppercase" },
  headerTexts: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#212121", marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: "#757575", marginBottom: 8 },
  statusBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#E8F5E9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2E7D32", marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: "700", color: "#2E7D32" },

  // Grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP, marginBottom: 32 },
  card: {
    backgroundColor: "#fff", borderRadius: 24, padding: 16, height: 160,
    justifyContent: "space-between",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1
  },
  iconContainer: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  cardStatus: { fontSize: 18, fontWeight: "800", color: "#263238", marginBottom: 4 },
  cardTitle: { fontSize: 13, fontWeight: "600", color: "#90A4AE" },

  // Map CTA
  ctaSection: { marginTop: 0 },
  mapCard: {
    borderRadius: 24, overflow: 'hidden',
    shadowColor: "#2E7D32", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6
  },
  mapBackground: { padding: 24 },
  mapContent: { flexDirection: "row", alignItems: "center", gap: 16 },
  mapIconBox: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center"
  },
  mapTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  mapSubtitle: { fontSize: 13, color: "#E8F5E9", marginTop: 4 },

});
