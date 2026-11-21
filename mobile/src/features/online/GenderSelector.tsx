import { Pressable, Text, View } from "react-native";
import { Copy, styles } from "../../components/ui";
import type { Gender } from "../../services/api";

export default function GenderSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: Gender;
  onChange: (value: Gender) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Copy>성별</Copy>
      <View style={styles.row}>
        {(
          [
            ["male", "남성"],
            ["female", "여성"],
          ] as const
        ).map(([gender, label]) => (
          <Pressable
            key={gender}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: value === gender, disabled }}
            disabled={disabled}
            onPress={() => onChange(gender)}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 20,
              backgroundColor: value === gender ? "#526E46" : "#EEEDE5",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Text
              style={{
                textAlign: "center",
                color: value === gender ? "white" : "#222922",
                fontSize: 16,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
