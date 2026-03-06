import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { auth } from "../../firebase/firebase";

function passwordErrors(pw: string) {
  const errors: string[] = [];
  if (pw.length < 8) errors.push("At least 8 characters");
  if (!/[a-z]/.test(pw)) errors.push("At least 1 lowercase letter");
  if (!/[A-Z]/.test(pw)) errors.push("At least 1 uppercase letter");
  if (!/\d/.test(pw)) errors.push("At least 1 number");
  if (!/[!@#$%^&*()_\-+=\[\]{};:'\",.<>/?\\|`~]/.test(pw)) errors.push("At least 1 special character");
  return errors;
}

export default function ChangePasswordScreen({ navigation }: any) {
  useTunnelHeader("Change Password");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);

  const pwErrors = useMemo(() => passwordErrors(newPassword), [newPassword]);

  const handleUpdate = async () => {
    const u = auth.currentUser;
    if (!u || !u.email) {
      Alert.alert("Error", "No logged-in user found.");
      return;
    }

    if (!currentPassword) {
      Alert.alert("Error", "Please enter your current password.");
      return;
    }

    if (pwErrors.length > 0) {
      Alert.alert("Weak password", pwErrors.join("\n"));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      setSaving(true);

      // ✅ Re-authenticate using current password
      const cred = EmailAuthProvider.credential(u.email, currentPassword);
      await reauthenticateWithCredential(u, cred);

      // ✅ Update password
      await updatePassword(u, newPassword);

      Alert.alert("Success", "Password updated successfully", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const code = e?.code || "";
      if (code === "auth/wrong-password") {
        Alert.alert("Error", "Current password is incorrect.");
      } else if (code === "auth/requires-recent-login") {
        Alert.alert("Session expired", "Please log out and log in again, then try changing password.");
      } else {
        Alert.alert("Error", e?.message ?? "Failed to update password.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.description}>
        Use a strong password to keep your account secure.
      </Text>

      <View style={styles.form}>
        {/* Current */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrent}
              placeholder="Current Password"
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowCurrent((s) => !s)} style={styles.eyeBtn}>
              <Ionicons name={showCurrent ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* New */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              placeholder="New Password"
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowNew((s) => !s)} style={styles.eyeBtn}>
              <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {newPassword.length > 0 && pwErrors.length > 0 ? (
            <Text style={styles.helperText}>Password needs: {pwErrors.join(", ")}</Text>
          ) : null}
        </View>

        {/* Confirm */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              placeholder="Confirm New Password"
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowConfirm((s) => !s)} style={styles.eyeBtn}>
              <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity style={[styles.updateBtn, saving && { opacity: 0.75 }]} onPress={handleUpdate} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.updateBtnText}>Update Password</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  description: { fontSize: 14, color: "#666", marginBottom: 24, lineHeight: 20 },

  form: { marginBottom: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#555", marginBottom: 8 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: "#333",
  },
  eyeBtn: { paddingLeft: 10, paddingVertical: 8 },

  helperText: { color: "#D32F2F", marginTop: 8, fontSize: 12 },

  updateBtn: { backgroundColor: "#2E7D32", padding: 16, borderRadius: 16, alignItems: "center" },
  updateBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});