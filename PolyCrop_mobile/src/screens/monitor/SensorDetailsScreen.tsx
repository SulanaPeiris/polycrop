import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SensorDetailsScreen({ route }: any) {
  const { title, sensorId } = route.params;
  return (
    <View style={styles.container}>
      <Text style={styles.h}>{title}</Text>
      <Text>sensorId: {sensorId}</Text>
      <Text style={{ marginTop: 12 }}>Later: add chart + history + min/max/avg</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  h: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
});
