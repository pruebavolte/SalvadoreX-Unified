// SalvadoreX POS - Unified Web Application
// Works with NativeAPI bridge (Windows/Android) or localStorage fallback (browser)

// API wrapper - uses NativeAPI if available, otherwise localStorage
const API = {
    isOffline: function() {
        if (window.NativeAPI && typeof window.NativeAPI.isOffline === 'function') {
            return window.NativeAPI.isOffline();
        }
        return !navigator.onLine;
    },
    getProducts: function() {
        if (window.NativeAPI && typeof window.NativeAPI.getProducts === 'function') {
            return window.NativeAPI.getProducts();
        }
        return localStorage.getItem('products') || '[]';
    },
    saveProduct: function(json) {
        if (window.NativeAPI && typeof window.NativeAPI.saveProduct === 'function') {
            window.NativeAPI.saveProduct(json);
        } else {
            const products = JSON.parse(localStorage.getItem('products') || '[]');
            const product = JSON.parse(json);
            const idx = products.findIndex(p => p.id === product.id);
            if (idx >= 0) products[idx] = product;
            else products.push({ ...product, id: product.id || crypto.randomUUID() });
            localStorage.setItem('products', JSON.stringify(products));
        }
    },
    getCategories: function() {
        if (window.NativeAPI && typeof window.NativeAPI.getCategories === 'function') {
            return window.NativeAPI.getCategories();
        }
        return localStorage.getItem('categories') || '[]';
    },
    saveCategory: function(json) {
        if (window.NativeAPI && typeof window.NativeAPI.saveCategory === 'function') {
            window.NativeAPI.saveCategory(json);
        } else {
            const categories = JSON.parse(localStorage.getItem('categories') || '[]');
            const category = JSON.parse(json);
            const idx = categories.findIndex(c => c.id === category.id);
            if (idx >= 0) categories[idx] = category;
            else categories.push({ ...category, id: category.id || crypto.randomUUID() });
            localStorage.setItem('categories', JSON.stringify(categories));
        }
    },
    getCustomers: function() {
        if (window.NativeAPI && typeof window.NativeAPI.getCustomers === 'function') {
            return window.NativeAPI.getCustomers();
        }
        return localStorage.getItem('customers') || '[]';
    },
    saveCustomer: function(json) {
        if (window.NativeAPI && typeof window.NativeAPI.saveCustomer === 'function') {
            window.NativeAPI.saveCustomer(json);
        } else {
            const customers = JSON.parse(localStorage.getItem('customers') || '[]');
            const customer = JSON.parse(json);
            const idx = customers.findIndex(c => c.id === customer.id);
            if (idx >= 0) customers[idx] = customer;
            else customers.push({ ...customer, id: customer.id || crypto.randomUUID() });
            localStorage.setItem('customers', JSON.stringify(customers));
        }
    },
    getSales: function() {
        if (window.NativeAPI && typeof window.NativeAPI.getSales === 'function') {
            return window.NativeAPI.getSales();
        }
        return localStorage.getItem('sales') || '[]';
    },
    saveSale: function(json) {
        if (window.NativeAPI && typeof window.NativeAPI.saveSale === 'function') {
            window.NativeAPI.saveSale(json);
        } else {
            const sales = JSON.parse(localStorage.getItem('sales') || '[]');
            const sale = JSON.parse(json);
            sales.push({ ...sale, id: sale.id || crypto.randomUUID() });
            localStorage.setItem('sales', JSON.stringify(sales));
        }
    },
    getSetting: function(key) {
        if (window.NativeAPI && typeof window.NativeAPI.getSetting === 'function') {
            return window.NativeAPI.getSetting(key);
        }
        return localStorage.getItem('setting_' + key) || '';
    },
    setSetting: function(key, value) {
        if (window.NativeAPI && typeof window.NativeAPI.setSetting === 'function') {
            window.NativeAPI.setSetting(key, value);
        } else {
            localStorage.setItem('setting_' + key, value);
        }
    },
    syncNow: function() {
        if (window.NativeAPI && typeof window.NativeAPI.syncNow === 'function') {
            window.NativeAPI.syncNow();
        }
    },
    getHardwareId: function() {
        if (window.NativeAPI && typeof window.NativeAPI.getHardwareId === 'function') {
            return window.NativeAPI.getHardwareId();
        }
        return 'BROWSER-MODE';
    }
};

