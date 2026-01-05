import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SensorFaultLogsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.h}>Sensor Fault Logs</Text>
      <Text>Later: missing data, stuck values, drift detection</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 16 },
  h: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
});
