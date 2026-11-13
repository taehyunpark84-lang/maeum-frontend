import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StoreProvider } from "../storage/store";
import { AmbientAudioProvider } from "../components/AmbientAudioProvider";
export default function Layout() {
  return (
    <StoreProvider>
      <AmbientAudioProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#F7F4ED" },
          }}
        />
      </AmbientAudioProvider>
    </StoreProvider>
  );
}
