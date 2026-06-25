#!/usr/bin/env node

/**
 * Version Manager
 * Script para gestionar versionado semántico y releases
 * Uso:
 *   npm run version -- major|minor|patch
 *   npm run version -- 1.2.3
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

function getVersionParts(version) {
  const parts = version.split('.');
  return {
    major: parseInt(parts[0], 10),
    minor: parseInt(parts[1], 10),
    patch: parseInt(parts[2], 10)
  };
}

function bumpVersion(currentVersion, bumpType) {
  const parts = getVersionParts(currentVersion);

  switch (bumpType) {
    case 'major':
      parts.major += 1;
      parts.minor = 0;
      parts.patch = 0;
      break;
    case 'minor':
      parts.minor += 1;
      parts.patch = 0;
      break;
    case 'patch':
      parts.patch += 1;
      break;
    default:
      // Si es una versión específica, usar esa
      if (/^\d+\.\d+\.\d+$/.test(bumpType)) {
        return bumpType;
      }
      throw new Error(`Invalid bump type: ${bumpType}. Use major, minor, patch, or X.Y.Z`);
  }

  return `${parts.major}.${parts.minor}.${parts.patch}`;
}

function updatePackageJson(newVersion) {
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Versión actualizada a: ${newVersion}`);
}

function createGitTag(version) {
  try {
    execSync(`git tag v${version}`, { stdio: 'inherit' });
    console.log(`✅ Git tag creado: v${version}`);
  } catch (error) {
    console.warn(`⚠️ Error al crear git tag: ${error.message}`);
  }
}

function generateChangelog(version) {
  const changelogPath = path.join(__dirname, '../CHANGELOG.md');
  const date = new Date().toISOString().split('T')[0];

  let changelogContent = '';

  if (fs.existsSync(changelogPath)) {
    changelogContent = fs.readFileSync(changelogPath, 'utf8');
  }

  const newEntry = `## [${version}] - ${date}\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- \n\n`;

  changelogContent = newEntry + changelogContent;

  fs.writeFileSync(changelogPath, changelogContent);
  console.log(`✅ Changelog actualizado`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Version Manager');
    console.log('Uso: npm run version -- [major|minor|patch|X.Y.Z]');
    console.log('');
    console.log('Versión actual:', packageJson.version);
    process.exit(1);
  }

  const bumpType = args[0];
  const currentVersion = packageJson.version;
  let newVersion;

  try {
    newVersion = bumpVersion(currentVersion, bumpType);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  if (newVersion === currentVersion) {
    console.warn(`⚠️ La versión no cambió: ${currentVersion}`);
    process.exit(0);
  }

  console.log(`\nActualizando versión de ${currentVersion} a ${newVersion}...\n`);

  // 1. Actualizar package.json
  updatePackageJson(newVersion);

  // 2. Crear entrada en changelog
  generateChangelog(newVersion);

  // 3. Crear git tag
  createGitTag(newVersion);

  console.log(`\n✨ Versión actualizada a ${newVersion}`);
  console.log('\nSiguientes pasos:');
  console.log('1. Revisar CHANGELOG.md y completar los cambios');
  console.log('2. git add package.json CHANGELOG.md');
  console.log(`3. git commit -m "chore: bump version to ${newVersion}"`);
  console.log(`4. git push origin main --tags`);
  console.log(`5. npm run publish`);
}

main();
