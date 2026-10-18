// useStartChat — open (or create) a chat with someone and go to it.
// Used by profile "Message" buttons. Guests are sent to sign in first.

import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { useMessaging } from "@/context/MessagingContext";

export type StartChatTarget = {
  /** Business id, photographer id, or user id (match participantType). */
  participantId: string;
  participantType: "business" | "photographer" | "user";
  name: string;
  avatar?: string;
};

export function useStartChat() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { createOrGetConversation } = useMessaging();
  const [starting, setStarting] = useState(false);

  const startChat = useCallback(
    async (target: StartChatTarget) => {
      if (starting) return;
      if (!user || user.isGuest) {
        navigation.navigate("Auth", { returnTo: "messages" });
        return;
      }
      setStarting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      try {
        const conversation = await createOrGetConversation({
          participantId: target.participantId,
          participantType: target.participantType,
          participantName: target.name,
          participantAvatar: target.avatar,
        });
        if (!conversation) throw new Error("no conversation");
        navigation.navigate("Chat", {
          conversationId: conversation.id,
          participantId: conversation.participantId,
          participantName: conversation.participantName || target.name,
          participantAvatar: conversation.participantAvatar || target.avatar,
          participantType: conversation.participantType,
          businessId: conversation.businessId,
          photographerId: conversation.photographerId,
        });
      } catch {
        Alert.alert(
          "Couldn't open the chat",
          "Check your connection and try again.",
        );
      } finally {
        setStarting(false);
      }
    },
    [starting, user, navigation, createOrGetConversation],
  );

  return { startChat, starting };
}
