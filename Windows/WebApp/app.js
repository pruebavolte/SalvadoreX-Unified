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

// State
let products = [];
let categories = [];
let customers = [];
let cart = [];
let selectedCategory = 'all';
let paymentMethod = 'cash';
let currentPage = 'pos';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    console.log('NativeAPI available:', !!window.NativeAPI);
    
    // Small delay to ensure NativeAPI is injected
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
        
        console.log('App initialized successfully');
        console.log('Products loaded:', products.length);
        console.log('Categories loaded:', categories.length);
    } catch(e) {
        console.error('Error initializing app:', e);
    }
    
    // Listen for online/offline events
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
}

function loadData() {
    try {
        // Load products
        const productsData = API.getProducts();
        console.log('Products data:', productsData);
        products = JSON.parse(productsData || '[]');
        
        // Load categories  
        const categoriesData = API.getCategories();
        console.log('Categories data:', categoriesData);
        categories = JSON.parse(categoriesData || '[]');
        
        // Load customers
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
            var page = this.getAttribute('data-page');
            navigateTo(page);
        });
    });
    
    // Search
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', renderProducts);
    }
    
    // Category filter in header
    var categoryFilter = document.getElementById('category-filter-header');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function(e) {
            selectedCategory = e.target.value;
            renderProducts();
            renderCategoryTabs();
        });
    }
    
    // Clear cart
    var clearCartBtn = document.getElementById('clear-cart-btn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCart);
    }
    
    // Checkout
    var checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', openPaymentModal);
    }
    
    // Payment modal
    var closePaymentBtn = document.getElementById('close-payment');
    if (closePaymentBtn) {
        closePaymentBtn.addEventListener('click', closePaymentModal);
    }
    
    var completeSaleBtn = document.getElementById('complete-sale');
    if (completeSaleBtn) {
        completeSaleBtn.addEventListener('click', completeSale);
    }
    
    var cashAmountInput = document.getElementById('cash-amount');
    if (cashAmountInput) {
        cashAmountInput.addEventListener('input', updateChange);
    }
    
    // Payment methods
    document.querySelectorAll('.payment-method').forEach(function(btn) {
        btn.addEventListener('click', function() {
            selectPaymentMethod(this.getAttribute('data-method'));
        });
    });
}

function navigateTo(page) {
    currentPage = page;
    
    // Update sidebar active state
    document.querySelectorAll('.sidebar-item').forEach(function(item) {
        item.classList.remove('active', 'text-white');
        item.classList.add('text-gray-300');
        if (item.getAttribute('data-page') === page) {
            item.classList.add('active', 'text-white');
            item.classList.remove('text-gray-300');
        }
    });
    
    // For now, show toast for non-POS pages
    if (page !== 'pos') {
        showToast(page.charAt(0).toUpperCase() + page.slice(1) + ' - Próximamente', 'info');
    }
}

function renderCategoryTabs() {
    var tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer) return;
    
    // Get unique categories from products
    var productCategories = [];
    products.forEach(function(p) {
        if (p.category_id && productCategories.indexOf(p.category_id) === -1) {
            productCategories.push(p.category_id);
        }
    });
    
    // Count products per category
    var categoryCounts = { all: products.length };
    productCategories.forEach(function(cat) {
        categoryCounts[cat] = products.filter(function(p) { return p.category_id === cat; }).length;
    });
    
    var tabsHTML = '<button class="category-tab ' + (selectedCategory === 'all' ? 'active bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700') + ' px-4 py-2 rounded-full text-sm font-medium" data-category="all">Todos <span class="opacity-75">(' + categoryCounts['all'] + ')</span></button>';
    tabsHTML += '<button class="category-tab ' + (selectedCategory === 'mas-vendidos' ? 'active bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700') + ' px-4 py-2 rounded-full text-sm font-medium" data-category="mas-vendidos">Más vendidos</button>';
    
    productCategories.forEach(function(cat) {
        var count = categoryCounts[cat] || 0;
        var isActive = selectedCategory === cat;
        tabsHTML += '<button class="category-tab ' + (isActive ? 'active bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700') + ' px-4 py-2 rounded-full text-sm font-medium" data-category="' + cat + '">' + cat + ' <span class="opacity-75">(' + count + ')</span></button>';
    });
    
    tabsContainer.innerHTML = tabsHTML;
    
    // Add click events to tabs
    tabsContainer.querySelectorAll('.category-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            selectedCategory = this.getAttribute('data-category');
            renderProducts();
            renderCategoryTabs();
        });
    });
    
    // Update header dropdown
    var headerFilter = document.getElementById('category-filter-header');
    if (headerFilter) {
        headerFilter.innerHTML = '<option value="all">Todos</option>';
        productCategories.forEach(function(cat) {
            headerFilter.innerHTML += '<option value="' + cat + '" ' + (selectedCategory === cat ? 'selected' : '') + '>' + cat + '</option>';
        });
    }
}

