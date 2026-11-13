import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
export const colors = {
  bg: "#F7F4ED",
  panel: "#FFFCF7",
  text: "#222922",
  muted: "#687168",
  green: "#526E46",
  line: "#E4E0D6",
};
export function Copy({
  children,
  muted = false,
}: React.PropsWithChildren<{ muted?: boolean }>) {
  return (
    <Text style={[styles.copy, muted && { color: colors.muted }]}>
      {children}
    </Text>
  );
}
export function Title({ children }: React.PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  color = colors.green,
  icon,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  color?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? "#ECEDE5" : color,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={21}
          color={secondary ? colors.text : "#fff"}
        />
      )}
      <Text
        style={{
          color: secondary ? colors.text : "#fff",
          fontSize: 16,
          fontWeight: "600",
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  light = false,
  disabled = false,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  light?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.icon,
        {
          backgroundColor: light ? "#23302599" : "#EEEDE5",
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Ionicons name={name} size={23} color={light ? "#fff" : colors.green} />
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Copy muted>{label}</Copy>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          props.multiline && { minHeight: 110, textAlignVertical: "top" },
        ]}
        {...props}
      />
    </View>
  );
}
export function Sheet({
  title,
  children,
  onClose,
  footer,
}: React.PropsWithChildren<{
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
}>) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.shade}>
        <SafeAreaView edges={["bottom", "top"]} style={styles.sheet}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, gap: 16 }}
          >
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Title>{title}</Title>
              </View>
              <IconButton name="close" label="닫기" onPress={onClose} />
            </View>
            {children}
          </ScrollView>
          {footer && (
            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 12,
                paddingBottom: 16,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}
            >
              {footer}
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 20, paddingBottom: 32 },
  copy: { color: colors.text, fontSize: 16, lineHeight: 25 },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "700",
    lineHeight: 34,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  button: {
    minHeight: 52,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: "#fff",
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 52,
    padding: 16,
    fontSize: 16,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  shade: { flex: 1, backgroundColor: "#14231988", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.panel,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  badge: {
    color: colors.green,
    backgroundColor: "#E8EDDF",
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontSize: 12,
  },
});
