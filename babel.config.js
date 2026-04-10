module.exports = function (api) {
  api.cache(true);

  // Plugin personalizado para transformar import.meta en un polyfill compatible
  // Esto es necesario porque Electron/web no soporta import.meta fuera de módulos ES
  const transformImportMeta = () => ({
    name: 'transform-import-meta',
    visitor: {
      MetaProperty(path) {
        // Verificar si es import.meta
        if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
          // Reemplazar con un objeto polyfill
          path.replaceWithSourceString(
            '(typeof window !== "undefined" && window.__importMeta ? window.__importMeta : { url: "", env: {} })'
          );
        }
      },
    },
  });

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      transformImportMeta,
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
          },
        },
      ],
    ],
  };
};
