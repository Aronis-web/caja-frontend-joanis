const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Deshabilitar el runtime de Metro para web (causa problemas con import.meta)
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
};

// Deshabilitar el runtime de Metro para evitar import.meta
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      console.log('[METRO] Request URL:', req.url);

      // Deshabilitar el runtime de Metro para web
      if (req.url && req.url.includes('/@expo/metro-runtime')) {
        console.log('[METRO] ❌ Bloqueando @expo/metro-runtime');
        res.statusCode = 404;
        res.end('Metro runtime disabled for web');
        return;
      }

      // Interceptar bundles para eliminar import.meta
      if (req.url && req.url.includes('.bundle')) {
        console.log('[METRO] 📦 Interceptando bundle:', req.url);

        // Guardar la respuesta original
        const originalWrite = res.write;
        const originalEnd = res.end;
        const chunks = [];

        res.write = function(chunk) {
          chunks.push(Buffer.from(chunk));
        };

        res.end = function(chunk) {
          if (chunk) {
            chunks.push(Buffer.from(chunk));
          }

          let body = Buffer.concat(chunks).toString('utf8');

          // Verificar si contiene import.meta
          if (body.includes('import.meta')) {
            console.log('[METRO] ⚠️  Bundle contiene import.meta, reemplazando...');
            // Reemplazar import.meta con un objeto compatible
            body = body.replace(/import\.meta/g, '({url:window.location.href,env:{}})');
            console.log('[METRO] ✅ import.meta reemplazado');
          }

          // Restaurar funciones originales
          res.write = originalWrite;
          res.end = originalEnd;

          // Enviar el contenido modificado
          res.end(body);
        };
      }

      return middleware(req, res, next);
    };
  },
};

module.exports = config;