// Constants
const IVA_RATE = 0.16;

// State
let products = [];
let categories = [];
let customers = [];
let cart = [];
let selectedCategory = 'all';
let globalDiscount = 0;
let paymentMethod = 'cash';
let currentPage = 'pos';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    console.log('NativeAPI available:', !!window.NativeAPI);
    
    setTimeout(function() {
        initApp();
    }, 100);
});

function initApp() {
    try {
        loadData();
        setupEventListeners();
        updateConnectionStatus();
        renderCategoryTabs();
        renderProducts();
        renderCart();
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        console.log('App initialized successfully');
        console.log('Products loaded:', products.length);
        console.log('Categories loaded:', categories.length);
    } catch(e) {
        console.error('Error initializing app:', e);
    }
    
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
}

function loadData() {
    try {
        const productsData = API.getProducts();
        products = JSON.parse(productsData || '[]');
        
        const categoriesData = API.getCategories();
        categories = JSON.parse(categoriesData || '[]');
        
        const customersData = API.getCustomers();
        customers = JSON.parse(customersData || '[]');
        
    } catch(e) {
        console.error('Error loading data:', e);
        products = [];
        categories = [];
        customers = [];
    }
}

function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            navigateTo(page);
        });
    });
    
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(renderProducts, 200));
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                handleBarcodeSearch(this.value);
            }
        });
    }
    
    // Category filter in header
    const categoryFilter = document.getElementById('category-filter-header');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function(e) {
            selectedCategory = e.target.value;
            renderProducts();
            renderCategoryTabs();
        });
    }
    
    // Global discount
    const globalDiscountInput = document.getElementById('global-discount');
    if (globalDiscountInput) {
        globalDiscountInput.addEventListener('input', function(e) {
            globalDiscount = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
            updateCartTotals();
        });
    }
    
    // Clear cart
    const clearCartBtn = document.getElementById('clear-cart-btn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCart);
    }
    
    // Checkout
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', openPaymentModal);
    }
    
    // Payment modal
    const closePaymentBtn = document.getElementById('close-payment');
    if (closePaymentBtn) {
        closePaymentBtn.addEventListener('click', closePaymentModal);
    }
    
    const completeSaleBtn = document.getElementById('complete-sale');
    if (completeSaleBtn) {
        completeSaleBtn.addEventListener('click', completeSale);
    }
    
    const cashAmountInput = document.getElementById('cash-amount');
    if (cashAmountInput) {
        cashAmountInput.addEventListener('input', updateChange);
    }
    
    // Payment methods
    document.querySelectorAll('.payment-method').forEach(function(btn) {
        btn.addEventListener('click', function() {
            selectPaymentMethod(this.getAttribute('data-method'));
        });
    });
    
    // Add product modal
    const closeAddProductBtn = document.getElementById('close-add-product');
    if (closeAddProductBtn) {
        closeAddProductBtn.addEventListener('click', closeAddProductModal);
    }
    
    const saveNewProductBtn = document.getElementById('save-new-product');
    if (saveNewProductBtn) {
        saveNewProductBtn.addEventListener('click', saveNewProduct);
    }
    
    // Close modals on backdrop click
    document.getElementById('payment-modal')?.addEventListener('click', function(e) {
        if (e.target === this) closePaymentModal();
    });
    
    document.getElementById('add-product-modal')?.addEventListener('click', function(e) {
        if (e.target === this) closeAddProductModal();
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function navigateTo(page) {
    currentPage = page;
    
    document.querySelectorAll('.sidebar-item').forEach(function(item) {
        const itemPage = item.getAttribute('data-page');
        if (itemPage === page) {
            item.classList.add('active');
            item.classList.remove('text-sidebar-muted');
            item.classList.add('text-white');
        } else {
            item.classList.remove('active');
            item.classList.add('text-sidebar-muted');
            item.classList.remove('text-white');
        }
    });
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    if (page !== 'pos') {
        const pageNames = {
            'cocina': 'Cocina',
            'corte': 'Corte de Caja',
            'fila': 'Fila Virtual',
            'dashboard': 'Dashboard',
            'inventario': 'Inventario',
            'ingredientes': 'Ingredientes',
            'menu-digital': 'Menu Digital',
            'devoluciones': 'Devoluciones',
            'clientes': 'Clientes',
            'solicitudes': 'Solicitudes',
            'reportes': 'Reportes',
            'facturacion': 'Facturación',
            'marcas-blancas': 'Marcas Blancas',
            'soporte': 'Soporte Remoto',
            'configuracion': 'Configuración'
        };
        const pageName = pageNames[page] || page.charAt(0).toUpperCase() + page.slice(1);
        showToast(pageName + ' - Próximamente', 'info');
    }
}

function handleBarcodeSearch(searchTerm) {
    if (!searchTerm) return;
    
    const product = products.find(p => 
        p.barcode === searchTerm || 
        p.sku === searchTerm ||
        p.id === searchTerm
    );
    
    if (product) {
        addToCart(product.id);
        document.getElementById('search-input').value = '';
    }
}

function renderCategoryTabs() {
    const tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer) return;
    
    const productCategories = [];
    const categoryMap = {};
    
    products.forEach(function(p) {
        if (p.category_id && !categoryMap[p.category_id]) {
            categoryMap[p.category_id] = true;
            productCategories.push(p.category_id);
        }
    });
    
    const categoryCounts = { all: products.length };
    productCategories.forEach(function(catId) {
        categoryCounts[catId] = products.filter(function(p) { return p.category_id === catId; }).length;
    });
    
    let tabsHTML = '';
    
    // All tab
    tabsHTML += '<button class="category-tab px-4 py-2 rounded-full text-sm font-medium transition ' + 
        (selectedCategory === 'all' ? 'bg-primary text-white' : 'bg-muted hover:bg-accent text-muted-foreground') + 
        '" data-category="all">Todos <span class="opacity-80">(' + categoryCounts['all'] + ')</span></button>';
    
    // Best sellers tab
    tabsHTML += '<button class="category-tab px-4 py-2 rounded-full text-sm font-medium transition ' + 
        (selectedCategory === 'mas-vendidos' ? 'bg-primary text-white' : 'bg-muted hover:bg-accent text-muted-foreground') + 
        '" data-category="mas-vendidos">Más vendidos</button>';
    
    // Category tabs
    productCategories.forEach(function(catId) {
        const category = categories.find(c => c.id === catId);
        const catName = category ? category.name : catId;
        const count = categoryCounts[catId] || 0;
        const isActive = selectedCategory === catId;
        
        tabsHTML += '<button class="category-tab px-4 py-2 rounded-full text-sm font-medium transition ' + 
            (isActive ? 'bg-primary text-white' : 'bg-muted hover:bg-accent text-muted-foreground') + 
            '" data-category="' + catId + '">' + catName + ' <span class="opacity-80">(' + count + ')</span></button>';
    });
    
    tabsContainer.innerHTML = tabsHTML;
    
    // Add click events
    tabsContainer.querySelectorAll('.category-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            selectedCategory = this.getAttribute('data-category');
            renderProducts();
            renderCategoryTabs();
        });
    });
    
    // Update header dropdown
    const headerFilter = document.getElementById('category-filter-header');
    if (headerFilter) {
        headerFilter.innerHTML = '<option value="all">Todos</option>';
        productCategories.forEach(function(catId) {
            const category = categories.find(c => c.id === catId);
            const catName = category ? category.name : catId;
            headerFilter.innerHTML += '<option value="' + catId + '" ' + (selectedCategory === catId ? 'selected' : '') + '>' + catName + '</option>';
        });
    }
}

