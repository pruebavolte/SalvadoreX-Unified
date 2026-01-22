using Android.App;
using Android.OS;
using Android.Webkit;
using Android.Views;
using Android.Content.PM;
using SalvadoreXPOS.Services;

namespace SalvadoreXPOS;

[Activity(
    Label = "SalvadoreX POS",
    MainLauncher = true,
    Theme = "@android:style/Theme.Material.Light.NoActionBar",
    ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode,
    ScreenOrientation = ScreenOrientation.Portrait)]
public class MainActivity : Activity
{
    private WebView? _webView;
    private DatabaseService? _db;
    private SyncService? _sync;
    private LicensingService? _licensing;
    
    protected override async void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        
        // Fullscreen
        Window?.SetFlags(WindowManagerFlags.Fullscreen, WindowManagerFlags.Fullscreen);
        
        // Initialize services
        _db = new DatabaseService(this);
        await _db.InitializeAsync();
        
        _sync = new SyncService(_db);
        _licensing = new LicensingService(this);
        
        // Verify license
        if (!_licensing.ValidateLicense())
        {
            ShowActivationDialog();
            return;
        }
        
        // Create WebView
        _webView = new WebView(this);
        _webView.Settings.JavaScriptEnabled = true;
        _webView.Settings.DomStorageEnabled = true;
        _webView.Settings.AllowFileAccess = true;
        _webView.Settings.AllowContentAccess = true;
        _webView.Settings.CacheMode = CacheModes.Normal;
        
        // JavaScript interface for native bridge
        var bridge = new NativeBridge(_db, _sync, _licensing);
        _webView.AddJavascriptInterface(bridge, "NativeAPI");
        
        // Load web app
        _webView.LoadUrl("file:///android_asset/webapp/index.html");
        
        SetContentView(_webView);
        
        // Start background sync
        _sync.StartBackgroundSync();
    }
    
    private void ShowActivationDialog()
    {
        var builder = new AlertDialog.Builder(this);
        builder.SetTitle("Activación Requerida");
        builder.SetMessage($"Esta copia no está activada.\n\nID de Hardware:\n{_licensing?.GetHardwareId()}\n\nContacte a su proveedor.");
        builder.SetPositiveButton("Cerrar", (s, e) => FinishAffinity());
        builder.SetCancelable(false);
        builder.Show();
    }
    
    public override void OnBackPressed()
    {
        if (_webView?.CanGoBack() == true)
        {
            _webView.GoBack();
        }
        else
        {
            base.OnBackPressed();
        }
    }
    
    protected override void OnDestroy()
    {
        _sync?.StopBackgroundSync();
        base.OnDestroy();
    }
}

// JavaScript Bridge
public class NativeBridge : Java.Lang.Object
{
    private readonly DatabaseService _db;
    private readonly SyncService _sync;
    private readonly LicensingService _licensing;
    
    public NativeBridge(DatabaseService db, SyncService sync, LicensingService licensing)
    {
        _db = db;
        _sync = sync;
        _licensing = licensing;
    }
    
    [JavascriptInterface]
    [Android.Runtime.Export("isOffline")]
    public bool IsOffline() => !_sync.IsOnline;
    
    [JavascriptInterface]
    [Android.Runtime.Export("getProducts")]
    public string GetProducts() => _db.GetProductsAsync().GetAwaiter().GetResult();
    
    [JavascriptInterface]
    [Android.Runtime.Export("saveProduct")]
    public void SaveProduct(string json) => _db.SaveProductAsync(json).GetAwaiter().GetResult();
    
    [JavascriptInterface]
    [Android.Runtime.Export("getCustomers")]
    public string GetCustomers() => _db.GetCustomersAsync().GetAwaiter().GetResult();
    
    [JavascriptInterface]
    [Android.Runtime.Export("saveCustomer")]
    public void SaveCustomer(string json) => _db.SaveCustomerAsync(json).GetAwaiter().GetResult();
    
    [JavascriptInterface]
    [Android.Runtime.Export("getSales")]
    public string GetSales() => _db.GetSalesAsync().GetAwaiter().GetResult();
    
    [JavascriptInterface]
    [Android.Runtime.Export("saveSale")]
    public void SaveSale(string json) => _db.SaveSaleAsync(json).GetAwaiter().GetResult();
    
    [JavascriptInterface]
    [Android.Runtime.Export("getSetting")]
    public string GetSetting(string key) => _db.GetSettingAsync(key).GetAwaiter().GetResult();
    
    [JavascriptInterface]
    [Android.Runtime.Export("setSetting")]
    public void SetSetting(string key, string value) => _db.SetSettingAsync(key, value).GetAwaiter().GetResult();
    
    [JavascriptInterface]
    [Android.Runtime.Export("syncNow")]
    public void SyncNow() => _sync.ForceSyncNowAsync().GetAwaiter().GetResult();
    
    [JavascriptInterface]
    [Android.Runtime.Export("getHardwareId")]
    public string GetHardwareId() => _licensing.GetHardwareId();
}
