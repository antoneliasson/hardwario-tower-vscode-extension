/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable import/extensions */
/* eslint-disable consistent-return */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-template-curly-in-string */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import request = require('request');
import Terminal from './terminal';

/**
 * Constants that represent the platform that the VSCode runs on
 */
export const WINDOWS = process.platform.startsWith('win');
export const MACOS = process.platform === 'darwin';
export const LINUX = !WINDOWS && !MACOS;

/* URL for the list of firmware available for the HARDWARIO TOWER */
const FIRMWARE_JSON_URL = 'https://firmware.hardwario.com/tower/api/v1/list';

export const includePathSetting : string[] = [
  '${workspaceFolder}/app/**',
  '${workspaceFolder}/src/**',
  '${workspaceFolder}/sdk/bcl/inc',
  '${workspaceFolder}/sdk/bcl/stm/inc',
  '${workspaceFolder}/sdk/sys/inc',
  '${workspaceFolder}/sdk/stm/spirit1/inc',
  '${workspaceFolder}/sdk/stm/hal/inc',
  '${workspaceFolder}/sdk/stm/usb/inc',
  '${workspaceFolder}/sdk/twr/**',
  '${workspaceFolder}/sdk/lib/**',
  '${default}',
];

export const browsePathSetting : string[] = [
  '${workspaceFolder}/app',
  '${workspaceFolder}/src',
  '${workspaceFolder}/sdk/bcl',
  '${workspaceFolder}/sdk/twr',
  '${workspaceFolder}/sdk/lib',
  '${workspaceFolder}/sdk/sys',
  '${workspaceFolder}/sdk/stm',
  '${default}',
];

const commandExistsSync = require('command-exists').sync;

/**
 * Downloads and updates the list of available firmware for the HARDWARIO TOWER
 * @returns promise that resolves when the firmware list is downloaded
 */
export function updateFirmwareJson() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  return new Promise((resolve) => {
    request.get(FIRMWARE_JSON_URL, (_err, _response, body) => {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
      resolve(body);
    });
  });
}

/**
 * Checks if the version of VSCode is portable or normally installed
 * There are few things that are based on this (PATH variable, etc.)
 * @returns true if portable, false otherwise
 */
export function isPortable() {
  /* Windows and linux versions are detected based on the window title */
  if (WINDOWS || LINUX) {
    const config = vscode.workspace.getConfiguration('window');
    const title = config.get('title');

    const titleString = title.toString();

    if (titleString.includes('HARDWARIO Code')) {
      return true;
    }

    return false;
  }
  /* MACOS is decided by a presence special env variable */
  if (MACOS) {
    if (process.env.VSCODE_PORTABLE !== undefined) {
      return true;
    }

    return false;
  }
  return false;
}

/**
 * Checks if the command exists in PATH and shows a warning if it does not
 * @param command what command should be checked
 * @param warningMessage warning message shown to the user if the command does not exist
 * @param firstOption what option should be given to the user as a first button
 * @param secondOption what option should be given to the user as a second option
 * @param guideLink link to website with a guide how to solve the missing command
 */
export function checkCommand(command, warningMessage, firstOption, secondOption, guideLink) {
  if (!commandExistsSync(command)) {
    vscode.window.showWarningMessage(
      warningMessage,
      firstOption,

      secondOption,
    )
      .then((answer) => {
        if (answer === firstOption) {
          vscode.env.openExternal(vscode.Uri.parse(guideLink));
        }
      });
    return false;
  }
  return true;
}

/**
 * Checks if the opened folder is HARDWARIO TOWER firmware
 * Looks for app/application.c or src/application.c
 * If one of these is present it looks for application_init function inside it
 * If application_init is found it is most likely HARDWARIO TOWER firmware
 * @returns true if is HARDWARIO project, false otherwise
 */
