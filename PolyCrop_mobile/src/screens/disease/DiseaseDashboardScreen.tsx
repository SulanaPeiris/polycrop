import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Card from "../components/Card";

export default function DiseaseDashboardScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.h}>Downy Mildew</Text>
        <Text>Status: Low risk</Text>
      </Card>

      <TouchableOpacity onPress={() => navigation.navigate("DetectionFeed")}>
        <Card>
          <Text style={styles.h}>Detection Feed</Text>
          <Text>View captured images & results</Text>
        </Card>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { padding: 16 },
  h: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
});
