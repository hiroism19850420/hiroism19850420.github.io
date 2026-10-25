# HTMLゲームを hiroism19850420.github.io に追加・更新して公開する
# 使い方: powershell -File publish.ps1 -Source <ゲームのフォルダ> -Slug <URL用の英数字名> -Title <表示名> [-Desc <説明>] [-Files a,b,c] [-Cat camera|tap|voice|swing]
#   -Cat  トップページの分類。camera=カメラを使う全身ゲーム / tap=スマホでタップ / voice=声だけで遊ぶ / swing=スマホを振る(注意)
#         省略すると、公開済みなら今の分類のまま、新規なら tap
#   -IndexOnly  ゲームはコピーせず、games.json からトップページだけ作り直して公開する
param(
  [string]$Source,
  [string]$Slug,
  [string]$Title,
  [string]$Desc = "",
  [string[]]$Files,
  [ValidateSet("", "camera", "tap", "voice", "swing")][string]$Cat = "",
  [switch]$IndexOnly
)
$ErrorActionPreference = "Stop"
$User  = "hiroism19850420"
$Repo  = $PSScriptRoot
$git   = "C:\Program Files\Git\cmd\git.exe"
$gh    = "C:\Program Files\GitHub CLI\gh.exe"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;" + $env:Path

if (-not $IndexOnly) {
  if (-not $Source -or -not $Slug -or -not $Title) { throw "-Source -Slug -Title を指定してください(トップページだけなら -IndexOnly)" }
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

  # 1.5) アクセス解析(GoatCounter)を </head> の直前に入れる(入っていれば何もしない)
  $gc = '<script data-goatcounter="https://hiroism.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>'
  $idx = Join-Path $dest "index.html"
  $txt = [IO.File]::ReadAllText($idx, [Text.Encoding]::UTF8)
  if ($txt -notmatch 'goatcounter' -and $txt -match '</head>') {
    $txt = $txt -replace '</head>', ($gc + '</head>')
    [IO.File]::WriteAllText($idx, $txt, (New-Object Text.UTF8Encoding($false)))
  }
}

# 2) 一覧データを更新
$jsonPath = Join-Path $Repo "games.json"
$games = @()
if (Test-Path $jsonPath) {
  $raw = [IO.File]::ReadAllText($jsonPath, [Text.Encoding]::UTF8)
  if ($raw.Trim()) { $games = @(ConvertFrom-Json $raw | ForEach-Object { $_ }) }
}
if (-not $IndexOnly) {
  $old = $games | Where-Object { $_.slug -eq $Slug } | Select-Object -First 1
  if (-not $Cat) { if ($old -and $old.cat) { $Cat = $old.cat } else { $Cat = "tap" } }
  $games = @($games | Where-Object { $_.slug -and $_.slug -ne $Slug })
  $games += [pscustomobject]@{ slug=$Slug; title=$Title; desc=$Desc; updated=(Get-Date -Format "yyyy-MM-dd"); cat=$Cat }
}
$games = @($games | ForEach-Object {
  [pscustomobject]@{ slug=$_.slug; title=$_.title; desc=$_.desc; updated=$_.updated; cat=$(if ($_.cat) { $_.cat } else { "tap" }) }
} | Sort-Object updated -Descending)
# ConvertTo-Json は1件だと配列にならない/入れ子になるため、1件ずつ変換して手で配列にする
$jsonText = "[`n" + (($games | ForEach-Object { ConvertTo-Json $_ -Compress }) -join ",`n") + "`n]"
[IO.File]::WriteAllText($jsonPath, $jsonText, (New-Object Text.UTF8Encoding($false)))

# 3) トップページを再生成(index.template.html に games.json と分類を埋め込む。本棚に3Dのパッケージが並ぶ作り)
$cats = @(
  @{ id="camera"; short="カメラ";   icon="📷" },
  @{ id="tap";    short="タップ";   icon="👆" },
  @{ id="voice";  short="声";       icon="🗣️" },
  @{ id="swing";  short="振る(注意)"; icon="📱" }
)
$gamesJs = "[" + (($games | ForEach-Object { ConvertTo-Json $_ -Compress }) -join ",") + "]"
$catsJs  = "[" + (($cats | ForEach-Object { ConvertTo-Json ([pscustomobject]$_) -Compress }) -join ",") + "]"
$html = [IO.File]::ReadAllText((Join-Path $Repo "index.template.html"), [Text.Encoding]::UTF8)
$html = $html.Replace("{{GAMES}}", $gamesJs.Replace("</", "<\/")).Replace("{{CATS}}", $catsJs)
[IO.File]::WriteAllText((Join-Path $Repo "index.html"), $html, (New-Object Text.UTF8Encoding($false)))
New-Item -ItemType File -Force (Join-Path $Repo ".nojekyll") | Out-Null

# 4) Git に記録して公開
if ($IndexOnly) { $msg = "Update top page" } else { $msg = "Update ${Slug}: $Title" }
Push-Location -LiteralPath $Repo
try {
  if (-not (Test-Path (Join-Path $Repo ".git"))) { & $git -C $Repo init -b main | Out-Null }
  & $git -C $Repo add -A
  & $git -C $Repo -c core.safecrlf=false commit -m $msg 2>&1 | Select-Object -First 3 | Out-Host
  $hasRemote = (& $git -C $Repo remote) -contains "origin"
  if (-not $hasRemote) {
    & $gh repo create "$User/$User.github.io" --public --source $Repo --remote origin --push
  } else {
    & $git -C $Repo push origin main
  }
} finally { Pop-Location }
Write-Host ""
if ($IndexOnly) { Write-Host "URL: https://$User.github.io/  (1-2 min to go live)" } else { Write-Host "URL: https://$User.github.io/$Slug/  (1-2 min to go live)" }