function renderProducts() {
    const grid = document.getElementById('products-grid');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    if (!grid) return;
    
    let filtered = products.slice();
    
    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(function(p) {
            return p.name.toLowerCase().indexOf(searchTerm) !== -1 ||
                (p.sku && p.sku.toLowerCase().indexOf(searchTerm) !== -1) ||
                (p.barcode && p.barcode.toLowerCase().indexOf(searchTerm) !== -1);
        });
    }
    
    // Filter by category
    if (selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'mas-vendidos') {
        filtered = filtered.filter(function(p) { return p.category_id === selectedCategory; });
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    if (emptyState) {
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
    }
    
    let html = '';
    filtered.forEach(function(product) {
        const price = parseFloat(product.price || 0).toFixed(2);
        const productName = escapeHtml(product.name);
        
        html += '<div class="product-card bg-white rounded-lg shadow-sm border border-border cursor-pointer overflow-hidden" onclick="addToCart(\'' + product.id + '\')" data-testid="card-product-' + product.id + '">';
        html += '<div class="h-28 bg-muted flex items-center justify-center relative">';
        if (product.image_url) {
            html += '<img src="' + product.image_url + '" alt="' + productName + '" class="h-full w-full object-cover" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">';
            html += '<div class="absolute inset-0 items-center justify-center hidden"><i data-lucide="package" class="w-10 h-10 text-muted-foreground stroke-1"></i></div>';
        } else {
            html += '<i data-lucide="package" class="w-10 h-10 text-muted-foreground stroke-1"></i>';
        }
        html += '</div>';
        html += '<div class="p-3">';
        html += '<h3 class="font-medium text-foreground text-sm truncate">' + productName + '</h3>';
        html += '<p class="text-primary font-bold text-lg">$' + price + '</p>';
        html += '</div></div>';
    });
    
    grid.innerHTML = html;
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cart Functions
function addToCart(productId) {
    const product = products.find(function(p) { return p.id === productId; });
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }
    
    const existing = cart.find(function(item) { return item.product.id === productId; });
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ product: product, quantity: 1, discount: 0 });
    }
    
    // Bounce animation on cart count
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.classList.add('bounce');
        setTimeout(() => cartCount.classList.remove('bounce'), 300);
    }
    
    renderCart();
    showToast(product.name + ' agregado al carrito', 'success');
}

