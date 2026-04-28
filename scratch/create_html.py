import re

with open('anything/apps/mobile/src/components/parkmateLogoAnimatedV8.js', 'r') as f:
    content = f.read()

# Extract BASE_SVG
base_svg_match = re.search(r'const BASE_SVG = String\.raw`(.*?)`;', content, re.DOTALL)
if not base_svg_match:
    print("Could not find BASE_SVG")
    exit(1)

base_svg = base_svg_match.group(1)

# do the replacements manually to test
# BASE_TIMELINE_SECONDS = 12
# BASE_ROAD_MOVE_SECONDS = 2
# BASE_SPOT_PULSE_SECONDS = 1.5

# durationMs = 3200
# durationSeconds = durationMs / 1000 = 3.2
# animationScale = 3.2 / 12 = 0.26666666666666666

durationSeconds = 3.2
animationScale = durationSeconds / 12

def formatSeconds(sec):
    return f"{round(sec, 3)}s"

svg_content = base_svg.replace('12s', formatSeconds(durationSeconds))
svg_content = svg_content.replace(
    'animation: roadMove 2s infinite linear;',
    f'animation: roadMove {formatSeconds(2 * animationScale)} infinite linear;'
)
svg_content = svg_content.replace(
    'dur="1.5s"',
    f'dur="{formatSeconds(1.5 * animationScale)}"'
)

html_content = f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <style>
      html, body {{
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
      }}

      body {{
        display: flex;
        align-items: center;
        justify-content: center;
      }}

      svg {{
        width: 100%;
        height: 100%;
        display: block;
      }}
    </style>
  </head>
  <body>
    {svg_content}
  </body>
</html>
"""

with open('scratch/animated_logo.html', 'w') as f:
    f.write(html_content)

print("Generated scratch/animated_logo.html")
