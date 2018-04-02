
let config = {
	mode: "development",
	entry: "./src/index.ts",
	resolve: {
		extensions: [".js",".ts"]
	},
	module: {
		rules: [
			{ test: /\.ts$/, loader: "ts-loader" }
		]
	},
	devtool: "nosources-source-map"
}

export default config