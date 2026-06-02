# ==================================================
#  Deploy Angular -> XAMPP (Apache) - v6
#  Support local, production HTTP et HTTPS (SSL)
#  Proxy backend Node.js integre
#  Backup automatique de la config Apache
# ==================================================

$Host.UI.RawUI.WindowTitle = "Deploy Angular -> XAMPP v6"

# --------------------------------------------------
# Fonctions utilitaires
# --------------------------------------------------
function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  =================================================" -ForegroundColor Cyan
    Write-Host "      DEPLOIEMENT ANGULAR -> XAMPP/APACHE v6       " -ForegroundColor Cyan
    Write-Host "  =================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($num, $text) {
    Write-Host ""
    Write-Host "  [$num] $text" -ForegroundColor Yellow
    Write-Host "  --------------------------------------------------" -ForegroundColor DarkGray
}

function Write-Ok($text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function Write-Err($text)  { Write-Host "  [ERREUR] $text" -ForegroundColor Red }
function Write-Info($text) { Write-Host "  >> $text" -ForegroundColor Cyan }
function Write-Warn($text) { Write-Host "  [!] $text" -ForegroundColor Yellow }

function Pause-Script {
    Write-Host ""
    Write-Host "  Appuie sur une touche pour continuer..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Backup-File($filePath) {
    if (Test-Path $filePath) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = "$filePath.backup_$timestamp"
        Copy-Item $filePath $backupPath -Force
        Write-Ok "Backup cree : $backupPath"
        return $backupPath
    }
    return $null
}

# --------------------------------------------------
# ETAPE 1 : Collecte des infos projet
# --------------------------------------------------
Write-Header
Write-Step "1/9" "CONFIGURATION DU PROJET"

Write-Host ""
Write-Host "  Dossier du projet Angular (chemin complet) :"
Write-Host "  Exemple : D:\ANGULAR\portail-frontend" -ForegroundColor DarkGray
$projectPath = (Read-Host "  Chemin projet").Trim()

if (-not (Test-Path $projectPath)) {
    Write-Err "Le dossier '$projectPath' n'existe pas."
    Pause-Script; exit 1
}

Write-Host ""
Write-Host "  Nom du dossier dans htdocs :"
Write-Host "  Exemple : portail_sonabhy" -ForegroundColor DarkGray
$appName = (Read-Host "  Nom dossier htdocs").Trim()

