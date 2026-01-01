import React from "react";
import { ScrollView, Text, StyleSheet, TouchableOpacity } from "react-native";
import Card from "../components/Card";

export default function SettingsScreen({ navigation }: any) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Text style={styles.title}>Language</Text>
        <Text>English</Text>
      </Card>

      <TouchableOpacity onPress={() => navigation.navigate("Thresholds")}>
        <Card>
          <Text style={styles.title}>Threshold Settings</Text>
          <Text>Set alert limits</Text>
        </Card>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("SensorFaultLogs")}>
        <Card>
          <Text style={styles.title}>Sensor Fault Logs</Text>
          <Text>View missing/stuck readings</Text>
        </Card>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
});
