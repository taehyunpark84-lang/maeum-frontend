"""내부 발화 출처를 답변 본문과 분리하고 스트리밍 중 노출도 막습니다."""
import re

SOURCE = re.compile(r'\[참고용 발화 출처:\s*공간=(forest|ocean|cafe|temple|garden|cathedral),\s*역할=(user|assistant)\]')


def clean_reply(text):
    return SOURCE.sub('', text).lstrip()


def model_history(history):
    messages, origins = [], []
    for index, item in enumerate(history):
        text = item['content']
        match = SOURCE.match(text)
        if match:
            origins.append({'message_index': index, 'space': match[1], 'role': match[2]})
            text = text[match.end():].lstrip('\n')
        if item['role'] == 'assistant':
            text = clean_reply(text)
        messages.append({'role': item['role'], 'content': text})
    return messages, origins


async def public_chunks(chunks):
    # 대괄호가 청크 경계에서 잘려도 출처 표기가 잠깐 화면에 나타나지 않게 보류합니다.
    pending = ''
    at_start = True
    async for chunk in chunks:
        pending += chunk
        while pending:
            start = pending.find('[')
            if start < 0:
                ready, pending = pending, ''
            elif start > 0:
                ready, pending = pending[:start], pending[start:]
            else:
                end = pending.find(']')
                if end < 0 and len(pending) < 320:
                    break
                if end < 0:
                    ready, pending = pending, ''
                else:
                    bracket, pending = pending[:end+1], pending[end+1:]
                    ready = '' if SOURCE.fullmatch(bracket) else bracket
            if at_start:
                ready = ready.lstrip()
            if ready:
                at_start = False
                yield ready
    if pending and not pending.startswith('[참고용 발화 출처:'):
        yield pending.lstrip() if at_start else pending
