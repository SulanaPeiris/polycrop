import React from "react";
import { TouchableOpacity, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface FloatingButtonProps {
  onPress?: (e?: any) => void;
  style?: any;
}

export default function FloatingCameraButton({ onPress, style }: FloatingButtonProps) {
  return (
    <View style={[style, styles.wrapper]}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.button}
        onPress={onPress}
      >
        <Ionicons name="camera" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Accept the flex layout from navigation, only add centering
    flex: 1,                 // ✅ same width behavior as other tabs
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: 78,
    height: 78,
    borderRadius: 50,
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
    // Float above the bar
    marginBottom: 70,
    // Premium Glow
    elevation: 8,
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    borderWidth: 4,
    borderColor: "#F1F8E9"
  },
});
