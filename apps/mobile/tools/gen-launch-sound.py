#!/usr/bin/env python3
"""Звук запуска — удар молнии: щелчок разряда и короткий раскат.

Две прошлые версии были нотами: сначала аккорд, потом колокольчик. Обе мимо —
у ZAP! звук должен быть тем же, чем и логотип: разрядом. Ноты в брендах
уместны там, где продукт про спокойствие; здесь продукт про скорость.

Как устроен разряд:

  1. Треск — несколько микро-импульсов в первые 50 мс. Именно нерегулярность
     импульсов читается ухом как «электричество»; ровный шум звучит как
     помеха, а не как искра.
  2. Сам разряд — белый шум через резонансный полосовой фильтр, центральная
     частота которого быстро падает с 5 кГц до 400 Гц. Падение высоты и даёт
     тот самый «цвирк».
  3. Тело — короткий обертонный свип вниз, 700 → 150 Гц. Он не мелодия, а
     вес: без него разряд звучит тонко и дёшево.
  4. Воздух — высокочастотный шум с медленным спадом. Остаточное шипение
     после искры.
  5. Короткая реверберация малым миксом. Полностью сухой разряд звучит как
     сэмпл из архива, а не как звук продукта.

К разряду добавлен раскат: низкий шум с медленным спадом, отстающий от щелчка
на 40 мс. Без него слышен «электрический треск», но не молния — узнаваемость
грома держится именно на паре «резкий щелчок → гул», а не на самом треске.
Раскат приглушён по верхам, иначе он звучит как помеха, а не как расстояние.

Тише остальных звуков (пик ≈ −14 дБФС): он играет без спроса сразу после
нажатия на иконку. Длительность 780 мс — щелчок быстрый, хвост раската
дотягивает остальное.

Запуск:  python3 tools/gen-launch-sound.py   (нужен ffmpeg для mp3)
"""
import math
import os
import random
import struct
import subprocess
import tempfile
import wave

SR = 44100
DUR = 0.78
PEAK = 0.20                     # ≈ −14 дБФС
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "assets", "sounds", "launch.mp3")

random.seed(11)                 # звук должен быть одинаковым при пересборке
N = int(SR * DUR)


class SVF:
    """Резонансный фильтр с перестраиваемой частотой (state-variable)."""

    def __init__(self, q=3.2):
        self.low = 0.0
        self.band = 0.0
        self.q = 1.0 / q

    def band_pass(self, x, fc):
        f = 2.0 * math.sin(math.pi * min(fc, SR * 0.45) / SR)
        high = x - self.low - self.q * self.band
        self.band += f * high
        self.low += f * self.band
        return self.band


def expdrop(t, a, b, tau):
    """Частота падает с a до b с постоянной времени tau."""
    return b + (a - b) * math.exp(-t / tau)


# ── треск: редкие импульсы, чем дальше, тем реже ───────────────────────────
crackle = [0.0] * N
pos = 0.002
while pos < 0.05:
    i = int(pos * SR)
    if i < N:
        crackle[i] += random.uniform(0.6, 1.0) * random.choice((-1, 1))
    pos += random.uniform(0.004, 0.013)

zap = SVF(q=2.4)
air = SVF(q=0.9)
rumble = SVF(q=0.7)
rumble_lp = 0.0
body_prev = 0.0
samples = []

for i in range(N):
    t = i / SR
    n = random.uniform(-1, 1)
    n2 = random.uniform(-1, 1)

    # 1+2. разряд: шум и треск через полосовой фильтр с падающей частотой
    fc = expdrop(t, 5000.0, 400.0, 0.055)
    env_zap = math.exp(-t / 0.055)
    spark = zap.band_pass(n * 0.8 + crackle[i] * 6.0, fc) * env_zap * 1.1

    # 3. тело: свип вниз с обертоном, даёт вес
    f_body = expdrop(t, 700.0, 150.0, 0.075)
    env_body = math.exp(-t / 0.10) * (1 - math.exp(-t / 0.004))
    phase = 2 * math.pi * f_body * t
    body = (math.sin(phase) + 0.30 * math.sin(2 * phase)) * env_body * 0.42

    # 4. воздух: шипение после искры
    hiss = air.band_pass(n, expdrop(t, 9000.0, 5200.0, 0.20)) * math.exp(-t / 0.13) * 0.16

    # 5. раскат: низкий шум, отстающий от щелчка; сверху дополнительно
    #    приглушён однополюсным ФНЧ — так он читается как расстояние
    tr = t - 0.04
    if tr > 0:
        rumble_lp += 0.055 * (n2 - rumble_lp)
        roll = rumble.band_pass(rumble_lp, expdrop(tr, 190.0, 70.0, 0.30))
        boom = roll * (1 - math.exp(-tr / 0.05)) * math.exp(-tr / 0.26) * 2.6
    else:
        boom = 0.0

    v = spark + body + hiss + boom
    # мягкое ограничение — резкие пики разряда иначе клиппуют
    samples.append(math.tanh(v * 1.15))


def comb(sig, ms, fb, damp):
    d = int(SR * ms / 1000)
    buf = [0.0] * d
    out = [0.0] * len(sig)
    store = 0.0
    for i, x in enumerate(sig):
        y = buf[i % d]
        out[i] = y
        store = y * (1 - damp) + store * damp
        buf[i % d] = x + store * fb
    return out


def allpass(sig, ms, gain=0.5):
    d = int(SR * ms / 1000)
    buf = [0.0] * d
    out = [0.0] * len(sig)
    for i, x in enumerate(sig):
        y = buf[i % d]
        out[i] = y - x
        buf[i % d] = x + y * gain
    return out


# 5. маленькая комната: миксом 0.18, только чтобы разряд не был «плоским»
wet = [0.0] * N
for ms, fb in ((17.3, 0.62), (23.9, 0.60), (29.1, 0.58)):
    c = comb(samples, ms, fb, 0.42)
    for i, v in enumerate(c):
        wet[i] += v * 0.33
wet = allpass(wet, 4.1)
samples = [d + w * 0.18 for d, w in zip(samples, wet)]

# уход в тишину без щелчка
fade = int(SR * 0.06)
for i in range(fade):
    samples[N - fade + i] *= (1 - i / fade) ** 2

peak = max(abs(s) for s in samples) or 1.0
samples = [s / peak * PEAK for s in samples]

with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
    wav_path = tmp.name
with wave.open(wav_path, "w") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(s * 32767)) for s in samples))

subprocess.run(
    ["/opt/homebrew/bin/ffmpeg", "-y", "-loglevel", "error",
     "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "128k", OUT],
    check=True,
)
os.remove(wav_path)
print("launch.mp3", os.path.getsize(OUT) // 1024, "КБ,", int(DUR * 1000), "мс")
