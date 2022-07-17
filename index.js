/**
 * Created by Paul on 2017-07-02.
 */
const fs = require("fs");
const path = require("path");
const util = require("util");
const { builtinModules } = require("module");
const { Compilation, sources } = require("webpack");

let debugMode = false;

const pluginName = "GeneratePackageJsonPlugin";
const pluginPrefix = "( Generate Package Json Webpack Plugin ): ";

function GeneratePackageJsonPlugin(
  basePackage = {
    name: "",
    version: "0.0.1",
  }, {
    debug = false,
    extraSourcePackageFilenames = [],
    sourcePackageFilenames = [],
    additionalDependencies = {},
    useInstalledVersions = true,
    resolveContextPaths,
    forceWebpackVersion,
    excludeDependencies = [],
  } = {}
) {
  if (debug) {
    console.log(`GeneratePackageJsonPlugin: Debugging mode activated!`);
    debugMode = true;
  }

  /*
  TODO for future - accept a string and load the base.package.json directly
  if (typeof otherPackageValues === "string") {
    otherPackageValues = JSON.parse(fs.readFileSync(path.join(__dirname, filename)).toString());
  }*/

  const sourcePackagesDependencyVersionMap = {};

  const allSourcePackageFilenames = [...extraSourcePackageFilenames, ...sourcePackageFilenames];

  if (allSourcePackageFilenames.length > 0) {
    logIfDebug(`GPJWP: Received ${allSourcePackageFilenames.length} extra package.json file${allSourcePackageFilenames.length > 1 ? "s" : ""} from which to source versions (later takes preference):`);
    allSourcePackageFilenames.reverse();
    let fileIndex = 1;

    for (const filename of allSourcePackageFilenames) {
      logIfDebug(`${fileIndex++} : ${filename}`);
      const extraSourcePackage = JSON.parse(fs.readFileSync(filename).toString());
      Object.assign(sourcePackagesDependencyVersionMap, extraSourcePackage.dependencies ? extraSourcePackage.dependencies : {});
    }
  }

  logIfDebug(`GPJWP: Final map of dependency versions to be used if encountered in bundle:\n`, sourcePackagesDependencyVersionMap);

  Object.assign(this, {
    basePackage,
    dependencyVersionMap: sourcePackagesDependencyVersionMap,
    additionalDependencies,
    useInstalledVersions,
    resolveContextPaths,
    forceWebpackVersion,
    excludeDependencies,
  });
}

function logIfDebug(something, object = "") {
  if (debugMode) {
    if (object) {
      console.log(something, util.inspect(object, { depth: 3 }));
    } else {
      console.log(something);
    }
  }
}

const nodeModulesPart = "node_modules";

