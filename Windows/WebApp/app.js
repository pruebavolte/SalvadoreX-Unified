// SalvadoreX POS - Unified Web Application
// Works offline with local storage, syncs when online

const API = window.NativeAPI || {
    isOffline: () => !navigator.onLine,
    getProducts: async () => localStorage.getItem('products') || '[]',
    saveProduct: async (json) => {
        const products = JSON.parse(localStorage.getItem('products') || '[]');
        const product = JSON.parse(json);
        const idx = products.findIndex(p => p.id === product.id);
        if (idx >= 0) products[idx] = product;
        else products.push({ ...product, id: product.id || crypto.randomUUID() });
        localStorage.setItem('products', JSON.stringify(products));
    },
    getCustomers: async () => localStorage.getItem('customers') || '[]',
    saveCustomer: async (json) => {
        const customers = JSON.parse(localStorage.getItem('customers') || '[]');
        const customer = JSON.parse(json);
        const idx = customers.findIndex(c => c.id === customer.id);
        if (idx >= 0) customers[idx] = customer;
        else customers.push({ ...customer, id: customer.id || crypto.randomUUID() });
        localStorage.setItem('customers', JSON.stringify(customers));
    },
    getSales: async () => localStorage.getItem('sales') || '[]',
    saveSale: async (json) => {
        const sales = JSON.parse(localStorage.getItem('sales') || '[]');
        const sale = JSON.parse(json);
        sales.push({ ...sale, id: sale.id || crypto.randomUUID() });
        localStorage.setItem('sales', JSON.stringify(sales));
    },
    getSetting: async (key) => localStorage.getItem(`setting_${key}`) || '',
    setSetting: async (key, value) => localStorage.setItem(`setting_${key}`, value),
    syncNow: async () => console.log('Sync not available in browser mode'),
    getHardwareId: () => 'BROWSER-MODE'
};

// State
let products = [];
let customers = [];
let cart = [];
let paymentMethod = 'cash';
let currentSection = 'pos';
let taxRate = 16;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadProducts();
    await loadCustomers();
    showSection('pos');
    updateConnectionStatus();
    
    // Listen for online/offline events
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    
    // Form handlers
    document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
    document.getElementById('customer-form').addEventListener('submit', handleCustomerSubmit);
    
    // Search handlers
    document.getElementById('search-products').addEventListener('input', filterProducts);
    document.getElementById('search-inventory')?.addEventListener('input', renderInventory);
    
    // Show hardware ID
    try {
        const hwId = typeof API.getHardwareId === 'function' ? API.getHardwareId() : await API.getHardwareId;
        document.getElementById('hardware-id').textContent = hwId;
    } catch (e) {}
});

