import React from "react";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Card } from "@/components/Card";
import { ScreenFlatList } from "@/components/ScreenFlatList";
import Spacer from "@/components/Spacer";
import { Spacing } from "@/constants/theme";

type HomeStackParamList = {
  Home: undefined;
  Detail: undefined;
};

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<HomeStackParamList, "Home">;
};

interface CardData {
  id: string;
  elevation: number;
}

const CARD_DATA: CardData[] = [
  { id: "1", elevation: 1 },
  { id: "2", elevation: 2 },
  { id: "3", elevation: 3 },
  { id: "4", elevation: 1 },
  { id: "5", elevation: 2 },
  { id: "6", elevation: 3 },
  { id: "7", elevation: 1 },
  { id: "8", elevation: 2 },
  { id: "9", elevation: 3 },
];

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const renderItem = ({ item }: { item: CardData }) => (
    <>
      <Card
        elevation={item.elevation}
        onPress={() => navigation.navigate("Detail")}
      />
      <Spacer height={Spacing.lg} />
    </>
  );

  return (
    <ScreenFlatList
      data={CARD_DATA}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
    />
  );
}
