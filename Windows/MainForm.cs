using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using SalvadoreXPOS.Services;

namespace SalvadoreXPOS;

public partial class MainForm : Form
{
    private WebView2 webView;
    private readonly DatabaseService _db;
    private readonly SyncService _sync;
    private readonly StatusStrip _statusStrip;
    private readonly ToolStripStatusLabel _statusLabel;
    private readonly ToolStripStatusLabel _syncLabel;
    
    public MainForm()
    {
        InitializeComponent();
        
        _db = new DatabaseService();
        _sync = new SyncService(_db);
        
        // Configurar forma
        this.Text = "SalvadoreX POS";
        this.Size = new Size(1366, 768);
        this.MinimumSize = new Size(1024, 600);
        this.StartPosition = FormStartPosition.CenterScreen;
        this.WindowState = FormWindowState.Maximized;
        
        // Barra de estado
        _statusStrip = new StatusStrip();
        _statusLabel = new ToolStripStatusLabel("Listo");
        _syncLabel = new ToolStripStatusLabel("• Sin conexión") { ForeColor = Color.Gray };
        _statusStrip.Items.AddRange(new ToolStripItem[] { _statusLabel, new ToolStripStatusLabel() { Spring = true }, _syncLabel });
        this.Controls.Add(_statusStrip);
        
        // WebView2
        webView = new WebView2
        {
            Dock = DockStyle.Fill
        };
        this.Controls.Add(webView);
        
        // Inicializar
        InitializeAsync();
    }
    
    private async void InitializeAsync()
    {
        try
        {
            // Inicializar base de datos
            await _db.InitializeAsync();
            
            // Inicializar WebView2
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SalvadoreXPOS", "WebView2Data"
            );
            Directory.CreateDirectory(userDataFolder);
            
            var environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await webView.EnsureCoreWebView2Async(environment);
            
            // Configurar WebView2
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.IsZoomControlEnabled = false;
            
            // Exponer API nativa a JavaScript
            webView.CoreWebView2.AddHostObjectToScript("nativeApi", new NativeBridge(_db, _sync));
            
            // Inyectar script para API nativa (usando proxy síncrono)
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
                (function() {
                    const api = chrome.webview.hostObjects.sync.nativeApi;
                    window.NativeAPI = {
                        isOffline: function() { 
                            try { return api.IsOffline; } 
                            catch(e) { console.error('isOffline error:', e); return true; } 
                        },
                        getProducts: function() { 
                            try { return api.GetProducts(); } 
                            catch(e) { console.error('getProducts error:', e); return '[]'; } 
                        },
                        saveProduct: function(json) { 
                            try { api.SaveProduct(json); } 
                            catch(e) { console.error('saveProduct error:', e); } 
                        },
                        getCategories: function() { 
                            try { return api.GetCategories(); } 
                            catch(e) { console.error('getCategories error:', e); return '[]'; } 
                        },
                        saveCategory: function(json) { 
                            try { api.SaveCategory(json); } 
                            catch(e) { console.error('saveCategory error:', e); } 
                        },
                        getCustomers: function() { 
                            try { return api.GetCustomers(); } 
                            catch(e) { console.error('getCustomers error:', e); return '[]'; } 
                        },
                        saveCustomer: function(json) { 
                            try { api.SaveCustomer(json); } 
                            catch(e) { console.error('saveCustomer error:', e); } 
                        },
                        getSales: function() { 
                            try { return api.GetSales(); } 
                            catch(e) { console.error('getSales error:', e); return '[]'; } 
                        },
                        saveSale: function(json) { 
                            try { api.SaveSale(json); } 
                            catch(e) { console.error('saveSale error:', e); } 
                        },
                        getSetting: function(key) { 
                            try { return api.GetSetting(key); } 
                            catch(e) { console.error('getSetting error:', e); return ''; } 
                        },
                        setSetting: function(key, value) { 
                            try { api.SetSetting(key, value); } 
                            catch(e) { console.error('setSetting error:', e); } 
                        },
                        syncNow: function() { 
                            try { api.SyncNow(); } 
                            catch(e) { console.error('syncNow error:', e); } 
                        },
                        getHardwareId: function() { 
                            try { return api.GetHardwareId(); } 
                            catch(e) { console.error('getHardwareId error:', e); return 'ERROR'; } 
                        }
                    };
                    console.log('NativeAPI initialized with sync proxy');
                })();
            ");
            
            // Cargar aplicación web
            var webAppPath = Path.Combine(AppContext.BaseDirectory, "WebApp", "index.html");
            if (File.Exists(webAppPath))
            {
                webView.CoreWebView2.Navigate($"file:///{webAppPath.Replace('\\', '/')}");
            }
            else
            {
                // Si no hay web app local, cargar desde URL remota
                webView.CoreWebView2.Navigate("https://salvadorex.replit.app/dashboard");
            }
            
            // Iniciar sincronización en segundo plano
            _sync.StatusChanged += (s, msg) => 
            {
                this.Invoke(() => 
                {
                    _syncLabel.Text = msg;
                    _syncLabel.ForeColor = _sync.IsOnline ? Color.Green : Color.Gray;
                });
            };
            _sync.StartBackgroundSync();
            
            _statusLabel.Text = "Aplicación cargada";
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Error al inicializar: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
    
    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        _sync.StopBackgroundSync();
        base.OnFormClosing(e);
    }
    
    private void InitializeComponent()
    {
        this.SuspendLayout();
        this.AutoScaleDimensions = new SizeF(7F, 15F);
        this.AutoScaleMode = AutoScaleMode.Font;
        this.ClientSize = new Size(1366, 768);
        this.Name = "MainForm";
        this.ResumeLayout(false);
    }
}
