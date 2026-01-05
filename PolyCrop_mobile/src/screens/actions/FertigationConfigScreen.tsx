import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

// Interactive Mock Slider (Reused)
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

export default function FertigationConfigScreen({ navigation }: any) {
    useTunnelHeader("Nutrient Config");

    const [stage, setStage] = useState(2); // Default to stage 2
    const [npk, setNpk] = useState({ n: 7.0, p: 5.0, k: 5.0 });
    const [isFlowering, setIsFlowering] = useState(false);

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

            {/* Stage Selector */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Select Growth Stage</Text>
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
            </View>

            {/* Dynamic Conditionals */}
            {stage === 3 && (
                <View style={styles.specialCard}>
                    <View style={styles.rowBetween}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Ionicons name="flower-outline" size={24} color="#D81B60" />
                            <Text style={styles.specialTitle}>Flowering Detected?</Text>
                        </View>
                        <Switch
                            value={isFlowering}
                            onValueChange={(v) => {
                                setIsFlowering(v);
                                if (v) setNpk({ n: 3.0, p: 9.0, k: 6.0 });
                            }}
                            trackColor={{ false: "#767577", true: "#F48FB1" }}
                            thumbColor={isFlowering ? "#D81B60" : "#f4f3f4"}
                        />
                    </View>
                </View>
            )}

            {/* NPK Inputs */}
            <SectionTitle title="Mix Configuration" />
            <View style={styles.controlCard}>
                <MockSlider label="Nitrogen (N)" value={npk.n} color="#2E7D32" onChange={(v: any) => setNpk({ ...npk, n: v })} />
                <MockSlider label="Phosphorus (P)" value={npk.p} color="#F57C00" onChange={(v: any) => setNpk({ ...npk, p: v })} />
                <MockSlider label="Potassium (K)" value={npk.k} color="#7B1FA2" onChange={(v: any) => setNpk({ ...npk, k: v })} />
            </View>

            {/* Actions */}
            <TouchableOpacity
                style={styles.saveBtn}
                activeOpacity={0.8}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.saveText}>Save Configuration</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },

    card: { backgroundColor: "#fff", padding: 20, borderRadius: 24, marginBottom: 20, elevation: 1 },
    cardTitle: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 16 },

    timeline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 12, marginBottom: 16, position: "relative" },
    timelineLine: { position: "absolute", top: 20, left: 0, right: 0, height: 2, backgroundColor: "#E0E0E0", zIndex: -1 },
    stageStep: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
    activeStep: { backgroundColor: "#2E7D32", borderColor: "#A5D6A7", transform: [{ scale: 1.1 }] },
    stepNum: { fontWeight: "700", color: "#BDBDBD" },
    activeStepNum: { color: "#fff" },

    stageMeta: { alignItems: "center" },
    stageName: { fontSize: 18, fontWeight: "800", color: "#2E7D32" },
    stageDesc: { fontSize: 13, color: "#757575" },

    specialCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 24, elevation: 1 },
    specialTitle: { fontSize: 16, fontWeight: "700", color: "#333" },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

    controlCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, elevation: 2, marginBottom: 24 },

    // Slider Styles (Copied)
    sliderContainer: { marginBottom: 20 },
    sliderHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    sliderLabel: { fontWeight: "700", fontSize: 14 },
    sliderValue: { fontWeight: "800", color: "#333" },
    track: { height: 12, backgroundColor: "#F5F5F5", borderRadius: 6, position: "relative", marginBottom: 16, justifyContent: "center" },
    fill: { height: 12, borderRadius: 6 },
    thumb: { position: "absolute", top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", borderWidth: 4, shadowColor: "#000", shadowOpacity: 0.2, elevation: 3 },
    buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
    adjBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F3F4", alignItems: "center", justifyContent: "center" },

    saveBtn: { backgroundColor: "#2E7D32", paddingVertical: 18, borderRadius: 16, alignItems: "center" },
    saveText: { color: "#fff", fontWeight: "800", fontSize: 16 },

});