export function isHardwarioProject() {
  if (vscode.workspace.workspaceFolders === undefined) {
    return false;
  }
  const workspaceFolder = vscode.workspace.workspaceFolders[0];

  if (fs.existsSync(path.join(workspaceFolder.uri.fsPath.toString(), 'tower-project.yaml'))) {
    return true;
  }

  if (fs.existsSync(path.join(workspaceFolder.uri.fsPath.toString(), 'app', 'application.c')) || fs.existsSync(path.join(workspaceFolder.uri.fsPath.toString(), 'src', 'application.c'))) {
    let data : Buffer;
    try {
      data = fs.readFileSync(path.join(workspaceFolder.uri.fsPath.toString(), 'src', 'application.c'));
    } catch (e) {
      try {
        data = fs.readFileSync(path.join(workspaceFolder.uri.fsPath.toString(), 'app', 'application.c'));
      } catch (error) {
        return error;
      }
    }
    if (data.includes('application_init(')) {
      return true;
    }

    return false;
  }

  return false;
}

/**
 * Adds all needed setting to the setting.json in .vscode folder
 */
export function addSetting() {
  const includePath: string[] = vscode.workspace.getConfiguration('C_Cpp.default').get('includePath');
  const browsePath: string[] = vscode.workspace.getConfiguration('C_Cpp.default.browse').get('path');
  const cStandard = vscode.workspace.getConfiguration('C_Cpp.default').get('cStandard');
  const terminalIntegratedShell = vscode.workspace.getConfiguration('terminal.integrated.shell').get('windows');

  const fileAssociations = vscode.workspace.getConfiguration('files.associations').get('ranges');

  if (includePath === null || includePath === undefined || includePath.length === 0) {
    vscode.workspace.getConfiguration('C_Cpp.default').update('includePath', includePathSetting);
  }

  if (browsePath === null || browsePath === undefined || browsePath.length === 0) {
    vscode.workspace.getConfiguration('C_Cpp.default.browse').update('path', browsePathSetting);
  }

  if (cStandard === '' || cStandard === null || cStandard === undefined) {
    vscode.workspace.getConfiguration('C_Cpp.default').update('cStandard', 'c11');
  }

  if (fileAssociations === '' || fileAssociations === null || fileAssociations === undefined) {
    vscode.workspace.getConfiguration('files.associations').update('ranges', 'c');
  }

  if (terminalIntegratedShell === null || terminalIntegratedShell === undefined || terminalIntegratedShell === '') {
    vscode.workspace.getConfiguration('terminal.integrated.shell').update('windows', 'C:\\Windows\\sysnative\\cmd.exe');
  }
}

function appendToGitignore(workspacePath) {
  const ignores : Array<string> = ['obj/', 'out/', '.gitmodules', '.DS_Store', 'firmware.bin', '.vscode/'];

  for (const ignore of ignores) {
    fs.readFile(path.join(workspacePath, '.gitignore'), (err, data) => {
      if (err) throw err;
      if (!data.includes(ignore)) {
        fs.appendFile(path.join(workspacePath, '.gitignore'), `${ignore}\r\n`, (error) => {
          if (error) throw error;
        });
      }
    });
  }
}

/**
 * Updates the project to latest supported project structure
 * @param workspacePath path to the current workspace
 */
