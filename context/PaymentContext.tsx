import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";

const getPaymentMethodsKey = (userId: string) => `@outsyde_payment_methods_${userId}`;
const getTransactionsKey = (userId: string) => `@outsyde_transactions_${userId}`;

export interface PaymentMethod {
  id: string;
  type: "card" | "apple_pay" | "google_pay";
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface Transaction {
  id: string;
  sessionId: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  paymentMethodId: string;
  createdAt: string;
  description: string;
}

interface PaymentContextType {
  paymentMethods: PaymentMethod[];
  transactions: Transaction[];
  isLoading: boolean;
  addPaymentMethod: (method: Omit<PaymentMethod, "id">) => Promise<PaymentMethod>;
  removePaymentMethod: (methodId: string) => Promise<void>;
  setDefaultPaymentMethod: (methodId: string) => Promise<void>;
  processPayment: (
    sessionId: string,
    amount: number,
    description: string
  ) => Promise<Transaction>;
  getDefaultPaymentMethod: () => PaymentMethod | undefined;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

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
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const [methodsData, transactionsData] = await Promise.all([
        AsyncStorage.getItem(getPaymentMethodsKey(user.id)),
        AsyncStorage.getItem(getTransactionsKey(user.id)),
      ]);

      if (methodsData) {
        setPaymentMethods(JSON.parse(methodsData));
      }
      if (transactionsData) {
        setTransactions(JSON.parse(transactionsData));
      }
    } catch (error) {
      console.error("Failed to load payment data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePaymentMethods = async (methods: PaymentMethod[]) => {
    if (!user?.id) return;
    await AsyncStorage.setItem(getPaymentMethodsKey(user.id), JSON.stringify(methods));
    setPaymentMethods(methods);
  };

  const saveTransactions = async (txns: Transaction[]) => {
    if (!user?.id) return;
    await AsyncStorage.setItem(getTransactionsKey(user.id), JSON.stringify(txns));
    setTransactions(txns);
  };

  const addPaymentMethod = async (
    method: Omit<PaymentMethod, "id">
  ): Promise<PaymentMethod> => {
    const newMethod: PaymentMethod = {
      ...method,
      id: `pm_${Date.now()}`,
      isDefault: paymentMethods.length === 0 ? true : method.isDefault,
    };

    let updatedMethods = [...paymentMethods];
    
    if (newMethod.isDefault) {
      updatedMethods = updatedMethods.map((m) => ({ ...m, isDefault: false }));
    }
    
    updatedMethods.push(newMethod);
    await savePaymentMethods(updatedMethods);
    return newMethod;
  };

  const removePaymentMethod = async (methodId: string) => {
    const methodToRemove = paymentMethods.find((m) => m.id === methodId);
    let updatedMethods = paymentMethods.filter((m) => m.id !== methodId);
    
    if (methodToRemove?.isDefault && updatedMethods.length > 0) {
      updatedMethods[0].isDefault = true;
    }
    
    await savePaymentMethods(updatedMethods);
  };

  const setDefaultPaymentMethod = async (methodId: string) => {
    const updatedMethods = paymentMethods.map((m) => ({
      ...m,
      isDefault: m.id === methodId,
    }));
    await savePaymentMethods(updatedMethods);
  };

  const getDefaultPaymentMethod = (): PaymentMethod | undefined => {
    return paymentMethods.find((m) => m.isDefault);
  };

  const processPayment = async (
    sessionId: string,
    amount: number,
    description: string
  ): Promise<Transaction> => {
    const defaultMethod = getDefaultPaymentMethod();
    
    if (!defaultMethod) {
      throw new Error("No payment method available");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const success = Math.random() > 0.05;

    const transaction: Transaction = {
      id: `txn_${Date.now()}`,
      sessionId,
      amount,
      currency: "USD",
      status: success ? "completed" : "failed",
      paymentMethodId: defaultMethod.id,
      createdAt: new Date().toISOString(),
      description,
    };

    const updatedTransactions = [transaction, ...transactions];
    await saveTransactions(updatedTransactions);

    if (!success) {
      throw new Error("Payment failed. Please try again.");
    }

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
        getDefaultPaymentMethod,
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
