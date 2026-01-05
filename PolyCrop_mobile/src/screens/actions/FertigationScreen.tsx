import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

// Interactive Mock Slider
const MockSlider = ({ label, value, color, onChange }: any) => {
  const [sliderWidth, setSliderWidth] = useState(0);

  const handleTouch = (e: any) => {
    if (sliderWidth === 0) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / sliderWidth));
    const newValue = Math.round(ratio * 10 * 10) / 10;
    onChange(newValue);
  };

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sliderLabel, { color }]}>{label}</Text>
        <Text style={styles.sliderValue}>{value.toFixed(1)}</Text>
      </View>
      <TouchableOpacity
        style={styles.track}
        activeOpacity={1}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        onPress={handleTouch}
      >
        <View style={[styles.fill, { width: `${(value / 10) * 100}%`, backgroundColor: color }]} />
        <View style={[styles.thumb, { left: `${(value / 10) * 100}%`, borderColor: color }]} />
      </TouchableOpacity>
      <View style={styles.buttons}>
        <TouchableOpacity onPress={() => onChange(Math.max(0, parseFloat((value - 0.5).toFixed(1))))} style={styles.adjBtn}>
          <Ionicons name="remove" size={16} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onChange(Math.min(10, parseFloat((value + 0.5).toFixed(1))))} style={styles.adjBtn}>
          <Ionicons name="add" size={16} color="#555" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function FertigationScreen({ navigation }: any) {
  useTunnelHeader("AI Fertigation");

  const [stage, setStage] = useState(2);
  const [npk, setNpk] = useState({ n: 7.0, p: 5.0, k: 5.0 });
  const [isFlowering, setIsFlowering] = useState(false);

  // Mock Stage Metadata
  const stages = [
    { id: 1, title: "Stage 1", subtitle: "Early Growth (Week 1-2)" },
    { id: 2, title: "Stage 2", subtitle: "Vegetative (Week 3-4)" },
    { id: 3, title: "Stage 3", subtitle: "Flowering Season" },
    { id: 4, title: "Stage 4", subtitle: "Fruiting (AI Detect)" },
  ];

  const handleStageChange = (id: number) => {
    setStage(id);
    if (id === 1) setNpk({ n: 6.0, p: 4.0, k: 4.0 });
    if (id === 2) setNpk({ n: 7.0, p: 5.0, k: 5.0 });
    if (id === 3) setNpk({ n: 4.0, p: 8.0, k: 7.0 });
    if (id === 4) setNpk({ n: 5.0, p: 5.0, k: 8.0 });
  };


  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* 1. AI Header */}
      <LinearGradient
        colors={['#43A047', '#2E7D32']}
        style={styles.aiCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.aiHeader}>
          <View style={styles.aiIconBox}>
            <Ionicons name="sparkles" size={24} color="#C8E6C9" />
          </View>
          <View>
            <Text style={styles.aiTitle}>AI Dosing Agent</Text>
            <Text style={styles.aiSubtitle}>Optimizing nutrient mix for {stages[stage - 1].title}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* 2. Configure Mix Section (Inline) */}
      <SectionTitle title="Configure Mix" />

      <View style={styles.configCard}>
        {/* Stage Selector */}
        <View style={styles.timeline}>
          {stages.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.stageStep, stage === s.id && styles.activeStep]}
              onPress={() => handleStageChange(s.id)}
            >
              <Text style={[styles.stepNum, stage === s.id && styles.activeStepNum]}>{s.id}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.timelineLine} />
        </View>
        <View style={styles.stageMeta}>
          <Text style={styles.stageName}>{stages[stage - 1].title}</Text>
          <Text style={styles.stageDesc}>{stages[stage - 1].subtitle}</Text>
        </View>

        <View style={styles.divider} />

        {/* Dynamic Logic */}
        {stage === 3 && (
          <View style={styles.dynamicBox}>
            <View style={styles.row}>
              <Ionicons name="flower-outline" size={20} color="#D81B60" />
              <Text style={styles.dynamicText}>Flowering Detected?</Text>
            </View>
            <Switch
              value={isFlowering}
              onValueChange={(v) => { setIsFlowering(v); if (v) setNpk({ n: 3, p: 9, k: 6 }); }}
              trackColor={{ false: "#767577", true: "#F48FB1" }}
              thumbColor={isFlowering ? "#D81B60" : "#f4f3f4"}
            />
          </View>
        )}

        {/* Sliders */}
        <MockSlider label="Nitrogen (N)" value={npk.n} color="#2E7D32" onChange={(v: any) => setNpk({ ...npk, n: v })} />
        <MockSlider label="Phosphorus (P)" value={npk.p} color="#F57C00" onChange={(v: any) => setNpk({ ...npk, p: v })} />
        <MockSlider label="Potassium (K)" value={npk.k} color="#7B1FA2" onChange={(v: any) => setNpk({ ...npk, k: v })} />

      </View>

      {/* APPLY Button */}
      <TouchableOpacity style={styles.applyBtn} activeOpacity={0.8}>
        <Text style={styles.applyText}>Apply Configuration</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },

  aiCard: { borderRadius: 24, padding: 24, marginBottom: 24 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 16 },
  aiIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  aiTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  aiSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },

  configCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, elevation: 2, marginBottom: 16 },

  timeline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 12, marginBottom: 16, position: "relative" },
  timelineLine: { position: "absolute", top: 20, left: 0, right: 0, height: 2, backgroundColor: "#E0E0E0", zIndex: -1 },
  stageStep: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  activeStep: { backgroundColor: "#2E7D32", borderColor: "#A5D6A7", transform: [{ scale: 1.1 }] },
  stepNum: { fontWeight: "700", color: "#BDBDBD" },
  activeStepNum: { color: "#fff" },

  stageMeta: { alignItems: "center", marginBottom: 20 },
  stageName: { fontSize: 16, fontWeight: "800", color: "#2E7D32" },
  stageDesc: { fontSize: 12, color: "#757575" },

  divider: { height: 1, backgroundColor: "#F5F5F5", marginBottom: 20 },

  dynamicBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FCE4EC", padding: 12, borderRadius: 12, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dynamicText: { fontWeight: "700", color: "#D81B60", fontSize: 13 },

  // Slider Styles
  sliderContainer: { marginBottom: 20 },
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  sliderLabel: { fontWeight: "700", fontSize: 13, color: "#555" },
  sliderValue: { fontWeight: "800", color: "#333" },
  track: { height: 12, backgroundColor: "#F5F5F5", borderRadius: 6, position: "relative", marginBottom: 16, justifyContent: "center" },
  fill: { height: 12, borderRadius: 6 },
  thumb: { position: "absolute", top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", borderWidth: 4, shadowColor: "#000", shadowOpacity: 0.2, elevation: 3 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  adjBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F3F4", alignItems: "center", justifyContent: "center" },

  applyBtn: { backgroundColor: "#2E7D32", paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  applyText: { color: "#fff", fontWeight: "800", fontSize: 16 },

});
