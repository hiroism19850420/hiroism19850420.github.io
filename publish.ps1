# HTMLゲームを hiroism19850420.github.io に追加・更新して公開する
# 使い方: powershell -File publish.ps1 -Source <ゲームのフォルダ> -Slug <URL用の英数字名> -Title <表示名> [-Desc <説明>] [-Files a,b,c] [-Cat camera|tap|voice]
#   -Cat  トップページの分類。camera=カメラを使う全身ゲーム / tap=スマホでタップ / voice=声だけで遊ぶ
#         省略すると、公開済みなら今の分類のまま、新規なら tap
#   -IndexOnly  ゲームはコピーせず、games.json からトップページだけ作り直して公開する
param(
  [string]$Source,
  [string]$Slug,
  [string]$Title,
  [string]$Desc = "",
  [string[]]$Files,
  [ValidateSet("", "camera", "tap", "voice")][string]$Cat = "",
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

# 3) トップページを再生成(分類ボタン → タップするとその分類のゲーム一覧)
$cats = @(
  @{ id="camera"; name="カメラを使う全身ゲーム"; icon="📷"; note="カメラの前で 体を動かして あそぶ" },
  @{ id="tap";    name="スマホでタップ";         icon="👆"; note="スマホの画面を さわって あそぶ" },
  @{ id="voice";  name="声だけで遊ぶゲーム";     icon="🗣️"; note="画面を見ないで 声で あそぶ" }
)
$buttons = ""; $sections = ""
foreach ($c in $cats) {
  $list = @($games | Where-Object { $_.cat -eq $c.id })
  $cards = ($list | ForEach-Object {
    $t = [Net.WebUtility]::HtmlEncode($_.title); $d = [Net.WebUtility]::HtmlEncode($_.desc)
    "<a class=""card"" href=""$($_.slug)/""><h2>$t</h2><p>$d</p><small>更新: $($_.updated)</small></a>"
  }) -join "`n"
  $buttons  += "<a class=""cat cat-$($c.id)"" href=""#$($c.id)""><span class=""ic"">$($c.icon)</span><b>$($c.name)</b><span class=""note"">$($c.note)</span><span class=""n"">$($list.Count)こ</span></a>`n"
  $sections += "<section class=""games"" id=""$($c.id)""><a class=""back"" href=""#"">← もどる</a><h2 class=""head"">$($c.icon) $($c.name)</h2><div class=""list"">`n$cards`n</div></section>`n"
}
$html = @'
<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HTMLゲーム集</title>
<style>
body{margin:0;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;background:#fff8e7;color:#2b2b2b}
.wrap{max-width:820px;margin:0 auto;padding:16px}
h1{text-align:center;color:#ff7a2f}
.cats{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.cat{display:flex;flex-direction:column;align-items:center;gap:6px;padding:26px 16px;border-radius:20px;text-decoration:none;color:#fff;box-shadow:0 3px 10px #0003;text-align:center}
.cat:hover{transform:translateY(-2px)}
.cat .ic{font-size:2.6rem;line-height:1}.cat b{font-size:1.35rem}.cat .note{font-size:.9rem;opacity:.95}
.cat .n{margin-top:4px;background:#fff3;border-radius:99px;padding:2px 12px;font-size:.9rem}
.cat-camera{background:#ff7a2f}.cat-tap{background:#3b82f6}.cat-voice{background:#16a34a}
.games{display:none}
.back{display:inline-block;margin:4px 0 8px;padding:8px 16px;border-radius:99px;background:#fff;color:#2b2b2b;text-decoration:none;box-shadow:0 2px 6px #0002}
.head{margin:8px 0 14px}
.list{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.card{display:block;background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 8px #0002;text-decoration:none;color:inherit}
.card:hover{transform:translateY(-2px)}
.card h2{margin:0 0 6px;color:#3b82f6;font-size:1.2rem}.card p{margin:0 0 8px}.card small{color:#888}
</style><script data-goatcounter="https://hiroism.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script></head><body><div class="wrap"><h1>HTMLゲーム集</h1>
<div class="cats" id="top">
{{BUTTONS}}</div>
{{SECTIONS}}</div>
<script>
function show(){
  var id=location.hash.slice(1), sec=id&&document.getElementById(id);
  var ok=sec&&sec.className=="games";
  document.getElementById("top").style.display=ok?"none":"";
  var all=document.querySelectorAll(".games");
  for(var i=0;i<all.length;i++) all[i].style.display=(ok&&all[i]===sec)?"block":"none";
  window.scrollTo(0,0);
}
window.addEventListener("hashchange",show); show();
</script></body></html>
'@
$html = $html.Replace("{{BUTTONS}}", $buttons).Replace("{{SECTIONS}}", $sections)
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
