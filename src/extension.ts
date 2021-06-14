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
import * as log from './log';

let terminal: vscode.Terminal|undefined;
let terminalPID: number|undefined;

const DEFAULT_ZXDB_COMMAND = 'fx debug -- --enable-debug-adapter';
function createZxdbTerminal() {
  if (terminal) {
    destroyZxdbTerminal();
  }
  try {
    terminal = vscode.window.createTerminal(`zxdb console`);
    let command: string =
        vscode.workspace.getConfiguration().get('zxdb.command') ??
        DEFAULT_ZXDB_COMMAND;
    terminal.sendText(command);
    terminal.show(true);
    terminal.processId.then((id) => {
      terminalPID = id;
      if (terminal) {
        log.info(`${terminal.name} launched with pid ${terminalPID}`);
      }
    });
  } catch (Error) {
    vscode.window.showErrorMessage(Error);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const DEFAULT_ZXDB_TIMEOUT =
    30000;  // 30 seconds. Taken from fx debug timeout of 10s + buffer time.
async function waitForZxdbConsole() {
  return new Promise<void>(async (resolve, reject) => {
    // This method waits for the spawned zxdb console to be ready.
    // We check this by connecting to the debug adapter server port.
    // Once the connection succeeds, it means the server is ready.
    // We disconnect and continue debugging.
    let timeout: number =
        vscode.workspace.getConfiguration().get('zxdb.timeout') ??
        DEFAULT_ZXDB_TIMEOUT;
    let socket: Net.Socket;
    let connected = false;
    let retry = true;
    let connect = () => {
      socket = new Net.Socket();
      socket.connect(DEFAULT_SERVER_PORT, 'localhost');

      socket.on('connect', () => {
        connected = true;
        log.info('zxdb console has started.');
        socket.destroy();
        resolve();
      });

      let retryConnect = async () => {
        if (retry) {
          socket.destroy();
          await sleep(1000);
          connect();
        }
      };

      socket.on('error', (err) => {
        log.debug('socket error - ' + err);
        retryConnect();
      });
    };
    connect();

    setTimeout(() => {
      retry = false;
      if (socket) {
        socket.destroy();
      }
      if (!connected) {
        destroyZxdbTerminal();
        log.info('Timeout starting zxdb console.');
        reject('Timeout starting zxdb console.');
      }
    }, timeout);
  });
}

function destroyZxdbTerminal() {
  if (terminalPID) {
    process.kill(-terminalPID);
    terminalPID = undefined;
  }
  if (terminal) {
    terminal.dispose();
    terminal = undefined;
  }
}

export function activate(context: vscode.ExtensionContext) {
  log.info('zxdb extension is now active!');
  context.subscriptions.push(vscode.commands.registerCommand(
      'extension.zxdb.pickProcess', (config) => {
        // In future, add code to run ps and give a list of process to pick
        // from.
        return vscode.window.showInputBox({
          placeHolder: 'Please enter the name of the process to attach to',
          value: '',
        });
      }));

  context.subscriptions.push(vscode.commands.registerCommand(
      'extension.zxdb.enterLaunchCommand', (config) => {
        return vscode.window.showInputBox({
          placeHolder:
              'Please enter the command to launch the process from terminal (eg. fx shell ls)',
          value: '',
        });
      }));

  // register a configuration provider for 'zxdb' debug type
  const provider = new ZxdbConfigurationProvider();
  context.subscriptions.push(
      vscode.debug.registerDebugConfigurationProvider('zxdb', provider));

  // register a dynamic configuration provider for 'zxdb' debug type
  // This is called when `zxdb..` is picked from dropdown of left panel `Run and
  // Debug`
  context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider(
      'zxdb', {
        provideDebugConfigurations(folder: WorkspaceFolder|undefined):
            ProviderResult<DebugConfiguration[]> {
              return [
                {
                  name: 'zxdb launch',
                  request: 'launch',
                  type: 'zxdb',
                  process: '${command:PickProcess}',
                  launchCommand: '${command:EnterLaunchCommand}',
                },
                {
                  name: 'zxdb attach',
                  request: 'attach',
                  type: 'zxdb',
                  process: '${command:PickProcess}',
                },
              ];
            },
      },
      vscode.DebugConfigurationProviderTriggerKind.Dynamic));

  let factory = new ZxdbDebugAdapterFactory();
  context.subscriptions.push(
      vscode.debug.registerDebugAdapterDescriptorFactory('zxdb', factory));
  if ('dispose' in factory) {
    context.subscriptions.push(factory);
  }

  let logger = new ZxdbDebugAdapterTrackerFactory();
  context.subscriptions.push(
      vscode.debug.registerDebugAdapterTrackerFactory('zxdb', logger));
  if ('dispose' in logger) {
    context.subscriptions.push(logger);
  }
}

// This method is called when extension is deactivated.
export function deactivate() {}

class ZxdbConfigurationProvider implements vscode.DebugConfigurationProvider {
  // This method is called just before launching debug session.
  // Final updates to debug configuration can be done here.
  resolveDebugConfiguration(
      folder: WorkspaceFolder|undefined, config: DebugConfiguration,
      token?: CancellationToken): ProviderResult<DebugConfiguration> {
    // if launch.json is missing or empty
    if (!config.type && !config.request && !config.name) {
      config.type = 'zxdb';
      config.request = 'attach';
      config.name = 'zxdb attach process';
      config.process = '${command:PickProcess}';
    }

    if (config.request === 'attach') {
      log.info('Attaching to ' + config.process);
    } else if (config.request === 'launch') {
      log.info(
          'Launching process ' + config.process + ' with command "' +
          config.launchCommand + '"');
    } else {
      log.error('Unknown launch config');
    }

    return config;
  }
}

const DEFAULT_SERVER_PORT = 15678;
class ZxdbDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(_session: vscode.DebugSession):
      ProviderResult<vscode.DebugAdapterDescriptor> {
    // Start zxdb console and wait for it to be ready.
    // Then create a client to start debugging in vscode.
    createZxdbTerminal();
    return waitForZxdbConsole().then(() => {
      log.info('Creating debug adapter client.');
      let client = new vscode.DebugAdapterServer(DEFAULT_SERVER_PORT);
      return client;
    });
  }
}

class ZxdbDebugAdapterTracker implements DebugAdapterTracker {
  ignoreError: boolean = false;
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
    }
    log.debug(`Sent:\n${this.toString(message)}\n`);
  }

  public onDidSendMessage(message: DebugProtocol.Message) {
    log.debug(`Received:\n${this.toString(message)}\n`);
  }

  public onWillStopSession() {
    log.info('Stopping debug Session.\n');
    destroyZxdbTerminal();
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