function updateCartQuantity(productId, delta) {
    const item = cart.find(function(i) { return i.product.id === productId; });
    if (!item) return;
    
    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(function(i) { return i.product.id !== productId; });
    }
    
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(function(i) { return i.product.id !== productId; });
    renderCart();
}

function clearCart() {
    if (cart.length === 0) return;
    
    cart = [];
    globalDiscount = 0;
    
    const globalDiscountInput = document.getElementById('global-discount');
    if (globalDiscountInput) globalDiscountInput.value = '0';
    
    renderCart();
    showToast('Carrito limpiado', 'info');
}

function updateItemDiscount(productId, discount) {
    const item = cart.find(function(i) { return i.product.id === productId; });
    if (item) {
        item.discount = Math.min(100, Math.max(0, parseFloat(discount) || 0));
        renderCart();
    }
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartEmpty = document.getElementById('cart-empty');
    const checkoutBtn = document.getElementById('checkout-btn');
    
    const totalItems = cart.reduce(function(sum, item) { return sum + item.quantity; }, 0);
    if (cartCount) cartCount.textContent = '(' + totalItems + ')';
    
    if (cart.length === 0) {
        if (container) {
            container.innerHTML = `
                <div id="cart-empty" class="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                    <i data-lucide="shopping-cart" class="w-16 h-16 mb-4 stroke-1"></i>
                    <p class="font-semibold text-lg mb-2">Carrito vacío</p>
                    <p class="text-sm text-center">Agrega productos para comenzar una venta</p>
                </div>
            `;
        }
        if (checkoutBtn) checkoutBtn.disabled = true;
        updateCartTotals();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    if (checkoutBtn) checkoutBtn.disabled = false;
    
    if (container) {
        let html = '<div class="p-4 space-y-3">';
        cart.forEach(function(item) {
            const itemSubtotal = item.product.price * item.quantity;
            const itemDiscount = itemSubtotal * ((item.discount || 0) / 100);
            const itemTotal = itemSubtotal - itemDiscount;
            const productName = escapeHtml(item.product.name);
            
            html += '<div class="cart-item bg-muted/50 rounded-lg p-3 border border-border">';
            
            // Top row: Image, name, remove button
            html += '<div class="flex items-start gap-3 mb-3">';
            html += '<div class="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">';
            if (item.product.image_url) {
                html += '<img src="' + item.product.image_url + '" alt="' + productName + '" class="w-full h-full object-cover">';
            } else {
                html += '<i data-lucide="package" class="w-6 h-6 text-muted-foreground"></i>';
            }
            html += '</div>';
            html += '<div class="flex-1 min-w-0">';
            html += '<p class="font-medium text-sm text-foreground truncate">' + productName + '</p>';
            html += '<p class="text-xs text-muted-foreground">$' + parseFloat(item.product.price).toFixed(2) + ' c/u</p>';
            html += '</div>';
            html += '<button onclick="removeFromCart(\'' + item.product.id + '\')" class="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition">';
            html += '<i data-lucide="x" class="w-4 h-4"></i>';
            html += '</button>';
            html += '</div>';
            
            // Bottom row: Quantity controls, discount, total
            html += '<div class="flex items-center justify-between gap-2">';
            
            // Quantity controls
            html += '<div class="flex items-center gap-1">';
            html += '<button onclick="updateCartQuantity(\'' + item.product.id + '\', -1)" class="w-8 h-8 rounded-md border border-border bg-white hover:bg-accent flex items-center justify-center text-foreground transition">';
            html += '<i data-lucide="minus" class="w-4 h-4"></i>';
            html += '</button>';
            html += '<span class="w-10 text-center font-semibold text-sm">' + item.quantity + '</span>';
            html += '<button onclick="updateCartQuantity(\'' + item.product.id + '\', 1)" class="w-8 h-8 rounded-md border border-border bg-white hover:bg-accent flex items-center justify-center text-foreground transition">';
            html += '<i data-lucide="plus" class="w-4 h-4"></i>';
            html += '</button>';
            html += '</div>';
            
            // Discount input
            html += '<div class="flex items-center gap-1">';
            html += '<input type="number" value="' + (item.discount || 0) + '" onchange="updateItemDiscount(\'' + item.product.id + '\', this.value)" class="w-14 h-8 text-center text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary" min="0" max="100" placeholder="0">';
            html += '<span class="text-xs text-muted-foreground">%</span>';
            html += '</div>';
            
            // Line total
            html += '<span class="font-bold text-primary text-sm min-w-[70px] text-right">$' + itemTotal.toFixed(2) + '</span>';
            
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }
    
    updateCartTotals();
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function updateCartTotals() {
    // Calculate subtotal (before any discounts)
    const subtotal = cart.reduce(function(sum, item) { 
        return sum + (item.product.price * item.quantity); 
    }, 0);
    
    // Calculate item-level discounts
    const itemDiscounts = cart.reduce(function(sum, item) {
        const itemTotal = item.product.price * item.quantity;
        return sum + (itemTotal * ((item.discount || 0) / 100));
    }, 0);
    
    // Subtotal after item discounts
    const subtotalAfterItemDiscounts = subtotal - itemDiscounts;
    
    // Global discount applied to subtotal after item discounts
    const globalDiscountAmount = subtotalAfterItemDiscounts * (globalDiscount / 100);
    
    // Total discount
    const totalDiscount = itemDiscounts + globalDiscountAmount;
    
    // Subtotal before tax (after all discounts)
    const subtotalBeforeTax = subtotal - totalDiscount;
    
    // IVA calculation
    const iva = subtotalBeforeTax * IVA_RATE;
    
    // Final total
    const total = subtotalBeforeTax + iva;
    
    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount');
    const ivaEl = document.getElementById('cart-iva');
    const totalEl = document.getElementById('cart-total');
    
    if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
    if (discountEl) discountEl.textContent = '-$' + totalDiscount.toFixed(2);
    if (ivaEl) ivaEl.textContent = '$' + iva.toFixed(2);
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
}

function getCartTotal() {
    const subtotal = cart.reduce(function(sum, item) { 
        return sum + (item.product.price * item.quantity); 
    }, 0);
    
    const itemDiscounts = cart.reduce(function(sum, item) {
        const itemTotal = item.product.price * item.quantity;
        return sum + (itemTotal * ((item.discount || 0) / 100));
    }, 0);
    
    const subtotalAfterItemDiscounts = subtotal - itemDiscounts;
    const globalDiscountAmount = subtotalAfterItemDiscounts * (globalDiscount / 100);
    const totalDiscount = itemDiscounts + globalDiscountAmount;
    const subtotalBeforeTax = subtotal - totalDiscount;
    const iva = subtotalBeforeTax * IVA_RATE;
    
    return subtotalBeforeTax + iva;
}

// Payment Functions
function openPaymentModal() {
    const modal = document.getElementById('payment-modal');
    const total = getCartTotal();
    
    const paymentTotalEl = document.getElementById('payment-total');
    if (paymentTotalEl) paymentTotalEl.textContent = '$' + total.toFixed(2);
    
    const cashAmountInput = document.getElementById('cash-amount');
    if (cashAmountInput) cashAmountInput.value = '';
    
    const changeEl = document.getElementById('change-amount');
    if (changeEl) changeEl.textContent = '$0.00';
    
    // Reset payment method to cash
    selectPaymentMethod('cash');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Focus on cash amount input
    setTimeout(() => {
        if (cashAmountInput) cashAmountInput.focus();
    }, 100);
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function selectPaymentMethod(method) {
    paymentMethod = method;
    
    document.querySelectorAll('.payment-method').forEach(function(btn) {
        const btnMethod = btn.getAttribute('data-method');
        const icon = btn.querySelector('[data-lucide]');
        const text = btn.querySelector('span');
        
        if (btnMethod === method) {
            btn.classList.remove('border-border');
            btn.classList.add('border-primary', 'bg-primary/5', 'active');
            if (icon) icon.classList.remove('text-muted-foreground');
            if (icon) icon.classList.add('text-primary');
            if (text) text.classList.remove('text-muted-foreground');
        } else {
            btn.classList.add('border-border');
            btn.classList.remove('border-primary', 'bg-primary/5', 'active');
            if (icon) icon.classList.add('text-muted-foreground');
            if (icon) icon.classList.remove('text-primary');
            if (text) text.classList.add('text-muted-foreground');
        }
    });
    
    const cashSection = document.getElementById('cash-amount-section');
    if (cashSection) {
        cashSection.style.display = method === 'cash' ? 'block' : 'none';
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function updateChange() {
    const total = getCartTotal();
    const cashAmountInput = document.getElementById('cash-amount');
    const cashAmount = parseFloat(cashAmountInput ? cashAmountInput.value : 0) || 0;
    const change = Math.max(0, cashAmount - total);
    
    const changeEl = document.getElementById('change-amount');
    if (changeEl) changeEl.textContent = '$' + change.toFixed(2);
}

function completeSale() {
    if (cart.length === 0) {
        showToast('El carrito está vacío', 'error');
        return;
    }
    
    const total = getCartTotal();
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    
    const itemDiscounts = cart.reduce((sum, item) => {
        const itemTotal = item.product.price * item.quantity;
        return sum + (itemTotal * ((item.discount || 0) / 100));
    }, 0);
    
    const subtotalAfterItemDiscounts = subtotal - itemDiscounts;
    const globalDiscountAmount = subtotalAfterItemDiscounts * (globalDiscount / 100);
    const totalDiscount = itemDiscounts + globalDiscountAmount;
    const subtotalBeforeTax = subtotal - totalDiscount;
    const iva = subtotalBeforeTax * IVA_RATE;
    
    const cashAmountInput = document.getElementById('cash-amount');
    const cashAmount = parseFloat(cashAmountInput ? cashAmountInput.value : total) || total;
    
    if (paymentMethod === 'cash' && cashAmount < total) {
        showToast('Cantidad insuficiente', 'error');
        return;
    }
    
    const sale = {
        id: crypto.randomUUID(),
        receipt_number: 'REC-' + Date.now(),
        subtotal: subtotal,
        discount: totalDiscount,
        iva: iva,
        total: total,
        payment_method: paymentMethod,
        amount_paid: paymentMethod === 'cash' ? cashAmount : total,
        change_amount: paymentMethod === 'cash' ? Math.max(0, cashAmount - total) : 0,
        status: 'completed',
        items: cart.map(function(item) {
            const itemSubtotal = item.product.price * item.quantity;
            const itemDiscount = itemSubtotal * ((item.discount || 0) / 100);
            return {
                product_id: item.product.id,
                product_name: item.product.name,
                quantity: item.quantity,
                unit_price: item.product.price,
                discount: item.discount || 0,
                total: itemSubtotal - itemDiscount
            };
        }),
        created_at: new Date().toISOString()
    };
    
    try {
        API.saveSale(JSON.stringify(sale));
        showToast('¡Venta completada! Total: $' + total.toFixed(2), 'success');
        clearCart();
        closePaymentModal();
    } catch(e) {
        console.error('Error saving sale:', e);
        showToast('Error al procesar la venta', 'error');
    }
}

// Add Product Modal
function openAddProductModal() {
    const modal = document.getElementById('add-product-modal');
    
    // Populate categories dropdown
    const categorySelect = document.getElementById('new-product-category');
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Sin categoría</option>';
        categories.forEach(function(cat) {
            categorySelect.innerHTML += '<option value="' + cat.id + '">' + escapeHtml(cat.name) + '</option>';
        });
    }
    
    // Clear form
    document.getElementById('new-product-name').value = '';
    document.getElementById('new-product-price').value = '';
    document.getElementById('new-product-cost').value = '';
    document.getElementById('new-product-sku').value = '';
    document.getElementById('new-product-stock').value = '0';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    setTimeout(() => {
        document.getElementById('new-product-name')?.focus();
    }, 100);
}

function closeAddProductModal() {
    const modal = document.getElementById('add-product-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function saveNewProduct() {
    const name = document.getElementById('new-product-name').value.trim();
    const price = parseFloat(document.getElementById('new-product-price').value) || 0;
    const cost = parseFloat(document.getElementById('new-product-cost').value) || 0;
    const sku = document.getElementById('new-product-sku').value.trim();
    const stock = parseInt(document.getElementById('new-product-stock').value) || 0;
    const categoryId = document.getElementById('new-product-category').value;
    
    if (!name) {
        showToast('El nombre es requerido', 'error');
        return;
    }
    
    if (price <= 0) {
        showToast('El precio debe ser mayor a 0', 'error');
        return;
    }
    
    const product = {
        id: crypto.randomUUID(),
        name: name,
        price: price,
        cost: cost,
        sku: sku || null,
        barcode: sku || null,
        stock: stock,
        category_id: categoryId || null,
        created_at: new Date().toISOString()
    };
    
    try {
        API.saveProduct(JSON.stringify(product));
        products.push(product);
        renderProducts();
        renderCategoryTabs();
        closeAddProductModal();
        showToast('Producto agregado: ' + name, 'success');
    } catch(e) {
        console.error('Error saving product:', e);
        showToast('Error al guardar el producto', 'error');
    }
}

// Connection Status
function updateConnectionStatus() {
    const isOffline = API.isOffline();
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    
    if (indicator && text) {
        if (isOffline) {
            indicator.classList.remove('bg-green-500');
            indicator.classList.add('bg-yellow-500');
            text.textContent = 'Modo Offline';
        } else {
            indicator.classList.remove('bg-yellow-500');
            indicator.classList.add('bg-green-500');
            text.textContent = 'Conectado';
        }
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast pointer-events-auto';
    
    let bgColor = 'bg-foreground';
    let icon = 'check-circle';
    
    switch(type) {
        case 'success':
            bgColor = 'bg-green-600';
            icon = 'check-circle';
            break;
        case 'error':
            bgColor = 'bg-destructive';
            icon = 'x-circle';
            break;
        case 'info':
            bgColor = 'bg-primary';
            icon = 'info';
            break;
        case 'warning':
            bgColor = 'bg-yellow-500';
            icon = 'alert-triangle';
            break;
    }
    
    toast.innerHTML = `
        <div class="${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px]">
            <i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i>
            <span class="text-sm font-medium">${escapeHtml(message)}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 3000);
}

// Expose functions globally for onclick handlers
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.updateItemDiscount = updateItemDiscount;
window.openAddProductModal = openAddProductModal;
