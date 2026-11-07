using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Collections.Generic;

// Read-only. No input injection, process handles, hooks, screenshots or UI text.
class WindowMonitor {
    delegate bool EnumProc(IntPtr hwnd, IntPtr param);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr param);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);

    static bool Visible() {
        bool visible = false;
        HashSet<uint> uiIds = new HashSet<uint>();
        foreach (Process p in Process.GetProcessesByName("astraui")) {
            try { uiIds.Add((uint)p.Id); } finally { p.Dispose(); }
        }
        EnumWindows(delegate(IntPtr hwnd, IntPtr unused) {
            if (!IsWindowVisible(hwnd) || IsIconic(hwnd)) return true;
            uint pid; GetWindowThreadProcessId(hwnd, out pid);
            if (uiIds.Contains(pid)) visible = true;
            return !visible;
        }, IntPtr.Zero);
        return visible;
    }
    static void Main(string[] args) {
        int parentId;
        if (args.Length != 1 || !Int32.TryParse(args[0], out parentId)) return;
        try {
            using (Process parent = Process.GetProcessById(parentId)) {
                while (!parent.HasExited) {
                    Console.WriteLine(Visible() ? "visible" : "hidden");
                    Console.Out.Flush();
                    Thread.Sleep(600);
                }
            }
        } catch {}
    }
}
