import { NavigatorScreenParams } from "@react-navigation/native";
import { Photographer, PhotographyCategory } from "@/types";

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  Auth: { returnTo?: string };
  SelectPhotographer: undefined;
  PhotographerDetail: { photographer: Photographer };
  Booking: { photographer: Photographer };
  SessionDetail: { sessionId: string };
  PhotoGallery: { sessionId: string; initialIndex?: number };
  Conversation: { conversationId: string };
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
};

export type BookingStackParamList = {
  SelectDate: { photographer: Photographer };
  SelectTime: { photographer: Photographer; date: string };
  BookingDetails: { photographer: Photographer; date: string; timeSlotId: string; startTime: string; endTime: string };
  ReviewConfirm: { photographer: Photographer; date: string; timeSlotId: string; startTime: string; endTime: string; location: string; sessionType: PhotographyCategory; notes: string };
};
