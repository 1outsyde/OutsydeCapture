import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getAccessToken } from "@/utils/tokenStorage";
import { BASE_URL } from "@/constants/config";
import { useAuth } from "@/context/AuthContext";

export interface PointsTransaction {
  id: string;
  type: "earned" | "redeemed";
  amount: number;
  description: string;
  date: string;
}

interface LoyaltyContextType {
  points: number;
  transactions: PointsTransaction[];
  isLoading: boolean;
  addPoints: (amount: number, description: string) => Promise<void>;
  redeemPoints: (amount: number, description: string) => Promise<boolean>;
  refreshPoints: () => Promise<void>;
}

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

// Map backend transaction types to the UI's "earned" | "redeemed" display type.
// Backend types: 'earn' | 'redeem' | 'reversal'
function toDisplayType(backendType: string): "earned" | "redeemed" {
  return backendType === "earn" ? "earned" : "redeemed";
}

async function fetchWithAuth(path: string): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFromBackend = useCallback(async () => {
    if (!user) {
      setPoints(0);
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [balRes, histRes] = await Promise.all([
        fetchWithAuth("/api/points/balance"),
        fetchWithAuth("/api/points/history"),
      ]);

      if (balRes.ok) {
        const balData = await balRes.json();
        setPoints(balData.balance ?? 0);
      }

      if (histRes.ok) {
        const histData = await histRes.json();
        const raw: any[] = histData.transactions || histData || [];
        const mapped: PointsTransaction[] = raw.map((tx) => ({
          id: String(tx.id),
          type: toDisplayType(tx.type),
          // points field is negative for reversals; store absolute value for display
          amount: Math.abs(tx.points ?? 0),
          description: tx.description || tx.type,
          date: tx.createdAt || new Date().toISOString(),
        }));
        setTransactions(mapped);
      }
    } catch (error) {
      console.error("[Loyalty] Failed to load from backend:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFromBackend();
  }, [loadFromBackend]);

  // Optimistic local add — a subsequent refreshPoints() will sync with server truth.
  const addPoints = async (amount: number, description: string) => {
    const newTransaction: PointsTransaction = {
      id: `earn_${Date.now()}`,
      type: "earned",
      amount,
      description,
      date: new Date().toISOString(),
    };
    setPoints((prev: number) => prev + amount);
    setTransactions((prev: PointsTransaction[]) => [newTransaction, ...prev]);
  };

  // Optimistic local redeem — a subsequent refreshPoints() will sync with server truth.
  const redeemPoints = async (amount: number, description: string): Promise<boolean> => {
    if (amount > points) return false;
    const newTransaction: PointsTransaction = {
      id: `redeem_${Date.now()}`,
      type: "redeemed",
      amount,
      description,
      date: new Date().toISOString(),
    };
    setPoints((prev: number) => prev - amount);
    setTransactions((prev: PointsTransaction[]) => [newTransaction, ...prev]);
    return true;
  };

  const refreshPoints = useCallback(async () => {
    await loadFromBackend();
  }, [loadFromBackend]);

  return (
    <LoyaltyContext.Provider
      value={{ points, transactions, isLoading, addPoints, redeemPoints, refreshPoints }}
    >
      {children}
    </LoyaltyContext.Provider>
  );
}

export function useLoyalty() {
  const context = useContext(LoyaltyContext);
  if (context === undefined) {
    throw new Error("useLoyalty must be used within a LoyaltyProvider");
  }
  return context;
}
