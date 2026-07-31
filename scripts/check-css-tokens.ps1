$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stylesDirectory = Join-Path $projectRoot "styles"
$tokensPath = Join-Path $stylesDirectory "tokens.css"
$errors = [System.Collections.Generic.List[string]]::new()

if (-not (Test-Path -LiteralPath $tokensPath)) {
    throw "Missing required token source: styles/tokens.css"
}

$cssFiles = Get-ChildItem -LiteralPath $stylesDirectory -Filter "*.css"
$tokensCss = Get-Content -Raw -LiteralPath $tokensPath
$tokenMatches = [regex]::Matches(
    $tokensCss,
    "(?m)^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);",
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

$declaredTokens = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::OrdinalIgnoreCase
)

foreach ($match in $tokenMatches) {
    [void]$declaredTokens.Add($match.Groups[1].Value)
}

if ($declaredTokens.Count -eq 0) {
    $errors.Add("styles/tokens.css does not declare any CSS custom properties.")
}

foreach ($cssFile in $cssFiles) {
    $relativePath = "styles/$($cssFile.Name)"
    $css = Get-Content -Raw -LiteralPath $cssFile.FullName

    if ($cssFile.FullName -ne $tokensPath) {
        $declarations = [regex]::Matches(
            $css,
            "(?m)^\s*--[a-z0-9-]+\s*:",
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )

        if ($declarations.Count -gt 0) {
            $errors.Add("$relativePath declares CSS variables. Move them to styles/tokens.css.")
        }

        if ([regex]::IsMatch($css, "(?m)^\s*:root\s*\{")) {
            $errors.Add("$relativePath contains a :root block. Only styles/tokens.css may contain :root.")
        }
    }

    if ($cssFile.Name -ne "layout.css" -and $cssFile.FullName -ne $tokensPath) {
        $buttonBlocks = [regex]::Matches(
            $css,
            "(?s)[^{}]*\.button(?:--[a-z0-9-]+)?[^{}]*\{([^{}]*)\}",
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )

        foreach ($buttonBlock in $buttonBlocks) {
            if ([regex]::IsMatch(
                $buttonBlock.Groups[1].Value,
                "(?m)^\s*(?:background(?:-color)?|border(?:-color)?)\s*:"
            )) {
                $errors.Add(
                    "$relativePath overrides button background or border color. Keep button colors in styles/layout.css."
                )
                break
            }
        }
    }

    if ([regex]::IsMatch(
        $css,
        "(?m)^\s*(?:background(?:-color)?|border(?:-color)?)\s*:\s*var\([^;]+\)\s*,\s*var\("
    )) {
        $errors.Add("$relativePath contains an invalid comma-separated token declaration.")
    }

    $references = [regex]::Matches(
        $css,
        "var\(\s*(--[a-z0-9-]+)",
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    foreach ($reference in $references) {
        $tokenName = $reference.Groups[1].Value
        if (-not $declaredTokens.Contains($tokenName)) {
            $errors.Add("$relativePath references undeclared token $tokenName.")
        }
    }
}

$literalColors = $tokenMatches |
    Where-Object { $_.Groups[2].Value.Trim() -match "^#[0-9a-f]{3,8}$" } |
    ForEach-Object { $_.Groups[2].Value.Trim() } |
    Sort-Object -Unique

foreach ($cssFile in $cssFiles | Where-Object { $_.FullName -ne $tokensPath }) {
    $css = Get-Content -Raw -LiteralPath $cssFile.FullName
    foreach ($color in $literalColors) {
        if ([regex]::IsMatch(
            $css,
            [regex]::Escape($color),
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )) {
            $errors.Add("styles/$($cssFile.Name) repeats token value $color. Use the matching var(...) token.")
        }
    }
}

$htmlFiles = Get-ChildItem -LiteralPath $projectRoot -Filter "*.html"
foreach ($htmlFile in $htmlFiles) {
    $html = Get-Content -Raw -LiteralPath $htmlFile.FullName
    $tokenLinks = [regex]::Matches($html, 'href=["'']\/styles\/tokens\.css["'']')
    $layoutLinks = [regex]::Matches($html, 'href=["'']\/styles\/layout\.css["'']')
    $localStyles = [regex]::Matches(
        $html,
        'href=["''](\/styles\/[^"'']+\.css)["'']',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    if ($tokenLinks.Count -ne 1) {
        $errors.Add("$($htmlFile.Name) must load /styles/tokens.css exactly once.")
        continue
    }

    if ($layoutLinks.Count -ne 1) {
        $errors.Add("$($htmlFile.Name) must load /styles/layout.css exactly once.")
        continue
    }

    if ($tokenLinks[0].Index -gt $layoutLinks[0].Index) {
        $errors.Add("$($htmlFile.Name) must load tokens.css before layout.css.")
    }

    if (
        $localStyles.Count -lt 2 -or
        $localStyles[0].Groups[1].Value -ne "/styles/tokens.css" -or
        $localStyles[1].Groups[1].Value -ne "/styles/layout.css"
    ) {
        $errors.Add(
            "$($htmlFile.Name) stylesheet order must be tokens.css, layout.css, then the page stylesheet."
        )
    }
}

if ($errors.Count -gt 0) {
    Write-Host "CSS token validation failed:" -ForegroundColor Red
    foreach ($validationError in $errors | Sort-Object -Unique) {
        Write-Host " - $validationError" -ForegroundColor Red
    }
    exit 1
}

Write-Host "CSS token validation passed." -ForegroundColor Green
Write-Host "Source of truth: styles/tokens.css ($($declaredTokens.Count) tokens)"
Write-Host "Validated $($cssFiles.Count) stylesheets and $($htmlFiles.Count) HTML pages."
