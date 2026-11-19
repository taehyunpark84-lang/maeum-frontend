import { useState } from "react";
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Copy, Field, styles } from "../../components/ui";
import { places } from "../../config/assets";
import { api, saveToken } from "../../services/api";

export default function AuthScreen({
  onLogin,
  logoFont,
}: {
  onLogin: () => Promise<void>;
  logoFont?: string;
}) {
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        username: username.trim(),
        password,
        nickname: nickname.trim(),
      };
      if (register) await api("/auth/register", "POST", body);
      const result = await api<{ token: string }>("/auth/login", "POST", body);
      await saveToken(result.token);
      setPassword("");
      await onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ImageBackground source={places.forest.background} style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={{
            maxHeight: "90%",
            backgroundColor: "#FFFCF7F5",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={{ alignItems: "center" }}>
              <Ionicons name="leaf-outline" size={20} color="#526E45" />
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: logoFont,
                  fontSize: 24,
                  lineHeight: 34,
                  color: "#263D2D",
                  textAlign: "center",
                }}
              >
                마음이 머무는 곳
              </Text>
            </View>
            <Copy>당신의 이야기가 작품으로 머무는 공간</Copy>
            <Field
              label="아이디 · 영문/숫자/밑줄 4~40자"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={40}
              editable={!busy}
            />
            {register && (
              <Field
                label="닉네임"
                value={nickname}
                onChangeText={setNickname}
                maxLength={40}
                editable={!busy}
              />
            )}
            <Field
              label="비밀번호 · 10자 이상"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              maxLength={128}
              editable={!busy}
              autoCapitalize="none"
            />
            {error ? <Copy>{error}</Copy> : null}
            <Button
              label={
                busy ? "연결 중…" : register ? "가입하고 시작하기" : "로그인"
              }
              disabled={
                busy || username.trim().length < 4 || password.length < 10
              }
              onPress={() => void submit()}
            />
            <Button
              secondary
              label={register ? "이미 계정이 있어요" : "처음이신가요? 회원가입"}
              disabled={busy}
              onPress={() => {
                setRegister(!register);
                setError("");
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