// Navigation
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`section-${section}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600');
        if (btn.dataset.section === section) btn.classList.add('bg-blue-600');
    });
    
    currentSection = section;
    
    // Load section-specific data
    if (section === 'inventory') renderInventory();
    if (section === 'customers') renderCustomers();
    if (section === 'sales') loadSales();
    if (section === 'settings') loadSettingsForm();
}

// Products
async function loadProducts() {
    try {
        const data = typeof API.getProducts === 'function' ? API.getProducts() : await API.getProducts;
        products = JSON.parse(data || '[]');
        renderProducts();
    } catch (e) {
        console.error('Error loading products:', e);
        products = [];
    }
}

function renderProducts() {
    const grid = document.getElementById('products-grid');
    const searchTerm = document.getElementById('search-products').value.toLowerCase();
    
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm))
    );
    
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-500">
                <p class="text-lg mb-2">No hay productos</p>
                <p class="text-sm">Agrega productos desde Inventario</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filtered.map(product => `
        <div class="product-card bg-white rounded-lg shadow-sm p-4 cursor-pointer transition hover:shadow-md"
             onclick="addToCart('${product.id}')">
            <div class="h-24 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                </svg>
            </div>
            <h3 class="font-medium text-gray-900 truncate">${product.name}</h3>
            <p class="text-blue-600 font-bold text-lg">$${parseFloat(product.price).toFixed(2)}</p>
            <p class="text-xs text-gray-400">Stock: ${product.stock || 0}</p>
        </div>
    `).join('');
}

function filterProducts() {
    renderProducts();
}

// Cart
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existing = cart.find(item => item.product.id === productId);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ product, quantity: 1 });
    }
    
    renderCart();
    showToast(`${product.name} agregado`);
}

function updateCartQuantity(productId, delta) {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;
    
    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.product.id !== productId);
    }
    
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(i => i.product.id !== productId);
    renderCart();
}

function clearCart() {
    cart = [];
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    
    if (cart.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-8">Carrito vacío</p>';
        updateCartTotals();
        return;
    }
    
    container.innerHTML = cart.map(item => `
        <div class="cart-item bg-gray-50 rounded-lg p-3">
            <div class="flex justify-between items-start mb-2">
                <span class="font-medium text-sm">${item.product.name}</span>
                <button onclick="removeFromCart('${item.product.id}')" class="text-red-400 hover:text-red-600">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <button onclick="updateCartQuantity('${item.product.id}', -1)" class="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center">-</button>
                    <span class="w-8 text-center font-medium">${item.quantity}</span>
                    <button onclick="updateCartQuantity('${item.product.id}', 1)" class="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center">+</button>
                </div>
                <span class="font-bold text-blue-600">$${(item.product.price * item.quantity).toFixed(2)}</span>
            </div>
        </div>
    `).join('');
    
    updateCartTotals();
}

function updateCartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('cart-tax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;
}

function setPaymentMethod(method) {
    paymentMethod = method;
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.classList.remove('bg-blue-100', 'border-blue-500');
        if (btn.dataset.method === method) {
            btn.classList.add('bg-blue-100', 'border-blue-500');
        }
    });
}

async function processPayment() {
    if (cart.length === 0) {
        showToast('Agrega productos al carrito', 'error');
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    const sale = {
        id: crypto.randomUUID(),
        receipt_number: `REC-${Date.now()}`,
        subtotal,
        tax,
        total,
        payment_method: paymentMethod,
        amount_paid: total,
        change_amount: 0,
        status: 'completed',
        items: cart.map(item => ({
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: item.quantity,
            unit_price: item.product.price,
            total: item.product.price * item.quantity
        })),
        created_at: new Date().toISOString()
    };
    
    try {
        if (typeof API.saveSale === 'function') {
            API.saveSale(JSON.stringify(sale));
        } else {
            await API.saveSale(JSON.stringify(sale));
        }
        
        showToast(`Venta completada: $${total.toFixed(2)}`);
        clearCart();
    } catch (e) {
        showToast('Error al procesar venta', 'error');
    }
}

// Inventory
function renderInventory() {
    const tbody = document.getElementById('inventory-body');
    const searchTerm = document.getElementById('search-inventory')?.value.toLowerCase() || '';
    
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm))
    );
    
    tbody.innerHTML = filtered.map(product => `
        <tr class="border-b hover:bg-gray-50">
            <td class="px-6 py-4">
                <div class="font-medium">${product.name}</div>
                <div class="text-sm text-gray-500">${product.description || ''}</div>
            </td>
            <td class="px-6 py-4 text-gray-500">${product.sku || '-'}</td>
            <td class="px-6 py-4 text-right font-medium">$${parseFloat(product.price).toFixed(2)}</td>
            <td class="px-6 py-4 text-right">
                <span class="px-2 py-1 rounded ${product.stock < (product.min_stock || 5) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">
                    ${product.stock || 0}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <button onclick="editProduct('${product.id}')" class="text-blue-600 hover:text-blue-800 mr-2">Editar</button>
            </td>
        </tr>
    `).join('');
}

function showProductModal(productId = null) {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    
    form.reset();
    document.getElementById('product-id').value = '';
    
    if (productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-sku').value = product.sku || '';
            document.getElementById('product-barcode').value = product.barcode || '';
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-stock').value = product.stock || 0;
        }
    }
    
    modal.classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

function editProduct(productId) {
    showProductModal(productId);
}

async function handleProductSubmit(e) {
    e.preventDefault();
    
    const product = {
        id: document.getElementById('product-id').value || crypto.randomUUID(),
        name: document.getElementById('product-name').value,
        sku: document.getElementById('product-sku').value,
        barcode: document.getElementById('product-barcode').value,
        price: parseFloat(document.getElementById('product-price').value),
        stock: parseInt(document.getElementById('product-stock').value) || 0
    };
    
    try {
        if (typeof API.saveProduct === 'function') {
            API.saveProduct(JSON.stringify(product));
        } else {
            await API.saveProduct(JSON.stringify(product));
        }
        
        await loadProducts();
        closeProductModal();
        showToast('Producto guardado');
        if (currentSection === 'inventory') renderInventory();
    } catch (e) {
        showToast('Error al guardar producto', 'error');
    }
}

// Customers
async function loadCustomers() {
    try {
        const data = typeof API.getCustomers === 'function' ? API.getCustomers() : await API.getCustomers;
        customers = JSON.parse(data || '[]');
    } catch (e) {
        customers = [];
    }
}

function renderCustomers() {
    const grid = document.getElementById('customers-grid');
    
    if (customers.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-500">
                <p class="text-lg mb-2">No hay clientes registrados</p>
                <p class="text-sm">Agrega tu primer cliente</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = customers.map(customer => `
        <div class="bg-white rounded-lg shadow-sm p-4">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    ${customer.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <h3 class="font-medium">${customer.name}</h3>
                    <p class="text-sm text-gray-500">${customer.phone || '-'}</p>
                </div>
            </div>
            <p class="text-sm text-gray-400">${customer.email || ''}</p>
        </div>
    `).join('');
}

function showCustomerModal() {
    document.getElementById('customer-modal').classList.remove('hidden');
    document.getElementById('customer-form').reset();
}

function closeCustomerModal() {
    document.getElementById('customer-modal').classList.add('hidden');
}

async function handleCustomerSubmit(e) {
    e.preventDefault();
    
    const customer = {
        id: document.getElementById('customer-id').value || crypto.randomUUID(),
        name: document.getElementById('customer-name').value,
        phone: document.getElementById('customer-phone').value,
        email: document.getElementById('customer-email').value
    };
    
    try {
        if (typeof API.saveCustomer === 'function') {
            API.saveCustomer(JSON.stringify(customer));
        } else {
            await API.saveCustomer(JSON.stringify(customer));
        }
        
        await loadCustomers();
        closeCustomerModal();
        renderCustomers();
        showToast('Cliente guardado');
    } catch (e) {
        showToast('Error al guardar cliente', 'error');
    }
}

// Sales
async function loadSales() {
    try {
        const data = typeof API.getSales === 'function' ? API.getSales() : await API.getSales;
        const sales = JSON.parse(data || '[]');
        
        const container = document.getElementById('sales-list');
        const total = sales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
        
        document.getElementById('sales-total').textContent = `$${total.toFixed(2)}`;
        
        if (sales.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-12">No hay ventas registradas</p>';
            return;
        }
        
        container.innerHTML = sales.slice().reverse().map(sale => `
            <div class="bg-white rounded-lg shadow-sm p-4 flex justify-between items-center">
                <div>
                    <p class="font-medium">${sale.receipt_number}</p>
                    <p class="text-sm text-gray-500">${new Date(sale.created_at).toLocaleString()}</p>
                    <p class="text-xs text-gray-400">${sale.payment_method}</p>
                </div>
                <div class="text-right">
                    <p class="text-xl font-bold text-green-600">$${parseFloat(sale.total).toFixed(2)}</p>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error loading sales:', e);
    }
}

