import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";

export default function EditProfileScreen({ navigation }: any) {
    const [name, setName] = useState("Sulan Peiris");
    const [email, setEmail] = useState("sulan@example.com");
    const [phone, setPhone] = useState("+94 77 123 4567");

    const handleSave = () => {
        // Logic to update profile
        Alert.alert("Success", "Profile updated successfully", [
            { text: "OK", onPress: () => navigation.goBack() }
        ]);
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.avatarContainer}>
                <Image
                    source={{ uri: "https://i.pravatar.cc/150?img=12" }}
                    style={styles.avatar}
                />
                <TouchableOpacity style={styles.changePhotoBtn}>
                    <Ionicons name="camera" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter your name"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter your email"
                        keyboardType="email-address"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Enter your phone number"
                        keyboardType="phone-pad"
                    />
                </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
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
    avatarContainer: {
        alignItems: "center",
        marginBottom: 32,
        position: "relative",
        alignSelf: "center"
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#eee"
    },
    changePhotoBtn: {
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: "#2E7D32",
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#fff"
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
    saveBtn: {
        backgroundColor: "#2E7D32",
        padding: 16,
        borderRadius: 16,
        alignItems: "center"
    },
    saveBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700"
    }
});
