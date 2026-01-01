import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function FertigationScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.h}>Fertigation</Text>
      <Text>Later: Auto/Manual, start/stop, schedule, safety rules</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 16 },
  h: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
});
