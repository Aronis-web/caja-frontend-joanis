const fs = require('fs-extra');
const path = require('path');

const sourceDir = path.join(__dirname, 'web-build', 'assets');
const targetDir = path.join(__dirname, 'dist', 'win-unpacked', 'resources', 'app.asar.unpacked', 'web-build', 'assets');

console.log('Copiando assets...');
console.log('Desde:', sourceDir);
console.log('Hacia:', targetDir);

if (fs.existsSync(sourceDir)) {
  // Copiar a dist/win-unpacked/resources/app.asar.unpacked
  fs.copySync(sourceDir, targetDir, { overwrite: true });
  console.log('✓ Assets copiados exitosamente');
} else {
  console.warn('⚠ Directorio de assets no encontrado, se omite copia:', sourceDir);
  console.warn('⚠ Continuando porque el build ya incluye web-build completo.');
}
