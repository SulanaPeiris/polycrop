import React from "react";
import { ScrollView, Text, StyleSheet, TouchableOpacity } from "react-native";
import Card from "../components/Card";

export default function ActionsScreen({ navigation }: any) {
  const items = [
    { title: "Irrigation Control", screen: "IrrigationControl" },
    { title: "Fertigation", screen: "Fertigation" },
    { title: "Schedules", screen: "Schedules" },
    { title: "Manual Override", screen: "ManualOverride" },
    { title: "Disease & Stress Dashboard", screen: "DiseaseDashboard" },
    { title: "System Health", screen: "SystemHealth" },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {items.map((i) => (
        <TouchableOpacity key={i.title} onPress={() => navigation.navigate(i.screen)}>
          <Card>
            <Text style={styles.title}>{i.title}</Text>
            <Text>Open</Text>
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