// Settings
async function loadSettings() {
    try {
        const rate = typeof API.getSetting === 'function' ? API.getSetting('tax_rate') : await API.getSetting('tax_rate');
        taxRate = parseFloat(rate) || 16;
    } catch (e) {
        taxRate = 16;
    }
}

async function loadSettingsForm() {
    try {
        const businessName = typeof API.getSetting === 'function' ? API.getSetting('business_name') : await API.getSetting('business_name');
        const businessPhone = typeof API.getSetting === 'function' ? API.getSetting('business_phone') : await API.getSetting('business_phone');
        const rate = typeof API.getSetting === 'function' ? API.getSetting('tax_rate') : await API.getSetting('tax_rate');
        
        document.getElementById('setting-business-name').value = businessName || '';
        document.getElementById('setting-business-phone').value = businessPhone || '';
        document.getElementById('setting-tax-rate').value = rate || '16';
    } catch (e) {}
}

async function saveSettings() {
    try {
        const businessName = document.getElementById('setting-business-name').value;
        const businessPhone = document.getElementById('setting-business-phone').value;
        const rate = document.getElementById('setting-tax-rate').value;
        
        if (typeof API.setSetting === 'function') {
            API.setSetting('business_name', businessName);
            API.setSetting('business_phone', businessPhone);
            API.setSetting('tax_rate', rate);
        } else {
            await API.setSetting('business_name', businessName);
            await API.setSetting('business_phone', businessPhone);
            await API.setSetting('tax_rate', rate);
        }
        
        taxRate = parseFloat(rate) || 16;
        showToast('Configuración guardada');
    } catch (e) {
        showToast('Error al guardar', 'error');
    }
}

async function syncNow() {
    try {
        if (typeof API.syncNow === 'function') {
            API.syncNow();
        } else {
            await API.syncNow;
        }
        showToast('Sincronización iniciada');
    } catch (e) {
        showToast('Error al sincronizar', 'error');
    }
}

// Connection Status
function updateConnectionStatus() {
    const isOffline = typeof API.isOffline === 'function' ? API.isOffline() : !navigator.onLine;
    const statusEl = document.getElementById('connection-status');
    
    if (isOffline) {
        statusEl.innerHTML = `
            <span class="w-3 h-3 rounded-full offline-badge"></span>
            <span class="text-sm text-gray-400">Modo Offline</span>
        `;
    } else {
        statusEl.innerHTML = `
            <span class="w-3 h-3 rounded-full online-badge"></span>
            <span class="text-sm text-gray-400">En línea</span>
        `;
    }
}

// Toast
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${type === 'error' ? 'bg-red-500' : 'bg-gray-900'} text-white`;
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
