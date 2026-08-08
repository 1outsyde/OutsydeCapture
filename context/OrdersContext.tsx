import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { api } from "../services/api";

export interface OrderItem {
  name: string;
  quantity: number;
}

export interface Order {
  id: string;
  vendorId: string;
  vendorName: string;
  date: string;
  status: "processing" | "shipped" | "delivered" | "canceled";
  total: number;
  items: OrderItem[];
}

interface OrdersContextType {
  orders: Order[];
  isLoading: boolean;
  hasDeliveredOrderFrom: (vendorId: string, vendorName?: string) => boolean;
  addOrder: (order: Omit<Order, "id">) => Promise<Order>;
  refreshOrders: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

const getOrdersKey = (userId: string) => `@outsyde_orders_${userId}`;

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, getToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    // getBusinessOrders is a business-owner endpoint — calling it for
    // staff/photographer/consumer roles 404s ("Business not found").
    if (user.role !== "business") {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setOrders([]);
        return;
      }

      const response: any = await api.getBusinessOrders(token);
      const payload = Array.isArray(response)
        ? response
        : Array.isArray(response?.orders)
          ? response.orders
          : [];

      const normalizedOrders: Order[] = payload.map((order: any) => ({
        id: String(order?.id ?? ""),
        vendorId: String(order?.vendorId ?? order?.vendor?.id ?? order?.businessId ?? ""),
        vendorName: order?.vendorName ?? order?.vendor?.name ?? order?.businessName ?? "Order",
        date: order?.date ?? order?.createdAt ?? new Date().toISOString(),
        status:
          order?.status === "shipped" ||
          order?.status === "delivered" ||
          order?.status === "canceled"
            ? order.status
            : "processing",
        total:
          typeof order?.total === "number"
            ? order.total
            : typeof order?.totalAmount === "number"
              ? order.totalAmount
              : 0,
        items: Array.isArray(order?.items)
          ? order.items.map((item: any) => ({
              name: item?.name ?? "Item",
              quantity: Number(item?.quantity) || 1,
            }))
          : [],
      }));

      setOrders(normalizedOrders);
      await AsyncStorage.setItem(getOrdersKey(user.id), JSON.stringify(normalizedOrders));
    } catch (err) {
      console.error("Failed to load orders:", err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isAuthenticated, user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const refreshOrders = async () => {
    await loadOrders();
  };

  const hasDeliveredOrderFrom = useCallback((vendorId: string, vendorName?: string): boolean => {
    return orders.some((order) => {
      if (order.status !== "delivered") return false;
      if (order.vendorId === vendorId) return true;
      if (vendorName && order.vendorName.toLowerCase().includes(vendorName.toLowerCase())) return true;
      return false;
    });
  }, [orders]);

  const addOrder = async (orderData: Omit<Order, "id">): Promise<Order> => {
    if (!user) throw new Error("Must be logged in to place orders");

    const newOrder: Order = {
      ...orderData,
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    const updatedOrders = [newOrder, ...orders];
    setOrders(updatedOrders);

    try {
      await AsyncStorage.setItem(getOrdersKey(user.id), JSON.stringify(updatedOrders));
    } catch (err) {
      console.error("Failed to save order:", err);
    }

    return newOrder;
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
        isLoading,
        hasDeliveredOrderFrom,
        addOrder,
        refreshOrders,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider");
  }
  return context;
}
