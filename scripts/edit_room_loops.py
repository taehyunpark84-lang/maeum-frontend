"""Crossfade supplied recordings; preserve originals and create listening proofs."""
from pathlib import Path
import hashlib
import html
import json
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/audio/room-loops'
SOURCE = Path(sys.argv[1])
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 32000
ROOMS = [('garden', '정원', '비밀정원', 24, 2.5),
         ('cathedral', '성당', '성당', 17, 2.5),
         ('cafe', '카페', '비 오는 카페', 17, 2.5),
         ('temple', '사원', '고요한 산사', 6, 1.5),
         ('ocean', '바다', '노을 바닷가', 20, 2.5)]
OUT.mkdir(parents=True, exist_ok=True)
reports = []

def decode(path):
    raw = subprocess.check_output([FF, '-v', 'error', '-i', str(path),
                                   '-f', 'f32le', '-ar', str(SR), '-ac', '2', 'pipe:1'])
    return np.frombuffer(raw, dtype='<f4').reshape(-1, 2).astype(np.float64)

def write(path, pcm):
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())

def envelope(x):
    return np.array([np.sqrt(np.mean(a*a)+1e-12) for a in np.array_split(x, 16)])

for key, name, room, seconds, fade_seconds in ROOMS:
    src = SOURCE / (name+'.mp3')
    digest = hashlib.sha256(src.read_bytes()).hexdigest()
    x = decode(src)
    length, fade = round(seconds*SR), round(fade_seconds*SR)
    choices = []
    for start_s in np.arange(.2, len(x)/SR-seconds-fade_seconds-.1, .025):
        start = round(start_s*SR)
        a, b = x[start:start+fade], x[start+length:start+length+fade]
        score = np.mean(np.abs(np.log(envelope(a)/envelope(b))))
        choices.append((float(score), start))
    score, start = min(choices)
    segment = x[start:start+length+fade]
    theta = np.linspace(0, np.pi/2, fade)
    overlap = segment[length:]*np.cos(theta)[:, None] + segment[:fade]*np.sin(theta)[:, None]
    loop = np.concatenate((segment[fade:length], overlap))
    # Attenuate only when needed for encoding headroom; never amplify quiet recordings.
    gain = min(1., .89/float(np.max(np.abs(loop))))
    loop *= gain
    assert len(loop) == length and np.isfinite(loop).all()
    pcm = np.round(loop*32767).astype('<i2')
    dest = OUT/key
    dest.mkdir(exist_ok=True)
    master = dest/(key+'-loop.wav')
    mp3 = dest/(key+'-loop-small.mp3')
    proof = dest/(key+'-loop-check-3x.wav')
    seam = dest/(key+'-loop-boundary.wav')
    side = min(4, seconds/2)
    n = round(side*SR)
    write(master, pcm)
    write(proof, np.tile(pcm, (3, 1)))
    write(seam, np.concatenate((pcm[-n:], pcm[:n])))
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(master), '-codec:a',
                    'libmp3lame', '-b:a', '192k', str(mp3)], check=True)
    for path in [master, mp3, proof, seam]:
        subprocess.run([FF, '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True)
    with wave.open(str(proof)) as w:
        saved = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, 2)
    assert all(np.array_equal(saved[i*length:(i+1)*length], pcm) for i in range(3))
    encoded = decode(mp3)
    assert len(encoded) == length and abs(encoded).max() < 1
    assert hashlib.sha256(src.read_bytes()).hexdigest() == digest
    steps = np.max(abs(np.diff(pcm.astype(np.int32), axis=0)), axis=1)
    seam_step = int(np.max(abs(pcm[0].astype(np.int32)-pcm[-1].astype(np.int32))))
    reports.append(dict(id=key, room=room, source_file=src.name, source_sha256=digest,
        source_seconds=len(x)/SR, crop_start_seconds=start/SR,
        crop_end_seconds=(start+length+fade)/SR, overlap_seconds=fade_seconds,
        loop_seconds=seconds, gain_db=round(20*np.log10(gain), 2),
        peak_dbfs=round(20*np.log10(abs(loop).max()), 2),
        mp3_decoded_peak_dbfs=round(20*np.log10(abs(encoded).max()), 2),
        seam_step_pcm_units=seam_step,
        seam_step_percentile=round(float(np.mean(steps <= seam_step)*100), 2),
        seam_proof_boundary_seconds=side, proof_boundaries_seconds=[seconds, seconds*2],
        proof_three_exact_copies=True, decode_validation_passed=True,
        mp3_bytes=mp3.stat().st_size, wav_bytes=master.stat().st_size))

(OUT/'verification.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding='utf-8')
cards = []
for r in reports:
    key, seconds = r['id'], r['loop_seconds']
    cards.append(f'''<section><h2>{html.escape(r['room'])}</h2>
    <p>한 번 {seconds}초 · MP3 {r['mp3_bytes']/1024:.0f}KB · 겹침 {r['overlap_seconds']}초</p>
    <h3>① 연결 부분만 듣기</h3><p>{r['seam_proof_boundary_seconds']:g}초 지점에서 끝과 시작이 연결됩니다.</p>
    <audio controls preload="none" src="{key}/{key}-loop-boundary.wav"></audio>
    <h3>② 세 번 연속 듣기</h3><p>{seconds}초와 {seconds*2}초가 반복 연결 지점입니다.</p>
    <audio id="{key}-proof" controls preload="none" src="{key}/{key}-loop-check-3x.wav"></audio>
    <button onclick="jump('{key}-proof',{max(0, seconds-2)})">첫 연결 2초 전부터</button>
    <button onclick="jump('{key}-proof',{seconds*2-2})">두 번째 연결 2초 전부터</button>
    <h3>③ 앱용 MP3 반복 듣기</h3><audio controls loop preload="none" src="{key}/{key}-loop-small.mp3"></audio>
    <p><a download href="{key}/{key}-loop-small.mp3">MP3 저장</a> ·
    <a download href="{key}/{key}-loop.wav">WAV 원본 저장</a></p></section>''')
page = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>다섯 공간의 반복 음원 확인</title><style>body{max-width:760px;margin:32px auto;padding:0 18px;background:#f6f3ec;color:#26382d;font:16px/1.7 system-ui}section{background:white;padding:24px;margin:22px 0;border-radius:18px}audio{width:100%}button{padding:10px;margin:8px 8px 0 0;cursor:pointer}h3{margin-bottom:4px}a{color:#306846}</style>
<h1>다섯 공간의 반복 음원</h1><p>원본 녹음에 새로운 소리를 추가하지 않고, 끝과 시작을 겹쳐 편집했습니다. 아래에서 연결 부분과 연속 재생을 직접 확인하세요.</p>
<p>①·②는 연결 상태를 확인하기 위해 WAV로 이어 붙인 파일입니다. ③의 MP3 반복 간격은 브라우저·앱 재생기에 따라 달라질 수 있습니다. 실제 앱에서도 확인이 필요합니다.</p>'''+''.join(cards)+'''
<script>const players=[...document.querySelectorAll('audio')];players.forEach(p=>{p.volume=.65;p.addEventListener('play',()=>players.forEach(q=>{if(q!==p)q.pause()}))});async function jump(id,time){const p=document.getElementById(id);try{if(p.readyState===0){p.load();await new Promise((resolve,reject)=>{p.addEventListener('loadedmetadata',resolve,{once:true});p.addEventListener('error',reject,{once:true})})}p.currentTime=time;await p.play()}catch(e){alert('재생 버튼을 눌러 다시 확인해주세요.')}}</script></html>'''
(OUT/'미리듣기.html').write_text(page, encoding='utf-8')
(OUT/'README.md').write_text('''# 다섯 공간 반복 음원

미리듣기.html을 브라우저로 열어 확인합니다. 각 폴더의 `*-loop-small.mp3`가 앱 후보 파일이며 `*-loop.wav`는 PCM 마스터입니다. WAV는 32kHz·16bit·스테레오, MP3는 192kbps입니다.

원본은 그대로 보존했습니다. 잡음 제거나 합성 소리 추가 없이 구간 선택과 equal-power 크로스페이드로 편집했습니다. 클리핑 여유가 필요한 경우에만 전체 음량을 낮췄습니다. 사원 원본은 9초로 짧아 반복 결과가 6초입니다.

`*-loop-check-3x.wav`는 동일 PCM 세 번을 빈 구간 없이 연결한 확인용 파일이고, `*-loop-boundary.wav`는 연결 앞뒤만 담았습니다. 편집 구간·음량 조정·검증 수치는 verification.json에 있습니다.

모든 파일의 디코딩, MP3 디코딩 길이 및 클리핑 여부, 3회 반복 PCM 일치, 원본 해시 보존을 검사했습니다. 수치 검증은 청감 평가를 대신하지 않습니다. MP3 반복 시 재생기 구현에 따라 짧은 틈이 생길 수 있으므로 실제 기기에서도 확인해야 합니다. 이번 작업에서는 앱 음원 연결 설정을 변경하지 않았습니다.
''', encoding='utf-8')
print(json.dumps(reports, ensure_ascii=False, indent=2))
