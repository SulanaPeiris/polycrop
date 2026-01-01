import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

export default function MonitorScreen() {
  const { selectedTunnel } = useTunnel();
  useTunnelHeader("Monitor");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionTitle title={`Live Sensors - ${selectedTunnel.name}`} />

      <Card>
        <Text style={styles.title}>Temperature</Text>
        <Text>Later: fetch temp by tunnelId = {selectedTunnel.id}</Text>
      </Card>

      <Card>
        <Text style={styles.title}>Humidity</Text>
        <Text>Later: fetch humidity by tunnelId = {selectedTunnel.id}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
});
