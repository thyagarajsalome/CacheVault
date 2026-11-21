$volumes = Get-Volume | Where-Object { $_.DriveLetter -ne $null }
$disks = Get-Disk -ErrorAction SilentlyContinue

$results = @()
foreach ($v in $volumes) {
    $letter = "$($v.DriveLetter):"
    $total = [uint64]$v.Size
    $free = [uint64]$v.SizeRemaining
    $used = if ($total -gt $free) { $total - $free } else { 0 }
    $pct = if ($total -gt 0) { [math]::Round(($used / $total) * 100, 1) } else { 0 }
    
    $disk = $null
    try {
        $part = Get-Partition -DriveLetter $v.DriveLetter -ErrorAction SilentlyContinue
        if ($part) {
            $disk = $disks | Where-Object { $_.Number -eq $part.DiskNumber } | Select-Object -First 1
        }
    } catch {}

    $bus = if ($disk) { "$($disk.BusType)" } else { "Internal" }
    $media = if ($disk -and $disk.MediaType) { "$($disk.MediaType)" } else { "Disk" }
    $health = if ($disk -and $disk.HealthStatus) { "$($disk.HealthStatus)" } else { "Healthy" }

    $cluster = 4096
    try {
        $cimVol = Get-CimInstance Win32_Volume | Where-Object { $_.DriveLetter -eq $letter } | Select-Object -First 1
        if ($cimVol -and $cimVol.BlockSize) { $cluster = [uint64]$cimVol.BlockSize }
    } catch {}

    $msg = "Operating normally."
    if ($health -ne "Healthy") {
        $msg = "Hardware telemetry reported an alert ($health)."
    } elseif ($bus -eq "USB" -and $v.FileSystem -eq "exFAT" -and $cluster -ge 1048576) {
        $msg = "High 1MB cluster size detected (large slack space on small files)."
    } elseif ($pct -gt 90) {
        $msg = "Critical storage warning: Drive is over 90% full!"
    }

    $results += [PSCustomObject]@{
        letter = $letter
        label = if ($v.FileSystemLabel) { $v.FileSystemLabel } else { "Local Disk" }
        filesystem = if ($v.FileSystem) { $v.FileSystem } else { "Unknown" }
        total_bytes = $total
        free_bytes = $free
        used_bytes = $used
        percent_used = $pct
        drive_type = $media
        bus_type = $bus
        health_status = $health
        health_message = $msg
        cluster_size = $cluster
    }
}
$results | ConvertTo-Json -Compress
