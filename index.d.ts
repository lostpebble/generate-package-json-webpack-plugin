import { Plugin } from 'webpack';

declare class GeneratePackageJsonPlugin extends Plugin {
  constructor(
    basePackageValues: Record<string, unknown>,
    extraOptions?: {
      debug?: boolean;
      /** @deprecated Use sourcePackageFilenames instead */
      extraSourcePackageFilenames?: string[];
      sourcePackageFilenames?: string[];
      /** @deprecated Simply add these dependencies to your base package.json */
      additionalDependencies?: Record<string, string>;
      useInstalledVersions?: boolean;
      resolveContextPaths?: string[];
      forceWebpackVersion?: "webpack4" | "webpack5";
      excludeDependencies?: string[];
    },
  );
}

export = GeneratePackageJsonPlugin;
