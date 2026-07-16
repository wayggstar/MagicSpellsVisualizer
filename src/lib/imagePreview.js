function toHexColor(red, green, blue) {
  return [red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

export function toImagePath(fileName) {
  const safeName = fileName.replace(/[^a-z0-9._-]+/gi, "_");
  return `plugins/MagicSpells/images/${safeName}`;
}

export async function rasterizeImageFile(file, maxPixels = 32) {
  const url = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(url);
    const scale = Math.min(1, maxPixels / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const { data } = context.getImageData(0, 0, width, height);
    const pixels = [];
    const colors = [];

    for (let y = 0; y < height; y += 1) {
      let row = "";
      const colorRow = [];

      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        const alpha = data[offset + 3];
        const brightness = (red + green + blue) / 3;
        const isVisible = alpha > 32 && brightness > 18;

        row += isVisible ? "1" : "0";
        colorRow.push(`#${toHexColor(red, green, blue)}`);
      }

      pixels.push(row);
      colors.push(colorRow);
    }

    return { colors, height, pixels, sourceName: file.name, width };
  } finally {
    URL.revokeObjectURL(url);
  }
}