function renderProducts() {
    var grid = document.getElementById('products-grid');
    var emptyState = document.getElementById('empty-state');
    var searchInput = document.getElementById('search-input');
    var searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    if (!grid) return;
    
    var filtered = products.slice();
    
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
        return;
    }
    
    if (emptyState) {
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
    }
    
    var html = '';
    filtered.forEach(function(product) {
        var price = parseFloat(product.price || 0).toFixed(2);
        html += '<div class="product-card bg-white rounded-xl shadow-sm border cursor-pointer overflow-hidden" onclick="addToCart(\'' + product.id + '\')">';
        html += '<div class="h-28 bg-gray-100 flex items-center justify-center">';
        if (product.image_url) {
            html += '<img src="' + product.image_url + '" alt="' + product.name + '" class="h-full w-full object-cover">';
        } else {
            html += '<i class="fas fa-box text-4xl text-gray-300"></i>';
        }
        html += '</div>';
        html += '<div class="p-3">';
        html += '<h3 class="font-medium text-gray-900 text-sm truncate">' + product.name + '</h3>';
        html += '<p class="text-primary font-bold text-lg">$' + price + '</p>';
        html += '</div></div>';
    });
    
    grid.innerHTML = html;
}

// Cart Functions
function addToCart(productId) {
    var product = products.find(function(p) { return p.id === productId; });
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }
    
    var existing = cart.find(function(item) { return item.product.id === productId; });
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ product: product, quantity: 1, discount: 0 });
    }
    
    renderCart();
    showToast(product.name + ' agregado al carrito');
}

function updateCartQuantity(productId, delta) {
    var item = cart.find(function(i) { return i.product.id === productId; });
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
    cart = [];
    renderCart();
}

function renderCart() {
    var container = document.getElementById('cart-items');
    var cartCount = document.getElementById('cart-count');
    var checkoutBtn = document.getElementById('checkout-btn');
    
    var totalItems = cart.reduce(function(sum, item) { return sum + item.quantity; }, 0);
    if (cartCount) cartCount.textContent = totalItems;
    
    if (cart.length === 0) {
        if (container) {
            container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-gray-400"><i class="fas fa-shopping-basket text-4xl mb-2"></i><p>Carrito vacío</p></div>';
        }
        if (checkoutBtn) checkoutBtn.disabled = true;
        updateCartTotals();
        return;
    }
    
    if (checkoutBtn) checkoutBtn.disabled = false;
    
    if (container) {
        var html = '';
        cart.forEach(function(item) {
            var itemTotal = (item.product.price * item.quantity) * (1 - (item.discount || 0) / 100);
            html += '<div class="cart-item bg-gray-50 rounded-lg p-3">';
            html += '<div class="flex justify-between items-start mb-2">';
            html += '<div class="flex items-center gap-2">';
            html += '<div class="w-10 h-10 bg-gray-200 rounded flex items-center justify-center"><i class="fas fa-box text-gray-400 text-sm"></i></div>';
            html += '<div><span class="font-medium text-sm block">' + item.product.name + '</span>';
            html += '<span class="text-xs text-gray-500">$' + parseFloat(item.product.price).toFixed(2) + ' c/u</span></div></div>';
            html += '<button onclick="removeFromCart(\'' + item.product.id + '\')" class="text-gray-400 hover:text-red-500 transition"><i class="fas fa-times"></i></button></div>';
            html += '<div class="flex justify-between items-center">';
            html += '<div class="flex items-center gap-1">';
            html += '<button onclick="updateCartQuantity(\'' + item.product.id + '\', -1)" class="w-7 h-7 rounded border bg-white hover:bg-gray-100 flex items-center justify-center text-gray-600"><i class="fas fa-minus text-xs"></i></button>';
            html += '<span class="w-8 text-center font-medium text-sm">' + item.quantity + '</span>';
            html += '<button onclick="updateCartQuantity(\'' + item.product.id + '\', 1)" class="w-7 h-7 rounded border bg-white hover:bg-gray-100 flex items-center justify-center text-gray-600"><i class="fas fa-plus text-xs"></i></button></div>';
            html += '<div class="flex items-center gap-2">';
            html += '<input type="number" value="' + (item.discount || 0) + '" onchange="updateItemDiscount(\'' + item.product.id + '\', this.value)" class="w-12 h-7 text-center text-xs border rounded" placeholder="0">';
            html += '<span class="text-xs text-gray-500">%</span>';
            html += '<span class="font-bold text-primary ml-2">$' + itemTotal.toFixed(2) + '</span></div></div></div>';
        });
        container.innerHTML = html;
    }
    
    updateCartTotals();
}

function updateItemDiscount(productId, discount) {
    var item = cart.find(function(i) { return i.product.id === productId; });
    if (item) {
        item.discount = Math.min(100, Math.max(0, parseFloat(discount) || 0));
        renderCart();
    }
}

