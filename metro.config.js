const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configuración del transformer
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Configuración para resolver módulos correctamente
config.resolver = {
  ...config.resolver,
  sourceExts: [...config.resolver.sourceExts, 'jsx', 'js', 'ts', 'tsx', 'json'],
  // Bloquear sql.js para que no sea procesado por Metro
  blockList: [
    ...(config.resolver.blockList || []),
    /node_modules\/sql\.js\/.*/,
  ],
};

module.exports = config;
