const path = require("path");
const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");

// Make dist/ a self-contained, loadable UXP plugin folder: copy a manifest whose
// `main` points to the sibling index.html so UDT can be pointed straight at dist/.
class EmitPluginManifest {
  apply(compiler) {
    compiler.hooks.afterEmit.tap("EmitPluginManifest", () => {
      const src = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, "manifest.json"), "utf8")
      );
      // Inside dist/, index.html sits next to the manifest.
      src.main = "index.html";
      fs.writeFileSync(
        path.resolve(compiler.options.output.path, "manifest.json"),
        JSON.stringify(src, null, 2)
      );
    });
  }
}

module.exports = {
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
    clean: true,
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: {
          loader: "ts-loader",
          // Don't emit .d.ts/.map into dist — keep the plugin folder clean.
          options: { compilerOptions: { declaration: false, declarationMap: false } },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html",
      filename: "index.html",
      // UXP does not support `defer` on scripts; emit a plain blocking <script>.
      scriptLoading: "blocking",
      inject: "body",
    }),
    new EmitPluginManifest(),
  ],
  externals: {
    // UXP APIs are provided by the host application
    uxp: "uxp",
    premierepro: "premierepro",
    photoshop: "photoshop",
  },
};
