using System.Management;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.Sqlite;

namespace SalvadoreXPOS.Services;

public class LicensingService
{
    private readonly string _dbPath;
    
    public LicensingService()
    {
        _dbPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SalvadoreXPOS", "license.db"
        );
        Directory.CreateDirectory(Path.GetDirectoryName(_dbPath)!);
        InitializeDatabase();
    }
    
    private void InitializeDatabase()
    {
        using var connection = new SqliteConnection($"Data Source={_dbPath}");
        connection.Open();
        
        var cmd = new SqliteCommand(@"
            CREATE TABLE IF NOT EXISTS licenses (
                hardware_id TEXT PRIMARY KEY,
                license_key TEXT,
                activated_at TEXT,
                expires_at TEXT,
                is_active INTEGER DEFAULT 1
            )", connection);
        cmd.ExecuteNonQuery();
    }
    
    public string GetHardwareId()
    {
        var components = new StringBuilder();
        
        // CPU ID
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor");
            foreach (ManagementObject obj in searcher.Get())
            {
                components.Append(obj["ProcessorId"]?.ToString() ?? "");
                break;
            }
        }
        catch { }
        
        // Motherboard Serial
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BaseBoard");
            foreach (ManagementObject obj in searcher.Get())
            {
                components.Append(obj["SerialNumber"]?.ToString() ?? "");
                break;
            }
        }
        catch { }
        
        // BIOS Serial
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS");
            foreach (ManagementObject obj in searcher.Get())
            {
                components.Append(obj["SerialNumber"]?.ToString() ?? "");
                break;
            }
        }
        catch { }
        
        // Disk Serial
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_DiskDrive WHERE Index = 0");
            foreach (ManagementObject obj in searcher.Get())
            {
                components.Append(obj["SerialNumber"]?.ToString() ?? "");
                break;
            }
        }
        catch { }
        
        // Generar hash del fingerprint
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(components.ToString()));
        var hardwareId = BitConverter.ToString(hash).Replace("-", "").Substring(0, 32);
        
        return $"SVDX-{hardwareId.Substring(0, 8)}-{hardwareId.Substring(8, 8)}-{hardwareId.Substring(16, 8)}-{hardwareId.Substring(24, 8)}";
    }
    
    public bool ValidateLicense()
    {
        var hardwareId = GetHardwareId();
        
        using var connection = new SqliteConnection($"Data Source={_dbPath}");
        connection.Open();
        
        var cmd = new SqliteCommand(
            "SELECT license_key, expires_at, is_active FROM licenses WHERE hardware_id = @hwid",
            connection
        );
        cmd.Parameters.AddWithValue("@hwid", hardwareId);
        
        using var reader = cmd.ExecuteReader();
        if (reader.Read())
        {
            var isActive = reader.GetInt32(2) == 1;
            var expiresAt = reader.IsDBNull(1) ? (DateTime?)null : DateTime.Parse(reader.GetString(1));
            
            if (!isActive)
                return false;
            
            if (expiresAt.HasValue && expiresAt.Value < DateTime.UtcNow)
                return false;
            
            return true;
        }
        
        // Para desarrollo: auto-activar si no existe licencia
        // En producción, esto debería retornar false
#if DEBUG
        ActivateLicense(hardwareId, GenerateDevLicenseKey(hardwareId), null);
        return true;
#else
        return false;
#endif
    }
    
    public bool ActivateLicense(string hardwareId, string licenseKey, DateTime? expiresAt)
    {
        // Validar formato de licencia
        if (!ValidateLicenseKeyFormat(licenseKey))
            return false;
        
        // Verificar que la licencia corresponde al hardware
        if (!VerifyLicenseForHardware(hardwareId, licenseKey))
            return false;
        
        using var connection = new SqliteConnection($"Data Source={_dbPath}");
        connection.Open();
        
        var cmd = new SqliteCommand(@"
            INSERT OR REPLACE INTO licenses (hardware_id, license_key, activated_at, expires_at, is_active)
            VALUES (@hwid, @key, @activated, @expires, 1)",
            connection
        );
        
        cmd.Parameters.AddWithValue("@hwid", hardwareId);
        cmd.Parameters.AddWithValue("@key", licenseKey);
        cmd.Parameters.AddWithValue("@activated", DateTime.UtcNow.ToString("o"));
        cmd.Parameters.AddWithValue("@expires", expiresAt?.ToString("o") ?? (object)DBNull.Value);
        
        cmd.ExecuteNonQuery();
        return true;
    }
    
    public void DeactivateLicense()
    {
        var hardwareId = GetHardwareId();
        
        using var connection = new SqliteConnection($"Data Source={_dbPath}");
        connection.Open();
        
        var cmd = new SqliteCommand("UPDATE licenses SET is_active = 0 WHERE hardware_id = @hwid", connection);
        cmd.Parameters.AddWithValue("@hwid", hardwareId);
        cmd.ExecuteNonQuery();
    }
    
    private bool ValidateLicenseKeyFormat(string licenseKey)
    {
        // Formato: XXXX-XXXX-XXXX-XXXX-XXXX
        if (string.IsNullOrEmpty(licenseKey))
            return false;
        
        var parts = licenseKey.Split('-');
        if (parts.Length != 5)
            return false;
        
        return parts.All(p => p.Length == 4 && p.All(c => char.IsLetterOrDigit(c)));
    }
    
    private bool VerifyLicenseForHardware(string hardwareId, string licenseKey)
    {
        // En producción, esto verificaría con un servidor de licencias
        // Por ahora, verificamos que el hash del hardwareId esté en la licencia
        
        using var sha256 = SHA256.Create();
        var expectedHash = sha256.ComputeHash(
            Encoding.UTF8.GetBytes(hardwareId + "SALVADOREX_SECRET_KEY")
        );
        var expectedChecksum = BitConverter.ToString(expectedHash).Replace("-", "").Substring(0, 4);
        
        return licenseKey.StartsWith(expectedChecksum);
    }
    
    private string GenerateDevLicenseKey(string hardwareId)
    {
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(
            Encoding.UTF8.GetBytes(hardwareId + "SALVADOREX_SECRET_KEY")
        );
        var key = BitConverter.ToString(hash).Replace("-", "");
        
        return $"{key.Substring(0, 4)}-{key.Substring(4, 4)}-{key.Substring(8, 4)}-{key.Substring(12, 4)}-{key.Substring(16, 4)}";
    }
}
