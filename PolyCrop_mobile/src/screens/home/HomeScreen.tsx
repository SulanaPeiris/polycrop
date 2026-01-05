import React from "react";
import { ScrollView, Text, View, StyleSheet, TouchableOpacity } from "react-native";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { useTunnel } from "../../context/TunnelContext";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

export default function HomeScreen() {
  const { tunnels, selectedTunnelId, setSelectedTunnelId, selectedTunnel } = useTunnel();
 useTunnelHeader("Home");
 
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionTitle title="Your Polytunnels" />

      <View style={styles.grid}>
        {tunnels.map((t) => {
          const active = t.id === selectedTunnelId;
          return (
            <TouchableOpacity key={t.id} onPress={() => setSelectedTunnelId(t.id)} style={{ flex: 1 }}>
              <View style={[styles.cardWrap, active && styles.activeWrap]}>
                <Card>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.meta}>{t.location ?? "—"}</Text>
                  <Text style={styles.meta}>Status: {t.status ?? "—"}</Text>
                  {active ? <Text style={styles.activeText}>Selected</Text> : null}
                </Card>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionTitle title="Selected Tunnel Overview" />
      <Card>
        <Text style={styles.big}>{selectedTunnel.name}</Text>
        <Text>Now Monitor / Alerts / Actions will show data for this tunnel.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  grid: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  cardWrap: { marginBottom: 12 },
  activeWrap: { borderWidth: 2, borderColor: "#1E88E5", borderRadius: 16 },
  name: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  meta: { fontSize: 12, opacity: 0.75, marginBottom: 2 },
  activeText: { marginTop: 8, fontWeight: "800", color: "#1E88E5" },
  big: { fontSize: 18, fontWeight: "900" },
});
