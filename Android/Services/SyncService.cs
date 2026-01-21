using Newtonsoft.Json;

namespace SalvadoreXPOS.Services;

public class SyncService
{
    private readonly DatabaseService _db;
    private CancellationTokenSource? _cts;
    private readonly int _syncIntervalSeconds = 30;
    
    public bool IsOnline { get; private set; }
    public bool IsSyncing { get; private set; }
    public DateTime? LastSyncTime { get; private set; }
    
    public event EventHandler<string>? StatusChanged;

    public SyncService(DatabaseService db)
    {
        _db = db;
    }

    public void StartBackgroundSync()
    {
        _cts = new CancellationTokenSource();
        Task.Run(() => BackgroundSyncLoop(_cts.Token));
    }

    public void StopBackgroundSync()
    {
        _cts?.Cancel();
    }

    private async Task BackgroundSyncLoop(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                IsOnline = await CheckInternetAsync();
                
                if (IsOnline)
                {
                    await SyncPendingChangesAsync();
                }
            }
            catch { }

            await Task.Delay(TimeSpan.FromSeconds(_syncIntervalSeconds), ct);
        }
    }

    private async Task<bool> CheckInternetAsync()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var response = await client.GetAsync("https://www.google.com/generate_204");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public async Task SyncPendingChangesAsync()
    {
        if (IsSyncing || !IsOnline) return;
        
        IsSyncing = true;

        try
        {
            var supabaseUrl = await _db.GetSettingAsync("supabase_url");
            var supabaseKey = await _db.GetSettingAsync("supabase_key");
            
            if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(supabaseKey))
                return;

            using var client = new HttpClient();
            client.DefaultRequestHeaders.Add("apikey", supabaseKey);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {supabaseKey}");
            client.DefaultRequestHeaders.Add("Prefer", "resolution=merge-duplicates");

            var pendingProducts = await _db.GetPendingSyncProductsAsync();
            foreach (var product in pendingProducts)
            {
                try
                {
                    var json = JsonConvert.SerializeObject(product);
                    var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
                    var response = await client.PostAsync($"{supabaseUrl}/rest/v1/products", content);
                    if (response.IsSuccessStatusCode)
                        await _db.MarkProductSyncedAsync(product.Id);
                }
                catch { }
            }

            var pendingSales = await _db.GetPendingSyncSalesAsync();
            foreach (var sale in pendingSales)
            {
                try
                {
                    var json = JsonConvert.SerializeObject(sale);
                    var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
                    var response = await client.PostAsync($"{supabaseUrl}/rest/v1/sales", content);
                    if (response.IsSuccessStatusCode)
                        await _db.MarkSaleSyncedAsync(sale.Id);
                }
                catch { }
            }

            LastSyncTime = DateTime.Now;
        }
        catch { }
        finally
        {
            IsSyncing = false;
        }
    }

    public Task ForceSyncNowAsync() => SyncPendingChangesAsync();
}
