/**
 * Created by Paul on 2017-07-02.
 */
const fs = require("fs");

function GeneratePackageJsonPlugin(otherPackageValues = {
  name: "",
  version: "0.0.1",
}, versionsPackageFilename = null) {
  if (versionsPackageFilename === null) {
    versionsPackageFilename = __dirname + "/package.json";
    // throw new Error("Must provide a source file for package.json dependency versions");
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
    compilation.chunks.forEach((chunk) => {
      const modules = {};

      chunk.forEachModule((module) => {
        if (module.portableId.indexOf("external") !== -1) {
          const moduleName = getNameFromPortableId(module.portableId);
          modules[moduleName] = this.dependencyVersionMap[moduleName];
        }
      });

      Object.assign(this.otherPackageValues, { dependencies: modules });
      const json = JSON.stringify(this.otherPackageValues, this.replacer ? this.replacer : null, this.space ? this.space : 2);

      compilation.assets['package.json'] = {
        source: function() {
          return json;
        },
        size: function() {
          return json.length;
        }
      };
    });

    callback();
  });
};

module.exports = GeneratePackageJsonPlugin;
