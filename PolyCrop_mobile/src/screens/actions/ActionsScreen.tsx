import React from "react";
import { ScrollView, Text, View, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

// Get screen width for grid calculations
const { width } = Dimensions.get("window");
const CARD_GAP = 16;
const CARD_WIDTH = (width - (16 * 2) - CARD_GAP) / 2; // (Screen - Padding - Gap) / 2

export default function ActionsScreen({ navigation }: any) {
  useTunnelHeader("Actions");

  const actions = [
    {
      title: "Fertigation",
      desc: "Nutrient dosing",
      icon: "flask-outline",
      color: "#7B1FA2",
      bg: "#F3E5F5",
      screen: "Fertigation"
    },
    {
      title: "Schedules",
      desc: "Automate routines",
      icon: "calendar-outline",
      color: "#E65100",
      bg: "#FFF3E0",
      screen: "Schedules"
    },
    {
      title: "Disease & Stress",
      desc: "AI plant health",
      icon: "medkit-outline",
      color: "#D32F2F",
      bg: "#FFEBEE",
      screen: "DiseaseDashboard"
    },
    {
      title: "System Health",
      desc: "Device status",
      icon: "pulse-outline",
      color: "#2E7D32",
      bg: "#E8F5E9",
      screen: "SystemHealth"
    },
    {
      title: "Harvest Ready",
      desc: "Ripe cucumbers",
      icon: "basket-outline",
      color: "#EF6C00",
      bg: "#FFF3E0",
      screen: "HarvestReady"
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.8}
            onPress={() => navigation.navigate(action.screen)}
            style={[styles.card, { width: CARD_WIDTH }]}
          >
            <View style={[styles.iconContainer, { backgroundColor: action.bg }]}>
              <Ionicons name={action.icon as any} size={32} color={action.color} />
            </View>
            <View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.cardDesc}>{action.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#BDBDBD" style={styles.arrow} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 20,
    backgroundColor: "#F9F9F9",
    flexGrow: 1
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#212121",
    marginBottom: 20,
    marginLeft: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 16,
    height: 180, // Increased height for description
    justifyContent: "space-between",
    alignItems: "flex-start",
    // Premium Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#333",
    marginTop: 4,
  },
  cardDesc: {
    fontSize: 12,
    fontWeight: "500",
    color: "#757575",
    marginTop: 2,
  },
  arrow: {
    position: "absolute",
    right: 16,
    top: 16,
  }
});
