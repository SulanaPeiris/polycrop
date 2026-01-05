import React from "react";
import { ScrollView, Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TunnelOverview from "../components/TunnelOverview";
import SectionTitle from "../components/SectionTitle";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

export default function HomeScreen() {
  const { tunnels, selectedTunnelId, setSelectedTunnelId, selectedTunnel } = useTunnel();
  useTunnelHeader("Home");

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      {/* 1. Tunnel List Section */}
      <View style={styles.listSection}>
        <SectionTitle title="Your Polytunnels" />
        <View style={styles.tunnelList}>
          {tunnels.map((t) => {
            const active = t.id === selectedTunnelId;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setSelectedTunnelId(t.id)}
                style={[styles.tunnelButton, active && styles.tunnelButtonActive]}
              >
                <View style={styles.tunnelRow}>
                  <Ionicons
                    name="business"
                    size={16}
                    color={active ? "#FFF" : "#555"}
                  />
                  <Text style={[styles.tunnelBtnText, active && styles.tunnelBtnTextActive]}>
                    {t.name}
                  </Text>
                </View>
                {/* Status Dot */}
                <View style={[
                  styles.statusDot,
                  { backgroundColor: t.status === "GOOD" ? "#4CAF50" : t.status === "WARN" ? "#FFC107" : "#F44336" }
                ]} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Overview Section (Differentiated) */}
      <View style={styles.overviewSection}>
        <View style={styles.overviewHeader}>
          <Ionicons name="stats-chart" size={20} color="#2E7D32" />
          <Text style={styles.overviewTitle}>Detailed Overview</Text>
        </View>

        <TunnelOverview tunnel={selectedTunnel} />
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    backgroundColor: "#FFFFFF"
  },

  // List Section
  listSection: {
    padding: 16,
    paddingBottom: 8
  },
  tunnelList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8
  },
  tunnelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    minWidth: "47%" // 2 per row
  },
  tunnelButtonActive: {
    backgroundColor: "#2E7D32", // Green Primary
    borderColor: "#2E7D32",
  },
  tunnelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  tunnelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333"
  },
  tunnelBtnTextActive: {
    color: "#FFFFFF"
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },

  // Overview Section
  overviewSection: {
    marginTop: 16,
    backgroundColor: "#F1F8E9", // Very Light Green Background
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingTop: 24,
    minHeight: 500 // Min height to fill screen visually
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B5E20"
  }
});
