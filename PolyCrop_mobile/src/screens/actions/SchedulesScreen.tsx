import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTunnelHeader } from "../../hooks/useTunnelHeader";
import SectionTitle from "../components/SectionTitle";
import { LinearGradient } from "expo-linear-gradient";
import { collection, documentId, limit, onSnapshot, orderBy, query, doc, where, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useTunnel } from "../../context/TunnelContext";

const { width } = Dimensions.get("window");

type NpkReading = {
  n: number | null;
  p: number | null;
  k: number | null;
  ts: string;
};

type StageNpk = {
  n: number;
  p: number;
  k: number;
};

type StageMixes = {
  1: StageNpk;
  2: StageNpk;
  3: StageNpk;
};

const DEFAULT_STAGE_MIXES: StageMixes = {
  1: { n: 6.0, p: 4.0, k: 4.0 },
  2: { n: 7.0, p: 5.0, k: 5.0 },
  3: { n: 4.0, p: 8.0, k: 7.0 },
};

function formatReadingTs(ts: any): string {
  if (!ts) return "";
  if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
  if (typeof ts === "number") return new Date(ts).toLocaleString();
  if (typeof ts === "string") return ts;
  return "";
}


const MockSlider = ({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (value: number) => void;
}) => {
  const [sliderWidth, setSliderWidth] = useState(0);
  const MAX_ML = 100;
  const STEP_ML = 5;

  const handleTouch = (e: any) => {
    if (sliderWidth === 0) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / sliderWidth));
    const newValue = Math.round(ratio * MAX_ML);
    onChange(newValue);
  };

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sliderLabel, { color }]}>{label}</Text>
        <Text style={styles.sliderValue}>{value.toFixed(0)} ml</Text>
      </View>

      <TouchableOpacity
        style={styles.track}
        activeOpacity={1}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        onPress={handleTouch}
      >
        <View
          style={[
            styles.fill,
            { width: `${(value / MAX_ML) * 100}%`, backgroundColor: color },
          ]}
        />
        <View
          style={[
            styles.thumb,
            { left: `${(value / MAX_ML) * 100}%`, borderColor: color },
          ]}
        />
      </TouchableOpacity>

      <View style={styles.buttons}>
        <TouchableOpacity
          onPress={() =>
            onChange(Math.max(0, Math.round(value - STEP_ML)))
          }
          style={styles.adjBtn}
        >
          <Ionicons name="remove" size={16} color="#555" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            onChange(Math.min(MAX_ML, Math.round(value + STEP_ML)))
          }
          style={styles.adjBtn}
        >
          <Ionicons name="add" size={16} color="#555" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function SchedulesScreen() {
  useTunnelHeader("Schedules & Logs");
  const { selectedTunnelId, selectedTunnel } = useTunnel();
  const [currentNpk, setCurrentNpk] = useState<NpkReading>({ n: null, p: null, k: null, ts: "" });
  const [isFloweringSeason, setIsFloweringSeason] = useState(false);
  const [flowerCount, setFlowerCount] = useState(0);
  const [lastDetectionDate, setLastDetectionDate] = useState<string>("");
  const [stage, setStage] = useState(2);
  const [stageMixes, setStageMixes] = useState<StageMixes>(DEFAULT_STAGE_MIXES);
  const [npk, setNpk] = useState<StageNpk>(DEFAULT_STAGE_MIXES[2]);
  const [selectedHour, setSelectedHour] = useState("04");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedMeridiem, setSelectedMeridiem] = useState<"AM" | "PM">("PM");
  const [openDropdown, setOpenDropdown] = useState<"hour" | "minute" | "meridiem" | null>(null);
  const [isPlantingDone, setIsPlantingDone] = useState(false);
  const [plantingDoneAtMs, setPlantingDoneAtMs] = useState<number | null>(null);
  const [dbCurrentStage, setDbCurrentStage] = useState<number | null>(null);
  const [isUpdatingPlanting, setIsUpdatingPlanting] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configStatusText, setConfigStatusText] = useState("Not applied yet");
  const [lastAutoDispenseDateKey, setLastAutoDispenseDateKey] = useState<string>("");
  const [isAutoSendingCommand, setIsAutoSendingCommand] = useState(false);

  const hourOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const minuteOptions = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
  const dailyScheduleTime = `${selectedHour}:${selectedMinute} ${selectedMeridiem}`;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const getStageByElapsedDays = (elapsedDays: number) => {
    if (elapsedDays <= 13) return { id: 1, title: "Stage 1", subtitle: "Early Growth (Week 1-2)" };
    if (elapsedDays <= 27) return { id: 2, title: "Stage 2", subtitle: "Vegetative (Week 3-4)" };
    return { id: 3, title: "Stage 3", subtitle: "Flowering Season" };
  };

  const toggleDropdown = (key: "hour" | "minute" | "meridiem") => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const toStageId = (value: number): 1 | 2 | 3 => {
    if (value === 1 || value === 2 || value === 3) return value;
    return 2;
  };

  const updateCurrentStageNpk = (key: keyof StageNpk, value: number) => {
    const sid = toStageId(stage);
    setNpk((prev) => ({ ...prev, [key]: value }));
    setStageMixes((prev) => ({
      ...prev,
      [sid]: {
        ...prev[sid],
        [key]: value,
      },
    }));
  };

  const stages = [
    { id: 1, title: "Stage 1", subtitle: "Early Growth (Week 1-2)" },
    { id: 2, title: "Stage 2", subtitle: "Vegetative (Week 3-4)" },
    { id: 3, title: "Stage 3", subtitle: "Flowering Season" },
  ];

  const handleStageChange = (id: number) => {
    setStage(id);
    const sid = toStageId(id);
    setNpk(stageMixes[sid]);
  };

  const sendScheduledDispenseCommand = async () => {
    if (!selectedTunnelId || isAutoSendingCommand) return;

    const sid = toStageId(stage);
    const activeMix = stageMixes[sid];
    const now = new Date();
    const nowIso = now.toISOString();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const commandId = `cmd_auto_${Date.now()}`;

    try {
      setIsAutoSendingCommand(true);

      await setDoc(
        doc(db, "deviceCommands", "liquid-system-01"),
        {
          commandId,
          type: "dispense_all",
          c1ml: activeMix.n,
          c2ml: activeMix.p,
          c3ml: activeMix.k,
          status: "PENDING",
          requestedBy: `schedule:${selectedTunnelId}`,
          requestedAt: nowIso,
          lastUpdatedAt: nowIso,
          tunnelId: selectedTunnelId,
          source: "scheduled_fertigation",
          stage: sid,
        },
        { merge: true }
      );

      await updateDoc(doc(db, "tunnels", selectedTunnelId), {
        lastAutoDispenseDateKey: dateKey,
        lastAutoDispenseAt: serverTimestamp(),
        lastAutoDispenseCommandId: commandId,
        updatedAt: serverTimestamp(),
      });

      setLastAutoDispenseDateKey(dateKey);
      setConfigStatusText(`Auto dispense sent at ${now.toLocaleString()}`);
    } catch (error) {
      console.log("auto dispense command error:", error);
    } finally {
      setIsAutoSendingCommand(false);
    }
  };

  const handleApplyConfiguration = async () => {
    if (!selectedTunnelId || isSavingConfig) return;

    try {
      setIsSavingConfig(true);

      const sid = toStageId(stage);
      const selectedStage = stages.find((s) => s.id === sid) ?? stages[1];

      await updateDoc(doc(db, "tunnels", selectedTunnelId), {
        configuredStage: sid,
        configuredStageTitle: selectedStage.title,
        configuredStageSubtitle: selectedStage.subtitle,
        stageMixes,
        dailyFertigationTime: dailyScheduleTime,
        updatedAt: serverTimestamp(),
      });

      setConfigStatusText(`Applied: ${selectedStage.title} at ${dailyScheduleTime}`);
    } catch (error) {
      console.log("apply config update error:", error);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handlePlantingDone = async () => {
    if (!selectedTunnelId || isUpdatingPlanting) return;

    try {
      setIsUpdatingPlanting(true);
      const nowMs = Date.now();
      const stageNow = getStageByElapsedDays(0);

      await updateDoc(doc(db, "tunnels", selectedTunnelId), {
        plantingDone: true,
        plantingDoneAt: serverTimestamp(),
        plantingDoneAtMs: nowMs,
        currentStage: stageNow.id,
        currentStageTitle: stageNow.title,
        currentStageSubtitle: stageNow.subtitle,
        dailyFertigationTime: dailyScheduleTime,
        updatedAt: serverTimestamp(),
      });

      setIsPlantingDone(true);
      setPlantingDoneAtMs(nowMs);
      setDbCurrentStage(stageNow.id);
      setStage(stageNow.id);
    } catch (error) {
      console.log("planting done update error:", error);
    } finally {
      setIsUpdatingPlanting(false);
    }
  };

  useEffect(() => {
    const latestNpkQuery = query(
      collection(db, "devices", "npk-esp32-01", "readings"),
      orderBy(documentId(), "desc"),
      limit(1)
    );

    return onSnapshot(
      latestNpkQuery,
      (snap) => {
        const first = snap.docs[0];
        if (!first) {
          setCurrentNpk({ n: null, p: null, k: null, ts: "" });
          return;
        }

        const data = first.data() as any;
        const n = Number(data?.n);
        const p = Number(data?.p);
        const k = Number(data?.k);

        setCurrentNpk({
          n: Number.isFinite(n) ? n : null,
          p: Number.isFinite(p) ? p : null,
          k: Number.isFinite(k) ? k : null,
          ts: formatReadingTs(data?.ts),
        });
      },
      (err) => {
        console.log("npk readings listener error:", err);
        setCurrentNpk({ n: null, p: null, k: null, ts: "" });
      }
    );
  }, []);

  // Listen for flower detections in captures
  useEffect(() => {
    if (!selectedTunnelId) {
      setIsFloweringSeason(false);
      setFlowerCount(0);
      return;
    }

    const capturesQuery = query(
      collection(db, "captures"),
      where("meta.tunnelId", "==", selectedTunnelId),
      where("status", "==", "DONE"),
      orderBy(documentId(), "desc"),
      limit(50)
    );

    return onSnapshot(
      capturesQuery,
      (snap) => {
        let hasFlowers = false;
        let totalFlowers = 0;
        let latestDate = "";

        snap.docs.forEach((doc) => {
          const data = doc.data() as any;
          const flowerCount = data?.outputs?.summary?.counts?.flower || 0;
          
          if (flowerCount > 0) {
            hasFlowers = true;
            totalFlowers += flowerCount;
            
            if (!latestDate && data?.createdAt) {
              latestDate = formatReadingTs(data.createdAt);
            }
          }
        });

        setIsFloweringSeason(hasFlowers);
        setFlowerCount(totalFlowers);
        setLastDetectionDate(latestDate);
      },
      (err) => {
        console.log("captures listener error:", err);
        setIsFloweringSeason(false);
        setFlowerCount(0);
      }
    );
  }, [selectedTunnelId]);

  useEffect(() => {
    const sid = toStageId(stage);
    setNpk(stageMixes[sid]);
  }, [stage, stageMixes]);

  useEffect(() => {
    if (!selectedTunnelId) {
      setIsPlantingDone(false);
      setPlantingDoneAtMs(null);
      setDbCurrentStage(null);
      setConfigStatusText("Not applied yet");
      setLastAutoDispenseDateKey("");
      setStageMixes(DEFAULT_STAGE_MIXES);
      setNpk(DEFAULT_STAGE_MIXES[2]);
      return;
    }

    return onSnapshot(
      doc(db, "tunnels", selectedTunnelId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const done = Boolean(data?.plantingDone);
        const doneAtMsRaw = Number(data?.plantingDoneAtMs ?? 0);
        const stageRaw = Number(data?.currentStage ?? 0);
        const configuredStageRaw = Number(data?.configuredStage ?? 0);

        setIsPlantingDone(done);
        setPlantingDoneAtMs(Number.isFinite(doneAtMsRaw) && doneAtMsRaw > 0 ? doneAtMsRaw : null);
        setDbCurrentStage(Number.isFinite(stageRaw) && stageRaw > 0 ? stageRaw : null);
        setLastAutoDispenseDateKey(typeof data?.lastAutoDispenseDateKey === "string" ? data.lastAutoDispenseDateKey : "");

        const stageIdFromDb = Number.isFinite(stageRaw) && stageRaw > 0 ? toStageId(stageRaw) : Number.isFinite(configuredStageRaw) && configuredStageRaw > 0 ? toStageId(configuredStageRaw) : 2;
        setStage(stageIdFromDb);

        const dbMixes = data?.stageMixes;
        if (dbMixes && typeof dbMixes === "object") {
          const normalized: StageMixes = {
            1: {
              n: Number.isFinite(Number(dbMixes?.[1]?.n)) ? Number(dbMixes[1].n) : DEFAULT_STAGE_MIXES[1].n,
              p: Number.isFinite(Number(dbMixes?.[1]?.p)) ? Number(dbMixes[1].p) : DEFAULT_STAGE_MIXES[1].p,
              k: Number.isFinite(Number(dbMixes?.[1]?.k)) ? Number(dbMixes[1].k) : DEFAULT_STAGE_MIXES[1].k,
            },
            2: {
              n: Number.isFinite(Number(dbMixes?.[2]?.n)) ? Number(dbMixes[2].n) : DEFAULT_STAGE_MIXES[2].n,
              p: Number.isFinite(Number(dbMixes?.[2]?.p)) ? Number(dbMixes[2].p) : DEFAULT_STAGE_MIXES[2].p,
              k: Number.isFinite(Number(dbMixes?.[2]?.k)) ? Number(dbMixes[2].k) : DEFAULT_STAGE_MIXES[2].k,
            },
            3: {
              n: Number.isFinite(Number(dbMixes?.[3]?.n)) ? Number(dbMixes[3].n) : DEFAULT_STAGE_MIXES[3].n,
              p: Number.isFinite(Number(dbMixes?.[3]?.p)) ? Number(dbMixes[3].p) : DEFAULT_STAGE_MIXES[3].p,
              k: Number.isFinite(Number(dbMixes?.[3]?.k)) ? Number(dbMixes[3].k) : DEFAULT_STAGE_MIXES[3].k,
            },
          };
          setStageMixes(normalized);
        }

        if (typeof data?.configuredStageTitle === "string" && typeof data?.dailyFertigationTime === "string") {
          setConfigStatusText(`Applied: ${data.configuredStageTitle} at ${data.dailyFertigationTime}`);
        }

        if (typeof data?.dailyFertigationTime === "string") {
          const m = /^(\d{2}):(\d{2})\s(AM|PM)$/.exec(data.dailyFertigationTime);
          if (m) {
            setSelectedHour(m[1]);
            setSelectedMinute(m[2]);
            setSelectedMeridiem(m[3] as "AM" | "PM");
          }
        }
      },
      (err) => {
        console.log("tunnel planting listener error:", err);
      }
    );
  }, [selectedTunnelId]);

  useEffect(() => {
    if (!selectedTunnelId || !isFloweringSeason) return;

    const floweringStage = { id: 3, title: "Stage 3", subtitle: "Flowering Season" };
    setStage(floweringStage.id);

    if (dbCurrentStage === floweringStage.id) return;

    updateDoc(doc(db, "tunnels", selectedTunnelId), {
      currentStage: floweringStage.id,
      currentStageTitle: floweringStage.title,
      currentStageSubtitle: floweringStage.subtitle,
      floweringDetected: true,
      floweringDetectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((err) => {
      console.log("flowering stage sync update error:", err);
    });
  }, [selectedTunnelId, isFloweringSeason, dbCurrentStage]);

  useEffect(() => {
    if (!selectedTunnelId || !plantingDoneAtMs) return;

    const elapsedDays = Math.max(0, Math.floor((Date.now() - plantingDoneAtMs) / DAY_MS));
    const stageFromTime = isFloweringSeason
      ? { id: 3, title: "Stage 3", subtitle: "Flowering Season" }
      : getStageByElapsedDays(elapsedDays);
    setStage(stageFromTime.id);

    if (dbCurrentStage === stageFromTime.id) return;

    updateDoc(doc(db, "tunnels", selectedTunnelId), {
      currentStage: stageFromTime.id,
      currentStageTitle: stageFromTime.title,
      currentStageSubtitle: stageFromTime.subtitle,
      updatedAt: serverTimestamp(),
    }).catch((err) => {
      console.log("stage sync update error:", err);
    });
  }, [selectedTunnelId, plantingDoneAtMs, dbCurrentStage, isFloweringSeason]);

  useEffect(() => {
    if (!selectedTunnelId) return;

    const timer = setInterval(() => {
      const now = new Date();

      const selectedHourNumber = Number(selectedHour);
      const selectedMinuteNumber = Number(selectedMinute);
      if (!Number.isFinite(selectedHourNumber) || !Number.isFinite(selectedMinuteNumber)) return;

      let hour24 = selectedHourNumber % 12;
      if (selectedMeridiem === "PM") hour24 += 12;

      const isScheduledMinute = now.getHours() === hour24 && now.getMinutes() === selectedMinuteNumber;
      if (!isScheduledMinute) return;

      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (lastAutoDispenseDateKey === todayKey) return;

      sendScheduledDispenseCommand();
    }, 15000);

    return () => clearInterval(timer);
  }, [selectedTunnelId, selectedHour, selectedMinute, selectedMeridiem, lastAutoDispenseDateKey, stage, stageMixes, isAutoSendingCommand]);

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* 1. Next Active Fertigation - Enhanced Design */}
      {/* <LinearGradient
        colors={['#ffffff', '#F1F8E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.nextRunCard}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.iconCircle}>
              <Ionicons name="water" size={20} color="#2E7D32" />
            </View>
            <Text style={styles.cardTitle}>Next Fertigation</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>TODAY</Text>
          </View>
        </View>

        <View style={styles.timeContainer}>
          <Text style={styles.timeLarge}>04:00</Text>
          <Text style={styles.timeAmPm}>PM</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="hourglass-outline" size={14} color="#757575" />
            <Text style={styles.metaText}>15 mins duration</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="leaf-outline" size={14} color="#757575" />
            <Text style={styles.metaText}>Mix: Vegitative</Text>
          </View>
        </View>
      </LinearGradient> */}

      {/* Current NPK Levels */}
      <View style={styles.currentNpkCard}>
        <View style={styles.currentNpkHeader}>
          <View style={styles.currentNpkIcon}>
            <Ionicons name="flask-outline" size={18} color="#2E7D32" />
          </View>
          <Text style={styles.currentNpkTitle}>Current NPK Levels</Text>
        </View>

        <View style={styles.currentNpkRow}>
          <View style={styles.currentNpkItem}>
            <View style={styles.currentNpkCircle}>
              <Text style={styles.currentNpkValue}>{currentNpk.n ?? "—"}</Text>
            </View>
            <Text style={styles.currentNpkLabel}>N</Text>
          </View>

          <View style={styles.currentNpkItem}>
            <View style={styles.currentNpkCircle}>
              <Text style={styles.currentNpkValue}>{currentNpk.p ?? "—"}</Text>
            </View>
            <Text style={styles.currentNpkLabel}>P</Text>
          </View>

          <View style={styles.currentNpkItem}>
            <View style={styles.currentNpkCircle}>
              <Text style={styles.currentNpkValue}>{currentNpk.k ?? "—"}</Text>
            </View>
            <Text style={styles.currentNpkLabel}>K</Text>
          </View>
        </View>

        {!!currentNpk.ts && <Text style={styles.currentNpkTs}>Updated: {currentNpk.ts}</Text>}
      </View>

      {/* Flowering Season Status */}
      {isFloweringSeason ? (
        <View style={styles.floweringCard}>
          <View style={styles.floweringHeader}>
            <View style={styles.floweringIconBox}>
              <Ionicons name="flower" size={20} color="#D81B60" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.floweringTitle}>Flowering Season Status</Text>
              <Text style={styles.floweringStatus}>Active - Detected by Robot Scan</Text>
            </View>
            <View style={styles.floweringBadge}>
              <View style={styles.floweringDot} />
              <Text style={styles.floweringBadgeText}>ACTIVE</Text>
            </View>
          </View>
          <Text style={styles.floweringSubtext}>
            🌸 {flowerCount} flower{flowerCount !== 1 ? 's' : ''} detected during plant scanning. Consider using flowering stage nutrients (Stage 3).
          </Text>
          {!!lastDetectionDate && (
            <Text style={styles.floweringDate}>Last detected: {lastDetectionDate}</Text>
          )}
        </View>
      ) : (
        <View style={[styles.floweringCard, styles.floweringCardInactive]}>
          <View style={styles.floweringHeader}>
            <View style={[styles.floweringIconBox, { backgroundColor: "#F5F5F5" }]}>
              <Ionicons name="flower-outline" size={20} color="#9E9E9E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.floweringTitle, { color: "#757575" }]}>Flowering Season Status</Text>
              <Text style={[styles.floweringStatus, { color: "#9E9E9E" }]}>No flowers detected yet</Text>
            </View>
            <View style={[styles.floweringBadge, { backgroundColor: "#F5F5F5" }]}>
              <View style={[styles.floweringDot, { backgroundColor: "#9E9E9E" }]} />
              <Text style={[styles.floweringBadgeText, { color: "#9E9E9E" }]}>INACTIVE</Text>
            </View>
          </View>
          <Text style={[styles.floweringSubtext, { color: "#9E9E9E" }]}>
            Robot will detect flowers during plant scanning. Status will update automatically.
          </Text>
        </View>
      )}

      {/* Planting Status */}
      <View style={styles.plantingStatusCard}>
        <TouchableOpacity
          style={[styles.plantingDoneBtn, (isUpdatingPlanting || isPlantingDone) && styles.plantingDoneBtnDisabled]}
          onPress={handlePlantingDone}
          disabled={isUpdatingPlanting || isPlantingDone || !selectedTunnelId}
          activeOpacity={0.85}
        >
          <Ionicons name="leaf-outline" size={16} color="#fff" />
          <Text style={styles.plantingDoneBtnText}>
            {isUpdatingPlanting ? "Updating..." : isPlantingDone ? "Planting Completed" : "Planting Is Done"}
          </Text>
        </TouchableOpacity>

        {isPlantingDone && (
          <Text style={styles.plantingMetaText}>Tunnel: {selectedTunnel?.name || selectedTunnelId} | Current Stage: {stages[stage - 1]?.title ?? "Stage 1"}</Text>
        )}
      </View>

      <SectionTitle title="Configure Mix" />

      <View style={styles.configCard}>
        <View style={styles.timeline}>
          {stages.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.stageStep, stage === s.id && styles.activeStep]}
              onPress={() => handleStageChange(s.id)}
            >
              <Text
                style={[
                  styles.stepNum,
                  stage === s.id && styles.activeStepNum,
                ]}
              >
                {s.id}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.timelineLine} />
        </View>

        <View style={styles.stageMeta}>
          <Text style={styles.stageName}>{stages[stage - 1].title}</Text>
          <Text style={styles.stageDesc}>{stages[stage - 1].subtitle}</Text>
        </View>

        <View style={styles.divider} />

        <MockSlider
          label="Nitrogen (N)"
          value={npk.n}
          color="#2E7D32"
          onChange={(v) => updateCurrentStageNpk("n", v)}
        />
        <MockSlider
          label="Phosphorus (P)"
          value={npk.p}
          color="#F57C00"
          onChange={(v) => updateCurrentStageNpk("p", v)}
        />
        <MockSlider
          label="Potassium (K)"
          value={npk.k}
          color="#7B1FA2"
          onChange={(v) => updateCurrentStageNpk("k", v)}
        />

        <View style={styles.scheduleBox}>
          <View style={styles.scheduleRow}>
            <Ionicons name="time-outline" size={18} color="#2E7D32" />
            <Text style={styles.scheduleTitle}>Daily Fertigation Time</Text>
          </View>

          <Text style={styles.scheduleTimePreview}>Selected: {dailyScheduleTime}</Text>
          <Text style={styles.scheduleStageNpkText}>
            Active Stage Mix: N {npk.n.toFixed(0)} ml | P {npk.p.toFixed(0)} ml | K {npk.k.toFixed(0)} ml
          </Text>

          <View style={styles.dropdownGroup}>
            <Text style={styles.selectorLabel}>Hour</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => toggleDropdown("hour")}
              activeOpacity={0.85}
            >
              <Text style={styles.dropdownTriggerText}>{selectedHour}</Text>
              <Ionicons
                name={openDropdown === "hour" ? "chevron-up" : "chevron-down"}
                size={16}
                color="#2E7D32"
              />
            </TouchableOpacity>
            {openDropdown === "hour" && (
              <View style={styles.dropdownMenu}>
                {hourOptions.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    style={[styles.dropdownItem, selectedHour === hour && styles.dropdownItemActive]}
                    onPress={() => {
                      setSelectedHour(hour);
                      setOpenDropdown(null);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, selectedHour === hour && styles.dropdownItemTextActive]}>{hour}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.dropdownGroup}>
            <Text style={styles.selectorLabel}>Min</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => toggleDropdown("minute")}
              activeOpacity={0.85}
            >
              <Text style={styles.dropdownTriggerText}>{selectedMinute}</Text>
              <Ionicons
                name={openDropdown === "minute" ? "chevron-up" : "chevron-down"}
                size={16}
                color="#2E7D32"
              />
            </TouchableOpacity>
            {openDropdown === "minute" && (
              <View style={styles.dropdownMenu}>
                {minuteOptions.map((minute) => (
                  <TouchableOpacity
                    key={minute}
                    style={[styles.dropdownItem, selectedMinute === minute && styles.dropdownItemActive]}
                    onPress={() => {
                      setSelectedMinute(minute);
                      setOpenDropdown(null);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, selectedMinute === minute && styles.dropdownItemTextActive]}>{minute}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.dropdownGroup}>
            <Text style={styles.selectorLabel}>AM / PM</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => toggleDropdown("meridiem")}
              activeOpacity={0.85}
            >
              <Text style={styles.dropdownTriggerText}>{selectedMeridiem}</Text>
              <Ionicons
                name={openDropdown === "meridiem" ? "chevron-up" : "chevron-down"}
                size={16}
                color="#2E7D32"
              />
            </TouchableOpacity>
            {openDropdown === "meridiem" && (
              <View style={styles.dropdownMenu}>
                {(["AM", "PM"] as const).map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.dropdownItem, selectedMeridiem === slot && styles.dropdownItemActive]}
                    onPress={() => {
                      setSelectedMeridiem(slot);
                      setOpenDropdown(null);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, selectedMeridiem === slot && styles.dropdownItemTextActive]}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.applyBtn, isSavingConfig && styles.applyBtnDisabled]}
        activeOpacity={0.8}
        onPress={handleApplyConfiguration}
        disabled={isSavingConfig || !selectedTunnelId}
      >
        <Text style={styles.applyText}>{isSavingConfig ? "Applying..." : "Apply Configuration"}</Text>
      </TouchableOpacity>
      <Text style={styles.configStatusText}>{configStatusText}</Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#FAFAFA", flexGrow: 1 },

  // Next Run Card
  nextRunCard: { borderRadius: 24, padding: 24, marginBottom: 32, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontWeight: "700", color: "#333", fontSize: 16 },

  badge: { backgroundColor: "#E1F5FE", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "800", color: "#0288D1", letterSpacing: 0.5 },

  timeContainer: { flexDirection: "row", alignItems: "baseline", marginBottom: 20 },
  timeLarge: { fontSize: 42, fontWeight: "800", color: "#2E7D32", includeFontPadding: false },
  timeAmPm: { fontSize: 18, fontWeight: "600", color: "#81C784", marginLeft: 6 },

  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.05)", marginBottom: 16 },

  metaRow: { flexDirection: "row", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { color: "#757575", fontWeight: "600", fontSize: 13 },

  currentNpkCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  currentNpkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  currentNpkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  currentNpkTitle: { fontSize: 15, fontWeight: "700", color: "#333" },
  currentNpkRow: { flexDirection: "row", justifyContent: "space-around" },
  currentNpkItem: { alignItems: "center", gap: 6 },
  currentNpkCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#F1F8E9",
    borderWidth: 1,
    borderColor: "#A5D6A7",
    alignItems: "center",
    justifyContent: "center",
  },
  currentNpkValue: { fontSize: 20, fontWeight: "800", color: "#2E7D32" },
  currentNpkLabel: { fontSize: 12, fontWeight: "700", color: "#4CAF50" },
  currentNpkTs: { marginTop: 12, fontSize: 12, color: "#757575", textAlign: "center" },

  // Flowering Season Card
  floweringCard: {
    backgroundColor: "#FCE4EC",
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#F8BBD0",
    elevation: 2,
    shadowColor: "#D81B60",
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  floweringHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  floweringIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
  },
  floweringTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#880E4F",
  },
  floweringStatus: {
    fontSize: 12,
    color: "#AD1457",
    fontWeight: "600",
    marginTop: 2,
  },
  floweringBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  floweringDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D81B60",
  },
  floweringBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D81B60",
    letterSpacing: 0.5,
  },
  floweringSubtext: {
    fontSize: 13,
    color: "#C2185B",
    lineHeight: 18,
  },
  floweringDate: {
    fontSize: 11,
    color: "#C2185B",
    fontWeight: "600",
    marginTop: 6,
  },
  floweringCardInactive: {
    backgroundColor: "#FAFAFA",
    borderColor: "#E0E0E0",
  },

  // Planting Status Card
  plantingStatusCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  plantingDoneBtn: {
    backgroundColor: "#2E7D32",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  plantingDoneBtnDisabled: {
    opacity: 0.65,
  },
  plantingDoneBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  plantingMetaText: {
    marginTop: 10,
    fontSize: 12,
    color: "#1B5E20",
    fontWeight: "600",
  },

  // Configure Mix
  configCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    elevation: 2,
    marginBottom: 16,
  },
  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 12,
    marginBottom: 16,
    position: "relative",
  },
  timelineLine: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#E0E0E0",
    zIndex: -1,
  },
  stageStep: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  activeStep: {
    backgroundColor: "#2E7D32",
    borderColor: "#A5D6A7",
    transform: [{ scale: 1.1 }],
  },
  stepNum: { fontWeight: "700", color: "#BDBDBD" },
  activeStepNum: { color: "#fff" },
  stageMeta: { alignItems: "center", marginBottom: 20 },
  stageName: { fontSize: 16, fontWeight: "800", color: "#2E7D32" },
  stageDesc: { fontSize: 12, color: "#757575" },
  sliderContainer: { marginBottom: 20 },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sliderLabel: { fontWeight: "700", fontSize: 13, color: "#555" },
  sliderValue: { fontWeight: "800", color: "#333" },
  track: {
    height: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
    position: "relative",
    marginBottom: 16,
    justifyContent: "center",
  },
  fill: { height: 12, borderRadius: 6 },
  thumb: {
    position: "absolute",
    top: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    elevation: 3,
  },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  adjBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F3F4",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleBox: {
    marginTop: 4,
    backgroundColor: "#F5FBF5",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#CFE8D0",
    marginBottom: 6,
  },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  scheduleTitle: { fontSize: 13, fontWeight: "700", color: "#1B5E20" },
  scheduleTimePreview: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2E7D32",
    marginBottom: 10,
  },
  scheduleStageNpkText: {
    fontSize: 12,
    color: "#1B5E20",
    fontWeight: "600",
    marginBottom: 10,
  },
  dropdownGroup: { marginBottom: 10 },
  selectorLabel: {
    fontSize: 12,
    color: "#5F6368",
    marginBottom: 6,
    fontWeight: "600",
  },
  dropdownTrigger: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE8D0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownTriggerText: {
    fontSize: 14,
    color: "#2E7D32",
    fontWeight: "700",
  },
  dropdownMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#DDE7DD",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F4",
  },
  dropdownItemActive: {
    backgroundColor: "#E8F5E9",
  },
  dropdownItemText: {
    fontSize: 13,
    color: "#3C4043",
    fontWeight: "600",
  },
  dropdownItemTextActive: {
    color: "#1B5E20",
    fontWeight: "700",
  },
  applyBtn: {
    backgroundColor: "#2E7D32",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  applyBtnDisabled: {
    opacity: 0.65,
  },
  applyText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  configStatusText: {
    marginTop: -6,
    marginBottom: 16,
    textAlign: "center",
    fontSize: 12,
    color: "#1B5E20",
    fontWeight: "600",
  },

  viewAllBtn: { alignItems: "center", paddingVertical: 20 },
  viewAllText: { color: "#757575", fontWeight: "600", fontSize: 13 }
});
