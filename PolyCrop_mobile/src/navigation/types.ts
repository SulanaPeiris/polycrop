export type RootStackParamList = {
  Tabs: undefined;

  // Auth
  Login: undefined;
  SignUp: undefined;

  // Monitor
  SensorDetails: { sensorId: string; title: string };
  ZoneNodes: undefined;

  // Disease
  DiseaseDashboard: undefined;
  DetectionFeed: undefined;
  DetectionDetail: { imageId: string };

  // Alerts
  AlertDetail: { alertId: string };

  // Actions
  IrrigationControl: undefined;
  Fertigation: undefined;
  FertigationConfig: undefined;
  Schedules: undefined;
  ManualOverride: undefined;

  // System
  SystemHealth: undefined;
  SensorFaultLogs: undefined;

  // Settings
  Thresholds: undefined;
  AddTunnel: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;

  // Camera
  Camera: undefined;
};

export type TabParamList = {
  Home: undefined;
  Monitor: undefined;
  CameraTab: undefined; // specific to the floating button
  Actions: undefined;
  Settings: undefined;
  Alerts: undefined;
};
