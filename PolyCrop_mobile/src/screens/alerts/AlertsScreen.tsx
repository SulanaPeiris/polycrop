import React from "react";
import { ScrollView, Text, StyleSheet, TouchableOpacity } from "react-native";
import Card from "../components/Card";

const alerts = [
  { id: "a1", title: "High humidity", time: "10:12 AM", level: "warning" },
  { id: "a2", title: "Node battery low", time: "Yesterday", level: "info" },
];

export default function AlertsScreen({ navigation }: any) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {alerts.map((a) => (
        <TouchableOpacity key={a.id} onPress={() => navigation.navigate("AlertDetail", { alertId: a.id })}>
          <Card>
            <Text style={styles.title}>{a.title}</Text>
            <Text>{a.time}</Text>
          </Card>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
});
