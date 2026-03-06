// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

type UserProfile = {
  uid: string;
  fullName: string;
  email: string;
  address: string;
  contactNumber: string;
    photoURL?: string;
};

type SignUpInput = {
  fullName: string;
  email: string;
  password: string;
  address: string;
  contactNumber: string;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isLoggedIn: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserProfile, "fullName" | "address" | "contactNumber" | "photoURL">>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function friendlyAuthError(code?: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-not-found":
      return "No account found for this email.";
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/weak-password":
      return "Password is too weak.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setIsLoading(true);
      setUser(u);

      if (!u) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      } finally {
        setIsLoading(false);
      }
    });

    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (e: any) {
      throw new Error(friendlyAuthError(e?.code));
    }
  };

  // ✅ Signup creates account + profile and keeps user logged in
  const signUp = async (input: SignUpInput) => {
    const email = input.email.trim().toLowerCase();

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, input.password);

      const userRef = doc(db, "users", cred.user.uid);
      const data: UserProfile = {
        uid: cred.user.uid,
        fullName: input.fullName.trim(),
        email,
        address: input.address.trim(),
        contactNumber: input.contactNumber.trim(),
      };

      await setDoc(userRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // ✅ set local profile immediately
      setProfile(data);

      // ❌ do NOT sign out here
      // await signOut(auth);
    } catch (e: any) {
      throw new Error(friendlyAuthError(e?.code));
    }
  };

  // ✅ ADD THIS (this is what you were missing)
  const logout = async () => {
    await signOut(auth);
  };

  const updateProfile = async (
    patch: Partial<Pick<UserProfile, "fullName" | "address" | "contactNumber" | "photoURL">>
  ) => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { ...patch, updatedAt: serverTimestamp() });
    setProfile((p) => (p ? { ...p, ...patch } : p));
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      isLoading,
      isLoggedIn: !!user,
      signIn,
      signUp,
      logout,
      updateProfile,
    }),
    [user, profile, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};