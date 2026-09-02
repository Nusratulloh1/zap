#!/usr/bin/env python3
"""Звук запуска приложения — тихая тёплая подпись бренда.

Первая версия звучала дёшево, и по вполне понятным причинам. Что изменено:

  • Убран шумовой транзиент. Всплеск шума читается как «клик» интерфейса, а
    не как подпись бренда — именно он и делал звук дешёвым.
  • Мягкая атака (25 мс вместо 4). Резкий фронт — главный признак «системного
    бипа»; у дорогих звуков нота входит плавно.
  • Обертоны затухают быстрее основного тона, как у настоящего колокольчика
    или маримбы. Ровный по спектру звук слышится синтетическим.
  • Добавлена реверберация (Шрёдер: четыре гребёнки + два allpass). Хвост
    в пространстве — то, что сильнее всего отличает «дорогой» звук от
    сгенерированного.
  • Тише. Пик −13 дБФС вместо −1: звук запуска не должен перебивать музыку и
    пугать в тишине. Громкость дополнительно приглушена в feedback.ts.
  • Ноты идут вверх: B4 → F#5 → B5. Восходящая последовательность читается
    как «открылось»; нисходящая — как «закрылось» или ошибка.

Запуск:  python3 tools/gen-launch-sound.py   (нужен ffmpeg для mp3)
"""
import math
import os
import struct
import subprocess
import tempfile
import wave

SR = 44100
DUR = 1.25          # вместе с хвостом реверберации
PEAK = 0.225        # ≈ −13 дБФС
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "assets", "sounds", "launch.mp3")

# B4, F#5, B5 — квинта и октава. Открытый, спокойный интервал; минор на входе
# в платёжное приложение читался бы как предупреждение.
NOTES = [(493.88, 0.00, 1.00), (739.99, 0.085, 0.72), (987.77, 0.170, 0.55)]

# Обертоны колокольчика: номер гармоники, громкость, во сколько раз быстрее
# затухает по сравнению с основным тоном.
PARTIALS = [(1.0, 1.00, 1.0), (2.0, 0.34, 1.9), (3.01, 0.16, 3.1), (4.02, 0.07, 4.6)]


def mallet(t, dur):
    """Огибающая удара мягкой колотушкой: плавный вход, экспоненциальный спад."""
    attack = 0.025
    if t < 0:
        return 0.0
    a = 0.5 - 0.5 * math.cos(math.pi * min(1.0, t / attack))   # косинусный фронт
    return a * math.exp(-t * dur)


dry = []
for i in range(int(SR * DUR)):
    t = i / SR
    v = 0.0
    for freq, delay, amp in NOTES:
        tt = t - delay
        if tt < 0:
            continue
        for mult, pamp, pdecay in PARTIALS:
            v += amp * pamp * mallet(tt, 2.6 * pdecay) * math.sin(2 * math.pi * freq * mult * tt)
    dry.append(v * 0.25)


def comb(sig, delay_ms, feedback, damp):
    """Гребёнчатый фильтр с затуханием верхов в петле — стены не звенят."""
    d = int(SR * delay_ms / 1000)
    buf = [0.0] * d
    out = [0.0] * len(sig)
    store = 0.0
    for i, x in enumerate(sig):
        y = buf[i % d]
        out[i] = y
        store = y * (1 - damp) + store * damp
        buf[i % d] = x + store * feedback
    return out


def allpass(sig, delay_ms, gain=0.5):
    d = int(SR * delay_ms / 1000)
    buf = [0.0] * d
    out = [0.0] * len(sig)
    for i, x in enumerate(sig):
        y = buf[i % d]
        out[i] = y - x
        buf[i % d] = x + y * gain
    return out


# Реверберация Шрёдера: несколько гребёнок параллельно, затем allpass подряд.
wet = [0.0] * len(dry)
for ms, fb in ((29.7, 0.78), (37.1, 0.76), (41.1, 0.75), (43.7, 0.73)):
    c = comb(dry, ms, fb, 0.28)
    for i, v in enumerate(c):
        wet[i] += v * 0.25
wet = allpass(allpass(wet, 5.0), 1.7)

# Хвост слышен, но не размывает саму ноту
samples = [d + w * 0.42 for d, w in zip(dry, wet)]

# Мягкий уход в тишину — обрыв хвоста слышен как щелчок
fade = int(SR * 0.18)
for i in range(fade):
    k = i / fade
    samples[len(samples) - fade + i] *= (1 - k) ** 2

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
print("launch.mp3", os.path.getsize(OUT) // 1024, "КБ, пик", round(20 * math.log10(PEAK), 1), "дБФС")
