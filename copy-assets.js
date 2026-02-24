const fs = require('fs-extra');
const path = require('path');

const sourceDir = path.join(__dirname, 'web-build', 'assets');
const targetDir = path.join(__dirname, 'dist', 'win-unpacked', 'resources', 'app.asar.unpacked', 'web-build', 'assets');

console.log('Copiando assets...');
console.log('Desde:', sourceDir);
console.log('Hacia:', targetDir);

if (fs.existsSync(sourceDir)) {
  fs.copySync(sourceDir, targetDir, { overwrite: true });
  console.log('✓ Assets copiados exitosamente');
} else {
  console.error('✗ Directorio de origen no existe:', sourceDir);
  process.exit(1);
}
