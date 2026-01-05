import { useLayoutEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { useTunnel } from "../context/TunnelContext";

export function useTunnelHeader(prefix: string) {
  const navigation = useNavigation<any>();
  const { selectedTunnel } = useTunnel();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: `${prefix} • ${selectedTunnel.name}`,
    });
  }, [navigation, prefix, selectedTunnel.name]);
}