export function updateToSupportedFirmwareStructure(workspacePath) {
  const updateFirmwareTerminal = new Terminal('HARDWARIO TOWER Update firmware');

  updateFirmwareTerminal.get().sendText('git rm .vscode -f');

  if (!fs.existsSync(path.join(workspacePath, 'sdk'))) {
    updateFirmwareTerminal.get().sendText('git submodule add https://github.com/hardwario/twr-sdk.git sdk');
    updateFirmwareTerminal.get().show();
  } else {
    updateFirmwareTerminal.get().sendText('git submodule update --remote --merge');
    updateFirmwareTerminal.get().show();
  }

  if (!fs.existsSync(path.join(workspacePath, 'sdk', 'CMakeLists.txt'))) {
    updateFirmwareTerminal.get().sendText('git submodule init && git submodule update --remote --merge');
    updateFirmwareTerminal.get().show();
  }

  if (!fs.existsSync(path.join(workspacePath, 'CMakeLists.txt'))) {
    updateFirmwareTerminal.get().sendText('git clone https://github.com/SmejkalJakub/cmake-files.git && exit');
    updateFirmwareTerminal.get().show();
    vscode.window.onDidCloseTerminal((terminal) => {
      if (updateFirmwareTerminal.instance !== null && terminal === updateFirmwareTerminal.get()) {
        const mediaCmakeRoot = path.join(workspacePath, 'cmake-files', 'root', 'cmake.txt');
        const sourceCmakeRoot = path.join(workspacePath, 'CMakeLists.txt');
        const mediaCmakeSrc = path.join(workspacePath, 'cmake-files', 'src', 'cmake.txt');
        const sourceCmakeSrc = path.join(workspacePath, 'src', 'CMakeLists.txt');

        (async () => {
          try {
            await fs.promises.rename(mediaCmakeRoot, sourceCmakeRoot);
            await fs.promises.rename(mediaCmakeSrc, sourceCmakeSrc);
            fs.rmSync(path.join(workspacePath, 'cmake-files'), { recursive: true, force: true });
          } catch (e) {
            return e;
          }
        })();
      }
    });
  } else {
    updateFirmwareTerminal.get().sendText('exit');
  }

  if (!fs.existsSync(path.join(workspacePath, '.gitignore'))) {
    fs.writeFile(path.join(workspacePath, '.gitignore'), 'obj/\r\nout/\r\n.gitmodules\r\n.DS_Store\r\nfirmware.bin\r\n.vscode/', (err) => {
      if (err) throw err;
    });
  } else {
    appendToGitignore(workspacePath);
  }

  if (!fs.existsSync(path.join(workspacePath, 'src'))) {
    fs.mkdirSync(path.join(workspacePath, 'src'));
  }

  if (fs.existsSync(path.join(workspacePath, 'app', 'application.c'))) {
    const moveFrom = path.join(workspacePath, 'app');
    const moveTo = path.join(workspacePath, 'src');

    (async () => {
      try {
        const files = await fs.promises.readdir(moveFrom);

        for (const file of files) {
          const fromPath = path.join(moveFrom, file);
          const toPath = path.join(moveTo, file);

          await fs.promises.rename(fromPath, toPath);
        }
        fs.rmSync(moveFrom, { recursive: true, force: true });
      } catch (e) {
        return e;
      }
    })();
  } else if (fs.existsSync(path.join(workspacePath, 'include')) || fs.existsSync(path.join(workspacePath, 'platformio.ini'))) {
    if (fs.existsSync(path.join(workspacePath, 'platformio.ini'))) {
      fs.rmSync(path.join(workspacePath, 'platformio.ini'), { force: true });
    }
    if (fs.existsSync(path.join(workspacePath, '.pio'))) {
      fs.rmSync(path.join(workspacePath, '.pio'), { recursive: true, force: true });
    }

    if (fs.existsSync(path.join(workspacePath, 'Makefile'))) {
      fs.rmSync(path.join(workspacePath, 'Makefile'), { recursive: true, force: true });
    }
    if (fs.existsSync(path.join(workspacePath, 'travis.yml'))) {
      fs.rmSync(path.join(workspacePath, 'travis.yml'), { recursive: true, force: true });
    }

    const moveFrom = path.join(workspacePath, 'include');
    const moveTo = path.join(workspacePath, 'src');

    (async () => {
      try {
        const files = await fs.promises.readdir(moveFrom);

        for (const file of files) {
          const fromPath = path.join(moveFrom, file);
          const toPath = path.join(moveTo, file);

          await fs.promises.rename(fromPath, toPath);
        }
        fs.rmSync(moveFrom, { recursive: true, force: true });
      } catch (e) {
        return e;
      }
    })();
  }
}

/**
 * Checks for correct project structure
 * If there is anything wrong with the project structure it will give an option to fix it
 */
