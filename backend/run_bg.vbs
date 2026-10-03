Set WshShell = CreateObject("WScript.Shell")
Set args = WScript.Arguments
cmd = """" & args(0) & """"
For i = 1 to args.Count - 1
    cmd = cmd & " """ & args(i) & """"
Next
WshShell.Run cmd, 0, False
