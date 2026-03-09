import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { initializeFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// ✅ runtime imports (avoid TS export issues)
const { initializeAuth, getReactNativePersistence } = require("firebase/auth");

const firebaseConfig = {
  apiKey: "AIzaSyA7mJ-uud7w7DDM94LGA4z-G8HJa2Q2qFA",
  authDomain: "polycrop.firebaseapp.com",
  projectId: "polycrop",
  storageBucket: "polycrop.firebasestorage.app",
  messagingSenderId: "777956730981",
  appId: "1:777956730981:web:ed0a6e4f2d3b2d00d1fe8c",
   // ✅ add this (RTDB URL from console)
  databaseURL: "https://polycrop-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// ✅ For profile photo uploads
export const storage = getStorage(app);

// ✅ RTDB
export const rtdb = getDatabase(app);