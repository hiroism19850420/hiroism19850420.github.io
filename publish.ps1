# HTMLゲームを hiroism19850420.github.io に追加・更新して公開する
# 使い方: powershell -File publish.ps1 -Source <ゲームのフォルダ> -Slug <URL用の英数字名> -Title <表示名> [-Desc <説明>] [-Files a,b,c]
param(
  [Parameter(Mandatory)][string]$Source,
  [Parameter(Mandatory)][string]$Slug,
  [Parameter(Mandatory)][string]$Title,
  [string]$Desc = "",
  [string[]]$Files
)
$ErrorActionPreference = "Stop"
$User  = "hiroism19850420"
$Repo  = $PSScriptRoot
$git   = "C:\Program Files\Git\cmd\git.exe"
$gh    = "C:\Program Files\GitHub CLI\gh.exe"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;" + $env:Path

if ($Slug -notmatch '^[a-z0-9-]+$') { throw "Slug は半角小文字英数字とハイフンだけにしてください: $Slug" }

# 1) ゲームのファイルをコピー
$dest = Join-Path $Repo $Slug
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force $dest | Out-Null
if ($Files) {
  $Files = @($Files | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
  foreach ($f in $Files) {
    $src = Join-Path $Source $f
    $dst = Join-Path $dest $f
    New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
    Copy-Item $src $dst -Recurse -Force
  }
} else {
  Get-ChildItem $Source -Force | Where-Object {
    $_.Name -notin @('.claude','.git','node_modules') -and $_.Extension -notin @('.ps1','.md','.rbxlx','.zip')
  } | ForEach-Object { Copy-Item $_.FullName $dest -Recurse -Force }
}
if (-not (Test-Path (Join-Path $dest "index.html"))) { throw "index.html が見つかりません: $dest" }

# 2) 一覧データを更新
$jsonPath = Join-Path $Repo "games.json"
$games = @()
if (Test-Path $jsonPath) {
  $raw = [IO.File]::ReadAllText($jsonPath, [Text.Encoding]::UTF8)
  if ($raw.Trim()) { $games = @(ConvertFrom-Json $raw | ForEach-Object { $_ }) }
}
$games = @($games | Where-Object { $_.slug -and $_.slug -ne $Slug })
$games += [pscustomobject]@{ slug=$Slug; title=$Title; desc=$Desc; updated=(Get-Date -Format "yyyy-MM-dd") }
$games = @($games | Sort-Object updated -Descending)
# ConvertTo-Json は1件だと配列にならない/入れ子になるため、1件ずつ変換して手で配列にする
$jsonText = "[`n" + (($games | ForEach-Object { ConvertTo-Json $_ -Compress }) -join ",`n") + "`n]"
[IO.File]::WriteAllText($jsonPath, $jsonText, (New-Object Text.UTF8Encoding($false)))

# 3) トップページ(ゲーム一覧)を再生成
$cards = ($games | ForEach-Object {
  $t = [Net.WebUtility]::HtmlEncode($_.title); $d = [Net.WebUtility]::HtmlEncode($_.desc)
  "<a class=""card"" href=""$($_.slug)/""><h2>$t</h2><p>$d</p><small>更新: $($_.updated)</small></a>"
}) -join "`n"
$html = @"
<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HTMLゲーム集</title>
<style>
body{margin:0;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;background:#fff8e7;color:#2b2b2b}
.wrap{max-width:820px;margin:0 auto;padding:16px}
h1{text-align:center;color:#ff7a2f}
.list{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.card{display:block;background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 8px #0002;text-decoration:none;color:inherit}
.card:hover{transform:translateY(-2px)}
.card h2{margin:0 0 6px;color:#3b82f6;font-size:1.2rem}.card p{margin:0 0 8px}.card small{color:#888}
</style></head><body><div class="wrap"><h1>HTMLゲーム集</h1><div class="list">
$cards
</div></div></body></html>
"@
[IO.File]::WriteAllText((Join-Path $Repo "index.html"), $html, (New-Object Text.UTF8Encoding($false)))
New-Item -ItemType File -Force (Join-Path $Repo ".nojekyll") | Out-Null

# 4) Git に記録して公開
Push-Location -LiteralPath $Repo
try {
  if (-not (Test-Path (Join-Path $Repo ".git"))) { & $git -C $Repo init -b main | Out-Null }
  & $git -C $Repo add -A
  & $git -C $Repo -c core.safecrlf=false commit -m "Update ${Slug}: $Title" 2>&1 | Select-Object -First 3 | Out-Host
  $hasRemote = (& $git -C $Repo remote) -contains "origin"
  if (-not $hasRemote) {
    & $gh repo create "$User/$User.github.io" --public --source $Repo --remote origin --push
  } else {
    & $git -C $Repo push origin main
  }
} finally { Pop-Location }
Write-Host ""
Write-Host "URL: https://$User.github.io/$Slug/  (1-2 min to go live)"
