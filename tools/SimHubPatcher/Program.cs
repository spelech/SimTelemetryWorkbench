using System;
using System.IO;
using System.Linq;
using dnlib.DotNet;
using dnlib.DotNet.Emit;

namespace SimHubPatcher;

public static class Program
{
    private const string SimHubDir = @"C:\Program Files (x86)\SimHub";
    private static readonly string DllPath = Path.Combine(SimHubDir, "SimHub.Plugins.dll");
    private static readonly string BackupPath = Path.Combine(SimHubDir, "SimHub.Plugins.dll.orig.bak");

    public static int Main(string[] args)
    {
        string mode = args.FirstOrDefault() ?? "--inspect";
        if (mode == "--restore")
        {
            if (!File.Exists(BackupPath))
            {
                Console.Error.WriteLine("No backup found at " + BackupPath);
                return 1;
            }
            File.Copy(BackupPath, DllPath, overwrite: true);
            Console.WriteLine("Restored original SimHub.Plugins.dll from backup.");
            return 0;
        }

        return InspectOrPatch(mode == "--patch");
    }

    private static int InspectOrPatch(bool applyPatch)
    {
        if (!File.Exists(DllPath))
        {
            Console.Error.WriteLine("SimHub.Plugins.dll not found at " + DllPath);
            return 1;
        }

        if (applyPatch && !File.Exists(BackupPath))
        {
            File.Copy(DllPath, BackupPath, overwrite: false);
            Console.WriteLine("Created backup: " + BackupPath);
        }

        string sourcePath = File.Exists(BackupPath) ? BackupPath : DllPath;
        byte[] rawBytes = File.ReadAllBytes(sourcePath);
        using var mod = ModuleDefMD.Load(rawBytes);

        var baseType = mod.GetTypes().FirstOrDefault(t =>
            t.FullName == "SimHub.Plugins.DataPlugins.ShakeItV3.ShakeITV3PluginBase`2");
        if (baseType == null)
        {
            Console.Error.WriteLine("Could not find ShakeITV3PluginBase`2 in SimHub.Plugins.dll");
            return 1;
        }

        var initMethod = baseType.Methods.First(m => m.Name == "Init" && m.Parameters.Count == 3);
        var loadSettingsMethod = baseType.Methods.First(m => m.Name == "LoadSettings");
        var timerTickMethod = baseType.Methods.First(m => m.Name == "Timer_Tick");
        var dataUpdate2Method = baseType.Methods.First(m => m.Name == "DataUpdate" && m.Parameters.Count == 3);
        var endMethod = baseType.Methods.First(m => m.Name == "End");
        var getWpfMethod = baseType.Methods.First(m => m.Name == "GetWPFSettingsControl");

        // Extract exact existing operands from ShakeITV3PluginBase`2 methods
        var callSettingsFileName = loadSettingsMethod.Body.Instructions
            .First(i => i.OpCode == OpCodes.Call && i.Operand?.ToString()?.Contains("SettingsFileName()") == true).Operand;
        var fldSettings = endMethod.Body.Instructions
            .First(i => i.OpCode == OpCodes.Ldfld && i.Operand?.ToString()?.Contains("::settings") == true).Operand;
        var callGetCurrentOutputManager = endMethod.Body.Instructions
            .First(i => i.OpCode == OpCodes.Callvirt && i.Operand?.ToString()?.Contains("get_CurrentOutputManager()") == true).Operand;
        var callOutputManagerEnd = endMethod.Body.Instructions
            .First(i => i.OpCode == OpCodes.Callvirt && i.Operand?.ToString()?.Contains("::End()") == true).Operand;
        var callLoadSettings = initMethod.Body.Instructions
            .First(i => i.OpCode == OpCodes.Call && i.Operand?.ToString()?.Contains("::LoadSettings(") == true).Operand;
        var fldPrevExported = initMethod.Body.Instructions
            .First(i => i.OpCode == OpCodes.Stfld && i.Operand?.ToString()?.Contains("::PreviousExportedProperties") == true).Operand;
        var callExportProperties = initMethod.Body.Instructions
            .First(i => i.OpCode == OpCodes.Call && i.Operand?.ToString()?.Contains("::ExportProperties(") == true).Operand;
        var fldSettingsControl = getWpfMethod.Body.Instructions
            .First(i => i.OpCode == OpCodes.Ldfld && i.Operand?.ToString()?.Contains("::settingsControl") == true).Operand;
        var callSetDataContext = getWpfMethod.Body.Instructions
            .First(i => i.OpCode == OpCodes.Callvirt && i.Operand?.ToString()?.Contains("::set_DataContext(") == true).Operand;

        Console.WriteLine($"Verified all operand references on {baseType.FullName}:");
        Console.WriteLine($"  SettingsFileName:   {callSettingsFileName}");
        Console.WriteLine($"  LoadSettings:       {callLoadSettings}");
        Console.WriteLine($"  OutputManager.End:  {callOutputManagerEnd}");
        Console.WriteLine($"  set_DataContext:    {callSetDataContext}");

        if (!applyPatch)
        {
            return 0;
        }

        // 1. In LoadSettings(JToken), NOP out the initial `if (timer == null)` guard
        //    so calling LoadSettings(null) always reloads settings from disk.
        var loadInstrs = loadSettingsMethod.Body.Instructions;
        for (int i = 0; i < Math.Min(10, loadInstrs.Count - 2); i++)
        {
            if (loadInstrs[i].OpCode == OpCodes.Ldarg_0 &&
                loadInstrs[i + 1].OpCode == OpCodes.Ldfld &&
                loadInstrs[i + 1].Operand is IField fld && fld.Name == "timer" &&
                (loadInstrs[i + 2].OpCode == OpCodes.Brtrue_S || loadInstrs[i + 2].OpCode == OpCodes.Brtrue))
            {
                loadInstrs[i].OpCode = OpCodes.Nop;
                loadInstrs[i + 1].OpCode = OpCodes.Nop;
                loadInstrs[i + 1].Operand = null;
                loadInstrs[i + 2].OpCode = OpCodes.Nop;
                loadInstrs[i + 2].Operand = null;
                Console.WriteLine("1. Patched LoadSettings() to allow hot-reload when timer != null.");
                break;
            }
        }

        // 2. In DataUpdate(PluginManager, ref GameData), check if
        //    "PluginsData\\Common\\" + SettingsFileName() + ".reload" exists.
        //    When present, delete the marker file, stop old outputs, call LoadSettings(null),
        //    and re-export properties.
        var stringConcat3 = new MemberRefUser(mod, "Concat",
            MethodSig.CreateStatic(mod.CorLibTypes.String, mod.CorLibTypes.String, mod.CorLibTypes.String, mod.CorLibTypes.String),
            mod.CorLibTypes.String.TypeDefOrRef);
        var fileTypeRef = new TypeRefUser(mod, "System.IO", "File", mod.CorLibTypes.AssemblyRef);
        var fileExists = new MemberRefUser(mod, "Exists",
            MethodSig.CreateStatic(mod.CorLibTypes.Boolean, mod.CorLibTypes.String),
            fileTypeRef);
        var fileDelete = new MemberRefUser(mod, "Delete",
            MethodSig.CreateStatic(mod.CorLibTypes.Void, mod.CorLibTypes.String),
            fileTypeRef);

        var duInstrs = dataUpdate2Method.Body.Instructions;
        var origFirstInstr = duInstrs[0];
        var skipReloadPop = OpCodes.Pop.ToInstruction();

        var injected = new[]
        {
            OpCodes.Ldstr.ToInstruction(@"C:\Program Files (x86)\SimHub\PluginsData\Common\"),
            OpCodes.Ldarg_0.ToInstruction(),
            OpCodes.Call.ToInstruction((IMethod)callSettingsFileName),
            OpCodes.Ldstr.ToInstruction(".reload"),
            OpCodes.Call.ToInstruction(stringConcat3),
            OpCodes.Dup.ToInstruction(),
            OpCodes.Call.ToInstruction(fileExists),
            OpCodes.Brfalse_S.ToInstruction(skipReloadPop),

            // Marker exists: delete marker, end old output manager, reload settings, re-export properties
            OpCodes.Call.ToInstruction(fileDelete),
            OpCodes.Ldarg_0.ToInstruction(),
            OpCodes.Ldfld.ToInstruction((IField)fldSettings),
            OpCodes.Callvirt.ToInstruction((IMethod)callGetCurrentOutputManager),
            OpCodes.Callvirt.ToInstruction((IMethod)callOutputManagerEnd),

            OpCodes.Ldarg_0.ToInstruction(),
            OpCodes.Ldnull.ToInstruction(),
            OpCodes.Call.ToInstruction((IMethod)callLoadSettings),

            OpCodes.Ldarg_0.ToInstruction(),
            OpCodes.Ldnull.ToInstruction(),
            OpCodes.Stfld.ToInstruction((IField)fldPrevExported),

            OpCodes.Ldarg_0.ToInstruction(),
            OpCodes.Ldarg_1.ToInstruction(),
            OpCodes.Call.ToInstruction((IMethod)callExportProperties),
            OpCodes.Br_S.ToInstruction(origFirstInstr),

            skipReloadPop
        };

        for (int i = 0; i < injected.Length; i++)
        {
            duInstrs.Insert(i, injected[i]);
        }
        dataUpdate2Method.Body.MaxStack = (ushort)Math.Max((int)dataUpdate2Method.Body.MaxStack, 4);
        dataUpdate2Method.Body.SimplifyBranches();
        dataUpdate2Method.Body.OptimizeBranches();
        Console.WriteLine("2. Patched DataUpdate(PluginManager, ref GameData) with .reload file trigger.");

        // 3. In Timer_Tick(object, EventArgs), keep settingsControl.DataContext synced with this.settings
        var tickInstrs = timerTickMethod.Body.Instructions;
        int insertTickIdx = 3; // right after `if (!SettingsControlIsVisible) return;`
        var syncUiInstrs = new[]
        {
            OpCodes.Ldarg_0.ToInstruction(),
            OpCodes.Ldfld.ToInstruction((IField)fldSettingsControl),
            OpCodes.Ldarg_0.ToInstruction(),
            OpCodes.Ldfld.ToInstruction((IField)fldSettings),
            OpCodes.Callvirt.ToInstruction((IMethod)callSetDataContext)
        };
        for (int i = 0; i < syncUiInstrs.Length; i++)
        {
            tickInstrs.Insert(insertTickIdx + i, syncUiInstrs[i]);
        }
        timerTickMethod.Body.SimplifyBranches();
        timerTickMethod.Body.OptimizeBranches();
        Console.WriteLine("3. Patched Timer_Tick() to sync settingsControl.DataContext after hot-reload.");

        // 4. Regenerate Mvid so .NET Framework CLR JITs the patched IL instead of loading
        //    the stale NGen image from C:\Windows\assembly\NativeImages_v4.0.30319_32\SimHub.Plugins
        mod.Mvid = Guid.NewGuid();
        Console.WriteLine($"4. Assigned new Module Mvid ({mod.Mvid}) to bypass stale NGen cache.");

        string tempOut = DllPath + ".patched.tmp";
        mod.Write(tempOut);
        File.Copy(tempOut, DllPath, overwrite: true);
        File.Delete(tempOut);
        Console.WriteLine("Wrote patched SimHub.Plugins.dll successfully.");
        return 0;
    }
}
