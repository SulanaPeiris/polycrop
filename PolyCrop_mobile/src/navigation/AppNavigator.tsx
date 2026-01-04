import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";
import { RootStackParamList } from "./types";
import { TunnelProvider } from "../context/TunnelContext";
import { AuthProvider, useAuth } from "../context/AuthContext";

import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";

import SensorDetailsScreen from "../screens/monitor/SensorDetailsScreen";
import ZoneNodesScreen from "../screens/monitor/ZoneNodesScreen";

import DiseaseDashboardScreen from "../screens/disease/DiseaseDashboardScreen";
import DetectionFeedScreen from "../screens/disease/DetectionFeedScreen";
import DetectionDetailScreen from "../screens/disease/DetectionDetailScreen";

import AlertDetailScreen from "../screens/alerts/AlertDetailScreen";

import IrrigationControlScreen from "../screens/actions/IrrigationControlScreen";
import FertigationScreen from "../screens/actions/FertigationScreen";
import FertigationConfigScreen from "../screens/actions/FertigationConfigScreen";
import SchedulesScreen from "../screens/actions/SchedulesScreen";
import ManualOverrideScreen from "../screens/actions/ManualOverrideScreen";

import SystemHealthScreen from "../screens/system/SystemHealthScreen";
import SensorFaultLogsScreen from "../screens/system/SensorFaultLogsScreen";
import CameraScreen from "../screens/camera/CameraScreen";

import ThresholdsScreen from "../screens/settings/ThresholdsScreen";
import AddTunnelScreen from "../screens/settings/AddTunnelScreen";
import EditProfileScreen from "../screens/settings/EditProfileScreen";
import ChangePasswordScreen from "../screens/settings/ChangePasswordScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  const { isLoggedIn } = useAuth();

  return (
    <Stack.Navigator>
      {!isLoggedIn ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />

          {/* Monitor */}
          <Stack.Screen name="SensorDetails" component={SensorDetailsScreen} />
          <Stack.Screen name="ZoneNodes" component={ZoneNodesScreen} options={{ title: "Zones / Nodes" }} />

          {/* Disease */}
          <Stack.Screen name="DiseaseDashboard" component={DiseaseDashboardScreen} options={{ title: "Disease & Stress" }} />
          <Stack.Screen name="DetectionFeed" component={DetectionFeedScreen} options={{ title: "Detection Feed" }} />
          <Stack.Screen name="DetectionDetail" component={DetectionDetailScreen} options={{ title: "Detection Detail" }} />

          {/* Alerts */}
          <Stack.Screen name="AlertDetail" component={AlertDetailScreen} options={{ title: "Alert" }} />

          {/* Actions */}
          <Stack.Screen name="IrrigationControl" component={IrrigationControlScreen} options={{ title: "Irrigation" }} />
          <Stack.Screen name="Fertigation" component={FertigationScreen} options={{ title: "Fertigation" }} />
          <Stack.Screen name="FertigationConfig" component={FertigationConfigScreen} options={{ title: "Configuration" }} />
          <Stack.Screen name="Schedules" component={SchedulesScreen} options={{ title: "Schedules" }} />
          <Stack.Screen name="ManualOverride" component={ManualOverrideScreen} options={{ title: "Manual Override" }} />

          {/* System */}
          <Stack.Screen name="SystemHealth" component={SystemHealthScreen} options={{ title: "System Health" }} />
          <Stack.Screen name="SensorFaultLogs" component={SensorFaultLogsScreen} options={{ title: "Sensor Fault Logs" }} />

          {/* Settings */}
          <Stack.Screen name="Thresholds" component={ThresholdsScreen} options={{ title: "Thresholds" }} />
          <Stack.Screen name="AddTunnel" component={AddTunnelScreen} options={{ title: "Add Tunnel" }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Edit Profile" }} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: "Change Password" }} />

          {/* Camera */}
          <Stack.Screen name="Camera" component={CameraScreen} options={{ headerShown: false }} />

        </>
      )}
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <AuthProvider>
      <TunnelProvider>
        <NavigationContainer>
          <AppContent />
        </NavigationContainer>
      </TunnelProvider>
    </AuthProvider>
  );
}
