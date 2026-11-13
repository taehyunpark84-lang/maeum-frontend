import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AppState } from "../types";
import { initialState, restore } from "./model";
const KEY = "maeum.local.v1";
type Store = {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  ready: boolean;
  error: string;
  retry: () => void;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState(initialState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const queue = useRef(Promise.resolve());
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const result = restore(raw);
        setState(result.state);
        if (result.recovered)
          setError(
            "저장된 데이터가 손상되었거나 버전이 달라 빈 기록으로 복구했습니다.",
          );
        setReady(true);
      })
      .catch(() => {
        setError(
          "기록을 읽지 못했습니다. 앱을 재시작해 주세요. 기존 기록 보호를 위해 저장을 중지했습니다.",
        );
      });
  }, []);
  useEffect(() => {
    if (!ready) return;
    const snapshot = JSON.stringify(state);
    queue.current = queue.current
      .then(() => AsyncStorage.setItem(KEY, snapshot))
      .catch(() => {
        setError(
          "기기에 저장하지 못했습니다. 공간을 확인한 뒤 저장을 다시 시도해 주세요.",
        );
      });
  }, [state, ready, revision]);
  return (
    <Context.Provider
      value={{
        state,
        update: setState,
        ready,
        error,
        retry: () => {
          setError("");
          setRevision((n) => n + 1);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("StoreProvider required");
  return store;
}
