// SalvadoreX POS - Unified Web Application
// 100% identical UI across Web, Windows Desktop, and Android
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
    deleteProduct: async (id) => {
        let products = JSON.parse(localStorage.getItem('products') || '[]');
        products = products.filter(p => p.id !== id);
        localStorage.setItem('products', JSON.stringify(products));
    },
    getCategories: async () => localStorage.getItem('categories') || '[]',
    saveCategory: async (json) => {
        const categories = JSON.parse(localStorage.getItem('categories') || '[]');
        const category = JSON.parse(json);
        const idx = categories.findIndex(c => c.id === category.id);
        if (idx >= 0) categories[idx] = category;
        else categories.push({ ...category, id: category.id || crypto.randomUUID() });
        localStorage.setItem('categories', JSON.stringify(categories));
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
let categories = [];
let customers = [];
let cart = [];
let selectedCategory = 'all';
let paymentMethod = 'cash';
let currentPage = 'pos';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    updateConnectionStatus();
    renderProducts();
    
    // Add demo products if empty
    if (products.length === 0) {
        await addDemoProducts();
    }
    
    // Listen for online/offline events
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
});

async function loadData() {
    try {
        const productsData = typeof API.getProducts === 'function' ? API.getProducts() : await API.getProducts;
        products = JSON.parse(productsData || '[]');
        
        const categoriesData = typeof API.getCategories === 'function' ? API.getCategories() : await API.getCategories;
        categories = JSON.parse(categoriesData || '[]');
        
        const customersData = typeof API.getCustomers === 'function' ? API.getCustomers() : await API.getCustomers;
        customers = JSON.parse(customersData || '[]');
    } catch (e) {
        console.error('Error loading data:', e);
        products = [];
        categories = [];
        customers = [];
    }
}

async function addDemoProducts() {
    const demoProducts = [
        { id: crypto.randomUUID(), name: 'Coca Cola 600ml', price: 25.00, stock: 50, category: 'Bebidas', sku: 'COCA600' },
        { id: crypto.randomUUID(), name: 'Flan de Caramelo', price: 55.00, stock: 20, category: 'Postres', sku: 'FLAN001' },
        { id: crypto.randomUUID(), name: 'Hamburguesa Clasica', price: 89.00, stock: 30, category: 'Comidas', sku: 'HAMB001' },
        { id: crypto.randomUUID(), name: 'Hamburguesa con Queso', price: 99.00, stock: 25, category: 'Comidas', sku: 'HAMB002' },
        { id: crypto.randomUUID(), name: 'Agua Natural 500ml', price: 15.00, stock: 100, category: 'Bebidas', sku: 'AGUA500' },
        { id: crypto.randomUUID(), name: 'Tacos de Asada (3)', price: 75.00, stock: 40, category: 'Comidas', sku: 'TACO003' },
        { id: crypto.randomUUID(), name: 'Helado Vainilla', price: 45.00, stock: 15, category: 'Postres', sku: 'HELA001' },
        { id: crypto.randomUUID(), name: 'Pizza Pepperoni', price: 95.00, stock: 20, category: 'Comidas', sku: 'PIZZ001' },
        { id: crypto.randomUUID(), name: 'Jugo de Naranja', price: 35.00, stock: 30, category: 'Bebidas', sku: 'JUGO001' },
        { id: crypto.randomUUID(), name: 'Papas Fritas', price: 40.00, stock: 50, category: 'Snacks', sku: 'PAPA001' },
        { id: crypto.randomUUID(), name: 'Café Americano', price: 30.00, stock: 100, category: 'Bebidas', sku: 'CAFE001' },
    ];
    
    const demoCategories = [
        { id: crypto.randomUUID(), name: 'Bebidas' },
        { id: crypto.randomUUID(), name: 'Comidas' },
        { id: crypto.randomUUID(), name: 'Postres' },
        { id: crypto.randomUUID(), name: 'Snacks' },
        { id: crypto.randomUUID(), name: 'Entradas' },
    ];
    
    for (const cat of demoCategories) {
        if (typeof API.saveCategory === 'function') {
            API.saveCategory(JSON.stringify(cat));
        } else {
            await API.saveCategory(JSON.stringify(cat));
        }
    }
    
    for (const product of demoProducts) {
        if (typeof API.saveProduct === 'function') {
            API.saveProduct(JSON.stringify(product));
        } else {
            await API.saveProduct(JSON.stringify(product));
        }
    }
    
    await loadData();
    renderProducts();
    renderCategoryTabs();
}

