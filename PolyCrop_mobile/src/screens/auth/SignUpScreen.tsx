import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, "SignUp">;
};

export default function SignUpScreen({ navigation }: Props) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleSignUp = () => {
        if (!name || !email || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }

        // Simulate API call
        setTimeout(() => {
            Alert.alert("Success", "Account created successfully!", [
                { text: "Login", onPress: () => navigation.navigate("Login") }
            ]);
        }, 1000);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Ionicons name="leaf" size={40} color="#2E7D32" />
                    </View>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join PolyCrop to manage your farm efficiently</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email Address"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity style={styles.button} onPress={handleSignUp}>
                        <Text style={styles.buttonText}>Sign Up</Text>
                        <Ionicons name="arrow-forward" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                        <Text style={styles.linkText}>Log In</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: "center",
        padding: 24,
    },
    header: {
        alignItems: "center",
        marginBottom: 40,
    },
    logoContainer: {
        width: 80,
        height: 80,
        backgroundColor: "#E8F5E9",
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#1B5E20",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: "#757575",
        textAlign: "center",
    },
    form: {
        marginBottom: 24,
    },
    inputGroup: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#E0E0E0",
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: "#333",
    },
    button: {
        flexDirection: "row",
        backgroundColor: "#2E7D32",
        borderRadius: 16,
        height: 56,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
        elevation: 2,
        shadowColor: "#2E7D32",
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#FFFFFF",
        marginRight: 8,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
    },
    footerText: {
        fontSize: 14,
        color: "#666",
    },
    linkText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#2E7D32",
    },
});
