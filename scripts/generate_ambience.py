"""Deterministic synthesized ambience; numpy only. No recordings or sampled music."""
from pathlib import Path
import json
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'mobile/assets/audio'
OUT.mkdir(parents=True, exist_ok=True)
SR, SECONDS = 22050, 20
N = SR * SECONDS
t = np.arange(N) / SR
rng = np.random.default_rng(20261113)

def noise(low, high, slope=0):
    f = np.fft.rfftfreq(N, 1 / SR)
    envelope = np.zeros_like(f)
    valid = (f >= low) & (f <= high)
    envelope[valid] = (f[valid] / low) ** slope
    # Soft edges avoid narrow-band ringing.
    envelope *= np.minimum(1, np.maximum(0, (f-low)/max(low, 30)))
    envelope *= np.minimum(1, np.maximum(0, (high-f)/(high*.25)))
    z = (rng.normal(size=len(f)) + 1j*rng.normal(size=len(f))) * envelope
    y = np.fft.irfft(z, n=N)
    return y / np.std(y)

def event(track, at, signal):
    # Wrap the complete tail, so the last-to-first transition stays continuous.
    indexes = (round(at*SR) + np.arange(len(signal))) % N
    np.add.at(track, indexes, signal)

def bird(track, at, pitch, amp=.025):
    for i in range(3):
        u = np.arange(int(SR*.16))/SR
        phase = 2*np.pi*(pitch*u + 1100*u*u)
        chirp = np.sin(phase) * np.sin(np.pi*u/.16)**2
        event(track, at+i*.23, amp*chirp)

def bell(track, at, pitch, amp, duration=7, metal=True):
    u = np.arange(int(SR*duration))/SR
    y = np.zeros_like(u)
    ratios = [1, 2.01, 2.76, 4.07] if metal else [1,2,3,4]
    for i, ratio in enumerate(ratios):
        decay = np.exp(-u/(1.6/(1+i*.38)))
        y += np.sin(2*np.pi*pitch*ratio*u) * decay / (1+i)**1.7
    y *= (1-np.exp(-u/.008)) * np.minimum(1, (duration-u)/.4)
    # Quiet reflected echoes retain a soft room tail.
    for delay, gain in [(0,1),(.11,.22),(.23,.12),(.39,.07)]:
        event(track, at+delay, y*amp*gain)

tracks = {}
forest = .026*noise(130,4200,-.65)*(1+.22*np.sin(2*np.pi*3*t/SECONDS))
for at,p in [(1.1,2100),(7.2,2500),(13.8,1900),(18,2300)]: bird(forest,at,p)
tracks['forest'] = forest

swell = (.5+.5*np.sin(2*np.pi*3*t/SECONDS))**1.7
ocean = .075*noise(90,6500,-.5)*(.25+.75*swell)
ocean += .018*noise(45,450,-.7)
tracks['ocean'] = ocean

cafe = .047*noise(450,7800,-.2) + .013*noise(70,650,-.5)
# Quiet, scattered drops against a window; no intelligible voices.
for at in rng.uniform(0,20,100):
    u = np.arange(int(SR*.07))/SR
    drop = np.sin(2*np.pi*rng.uniform(800,1900)*u)*np.exp(-u/.012)*(1-np.exp(-u/.001))
    event(cafe,float(at),drop*rng.uniform(.003,.012))
tracks['cafe'] = cafe

temple = .020*noise(90,2400,-.75)*(1+.25*np.sin(2*np.pi*t/SECONDS))
for at,p,a in [(1.5,1460,.047),(8.1,1945,.028),(14.8,1460,.037)]: bell(temple,at,p,a)
tracks['temple'] = temple

garden = .018*noise(180,3800,-.65)*(1+.3*np.sin(2*np.pi*2*t/SECONDS))
garden += .008*noise(800,6000,-.3)
for at,p in [(4.2,2800),(12.7,3100)]: bird(garden,at,p,.015)
for at,p in [(1,784),(10,1046)]: bell(garden,at,p,.012,5)
tracks['garden'] = garden

cathedral = .007*noise(65,1800,-.8)
for at,p,a in [(1,261.63,.045),(11,392,.030)]: bell(cathedral,at,p,a,9)
tracks['cathedral'] = cathedral

names = {'forest':'숲속 쉼터','ocean':'노을 바닷가','cafe':'비 오는 카페','temple':'고요한 산사','garden':'비밀정원','cathedral':'성당'}
report = []
for key,y in tracks.items():
    y -= y.mean()
    # Preserve relative dynamics while keeping each ambience comfortable and safe from clipping.
    rms = np.sqrt(np.mean(y*y))
    y *= min(.065/rms, .60/np.max(np.abs(y)))
    pcm = np.round(y*32767).astype('<i2')
    path = OUT / f'{key}.wav'
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    assert np.isfinite(y).all() and np.max(np.abs(y)) < 1
    report.append({'file':path.name,'name':names[key],'seconds':SECONDS,'bytes':path.stat().st_size,
                   'peak_dbfs':round(float(20*np.log10(np.max(np.abs(y)))),2),
                   'rms_dbfs':round(float(20*np.log10(np.sqrt(np.mean(y*y)))),2),
                   'loop_seam_step':round(float(abs(y[0]-y[-1])),6)})
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
