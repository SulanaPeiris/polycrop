import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { useAuth } from "../../context/AuthContext";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "SignUp">;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

function normalizePhone(raw: string) {
  // keep digits and + only
  return raw.replace(/[^\d+]/g, "");
}

function isValidPhone(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");

  // Accept:
  //  - 10 digits starting with 0 (local)
  //  - or 11 digits starting with 94 (Sri Lanka with country code)
  if (digits.length === 10) return digits.startsWith("0");
  if (digits.length === 11) return digits.startsWith("94");
  return false;
}

function passwordErrors(pw: string) {
  const errors: string[] = [];
  if (pw.length < 8) errors.push("At least 8 characters");
  if (!/[a-z]/.test(pw)) errors.push("At least 1 lowercase letter");
  if (!/[A-Z]/.test(pw)) errors.push("At least 1 uppercase letter");
  if (!/\d/.test(pw)) errors.push("At least 1 number");
  if (!/[!@#$%^&*()_\-+=\[\]{};:'\",.<>/?\\|`~]/.test(pw)) errors.push("At least 1 special character");
  return errors;
}

export default function SignUpScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const pwErrors = useMemo(() => passwordErrors(password), [password]);

  const handleSignUp = async () => {
    const fullName = name.trim();
    const mail = email.trim().toLowerCase();
    const addr = address.trim();
    const phone = normalizePhone(contactNumber.trim());

    // ✅ Field validations
    if (fullName.length < 3) {
      Alert.alert("Invalid name", "Please enter your full name (min 3 characters).");
      return;
    }
    if (!isValidEmail(mail)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (addr.length < 5) {
      Alert.alert("Invalid address", "Please enter a valid address (min 5 characters).");
      return;
    }
    if (!isValidPhone(phone)) {
      Alert.alert("Invalid contact number", "Use 10 digits starting with 0 (e.g., 07XXXXXXXX) or +94XXXXXXXXX.");
      return;
    }

    if (pwErrors.length > 0) {
      Alert.alert("Weak password", pwErrors.join("\n"));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Password and Confirm Password do not match.");
      return;
    }

   try {
  setLoading(true);

  await signUp({
    fullName,
    email: mail,
    password,
    address: addr,
    contactNumber: phone,
  });

  // ✅ Don't navigate to Login.
  // Firebase user is now logged in -> AppNavigator will switch to Tabs/Home automatically.
  // Optional: show a small message
  Alert.alert("Welcome!", "Account created successfully.");
} catch (e: any) {
  Alert.alert("Sign up failed", e?.message ?? "Try again");
} finally {
  setLoading(false);
}
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
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
            <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
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
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Ionicons name="home-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Address"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="sentences"
            />
          </View>

          <View style={styles.inputGroup}>
            <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Contact Number (07XXXXXXXX or +94...)"
              value={contactNumber}
              onChangeText={(t) => setContactNumber(normalizePhone(t))}
              keyboardType="phone-pad"
            />
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              textContentType="newPassword"
            />
            <TouchableOpacity onPress={() => setShowPassword((s) => !s)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              textContentType="password"
            />
            <TouchableOpacity onPress={() => setShowConfirm((s) => !s)} style={styles.eyeBtn}>
              <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Password helper */}
          {password.length > 0 && pwErrors.length > 0 ? (
            <Text style={styles.helperText}>Password needs: {pwErrors.join(", ")}</Text>
          ) : null}

          <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleSignUp} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonText}>Sign Up</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </>
            )}
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
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  scrollContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 40 },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: "#E8F5E9",
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#1B5E20", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#757575", textAlign: "center" },
  form: { marginBottom: 24 },

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
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: "#333" },

  eyeBtn: {
    paddingLeft: 10,
    paddingVertical: 8,
  },

  helperText: {
    color: "#D32F2F",
    marginTop: -8,
    marginBottom: 10,
    fontSize: 12,
  },

  button: {
    flexDirection: "row",
    backgroundColor: "#2E7D32",
    borderRadius: 16,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    elevation: 2,
    shadowColor: "#2E7D32",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginRight: 8 },
  footer: { flexDirection: "row", justifyContent: "center" },
  footerText: { fontSize: 14, color: "#666" },
  linkText: { fontSize: 14, fontWeight: "700", color: "#2E7D32" },
});