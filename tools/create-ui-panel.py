"""One-time authoring of the neutral nine-slice UI artwork, not game runtime."""
from pathlib import Path
from PIL import Image, ImageDraw

path = Path(__file__).resolve().parents[1] / 'assets' / 'Sprites' / 'ui-panel.png'
if path.exists():
    raise SystemExit('Refusing to overwrite existing artwork: ' + str(path))
image = Image.new('RGBA', (256, 256), (255, 255, 255, 0))
ImageDraw.Draw(image).rounded_rectangle((0, 0, 255, 255), radius=48, fill=(255, 255, 255, 255))
image.resize((64, 64), Image.Resampling.LANCZOS).save(path)
print('Created', path)
