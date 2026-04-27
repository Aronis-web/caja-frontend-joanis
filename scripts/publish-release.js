#!/usr/bin/env node

/**
 * Publish Release Script
 * Script para publicar releases en múltiples canales
 * Uso:
 *   npm run publish:stable
 *   npm run publish:beta
 *   npm run publish:edge
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const packageJsonPath = path.join(__dirname, '../package.json');
const distPath = path.join(__dirname, '../dist');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

function calculateChecksum(filePath, algorithm = 'sha256') {
  const content = fs.readFileSync(filePath);
  return crypto.createHash(algorithm).update(content).digest('hex');
}

function generateReleaseMetadata(version, channel) {
  const files = fs.readdirSync(distPath).filter(file => {
    return file.includes('.exe') || file.includes('.zip') || file.includes('.yml');
  });

  const metadata = {
    version,
    channel,
    timestamp: new Date().toISOString(),
    platform: 'win32',
    arch: 'x64',
    files: []
  };

  files.forEach(file => {
    const filePath = path.join(distPath, file);
    metadata.files.push({
      name: file,
      size: fs.statSync(filePath).size,
      sha256: calculateChecksum(filePath, 'sha256'),
      sha512: calculateChecksum(filePath, 'sha512')
    });
  });

  return metadata;
}

function createReleaseNotes(version) {
  const changelogPath = path.join(__dirname, '../CHANGELOG.md');
  
  if (!fs.existsSync(changelogPath)) {
    return `Version ${version} released`;
  }

  const changelog = fs.readFileSync(changelogPath, 'utf8');
  
  // Extraer cambios de la versión actual
  const versionRegex = new RegExp(`## \\[${version}\\].*?(?=## \\[|$)`, 's');
  const match = changelog.match(versionRegex);
  
  return match ? match[0] : `Version ${version} released`;
}

function publishToGitHub(version, channel) {
  try {
    console.log(`\n📦 Publicando en GitHub con canal: ${channel}...`);

    const releaseNotes = createReleaseNotes(version);
    const isDraft = channel === 'edge';
    const isPrerelease = channel === 'beta';

    // Usar electron-builder para publicar
    const publishCmd = isPrerelease
      ? `electron-builder publish onTagOrDraft --win --prerelease`
      : isDraft
      ? `electron-builder publish onTagOrDraft --win --draft`
      : `electron-builder publish always --win`;

    execSync(publishCmd, { stdio: 'inherit' });

    console.log(`✅ Publicado en GitHub: ${channel}`);
  } catch (error) {
    console.error(`❌ Error publicando en GitHub:`, error.message);
    throw error;
  }
}

function generateMetadataFile(version, channel) {
  const metadata = generateReleaseMetadata(version, channel);
  const metadataPath = path.join(distPath, `release-${channel}.json`);

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`✅ Metadata guardado: ${metadataPath}`);

  return metadata;
}

function logReleaseInfo(version, channel, metadata) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 Release Published Successfully`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Version: ${version}`);
  console.log(`Channel: ${channel}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Files: ${metadata.files.length}`);
  console.log(`\nArchivos publicados:`);
  
  metadata.files.forEach(file => {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    console.log(`  - ${file.name} (${sizeMB} MB)`);
    console.log(`    SHA256: ${file.sha256.substring(0, 16)}...`);
  });
  
  console.log(`${'='.repeat(60)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  let channel = 'stable';

  if (args.length > 0) {
    channel = args[0];
  }

  if (!['stable', 'beta', 'edge'].includes(channel)) {
    console.error(`❌ Canal desconocido: ${channel}`);
    console.error('Usa: stable, beta o edge');
    process.exit(1);
  }

  const version = packageJson.version;

  console.log(`\n🚀 Publicando CajaGrit v${version} - Canal: ${channel}`);
  console.log(`${'='.repeat(60)}`);

  // Verificar que dist existe
  if (!fs.existsSync(distPath)) {
    console.error('❌ Carpeta dist no encontrada. Ejecuta primero: npm run dist');
    process.exit(1);
  }

  try {
    // 1. Generar metadata
    const metadata = generateMetadataFile(version, channel);

    // 2. Publicar en GitHub
    publishToGitHub(version, channel);

    // 3. Log de información
    logReleaseInfo(version, channel, metadata);

    console.log('✨ Release completado exitosamente\n');
  } catch (error) {
    console.error(`\n❌ Error durante el release: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
