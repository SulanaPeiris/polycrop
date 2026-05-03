export type RootStackParamList = {
  Tabs: undefined;

  // Auth
  Login: undefined;
  SignUp: undefined;

  // Monitor
  SensorDetails: { sensorId: string; title: string };
  ZoneNodes: undefined;

  // Disease ✅ captureId not imageId
  DiseaseDashboard: undefined;
  DetectionFeed: undefined;
  DetectionDetail: {
    tunnelId: string;
    plantId: string;
    captureId?: string;
    imageId?: string;
    id?: string;
    filterMode?: "LEAF" | "CUCUMBER" | "ALL";
  };

  // Alerts
  AlertDetail: { alertId: string };

  // Actions
  IrrigationControl: undefined;
  Fertigation: undefined;
  FertigationConfig: undefined;
  Schedules: undefined;
  ManualOverride: undefined;
  HarvestReady: undefined;

  CucumberScans: {
  tunnelId: string;
  plantId: string;
  plantTitle?: string;
  row?: number;
  column?: number;
  rfidA?: string | null;
  rfidB?: string | null;
};

CucumberScanDetail: {
  tunnelId: string;
  plantId: string;
  captureId: string;
  plantTitle?: string;
};

  // System
  SystemHealth: undefined;
  SensorFaultLogs: undefined;

  // Settings
  Thresholds: undefined;
  AddTunnel: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  ScansAndResults: undefined;
  ScanPreview: { captureId: string };
  TunnelSettings: undefined;
EditTunnel: { tunnelId: string };
TunnelSetup: { tunnelId: string };

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
