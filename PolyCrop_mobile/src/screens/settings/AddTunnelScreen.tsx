import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { useTunnel } from "../../context/TunnelContext";

export default function AddTunnelScreen({ navigation }: any) {
    useTunnelHeader("Add New Tunnel");

    const { addTunnel } = useTunnel();

    const [formData, setFormData] = useState({
        name: "",
        cropType: "",
        rows: "",
        columns: "",
        size: "",
        sensorCount: "",
        robotId: "",
        fertigationUnitId: "",
    });

    const updateField = (field: string, value: string) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleSubmit = () => {
        // Validation
        if (!formData.name || !formData.cropType) {
            Alert.alert("Error", "Please fill in at least Tunnel Name and Crop Type");
            return;
        }

        addTunnel({
            name: formData.name,
            cropType: formData.cropType,
            rows: formData.rows ? parseInt(formData.rows) : undefined,
            columns: formData.columns ? parseInt(formData.columns) : undefined,
            size: formData.size || undefined,
            sensorCount: formData.sensorCount ? parseInt(formData.sensorCount) : undefined,
            robotId: formData.robotId || undefined,
            fertigationUnitId: formData.fertigationUnitId || undefined,
        });

        Alert.alert("Success", "Tunnel added successfully!", [
            { text: "OK", onPress: () => navigation.goBack() }
        ]);
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>

            {/* Basic Info */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Basic Information</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Tunnel Name *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., Tunnel D"
                        value={formData.name}
                        onChangeText={(val) => updateField("name", val)}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Crop Type *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., Cucumber, Tomato"
                        value={formData.cropType}
                        onChangeText={(val) => updateField("cropType", val)}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Size (m²)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., 500 m²"
                        value={formData.size}
                        onChangeText={(val) => updateField("size", val)}
                    />
                </View>
            </View>

            {/* Plant Layout */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Plant Layout</Text>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Rows</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="10"
                            keyboardType="number-pad"
                            value={formData.rows}
                            onChangeText={(val) => updateField("rows", val)}
                        />
                    </View>

                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Columns</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="20"
                            keyboardType="number-pad"
                            value={formData.columns}
                            onChangeText={(val) => updateField("columns", val)}
                        />
                    </View>
                </View>
            </View>

            {/* Equipment */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Equipment Configuration</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Sensor Count</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="8"
                        keyboardType="number-pad"
                        value={formData.sensorCount}
                        onChangeText={(val) => updateField("sensorCount", val)}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Assigned Robot ID</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., R-004"
                        value={formData.robotId}
                        onChangeText={(val) => updateField("robotId", val)}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Fertigation Unit ID</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., F-004"
                        value={formData.fertigationUnitId}
                        onChangeText={(val) => updateField("fertigationUnitId", val)}
                    />
                </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Text style={styles.submitText}>Add Tunnel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, backgroundColor: "#F8F9FA", flexGrow: 1 },

    section: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, elevation: 1 },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: "#2E7D32", marginBottom: 16 },

    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: "600", color: "#555", marginBottom: 8 },
    input: {
        backgroundColor: "#F5F5F5",
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: "#333",
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },

    row: { flexDirection: "row" },

    submitBtn: {
        backgroundColor: "#2E7D32",
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
        marginBottom: 12,
    },
    submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },

    cancelBtn: {
        backgroundColor: "#fff",
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },
    cancelText: { color: "#757575", fontWeight: "700", fontSize: 16 },
});
