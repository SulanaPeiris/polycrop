import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SystemHealthScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.h}>System Health</Text>
      <Text>Later: gateway online/offline, node last seen, RSSI, battery</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 16 },
  h: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
});
