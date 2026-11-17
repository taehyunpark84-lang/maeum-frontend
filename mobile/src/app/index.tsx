import MockApp from "../features/App";
import OnlineApp from "../features/online/OnlineApp";

export default function Index() {
  return process.env.EXPO_PUBLIC_APP_MODE === "mock" ? (
    <MockApp />
  ) : (
    <OnlineApp />
  );
}
