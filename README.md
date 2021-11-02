# generate-package-json-webpack-plugin

> For limiting the dependencies inside `package.json` to only those that are actually being used by your code.

### Why generate a new `package.json`?

This plugin is useful for when you have a large source project for development / testing from which smaller Node.js
projects are bundled for various deployments and applications. Such as Google Cloud Functions.

_Or even just for bundling your regular Node.js server code, and knowing that your `package.json` is as lean as it can
possibly be for that next deployment._

We all know how our development environments can get a bit messy... :sweat_smile:

### :floppy_disk: Install

```
npm install generate-package-json-webpack-plugin --save-dev
```

## :electric_plug: Usage

```
const basePackage = {
  "name": "my-nodejs-module",
  "version": "1.0.0",
  "main": "./index.js",
  "engines": {
    "node": ">= 14"
  }
}

// inside your webpack configuration
plugins: [new GeneratePackageJsonPlugin(basePackage)],
```

That's pretty much it. The plugin will generate a new `package.json` file with all the dependencies your code uses. The
versions for the detected dependencies are sourced directly from the modules inside `node_modules`.

**N.B.** This base package file is deliberately barren, as a base to build upon for our final output `package.json`- any
dependencies listed inside of it will be set deliberately and interpretted differently by the generation process. [See
below for more information](#adding-modules-outside-of-your-code-build-modules-etc).

### Important note on `externals`

The plugin only writes the dependencies of modules which are found in the input code and have been marked in `externals`
inside of your Webpack config.

This is logical because if a module is not marked as an external module it is included in your final webpack bundle and
hence wouldn't need to be installed as a dependency again on deployment.

Because of this, this plugin is best used in conjunction with something
like [webpack-node-externals](https://github.com/liady/webpack-node-externals), which you can use to make sure your node
modules are not included with your final `bundle.js`, like so:

```
const nodeExternals = require("webpack-node-externals");

// inside your webpack config
externals: [nodeExternals({
    whitelist: [/^module-I-want-bundled/],
})],
```

As you can see, you can add modules that you deliberately _do_ want bundled using the `whitelist` option.

### Adding modules outside of your code (build modules etc.)

#### OR to deliberately set different versions of bundled dependencies, or as different dependency type (`peerDependencies`, for example)

Simply place those dependencies inside the `basePackageValues` object which represents the base of the
new `package.json` to be created.

Keep the version number string empty (`""`) to have the plugin resolve the version. To use a version which is
different, set the version string deliberately here.

```
const basePackageValues = {
  "name": "my-nodejs-module",
  "version": "1.0.0",
  "main": "./index.js",
  "scripts": {
    "start": "cross-var node --max-old-space-size=$NODE_JS_MAX_OLD_SPACE_SIZE ./server.js"
  }
  "engines": {
    "node": ">= 14"
  },
  devDependencies: {
    "cross-var": "^1.1.0",
    "cross-env": "",
  },
  peerDependencies: {
    "react" : "",
  }
}
```

In this example, `cross-var` has deliberately been set to version `^1.1.0`, and regardless of what is actually installed
it will use this version.
`cross-env` however will pull its version number from `node_modules`.

This is mostly useful for adding dependencies which are required at runtime but which are not picked up in your webpack
bundle. Such as `cross-var` in this example which injects environment variables into a run script in a cross-platform
friendly way.

Note that the same behaviour applies to all types of dependencies (`dependencies`, `devDependencies` and
`peerDependencies`). In this example `react` will have the same behaviour as `cross-env`, but rather than being placed
inside the `dependencies` list in the output file, it will be placed inside the `peerDependencies` list.

## Simple API

```
new GeneratePackageJsonPlugin(basePackage, options)
```

### First argument: `basePackage`

( **Required** ) You should set the base values for your `package.json` file here. For example:

```
const basePackage = {
  "name": "my-nodejs-module",
  "version": "1.0.0",
  "main": "./bundle.js",
  "engines": {
    "node": ">= 14"
  }
}
```

This will be merged with the generated `"dependencies": { ... }` to form the final `package.json` distribution file.

### Second argument: `options`

( *Optional* )

An object with the following structure:

```
  {
     debug: true,
     useInstalledVersions: true,
     resolveContextPaths: [__dirname],
     sourcePackageFilenames: [
       join(__dirname, "../other-workspace/package.json"),
     ],
     forceWebpackVersion: "webpack5",
     excludeDependencies: ["aws-sdk"],
  }
```

**The options:**

`debug` (default: *false*) : Enable to show some debugging information on how the plugin is finding dependencies and
creating a new `package.json`.

`useInstalledVersions` (default: *true*) : Resolve node modules and use the exact version that is installed in your
environment. This is useful to lock versions on production deployments. This is the default and easiest way to use the
plugin, if this is not enabled then you should be providing package.json files in `sourcePackageFilenames` from which
the plugin will source module versions.

`resolveContextPaths`: Context paths for the internal resolve behaviour that looks upwards for `node_modules` to pull
the versions from. The current directory is the default, but if you have a monorepo, there are edge cases where defining
multiple contexts could be useful.

`sourcePackageFilenames` : If the default `useInstalledVersions` option is set, then this is only used as a final
fallback for finding versions. This is useful for mono-repos and projects where your dependencies in your code are not
only defined from a single contextual project. If you share code between multiple projects or "workspaces" to be bundled
into a final distribution project, you might want to set this option.

`forceWebpackVersion` (optional- by default the plugin will attempt to detect the version) : This can be set to one of: 
`webpack4` or `webpack5`. If you are using a version of Webpack lower than 4- then set it to `webpack4`. This may help
folks who are using Webpack in an environment where multiple versions might be present.

`excludeDependencies` : Here you can set any dependencies you absolutely never want in your output `package.json` file, 
even if they happen to be used by your code. This is useful in some edge cases, such as where an execution environment
provides these dependencies for you automatically, without installation required.

### :mag: Things to take note of

You should remember to set the `"main": "./index.js"` to the correct filename (would probably be the output bundle file
from the same webpack task), and / or correctly set your starting script which will be run on Node.js server deployments
by `npm start`. You can set these values in the `basePackage` object you pass into the plugin, example:

```
const basePackage = {
  "name": "my-nodejs-module",
  "version": "1.0.0",
  "main": "./bundle.js",
  "scripts": {
    "start": "node ./bundle.js"
  },
  "engines": {
    "node": ">= 14"
  }
}
```
