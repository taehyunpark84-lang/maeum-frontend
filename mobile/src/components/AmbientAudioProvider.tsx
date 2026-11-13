import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { AmbientAudio } from "../services/ambientAudio";
import { useStore } from "../storage/store";

const Context = createContext<AmbientAudio | null>(null);
export function AmbientAudioProvider({ children }: PropsWithChildren) {
  const { state } = useStore();
  const { volume, audioMuted, audioLoop } = state.settings;
  const [audio] = useState(
    () =>
      new AmbientAudio(
        (source) => createAudioPlayer(source, { updateInterval: 250 }),
        () =>
          setAudioModeAsync({
            allowsRecording: false,
            shouldPlayInBackground: false,
            playsInSilentMode: true,
            interruptionMode: "doNotMix",
          }),
      ),
  );
  useEffect(() => {
    audio.setPreferences({ volume, muted: audioMuted, loop: audioLoop });
  }, [audio, volume, audioMuted, audioLoop]);
  useEffect(() => {
    audio.setForeground(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (next) =>
      audio.setForeground(next === "active"),
    );
    return () => {
      subscription.remove();
      audio.dispose();
    };
  }, [audio]);
  return <Context.Provider value={audio}>{children}</Context.Provider>;
}
export function useAudioController() {
  const audio = useContext(Context);
  if (!audio) throw new Error("AmbientAudioProvider required");
  return audio;
}
export function useAmbientAudio() {
  const audio = useAudioController();
  return {
    audio,
    status: useSyncExternalStore(
      audio.subscribe,
      audio.getSnapshot,
      audio.getSnapshot,
    ),
  };
}
