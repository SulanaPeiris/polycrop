import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function AlertDetailScreen({ route }: any) {
  const { alertId } = route.params;
  return (
    <View style={styles.container}>
      <Text style={styles.h}>Alert Detail</Text>
      <Text>alertId: {alertId}</Text>
      <Text style={{ marginTop: 12 }}>Later: show cause + zone + suggested action</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 16 },
  h: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
});