function updateCartTotals() {
    var subtotal = cart.reduce(function(sum, item) { return sum + (item.product.price * item.quantity); }, 0);
    var totalDiscount = cart.reduce(function(sum, item) {
        var itemTotal = item.product.price * item.quantity;
        var discountAmount = itemTotal * ((item.discount || 0) / 100);
        return sum + discountAmount;
    }, 0);
    var total = subtotal - totalDiscount;
    
    var subtotalEl = document.getElementById('cart-subtotal');
    var discountEl = document.getElementById('cart-discount');
    var totalEl = document.getElementById('cart-total');
    
    if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
    if (discountEl) discountEl.textContent = '-$' + totalDiscount.toFixed(2);
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
}

// Payment Functions
function openPaymentModal() {
    var modal = document.getElementById('payment-modal');
    var subtotal = cart.reduce(function(sum, item) { return sum + (item.product.price * item.quantity); }, 0);
    var totalDiscount = cart.reduce(function(sum, item) {
        var itemTotal = item.product.price * item.quantity;
        return sum + (itemTotal * ((item.discount || 0) / 100));
    }, 0);
    var total = subtotal - totalDiscount;
    
    var paymentTotalEl = document.getElementById('payment-total');
    if (paymentTotalEl) paymentTotalEl.textContent = '$' + total.toFixed(2);
    
    var cashAmountInput = document.getElementById('cash-amount');
    if (cashAmountInput) cashAmountInput.value = '';
    
    var changeEl = document.getElementById('change-amount');
    if (changeEl) changeEl.textContent = '$0.00';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePaymentModal() {
    var modal = document.getElementById('payment-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function selectPaymentMethod(method) {
    paymentMethod = method;
    document.querySelectorAll('.payment-method').forEach(function(btn) {
        btn.classList.remove('border-primary', 'bg-blue-50', 'active');
        btn.classList.add('border-gray-200');
        if (btn.getAttribute('data-method') === method) {
            btn.classList.add('border-primary', 'bg-blue-50', 'active');
            btn.classList.remove('border-gray-200');
        }
    });
    
    var cashSection = document.getElementById('cash-amount-section');
    if (cashSection) {
        cashSection.style.display = method === 'cash' ? 'block' : 'none';
    }
}

function updateChange() {
    var subtotal = cart.reduce(function(sum, item) { return sum + (item.product.price * item.quantity); }, 0);
    var totalDiscount = cart.reduce(function(sum, item) {
        return sum + ((item.product.price * item.quantity) * ((item.discount || 0) / 100));
    }, 0);
    var total = subtotal - totalDiscount;
    
    var cashAmountInput = document.getElementById('cash-amount');
    var cashAmount = parseFloat(cashAmountInput ? cashAmountInput.value : 0) || 0;
    var change = Math.max(0, cashAmount - total);
    
    var changeEl = document.getElementById('change-amount');
    if (changeEl) changeEl.textContent = '$' + change.toFixed(2);
}

function completeSale() {
    if (cart.length === 0) {
        showToast('El carrito está vacío', 'error');
        return;
    }
    
    var subtotal = cart.reduce(function(sum, item) { return sum + (item.product.price * item.quantity); }, 0);
    var totalDiscount = cart.reduce(function(sum, item) {
        return sum + ((item.product.price * item.quantity) * ((item.discount || 0) / 100));
    }, 0);
    var total = subtotal - totalDiscount;
    
    var cashAmountInput = document.getElementById('cash-amount');
    var cashAmount = parseFloat(cashAmountInput ? cashAmountInput.value : total) || total;
    
    var sale = {
        id: crypto.randomUUID(),
        receipt_number: 'REC-' + Date.now(),
        subtotal: subtotal,
        discount: totalDiscount,
        total: total,
        payment_method: paymentMethod,
        amount_paid: cashAmount,
        change_amount: Math.max(0, cashAmount - total),
        status: 'completed',
        items: cart.map(function(item) {
            return {
                product_id: item.product.id,
                product_name: item.product.name,
                quantity: item.quantity,
                unit_price: item.product.price,
                discount: item.discount || 0,
                total: (item.product.price * item.quantity) * (1 - (item.discount || 0) / 100)
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

// Connection Status
function updateConnectionStatus() {
    var isOffline = API.isOffline();
    var indicator = document.getElementById('status-indicator');
    var text = document.getElementById('status-text');
    
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
function showToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toast-container');
    if (!container) return;
    
    var toast = document.createElement('div');
    var bgColor = type === 'error' ? 'bg-red-500' : type === 'info' ? 'bg-blue-500' : 'bg-gray-900';
    var icon = type === 'error' ? 'fa-exclamation-circle' : type === 'info' ? 'fa-info-circle' : 'fa-check-circle';
    
    toast.className = bgColor + ' text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2';
    toast.innerHTML = '<i class="fas ' + icon + '"></i><span>' + message + '</span>';
    
    container.appendChild(toast);
    
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// Make functions globally accessible
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.updateItemDiscount = updateItemDiscount;
