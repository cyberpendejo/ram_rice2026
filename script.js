const FALLBACK_PRODUCTS = [
    { id: 'maharlika',   name: 'Maharlika',   sackPrice: 1400, kiloPrice: 55, stockQty: 120 },
    { id: 'sinandomeng', name: 'Sinandomeng', sackPrice: 1300, kiloPrice: 52, stockQty: 100 },
    { id: 'jasmine',     name: 'Jasmine',     sackPrice: 1200, kiloPrice: 48, stockQty: 90  },
    { id: 'dinorado',    name: 'Dinorado',    sackPrice: 1100, kiloPrice: 50, stockQty: 80  },
    { id: 'kohaku',      name: 'Kohaku Rice', sackPrice: 1500, kiloPrice: 60, stockQty: 70  }
];

const ADMIN_TOKEN_KEY = 'ram_rice_admin_token';

let productData = [];

async function fetchProducts() {
    try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Failed to fetch products');
        const data = await res.json();
        return data.products || FALLBACK_PRODUCTS;
    } catch {
        return FALLBACK_PRODUCTS;
    }
}

function formatCurrency(number) {
    return Number(number).toLocaleString('en-PH');
}

function getStockStatus(stockQty) {
    const quantity = Number(stockQty);
    if (quantity <= 0) return 'Out of Stock';
    if (quantity <= 20) return 'Low Stock';
    return 'In Stock';
}

function getStockStatusClass(stockQty) {
    const quantity = Number(stockQty);
    if (quantity <= 0) return 'status-out';
    if (quantity <= 20) return 'status-low';
    return 'status-in';
}

function renderPublicInventory() {
    const sackList = document.getElementById('sack-prices-list');
    const kiloList = document.getElementById('kilo-prices-list');

    if (sackList) {
        sackList.innerHTML = productData.map(item => `
            <div class="card">
                <h3>${item.name}</h3>
                <p class="price">₱<span>${formatCurrency(item.sackPrice)}</span></p>
                <p class="stock">Stock: <span>${item.stockQty}</span> sacks</p>
                <p class="stock-state">Status: <span class="stock-status ${getStockStatusClass(item.stockQty)}">${getStockStatus(item.stockQty)}</span></p>
                <a class="order-btn" href="order.html?product=${encodeURIComponent(item.name)}">Order Now</a>
            </div>
        `).join('');
    }

    if (kiloList) {
        kiloList.innerHTML = productData.map(item => `
            <div class="card">
                <h3>${item.name}</h3>
                <p class="price">₱<span>${formatCurrency(item.kiloPrice)}</span> / kg</p>
                <a class="order-btn" href="order.html?product=${encodeURIComponent(item.name)}">Order Now</a>
            </div>
        `).join('');
    }
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');

    document.querySelectorAll('nav a').forEach(a => {
        a.classList.toggle('active', a.dataset.section === id);
    });

    const nav = document.querySelector('nav');
    if (nav.classList.contains('open')) {
        nav.classList.remove('open');
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    }
}

function initSharedMenuToggle() {
    const menuToggle = document.getElementById('menu-toggle');
    const nav = document.querySelector('nav');
    if (!menuToggle || !nav) return;

    menuToggle.addEventListener('click', () => {
        const expanded = nav.classList.toggle('open');
        menuToggle.setAttribute('aria-expanded', expanded);
    });
}

function initAdminLogin() {
    const loginForm = document.getElementById('admin-login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('admin-username').value.trim();
        const password = document.getElementById('admin-password').value;
        const status   = document.getElementById('admin-login-status');
        const btn      = document.getElementById('admin-login-btn');

        btn.disabled    = true;
        btn.textContent = 'Logging in...';

        try {
            const res  = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (!res.ok) {
                status.textContent = data.error || 'Invalid credentials.';
                status.className   = 'admin-status-error';
                return;
            }

            sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
            window.location.href = 'database.html';

        } catch (err) {
            console.error('Login error:', err);
            status.textContent = 'Login failed. Please try again.';
            status.className   = 'admin-status-error';
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Login';
        }
    });
}

function initMainPage() {
    renderPublicInventory();
    initAdminLogin();

    const handleHashChange = () => {
        const hash = location.hash.replace('#', '') || 'home';
        showSection(hash);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
}

function generateOrderId() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `RAM-${datePart}-${timePart}`;
}

function formatPHP(amount) {
    return `PHP ${Number(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function initOrderPage() {
    const orderForm    = document.querySelector('.order-form');
    if (!orderForm) return;

    const submitBtn       = orderForm.querySelector('.order-btn');
    const modal           = document.getElementById('order-success-modal');
    const modalEmail      = document.getElementById('modal-email');
    const modalOrderId    = document.getElementById('modal-order-id');
    const modalTotalPrice = document.getElementById('modal-total-price');
    const modalCloseBtn   = document.getElementById('modal-close-btn');

    // populate product dropdown dynamically
    const productSelect = document.getElementById('product');
    if (productSelect && productData.length) {
        productSelect.innerHTML = '<option value="">-- Select a Rice Type --</option>' +
            productData.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    }

    const urlParams = new URLSearchParams(window.location.search);
    const product   = urlParams.get('product');
    if (product && productSelect) productSelect.value = product;

    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const firstName      = document.getElementById('first-name').value.trim();
        const lastName       = document.getElementById('last-name').value.trim();
        const selectedProduct = document.getElementById('product').value;
        const quantity       = Number(document.getElementById('quantity').value);
        const unit           = document.getElementById('unit').value;
        const contactNumber  = document.getElementById('contact-number').value.trim();
        const email          = document.getElementById('email').value.trim();
        const orderId        = generateOrderId();

        const item = productData.find(p => p.name === selectedProduct);
        const unitPrice = item ? (unit === 'sack' ? item.sackPrice : item.kiloPrice) : null;

        if (!unitPrice) {
            alert('Could not calculate total price for the selected product.');
            return;
        }

        const totalPriceValue = quantity * unitPrice;
        const totalPrice      = formatPHP(totalPriceValue);
        const unitLabel       = unit.charAt(0).toUpperCase() + unit.slice(1);

        submitBtn.disabled  = true;
        submitBtn.innerHTML = '<span class="submit-spinner"></span>Sending...';

        try {
            const res = await fetch('/api/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId, firstName, lastName, email,
                    contactNumber, product: selectedProduct,
                    quantity, unit: unitLabel,
                    unitPrice: formatPHP(unitPrice), totalPrice
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to submit order');
            }

            if (modalOrderId)    modalOrderId.textContent    = orderId;
            if (modalTotalPrice) modalTotalPrice.textContent = totalPrice;
            if (modalEmail)      modalEmail.textContent      = email;
            if (modal) {
                modal.removeAttribute('hidden');
                modal.focus();
            }
            orderForm.reset();

        } catch (err) {
            console.error('Order error:', err);
            alert('Failed to submit your order. Please try again or contact us at ramrice@gmail.com.');
        } finally {
            submitBtn.disabled  = false;
            submitBtn.textContent = 'Submit Order';
        }
    });

    if (modalCloseBtn && modal) {
        modalCloseBtn.addEventListener('click', () => modal.setAttribute('hidden', ''));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.setAttribute('hidden', '');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
                modal.setAttribute('hidden', '');
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    initSharedMenuToggle();

    productData = await fetchProducts();

    if (document.getElementById('home')) {
        initMainPage();
    }

    if (document.querySelector('.order-form')) {
        initOrderPage();
    }
});
