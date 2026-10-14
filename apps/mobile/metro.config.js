// Config necesaria en un monorepo pnpm: por defecto Metro no sigue los
// symlinks de pnpm hacia `packages/core`, así que hay que decirle
// explícitamente dónde mirar. Ver https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm may give dependencies in the shared store different peer-dependency
// variants of React. Force every React import in the mobile bundle to use the
// versions declared by this app, including JSX runtime and React DOM on web.
const mobileReactRoot = path.resolve(projectRoot, "node_modules/react");
const mobileReactDomRoot = path.resolve(projectRoot, "node_modules/react-dom");
const resolveFromMobileRuntime = (context, moduleName, platform) => {
  let packageRoot;
  let subpath;

  if (moduleName === "react" || moduleName.startsWith("react/")) {
    packageRoot = mobileReactRoot;
    subpath = moduleName.slice("react".length).replace(/^\//, "");
  } else if (moduleName === "react-dom" || moduleName.startsWith("react-dom/")) {
    packageRoot = mobileReactDomRoot;
    subpath = moduleName.slice("react-dom".length).replace(/^\//, "");
  }

  if (packageRoot) {
    const target = subpath ? path.join(packageRoot, subpath) : packageRoot;
    return context.resolveRequest(context, target, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.resolveRequest = resolveFromMobileRuntime;

module.exports = config;
