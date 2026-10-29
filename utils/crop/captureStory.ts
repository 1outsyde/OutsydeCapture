/**
 * Web stand-in for captureStory.native.ts (photo ratios 2e). view-shot needs html2canvas-pro on
 * web, which the app doesn't ship, so a zoomed out story can't be flattened here. The editor shows
 * its normal "couldn't be saved" message; zoomed in stories are cropped without this.
 */
import type { ComponentRef, RefObject } from "react";
import type { View } from "react-native";

export async function captureStoryView(
  _view: RefObject<ComponentRef<typeof View> | null>,
): Promise<string> {
  throw new Error("Zoomed out stories can only be saved on a phone.");
}
