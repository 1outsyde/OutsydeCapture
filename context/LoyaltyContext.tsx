import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const STORAGE_KEY_PREFIX = "@outsyde_loyalty_";

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getStorageKey = () => {
    if (!user) return null;
    return `${STORAGE_KEY_PREFIX}${user.id}`;
  };

  useEffect(() => {
    loadLoyaltyData();
  }, [user]);

  const loadLoyaltyData = async () => {
    const key = getStorageKey();
    if (!key) {
      setPoints(0);
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const storedData = await AsyncStorage.getItem(key);
      if (storedData) {
        const data = JSON.parse(storedData);
        setPoints(data.points || 0);
        setTransactions(data.transactions || []);
      } else {
        const initialPoints = 250;
        const initialTransactions: PointsTransaction[] = [
          {
            id: "welcome_bonus",
            type: "earned",
            amount: 250,
            description: "Welcome bonus",
            date: new Date().toISOString(),
          },
        ];
        await saveLoyaltyData(initialPoints, initialTransactions);
        setPoints(initialPoints);
        setTransactions(initialTransactions);
      }
    } catch (error) {
      console.error("Failed to load loyalty data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLoyaltyData = async (newPoints: number, newTransactions: PointsTransaction[]) => {
    const key = getStorageKey();
    if (!key) return;

    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({
          points: newPoints,
          transactions: newTransactions,
        })
      );
    } catch (error) {
      console.error("Failed to save loyalty data:", error);
    }
  };

  const addPoints = async (amount: number, description: string) => {
    const newTransaction: PointsTransaction = {
      id: `earn_${Date.now()}`,
      type: "earned",
      amount,
      description,
      date: new Date().toISOString(),
    };
    const newPoints = points + amount;
    const newTransactions = [newTransaction, ...transactions];
    
    setPoints(newPoints);
    setTransactions(newTransactions);
    await saveLoyaltyData(newPoints, newTransactions);
  };

  const redeemPoints = async (amount: number, description: string): Promise<boolean> => {
    if (amount > points) {
      return false;
    }

    const newTransaction: PointsTransaction = {
      id: `redeem_${Date.now()}`,
      type: "redeemed",
      amount,
      description,
      date: new Date().toISOString(),
    };
    const newPoints = points - amount;
    const newTransactions = [newTransaction, ...transactions];
    
    setPoints(newPoints);
    setTransactions(newTransactions);
    await saveLoyaltyData(newPoints, newTransactions);
    return true;
  };

  const refreshPoints = async () => {
    await loadLoyaltyData();
  };

  return (
    <LoyaltyContext.Provider
      value={{
        points,
        transactions,
        isLoading,
        addPoints,
        redeemPoints,
        refreshPoints,
      }}
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
