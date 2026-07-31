# PowerShell script to seed/recreate demo admin accounts on backend restart
$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:9090/api/auth/register"

# Register School Admin
$schoolAdminBody = @{
    name = "School Admin"
    email = "admin2@testschool.elekeza.app"
    password = "teacher123"
    role = "SCHOOL_ADMIN"
    gender = "MALE"
    phone = "+254711111111"
} | ConvertTo-Json

# Register Super Admin
$superAdminBody = @{
    name = "Super Admin"
    email = "superadmin@elekeza.app"
    password = "teacher123"
    role = "ADMIN"
    gender = "MALE"
    phone = "+254722222222"
} | ConvertTo-Json

Write-Host "Registering School Admin (admin2@testschool.elekeza.app)..."
try {
    $res1 = Invoke-RestMethod -Uri $baseUrl -Method Post -ContentType "application/json" -Body $schoolAdminBody
    Write-Host "School Admin registered successfully!"
} catch {
    Write-Host "School Admin registration returned: $_"
}

Write-Host "Registering Super Admin (superadmin@elekeza.app)..."
try {
    $res2 = Invoke-RestMethod -Uri $baseUrl -Method Post -ContentType "application/json" -Body $superAdminBody
    Write-Host "Super Admin registered successfully!"
} catch {
    Write-Host "Super Admin registration returned: $_"
}
