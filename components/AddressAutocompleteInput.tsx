import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Text,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, FontSizes } from "@/constants/theme";
import { API_BASE_URL } from "@/services/api";

export interface AddressFields {
  line1: string;
  city: string;
  state: string;
  zipCode: string;
}

interface Prediction {
  description: string;
  placeId: string;
}

export interface AddressAutocompleteInputProps {
  line1: string;
  city: string;
  state: string;
  zipCode: string;
  onChange: (fields: AddressFields) => void;
  required?: boolean;
  label?: string;
}

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

export default function AddressAutocompleteInput({
  line1,
  city,
  state,
  zipCode,
  onChange,
  required,
  label,
}: AddressAutocompleteInputProps) {
  const { theme } = useTheme();
  const { getToken } = useAuth();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Prevents re-triggering autocomplete when line1 is set programmatically
  // by a prediction selection rather than by the user typing.
  const suppressNextAutocomplete = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (suppressNextAutocomplete.current) {
      suppressNextAutocomplete.current = false;
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (line1.trim().length < MIN_CHARS) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      const token = await getToken();
      if (!token) return;

      setIsFetching(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/places/autocomplete?input=${encodeURIComponent(line1.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json() as { predictions?: Prediction[] };
        const preds = data.predictions ?? [];
        setPredictions(preds);
        setShowDropdown(preds.length > 0);
      } catch {
        // Autocomplete failure is silent — user can still type manually.
      } finally {
        setIsFetching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line1]);

  const handleSelectPrediction = async (prediction: Prediction) => {
    setShowDropdown(false);
    setPredictions([]);

    // Suppress the autocomplete effect that would fire when line1 updates.
    suppressNextAutocomplete.current = true;

    // Optimistically set the description as line1 while we fetch details.
    const streetPart = prediction.description.split(",")[0];
    onChange({ line1: streetPart, city, state, zipCode });

    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/places/details?placeId=${encodeURIComponent(prediction.placeId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const details = await res.json() as {
        line1: string;
        city: string;
        state: string;
        zipCode: string;
      };
      // Suppress again because onChange will update the line1 prop.
      suppressNextAutocomplete.current = true;
      onChange({
        line1: details.line1 || streetPart,
        city: details.city || city,
        state: details.state || state,
        zipCode: details.zipCode || zipCode,
      });
    } catch {
      // Details failure is silent — the optimistic street name stays.
    }
  };

  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
  ] as const;

  return (
    <View>
      {label ? (
        <Text style={[styles.label, { color: theme.text }]}>
          {label}
          {required ? <Text style={{ color: theme.error ?? "#cc0000" }}> *</Text> : null}
        </Text>
      ) : null}

      {/* Street address with autocomplete */}
      <View>
        <TextInput
          style={inputStyle}
          placeholder="Street address"
          placeholderTextColor={theme.textSecondary}
          value={line1}
          onChangeText={(v: string) => {
            onChange({ line1: v, city, state, zipCode });
          }}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {isFetching && (
          <ActivityIndicator
            size="small"
            color={theme.textSecondary}
            style={styles.spinner}
          />
        )}
        {showDropdown && predictions.length > 0 && (
          <View style={[styles.dropdown, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {predictions.map((p: Prediction) => (
              <Pressable
                key={p.placeId}
                onPress={() => handleSelectPrediction(p)}
                style={({ pressed }: { pressed: boolean }) => [
                  styles.predictionRow,
                  { borderBottomColor: theme.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={[styles.predictionText, { color: theme.text }]} numberOfLines={2}>
                  {p.description}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* City */}
      <TextInput
        style={inputStyle}
        placeholder="City"
        placeholderTextColor={theme.textSecondary}
        value={city}
        onChangeText={(v: string) => onChange({ line1, city: v, state, zipCode })}
        autoCapitalize="words"
      />

      {/* State + ZIP side by side */}
      <View style={styles.row}>
        <TextInput
          style={[inputStyle, styles.stateInput]}
          placeholder="State"
          placeholderTextColor={theme.textSecondary}
          value={state}
          onChangeText={(v: string) => onChange({ line1, city, state: v, zipCode })}
          autoCapitalize="characters"
          maxLength={2}
        />
        <TextInput
          style={[inputStyle, styles.zipInput]}
          placeholder="ZIP code"
          placeholderTextColor={theme.textSecondary}
          value={zipCode}
          onChangeText={(v: string) => onChange({ line1, city, state, zipCode: v })}
          keyboardType="numeric"
          maxLength={10}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  input: {
    height: 44,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    fontSize: 14,
  },
  spinner: {
    position: "absolute",
    right: Spacing.sm,
    top: 11,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.sm,
    overflow: "hidden",
    zIndex: 10,
    elevation: 4,
  },
  predictionRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  predictionText: {
    fontSize: FontSizes.sm,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  stateInput: {
    flex: 1,
  },
  zipInput: {
    flex: 2,
  },
});
