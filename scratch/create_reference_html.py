import base64

with open('../reference.MP4', 'rb') as f:
    video_data = f.read()

video_base64 = base64.b64encode(video_data).decode('utf-8')

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Reference Video</title>
    <style>
        body {{ margin: 0; padding: 0; background-color: #f0f0f0; display: flex; justify-content: center; align-items: center; height: 100vh; }}
        video {{ max-width: 100%; max-height: 100%; }}
    </style>
</head>
<body>
    <video controls autoplay loop>
        <source src="data:video/mp4;base64,{video_base64}" type="video/mp4">
        Your browser does not support the video tag.
    </video>
</body>
</html>
"""

with open('scratch/reference.html', 'w') as f:
    f.write(html_content)

print("Generated scratch/reference.html")
