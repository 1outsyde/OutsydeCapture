import { NavigatorScreenParams } from "@react-navigation/native";
import { Photographer, PhotographyCategory } from "@/context/DataContext";

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  Auth: { returnTo?: string };
  SelectPhotographer: undefined;
  PhotographerDetail: { photographer: Photographer };
  Booking: { photographer: Photographer };
  VendorDetail: { vendorId: string };
  SessionDetail: { sessionId: string };
  PhotoGallery: { sessionId: string; initialIndex?: number };
  Conversation: { conversationId: string };
  CartOrders: undefined;
  Payment: {
    sessionId: string;
    amount: number;
    photographerName: string;
    sessionDate: string;
  };
};

export type MainTabParamList = {
  DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;
  SearchTab: undefined;
  SessionsTab: undefined;
  MessagesTab: undefined;
  AccountTab: NavigatorScreenParams<AccountStackParamList>;
};

export type DiscoverStackParamList = {
  Discover: undefined;
};

export type AccountStackParamList = {
  Account: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Notifications: undefined;
};

export type BookingStackParamList = {
  SelectDate: { photographer: Photographer };
  SelectTime: { photographer: Photographer; date: string };
  BookingDetails: {
    photographer: Photographer;
    date: string;
    timeSlotId: string;
    startTime: string;
    endTime: string;
  };
  ReviewConfirm: {
    photographer: Photographer;
    date: string;
    timeSlotId: string;
    startTime: string;
    endTime: string;
    location: string;
    sessionType: PhotographyCategory;
    notes: string;
  };
};
