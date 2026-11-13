"""Edit the user-provided recording into a loop and continuous listening proofs.

Run with numpy and imageio_ffmpeg on PYTHONPATH. No denoising or synthetic layers.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import wave

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/audio/forest-loop'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = Path(sys.argv[1])
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SR = 32000
CHANNELS = 2
LOOP_SECONDS = 24
FADE_SECONDS = 2.5

raw = subprocess.check_output([
    FFMPEG, '-v', 'error', '-i', str(SOURCE), '-f', 'f32le',
    '-ar', str(SR), '-ac', str(CHANNELS), 'pipe:1',
])
source = np.frombuffer(raw, dtype='<f4').reshape(-1, CHANNELS).astype(np.float64)
length, fade = int(LOOP_SECONDS*SR), int(FADE_SECONDS*SR)
assert len(source) >= length+fade+SR

# Compare the energy envelopes of potential overlap regions, avoiding codec edges.
def envelope(x):
    return np.array([np.sqrt(np.mean(a*a)+1e-15) for a in np.array_split(x, 10)])

choices = []
for start in np.arange(.5, min(3.5, len(source)/SR-LOOP_SECONDS-FADE_SECONDS-.2), .1):
    i = round(start*SR)
    a, b = source[i:i+fade], source[i+length:i+length+fade]
    score = np.mean(np.abs(np.log(envelope(a)/envelope(b))))
    choices.append((score, i))
_, start = min(choices)
segment = source[start:start+length+fade]
theta = np.linspace(0, np.pi/2, fade)
# Equal-power overlap: original recording tail transitions back into its head.
overlap = segment[length:] * np.cos(theta)[:, None] + segment[:fade] * np.sin(theta)[:, None]
loop = np.concatenate((segment[fade:length], overlap))
assert len(loop) == length
# Keep original level; no loudness boost, no added hiss, no abrupt endpoint fades.
peak = float(np.max(np.abs(loop)))
assert np.isfinite(loop).all() and peak < .98
pcm = np.round(loop*32767).astype('<i2')

def write(name, data):
    with wave.open(str(OUT/name), 'wb') as w:
        w.setnchannels(CHANNELS)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())

write('forest-loop.wav', pcm)
write('forest-loop-check-3x.wav', np.tile(pcm, (3, 1)))
write('forest-loop-boundary-8s.wav', np.concatenate((pcm[-4*SR:], pcm[:4*SR])))
subprocess.run([
    FFMPEG, '-v', 'error', '-y', '-i', str(OUT/'forest-loop.wav'),
    '-codec:a', 'libmp3lame', '-b:a', '192k', str(OUT/'forest-loop-small.mp3'),
], check=True)

# Validate the saved PCM, not only intermediate arrays.
with wave.open(str(OUT/'forest-loop-check-3x.wav')) as w:
    check = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, 2)
assert all(np.array_equal(check[j*length:(j+1)*length], pcm) for j in range(3))
steps = np.max(np.abs(np.diff(pcm.astype(np.int32), axis=0)), axis=1)
seam_step = int(np.max(np.abs(pcm[0].astype(np.int32)-pcm[-1].astype(np.int32))))
boundary = np.concatenate((loop[-SR//10:], loop[:SR//10]))
block_rms = [float(np.sqrt(np.mean(b*b))) for b in np.array_split(boundary,20)]
assert min(block_rms) > .00001  # no inserted silent gap around the boundary
report = {
    'source_file': SOURCE.name,
    'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'decoded_source_seconds': len(source)/SR,
    'selected_source_start_seconds': start/SR,
    'selected_source_end_seconds': (start+length+fade)/SR,
    'overlap_seconds': FADE_SECONDS,
    'loop_seconds': LOOP_SECONDS,
    'sample_rate': SR,
    'channels': CHANNELS,
    'bits_per_sample_wav': 16,
    'peak_dbfs': round(20*np.log10(peak),2),
    'rms_dbfs': round(20*np.log10(np.sqrt(np.mean(loop*loop))),2),
    'seam_step_pcm_units': seam_step,
    'seam_step_percentile_among_normal_steps': round(float(np.mean(steps <= seam_step)*100),2),
    'minimum_10ms_rms_near_boundary': min(block_rms),
    'proof_boundaries_seconds': [24,48],
    'proof_is_three_exact_pcm_copies': True,
    'bytes': {p.name:p.stat().st_size for p in OUT.iterdir() if p.suffix in ('.wav','.mp3')},
    'limits': 'Waveform checks only; subjective sound quality and native mobile playback still require listening tests.',
}
(OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
