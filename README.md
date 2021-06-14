# zxdb

This extension is for [zxdb: The Fuchsia debugger](https://fuchsia.dev/fuchsia-src/development/debugger?hl=en). It provides IDE based debugging support for developers working with the open source [Fuchsia](https://fuchsia.dev) operating system.

## Setup

After downloading and installing the extension from marketplace, please check the following before using the extension -

- Fuchsia source tree and environment is setup as described [here](https://fuchsia.dev/fuchsia-src/get-started/get_fuchsia_source?hl=en)
- `fx --help` command works in the VSCode terminal (VSCode -> Terminal -> New Terminal)
- `fx debug -- --enable-debug-adapter` works in the VSCode terminal without any errors

## Using the extension

Make sure to have the target device started and `fx serve` running on the host.
Start the debugger by pressing `F5` in your workspace. Select `zxdb` from
the list of debuggers. Alternatively, you can go to
`Run and Debug` on the leftmost panel and select `zxdb..` from the `Start Debugging` dropdown.

### Launch / Attach

With zxdb, you can attach to an existing process by selecting `zxdb: attach` debug configuration
and providing the process name or process ID.

Alternatively, you can launch a process and debug it by using the `zxdb: launch` configuration.
The launch configuration requires a launch command which
will be executed on the VSCode terminal and the process name. Currently, the process name cannot
be derived from the launch command and needs to be specified explicitly.

### Saving configurations

In order to store frequently used configs, open or create `.vscode/launch.json` and
select `Add configuration`.
From the list select `zxdb: attach` or `zxdb: launch`.

```
{
    "type": "zxdb", // Do not change this.
    "request": "attach", // Request to attach to a process on target for debugging.
    "name": "zxdb attach process", // Can be customized.
    "process": "${command:PickProcess}" // Can be replaced with a string containing process name/PID.
                                        // If not it will ask you to enter the value every time you
                                        // start debugging.
}
```

If you selected `zxdb: launch`, the `launchCommand` will be run the in intergrated VSCode terminal
as is. If the command fails, run the command manually on the terminal once and ensure that it works.
$SHELL and environment variables might have to be setup for this to work properly.

```
{
    "type": "zxdb", // Do not change this.
    "request": "launch", // Request to launch to a process on target for debugging.
    "name": "zxdb launch process",  // Can be customized.
    // The below two fields can be replaced with a string containing process name/PID.
    // If not if will ask you to enter the value every time you start debugging.
    "process": "${command:PickProcess}",
    "launchCommand": "${command:EnterLaunchCommand}" // Shell command to launch the debuggee.
},
```

You can customize the `name`, `process` and `launchCommand` string as per your need and can have
multiple configs as well.
You can now choose from these config in the `Start Debugging` dropdown.

### Extension configuration

zxdb extension can be configured per workspace for the parameters listed below.
Add these to the `settings.json` found in the `.vscode` folder in your workspace.

- `zxdb.debug` : boolean to turn on debug logs. By default it is turned off.
- `zxdb.command` : Command to launch fx debug. By default `fx debug -- --enable-debug-adapter` is used.
- `zxdb.timeout` : Time in milliseconds to wait for the zxdb console to start. By default it waits 30 seconds.

Reload the VSCode window after changing any of these configuration for it to take effect.

## Troubleshooting

- I'm getting "Timeout starting zxdb console" error. How to fix it?
  - By default the timeout is set to 30 seconds. If for some reason `fx debug` is taking more time on your setup, please increase `zxdb.timeout` extension configuration as described in previous session and try again.

## Report issues

All feedbacks are valuable. Please report issues/feedback [here](https://bugs.fuchsia.dev/p/fuchsia/issues/entry?components=DeveloperExperience%3Ezxdb;cc=puneetha@google.com;Labels=Restrict-View-Google).

Please collect logs by following these steps to append to the report:

1. Go to the `OUTPUT` panel in the bottom half.
2. From the dropdown in the top right of that panel select `zxdb`.
3. Copy all the text.

For more verbose logs, open/create `.vscode/settings.json` and add ` "zxdb.debug": true` to it.
VSCode must be reloaded for this to take affect. Follow same steps listed above to get logs after
reproducing the issue.

## Release Notes

See the [CHANGELOG](CHANGELOG.md)
