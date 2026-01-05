import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import Card from "../components/Card";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

export default function AlertsScreen() {
  const { selectedTunnel } = useTunnel();
  useTunnelHeader("Alerts");
  
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Text style={styles.title}>Alerts for {selectedTunnel.name}</Text>
        <Text>Fetch alerts where tunnelId = {selectedTunnel.id}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
});
