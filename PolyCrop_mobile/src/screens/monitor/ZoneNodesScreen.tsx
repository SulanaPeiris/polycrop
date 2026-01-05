import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function ZoneNodesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.h}>Zones / Nodes</Text>
      <Text>Later: list LoRa nodes, battery %, RSSI, last seen, status</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 16 },
  h: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
});
