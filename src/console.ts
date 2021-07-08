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
import * as log from './log';


export const DEFAULT_ZXDB_COMMAND = 'fx debug -- --enable-debug-adapter';
export const DEFAULT_ZXDB_TIMEOUT =
    30000;  // 30 seconds. Taken from fx debug timeout of 10s + buffer time.
export const DEFAULT_SERVER_PORT = 15678;
type TimerCallback = () => void;

export class ZxdbConsole {
  terminal: vscode.Terminal|undefined;
  terminalPID: number|undefined;
  timer: NodeJS.Timeout|undefined;
  timerCallback: TimerCallback|undefined;

  public createZxdbTerminal() {
    if (this.terminal) {
      return;
    }
    try {
      this.terminal = vscode.window.createTerminal(`zxdb console`);
      let command: string =
          vscode.workspace.getConfiguration().get('zxdb.command') ??
          DEFAULT_ZXDB_COMMAND;
      this.terminal.sendText(command);
      this.terminal.show(true);
      this.terminal.processId.then((id) => {
        this.terminalPID = id;
        if (this.terminal) {
          log.info(
              `${this.terminal.name} launched with pid ${this.terminalPID}`);
        }
      });
    } catch (Error) {
      vscode.window.showErrorMessage(Error);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }


  public async waitForZxdbConsole(timeoutOverride?: number) {
    return new Promise<void>(async (resolve, reject) => {
      // This method waits for the spawned zxdb console to be ready.
      // We check this by connecting to the debug adapter server port.
      // Once the connection succeeds, it means the server is ready.
      // We disconnect and continue debugging.
      let timeout: number =
          vscode.workspace.getConfiguration().get('zxdb.timeout') ??
          DEFAULT_ZXDB_TIMEOUT;
      if (timeoutOverride) {
        timeout = timeoutOverride;
      }
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
            await this.sleep(1000);
            connect();
          }
        };

        socket.on('error', (err) => {
          log.debug('socket error - ' + err);
          retryConnect();
        });
      };


      connect();
      this.timerCallback = () => {
        retry = false;
        if (socket) {
          socket.destroy();
        }
        if (!connected) {
          this.destroyZxdbTerminal();
          log.info('Timeout starting zxdb console.');
          reject(
              'Timeout starting zxdb console. See https://tinyurl.com/zxdb-troubleshooting');
        }
      };

      this.timer = setTimeout(this.timerCallback, timeout);
    });
  }

  public destroyZxdbTerminal() {
    log.info('zxdb console is destroyed.');
    if (this.terminalPID) {
      process.kill(-this.terminalPID);
      this.terminalPID = undefined;
    }
    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = undefined;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  public onDidCloseTerminal(t: vscode.Terminal) {
    if (t === this.terminal) {
      if (this.timer) {
        clearTimeout(this.timer);
      }
      if (this.timerCallback) {
        this.timerCallback();
      }
    }
  }
}
