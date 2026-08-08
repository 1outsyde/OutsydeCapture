import React, { createContext, useContext, useState, ReactNode } from "react";

interface PaymentContextType {
  lastTransaction: {
    paymentIntentId: string;
    amountCents: number;
    pointsEarned: number;
    status: "succeeded" | "failed" | "canceled";
    timestamp: string;
  } | null;
  recordTransaction: (tx: {
    paymentIntentId: string;
    amountCents: number;
    pointsEarned: number;
    status: "succeeded" | "failed" | "canceled";
  }) => void;
  clearLastTransaction: () => void;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [lastTransaction, setLastTransaction] =
    useState<PaymentContextType["lastTransaction"]>(null);

  const recordTransaction: PaymentContextType["recordTransaction"] = (tx) => {
    setLastTransaction({
      ...tx,
      timestamp: new Date().toISOString(),
    });
  };

  const clearLastTransaction = () => {
    setLastTransaction(null);
  };

  return (
    <PaymentContext.Provider
      value={{
        lastTransaction,
        recordTransaction,
        clearLastTransaction,
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
