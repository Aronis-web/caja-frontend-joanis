const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function createIcon() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const outputPath = path.join(__dirname, 'build', 'icon.ico');

    // Crear directorio build si no existe
    if (!fs.existsSync(path.join(__dirname, 'build'))) {
      fs.mkdirSync(path.join(__dirname, 'build'));
    }

    const buf = await pngToIco(iconPath);
    fs.writeFileSync(outputPath, buf);
    console.log('✓ Icono .ico creado exitosamente en build/icon.ico');
  } catch (error) {
    console.error('Error al crear el icono:', error);
    process.exit(1);
  }
}

createIcon();
