import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// ВСТАВЬ СВОИ КЛЮЧИ СЮДА
const firebaseConfig = {
  apiKey: "ТВОЙ_API_KEY",
  authDomain: "craft-coffee-app.firebaseapp.com",
  projectId: "craft-coffee-app",
  storageBucket: "craft-coffee-app.firebasestorage.app",
  messagingSenderId: "886030226106",
  appId: "1:886030226106:web:7d97868d486b694de76883"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Элементы UI
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('admin-login-form');
const logoutBtn = document.getElementById('logout-btn');
const staffEmailSpan = document.getElementById('staff-email');

const navBtns = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.content-section');

const menuTbody = document.getElementById('menu-tbody');
const ordersTbody = document.getElementById('orders-tbody');
const addProductBtn = document.getElementById('add-product-btn');
const productModal = document.getElementById('product-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const addProductForm = document.getElementById('add-product-form');
const refreshOrdersBtn = document.getElementById('refresh-orders');

// --- 1. АВТОРИЗАЦИЯ ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.style.display = 'none';
        dashboard.style.display = 'flex';
        staffEmailSpan.textContent = user.email;
        loadMenu();
        loadOrders();
    } else {
        loginScreen.style.display = 'flex';
        dashboard.style.display = 'none';
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert("Ошибка входа. Проверьте логин и пароль.");
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- 2. НАВИГАЦИЯ ---
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.target}-section`).classList.add('active');
    });
});

// --- 3. УПРАВЛЕНИЕ МЕНЮ ---
async function loadMenu() {
    menuTbody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
    try {
        const snapshot = await getDocs(collection(db, 'products'));
        menuTbody.innerHTML = '';
        snapshot.forEach(document => {
            const product = document.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${product.image}" class="product-thumb"></td>
                <td><strong>${product.name}</strong></td>
                <td>${product.category === 'coffee' ? 'Кофе' : 'Десерт'}</td>
                <td>${product.price} ₸</td>
                <td><button class="btn-danger delete-btn" data-id="${document.id}">Удалить</button></td>
            `;
            menuTbody.appendChild(tr);
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm('Удалить этот товар из меню для всех клиентов?')) {
                    await deleteDoc(doc(db, 'products', e.target.dataset.id));
                    loadMenu(); 
                }
            });
        });
    } catch (error) {
        console.error("Ошибка загрузки меню", error);
    }
}

addProductBtn.addEventListener('click', () => productModal.classList.add('active'));
closeModalBtn.addEventListener('click', () => productModal.classList.remove('active'));

addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newProduct = {
        name: document.getElementById('prod-name').value,
        category: document.getElementById('prod-category').value,
        price: Number(document.getElementById('prod-price').value),
        description: document.getElementById('prod-desc').value,
        image: document.getElementById('prod-image').value
    };

    try {
        await addDoc(collection(db, 'products'), newProduct);
        productModal.classList.remove('active');
        addProductForm.reset();
        loadMenu(); 
    } catch (error) {
        alert("Ошибка при добавлении товара");
        console.error(error);
    }
});

// --- 4. УПРАВЛЕНИЕ ЗАКАЗАМИ ---
async function loadOrders() {
    ordersTbody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
    try {
        // Загружаем заказы, сортируя по дате создания (сначала новые)
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        ordersTbody.innerHTML = '';
        
        if (snapshot.empty) {
            ordersTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Нет заказов</td></tr>';
            return;
        }

        snapshot.forEach(document => {
            const order = document.data();
            const orderId = document.id;
            const tr = document.createElement('tr');
            
            // Форматируем время
            let timeString = 'Нет времени';
            if (order.createdAt) {
                const dateObj = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                timeString = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }

            // Создаем список товаров в заказе
            const itemsList = order.items ? order.items.map(i => `${i.product.name} (x${i.quantity})`).join('<br>') : 'Пусто';
            
            // Текущий статус заказа
            const currentStatus = order.status || 'new';

            tr.innerHTML = `
                <td>
                    <strong>#${orderId.slice(0, 5).toUpperCase()}</strong><br>
                    <small style="color: #888;">${timeString}</small>
                </td>
                <td>
                    ${order.userEmail || 'Гость'}<br>
                    <small style="color: #666;">${itemsList}</small>
                </td>
                <td><strong>${order.total} ₸</strong></td>
                <td>
                    <select class="status-select" data-id="${orderId}" style="padding: 0.3rem; border-radius: 4px;">
                        <option value="new" ${currentStatus === 'new' ? 'selected' : ''}>🔴 Новый</option>
                        <option value="preparing" ${currentStatus === 'preparing' ? 'selected' : ''}>🟡 Готовится</option>
                        <option value="ready" ${currentStatus === 'ready' ? 'selected' : ''}>🟢 Готов к выдаче</option>
                        <option value="completed" ${currentStatus === 'completed' ? 'selected' : ''}>⚪ Выдан</option>
                    </select>
                </td>
                <td><button class="btn-secondary">Детали</button></td>
            `;
            ordersTbody.appendChild(tr);
        });

        // Слушатель для изменения статуса
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const orderId = e.target.dataset.id;
                const newStatus = e.target.value;
                try {
                    await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
                    
                    // Меняем цвет фона селекта для наглядности
                    if(newStatus === 'completed') e.target.style.opacity = '0.5';
                    else e.target.style.opacity = '1';

                } catch (error) {
                    console.error("Ошибка обновления статуса", error);
                    alert("Не удалось обновить статус!");
                }
            });
        });

    } catch (error) {
        console.error("Ошибка загрузки заказов", error);
    }
}

refreshOrdersBtn.addEventListener('click', loadOrders);
