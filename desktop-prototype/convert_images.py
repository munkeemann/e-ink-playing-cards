import os
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

def convert_all_images(input_folder):
    output_folder = os.path.join(input_folder, "converted")
    os.makedirs(output_folder, exist_ok=True)

    target_size = (300, 400)
    card_aspect = 63 / 88  # Magic card aspect ratio

    def convert_image(path, filename):
        # Load and grayscale
        img = Image.open(path).convert("L")
        img = ImageOps.exif_transpose(img)

        # Resize to fit aspect ratio
        img_ratio = img.width / img.height
        if img_ratio > card_aspect:
            new_height = target_size[1]
            new_width = int(new_height * card_aspect)
        else:
            new_width = target_size[0]
            new_height = int(new_width / card_aspect)

        img_resized = img.resize((new_width, new_height), Image.LANCZOS)

        # Center on white canvas
        canvas = Image.new("L", target_size, 255)
        x_offset = (target_size[0] - new_width) // 2
        y_offset = (target_size[1] - new_height) // 2
        canvas.paste(img_resized, (x_offset, y_offset))

        # === 🔧 Enhancement Stack ===
        canvas = canvas.filter(ImageFilter.SHARPEN)

        # Adaptive enhancement based on brightness
        avg_brightness = canvas.resize((1, 1)).getpixel((0, 0))
        if avg_brightness < 90:
            contrast_level = 1.05
            brightness_level = 1.0
        elif avg_brightness < 100:
            contrast_level = 1.1
            brightness_level = 1.05
        elif avg_brightness > 160:
            contrast_level = 1.3
            brightness_level = 1.0
        else:
            contrast_level = 1.2
            brightness_level = 1.1

        canvas = ImageEnhance.Brightness(canvas).enhance(brightness_level)
        canvas = ImageOps.autocontrast(canvas)
        canvas = ImageEnhance.Contrast(canvas).enhance(contrast_level)

        # Adaptive threshold with clamped logic
        if avg_brightness < 100:
            threshold = max(145, avg_brightness + 35)
        else:
            threshold = min(200, avg_brightness + 40)

        print(f"🖼️ {filename} — Brightness: {avg_brightness}, Threshold: {threshold}")

        bw = canvas.point(lambda x: 255 if x > threshold else 0, mode='1')

        # === 📛 Region-specific enhancement (apply to all cards) ===
        namebar_box = (30, 10, 270, 40)
        typeline_box = (30, 45, 270, 65)

        namebar = bw.crop(namebar_box)
        enhanced_namebar = namebar.point(lambda x: 255 if x > 145 else 0, mode='1')
        bw.paste(enhanced_namebar, namebar_box[:2])

        typeline = bw.crop(typeline_box)
        enhanced_typeline = typeline.point(lambda x: 255 if x > 150 else 0, mode='1')
        bw.paste(enhanced_typeline, typeline_box[:2])

        return bw

    # Process all JPGs in the folder
    for filename in os.listdir(input_folder):
        if filename.lower().endswith(".jpg"):
            input_path = os.path.join(input_folder, filename)
            output_path = os.path.join(output_folder, os.path.splitext(filename)[0] + ".bmp")

            try:
                result = convert_image(input_path, filename)
                result.save(output_path)
                print(f"✅ Converted {filename} → {output_path}")
                os.remove(input_path)
                print(f"🗑️ Deleted original: {filename}")
            except Exception as e:
                print(f"❌ Failed to convert {filename}: {e}")

    return output_folder  # ✅ return path to the folder containing .bmp images
