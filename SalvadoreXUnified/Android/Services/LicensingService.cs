using Android.Content;
using Android.Provider;
using System.Security.Cryptography;
using System.Text;

namespace SalvadoreXPOS.Services;

public class LicensingService
{
    private readonly Context _context;
    private readonly ISharedPreferences _prefs;
    
    public LicensingService(Context context)
    {
        _context = context;
        _prefs = context.GetSharedPreferences("SalvadoreXLicense", FileCreationMode.Private);
    }
    
    public string GetHardwareId()
    {
        var components = new StringBuilder();
        
        // Android ID (unique per device)
        var androidId = Settings.Secure.GetString(_context.ContentResolver, Settings.Secure.AndroidId);
        components.Append(androidId ?? "");
        
        // Device model and manufacturer
        components.Append(Android.OS.Build.Model ?? "");
        components.Append(Android.OS.Build.Manufacturer ?? "");
        components.Append(Android.OS.Build.Serial ?? "");
        components.Append(Android.OS.Build.Board ?? "");
        
        // Generate hash
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(components.ToString()));
        var hardwareId = BitConverter.ToString(hash).Replace("-", "").Substring(0, 32);
        
        return $"SVDX-{hardwareId.Substring(0, 8)}-{hardwareId.Substring(8, 8)}-{hardwareId.Substring(16, 8)}-{hardwareId.Substring(24, 8)}";
    }
    
    public bool ValidateLicense()
    {
        var storedKey = _prefs.GetString("license_key", null);
        var storedHwId = _prefs.GetString("hardware_id", null);
        var hardwareId = GetHardwareId();
        
        // Check if hardware ID matches
        if (storedHwId != null && storedHwId != hardwareId)
            return false;
        
        // Validate license key
        if (!string.IsNullOrEmpty(storedKey) && VerifyLicenseForHardware(hardwareId, storedKey))
            return true;
        
#if DEBUG
        // Auto-activate in debug mode
        var devKey = GenerateDevLicenseKey(hardwareId);
        ActivateLicense(devKey);
        return true;
#else
        return false;
#endif
    }
    
    public bool ActivateLicense(string licenseKey)
    {
        var hardwareId = GetHardwareId();
        
        if (!ValidateLicenseKeyFormat(licenseKey))
            return false;
        
        if (!VerifyLicenseForHardware(hardwareId, licenseKey))
            return false;
        
        var editor = _prefs.Edit();
        editor.PutString("license_key", licenseKey);
        editor.PutString("hardware_id", hardwareId);
        editor.PutString("activated_at", DateTime.UtcNow.ToString("o"));
        editor.Apply();
        
        return true;
    }
    
    private bool ValidateLicenseKeyFormat(string key)
    {
        if (string.IsNullOrEmpty(key)) return false;
        var parts = key.Split('-');
        if (parts.Length != 5) return false;
        return parts.All(p => p.Length == 4 && p.All(char.IsLetterOrDigit));
    }
    
    private bool VerifyLicenseForHardware(string hardwareId, string licenseKey)
    {
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
