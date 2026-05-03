import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

type FaultLevel = "OK" | "WARN" | "FAULT";

function getFaultType(summary: any) {
  if (summary?.an_s1_temp_valid === false || summary?.an_s2_temp_valid === false) {
    return "INVALID_TEMPERATURE_READING";
  }

  if (summary?.an_s1_hum_valid === false || summary?.an_s2_hum_valid === false) {
    return "INVALID_HUMIDITY_READING";
  }

  if (summary?.an_tempMismatch) {
    return "TEMPERATURE_MISMATCH";
  }

  if (summary?.an_humMismatch) {
    return "HUMIDITY_MISMATCH";
  }

  return "SENSOR_FAULT";
}

export async function createSensorFaultAlert(input: {
  tunnelId: string;
  tunnelName?: string;
  summary: any;
}) {
  const user = auth.currentUser;
  if (!user) return;

  const { tunnelId, tunnelName, summary } = input;

  const level: FaultLevel = summary?.an_level || "OK";

  if (level === "OK") return;

  const type = getFaultType(summary);
  const message = summary?.an_message || "Sensor fault detected.";

  // One active alert document per tunnel.
  // This avoids creating hundreds of duplicate alerts every few seconds.
  const alertId = `sensor_fault_${tunnelId}`;

  await setDoc(
    doc(db, "alerts", alertId),
    {
      ownerId: user.uid,
      tunnelId,
      tunnelName: tunnelName || "Selected Tunnel",

      type: "SENSOR_ANOMALY",
      faultType: type,
      title: level === "FAULT" ? "Sensor Fault Detected" : "Sensor Warning",
      description: message,
      severity: level === "FAULT" ? "CRITICAL" : "WARNING",

      gatewayId: summary?.gatewayId ?? null,
      s1_temp: summary?.s1_temp ?? null,
      s1_hum: summary?.s1_hum ?? null,
      s2_temp: summary?.s2_temp ?? null,
      s2_hum: summary?.s2_hum ?? null,
      tempDiff: summary?.an_tempDiff ?? null,
      humDiff: summary?.an_humDiff ?? null,

      status: "ACTIVE",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}