module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
        modules: 'auto', // Permite tanto CommonJS como ES modules
      },
    ],
  ],
  plugins: [
    // Soporte para import/export en archivos .js
    '@babel/plugin-transform-modules-commonjs',
  ],
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: 'current',
            },
            modules: 'commonjs', // Fuerza CommonJS en tests para compatibilidad
          },
        ],
      ],
    },
  },
};