import { StyleSheet } from "react-native";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";

export default function DetailScreen() {
  return (
    <ScreenScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedText type="body">Your detail screen</ThemedText>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
