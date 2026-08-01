const { resolve } = require('path');
var glob = require('glob');
var path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ESBuildMinifyPlugin } = require('esbuild-loader');
const { ProvidePlugin, BannerPlugin } = require('webpack');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const CopyPlugin = require('copy-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';
const isDevelopment = !isProd;

const fastRefresh = isDevelopment ? new ReactRefreshWebpackPlugin() : null;

const SANDBOX_SUFFIX = '-sandbox';

const config = {
  mode: isProd ? 'production' : 'development',
  entry: glob.sync('./src/widgets/**/*.tsx').reduce((obj, el) => {
    const rel = path
      .relative('src/widgets', el)
      .replace(/\.[tj]sx?$/, '')
      .replace(/\\/g, '/');

    // Newer glob versions return Windows paths without a leading './'.
    // Absolute entries prevent Webpack from treating "src\\..." as a package name.
    const absoluteEntry = resolve(__dirname, el);
    obj[rel] = absoluteEntry;
    obj[`${rel}${SANDBOX_SUFFIX}`] = absoluteEntry;
    return obj;
  }, {}),

  output: {
    path: resolve(__dirname, 'dist'),
    filename: `[name].js`,
    publicPath: '',
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|jsx|js)?$/,
        loader: 'esbuild-loader',
        options: {
          loader: 'tsx',
          target: 'es2020',
          minify: false,
        },
      },
      {
        test: /\.css$/i,
        use: [
          // RemNote loads widget JavaScript dynamically but does not automatically attach
          // extracted per-widget CSS files. Inject styles from each widget bundle instead.
          'style-loader',
          { loader: 'css-loader', options: { url: false } },
          'postcss-loader',
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      templateContent: `
      <body></body>
      <script type="text/javascript">
      const urlSearchParams = new URLSearchParams(window.location.search);
      const queryParams = Object.fromEntries(urlSearchParams.entries());
      const widgetName = queryParams["widgetName"];
      if (widgetName == undefined) {document.body.innerHTML+="Widget ID not specified."}

      const s = document.createElement('script');
      s.type = "module";
      s.src = widgetName+"${SANDBOX_SUFFIX}.js";
      document.body.appendChild(s);
      </script>
    `,
      filename: 'index.html',
      inject: false,
    }),
    new ProvidePlugin({
      React: 'react',
      reactDOM: 'react-dom',
    }),
    new BannerPlugin({
      banner: (file) => {
        // Dynamic imports can create unnamed chunks, so guard the optional name.
        const chunkName = file.chunk?.name ?? '';
        if (chunkName.includes(SANDBOX_SUFFIX)) return '';

        // RemNote's localhost loader can evaluate DEV widgets as classic scripts.
        // In that context `import.meta` is a syntax error, while currentScript still
        // provides the bundle URL expected by the SDK's native widget renderer.
        return isDevelopment
          // Multiple DEV widgets can share one classic-script scope, so this
          // compatibility alias must be safely redeclarable across bundles.
          ? "var IMPORT_META={url:(document.currentScript&&document.currentScript.src)||''};"
          : 'const IMPORT_META=import.meta;';
      },
      raw: true,
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'public',
          to: '',
          transform(content, absoluteFrom) {
            // RemNote will not install a localhost build when the store version with
            // the same plugin ID is already present. Give development builds their
            // own identity so both versions can be inspected without uninstalling.
            if (isDevelopment && path.basename(absoluteFrom) === 'manifest.json') {
              const manifest = JSON.parse(content.toString());
              manifest.id = `${manifest.id}-dev`;
              manifest.name = `${manifest.name} [DEV]`;
              return JSON.stringify(manifest, null, 2);
            }

            return content;
          },
        },
        { from: 'README.md', to: '' },
      ],
    }),
    fastRefresh,
  ].filter(Boolean),
};

if (isProd) {
  config.optimization = {
    minimize: isProd,
    minimizer: [new ESBuildMinifyPlugin()],
  };
} else {
  // for more information, see https://webpack.js.org/configuration/dev-server
  config.devServer = {
    port: 8080,
    open: true,
    hot: true,
    compress: true,
    watchFiles: ['src/*'],
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'baggage, sentry-trace',
    },
  };
}

module.exports = config;
