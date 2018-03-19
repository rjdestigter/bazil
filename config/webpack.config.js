const HtmlWebpackPlugin = require("html-webpack-plugin");

const babelLoader = {
  loader: "babel-loader",
  options: {
    babelrc: false,
    presets: [
      [
        "@babel/preset-env",
        {
          targets: {
            browsers: ["last 2 versions", "safari >= 7"]
          }
        }
      ],
      ["@babel/preset-react"]
    ]
  }
};

const typescriptLoader = {
  test: /\.tsx?$/,
  use: [
    babelLoader,
    {
      loader: "ts-loader"
      //   options: {
      //     transpileOnly: true
      //   }
    }
  ]
};

const javascriptLoader = {
  test: /\.jsx$/,
  use: babelLoader
};

const styleLoader = {
  test: /\.css$/,
  use: ["style-loader", "css-loader"]
};

module.exports = {
  mode: "development",
  entry: "./src/index.ts",
  output: {
    path: __dirname + "/dist",
    filename: "main.js"
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html"
    })
  ],
  resolve: {
    extensions: [".tsx", ".ts", ".mjs", ".js", ".jsx"]
  },
  module: {
    rules: [
      typescriptLoader,
      javascriptLoader,
      styleLoader,
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          {
            loader: "url-loader",
            options: {
              limit: 8192
            }
          }
        ]
      }
    ]
  }
};
