param([Parameter(Mandatory = $true)][string]$SourceDirectory)
$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath $SourceDirectory).Path
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Export-SelectedEntries([string]$ArchiveName, [hashtable]$Entries) {
    $archive = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $sourceRoot $ArchiveName))
    try {
        foreach ($entryName in $Entries.Keys) {
            $entry = $archive.GetEntry($entryName)
            if ($null -eq $entry) { throw "Missing expected source entry: $entryName" }
            $reader = [System.IO.StreamReader]::new($entry.Open())
            try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
            Set-Content -LiteralPath (Join-Path $sourceRoot $Entries[$entryName]) -Value $text -Encoding utf8 -NoNewline
        }
    } finally { $archive.Dispose() }
}
# Reads only named public source entries; never accepts a licence or makes a network request.
Export-SelectedEntries 'fao-internal-source.zip' @{
    'Intervals_2026-10-27.csv' = 'fao-intervals.csv'
    'Intervals_variables/1d_deforestation_2026-10-27.csv' = 'fao-deforestation.csv'
}
Export-SelectedEntries 'National_Fossil_Carbon_Emissions_2025_v0.3.xlsx' @{
    'xl/sharedStrings.xml' = 'sharedStrings.xml'
    'xl/worksheets/sheet2.xml' = 'sheet2.xml'
}
