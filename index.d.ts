import { Plugin } from 'webpack';

declare class GeneratePackageJsonPlugin extends Plugin {
  constructor(
    basePackageValues: Record<string, unknown>,
    extraOptions?: {
      debug?: boolean;
      /** @deprecated Use sourcePackageFilenames instead */
      extraSourcePackageFilenames?: string[];
      sourcePackageFilenames?: string[];
      additionalDependencies?: Record<string, string>;
      useInstalledVersions?: boolean;
      resolveContextPaths?: string[];
    },
  );
}

export default GeneratePackageJsonPlugin;
