import { spawn } from 'node:child_process';

/** Open the operating system's folder picker. This is only called after a
 * deliberate click in the local Studio UI. */
export async function pickDirectory(title = '选择目录'): Promise<string | null> {
  if (process.platform === 'win32') {
    const script = [
      '[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
      `$dialog.Description = '${escapePowerShell(title)}'`,
      '$dialog.ShowNewFolderButton = $true',
      // Give the dialog a tiny top-most owner. Without an owner, a hidden
      // PowerShell host can put FolderBrowserDialog behind the Studio/browser,
      // which looks exactly like the button did nothing.
      '$owner = New-Object System.Windows.Forms.Form',
      '$owner.TopMost = $true',
      '$owner.ShowInTaskbar = $false',
      '$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen',
      '$owner.Width = 1',
      '$owner.Height = 1',
      '$owner.Opacity = 0',
      '$owner.Show()',
      '$owner.Activate()',
      '$result = $dialog.ShowDialog($owner)',
      '$owner.Close()',
      'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }',
    ].join('; ');
    // Do not hide the Windows process: windowsHide also hides native dialogs
    // on some Windows builds. The top-most owner keeps the picker in front.
    return runPicker('powershell.exe', ['-NoProfile', '-STA', '-Command', script], false);
  }
  if (process.platform === 'darwin') {
    return runPicker('osascript', [
      '-e',
      `POSIX path of (choose folder with prompt "${title.replace(/"/g, '\\"')}")`,
    ]);
  }
  return runPicker('zenity', ['--file-selection', '--directory', `--title=${title}`]);
}

function runPicker(command: string, args: string[], windowsHide = true): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide });
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', () => resolve(null));
    child.on('exit', (code) => resolve(code === 0 && stdout.trim() ? stdout.trim() : null));
  });
}

function escapePowerShell(value: string): string {
  return value.replace(/'/g, "''");
}
