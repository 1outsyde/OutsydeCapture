// Message push helpers (backend #321 sends data.type "new_message" with conversationId).
//
// - The chat that is open right now is tracked here so a push for it isn't shown as a banner
//   (the message appears in the chat instead) and isn't added to the Activity list.
// - Listeners (MessagingContext, an open ChatScreen) subscribe to refresh when a message push arrives.

/** AsyncStorage key for the Expo token this phone last registered (cleared from the account on sign out). */
export const EXPO_PUSH_TOKEN_KEY = "@outsyde_expo_push_token";

type PushData = { type?: unknown; conversationId?: unknown } | null | undefined;

let activeConversationId: string | null = null;
const listeners = new Set<(conversationId: string | null) => void>();

export function setActiveConversation(conversationId: string | null) {
  activeConversationId = conversationId;
}

export function getActiveConversation(): string | null {
  return activeConversationId;
}

export function isMessagePush(data: PushData): boolean {
  return !!data && data.type === "new_message";
}

export function messagePushConversationId(data: PushData): string | null {
  if (!isMessagePush(data)) return null;
  const id = (data as any).conversationId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** True when a push is for the chat the person is looking at. */
export function isPushForOpenChat(data: PushData): boolean {
  const id = messagePushConversationId(data);
  return !!id && id === activeConversationId;
}

export function onMessagePush(
  listener: (conversationId: string | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitMessagePush(data: PushData) {
  if (!isMessagePush(data)) return;
  const id = messagePushConversationId(data);
  listeners.forEach((l) => {
    try {
      l(id);
    } catch {}
  });
}
