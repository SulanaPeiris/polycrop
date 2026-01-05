import React, { useState } from "react";
import { ScrollView, Text, View, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";

import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

const screenWidth = Dimensions.get("window").width;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MonitorScreen() {
  const { selectedTunnel } = useTunnel();
  useTunnelHeader("Monitor");
  const navigation = useNavigation<NavigationProp>();

  // Simulated State for "Sensor Fault"
  const [fault, setFault] = useState<string | null>("Temperature Sensor Malfunction");

  // Simulated Chart Data
  const tempData = {
    labels: ["12AM", "4AM", "8AM", "12PM", "4PM", "8PM"],
    datasets: [{
      data: [22, 21, 23, 29, 30, 24],
      color: (opacity = 1) => `rgba(255, 167, 38, ${opacity})`, // Orange for Temp
      strokeWidth: 3,
    }],
    legend: ["Temperature (°C)"]
  };

  // Blue Theme for Humidity
  const humidityData = {
    labels: ["12AM", "4AM", "8AM", "12PM", "4PM", "8PM"],
    datasets: [{
      data: [60, 62, 58, 55, 50, 65],
      color: (opacity = 1) => `rgba(2, 136, 209, ${opacity})`, // Blue for Humidity
      strokeWidth: 3,
    }],
    legend: ["Humidity (%)"]
  };

  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    propsForDots: {
      r: "5",
      strokeWidth: "2",
      stroke: "#fff"
    }
  };

  const navigateToDetail = (title: string, sensorId: string) => {
    navigation.navigate("SensorDetails", { title, sensorId });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* 1. Sensor Fault Alert */}
      {fault && (
        <View style={styles.anomalyBanner}>
          <LinearGradient
            colors={['#FFEBEE', '#FFCDD2']}
            style={styles.anomalyGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.anomalyContent}>
              <View style={styles.anomalyIcon}>
                <Ionicons name="warning" size={24} color="#D32F2F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.anomalyTitle}>Sensor Fault Detected!</Text>
                <Text style={styles.anomalyText}>{fault}</Text>
                <TouchableOpacity onPress={() => navigateToDetail("Sensor Fault", "fault-001")}>
                  <Text style={styles.actionText}>View Technical Details &rarr;</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setFault(null)}>
                <Ionicons name="close" size={20} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* 2. Live Sensors Grid */}
      <SectionTitle title="Live Sensors" />
      <View style={styles.grid}>
        {/* Temperature - Clickable */}
        <TouchableOpacity
          style={styles.sensorCard}
          activeOpacity={0.9}
          onPress={() => navigateToDetail("Temperature Sensor", "temp-001")}
        >
          <View style={[styles.iconCircle, { backgroundColor: "#FFF3E0" }]}>
            <Ionicons name="thermometer-outline" size={28} color="#EF6C00" />
          </View>
          <View>
            <Text style={styles.sensorValue}>24°C</Text>
            <Text style={styles.sensorLabel}>Temperature</Text>
          </View>
          <View style={styles.statusTag}>
            <Text style={styles.statusText}>Optimal</Text>
          </View>
        </TouchableOpacity>

        {/* Humidity - Clickable - BLUE THEME */}
        <TouchableOpacity
          style={styles.sensorCard}
          activeOpacity={0.9}
          onPress={() => navigateToDetail("Humidity Sensor", "hum-001")}
        >
          <View style={[styles.iconCircle, { backgroundColor: "#E1F5FE" }]}>
            <Ionicons name="water-outline" size={28} color="#0288D1" />
          </View>
          <View>
            <Text style={styles.sensorValue}>60%</Text>
            <Text style={styles.sensorLabel}>Humidity</Text>
          </View>
          <View style={[styles.statusTag, { backgroundColor: "#E1F5FE" }]}>
            <Text style={[styles.statusText, { color: "#0288D1" }]}>Good</Text>
          </View>
        </TouchableOpacity>
      </View>


      {/* 3. Analytics Charts */}
      <SectionTitle title="24h Trends" />

      <Card>
        <Text style={styles.chartTitle}>Temperature Trend</Text>
        <LineChart
          data={tempData}
          width={screenWidth - 64} // Card padding deduction
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(239, 108, 0, ${opacity})`,
          }}
          bezier
          style={styles.chart}
        />
      </Card>

      <Card>
        <Text style={styles.chartTitle}>Humidity Trend</Text>
        <LineChart
          data={humidityData}
          width={screenWidth - 64}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(2, 136, 209, ${opacity})`, // Blue
          }}
          bezier
          style={styles.chart}
        />
      </Card>

      {/* Spacer for docked nav bar */}
      <View style={{ height: 100 }} />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 10 },

  // Anomaly Styles
  anomalyBanner: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: "#D32F2F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  anomalyGradient: { padding: 16 },
  anomalyContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  anomalyIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center", justifyContent: "center"
  },
  anomalyTitle: { fontSize: 16, fontWeight: "800", color: "#B71C1C" },
  anomalyText: { fontSize: 14, color: "#C62828", marginTop: 2 },
  actionText: { fontSize: 14, fontWeight: "700", color: "#B71C1C", marginTop: 8, textDecorationLine: "underline" },

  // Sensor Grid
  grid: { flexDirection: "row", gap: 12, marginBottom: 24 },
  sensorCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 16,
    alignItems: "flex-start", justifyContent: "space-between", height: 160,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8,
  },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  sensorValue: { fontSize: 28, fontWeight: "800", color: "#212121" },
  sensorLabel: { fontSize: 14, color: "#757575", fontWeight: "600" },
  statusTag: {
    position: "absolute", top: 16, right: 16,
    backgroundColor: "#FFF3E0", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  statusText: { fontSize: 12, fontWeight: "700", color: "#EF6C00" },

  // Chart Styles
  chartTitle: { fontSize: 18, fontWeight: "700", color: "#37474F", marginBottom: 16 },
  chart: { marginVertical: 8, borderRadius: 16 }
});