function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    // Search
    document.getElementById('search-input')?.addEventListener('input', renderProducts);
    
    // Category filter in header
    document.getElementById('category-filter-header')?.addEventListener('change', (e) => {
        selectedCategory = e.target.value;
        renderProducts();
        updateCategoryTabs();
    });
    
    // Clear cart
    document.getElementById('clear-cart-btn')?.addEventListener('click', clearCart);
    
    // Checkout
    document.getElementById('checkout-btn')?.addEventListener('click', openPaymentModal);
    
    // Payment modal
    document.getElementById('close-payment')?.addEventListener('click', closePaymentModal);
    document.getElementById('complete-sale')?.addEventListener('click', completeSale);
    document.getElementById('cash-amount')?.addEventListener('input', updateChange);
    
    // Payment methods
    document.querySelectorAll('.payment-method').forEach(btn => {
        btn.addEventListener('click', () => selectPaymentMethod(btn.dataset.method));
    });
    
    // Add product modal
    document.getElementById('close-add-product')?.addEventListener('click', closeAddProductModal);
    document.getElementById('save-new-product')?.addEventListener('click', saveNewProduct);
    
    // Render categories
    renderCategoryTabs();
}

function navigateTo(page) {
    currentPage = page;
    
    // Update sidebar active state
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active', 'text-white');
        item.classList.add('text-gray-300');
        if (item.dataset.page === page) {
            item.classList.add('active', 'text-white');
            item.classList.remove('text-gray-300');
        }
    });
    
    // For now, show toast for non-POS pages
    if (page !== 'pos') {
        showToast(`${page.charAt(0).toUpperCase() + page.slice(1)} - Próximamente`, 'info');
    }
}

function renderCategoryTabs() {
    const tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer) return;
    
    // Get unique categories from products
    const productCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
    
    // Count products per category
    const categoryCounts = {};
    categoryCounts['all'] = products.length;
    productCategories.forEach(cat => {
        categoryCounts[cat] = products.filter(p => p.category === cat).length;
    });
    
    let tabsHTML = `
        <button class="category-tab ${selectedCategory === 'all' ? 'active bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} px-4 py-2 rounded-full text-sm font-medium" data-category="all">
            Todos <span class="opacity-75">(${categoryCounts['all']})</span>
        </button>
        <button class="category-tab ${selectedCategory === 'mas-vendidos' ? 'active bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} px-4 py-2 rounded-full text-sm font-medium" data-category="mas-vendidos">
            Más vendidos
        </button>
    `;
    
    productCategories.forEach(cat => {
        const count = categoryCounts[cat] || 0;
        const isActive = selectedCategory === cat;
        tabsHTML += `
            <button class="category-tab ${isActive ? 'active bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} px-4 py-2 rounded-full text-sm font-medium" data-category="${cat}">
                ${cat} <span class="opacity-75">(${count})</span>
            </button>
        `;
    });
    
    tabsContainer.innerHTML = tabsHTML;
    
    // Add click events to tabs
    tabsContainer.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedCategory = tab.dataset.category;
            renderProducts();
            renderCategoryTabs();
        });
    });
    
    // Update header dropdown
    const headerFilter = document.getElementById('category-filter-header');
    if (headerFilter) {
        headerFilter.innerHTML = `<option value="all">Todos</option>`;
        productCategories.forEach(cat => {
            headerFilter.innerHTML += `<option value="${cat}" ${selectedCategory === cat ? 'selected' : ''}>${cat}</option>`;
        });
    }
}

function updateCategoryTabs() {
    renderCategoryTabs();
}

function renderProducts() {
    const grid = document.getElementById('products-grid');
    const emptyState = document.getElementById('empty-state');
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    
    if (!grid) return;
    
    let filtered = products;
    
    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            (p.sku && p.sku.toLowerCase().includes(searchTerm)) ||
            (p.barcode && p.barcode.toLowerCase().includes(searchTerm))
        );
    }
    
    // Filter by category
    if (selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'mas-vendidos') {
        filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
        }
        return;
    }
    
    if (emptyState) {
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
    }
    
    grid.innerHTML = filtered.map(product => `
        <div class="product-card bg-white rounded-xl shadow-sm border cursor-pointer overflow-hidden" onclick="addToCart('${product.id}')">
            <div class="h-28 bg-gray-100 flex items-center justify-center">
                ${product.image_url 
                    ? `<img src="${product.image_url}" alt="${product.name}" class="h-full w-full object-cover">`
                    : `<i class="fas fa-box text-4xl text-gray-300"></i>`
                }
            </div>
            <div class="p-3">
                <h3 class="font-medium text-gray-900 text-sm truncate">${product.name}</h3>
                <p class="text-primary font-bold text-lg">$${parseFloat(product.price).toFixed(2)}</p>
            </div>
        </div>
    `).join('');
}

