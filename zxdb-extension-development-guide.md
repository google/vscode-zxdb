# zxdb extension development guide

## What's in the folder

- This folder contains all of the files necessary for zxdb extension.
- `package.json` - this is the manifest file in which the extension and it's command is declared.
  - This plugin contributes `debuggers`. [More info](https://code.visualstudio.com/api/extension-capabilities/common-capabilities)
- `src/extension.ts` - this is the main file where has the implementation.
  - The file exports a function, `activate`, which is called the very first time zxdb extension is activated. Inside the `activate` function we call `registerCommand`.
  - We pass the function containing the implementation of the command as the second parameter to `registerCommand`.
  - We also register a `DebugAdapterDescriptorFactory` which is a `DebugAdapterServer` started at 15678 port.

## Set up and Run straight away

Set up -

- Do `npm install` in the extension folder for the first time to get all the necessary node modules.
- There are two launch configurations: `Run Extension` and `Extension Tests`.
  You can pick either to build the extension. The former runs the extension after building,
  the later runs tests after building.

Running extension -

Running the extension launches another instance of vscode in which the entension will be installed.
This will be named `[Extension Development Host]`. You can open fuchsia workspace in this window
and start using the extension to debug fuchsia programs. In the meantime, the primary vscode window
is controlling the extension and one can insert breakpoints/monitor extension logs and debug it.

- Press `F5` to launch `Run Extension`. It opens a new window with your extension loaded.
- Run the zxdb debug session in the extension development host by pressing `F5`.
- Set breakpoints in `src/extension.ts` to debug your extension.
- Find output from your extension in the debug console.

## Make changes

- You can relaunch the extension from the debug toolbar after changing code in `src/extension.ts`.
- You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

## Run tests

- Open the debug viewlet (`Ctrl+Shift+D` or `Cmd+Shift+D` on Mac) and from the launch configuration dropdown pick `Extension Tests`.
- Press `F5` to run the tests in a new window with your extension loaded.
- See the output of the test result in the debug console.
- Make changes to `src/test/suite/extension.test.ts` or create new test files inside the `test/suite` folder.
  - The provided test runner will only consider files matching the name pattern `**.test.ts`.
  - You can create folders inside the `test` folder to structure your tests any way you want.

## Distribute extension

Two ways to do it -

- [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
  on the VSCode extension marketplace.
- Distribute as .vsix
  - Create the package
  ```
  cd <extension folder>
  vsce package
  ```
  - Go to "Extensions > ... (Views and More Actions) > Install from VSIX... " and pick the VSIX file. Alternatively, you can run this command in terminal -
    ```
    code --install-extension <extension-name>.vsix
    ```
