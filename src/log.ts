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

import * as vscode from 'vscode';

export const DEBUG =
    vscode.workspace.getConfiguration().get('zxdb.debug') ?? false;
const zxdbOutput = vscode.window.createOutputChannel('zxdb');

function log(type: string, message: string) {
  let logMessage = `[${new Date().toISOString()}] ${type} (zxdb): ${message}`;
  console.log(logMessage);
  zxdbOutput.appendLine(logMessage);
}

export function debug(message: string) {
  if (DEBUG) {
    log('DEBUG', message);
  }
}

export function info(message: string, show: boolean = false) {
  log('INFO', message);
  if (show) {
    vscode.window.showInformationMessage(message);
  }
}

export function warn(message: string) {
  log('WARNING', message);
  vscode.window.showWarningMessage(message);
}

export function error(message: string) {
  log('DEBUG', message);
  vscode.window.showErrorMessage(message);
}
