$root = $PSScriptRoot
$port = 3000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Server running at http://localhost:$port"

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $url = $ctx.Request.Url.LocalPath
        if ($url -eq "/") { $url = "/index.html" }
        $filePath = Join-Path $root ($url.TrimStart("/").Replace("/", "\"))

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = switch ($ext) {
                ".html" { "text/html" }
                ".css"  { "text/css" }
                ".js"   { "application/javascript" }
                ".json" { "application/json" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                ".ico"  { "image/x-icon" }
                ".php"  { "text/html" }
                ".env"  { "text/plain" }
                ".sql"  { "text/plain" }
                ".woff2" { "font/woff2" }
                default { "application/octet-stream" }
            }
            $ctx.Response.StatusCode = 200
            $ctx.Response.ContentType = "$mime; charset=utf-8"
            $ctx.Response.ContentLength64 = $bytes.LongLength
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            $ctx.Response.OutputStream.Flush()
        } else {
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $ctx.Response.StatusCode = 404
            $ctx.Response.ContentType = "text/plain; charset=utf-8"
            $ctx.Response.ContentLength64 = $msg.LongLength
            $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
            $ctx.Response.OutputStream.Flush()
        }
        $ctx.Response.Close()
    } catch {
        # silently continue on broken pipe / client disconnect
    }
}
