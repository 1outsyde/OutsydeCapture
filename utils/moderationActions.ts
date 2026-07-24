import { Alert, Platform, ActionSheetIOS } from "react-native";
import { api } from "../services/api";

export type ModerationTarget =
  | { type: "post"; postId: string; authorId: string; authorName: string }
  | { type: "user"; userId: string; userName: string }
  | { type: "message"; messageId: string; senderId: string; senderName: string };

/**
 * Prompt the user for a free-text report reason.
 * On iOS uses Alert.prompt; on Android falls back to a fixed choice sheet.
 * Returns the reason string, or null if the user cancelled.
 */
export function promptForReportReason(
  onSubmit: (reason: string) => void
): void {
  if (Platform.OS === "ios") {
    Alert.prompt(
      "Report",
      "Why are you reporting this content?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: (value?: string) => {
            const reason = (value || "").trim();
            if (reason) onSubmit(reason);
          },
        },
      ],
      "plain-text"
    );
  } else {
    const choices = [
      "Spam",
      "Nudity or sexual content",
      "Harassment or bullying",
      "Violence or dangerous acts",
      "Hate speech",
      "Misinformation",
      "Other",
    ];
    Alert.alert("Report", "Why are you reporting this content?", [
      ...choices.map((label) => ({
        text: label,
        onPress: () => onSubmit(label),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  }
}

/**
 * Show a confirmation dialog before blocking a user, then call the API.
 * Returns true if the block succeeded, false otherwise.
 */
export async function confirmBlockUser(
  authToken: string,
  userId: string,
  userName: string
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      `Block ${userName}?`,
      `${userName} won't be able to see your content, and you won't see theirs.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await api.blockUser(authToken, userId);
              resolve(true);
            } catch {
              Alert.alert("Error", "Could not block user. Please try again.");
              resolve(false);
            }
          },
        },
      ]
    );
  });
}

/**
 * Show the Report / Block action sheet for a given target.
 * Handles the full flow: confirm block → API call, or reason prompt → report API call.
 * Pass onBlocked to update local state after a successful block.
 */
export function showReportBlockMenu(params: {
  authToken: string;
  currentUserId: string;
  target: ModerationTarget;
  onBlocked?: (blockedUserId: string) => void;
}): void {
  const { authToken, currentUserId, target, onBlocked } = params;

  // Don't show for own content
  const targetUserId =
    target.type === "post"
      ? target.authorId
      : target.type === "user"
      ? target.userId
      : target.senderId;
  if (targetUserId === currentUserId) return;

  const targetName =
    target.type === "post"
      ? target.authorName
      : target.type === "user"
      ? target.userName
      : target.senderName;

  const handleReport = () => {
    promptForReportReason(async (reason) => {
      try {
        if (target.type === "post") {
          await api.reportPost(authToken, target.postId, reason);
        } else if (target.type === "user") {
          await api.reportUser(authToken, target.userId, reason);
        } else {
          await api.reportMessage(authToken, target.messageId, reason);
        }
        Alert.alert("Reported", "Thank you for your report. We'll review it shortly.");
      } catch {
        Alert.alert("Error", "Could not submit report. Please try again.");
      }
    });
  };

  const handleBlock = async () => {
    const blocked = await confirmBlockUser(authToken, targetUserId, targetName);
    if (blocked) {
      onBlocked?.(targetUserId);
      Alert.alert("Blocked", `You have blocked ${targetName}.`);
    }
  };

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [`Report ${targetName}`, `Block ${targetName}`, "Cancel"],
        cancelButtonIndex: 2,
        destructiveButtonIndex: 1,
      },
      (index: number) => {
        if (index === 0) handleReport();
        else if (index === 1) handleBlock();
      }
    );
  } else {
    Alert.alert(
      "More options",
      undefined,
      [
        { text: `Report ${targetName}`, onPress: handleReport },
        {
          text: `Block ${targetName}`,
          style: "destructive",
          onPress: handleBlock,
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }
}
