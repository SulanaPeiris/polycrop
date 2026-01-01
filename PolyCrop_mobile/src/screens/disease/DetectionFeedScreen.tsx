import React from "react";
import { ScrollView, Text, StyleSheet, TouchableOpacity } from "react-native";
import Card from "../components/Card";

const items = [
  { id: "img1", title: "Zone A - Leaf 12", time: "Today 09:12" },
  { id: "img2", title: "Zone B - Leaf 04", time: "Yesterday 16:40" },
];

export default function DetectionFeedScreen({ navigation }: any) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {items.map((x) => (
        <TouchableOpacity key={x.id} onPress={() => navigation.navigate("DetectionDetail", { imageId: x.id })}>
          <Card>
            <Text style={styles.title}>{x.title}</Text>
            <Text>{x.time}</Text>
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
