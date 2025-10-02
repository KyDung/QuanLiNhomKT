"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { db } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { User } from "./init-users";

interface AuthContextType {
  currentUser: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUserProfile: (
    displayName: string,
    password?: string
  ) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in from localStorage
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      loadUser(storedUserId);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async (userId: string) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        setCurrentUser({ 
          ...userData,
          id: userSnap.id, 
          balance: userData.balance || 0 // Đảm bảo balance luôn có giá trị
        } as User);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    try {
      const userRef = doc(db, "users", username);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        if (userData.password === password) {
          setCurrentUser({ 
            ...userData, 
            id: userSnap.id,
            balance: userData.balance || 0 // Đảm bảo balance luôn có giá trị
          });
          localStorage.setItem("userId", userSnap.id);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("userId");
  };

  const updateUserProfile = async (
    displayName: string,
    password?: string
  ): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      const userRef = doc(db, "users", currentUser.id);
      const updateData: any = { displayName };

      if (password) {
        updateData.password = password;
      }

      await updateDoc(userRef, updateData);

      setCurrentUser({
        ...currentUser,
        displayName,
        ...(password && { password }),
      });

      return true;
    } catch (error) {
      console.error("Error updating profile:", error);
      return false;
    }
  };

  const refreshUser = async () => {
    if (currentUser) {
      await loadUser(currentUser.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Đang tải...
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ currentUser, login, logout, updateUserProfile, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