export function checkProjectStructure() {
  const workspaceFolder = vscode.workspace.workspaceFolders[0];
  const workspacePath = workspaceFolder.uri.fsPath.toString();

  if (fs.existsSync(path.join(workspacePath, 'app', 'application.c'))
        || (!fs.existsSync(path.join(workspacePath, 'sdk')))
       || (fs.existsSync(path.join(workspacePath, 'src', 'application.c')) && (fs.existsSync(path.join(workspacePath, 'include')) || fs.existsSync(path.join(workspacePath, 'platformio.ini'))))) {
    vscode.window.showWarningMessage(
      'Your project has an outdated structure.',
      'Update the project structure',

      'Cancel',
    )
      .then((answer) => {
        if (answer === 'Update the project structure') {
          updateToSupportedFirmwareStructure(workspacePath);
        }
      });
  }
}

/**
 * Checks for all the needed cmake files
 * @param type build type of the firmware
 * @returns true is cmake is already generated, false otherwise
 */
export function isCmakeGenerated(type: string) {
  const workspaceFolder = vscode.workspace.workspaceFolders[0];

  const objDebugPath = path.join(workspaceFolder.uri.fsPath.toString(), 'obj', 'debug');
  const objReleasePath = path.join(workspaceFolder.uri.fsPath.toString(), 'obj', 'release');

  if (type === 'debug') {
    if (!fs.existsSync(path.join(objDebugPath, 'CMakeFiles'))
    || !fs.existsSync(path.join(objDebugPath, 'sdk'))
    || !fs.existsSync(path.join(objDebugPath, 'src'))
    || !fs.existsSync(path.join(objDebugPath, 'build.ninja'))
    || !fs.existsSync(path.join(objDebugPath, 'cmake_install.cmake'))) {
      return false;
    }
    return true;
  }

  if (type === 'release') {
    if (!fs.existsSync(path.join(objReleasePath, 'CMakeFiles'))
        || !fs.existsSync(path.join(objReleasePath, 'sdk'))
        || !fs.existsSync(path.join(objReleasePath, 'src'))
        || !fs.existsSync(path.join(objReleasePath, 'build.ninja'))
        || !fs.existsSync(path.join(objReleasePath, 'cmake_install.cmake'))) {
      return false;
    }
    return true;
  }

  return true;
}

/**
 * Stops the execution for a given number of milliseconds
 * @param milliseconds how long the sleep should last
 */
export function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

/**
 * Checks all the open files, if any of them are dirty a popup will appear.
 */
export function checkDirtyFiles() {
  if (vscode.workspace.textDocuments.length === 0) {
    return;
  }

  const config = vscode.workspace.getConfiguration();
  const alwaysSaveAll = config.get('hardwario.tower.alwaysSaveAll');

  if (alwaysSaveAll) {
    vscode.workspace.saveAll();
  } else {
    let dirtyFile = false;
    for (const file of vscode.workspace.textDocuments) {
      if (file.isDirty) {
        dirtyFile = true;
        break;
      }
    }

    if (dirtyFile) {
      vscode.window.showWarningMessage(
        'You have an unsaved changes in your open file. You can enable `hardwario.tower.alwaysSaveAll` setting to always save all unsaved changes',
        'Save All',
        'Cancel',
      )
        .then((answer) => {
          if (answer === 'Save All') {
            vscode.workspace.saveAll();
          }
        });
    }
  }
}

/**
 * Starts the debug session with JLink and given configuration
 */
export function startDebug() {
  vscode.debug.startDebugging(undefined, {
    name: 'HARDWARIO TOWER Debug',
    request: 'launch',
    type: 'cortex-debug',
    cwd: '${workspaceFolder}',
    device: 'STM32L083CZ',
    servertype: 'jlink',
    jlinkscript: './sdk/tools/jlink/flash.jlink',
    interface: 'swd',
    serverpath: '${command:hardwario.tower.locateJlink}',
    svdFile: './sdk/sys/svd/stm32l0x3.svd',
    gdbPath: '${command:hardwario.tower.locateToolchain}',
    runToEntryPoint: 'application_init',
    executable: '${workspaceFolder}/out/debug/firmware.elf',
    windows: {
      serverpath: '${command:hardwario.tower.locateJlink}.exe',
      gdbPath: '${command:hardwario.tower.locateToolchain}',
    },
  });
}
