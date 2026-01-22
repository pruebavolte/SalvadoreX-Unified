using Android.Content;
using SQLite;
using Newtonsoft.Json;

namespace SalvadoreXPOS.Services;

public class DatabaseService
{
    private SQLiteAsyncConnection? _db;
    private readonly Context _context;
    
    public DatabaseService(Context context)
    {
        _context = context;
    }
    
    public async Task InitializeAsync()
    {
        if (_db != null) return;
        
        var dbPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "salvadorex.db3"
        );
        
        _db = new SQLiteAsyncConnection(dbPath);
        
        await _db.CreateTableAsync<Product>();
        await _db.CreateTableAsync<Category>();
        await _db.CreateTableAsync<Customer>();
        await _db.CreateTableAsync<Sale>();
        await _db.CreateTableAsync<SaleItem>();
        await _db.CreateTableAsync<Setting>();
        
        await SeedDefaultDataAsync();
    }
    
    private async Task SeedDefaultDataAsync()
    {
        var count = await _db!.Table<Category>().CountAsync();
        if (count == 0)
        {
            await _db.InsertAsync(new Category { Id = "cat_1", Name = "Bebidas", Description = "Refrescos, jugos, agua" });
            await _db.InsertAsync(new Category { Id = "cat_2", Name = "Alimentos", Description = "Comida preparada" });
            await _db.InsertAsync(new Category { Id = "cat_3", Name = "Snacks", Description = "Botanas y dulces" });
            await _db.InsertAsync(new Category { Id = "cat_4", Name = "General", Description = "Productos generales" });
        }
        
        count = await _db.Table<Setting>().CountAsync();
        if (count == 0)
        {
            await _db.InsertAsync(new Setting { Key = "business_name", Value = "Mi Negocio" });
            await _db.InsertAsync(new Setting { Key = "tax_rate", Value = "16" });
            await _db.InsertAsync(new Setting { Key = "receipt_counter", Value = "1" });
        }
    }
    
    public async Task<string> GetProductsAsync()
    {
        var products = await _db!.Table<Product>().Where(p => p.Active).ToListAsync();
        return JsonConvert.SerializeObject(products);
    }
    
    public async Task SaveProductAsync(string json)
    {
        var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(json)!;
        var product = new Product
        {
            Id = data.GetValueOrDefault("id")?.ToString() ?? Guid.NewGuid().ToString(),
            Name = data.GetValueOrDefault("name")?.ToString() ?? "",
            Sku = data.GetValueOrDefault("sku")?.ToString(),
            Barcode = data.GetValueOrDefault("barcode")?.ToString(),
            Price = Convert.ToDecimal(data.GetValueOrDefault("price", 0)),
            Stock = Convert.ToInt32(data.GetValueOrDefault("stock", 0)),
            Active = true,
            NeedSync = true,
            UpdatedAt = DateTime.UtcNow.ToString("o")
        };
        await _db!.InsertOrReplaceAsync(product);
    }
    
    public async Task<string> GetCustomersAsync()
    {
        var customers = await _db!.Table<Customer>().Where(c => c.Active).ToListAsync();
        return JsonConvert.SerializeObject(customers);
    }
    
    public async Task SaveCustomerAsync(string json)
    {
        var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(json)!;
        var customer = new Customer
        {
            Id = data.GetValueOrDefault("id")?.ToString() ?? Guid.NewGuid().ToString(),
            Name = data.GetValueOrDefault("name")?.ToString() ?? "",
            Phone = data.GetValueOrDefault("phone")?.ToString(),
            Email = data.GetValueOrDefault("email")?.ToString(),
            Active = true,
            NeedSync = true,
            UpdatedAt = DateTime.UtcNow.ToString("o")
        };
        await _db!.InsertOrReplaceAsync(customer);
    }
    
    public async Task<string> GetSalesAsync()
    {
        var sales = await _db!.Table<Sale>().OrderByDescending(s => s.CreatedAt).Take(100).ToListAsync();
        return JsonConvert.SerializeObject(sales);
    }
    
    public async Task SaveSaleAsync(string json)
    {
        var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(json)!;
        var counter = await GetSettingAsync("receipt_counter");
        var num = int.Parse(string.IsNullOrEmpty(counter) ? "1" : counter);
        
        var sale = new Sale
        {
            Id = data.GetValueOrDefault("id")?.ToString() ?? Guid.NewGuid().ToString(),
            ReceiptNumber = $"REC-{DateTime.Now:yyyyMMdd}-{num:D4}",
            Subtotal = Convert.ToDecimal(data.GetValueOrDefault("subtotal", 0)),
            Tax = Convert.ToDecimal(data.GetValueOrDefault("tax", 0)),
            Total = Convert.ToDecimal(data.GetValueOrDefault("total", 0)),
            PaymentMethod = data.GetValueOrDefault("payment_method")?.ToString() ?? "cash",
            AmountPaid = Convert.ToDecimal(data.GetValueOrDefault("amount_paid", 0)),
            Status = "completed",
            NeedSync = true,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };
        
        await _db!.InsertAsync(sale);
        await SetSettingAsync("receipt_counter", (num + 1).ToString());
        
        // Save items
        if (data.TryGetValue("items", out var itemsObj) && itemsObj is Newtonsoft.Json.Linq.JArray items)
        {
            foreach (var item in items)
            {
                var saleItem = new SaleItem
                {
                    Id = Guid.NewGuid().ToString(),
                    SaleId = sale.Id,
                    ProductId = item["product_id"]?.ToString() ?? "",
                    ProductName = item["product_name"]?.ToString() ?? "",
                    Quantity = item["quantity"]?.Value<int>() ?? 1,
                    UnitPrice = item["unit_price"]?.Value<decimal>() ?? 0,
                    Total = item["total"]?.Value<decimal>() ?? 0
                };
                await _db.InsertAsync(saleItem);
            }
        }
    }
    
    public async Task<string> GetSettingAsync(string key)
    {
        var setting = await _db!.Table<Setting>().Where(s => s.Key == key).FirstOrDefaultAsync();
        return setting?.Value ?? "";
    }
    
    public async Task SetSettingAsync(string key, string value)
    {
        await _db!.InsertOrReplaceAsync(new Setting { Key = key, Value = value });
    }
    
    public Task<List<Product>> GetPendingSyncProductsAsync()
        => _db!.Table<Product>().Where(p => p.NeedSync).ToListAsync();
    
    public Task<List<Sale>> GetPendingSyncSalesAsync()
        => _db!.Table<Sale>().Where(s => s.NeedSync).ToListAsync();
    
    public Task MarkProductSyncedAsync(string id)
        => _db!.ExecuteAsync("UPDATE Product SET NeedSync = 0 WHERE Id = ?", id);
    
    public Task MarkSaleSyncedAsync(string id)
        => _db!.ExecuteAsync("UPDATE Sale SET NeedSync = 0 WHERE Id = ?", id);
}

