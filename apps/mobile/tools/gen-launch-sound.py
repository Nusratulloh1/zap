#!/usr/bin/env python3
"""Звук запуска приложения — короткий «zap» и светлый аккорд.

Собран из двух слоёв, как это обычно и делают в звуковых логотипах:

  1. Транзиент — шумовой всплеск с быстрым спадом. Это «искра», он даёт
     ощущение удара и занимает первые 90 мс.
  2. Тон — две ноты (E5 + B5) мягкой волной с длинным затуханием. Мажорная
     квинта звучит открыто и не тревожно; минорные интервалы для входа в
     платёжное приложение читались бы как предупреждение.

Общая длительность ~700 мс: звуковые логотипы держат в пределах секунды,
дальше он воспринимается не как подпись бренда, а как задержка.

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
DUR = 0.70
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "assets", "sounds", "launch.mp3")

random.seed(7)  # шум должен быть одинаковым при каждой пересборке


def env(t, attack, decay, power=2.0):
    """Огибающая: быстрая атака, степенной спад."""
    if t < attack:
        return t / attack
    x = (t - attack) / max(1e-6, decay)
    return max(0.0, (1.0 - x)) ** power if x < 1 else 0.0


samples = []
prev = 0.0
for i in range(int(SR * DUR)):
    t = i / SR

    # 1. искра: шум через однополюсный ФНЧ, частота среза падает —
    #    получается «пшш» с уходом в глухой хвост
    n = random.uniform(-1, 1)
    k = 0.35 - 0.30 * min(1.0, t / 0.09)
    prev = prev + k * (n - prev)
    spark = prev * env(t, 0.004, 0.09, 2.6) * 0.55

    # 2. тон: E5 и B5, вторая нота вступает на 60 мс позже — «раз-два»,
    #    как в большинстве звуковых подписей
    tone = 0.0
    for freq, delay, amp in ((659.25, 0.0, 0.62), (987.77, 0.06, 0.42)):
        if t < delay:
            continue
        tt = t - delay
        e = env(tt, 0.006, DUR - delay, 1.8)
        # немного второй гармоники — иначе синус звучит «пустым»
        tone += amp * e * (math.sin(2 * math.pi * freq * tt)
                           + 0.18 * math.sin(4 * math.pi * freq * tt))

    v = spark + tone * 0.55
    # мягкое ограничение вместо жёсткого клиппинга
    v = math.tanh(v * 1.25)
    samples.append(v)

# нормализация с запасом до 0 дБ
peak = max(abs(s) for s in samples) or 1.0
samples = [s / peak * 0.89 for s in samples]

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
print("launch.mp3", os.path.getsize(OUT) // 1024, "КБ")
