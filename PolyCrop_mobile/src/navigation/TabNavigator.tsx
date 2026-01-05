import React from "react";
import { View, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/home/HomeScreen";
import MonitorScreen from "../screens/monitor/MonitorScreen";
import AlertsScreen from "../screens/alerts/AlertsScreen";
import ActionsScreen from "../screens/actions/ActionsScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import FloatingCameraButton from "../screens/components/FloatingCameraButton";

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
     <View style={styles.container}>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: "home",
            Monitor: "analytics",
            Alerts: "notifications",
            Actions: "flash",
            Settings: "settings",
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Monitor" component={MonitorScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Actions" component={ActionsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>

  {/* ✅ Floating camera button (always visible on tabs) */}
      <FloatingCameraButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
