// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as Net from 'net';
import * as vscode from 'vscode';
import {CancellationToken, DebugAdapterTracker, DebugAdapterTrackerFactory, DebugConfiguration, ProviderResult, WorkspaceFolder,} from 'vscode';
import {DebugProtocol} from 'vscode-debugprotocol';

import {DEFAULT_SERVER_PORT, ZxdbConsole} from './console';
import * as log from './log';

let console: ZxdbConsole;

export function activate(context: vscode.ExtensionContext) {
  log.info('zxdb extension is now active!');
  console = new ZxdbConsole();
  context.subscriptions.push(
      vscode.commands.registerCommand('extension.zxdb.TestCommand', () => {
        log.info('Starting zxdb.command test', true);
        console.createZxdbTerminal();
        console.waitForZxdbConsole(10 * 60 * 1000)
            .then(
                value => {
                  log.info('zxdb.command test successful!', true);
                  console.destroyZxdbTerminal();
                },
                reason => {
                  log.error('zxdb.command test failed');
                });
      }));

  context.subscriptions.push(vscode.commands.registerCommand(
      'extension.zxdb.pickProcess', (config) => {
        let promptText: string = '';
        if (config.request === 'launch') {
          promptText =
              'Launch(zxdb): Enter name of the process that will be launched.' +
              ' Hint: For components, it\'s usually the component name.';
        } else {
          promptText = 'Attach(zxdb): Enter name of the process to debug.' +
              ' The process should already be running or should be started separately.';
        }
        // In future, add code to run ps and give a list of process to pick
        // from.
        return vscode.window.showInputBox({
          placeHolder: '(e.g. hello-world-test)',
          value: '',
          prompt: promptText
        });
      }));

  context.subscriptions.push(vscode.commands.registerCommand(
      'extension.zxdb.enterLaunchCommand', (config) => {
        return vscode.window.showInputBox({
          placeHolder: '(e.g. fx test hello-world-test)',
          value: '',
          prompt:
              'Launch(zxdb): Enter launch command. This will be run in the vscode terminal.'
        });
      }));


  vscode.window.onDidCloseTerminal((t) => {
    console.onDidCloseTerminal(t);
  });

  // register a configuration provider for 'zxdb' debug type
  const provider = new ZxdbConfigurationProvider();
  context.subscriptions.push(
      vscode.debug.registerDebugConfigurationProvider('zxdb', provider));

  let factory = new ZxdbDebugAdapterFactory();
  context.subscriptions.push(vscode.Disposable.from(
      vscode.debug.registerDebugAdapterDescriptorFactory('zxdb', factory)));

  let logger = new ZxdbDebugAdapterTrackerFactory();
  context.subscriptions.push(vscode.Disposable.from(
      vscode.debug.registerDebugAdapterTrackerFactory('zxdb', logger)));
}

// This method is called when extension is deactivated.
export function deactivate() {}

class ZxdbConfigurationProvider implements vscode.DebugConfigurationProvider {
  maxFilterNameLength = 31;
  // This method is called just before launching debug session.
  // Final updates to debug configuration can be done here.
  resolveDebugConfigurationWithSubstitutedVariables(
      folder: WorkspaceFolder|undefined, config: DebugConfiguration,
      token?: CancellationToken): ProviderResult<DebugConfiguration> {
    // if launch.json is missing or empty
    if (!config.type && !config.request && !config.name) {
      log.error(
          'launch.json does not have any zxdb configuration. Initial configurations will be ' +
          'added automatically, if not add it manually (Hint: Add Configuration -> zxdb...).\n' +
          'Next, pick a configuration in the launch configuration dropdown to start debugging.');
      return null;
    }

    if (config.process.length > this.maxFilterNameLength) {
      config.process = config.process.substring(0, this.maxFilterNameLength);
      log.warn(
          'Process name too long. It will be trimmed to "' + config.process +
          '"');
    }

    if (config.request === 'attach') {
      log.info('Attaching to ' + config.process);
    } else if (config.request === 'launch') {
      log.info(
          'Launching process ' + config.process + ' with command "' +
          config.launchCommand + '"');
    } else {
      log.error('Unknown launch config');
      return null;
    }

    return config;
  }
}
class ZxdbDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(_session: vscode.DebugSession):
      ProviderResult<vscode.DebugAdapterDescriptor> {
    // Start zxdb console and wait for it to be ready.
    // Then create a client to start debugging in vscode.
    console.createZxdbTerminal();
    return console.waitForZxdbConsole().then(() => {
      log.info('Creating debug adapter client.');
      let client = new vscode.DebugAdapterServer(DEFAULT_SERVER_PORT);
      return client;
    });
  }
}

