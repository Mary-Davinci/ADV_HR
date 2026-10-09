# Registra nell'Utilità di pianificazione di Windows la sincronizzazione ADV CORE -> ADV_HR:
# dal lunedì al venerdì alle 13:20 e alle 18:20 (dopo la fine dei turni 9-13 e 14-18).
#
# Uso (PowerShell, dalla cartella del progetto ADV_HR):
#   powershell -ExecutionPolicy Bypass -File scripts\windows\registra-sync-adv-core.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\windows\registra-sync-adv-core.ps1 -Rimuovi
#
# Se il PC è spento all'orario previsto, la sincronizzazione parte appena possibile
# (StartWhenAvailable). Prerequisiti: .env.local compilato, PostgreSQL di ADV_HR avviato.

param(
    [switch]$Rimuovi,
    [string]$NomeAttivita = 'ADV_HR - Sincronizzazione ADV Core'
)

$ErrorActionPreference = 'Stop'

if ($Rimuovi) {
    Unregister-ScheduledTask -TaskName $NomeAttivita -Confirm:$false
    Write-Host "Attività '$NomeAttivita' rimossa." -ForegroundColor Yellow
    return
}

$progetto = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not (Test-Path (Join-Path $progetto 'package.json'))) { throw "Cartella del progetto non trovata: $progetto" }
if (-not (Test-Path (Join-Path $progetto '.env.local'))) { throw '.env.local mancante: compilarlo prima (vedi .env.example).' }
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

$giorni = 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
$trigger = foreach ($ora in '13:20', '18:20') {
    $t = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $giorni -At $ora
    # New-ScheduledTaskTrigger salva l'orario in UTC ("...Z"): con il cambio ora legale/solare
    # partirebbe un'ora prima o dopo. Senza fuso l'orario resta quello locale tutto l'anno.
    $t.StartBoundary = (Get-Date $ora).ToString('s')
    $t
}
$azione = New-ScheduledTaskAction -Execute 'cmd.exe' `
    -Argument "/c `"`"$npm`" run sync:adv-core -- --scheduled`"" `
    -WorkingDirectory $progetto
$impostazioni = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $NomeAttivita -Trigger $trigger -Action $azione -Settings $impostazioni `
    -Description 'Importa candidati, aziende e CV da ADV Core (sola lettura). Log in storage\logs.' -Force | Out-Null

$task = Get-ScheduledTask -TaskName $NomeAttivita
Write-Host "Attività '$NomeAttivita' registrata." -ForegroundColor Green
Write-Host "  Orari: lun-ven 13:20 e 18:20 - cartella: $progetto"
Write-Host "  Prossima esecuzione: $((Get-ScheduledTaskInfo -TaskName $NomeAttivita).NextRunTime)"
Write-Host "  Prova subito:  Start-ScheduledTask -TaskName '$NomeAttivita'"
Write-Host "  Esito: storage\logs\adv-core-sync-AAAA-MM.log e tabella adv_core_sync_runs"
