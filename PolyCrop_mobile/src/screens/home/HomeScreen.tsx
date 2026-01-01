import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionTitle title="Overview" />

      <View style={styles.row}>
        <View style={styles.col}>
          <Card><Text style={styles.big}>28°C</Text><Text>Temperature</Text></Card>
        </View>
        <View style={styles.col}>
          <Card><Text style={styles.big}>76%</Text><Text>Humidity</Text></Card>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <Card><Text style={styles.big}>43%</Text><Text>Soil Moisture</Text></Card>
        </View>
        <View style={styles.col}>
          <Card><Text style={styles.big}>Good</Text><Text>Status</Text></Card>
        </View>
      </View>

      <SectionTitle title="Today Alerts" />
      <Card>
        <Text>✅ All good. No urgent alerts.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  row: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  big: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
});
