import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

export interface PaymentMethod {
  id: string;
  type: "card";
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  status: "completed" | "pending" | "failed";
  paymentMethodId: string;
}

interface PaymentContextType {
  paymentMethods: PaymentMethod[];
  transactions: Transaction[];
  isLoading: boolean;
  addPaymentMethod: (method: Omit<PaymentMethod, "id">) => Promise<void>;
  removePaymentMethod: (id: string) => Promise<void>;
  setDefaultPaymentMethod: (id: string) => Promise<void>;
  processPayment: (amount: number, description: string) => Promise<Transaction>;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

const getPaymentMethodsKey = (userId: string) => `@outsyde_payment_methods_${userId}`;
const getTransactionsKey = (userId: string) => `@outsyde_transactions_${userId}`;

export function PaymentProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadPaymentData();
    } else {
      setPaymentMethods([]);
      setTransactions([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadPaymentData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [storedMethods, storedTransactions] = await Promise.all([
        AsyncStorage.getItem(getPaymentMethodsKey(user.id)),
        AsyncStorage.getItem(getTransactionsKey(user.id)),
      ]);
      if (storedMethods) setPaymentMethods(JSON.parse(storedMethods));
      if (storedTransactions) setTransactions(JSON.parse(storedTransactions));
    } catch (err) {
      console.error("Failed to load payment data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addPaymentMethod = async (method: Omit<PaymentMethod, "id">) => {
    if (!user) return;
    const newMethod: PaymentMethod = {
      ...method,
      id: "pm_" + Date.now(),
      isDefault: paymentMethods.length === 0,
    };
    const updated = [...paymentMethods, newMethod];
    await AsyncStorage.setItem(getPaymentMethodsKey(user.id), JSON.stringify(updated));
    setPaymentMethods(updated);
  };

  const removePaymentMethod = async (id: string) => {
    if (!user) return;
    const updated = paymentMethods.filter((m) => m.id !== id);
    if (updated.length > 0 && !updated.some((m) => m.isDefault)) {
      updated[0].isDefault = true;
    }
    await AsyncStorage.setItem(getPaymentMethodsKey(user.id), JSON.stringify(updated));
    setPaymentMethods(updated);
  };

  const setDefaultPaymentMethod = async (id: string) => {
    if (!user) return;
    const updated = paymentMethods.map((m) => ({
      ...m,
      isDefault: m.id === id,
    }));
    await AsyncStorage.setItem(getPaymentMethodsKey(user.id), JSON.stringify(updated));
    setPaymentMethods(updated);
  };

  const processPayment = async (amount: number, description: string): Promise<Transaction> => {
    if (!user) throw new Error("Must be logged in to process payments");
    const defaultMethod = paymentMethods.find((m) => m.isDefault);
    if (!defaultMethod) throw new Error("No payment method available");

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const transaction: Transaction = {
      id: "tx_" + Date.now(),
      amount,
      description,
      date: new Date().toISOString(),
      status: "completed",
      paymentMethodId: defaultMethod.id,
    };

    const updated = [transaction, ...transactions];
    await AsyncStorage.setItem(getTransactionsKey(user.id), JSON.stringify(updated));
    setTransactions(updated);
    return transaction;
  };

  return (
    <PaymentContext.Provider
      value={{
        paymentMethods,
        transactions,
        isLoading,
        addPaymentMethod,
        removePaymentMethod,
        setDefaultPaymentMethod,
        processPayment,
      }}
    >
      {children}
    </PaymentContext.Provider>
  );
}

export function usePayment() {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error("usePayment must be used within a PaymentProvider");
  }
  return context;
}
