import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

export default function ChangePasswordScreen({ navigation }: any) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleUpdate = () => {
        if (newPassword !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }
        // Logic to update password
        Alert.alert("Success", "Password updated successfully", [
            { text: "OK", onPress: () => navigation.goBack() }
        ]);
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.description}>
                Ensure your account is using a long, random password to stay secure.
            </Text>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Current Password</Text>
                    <TextInput
                        style={styles.input}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        placeholder="Current Password"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                        style={styles.input}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        placeholder="New Password"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <TextInput
                        style={styles.input}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        placeholder="Confirm New Password"
                    />
                </View>
            </View>

            <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate}>
                <Text style={styles.updateBtnText}>Update Password</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: "#fff",
        flexGrow: 1
    },
    description: {
        fontSize: 14,
        color: "#666",
        marginBottom: 24,
        lineHeight: 20
    },
    form: {
        marginBottom: 24
    },
    inputGroup: {
        marginBottom: 20
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#555",
        marginBottom: 8
    },
    input: {
        backgroundColor: "#F8F9FA",
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: "#333"
    },
    updateBtn: {
        backgroundColor: "#2E7D32",
        padding: 16,
        borderRadius: 16,
        alignItems: "center"
    },
    updateBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700"
    }
});
