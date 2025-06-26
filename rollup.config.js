import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";
import { terser } from "rollup-plugin-terser";
import peerDepsExternal from "rollup-plugin-peer-deps-external";

export default {
	input: "src/lib/index.js",
	output: [
		{
			file: "dist/index.js",
			format: "cjs",
			sourcemap: true,
		},
		{
			file: "dist/index.esm.js",
			format: "esm",
			sourcemap: true,
		},
		{
			file: "dist/index.min.js",
			format: "umd",
			name: "VideoEditorAI",
			sourcemap: true,
			plugins: [terser()],
		},
	],
	external: ["react", "react-dom", "@ffmpeg/ffmpeg", "@ffmpeg/util"],
	plugins: [
		peerDepsExternal(),
		resolve({
			extensions: [".js", ".jsx"],
		}),
		commonjs({
			include: "node_modules/**",
		}),
		babel({
			exclude: "node_modules/**",
			babelHelpers: "bundled",
			presets: ["@babel/preset-env", "@babel/preset-react"],
		}),
	],
};
