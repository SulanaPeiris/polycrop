import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Bind robot -> tunnel so robot can fetch assignedTunnelId.
 * Also writes tunnel.robotId so the security rules allow robot to create scanEvents.
 */
export async function bindRobotToTunnel(robotId: string, tunnelId: string) {
  const rid = robotId.trim();
  if (!rid) throw new Error("Robot ID is empty");

  const robotRef = doc(db, "robots", rid);

  // robot side assignment
  await setDoc(
    robotRef,
    {
      robotId: rid,
      assignedTunnelId: tunnelId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // tunnel side assignment (so /tunnels/{tunnelId}.robotId matches robotId)
  await updateDoc(doc(db, "tunnels", tunnelId), {
    robotId: rid,
    updatedAt: serverTimestamp(),
  });
}

export async function unbindRobot(robotId: string) {
  const rid = robotId.trim();
  if (!rid) return;

  const robotRef = doc(db, "robots", rid);
  await setDoc(
    robotRef,
    {
      robotId: rid,
      assignedTunnelId: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
