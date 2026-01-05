import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { useAuth } from "../../context/AuthContext";

export default function SettingsScreen({ navigation }: any) {
    useTunnelHeader("Settings");
    const { logout } = useAuth();

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account",
            "Are you sure you want to delete your account? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => console.log("Account Deleted") }
            ]
        );
    };

    const handleChangePassword = () => {
        navigation.navigate("ChangePassword");
    };

    const handleEditProfile = () => {
        navigation.navigate("EditProfile");
    };

    const handleLogout = () => {
        Alert.alert(
            "Log Out",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Log Out", style: "destructive", onPress: () => logout() }
            ]
        );
    };

    return (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

            {/* Profile Section */}
            <View style={styles.profileCard}>
                <View style={styles.profileHeader}>
                    <Image
                        source={{ uri: "https://i.pravatar.cc/150?img=12" }}
                        style={styles.avatar}
                    />
                    <View style={styles.profileInfo}>
                        <Text style={styles.userName}>Sulan Peiris</Text>
                        <Text style={styles.userEmail}>sulan@example.com</Text>
                    </View>
                    <TouchableOpacity style={styles.editBtn} onPress={handleEditProfile}>
                        <Ionicons name="pencil" size={20} color="#2E7D32" />
                    </TouchableOpacity>
                </View>
            </View>

            <SectionTitle title="Tunnels" />
            <View style={styles.section}>
                <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("AddTunnel")}>
                    <View style={[styles.iconBox, { backgroundColor: "#E8F5E9" }]}>
                        <Ionicons name="add" size={22} color="#2E7D32" />
                    </View>
                    <Text style={styles.label}>Add New Tunnel</Text>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
            </View>

            <SectionTitle title="General" />
            <View style={styles.section}>
                <View style={styles.row}>
                    <View style={[styles.iconBox, { backgroundColor: "#E3F2FD" }]}>
                        <Ionicons name="notifications-outline" size={22} color="#1565C0" />
                    </View>
                    <Text style={styles.label}>Notifications</Text>
                    <Switch value={true} trackColor={{ false: "#eee", true: "#C8E6C9" }} thumbColor={"#2E7D32"} />
                </View>
            </View>

            <SectionTitle title="Security" />
            <View style={styles.section}>
                <TouchableOpacity style={styles.row} onPress={handleChangePassword}>
                    <View style={[styles.iconBox, { backgroundColor: "#F3E5F5" }]}>
                        <Ionicons name="lock-closed-outline" size={22} color="#7B1FA2" />
                    </View>
                    <Text style={styles.label}>Change Password</Text>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
            </View>

            <SectionTitle title="Account" />
            <View style={styles.section}>
                <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
                    <View style={[styles.iconBox, { backgroundColor: "#FFEBEE" }]}>
                        <Ionicons name="trash-outline" size={22} color="#D32F2F" />
                    </View>
                    <Text style={[styles.label, { color: "#D32F2F" }]}>Delete Account</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: "#F8F9FA",
        flexGrow: 1,
        paddingBottom: 80
    },

    // Profile Card
    profileCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        alignItems: "center"
    },
    profileHeader: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%"
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 3,
        borderColor: "#E8F5E9"
    },
    profileInfo: {
        flex: 1,
        marginLeft: 16
    },
    userName: {
        fontSize: 20,
        fontWeight: "800",
        color: "#1B5E20",
        marginBottom: 4
    },
    userEmail: {
        fontSize: 14,
        color: "#757575",
        fontWeight: "500"
    },
    editBtn: {
        padding: 10,
        backgroundColor: "#F1F8E9",
        borderRadius: 12
    },

    // Sections
    section: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 8,
        paddingHorizontal: 16,
        marginBottom: 24,
        elevation: 1,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16
    },
    label: {
        flex: 1,
        fontSize: 16,
        fontWeight: "600",
        color: "#333"
    },
    divider: {
        height: 1,
        backgroundColor: "#F5F5F5",
        marginLeft: 60
    },

    logoutBtn: {
        marginTop: 8,
        alignItems: "center",
        padding: 16,
        marginBottom: 20
    },
    logoutText: {
        color: "#BDBDBD",
        fontWeight: "700",
        fontSize: 16
    }
});
