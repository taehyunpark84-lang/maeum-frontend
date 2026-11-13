from pathlib import Path
path = Path('mobile/src/features/App.tsx')
text = path.read_text(encoding='utf-8')
text = text.replace('import Chat from "./Chat";', 'import Chat from "./Chat";\nimport PlaceCards from "./PlaceCards";')
start = text.index('            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>')
end = text.index('            <Button', text.index('<Copy muted>네 곳 모두', start))
text = text[:start] + '''            <PlaceCards
              selectedId={placeId}
              onSelect={(key) => {
                update((s) => ({
                  ...s,
                  settings: { ...s.settings, selectedPlaceId: key },
                }));
                setModal({ type: "intro" });
              }}
            />
            <Copy muted>AI 캐릭터와의 시연 대화 · 배경 음원 준비 중</Copy>
''' + text[end:]
text = text.replace('마음이 편안해지는 공간을 골라보세요.', '오늘 나에게 필요한 대화를 골라보세요.')
text = text.replace('              <Copy>{p.greeting}</Copy>', '''              <Text style={[styles.badge, { color: p.color }]}>{p.concept}</Text>
              <Copy>{p.description}</Copy>
              <Copy muted>{p.personality}</Copy>
              <View style={[styles.card, { backgroundColor: "#F1F0E8" }]}>
                <Copy>{p.greeting}</Copy>
              </View>''')
path.write_text(text,encoding='utf-8')
