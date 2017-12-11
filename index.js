/**
 * Created by Paul on 2017-07-02.
 */
const fs = require("fs");
const util = require("util");

let debugMode = false;

function GeneratePackageJsonPlugin(otherPackageValues = {
  name: "",
  version: "0.0.1",
}, versionsPackageFilename = null, {
  debug = false,
  extraSourcePackageFilenames = [],
} = {}) {
  if (versionsPackageFilename === null) {
    throw new Error("GeneratePackageJsonPlugin: Must provide a source file for package.json as second plugin argument");
  }

  if (debug) {
    console.log(`GeneratePackageJsonPlugin: Debugging mode activated!`);
    debugMode = true;
  }

  const extraSourcePackagesDependenciesCombined = {};

  if (extraSourcePackageFilenames.length > 0) {
    logIfDebug(`GPJWP: Received ${extraSourcePackageFilenames.length} extra package.json file${extraSourcePackageFilenames.length > 1 ? "s" : ""} from which to source versions (later takes preference):`);
    extraSourcePackageFilenames.reverse();
    let fileIndex = 1;

    for (const filename of extraSourcePackageFilenames) {
      logIfDebug(`${fileIndex++} : ${filename}`);
      const extraSourcePackage = JSON.parse(fs.readFileSync(filename).toString());
      Object.assign(extraSourcePackagesDependenciesCombined, extraSourcePackage.dependencies ? extraSourcePackage.dependencies : {});
    }
  }

  const sourcePackage = JSON.parse(fs.readFileSync(versionsPackageFilename).toString());
  const dependencyVersionMap = Object.assign({}, extraSourcePackagesDependenciesCombined, sourcePackage.dependencies, sourcePackage.devDependencies);

  logIfDebug(`GPJWP: Final map of dependency versions to be used if encountered in bundle:\n`, dependencyVersionMap);

  Object.assign(this, { otherPackageValues, dependencyVersionMap });
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

function getNameFromPortableId(raw) {
  let cut = raw.substring(raw.indexOf("\"") + 1, raw.lastIndexOf("\""));

  let slashCount = (cut.match(/\//g) || []).length;

  while ((cut.indexOf("@") === -1 && slashCount > 0) || slashCount > 1) {
    cut = cut.substring(0, cut.lastIndexOf("\/"));
    slashCount -= 1;
  }

  return cut;
}

GeneratePackageJsonPlugin.prototype.apply = function(compiler) {
  compiler.plugin('emit', (compilation, callback) => {
    const modules = {};
    
    compilation.chunks.forEach((chunk) => {
      if (typeof chunk.forEachModule !== "undefined") {
        chunk.forEachModule((module) => {
          if (module.portableId.indexOf("external") !== -1) {
            logIfDebug(`GPJWP: Found external module: ${module.portableId}`);
            const moduleName = getNameFromPortableId(module.portableId);
            const dependencyVersion = this.dependencyVersionMap[moduleName];
            if (dependencyVersion) {
              modules[moduleName] = dependencyVersion;
            }
          } else {
            logIfDebug(`GPJWP: Found module: ${module.portableId}`);
          }
        });
      } else {
        for (let i = 0; i < chunk.modules.length; i += 1) {
          const module = chunk.modules[i];

          if (module.portableId.indexOf("external") !== -1) {
            logIfDebug(`GPJWP: Found external module: ${module.portableId}`);
            const moduleName = getNameFromPortableId(module.portableId);
            const dependencyVersion = this.dependencyVersionMap[moduleName];
            if (dependencyVersion) {
              modules[moduleName] = dependencyVersion;
            }
          } else {
            logIfDebug(`GPJWP: Found module: ${module.portableId}`);
          }
        }
      }
    });

    // Overwrite modules or set new module dependencies for those that have been
    // deliberately set in " otherPackageValues.dependencies "
    if (this.otherPackageValues && this.otherPackageValues.dependencies) {
      const nonWebpackModuleNames = Object.keys(this.otherPackageValues.dependencies);

      for (let k = 0; k < nonWebpackModuleNames.length; k += 1) {
        const moduleName = nonWebpackModuleNames[k];

        if (this.otherPackageValues.dependencies[moduleName].length > 0) {
          logIfDebug(`GPJWP: Adding deliberate module with version set deliberately: ${moduleName} -> ${this.otherPackageValues.dependencies[moduleName]}`);
          modules[moduleName] = this.otherPackageValues.dependencies[moduleName];
        } else {
          logIfDebug(`GPJWP: Adding deliberate module with version found in sources: ${moduleName} -> ${this.dependencyVersionMap[moduleName]}`);
          modules[moduleName] = this.dependencyVersionMap[moduleName];
        }
      }
    }

    logIfDebug(`GPJWP: Modules to be used in generated package.json`, modules);

    Object.assign(this.otherPackageValues, { dependencies: orderKeys(modules) });
    const json = JSON.stringify(this.otherPackageValues, this.replacer ? this.replacer : null, this.space ? this.space : 2);

    compilation.assets['package.json'] = {
      source: function() {
        return json;
      },
      size: function() {
        return json.length;
      }
    };
    
    callback();
  });
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
