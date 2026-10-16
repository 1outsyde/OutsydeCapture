/**
 * Android replacement for long Alert.alert / ActionSheetIOS menus.
 *
 * Android's native alert shows at most 3 buttons, so menus with more options lose
 * choices (and Cancel). Call showChoiceSheet() from anywhere; <ChoiceSheetHost />
 * (mounted once in App.tsx, Android only) renders it as a bottom sheet.
 * iOS callers keep using ActionSheetIOS / Alert.prompt and never call this.
 */
export type ChoiceSheetOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export type ChoiceSheetConfig = {
  title: string;
  message?: string;
  options: ChoiceSheetOption[];
  cancelLabel?: string;
};

type Listener = (config: ChoiceSheetConfig | null) => void;

let listener: Listener | null = null;

export function setChoiceSheetListener(next: Listener | null): void {
  listener = next;
}

/** Returns false if no host is mounted (caller can fall back). */
export function showChoiceSheet(config: ChoiceSheetConfig): boolean {
  if (!listener) return false;
  listener(config);
  return true;
}
