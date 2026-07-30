import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";

const BADGE_GOLD = '#C9933A';
const BADGE_BLUE = '#4A90E2';

interface RoleBadgeProps {
  role: 'photographer' | 'crew' | 'vendor' | 'business' | 'user' | 'consumer';
  subscriptionTier?: 'starter' | 'growth' | 'pro' | string | null;
  size?: 'large' | 'medium' | 'small' | 'pill';
}

export default function RoleBadge({ role, subscriptionTier, size = 'pill' }: RoleBadgeProps) {
  if (role === 'consumer' || role === 'user') return null;

  const isPhotographer = role === 'photographer' || role === 'crew';
  const isVendor = role === 'vendor' || role === 'business';
  const isVerifiedVendor = isVendor && (subscriptionTier === 'growth' || subscriptionTier === 'pro');

  const icon: keyof typeof Feather.glyphMap = isPhotographer ? 'camera' : 'briefcase';
  const color = BADGE_GOLD;
  const label = isPhotographer ? 'Outsyde Crew' : isVerifiedVendor ? 'Verified Business' : 'Business';

  if (size === 'pill') {
    return (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: 'transparent',
      }}>
        <View style={{ position: 'relative' }}>
          <Feather name={icon} size={13} color={color} />
          {isVerifiedVendor && (
            <View style={{ position: 'absolute', bottom: -2, right: -3 }}>
              <Feather name="check" size={10} color={color} />
            </View>
          )}
        </View>
        <ThemedText style={{ fontSize: 11, color, fontWeight: '600' }}>{label}</ThemedText>
      </View>
    );
  }

  const sizeConfig = {
    small:  { diameter: 26, borderRadius: 13, borderWidth: 1,   iconSize: 12 },
    medium: { diameter: 42, borderRadius: 21, borderWidth: 1.5, iconSize: 18 },
    large:  { diameter: 68, borderRadius: 34, borderWidth: 2,   iconSize: 28 },
  }[size as 'small' | 'medium' | 'large'];

  return (
    <View style={{
      width: sizeConfig.diameter,
      height: sizeConfig.diameter,
      borderRadius: sizeConfig.borderRadius,
      borderWidth: sizeConfig.borderWidth,
      borderColor: color,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Feather name={icon} size={sizeConfig.iconSize} color={color} />
    </View>
  );
}
