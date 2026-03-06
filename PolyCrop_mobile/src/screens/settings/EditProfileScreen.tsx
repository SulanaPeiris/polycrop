import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import { useAuth } from "../../context/AuthContext";
import { storage } from "../../firebase/firebase";

function normalizePhone(raw: string) {
  return raw.replace(/[^\d+]/g, "");
}

// ✅ More reliable than fetch(uri).blob() in React Native
function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error("Failed to load image as blob"));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

export default function EditProfileScreen({ navigation }: any) {
  useTunnelHeader("Edit Profile");

  const { user, profile, updateProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [photoLocalUri, setPhotoLocalUri] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const email = profile?.email ?? user?.email ?? "";

  const currentPhoto = useMemo(() => {
    if (photoLocalUri) return photoLocalUri;
    return profile?.photoURL || "";
  }, [photoLocalUri, profile?.photoURL]);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setAddress(profile.address ?? "");
    setContactNumber(profile.contactNumber ?? "");
  }, [profile]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission required",
        "Please allow photo library access to change your profile picture."
      );
      return;
    }

    // ✅ Works across expo-image-picker versions:
    // New: ImagePicker.MediaType.Images (array)
    // Old: ImagePicker.MediaTypeOptions.Images
    const mediaTypes =
      (ImagePicker as any).MediaType?.Images
        ? [(ImagePicker as any).MediaType.Images]
        : (ImagePicker as any).MediaTypeOptions?.Images;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    } as any);

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setPhotoLocalUri(asset.uri);
  };

  const handleSave = async () => {
    if (!user) return;

    const name = fullName.trim();
    const addr = address.trim();
    const phone = normalizePhone(contactNumber.trim());

    if (name.length < 3) {
      Alert.alert("Invalid name", "Please enter your full name (min 3 characters).");
      return;
    }
    if (addr.length < 5) {
      Alert.alert("Invalid address", "Please enter a valid address (min 5 characters).");
      return;
    }
    if (phone.length < 9) {
      Alert.alert("Invalid contact number", "Please enter a valid contact number.");
      return;
    }

    try {
      setSaving(true);

      let photoURL: string | undefined;

      if (photoLocalUri) {
        const blob = await uriToBlob(photoLocalUri);

        const photoRef = ref(storage, `users/${user.uid}/profile.jpg`);
        await uploadBytes(photoRef, blob, { contentType: "image/jpeg" });

        photoURL = await getDownloadURL(photoRef);
      }

      await updateProfile({
        fullName: name,
        address: addr,
        contactNumber: phone,
        ...(photoURL ? { photoURL } : {}),
      });

      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      // ✅ Helps debug storage/unknown
      console.log("Profile update error:", e, e?.code, e?.serverResponse);
      Alert.alert("Error", e?.message ?? "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.avatarContainer}>
        {currentPhoto ? (
          <Image source={{ uri: currentPhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={42} color="#9E9E9E" />
          </View>
        )}

        <TouchableOpacity style={styles.changePhotoBtn} onPress={pickPhoto} disabled={saving}>
          <Ionicons name="camera" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Enter your name" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />
          <Text style={styles.hint}>Email change not supported here (security).</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Enter your address" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            style={styles.input}
            value={contactNumber}
            onChangeText={(t) => setContactNumber(normalizePhone(t))}
            placeholder="07XXXXXXXX or +94..."
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.75 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },

  avatarContainer: { alignItems: "center", marginBottom: 32, position: "relative", alignSelf: "center" },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: "#eee" },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F5" },

  changePhotoBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#2E7D32",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  form: { marginBottom: 24 },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: "600", color: "#555", marginBottom: 8 },
  input: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#333",
  },
  inputDisabled: { opacity: 0.7 },
  hint: { marginTop: 6, fontSize: 12, color: "#757575" },

  saveBtn: { backgroundColor: "#2E7D32", padding: 16, borderRadius: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});