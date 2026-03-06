import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Ensure robot doc exists and bind to tunnel so robot can fetch assignedTunnelId.
 */
export async function bindRobotToTunnel(robotId: string, tunnelId: string) {
  const robotRef = doc(db, "robots", robotId);
  await setDoc(
    robotRef,
    {
      robotId,
      assignedTunnelId: tunnelId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * If you ever want to unbind robot from tunnel.
 */
export async function unbindRobot(robotId: string) {
  const robotRef = doc(db, "robots", robotId);
  await setDoc(
    robotRef,
    {
      robotId,
      assignedTunnelId: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}