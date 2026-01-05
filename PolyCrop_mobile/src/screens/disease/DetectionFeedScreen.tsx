import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function DetectionDetailScreen({ route }: any) {
  const { imageId } = route.params;
  return (
    <View style={styles.container}>
      <Text style={styles.h}>Detection Detail</Text>
      <Text>imageId: {imageId}</Text>
      <Text style={{ marginTop: 12 }}>
        Later: show image preview + confidence + recommended actions + spray trigger (if needed)
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 16 },
  h: { fontSize: 22, fontWeight: "800", marginBottom: 10 },
});
