const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'web-build', 'index.html');

if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Cambiar <script src="..." defer> a <script type="module" src="...">
  html = html.replace(
    /<script src="([^"]+)" defer><\/script>/g,
    '<script type="module" src="$1"></script>'
  );

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✓ HTML modificado para usar módulos ES');
} else {
  console.error('✗ No se encontró index.html');
}
