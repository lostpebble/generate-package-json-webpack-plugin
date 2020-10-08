# generate-package-json-webpack-plugin

> For limiting the dependencies inside `package.json` to only those that are actually being used by your code.

### Why generate a new `package.json`?

This plugin is useful for when you have a large source project for development / testing from which smaller Node.js projects are bundled for various deployments and applications. Such as Google Cloud Functions.

_Or even just for bundling your regular Node.js server code, and knowing that your `package.json` is as lean as it can possibly be for that next deployment._

We all know how our development environments can get a bit messy... :sweat_smile:


### :floppy_disk: Install

```
npm install generate-package-json-webpack-plugin --save-dev
```

## :electric_plug: Usage

```
const basePackageValues = {
  "name": "my-nodejs-module",
  "version": "1.0.0",
  "main": "./index.js",
  "engines": {
    "node": "<= 6.9.1"
  }
}

const versionsPackageFilename = __dirname + "/package.json";

// inside your webpack configuration
plugins: [new GeneratePackageJsonPlugin(basePackageValues, versionsPackageFilename)],
```

That's pretty much it. The plugin will generate a new `package.json` file with all the dependencies your code uses, merged with the values you pass into the plugin. The versions for the detected dependencies are sourced from the `versionsPackageFilename` here.

### Important note on `externals`

The plugin only writes the dependencies of modules which are found in the input code
and have been marked in `externals` inside of your Webpack config.

This is logical because if a module is not marked as an external module it is included in
your final webpack bundle and hence wouldn't need to be installed as a dependency
again on deployment.

Because of this, this plugin is best used in conjunction with something
like [webpack-node-externals](https://github.com/liady/webpack-node-externals),
which you can use to make sure your node modules are not included with your
final `bundle.js`, like so:

```
const nodeExternals = require("webpack-node-externals");

// inside your webpack config
externals: [nodeExternals({
    whitelist: [/^module-I-want-bundled/],
})],
```

As you can see, you can add modules that you deliberately _do_ want bundled using the `whitelist` option.

### Adding modules outside of your code (build modules etc.)
#### OR to deliberately set different versions of bundled dependencies

Simply place those dependencies inside the `basePackageValues` object which represents the base of the new `package.json` to be created.

Keep the version number string empty (`""`) to pull the
version from your original `package.json` which was set with `versionsPackageFilename`.
To use a version which is different - set the version string deliberately here.

```
const basePackageValues = {
  "name": "my-nodejs-module",
  "version": "1.0.0",
  "main": "./index.js",
  "scripts": {
    "start": "cross-var node --max-old-space-size=$NODE_JS_MAX_OLD_SPACE_SIZE ./server.js"
  }
  "engines": {
    "node": "<= 6.9.1"
  },
  dependencies: {
    "cross-var": "^1.1.0",
    "cross-env": "",
  },
  peerDependencies: {
    "react" : "",
  }
}
```

In this example, `cross-var` has deliberately been set to version `^1.1.0`, and
regardless of what is in `versionsPackageFilename` it will use this version.
`cross-env` however will pull its version number from `versionsPackageFilename`.

This is mostly useful for adding dependencies which are required at runtime but which are not picked up in your webpack
bundle. Such as `cross-var` in this example which injects environment variables into a run script in a cross-platform
friendly way.

Note that the same behaviour applies to all types of dependencies (`dependencies`, `devDependencies` and 
`peerDependencies`). In this example `react` will have the same behaviour as `cross-env`, but rather than being placed 
inside the `dependencies` list in the output file, it will be placed inside the `peerDependencies` list.

## Simple API

```
new GeneratePackageJsonPlugin(basePackageValues, versionsPackageFilename, extraOptions)
```

### First argument: `basePackageValues`

( **Required** ) You should set the base values for your `package.json` file here. For example:

```
const basePackageValues = {
  "name": "my-nodejs-module",
  "version": "1.0.0",
  "main": "./bundle.js",
  "engines": {
    "node": "<= 6.9.1"
  }
}
```

This will be merged with the generated `"dependencies": { ... }` to form the final `package.json` distribution file.

### Second argument: `versionsPackageFilename`

( **Required** )

This is the filename from which the plugin will source the versions for the modules
that appear in the final generated `package.json`. Usually it will just be the base
`package.json` file in your parent directory (assuming that your development code
has been using dependencies sourced from your base `node_modules` folder):

Commonly, this will be set like this:
```
const versionsPackageFilename = __dirname + "/package.json";
```

### Third argument: `extraOptions`

( *Optional* )

An object with the following structure:

```
  {
     debug: true,
     extraSourcePackageFilenames: [
       join(__dirname, "../other-workspace/package.json"),
     ],
     additionalDependencies: {
       react: "^16.13.1",
     },
     useInstalledVersions: true,
  }
```

**The options:**

`debug` (default: *false*) : Enable to show some debugging information on how the plugin is finding dependencies and creating a new `package.json`.

`extraSourcePackageFilenames` : This is useful for mono-repos and projects where your dependencies in your code are not only defined in a single `package.json` file.
If you share code between multiple projects or "workspaces" to be bundled into a final distribution project, you probably want to set this option.

`additionalDependencies`: A dictionary of additional dependencies (same as `package.json` format) to
 add to the generated file. This is useful if you have some dependencies that are not imported in
  you code but you still want to include them.

`useInstalledVersions` (default: *false*) : Resolve node modules and use the exact version that installed in your
environment. This is useful to lock versions on production deployments.

### :mag: Things to take note of

You should remember to set the `"main": "./index.js"` to the correct filename (would probably
be the output bundle file from the same webpack task), and / or correctly set your starting script
which will be run on Node.js server deployments by `npm start`. You can set these values in
the `basePackageValues` object you pass into the plugin, example:

```
const basePackageValues = {
  "name": "my-nodejs-module",
  "version": "1.0.0",
  "main": "./bundle.js",
  "scripts": {
    "start": "node ./bundle.js"
  },
  "engines": {
    "node": "<= 6.9.1"
  }
}
```
