import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.resolve(__dirname, '../public/icons');
const publicDir = path.resolve(__dirname, '../public');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Master Standard SVG (512x512)
const standardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1e24" />
      <stop offset="50%" stop-color="#141418" />
      <stop offset="100%" stop-color="#0c0c0e" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbe38e" />
      <stop offset="35%" stop-color="#d4a437" />
      <stop offset="100%" stop-color="#9a6e18" />
    </linearGradient>
    <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbe38e" stop-opacity="0.8" />
      <stop offset="50%" stop-color="#d4a437" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#9a6e18" stop-opacity="0.6" />
    </linearGradient>
    <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Dark Background Rounded Container -->
  <rect x="16" y="16" width="480" height="480" rx="108" fill="url(#bgGrad)" stroke="url(#goldBorder)" stroke-width="4" />

  <!-- Gold Monogram Badge -->
  <rect x="64" y="64" width="384" height="384" rx="88" fill="url(#goldGrad)" filter="url(#badgeShadow)" />

  <!-- Inner Subtle Border Accent -->
  <rect x="76" y="76" width="360" height="360" rx="76" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.25" />

  <!-- Bold Clean 'H' Letterform in dark theme background color -->
  <path d="M172 136 H230 V226 H282 V136 H340 V376 H282 V286 H230 V376 H172 Z" fill="#0c0c0e" />

  <!-- Top Accent Dot / Diamond -->
  <circle cx="256" cy="180" r="6" fill="#0c0c0e" opacity="0.3" />
</svg>
`;

// Maskable SVG with 80% Safe Zone Padding
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="goldGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbe38e" />
      <stop offset="35%" stop-color="#d4a437" />
      <stop offset="100%" stop-color="#9a6e18" />
    </linearGradient>
  </defs>

  <!-- Full Bleed Solid Dark Background for Adaptive Masking -->
  <rect x="0" y="0" width="512" height="512" fill="#0c0c0e" />

  <!-- Safe Zone Circular/Rounded Badge (within 80% safe area, radius ~170 centered at 256) -->
  <rect x="96" y="96" width="320" height="320" rx="72" fill="url(#goldGradMask)" />

  <!-- Bold Clean 'H' Letterform in dark theme color -->
  <path d="M188 156 H236 V231 H276 V156 H324 V356 H276 V281 H236 V356 H188 Z" fill="#0c0c0e" />
</svg>
`;

// Solid Apple Touch Icon SVG (180x180 solid no transparency)
const appleTouchSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
  <defs>
    <linearGradient id="appleGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbe38e" />
      <stop offset="40%" stop-color="#d4a437" />
      <stop offset="100%" stop-color="#9a6e18" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="180" height="180" fill="#0c0c0e" />
  <rect x="20" y="20" width="140" height="140" rx="32" fill="url(#appleGold)" />
  <path d="M60 48 H78 V78 H102 V48 H120 V132 H102 V96 H78 V132 H60 Z" fill="#0c0c0e" />
</svg>
`;

async function generateIcons() {
  console.log('Generating PWA icon assets...');

  const standardSizes = [
    { size: 72, name: 'icon-72x72.png' },
    { size: 96, name: 'icon-96x96.png' },
    { size: 128, name: 'icon-128x128.png' },
    { size: 144, name: 'icon-144x144.png' },
    { size: 152, name: 'icon-152x152.png' },
    { size: 192, name: 'icon-192x192.png' },
    { size: 384, name: 'icon-384x384.png' },
    { size: 512, name: 'icon-512x512.png' },
    // Favicons
    { size: 32, name: 'favicon-32x32.png' },
    { size: 16, name: 'favicon-16x16.png' },
    // Legacy aliases
    { size: 192, name: 'pwa-192x192.png' },
    { size: 512, name: 'pwa-512x512.png' }
  ];

  const maskableSizes = [
    { size: 192, name: 'maskable-icon-192x192.png' },
    { size: 512, name: 'maskable-icon-512x512.png' }
  ];

  const stdBuffer = Buffer.from(standardSvg);
  const maskBuffer = Buffer.from(maskableSvg);
  const appleBuffer = Buffer.from(appleTouchSvg);

  // Generate Standard Icons
  for (const { size, name } of standardSizes) {
    const dest = path.join(iconsDir, name);
    await sharp(stdBuffer)
      .resize(size, size)
      .png()
      .toFile(dest);
    console.log(`✓ Created: ${name} (${size}x${size})`);
  }

  // Generate Maskable Icons
  for (const { size, name } of maskableSizes) {
    const dest = path.join(iconsDir, name);
    await sharp(maskBuffer)
      .resize(size, size)
      .png()
      .toFile(dest);
    console.log(`✓ Created: ${name} (${size}x${size})`);
  }

  // Generate Apple Touch Icon (180x180)
  const appleDest = path.join(iconsDir, 'apple-touch-icon.png');
  await sharp(appleBuffer)
    .resize(180, 180)
    .png()
    .toFile(appleDest);
  console.log('✓ Created: apple-touch-icon.png (180x180)');

  // Also copy to root public for direct web access
  await sharp(appleBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Generate favicon.ico (32x32)
  const faviconIcoDest = path.join(publicDir, 'favicon.ico');
  const faviconIcoIconsDest = path.join(iconsDir, 'favicon.ico');
  await sharp(stdBuffer)
    .resize(32, 32)
    .png()
    .toFile(faviconIcoDest);
  await sharp(stdBuffer)
    .resize(32, 32)
    .png()
    .toFile(faviconIcoIconsDest);
  console.log('✓ Created: favicon.ico (32x32)');

  // Save master SVG files into public/icons
  fs.writeFileSync(path.join(iconsDir, 'icon.svg'), standardSvg.trim());
  fs.writeFileSync(path.join(iconsDir, 'maskable-icon.svg'), maskableSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), standardSvg.trim());
  console.log('✓ Saved master SVGs: icon.svg, maskable-icon.svg, favicon.svg');

  console.log('\nAll PWA icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
