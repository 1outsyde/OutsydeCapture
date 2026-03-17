import React, { useState, useEffect, useRef } from "react";
import { View, TextInput, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import api from "@/services/api";

const GOLD = "#C9933A";
const GREEN = "#3A9E3A";
const RED = "#E05252";

type AvailabilityState = "idle" | "checking" | "available" | "taken";

interface UsernameFieldProps {
  value: string;
  onChange: (value: string) => void;
  onAvailabilityChange: (available: boolean | null) => void;
  externalError?: string | null;
  inputBaseStyle: object;
  theme: {
    text: string;
    textSecondary: string;
    border: string;
    backgroundDefault: string;
  };
}

export default function UsernameField({
  value,
  onChange,
  onAvailabilityChange,
  externalError,
  inputBaseStyle,
  theme,
}: UsernameFieldProps) {
  const [focused, setFocused] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityState>("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleChange = (text: string) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    onChange(clean);
    setAvailability("idle");
    onAvailabilityChange(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (clean.length < 3) return;

    debounceTimer.current = setTimeout(async () => {
      setAvailability("checking");
      try {
        const result = await api.checkUsernameAvailable(clean);
        setAvailability(result.available ? "available" : "taken");
        onAvailabilityChange(result.available);
      } catch {
        setAvailability("idle");
        onAvailabilityChange(null);
      }
    }, 600);
  };

  const borderColor =
    externalError
      ? RED
      : availability === "available"
      ? GREEN
      : availability === "taken"
      ? RED
      : focused
      ? GOLD
      : theme.border;

  return (
    <View>
      <View
        style={[
          inputBaseStyle,
          styles.row,
          { borderColor },
        ]}
      >
        <Text style={[styles.prefix, { color: GOLD }]}>@</Text>
        <TextInput
          style={[styles.textInput, { color: theme.text, backgroundColor: "transparent" }]}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="yourusername"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          maxLength={20}
        />
      </View>

      {externalError ? (
        <View style={styles.statusRow}>
          <Feather name="x" size={12} color={RED} />
          <Text style={[styles.statusText, { color: RED }]}>{externalError}</Text>
        </View>
      ) : availability === "checking" ? (
        <Text style={[styles.statusText, { color: theme.textSecondary, marginTop: 4 }]}>
          Checking availability...
        </Text>
      ) : availability === "available" ? (
        <View style={styles.statusRow}>
          <Feather name="check" size={12} color={GREEN} />
          <Text style={[styles.statusText, { color: GREEN }]}>@{value} is available</Text>
        </View>
      ) : availability === "taken" ? (
        <View style={styles.statusRow}>
          <Feather name="x" size={12} color={RED} />
          <Text style={[styles.statusText, { color: RED }]}>@{value} is already taken</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  prefix: {
    fontSize: 16,
    fontWeight: "600",
    paddingRight: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    marginLeft: 4,
  },
});
