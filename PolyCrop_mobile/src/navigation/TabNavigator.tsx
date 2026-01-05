import React from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/home/HomeScreen";
import MonitorScreen from "../screens/monitor/MonitorScreen";
import AlertsScreen from "../screens/alerts/AlertsScreen";
import ActionsScreen from "../screens/actions/ActionsScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import FloatingCameraButton from "../screens/components/FloatingCameraButton";

import { RootStackParamList, TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

function EmptyScreen() {
  return null;
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.tabBar}>
      <View style={styles.tabRow}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          // hidden tab (Alerts)
          if (route.name === "Alerts") return null;

          const onPress = () => {
            // Custom camera navigation
            if (route.name === "CameraTab") {
              // Navigate to a screen in the parent stack
              navigation.navigate("Camera" as never);
              return;
            }

            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          // ✅ camera button (still takes equal slot width)
          if (route.name === "CameraTab") {
            return (
              <View key={route.key} style={styles.item}>
                <FloatingCameraButton onPress={onPress} />
              </View>
            );
          }

          const iconMap: any = {
            Home: isFocused ? "home" : "home-outline",
            Monitor: isFocused ? "analytics" : "analytics-outline",
            Actions: isFocused ? "flash" : "flash-outline",
            Settings: isFocused ? "settings" : "settings-outline",
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.8}
              style={styles.item}
            >
              <Ionicons
                name={iconMap[route.name]}
                size={28}
                color={isFocused ? "#2E7D32" : "#9E9E9E"}
              />

              <Text style={[styles.label, { color: isFocused ? "#2E7D32" : "#9E9E9E" }]}>
                {route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabNavigator() {
  return (
    <View style={styles.container}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={({ navigation }) => ({
          headerShown: true,
          headerStyle: {
            backgroundColor: "#FFFFFF",
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: "#F5F5F5",
          },
          headerTitleStyle: {
            fontWeight: "800",
            fontSize: 18,
            color: "#1B5E20",
          },
          headerTitleAlign: "center",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("Alerts" as never)}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="notifications-outline" size={24} color="#333" />
            </TouchableOpacity>
          ),
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Monitor" component={MonitorScreen} />
        <Tab.Screen name="CameraTab" component={EmptyScreen} />
        <Tab.Screen name="Actions" component={ActionsScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
        <Tab.Screen
          name="Alerts"
          component={AlertsScreen}
          options={{
            tabBarButton: () => null,
            // Override headerRight for this specific screen to show Active state
            headerRight: () => (
              <TouchableOpacity style={{ marginRight: 16 }}>
                <Ionicons name="notifications" size={24} color="#2E7D32" />
              </TouchableOpacity>
            )
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // ✅ full width tab bar container
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },

  // ✅ THIS is the container for nav items
  tabRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly", // or "space-around"
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // ✅ each item gets equal width + centered content
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: "600",
  },
});