function getNameFromPortableId(raw) {
  if (raw.indexOf("javascript\/esm") >= 0) {
    const nodeModulesLastIndex = raw.lastIndexOf(nodeModulesPart);

    if (nodeModulesLastIndex >= 0) {
      const mainModulePart = raw.slice(nodeModulesLastIndex + nodeModulesPart.length + 1);
      const firstSlashIndex = mainModulePart.indexOf(path.sep);

      if (mainModulePart.startsWith("@")) {
        const secondSlashIndex = mainModulePart.indexOf(path.sep, firstSlashIndex + 1);
        if (secondSlashIndex >= 0) {
          return `${mainModulePart.slice(0, firstSlashIndex)}/${mainModulePart.slice(firstSlashIndex + 1, secondSlashIndex)}`;
        } else {
          return `${mainModulePart.slice(0, firstSlashIndex)}/${mainModulePart.slice(firstSlashIndex + 1)}`;
        }
      } else {
        if (firstSlashIndex >= 0) {
          return mainModulePart.slice(0, firstSlashIndex);
        } else {
          return mainModulePart;
        }
      }
    } else {
      return "";
    }
  }

  let cut = raw.substring(raw.indexOf("\"") + 1, raw.lastIndexOf("\""));

  let slashCount = (cut.match(/\//g) || []).length;

  while ((cut.indexOf("@") === -1 && slashCount > 0) || slashCount > 1) {
    cut = cut.substring(0, cut.lastIndexOf("\/"));
    slashCount -= 1;
  }

  return cut;
}

const searchErrorNoExportsPart = `No "exports" main defined in `;
const packageJsonPart = "package.json";

function resolveModuleBasePath(moduleName, options = undefined) {
  let moduleMainFilePath;

  try {
    moduleMainFilePath = require.resolve(moduleName, options);
  } catch (e) {
    const message = e.message ? e.message : "";
    const indexOfMessage = message.lastIndexOf(searchErrorNoExportsPart);
    const indexOfPackage = message.lastIndexOf("package.json");

    if (indexOfMessage >= 0 && indexOfPackage >= 0) {
      moduleMainFilePath = e.message.slice(
        indexOfMessage + searchErrorNoExportsPart.length,
        indexOfPackage + packageJsonPart.length,
      );
    } else {
      throw e;
    }
  }

  const moduleNameParts = moduleName.split("/");

  let searchForPathSection;

  if (moduleName.startsWith("@") && moduleNameParts.length > 1) {
    const [org, mod] = moduleNameParts;
    searchForPathSection = `node_modules${path.sep}${org}${path.sep}${mod}`;
  } else {
    const [mod] = moduleNameParts;
    searchForPathSection = `node_modules${path.sep}${mod}`;
  }

  const lastIndex = moduleMainFilePath.lastIndexOf(searchForPathSection);

  if (lastIndex === -1) {
    throw new Error(`Couldn't resolve the base path of "${moduleName}". Searched inside the resolved main file path "${moduleMainFilePath}" using "${searchForPathSection}"`);
  }

  return moduleMainFilePath.slice(0, lastIndex + searchForPathSection.length);
}

GeneratePackageJsonPlugin.prototype.apply = function (compiler) {
  // const isWebpack5 = require("webpack").version.split(".")[0] >= 5;
  const isWebpack5 = this.forceWebpackVersion != null ? (this.forceWebpackVersion === "webpack5") : (require("webpack").version.split(".")[0] >= 5);

  const computePackageJson = (compilation) => {
    const dependencyTypes = ["dependencies", "devDependencies", "peerDependencies"]

    const modules = {};

    const getInstalledVersionForModuleName = (moduleName, context) => {
      let modulePackageFile;
      let resolveFile = path.join(moduleName, "./package.json");

      try {
        const moduleBasePath = resolveModuleBasePath(moduleName, context ? {
          paths: [context],
        } : this.resolveContextPaths ? {
          paths: this.resolveContextPaths,
        } : undefined);

        /*console.log(`Found module base path: ${moduleBasePath}`);

        modulePackageFile = require.resolve(resolveFile, context ? {
          paths: [context],
        } : this.resolveContextPaths ? {
          paths: this.resolveContextPaths,
        } : undefined);

        console.log(`Found module package.json file: ${modulePackageFile}`);*/

        modulePackageFile = path.join(moduleBasePath, "./package.json");
      } catch (e) {
        // logIfDebug(`GPJWP: Ignoring module without a found package.json: ${moduleName} ("${resolveFile}" couldn't resolve): ${e.message}`);
        console.error(`GPJWP: Ignoring module without a found package.json: ${moduleName} ("${resolveFile}" couldn't resolve): ${e.message}`);
        return undefined;
      }

      let version;
      try {
        version = JSON.parse(fs.readFileSync(modulePackageFile).toString()).version;
      } catch (e) {
        throw new Error(`Can't parse package.json file: ${modulePackageFile}`);
      }

      if (!version) {
        throw new Error(`Missing package.json version: ${modulePackageFile}`);
      }

      return version;
    }

    // const isWebpack5 = Number(wpVersion.split(".")[0]) >= 5;

    const processModule = (module) => {
      const portableId = module.portableId ? module.portableId : module.identifier();

      if (portableId.indexOf("external ") === -1) {
        logIfDebug(`GPJWP: Found module: ${portableId}`);
        return;
      }

      logIfDebug(`GPJWP: Found external module: ${portableId}`);
      const moduleName = getNameFromPortableId(portableId);

      if (moduleName === '.' || moduleName === '..') {
        logIfDebug(`GPJP: excluded "${portableId}" because it is on a relative path`);
        return;
      }

      if (this.excludeDependencies.includes(moduleName)) {
        logIfDebug(`GPJWP: excluded "${moduleName}" from generated package.json`);
        return;
      }

      if (moduleName.length === 0) {
        console.error(`GPJWP: Couldn't decipher the module name from external module input: ${portableId} - will be ignored in final output.`);
        return;
      }

      if (builtinModules.indexOf(moduleName) !== -1) {
        logIfDebug(`GPJWP: Native node.js module detected: ${portableId}`);
        return;
      }

      if (!this.useInstalledVersions) {
        const dependencyVersion = this.dependencyVersionMap[moduleName];
        if (dependencyVersion) {
          modules[moduleName] = dependencyVersion;
        }

        return;
      }

      const moduleIssuer = isWebpack5
        ? compilation.moduleGraph.getIssuer(module)
        : module.issuer;
      const context = moduleIssuer && moduleIssuer.context;

      const moduleVersion = getInstalledVersionForModuleName(moduleName, context);

      if (moduleVersion == null) {
        console.error(`GPJWP: Couldn't resolve a version for module "${moduleName}" (from portable ID: ${portableId}) - will be ignored in final output.`)
      } else {
        modules[moduleName] = moduleVersion;
      }
    };

    if (isWebpack5) {
      for (const module of compilation.modules) {
        processModule(module);
      }
    } else {
      compilation.chunks.forEach((chunk) => {
        if (typeof chunk.modulesIterable !== "undefined") { // webpack 4
          for (const module of chunk.modulesIterable) {
            processModule(module);
          }
        } else if (typeof chunk.forEachModule !== "undefined") { // webpack 3
          chunk.forEachModule((module) => {
            processModule(module);
          });
        } else { // webpack 2
          for (let i = 0; i < chunk.modules.length; i += 1) {
            const module = chunk.modules[i];
            processModule(module);
          }
        }
      });
    }

    const basePackageValues = Object.assign({}, this.basePackage);

    for (const dependencyType of dependencyTypes) {

      // Overwrite modules or set new module dependencies for those that have been
      // deliberately set in " basePackageValues.[dependencyType] "
      // This mechanism ensures that dependencies declared in the basePackageValues
      // take precedence over the found dependencies
      if (basePackageValues && basePackageValues[dependencyType]) {
        const nonWebpackModuleNames = Object.keys(basePackageValues[dependencyType]);

        for (let k = 0; k < nonWebpackModuleNames.length; k += 1) {
          const moduleName = nonWebpackModuleNames[k];
          let useVersionMap = !this.useInstalledVersions;

          if (basePackageValues[dependencyType] && basePackageValues[dependencyType][moduleName] && basePackageValues[dependencyType][moduleName].length > 0) {
            logIfDebug(`GPJWP: Adding deliberate module in "${dependencyType}" with version set deliberately: ${moduleName} -> ${basePackageValues[dependencyType][moduleName]}`);
            if (dependencyType === "dependencies") {
              modules[moduleName] = basePackageValues[dependencyType][moduleName];
            }
          } else if (this.useInstalledVersions) {
            const version = getInstalledVersionForModuleName(moduleName);
            if (version != null) {
              if (dependencyType !== "dependencies") {
                basePackageValues[dependencyType][moduleName] = version;
                delete modules[moduleName];
              } else {
                modules[moduleName] = version;
              }
            } else {
              console.warn(`${pluginPrefix}Couldn't find installed version for module "${moduleName}" - falling back to extra source package version map (if provided)`);
              useVersionMap = true;
            }
          }

          if (useVersionMap) {
            if (this.dependencyVersionMap[moduleName] != null) {
              logIfDebug(`GPJWP: Adding deliberate module in "${dependencyType}" with version found in sources: ${moduleName} -> ${this.dependencyVersionMap[moduleName]}`);
              if (dependencyType !== "dependencies") {
                basePackageValues[dependencyType][moduleName] = this.dependencyVersionMap[moduleName];
                delete modules[moduleName];
              } else {
                modules[moduleName] = this.dependencyVersionMap[moduleName];
              }
            } else {
              console.warn(`${pluginPrefix}You have set a module in "${dependencyType}" to be included deliberately with name: "${moduleName}" - but there is no version specified in any source files, or found to be installed (if you used the option useInstalledVersions)!`);
            }
          }
        }
      }
    }

    Object.assign(modules, this.additionalDependencies);

    logIfDebug(`GPJWP: Modules to be used in generated package.json`, modules);

    const finalPackageValues = Object.assign({}, basePackageValues, { dependencies: orderKeys(modules) });
    return JSON.stringify(finalPackageValues, this.replacer ? this.replacer : null, this.space ? this.space : 2);
  };

  const emitPackageJsonOld = (compilation, callback) => { // webpack 2-4
    const json = computePackageJson(compilation);
    compilation.assets['package.json'] = {
      source: function () {
        return json;
      },
      size: function () {
        return json.length;
      }
    };
    callback();
  };

  const emitPackageJson = (compilation) => {
    const json = computePackageJson(compilation);
    compilation.emitAsset('package.json', new sources.RawSource(json));
  };

  if (isWebpack5) {
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: pluginName, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => emitPackageJson(compilation)
      );
    });
  } else {
    if (typeof compiler.hooks !== "undefined") { // webpack 4
      compiler.hooks.emit.tapAsync(pluginName, emitPackageJsonOld);
    } else { // webpack 2-3
      compiler.plugin('emit', emitPackageJsonOld);
    }
  }
};

function orderKeys(obj) {
  const keys = Object.keys(obj).sort(function keyOrder(k1, k2) {
    if (k1 < k2) return -1;
    else if (k1 > k2) return +1;
    else return 0;
  });

  let i, after = {};
  for (i = 0; i < keys.length; i++) {
    after[keys[i]] = obj[keys[i]];
    delete obj[keys[i]];
  }

  for (i = 0; i < keys.length; i++) {
    obj[keys[i]] = after[keys[i]];
  }
  return obj;
}

module.exports = GeneratePackageJsonPlugin;
