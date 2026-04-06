const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;

// SVG de una caja registradora moderna para CajaGrit
const cashRegisterSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#10B981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Fondo redondeado -->
  <rect x="32" y="32" width="448" height="448" rx="64" ry="64" fill="url(#bgGrad)" filter="url(#shadow)"/>

  <!-- Cuerpo de la caja registradora -->
  <rect x="96" y="200" width="320" height="200" rx="16" ry="16" fill="#FFFFFF"/>

  <!-- Pantalla/Display -->
  <rect x="120" y="120" width="272" height="70" rx="8" ry="8" fill="url(#screenGrad)"/>

  <!-- Texto en pantalla - símbolo de dinero -->
  <text x="256" y="165" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#FFFFFF" text-anchor="middle">$ 0.00</text>

  <!-- Cajón inferior -->
  <rect x="112" y="340" width="288" height="44" rx="6" ry="6" fill="#E5E7EB"/>
  <rect x="230" y="352" width="52" height="20" rx="4" ry="4" fill="#9CA3AF"/>

  <!-- Teclado numérico - fila 1 -->
  <rect x="120" y="210" width="48" height="36" rx="6" ry="6" fill="#F3F4F6"/>
  <rect x="176" y="210" width="48" height="36" rx="6" ry="6" fill="#F3F4F6"/>
  <rect x="232" y="210" width="48" height="36" rx="6" ry="6" fill="#F3F4F6"/>

  <!-- Teclado numérico - fila 2 -->
  <rect x="120" y="254" width="48" height="36" rx="6" ry="6" fill="#F3F4F6"/>
  <rect x="176" y="254" width="48" height="36" rx="6" ry="6" fill="#F3F4F6"/>
  <rect x="232" y="254" width="48" height="36" rx="6" ry="6" fill="#F3F4F6"/>

  <!-- Teclado numérico - fila 3 -->
  <rect x="120" y="298" width="48" height="36" rx="6" ry="6" fill="#F3F4F6"/>
  <rect x="176" y="298" width="48" height="36" rx="6" ry="6" fill="#F3F4F6"/>
  <rect x="232" y="298" width="48" height="36" rx="6" ry="6" fill="#F3F4F6"/>

  <!-- Botones de acción -->
  <rect x="296" y="210" width="112" height="56" rx="8" ry="8" fill="#EF4444"/>
  <rect x="296" y="278" width="112" height="56" rx="8" ry="8" fill="#10B981"/>

  <!-- Números en teclas -->
  <text x="144" y="235" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#374151" text-anchor="middle">1</text>
  <text x="200" y="235" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#374151" text-anchor="middle">2</text>
  <text x="256" y="235" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#374151" text-anchor="middle">3</text>
  <text x="144" y="279" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#374151" text-anchor="middle">4</text>
  <text x="200" y="279" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#374151" text-anchor="middle">5</text>
  <text x="256" y="279" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#374151" text-anchor="middle">6</text>
  <text x="144" y="323" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#374151" text-anchor="middle">7</text>
  <text x="200" y="323" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#374151" text-anchor="middle">8</text>
  <text x="256" y="323" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#374151" text-anchor="middle">9</text>

  <!-- Texto en botones -->
  <text x="352" y="245" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" text-anchor="middle">CANCEL</text>
  <text x="352" y="312" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" text-anchor="middle">PAGAR</text>
</svg>
`;

async function generateIcon() {
  try {
    const outputPath = path.join(__dirname, 'assets', 'icon.png');

    // Crear directorio assets si no existe
    if (!fs.existsSync(path.join(__dirname, 'assets'))) {
      fs.mkdirSync(path.join(__dirname, 'assets'));
    }

    // Generar PNG desde SVG
    await sharp(Buffer.from(cashRegisterSVG))
      .resize(512, 512)
      .png()
      .toFile(outputPath);

    console.log('✓ Icono PNG generado exitosamente en assets/icon.png');

    // También generar el .ico
    const icoOutputPath = path.join(__dirname, 'build', 'icon.ico');

    // Crear directorio build si no existe
    if (!fs.existsSync(path.join(__dirname, 'build'))) {
      fs.mkdirSync(path.join(__dirname, 'build'));
    }

    const buf = await pngToIco(outputPath);
    fs.writeFileSync(icoOutputPath, buf);
    console.log('✓ Icono ICO generado exitosamente en build/icon.ico');

  } catch (error) {
    console.error('Error al generar el icono:', error);
    process.exit(1);
  }
}

generateIcon();
