export type RootStackParamList = {
  Tabs: undefined;

  // Auth
  Login: undefined;

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
  Schedules: undefined;
  ManualOverride: undefined;

  // System
  SystemHealth: undefined;
  SensorFaultLogs: undefined;

  // Settings
  Thresholds: undefined;
};
