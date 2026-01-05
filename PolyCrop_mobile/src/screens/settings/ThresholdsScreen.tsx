import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function ThresholdsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.h}>Threshold Settings</Text>
      <Text>Later: set min/max for temp, humidity, soil moisture + notify rules</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 16 },
  h: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
});