// Cart Functions
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existing = cart.find(item => item.product.id === productId);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ product, quantity: 1, discount: 0 });
    }
    
    renderCart();
    showToast(`${product.name} agregado al carrito`);
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
    const cartCount = document.getElementById('cart-count');
    const checkoutBtn = document.getElementById('checkout-btn');
    const cartEmpty = document.getElementById('cart-empty');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) cartCount.textContent = totalItems;
    
    if (cart.length === 0) {
        if (container) container.innerHTML = `
            <div id="cart-empty" class="flex flex-col items-center justify-center h-full text-gray-400">
                <i class="fas fa-shopping-basket text-4xl mb-2"></i>
                <p>Carrito vacío</p>
            </div>
        `;
        if (checkoutBtn) checkoutBtn.disabled = true;
        updateCartTotals();
        return;
    }
    
    if (checkoutBtn) checkoutBtn.disabled = false;
    
    if (container) {
        container.innerHTML = cart.map(item => `
            <div class="cart-item bg-gray-50 rounded-lg p-3">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                            <i class="fas fa-box text-gray-400 text-sm"></i>
                        </div>
                        <div>
                            <span class="font-medium text-sm block">${item.product.name}</span>
                            <span class="text-xs text-gray-500">$${parseFloat(item.product.price).toFixed(2)} c/u</span>
                        </div>
                    </div>
                    <button onclick="removeFromCart('${item.product.id}')" class="text-gray-400 hover:text-red-500 transition">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-1">
                        <button onclick="updateCartQuantity('${item.product.id}', -1)" class="w-7 h-7 rounded border bg-white hover:bg-gray-100 flex items-center justify-center text-gray-600">
                            <i class="fas fa-minus text-xs"></i>
                        </button>
                        <span class="w-8 text-center font-medium text-sm">${item.quantity}</span>
                        <button onclick="updateCartQuantity('${item.product.id}', 1)" class="w-7 h-7 rounded border bg-white hover:bg-gray-100 flex items-center justify-center text-gray-600">
                            <i class="fas fa-plus text-xs"></i>
                        </button>
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="number" value="${item.discount || 0}" 
                            onchange="updateItemDiscount('${item.product.id}', this.value)"
                            class="w-12 h-7 text-center text-xs border rounded" placeholder="0">
                        <span class="text-xs text-gray-500">%</span>
                        <span class="font-bold text-primary ml-2">$${((item.product.price * item.quantity) * (1 - (item.discount || 0) / 100)).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    updateCartTotals();
}

function updateItemDiscount(productId, discount) {
    const item = cart.find(i => i.product.id === productId);
    if (item) {
        item.discount = Math.min(100, Math.max(0, parseFloat(discount) || 0));
        renderCart();
    }
}

function updateCartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const totalDiscount = cart.reduce((sum, item) => {
        const itemTotal = item.product.price * item.quantity;
        const discountAmount = itemTotal * ((item.discount || 0) / 100);
        return sum + discountAmount;
    }, 0);
    const total = subtotal - totalDiscount;
    
    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount');
    const totalEl = document.getElementById('cart-total');
    
    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (discountEl) discountEl.textContent = `-$${totalDiscount.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}

// Payment Functions
function openPaymentModal() {
    const modal = document.getElementById('payment-modal');
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const totalDiscount = cart.reduce((sum, item) => {
        const itemTotal = item.product.price * item.quantity;
        return sum + (itemTotal * ((item.discount || 0) / 100));
    }, 0);
    const total = subtotal - totalDiscount;
    
    document.getElementById('payment-total').textContent = `$${total.toFixed(2)}`;
    document.getElementById('cash-amount').value = '';
    document.getElementById('change-amount').textContent = '$0.00';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function selectPaymentMethod(method) {
    paymentMethod = method;
    document.querySelectorAll('.payment-method').forEach(btn => {
        btn.classList.remove('border-primary', 'bg-blue-50', 'active');
        btn.classList.add('border-gray-200');
        if (btn.dataset.method === method) {
            btn.classList.add('border-primary', 'bg-blue-50', 'active');
            btn.classList.remove('border-gray-200');
        }
    });
    
    const cashSection = document.getElementById('cash-amount-section');
    if (cashSection) {
        cashSection.style.display = method === 'cash' ? 'block' : 'none';
    }
}

function updateChange() {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const totalDiscount = cart.reduce((sum, item) => {
        return sum + ((item.product.price * item.quantity) * ((item.discount || 0) / 100));
    }, 0);
    const total = subtotal - totalDiscount;
    const cashAmount = parseFloat(document.getElementById('cash-amount').value) || 0;
    const change = Math.max(0, cashAmount - total);
    
    document.getElementById('change-amount').textContent = `$${change.toFixed(2)}`;
}

async function completeSale() {
    if (cart.length === 0) {
        showToast('El carrito está vacío', 'error');
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const totalDiscount = cart.reduce((sum, item) => {
        return sum + ((item.product.price * item.quantity) * ((item.discount || 0) / 100));
    }, 0);
    const total = subtotal - totalDiscount;
    const cashAmount = parseFloat(document.getElementById('cash-amount')?.value) || total;
    
    const sale = {
        id: crypto.randomUUID(),
        receipt_number: `REC-${Date.now()}`,
        subtotal,
        discount: totalDiscount,
        total,
        payment_method: paymentMethod,
        amount_paid: cashAmount,
        change_amount: Math.max(0, cashAmount - total),
        status: 'completed',
        items: cart.map(item => ({
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: item.quantity,
            unit_price: item.product.price,
            discount: item.discount || 0,
            total: (item.product.price * item.quantity) * (1 - (item.discount || 0) / 100)
        })),
        created_at: new Date().toISOString()
    };
    
    try {
        if (typeof API.saveSale === 'function') {
            API.saveSale(JSON.stringify(sale));
        } else {
            await API.saveSale(JSON.stringify(sale));
        }
        
        showToast(`¡Venta completada! Total: $${total.toFixed(2)}`, 'success');
        clearCart();
        closePaymentModal();
    } catch (e) {
        showToast('Error al procesar la venta', 'error');
    }
}

// Add Product Modal Functions
function openAddProductModal() {
    const modal = document.getElementById('add-product-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeAddProductModal() {
    const modal = document.getElementById('add-product-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function saveNewProduct() {
    const name = document.getElementById('new-product-name')?.value.trim();
    const price = parseFloat(document.getElementById('new-product-price')?.value) || 0;
    const cost = parseFloat(document.getElementById('new-product-cost')?.value) || 0;
    const sku = document.getElementById('new-product-sku')?.value.trim();
    const stock = parseInt(document.getElementById('new-product-stock')?.value) || 0;
    const category = document.getElementById('new-product-category')?.value;
    
    if (!name || price <= 0) {
        showToast('Nombre y precio son requeridos', 'error');
        return;
    }
    
    const product = {
        id: crypto.randomUUID(),
        name,
        price,
        cost,
        sku,
        stock,
        category
    };
    
    try {
        if (typeof API.saveProduct === 'function') {
            API.saveProduct(JSON.stringify(product));
        } else {
            await API.saveProduct(JSON.stringify(product));
        }
        
        await loadData();
        renderProducts();
        renderCategoryTabs();
        closeAddProductModal();
        showToast('Producto guardado correctamente');
    } catch (e) {
        showToast('Error al guardar producto', 'error');
    }
}

// Connection Status
function updateConnectionStatus() {
    const isOffline = typeof API.isOffline === 'function' ? API.isOffline() : !navigator.onLine;
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    
    if (indicator && text) {
        if (isOffline) {
            indicator.classList.remove('text-green-500');
            indicator.classList.add('text-red-500');
            text.textContent = 'Modo Offline';
        } else {
            indicator.classList.remove('text-red-500');
            indicator.classList.add('text-green-500');
            text.textContent = 'Conectado';
        }
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-500' : type === 'info' ? 'bg-blue-500' : 'bg-gray-900';
    const icon = type === 'error' ? 'fa-exclamation-circle' : type === 'info' ? 'fa-info-circle' : 'fa-check-circle';
    
    toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in`;
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Make functions globally accessible
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.updateItemDiscount = updateItemDiscount;
