import { execFile } from 'node:child_process';

const rawPrinterScript = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class KioskRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private class DOC_INFO_1 {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName = "Comprobante de pago";
    public string pOutputFile = null;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType = "RAW";
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  private static extern bool OpenPrinter(string printerName, out IntPtr printer, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)]
  private static extern bool ClosePrinter(IntPtr printer);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  private static extern int StartDocPrinter(IntPtr printer, int level, [In] DOC_INFO_1 document);
  [DllImport("winspool.drv", SetLastError = true)]
  private static extern bool EndDocPrinter(IntPtr printer);
  [DllImport("winspool.drv", SetLastError = true)]
  private static extern bool StartPagePrinter(IntPtr printer);
  [DllImport("winspool.drv", SetLastError = true)]
  private static extern bool EndPagePrinter(IntPtr printer);
  [DllImport("winspool.drv", SetLastError = true)]
  private static extern bool WritePrinter(IntPtr printer, IntPtr bytes, int count, out int written);

  private static void Ensure(bool success) {
    if (!success) throw new Win32Exception(Marshal.GetLastWin32Error());
  }

  public static void Send(string printerName, byte[] payload) {
    IntPtr printer = IntPtr.Zero;
    IntPtr unmanaged = IntPtr.Zero;
    bool documentStarted = false;
    bool pageStarted = false;
    try {
      Ensure(OpenPrinter(printerName, out printer, IntPtr.Zero));
      if (StartDocPrinter(printer, 1, new DOC_INFO_1()) == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
      documentStarted = true;
      Ensure(StartPagePrinter(printer));
      pageStarted = true;
      unmanaged = Marshal.AllocCoTaskMem(payload.Length);
      Marshal.Copy(payload, 0, unmanaged, payload.Length);
      int written;
      Ensure(WritePrinter(printer, unmanaged, payload.Length, out written));
      if (written != payload.Length) throw new InvalidOperationException("El spooler no recibió todo el comprobante.");
    } finally {
      if (unmanaged != IntPtr.Zero) Marshal.FreeCoTaskMem(unmanaged);
      if (pageStarted) EndPagePrinter(printer);
      if (documentStarted) EndDocPrinter(printer);
      if (printer != IntPtr.Zero) ClosePrinter(printer);
    }
  }
}
'@
[KioskRawPrinter]::Send(
  $env:KIOSK_RAW_PRINTER_NAME,
  [Convert]::FromBase64String($env:KIOSK_RAW_PRINT_PAYLOAD)
)
`;

export function printWindowsRaw(printerName: string, payload: Buffer) {
  if (process.platform !== 'win32') {
    throw new Error('La impresión ESC/POS RAW está disponible únicamente en Windows.');
  }
  const encodedScript = Buffer.from(rawPrinterScript, 'utf16le').toString('base64');
  return new Promise<void>((resolve, reject) => {
    execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodedScript], {
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: 256 * 1024,
      env: {
        ...process.env,
        KIOSK_RAW_PRINTER_NAME: printerName,
        KIOSK_RAW_PRINT_PAYLOAD: payload.toString('base64')
      }
    }, (error, _stdout, stderr) => {
      if (error) {
        const detail = stderr.trim() || error.message;
        reject(new Error(`No se pudo enviar el comprobante RAW: ${detail}`));
      } else resolve();
    });
  });
}
