const sharp = require('sharp');
const path = require('path');

const logo = path.join(__dirname, 'public', 'Elekeza Logo.png');

async function generate() {
  const sizes = [192, 512];
  for (const size of sizes) {
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite([{
        input: await sharp(logo).resize(Math.round(size * 0.7), Math.round(size * 0.7)).toBuffer(),
        gravity: 'center'
      }])
      .png({ compressionLevel: 9, quality: 80 })
      .toFile(path.join(__dirname, 'public', 'icons', `icon-${size}x${size}.png`));

    console.log(`Generated ${size}x${size} icon`);
  }
}

generate().catch(err => console.error(err));
