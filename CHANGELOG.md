# Change Log

All notable changes to the "zxdb" extension will be documented in this file.

## [0.0.1]

- Initial release : Extension for fuchsia debugger
  - Visual studio code extension for zxdb - the fuchsia debugger.

## [0.0.2]

- Added logo

## [1.0.0]

- Marketplace release

## [1.0.1]

- Trim process name to 32 characters. Update Readme.

## [1.0.2]

- Use "ffx debug" instead of "fx debug" which supports out-of-tree debugging.
- Update the dependency.

## [1.0.3]

- Trim process name to 31 characters because NUL is the last character in
  Zircon.

## [1.0.4]

- Add deprecation warning. Please use [Fuchsia extension](https://marketplace.visualstudio.com/items?itemName=fuchsia-authors.vscode-fuchsia) instead.
