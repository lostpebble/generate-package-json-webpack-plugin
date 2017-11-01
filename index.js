/**
 * Created by Paul on 2017-07-02.
 */
const fs = require("fs");

function GeneratePackageJsonPlugin(otherPackageValues = {
  name: "",
  version: "0.0.1",
}, versionsPackageFilename = null) {
  if (versionsPackageFilename === null) {
    throw new Error("GeneratePackageJsonPlugin: Must provide a source file for package.json as second plugin argument");
  }

  const sourcePackage = JSON.parse(fs.readFileSync(versionsPackageFilename).toString());
  const dependencyVersionMap = Object.assign({}, sourcePackage.dependencies, sourcePackage.devDependencies);

  Object.assign(this, { otherPackageValues, dependencyVersionMap });
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
            const moduleName = getNameFromPortableId(module.portableId);
            modules[moduleName] = this.dependencyVersionMap[moduleName];
          }
        });
      } else {
        for (let i = 0; i < chunk.modules.length; i += 1) {
          const module = chunk.modules[i];

          if (module.portableId.indexOf("external") !== -1) {
            const moduleName = getNameFromPortableId(module.portableId);
            modules[moduleName] = this.dependencyVersionMap[moduleName];
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
          modules[moduleName] = this.otherPackageValues.dependencies[moduleName];
        } else {
          modules[moduleName] = this.dependencyVersionMap[moduleName];
        }
      }
    }

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
