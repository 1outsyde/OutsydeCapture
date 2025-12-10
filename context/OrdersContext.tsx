import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

export interface OrderItem {
  name: string;
  quantity: number;
}

export interface Order {
  id: string;
  vendorId: string;
  vendorName: string;
  date: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
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

const MOCK_ORDERS: Order[] = [
  {
    id: "order1",
    vendorId: "v4",
    vendorName: "FrameArt Gallery",
    date: "2025-01-08",
    status: "shipped",
    total: 134.99,
    items: [{ name: "Canvas Print 24x36", quantity: 1 }, { name: "Oak Wood Frame", quantity: 2 }],
  },
  {
    id: "order2",
    vendorId: "v5",
    vendorName: "PhotoGear Pro",
    date: "2025-01-05",
    status: "processing",
    total: 79.99,
    items: [{ name: "LED Ring Light 18\"", quantity: 1 }],
  },
  {
    id: "order3",
    vendorId: "p1",
    vendorName: "Sarah Mitchell Photography",
    date: "2025-01-03",
    status: "delivered",
    total: 67.50,
    items: [{ name: "Portrait Session Photos - Digital", quantity: 1 }],
  },
  {
    id: "order4",
    vendorId: "p2",
    vendorName: "James Chen Photography",
    date: "2024-12-28",
    status: "delivered",
    total: 225.00,
    items: [{ name: "Wedding Album Deluxe", quantity: 1 }],
  },
  {
    id: "order5",
    vendorId: "v3",
    vendorName: "LensCraft Gear",
    date: "2024-12-20",
    status: "delivered",
    total: 45.00,
    items: [{ name: "Pro Camera Strap", quantity: 1 }],
  },
  {
    id: "order6",
    vendorId: "v1",
    vendorName: "PrintMaster Studio",
    date: "2024-12-15",
    status: "delivered",
    total: 149.99,
    items: [{ name: "Gallery Canvas Print 24x36", quantity: 1 }],
  },
  {
    id: "order7",
    vendorId: "v2",
    vendorName: "MemoryBook Co",
    date: "2024-12-10",
    status: "delivered",
    total: 89.99,
    items: [{ name: "Leather Photo Album - 50 Pages", quantity: 1 }],
  },
];

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const stored = await AsyncStorage.getItem(getOrdersKey(user.id));
      if (stored) {
        setOrders(JSON.parse(stored));
      } else {
        setOrders(MOCK_ORDERS);
        await AsyncStorage.setItem(getOrdersKey(user.id), JSON.stringify(MOCK_ORDERS));
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
      setOrders(MOCK_ORDERS);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

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
