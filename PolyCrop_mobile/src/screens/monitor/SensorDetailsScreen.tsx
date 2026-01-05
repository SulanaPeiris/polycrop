import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { useNavigation } from "@react-navigation/native";

import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

const screenWidth = Dimensions.get("window").width;

export default function SensorDetailsScreen({ route }: any) {
  const { title, sensorId } = route.params;
  const navigation = useNavigation();

  // "Day" | "Month" | "Year"
  const [filter, setFilter] = useState("Day");

  const isFault = title.includes("Fault");
  const isHumidity = title.includes("Humidity");

  // --- Dynamic Data based on Filter ---
  let labels: string[] = [];
  let dataPoints: number[] = [];
  let summary = { avg: 0, min: 0, max: 0 };

  if (filter === "Day") {
    labels = ["12AM", "4AM", "8AM", "12PM", "4PM", "8PM"];
    // Simulate hourly changes
    dataPoints = isFault ? [22, 22, 21, 0, 0, 5] : [22, 21, 23, 29, 30, 24];
    summary = { avg: 24.8, min: 21, max: 30 };
  } else if (filter === "Month") {
    labels = ["W1", "W2", "W3", "W4"];
    // Simulate weekly avg
    dataPoints = [24, 25, 22, 26];
    summary = { avg: 24.2, min: 22, max: 26 };
  } else {
    // Year
    labels = ["Jan", "Apr", "Jul", "Oct"];
    dataPoints = [20, 28, 32, 25];
    summary = { avg: 26.2, min: 20, max: 32 };
  }

  // Adjust values for humidity (higher range)
  if (isHumidity) {
    dataPoints = dataPoints.map(v => v * 2 + 10); // simply scaling for demo
    summary = {
      avg: Math.round(summary.avg * 2 + 10),
      min: Math.round(summary.min * 2 + 10),
      max: Math.round(summary.max * 2 + 10)
    };
  }


  const getColor = (opacity = 1) => {
    if (isFault) return `rgba(211, 47, 47, ${opacity})`;
    if (isHumidity) return `rgba(2, 136, 209, ${opacity})`; // Blue
    return `rgba(46, 125, 50, ${opacity})`; // Green/Default
  }

  const chartData = {
    labels: labels,
    datasets: [{
      data: dataPoints,
      color: getColor,
      strokeWidth: 3
    }]
  };

  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
    labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,
    strokeWidth: 2,
    decimalPlaces: 0,
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>ID: {sensorId.toUpperCase()}</Text>
        </View>
      </View>

      {/* Time Filter Tabs */}
      <View style={styles.tabContainer}>
        {["Day", "Month", "Year"].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, filter === t && styles.activeTab]}
            onPress={() => setFilter(t)}
          >
            <Text style={[styles.tabText, filter === t && styles.activeTabText]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Chart */}
      <Card>
        <Text style={styles.sectionHeader}>{filter} Overview</Text>
        <LineChart
          data={chartData}
          width={screenWidth - 48}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={{ borderRadius: 16 }}
        />
      </Card>

      {/* Report Summary */}
      <SectionTitle title="Report Summary" />
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Average</Text>
          <Text style={styles.statValue}>{summary.avg}{isHumidity ? "%" : "°C"}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>{summary.min}{isHumidity ? "%" : "°C"}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>{summary.max}{isHumidity ? "%" : "°C"}</Text>
        </View>
      </View>


      {/* Sensor Specs / Details */}
      <SectionTitle title="Technical Details" />
      <View style={styles.specContainer}>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Model</Text>
          <Text style={styles.specValue}>{isHumidity ? "DHT-22 Pro" : "DS18B20"}</Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Status</Text>
          <Text style={[styles.specValue, isFault ? { color: "#D32F2F" } : { color: "#2E7D32" }]}>
            {isFault ? "FAULT" : "Active"}
          </Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Last Calibrated</Text>
          <Text style={styles.specValue}>2025-10-12</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F5F5F5", flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backButton: { marginRight: 16, padding: 8, backgroundColor: "#fff", borderRadius: 12 },
  title: { fontSize: 22, fontWeight: "800", color: "#1B5E20" },
  subtitle: { fontSize: 12, color: "#666", fontWeight: "600" },

  tabContainer: { flexDirection: "row", backgroundColor: "#E0E0E0", borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  activeTab: { backgroundColor: "#fff", elevation: 2 },
  tabText: { fontWeight: "600", color: "#757575" },
  activeTabText: { color: "#1B5E20", fontWeight: "800" },

  sectionHeader: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#444" },

  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: "#fff", padding: 16, borderRadius: 16, alignItems: "center", elevation: 1 },
  statLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#333" },

  specContainer: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 24 },
  specRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  specLabel: { color: "#666", fontSize: 15 },
  specValue: { fontWeight: "600", color: "#333", fontSize: 15 },
});