Write-Host ""
Write-Host "  Chemin racine XAMPP (vide pour C:\xampp) :"
$xamppInput = (Read-Host "  Chemin XAMPP").Trim()
if ([string]::IsNullOrWhiteSpace($xamppInput)) {
    $xamppRoot = "C:\xampp"
} else {
    $xamppRoot = $xamppInput.TrimEnd("\") -replace "\\htdocs.*$", ""
}

$htdocsRoot  = "$xamppRoot\htdocs"
$htdocsPath  = "$htdocsRoot\$appName"
$apacheBin   = "$xamppRoot\apache\bin\httpd.exe"
$httpdConf   = "$xamppRoot\apache\conf\httpd.conf"
$vhostsConf  = "$xamppRoot\apache\conf\extra\httpd-vhosts.conf"
$sslConfDir  = "$xamppRoot\apache\conf\ssl.crt"
$sslKeyDir   = "$xamppRoot\apache\conf\ssl.key"

if (-not (Test-Path $htdocsRoot)) {
    Write-Err "htdocs introuvable : $htdocsRoot"
    Pause-Script; exit 1
}

# --------------------------------------------------
# Mode de deploiement
# --------------------------------------------------
Write-Host ""
Write-Host "  =================================================" -ForegroundColor DarkGray
Write-Host "  Mode de deploiement :" -ForegroundColor White
Write-Host "  [1] Local     - test sur cette machine uniquement" -ForegroundColor Yellow
Write-Host "  [2] Production HTTP  - avec domaine, sans SSL" -ForegroundColor Cyan
Write-Host "  [3] Production HTTPS - avec domaine + certificat SSL" -ForegroundColor Green
Write-Host "  =================================================" -ForegroundColor DarkGray
Write-Host ""
$modeInput = (Read-Host "  Choix (1, 2 ou 3)").Trim()

$isProduction = $false
$useSSL       = $false
$serverName   = ""
$backendPort  = "5000"
$useProxy     = $false
$sslCertPath  = ""
$sslKeyPath   = ""

if ($modeInput -eq "2" -or $modeInput -eq "3") {
    $isProduction = $true
    $useSSL = ($modeInput -eq "3")

    Write-Host ""
    Write-Host "  Nom de domaine du serveur :"
    Write-Host "  Exemple : portail.sonabhy.bf" -ForegroundColor DarkGray
    $serverName = (Read-Host "  Nom de domaine").Trim()

    # --- Proxy backend ---
    Write-Host ""
    Write-Host "  Configurer le proxy backend Node.js ? (o/n) :"
    Write-Host "  (backend sur cette meme machine)" -ForegroundColor DarkGray
    $proxyInput = (Read-Host "  Proxy").Trim()

    if ($proxyInput -eq "o" -or $proxyInput -eq "O") {
        $useProxy = $true
        Write-Host ""
        Write-Host "  Port du backend Node.js (vide pour 5000) :"
        $portInput = (Read-Host "  Port backend").Trim()
        if (-not [string]::IsNullOrWhiteSpace($portInput)) { $backendPort = $portInput }
    }

    # --- SSL ---
    if ($useSSL) {
        Write-Host ""
        Write-Host "  =================================================" -ForegroundColor DarkGray
        Write-Host "  CONFIGURATION SSL" -ForegroundColor Green
        Write-Host "  =================================================" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "  [1] Utiliser le certificat auto-signe XAMPP (existant)" -ForegroundColor Yellow
        Write-Host "  [2] Specifier mes propres fichiers certificat" -ForegroundColor Cyan
        Write-Host ""
        $sslChoice = (Read-Host "  Choix SSL (1 ou 2)").Trim()

        if ($sslChoice -eq "2") {
            Write-Host ""
            Write-Host "  Chemin du fichier .crt (certificat) :"
            Write-Host "  Exemple : C:\certs\portail.crt" -ForegroundColor DarkGray
            $sslCertPath = (Read-Host "  Certificat .crt").Trim()

            Write-Host ""
            Write-Host "  Chemin du fichier .key (cle privee) :"
            Write-Host "  Exemple : C:\certs\portail.key" -ForegroundColor DarkGray
            $sslKeyPath = (Read-Host "  Cle .key").Trim()

            if (-not (Test-Path $sslCertPath)) {
                Write-Err "Certificat introuvable : $sslCertPath"
                Pause-Script; exit 1
            }
            if (-not (Test-Path $sslKeyPath)) {
                Write-Err "Cle privee introuvable : $sslKeyPath"
                Pause-Script; exit 1
            }
        } else {
            # Certificat auto-signe XAMPP par defaut
            $sslCertPath = "$sslConfDir\server.crt"
            $sslKeyPath  = "$sslKeyDir\server.key"

            if (-not (Test-Path $sslCertPath)) {
                Write-Warn "Certificat XAMPP par defaut non trouve : $sslCertPath"
                Write-Info "Verification d'un emplacement alternatif..."
                $altCert = "$xamppRoot\apache\conf\server.crt"
                $altKey  = "$xamppRoot\apache\conf\server.key"
                if (Test-Path $altCert) {
                    $sslCertPath = $altCert
                    $sslKeyPath  = $altKey
                    Write-Ok "Certificat trouve : $sslCertPath"
                } else {
                    Write-Err "Aucun certificat SSL trouve dans XAMPP."
                    Write-Info "Generez-en un avec : cd C:\xampp\apache && bin\openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout conf\ssl.key\server.key -out conf\ssl.crt\server.crt"
                    Pause-Script; exit 1
                }
            } else {
                Write-Ok "Certificat XAMPP trouve : $sslCertPath"
            }
        }
    }

} else {
    Write-Info "Mode local - acces via http://localhost/$appName/"
}

# --------------------------------------------------
# Recapitulatif
# --------------------------------------------------
Write-Host ""
Write-Host "  =================================================" -ForegroundColor DarkGray
Write-Host "  Recapitulatif" -ForegroundColor White
Write-Host "  -------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Projet      : $projectPath" -ForegroundColor White
Write-Host "  XAMPP       : $xamppRoot" -ForegroundColor White
Write-Host "  Destination : $htdocsPath" -ForegroundColor White

if ($isProduction) {
    $modeLabel = if ($useSSL) { "Production HTTPS" } else { "Production HTTP" }
    Write-Host "  Mode        : $modeLabel" -ForegroundColor Cyan
    Write-Host "  Domaine     : $serverName" -ForegroundColor Cyan
    if ($useProxy) {
        Write-Host "  Proxy API   : /api -> http://127.0.0.1:$backendPort/api" -ForegroundColor Cyan
    }
    if ($useSSL) {
        Write-Host "  Certificat  : $sslCertPath" -ForegroundColor Green
        Write-Host "  Cle SSL     : $sslKeyPath" -ForegroundColor Green
    }
} else {
    Write-Host "  Mode        : Local" -ForegroundColor Yellow
    Write-Host "  URL         : http://localhost/$appName/" -ForegroundColor Yellow
}

Write-Host "  =================================================" -ForegroundColor DarkGray
Write-Host ""
$confirm = (Read-Host "  Confirmer le deploiement ? (o/n)").Trim()
if ($confirm -ne "o" -and $confirm -ne "O") {
    Write-Info "Annule."; exit 0
}

# --------------------------------------------------
# ETAPE 2 : Nettoyage
# --------------------------------------------------
Write-Header
Write-Step "2/9" "NETTOYAGE DU BUILD PRECEDENT"

$distPath     = Join-Path $projectPath "dist"
$angularCache = Join-Path $projectPath ".angular"

if (Test-Path $distPath) {
    Remove-Item -Recurse -Force $distPath
    Write-Ok "dist supprime"
} else {
    Write-Info "Pas de dossier dist"
}
if (Test-Path $angularCache) {
    Remove-Item -Recurse -Force $angularCache
    Write-Ok "Cache Angular supprime"
}

# --------------------------------------------------
# ETAPE 3 : Patch environment.prod.ts
# --------------------------------------------------
Write-Header
Write-Step "3/9" "VERIFICATION environment.prod.ts"

$envProdFile = Get-ChildItem -Path $projectPath -Recurse -Filter "environment.prod.ts" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($envProdFile) {
    $envContent = Get-Content $envProdFile.FullName -Raw

    # Detecter si apiUrl pointe vers une IP locale ou un port expose
    if ($envContent -match "apiUrl\s*:\s*['""]http://\d+\.\d+\.\d+\.\d+") {
        Write-Warn "apiUrl pointe vers une IP locale - correction automatique..."
        Backup-File $envProdFile.FullName | Out-Null

        # Remplacer toute valeur apiUrl par '/api'
        $envContent = $envContent -replace "apiUrl\s*:\s*['""][^'""]*['""]", "apiUrl: '/api'"
        [System.IO.File]::WriteAllText($envProdFile.FullName, $envContent, [System.Text.Encoding]::UTF8)
        Write-Ok "apiUrl corrige -> '/api' dans $($envProdFile.FullName)"
    } elseif ($envContent -match "apiUrl\s*:\s*['"']/api['"']") {
        Write-Ok "apiUrl deja correct ('/api')"
    } else {
        Write-Warn "apiUrl non detecte automatiquement - verifie manuellement $($envProdFile.FullName)"
        Write-Info "Il doit contenir : apiUrl: '/api'"
    }
} else {
    Write-Info "environment.prod.ts non trouve - passe"
}

# --------------------------------------------------
# ETAPE 4 : Build Angular
# --------------------------------------------------
Write-Header
Write-Step "4/9" "BUILD ANGULAR (PRODUCTION)"

Set-Location $projectPath
$baseHref = if ($isProduction) { "/" } else { "/$appName/" }
$buildCmd = "ng build --configuration production --base-href $baseHref"

Write-Host "  Commande : $buildCmd" -ForegroundColor DarkGray
Write-Host ""
Invoke-Expression $buildCmd

if ($LASTEXITCODE -ne 0) {
    Write-Err "Le build Angular a echoue !"
    Pause-Script; exit 1
}
Write-Ok "Build Angular termine !"

# Detecter le dossier de sortie
$browserPath = Join-Path $distPath "$appName\browser"
$directPath  = Join-Path $distPath $appName

if (Test-Path $browserPath)     { $buildOutput = $browserPath }
elseif (Test-Path $directPath)  { $buildOutput = $directPath }
else {
    $subFolders = Get-ChildItem $distPath -Directory -ErrorAction SilentlyContinue
    if ($subFolders.Count -gt 0) {
        $firstSub   = $subFolders[0].FullName
        $browserSub = Join-Path $firstSub "browser"
        $buildOutput = if (Test-Path $browserSub) { $browserSub } else { $firstSub }
    } else {
        Write-Err "Impossible de trouver les fichiers buildes dans dist/"
        Pause-Script; exit 1
    }
}
Write-Info "Sortie build : $buildOutput"

# --------------------------------------------------
# ETAPE 5 : Copie vers htdocs
# --------------------------------------------------
Write-Header
Write-Step "5/9" "COPIE VERS HTDOCS"

if (Test-Path $htdocsPath) {
    Remove-Item -Recurse -Force $htdocsPath
    Write-Ok "Ancien deploiement supprime"
}
New-Item -ItemType Directory -Path $htdocsPath | Out-Null
Copy-Item -Path "$buildOutput\*" -Destination $htdocsPath -Recurse -Force
Write-Ok "Fichiers copies vers $htdocsPath"

# --------------------------------------------------
# ETAPE 6 : .htaccess
# --------------------------------------------------
Write-Header
Write-Step "6/9" "CREATION DU FICHIER .HTACCESS"

$rewriteBase   = if ($isProduction) { "/" } else { "/$appName/" }
$rewriteTarget = if ($isProduction) { "/index.html" } else { "/$appName/index.html" }

$htaccessContent = @"
Options -MultiViews
AddType application/wasm .wasm
RewriteEngine On
RewriteBase $rewriteBase
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . $rewriteTarget [L]
"@

$htaccessPath = Join-Path $htdocsPath ".htaccess"
[System.IO.File]::WriteAllText($htaccessPath, $htaccessContent, [System.Text.Encoding]::UTF8)
Write-Ok ".htaccess cree (RewriteBase $rewriteBase)"

# --------------------------------------------------
# ETAPE 7 : Modules Apache
# --------------------------------------------------
Write-Header
Write-Step "7/9" "ACTIVATION DES MODULES APACHE"

Backup-File $httpdConf | Out-Null
$httpdContent = Get-Content $httpdConf -Raw
$modified = $false

$modules = @("rewrite_module modules/mod_rewrite.so")
if ($useProxy) {
    $modules += "proxy_module modules/mod_proxy.so"
    $modules += "proxy_http_module modules/mod_proxy_http.so"
}
if ($useSSL) {
    $modules += "ssl_module modules/mod_ssl.so"
    $modules += "socache_shmcb_module modules/mod_socache_shmcb.so"
}

foreach ($mod in $modules) {
    if ($httpdContent -match [regex]::Escape("#LoadModule $mod")) {
        $httpdContent = $httpdContent -replace [regex]::Escape("#LoadModule $mod"), "LoadModule $mod"
        Write-Ok "Module active : $mod"
        $modified = $true
    } else {
        Write-Info "Deja actif : $mod"
    }
}

# AllowOverride All
if ($httpdContent -match "AllowOverride [Nn]one") {
    $httpdContent = $httpdContent -replace "AllowOverride [Nn]one", "AllowOverride All"
    Write-Ok "AllowOverride mis a jour : All"
    $modified = $true
}

# Activer httpd-vhosts.conf
if ($isProduction) {
    if ($httpdContent -match "#Include conf/extra/httpd-vhosts.conf") {
        $httpdContent = $httpdContent -replace "#Include conf/extra/httpd-vhosts.conf", "Include conf/extra/httpd-vhosts.conf"
        Write-Ok "httpd-vhosts.conf active"
        $modified = $true
    } else {
        Write-Info "httpd-vhosts.conf deja inclus"
    }
}

# Activer httpd-ssl.conf si SSL
if ($useSSL) {
    if ($httpdContent -match "#Include conf/extra/httpd-ssl.conf") {
        $httpdContent = $httpdContent -replace "#Include conf/extra/httpd-ssl.conf", "Include conf/extra/httpd-ssl.conf"
        Write-Ok "httpd-ssl.conf active"
        $modified = $true
    } else {
        Write-Info "httpd-ssl.conf deja inclus"
    }
}

if ($modified) {
    [System.IO.File]::WriteAllText($httpdConf, $httpdContent, [System.Text.Encoding]::UTF8)
    Write-Ok "httpd.conf mis a jour"
}

# --------------------------------------------------
# ETAPE 8 : Virtual Host
# --------------------------------------------------
Write-Header
Write-Step "8/9" "CONFIGURATION VIRTUAL HOST"

if ($isProduction -and -not [string]::IsNullOrWhiteSpace($serverName)) {

    Backup-File $vhostsConf | Out-Null

    $docRoot    = "C:/xampp/htdocs/$appName"
    $sslCertFwd = $sslCertPath -replace "\\", "/"
    $sslKeyFwd  = $sslKeyPath  -replace "\\", "/"

    $proxyBlock = ""
    if ($useProxy) {
        $proxyBlock = @"

    ProxyPreserveHost On
    ProxyPass        /api http://127.0.0.1:$backendPort/api
    ProxyPassReverse /api http://127.0.0.1:$backendPort/api
"@
    }

    $dirBlock = @"

    <Directory "$docRoot">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog  "logs/$appName-error.log"
    CustomLog "logs/$appName-access.log" combined
"@

    if ($useSSL) {
        # HTTP -> redirige vers HTTPS
        $vhostContent = @"
# --- Redirection HTTP -> HTTPS ---
<VirtualHost *:80>
    ServerName $serverName
    Redirect permanent / https://$serverName/
</VirtualHost>

# --- Site principal HTTPS ---
<VirtualHost *:443>
    DocumentRoot "$docRoot"
    ServerName $serverName

    SSLEngine on
    SSLCertificateFile    "$sslCertFwd"
    SSLCertificateKeyFile "$sslKeyFwd"

    # Compatibilite navigateurs modernes
    SSLProtocol all -SSLv2 -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite HIGH:!aNULL:!MD5
    SSLHonorCipherOrder on
$proxyBlock$dirBlock
</VirtualHost>
"@
    } else {
        # HTTP simple
        $vhostContent = @"
<VirtualHost *:80>
    DocumentRoot "$docRoot"
    ServerName $serverName
$proxyBlock$dirBlock
</VirtualHost>
"@
    }

    [System.IO.File]::WriteAllText($vhostsConf, $vhostContent, [System.Text.Encoding]::UTF8)
    Write-Ok "Virtual Host configure pour $serverName"

    if ($useSSL) {
        Write-Info "VirtualHost *:443 configure avec SSL"
        Write-Info "VirtualHost *:80  redirige vers HTTPS"
    }

} else {
    Write-Info "Mode local - Virtual Host non configure"
}

# --------------------------------------------------
# ETAPE 9 : Verification Apache + instructions
# --------------------------------------------------
Write-Header
Write-Step "9/9" "VERIFICATION DE LA CONFIGURATION APACHE"

if (Test-Path $apacheBin) {
    $result = & $apacheBin -t 2>&1
    if ($result -match "Syntax OK") {
        Write-Ok "Configuration Apache valide (Syntax OK)"
    } else {
        Write-Host ""
        Write-Host $result -ForegroundColor Red
        Write-Err "Erreur dans la configuration Apache !"
        Write-Host ""
        Write-Warn "Consultez les logs : $xamppRoot\apache\logs\error.log"
        Write-Host ""

        Write-Host "  Voulez-vous restaurer la config Apache precedente ? (o/n)" -ForegroundColor Yellow
        $restore = (Read-Host "  Restaurer").Trim()
        if ($restore -eq "o" -or $restore -eq "O") {
            $latestBackup = Get-ChildItem "$httpdConf.backup_*" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if ($latestBackup) {
                Copy-Item $latestBackup.FullName $httpdConf -Force
                Write-Ok "httpd.conf restaure depuis $($latestBackup.Name)"
            }
            $latestVhostBackup = Get-ChildItem "$vhostsConf.backup_*" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if ($latestVhostBackup) {
                Copy-Item $latestVhostBackup.FullName $vhostsConf -Force
                Write-Ok "httpd-vhosts.conf restaure depuis $($latestVhostBackup.Name)"
            }
            Write-Warn "Config restauree - redemarrez Apache manuellement"
        }
        Pause-Script; exit 1
    }
} else {
    Write-Info "Binaire Apache non trouve dans $xamppRoot"
}

# --------------------------------------------------
# RESUME FINAL
# --------------------------------------------------
Write-Header
Write-Host "  =================================================" -ForegroundColor Green
Write-Host "           DEPLOIEMENT TERMINE !                   " -ForegroundColor Green
Write-Host "  =================================================" -ForegroundColor Green
Write-Host ""

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notmatch "^169\."
} | Select-Object -First 1).IPAddress

if ($isProduction) {
    $proto = if ($useSSL) { "https" } else { "http" }
    Write-Host "  URL domaine  : $proto`://$serverName/" -ForegroundColor Green
    if ($useProxy) {
        Write-Host "  API proxy    : $proto`://$serverName/api/" -ForegroundColor Cyan
    }
    Write-Host "  Acces local  : http://localhost/" -ForegroundColor White
    if ($ip) { Write-Host "  Acces reseau : http://$ip/" -ForegroundColor White }
} else {
    Write-Host "  Acces local  : http://localhost/$appName/" -ForegroundColor Yellow
    if ($ip) { Write-Host "  Acces reseau : http://$ip/$appName/" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "  -------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  IMPORTANT : Redemarrer Apache dans XAMPP !" -ForegroundColor Yellow
Write-Host "  -------------------------------------------------" -ForegroundColor DarkGray

if ($useSSL) {
    Write-Host ""
    Write-Host "  Note SSL : Certificat auto-signe = avertissement" -ForegroundColor DarkYellow
    Write-Host "  navigateur normal. Les utilisateurs doivent" -ForegroundColor DarkYellow
    Write-Host "  accepter l'exception de securite." -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "  =================================================" -ForegroundColor DarkGray
Write-Host ""

Pause-Script
