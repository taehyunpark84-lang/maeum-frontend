import asyncio
import json
from app.chat_text import model_history, public_chunks
from test_shared_history import person, enter, add_message
from test_flow import client
from app.db import uid

LABEL = '[참고용 발화 출처: 공간=ocean, 역할=assistant]'


def filtered(chunks):
    async def run():
        async def source():
            for chunk in chunks:
                yield chunk
        return ''.join([part async for part in public_chunks(source())])
    return asyncio.run(run())


def test_every_chunk_boundary_and_ordinary_brackets():
    text = LABEL + '\n앱을 만들고 있구나! [작품]도 기대돼.'
    for split in range(len(text)+1):
        assert filtered([text[:split], text[split:]]) == '앱을 만들고 있구나! [작품]도 기대돼.'
    assert filtered(list(text)) == '앱을 만들고 있구나! [작품]도 기대돼.'
    assert filtered(['안녕 [미완성']) == '안녕 [미완성'
    assert filtered([LABEL]) == ''


def test_model_input_separates_metadata_and_cleans_old_echo():
    history = [{'role':'assistant','content':LABEL+'\n'+LABEL+'\n안녕'},
               {'role':'user','content':'final이라는 단어가 뭐야?'}]
    messages, origins = model_history(history)
    assert messages[0]['content'] == '안녕'
    assert messages[1] == history[1]
    assert origins == [{'message_index':0,'space':'ocean','role':'assistant'}]


def test_stream_storage_and_existing_history(person, monkeypatch):
    import app.main as main
    sid = enter('ocean')
    add_message(sid, LABEL+'\n예전 답변', 'assistant')
    add_message(sid, LABEL, 'user')  # 사용자 원문은 보존
    async def reply(*args):
        for char in LABEL+'\n새 답변':
            yield char
    monkeypatch.setattr(main.ai, 'stream_chat', reply)
    result = client.post(f'/sessions/{sid}/chat', json={'request_id':uid(),'text':'안녕'})
    events = [json.loads(line) for line in result.text.splitlines()]
    assert ''.join(e['text'] for e in events if e['type']=='delta') == '새 답변'
    assert events[-1]['message']['text'] == '새 답변'
    result = client.get(f'/sessions/{sid}/messages').json()
    assert '참고용 발화 출처' not in str([r for r in result if r['role']=='assistant'])
