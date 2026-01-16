import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api, { HealthCheckResponse, ApiError } from "@/services/api";

interface HealthCheckState {
  isLoading: boolean;
  data: HealthCheckResponse | null;
  error: string | null;
  refetch: () => Promise<void>;
}

const HealthCheckContext = createContext<HealthCheckState | undefined>(undefined);

interface HealthCheckProviderProps {
  children: ReactNode;
}

export function HealthCheckProvider({ children }: HealthCheckProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<HealthCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthCheck = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.healthCheck();
      setData(response);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to connect to backend");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthCheck();
  }, []);

  return (
    <HealthCheckContext.Provider
      value={{
        isLoading,
        data,
        error,
        refetch: fetchHealthCheck,
      }}
    >
      {children}
    </HealthCheckContext.Provider>
  );
}

export function useHealthCheck(): HealthCheckState {
  const context = useContext(HealthCheckContext);
  if (context === undefined) {
    throw new Error("useHealthCheck must be used within a HealthCheckProvider");
  }
  return context;
}
