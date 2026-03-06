import { useLayoutEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { useTunnel } from "../context/TunnelContext";

export function useTunnelHeader(prefix: string) {
  const navigation = useNavigation<any>();
  const { selectedTunnel } = useTunnel();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: selectedTunnel?.name ? `${prefix} • ${selectedTunnel.name}` : prefix,
    });
  }, [navigation, prefix, selectedTunnel?.name]);
}