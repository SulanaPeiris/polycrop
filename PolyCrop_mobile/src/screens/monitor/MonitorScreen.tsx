import React from "react";
import { ScrollView, Text, StyleSheet, TouchableOpacity } from "react-native";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Tabs">;

const sensors = [
  { id: "temp", title: "Temperature", value: "28°C" },
  { id: "hum", title: "Humidity", value: "76%" },
  { id: "soil", title: "Soil Moisture", value: "43%" },
  { id: "ph", title: "pH", value: "6.2" },
];

export default function MonitorScreen({ navigation }: any) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionTitle title="Live Sensors" />
      {sensors.map((s) => (
        <TouchableOpacity
          key={s.id}
          onPress={() => navigation.navigate("SensorDetails", { sensorId: s.id, title: s.title })}
        >
          <Card>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.value}>{s.value}</Text>
          </Card>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={() => navigation.navigate("ZoneNodes")}>
        <Card>
          <Text style={styles.title}>Zones / Nodes</Text>
          <Text>View LoRa nodes, battery, last seen</Text>
        </Card>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  value: { fontSize: 20, fontWeight: "800" },
});