class ZxdbDebugAdapterTracker implements DebugAdapterTracker {
  ignoreError: boolean = false;
  restart: boolean = false;
  launchPID: number|undefined = undefined;
  constructor(private readonly session: vscode.DebugSession) {}

  private toString(data: DebugProtocol.Message|Error|DebugConfiguration) {
    return JSON.stringify(data, null, 2);
  }

  public onWillStartSession() {
    this.ignoreError = false;
    log.info(`Starting debug session:\n${
        this.toString(this.session.configuration)}\n`);
  }

  public onWillReceiveMessage(message: any) {
    let request: DebugProtocol.Request = message;
    if (request.command === 'disconnect') {
      // Ignore errors reported after this. The connection is closed by the
      // backend and hence debug adapter reports connection loss errors which
      // needs to be ignored. It might confuse users if these errors are shown.
      this.ignoreError = true;
      if (request.arguments && request.arguments.restart) {
        this.restart = request.arguments.restart;
      }
    } else if (request.command === 'runInTerminal') {
      let response: DebugProtocol.RunInTerminalResponse = message;
      if (response.body.shellProcessId) {
        this.launchPID = getChildPID(response.body.shellProcessId);
      } else if (response.body.processId) {
        this.launchPID = response.body.processId;
      }
    }
    log.debug(`Sent:\n${this.toString(message)}\n`);
  }

  public onDidSendMessage(message: DebugProtocol.Message) {
    log.debug(`Received:\n${this.toString(message)}\n`);
  }

  public onWillStopSession() {
    log.info('Stopping debug Session.\n');
    if (!this.restart) {
      console.destroyZxdbTerminal();
    }
    destroyZxdbLaunch(this.launchPID);
    this.launchPID = undefined;
  }

  public onError(error: Error) {
    let logFunction = log.error;

    // If error should not be shown to user, log it as info to the output.
    if (this.ignoreError) {
      logFunction = log.info;
    }

    if (error.stack) {
      logFunction(`zxdb ${error.stack}\n`);
    } else {
      logFunction(`zxdb ${error.name}:${error.message}\n`);
    }
  }

  public onExit(code: number|undefined, signal: string|undefined) {
    log.info(`Debug adapter exited! Exit code: ${code}, signal: ${signal}.\n`);
  }
}

export class ZxdbDebugAdapterTrackerFactory implements
    DebugAdapterTrackerFactory {
  public createDebugAdapterTracker(session: vscode.DebugSession):
      ProviderResult<DebugAdapterTracker> {
    return new ZxdbDebugAdapterTracker(session);
  }
}

// Methods to control launched process
function getChildPID(pid: number): number|undefined {
  let childPID = undefined;
  if (process.platform !== 'win32') {
    childPID =
        Number(require('child_process').execSync(`pgrep -P ${pid}`) + '');
    log.debug(`Child process ID: ${childPID}`);
  }
  return childPID;
}

function destroyZxdbLaunch(pid: number|undefined) {
  if (pid) {
    log.info(`zxdb launch (PID:${pid}) is destroyed.`);
    process.kill(-pid, 2);  // SIGINT
  }
}