// Models
[Table("products")]
public class Product
{
    [PrimaryKey] public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Sku { get; set; }
    public string? Barcode { get; set; }
    public decimal Price { get; set; }
    public decimal Cost { get; set; }
    public int Stock { get; set; }
    public int MinStock { get; set; }
    public string? CategoryId { get; set; }
    public string? ImageUrl { get; set; }
    public bool Active { get; set; } = true;
    public bool AvailablePos { get; set; } = true;
    public bool NeedSync { get; set; } = true;
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }
}

[Table("categories")]
public class Category
{
    [PrimaryKey] public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? ParentId { get; set; }
    public int SortOrder { get; set; }
    public bool Active { get; set; } = true;
    public bool NeedSync { get; set; } = true;
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }
}

[Table("customers")]
public class Customer
{
    [PrimaryKey] public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Rfc { get; set; }
    public decimal CreditLimit { get; set; }
    public decimal CurrentCredit { get; set; }
    public int LoyaltyPoints { get; set; }
    public string? Notes { get; set; }
    public bool Active { get; set; } = true;
    public bool NeedSync { get; set; } = true;
    public string? CreatedAt { get; set; }
    public string? UpdatedAt { get; set; }
}

[Table("sales")]
public class Sale
{
    [PrimaryKey] public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? ReceiptNumber { get; set; }
    public string? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public string PaymentMethod { get; set; } = "cash";
    public decimal AmountPaid { get; set; }
    public decimal ChangeAmount { get; set; }
    public string Status { get; set; } = "completed";
    public string? Notes { get; set; }
    public bool NeedSync { get; set; } = true;
    public string? CreatedAt { get; set; }
}

[Table("sale_items")]
public class SaleItem
{
    [PrimaryKey] public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SaleId { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string ProductName { get; set; } = "";
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
}

[Table("settings")]
public class Setting
{
    [PrimaryKey] public string Key { get; set; } = "";
    public string Value { get; set; } = "";
}
