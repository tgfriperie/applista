// Importações do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, deleteDoc, serverTimestamp, writeBatch, orderBy, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBKcDqxoQ9Uz0DcIbIjOS2bDXa9fEttz8M",
    authDomain: "app-lista-f3008.firebaseapp.com",
    projectId: "app-lista-f3008",
    storageBucket: "app-lista-f3008.appspot.com",
    messagingSenderId: "1046811506142",
    appId: "1:1046811506142:web:9e46236913fc7f26aa194f"
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
auth.languageCode = 'pt';

// Variáveis Globais
let currentUser = null;
let currentListId = null;
let unsubscribeFromList = null;
let allUserLists = [];
let gastosMensaisChart = null;
let gastosCategoriaChart = null;
let unsubscribeFromLugares = null;
let currentLugarStatus = "Para Visitar";
let currentLugarCategoria = "Todos";
let allLugarCategorias = [];

// Elementos da UI
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginBtn = document.getElementById('login-btn');
const userInfoDiv = document.getElementById('user-info');
const modal = document.getElementById('confirmation-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const formsSection = document.getElementById('forms-section');
const historyFilters = document.getElementById('history-filters');
const monthFilter = document.getElementById('month-filter');
const tabsContainer = document.getElementById('tabs-container');
const listContainer = document.getElementById('list-container');
const mainTitle = document.getElementById('main-title');
const totalGeralContainer = document.getElementById('total-geral-container');
const orcamentoContainer = document.getElementById('orcamento-container');
const orcamentoValores = document.getElementById('orcamento-valores');
const orcamentoBarra = document.getElementById('orcamento-barra');
const orcamentoInput = document.getElementById('orcamento-input');
const salvarOrcamentoBtn = document.getElementById('salvar-orcamento-btn');
const dashboardView = document.getElementById('dashboard-view');
const listView = document.getElementById('list-view');
const dashboardMonthFilter = document.getElementById('dashboard-month-filter');
const lugaresView = document.getElementById('lugares-view');
const lugaresGrid = document.getElementById('lugares-grid');
const lugaresFiltros = document.getElementById('lugares-filtros');
const abrirModalLugarBtn = document.getElementById('abrir-modal-lugar-btn');
const lugarModal = document.getElementById('lugar-modal');
const lugarForm = document.getElementById('lugar-form');
const cancelarLugarBtn = document.getElementById('cancelar-lugar-btn');
const lugarCategoryFilter = document.getElementById('lugar-category-filter');
const addLugarCategoryForm = document.getElementById('add-lugar-category-form');

// --- LÓGICA DE AUTENTICAÇÃO ---
setPersistence(auth, browserLocalPersistence).then(() => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            loginView.style.display = 'none';
            appView.style.display = 'block';
            userInfoDiv.innerHTML = `<span class="font-semibold truncate">${user.displayName}</span><img src="${user.photoURL}" alt="Foto de perfil" class="w-8 h-8 rounded-full flex-shrink-0"><button id="logout-btn" class="text-sm text-gray-500 hover:text-red-600 transition-colors flex-shrink-0">Sair</button>`;
            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
            
            await setupGlobalDefaultLists();
            initializeAppLogic();
        } else {
            currentUser = null;
            loginView.style.display = 'flex';
            appView.style.display = 'none';
        }
    });
    loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));
});


// --- LÓGICA PRINCIPAL DO APP ---
function initializeAppLogic() {
    cancelDeleteBtn.addEventListener('click', () => modal.style.display = 'none');
    salvarOrcamentoBtn.addEventListener('click', handleSalvarOrcamento);
    abrirModalLugarBtn.addEventListener('click', () => showLugarModal());
    cancelarLugarBtn.addEventListener('click', () => hideLugarModal());
    lugarForm.addEventListener('submit', handleSalvarLugar);
    lugaresFiltros.addEventListener('click', handleFiltroLugar);
    lugarCategoryFilter.addEventListener('change', handleFiltroLugar);
    addLugarCategoryForm.addEventListener('submit', handleAddLugarCategory);

    appView.addEventListener('submit', (e) => {
        e.preventDefault();
        if (e.target.id === 'add-category-form') handleAddCategory(e);
        if (e.target.id === 'add-item-form') handleAddItem(e);
        if (e.target.id === 'create-list-form') handleCreateList(e);
    });

    listenToAllLists();
    listenToLugarCategorias();
}

function listenToAllLists() {
    const q = query(collection(db, "user_lists"), orderBy("criadoEm"));
    onSnapshot(q, (snapshot) => {
        allUserLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderNavigation();
        const firstTabId = 'dashboard';
        if (currentListId && !allUserLists.find(l => l.id === currentListId) && !['dashboard', 'lugares', 'historico'].includes(currentListId)) {
            handleTabClick(firstTabId);
        } else if (!currentListId) {
            handleTabClick(firstTabId);
        }
    });
}

function renderNavigation() {
    tabsContainer.innerHTML = '';
    
    const dashboardTab = document.createElement('button');
    dashboardTab.className = 'tab-btn py-3 px-4 text-center font-semibold rounded-lg transition-colors text-gray-500 flex-shrink-0';
    dashboardTab.dataset.listId = 'dashboard';
    dashboardTab.textContent = 'Dashboard';
    dashboardTab.addEventListener('click', () => handleTabClick('dashboard'));
    tabsContainer.appendChild(dashboardTab);

    const lugaresTab = document.createElement('button');
    lugaresTab.className = 'tab-btn py-3 px-4 text-center font-semibold rounded-lg transition-colors text-gray-500 flex-shrink-0';
    lugaresTab.dataset.listId = 'lugares';
    lugaresTab.textContent = 'Lugares';
    lugaresTab.addEventListener('click', () => handleTabClick('lugares'));
    tabsContainer.appendChild(lugaresTab);

    allUserLists.forEach(list => {
        const tab = document.createElement('button');
        tab.className = 'tab-btn flex items-center gap-2 py-3 px-4 text-center font-semibold rounded-lg transition-colors text-gray-600';
        tab.dataset.listId = list.id;
        tab.innerHTML = `<span>${list.nome}</span>`;

        if (!list.isDefault) {
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'delete-list-btn text-gray-400 hover:text-white';
            deleteBtn.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>`;
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                showConfirmationModal('Apagar Lista', `Você tem certeza que deseja apagar a lista "${list.nome}"?`, () => deleteList(list.id));
            };
            tab.appendChild(deleteBtn);
        }
        
        tab.addEventListener('click', () => handleTabClick(list.id));
        tabsContainer.appendChild(tab);
    });
    
    const createListForm = document.createElement('form');
    createListForm.id = 'create-list-form';
    createListForm.className = 'p-2 flex items-center gap-2 flex-grow';
    createListForm.innerHTML = `
        <input type="text" id="new-list-name" placeholder="Nova lista..." class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
        <button type="submit" class="bg-indigo-600 text-white font-semibold p-2 rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
        </button>
    `;
    tabsContainer.appendChild(createListForm);
    
    const historyTab = document.createElement('button');
    historyTab.className = 'tab-btn py-3 px-4 text-center font-semibold rounded-lg transition-colors text-gray-500 flex-shrink-0';
    historyTab.dataset.listId = 'historico';
    historyTab.textContent = 'Histórico';
    historyTab.addEventListener('click', () => handleTabClick('historico'));
    tabsContainer.appendChild(historyTab);

    updateActiveTabUI();
}

function handleTabClick(listId) {
    if (listId === 'dashboard') loadDashboard();
    else if (listId === 'lugares') loadLugares();
    else if (listId === 'historico') loadHistory();
    else loadList(listId);
}

function updateActiveTabUI() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        const isCurrent = tab.dataset.listId === currentListId;
        tab.classList.toggle('bg-blue-600', isCurrent);
        tab.classList.toggle('text-white', isCurrent);
        tab.classList.toggle('text-gray-600', !isCurrent && !['dashboard', 'lugares', 'historico'].includes(tab.dataset.listId));
        tab.classList.toggle('text-gray-500', !isCurrent && ['dashboard', 'lugares', 'historico'].includes(tab.dataset.listId));
    });
}

async function loadList(listId) {
    listView.style.display = 'block';
    dashboardView.style.display = 'none';
    lugaresView.style.display = 'none';
    
    if (unsubscribeFromList) unsubscribeFromList();
    if (unsubscribeFromLugares) unsubscribeFromLugares();
    currentListId = listId;
    updateActiveTabUI();
    
    listContainer.innerHTML = `<p class="text-gray-500 p-4 text-center">Carregando lista...</p>`;
    const listRef = doc(db, "user_lists", listId);
    unsubscribeFromList = onSnapshot(listRef, (docSnap) => {
        if (docSnap.exists()) {
            mainTitle.textContent = docSnap.data().nome;
            renderListData(docSnap.data());
        }
    });
}

async function loadHistory() {
    listView.style.display = 'block';
    dashboardView.style.display = 'none';
    lugaresView.style.display = 'none';
    
    if (unsubscribeFromList) unsubscribeFromList();
    if (unsubscribeFromLugares) unsubscribeFromLugares();
    currentListId = 'historico';
    updateActiveTabUI();
    mainTitle.textContent = 'Histórico de Compras';
    
    orcamentoContainer.style.display = 'none';
    formsSection.style.display = 'none';
    historyFilters.style.display = 'block';
    totalGeralContainer.style.display = 'none';
    
    listContainer.innerHTML = `<p class="text-gray-500 p-4 text-center">Carregando histórico...</p>`;
    const historyQuery = query(collection(db, "historico"), orderBy("compradoEm", "desc"));
    unsubscribeFromList = onSnapshot(historyQuery, (querySnapshot) => {
        const historyItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderHistoryData(historyItems);
    });
}

// --- LÓGICA DA DASHBOARD ---
async function loadDashboard() {
    if (unsubscribeFromList) unsubscribeFromList();
    if (unsubscribeFromLugares) unsubscribeFromLugares();
    currentListId = 'dashboard';
    mainTitle.textContent = 'Dashboard Financeira';
    
    listView.style.display = 'none';
    dashboardView.style.display = 'block';
    lugaresView.style.display = 'none';
    updateActiveTabUI();

    const historyQuery = query(collection(db, "historico"), orderBy("compradoEm", "asc"));
    const querySnapshot = await getDocs(historyQuery);
    const historyItems = querySnapshot.docs.map(doc => doc.data());

    if (historyItems.length === 0) {
        dashboardView.innerHTML = `<div class="bg-white p-6 rounded-xl shadow-md"><p class="text-gray-500 p-4 text-center">Ainda não há dados no histórico para exibir a dashboard.</p></div>`;
        return;
    }

    renderGastosMensais(historyItems);
    renderGastosPorCategoria(historyItems);
}

function renderGastosMensais(items) {
    const gastosPorMes = items.reduce((acc, item) => {
        const mesAno = item.compradoEm.toDate().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        if (!acc[mesAno]) acc[mesAno] = 0;
        acc[mesAno] += item.preco || 0;
        return acc;
    }, {});

    const labels = Object.keys(gastosPorMes);
    const data = Object.values(gastosPorMes);

    const ctx = document.getElementById('gastos-mensais-chart').getContext('2d');
    if (gastosMensaisChart) gastosMensaisChart.destroy();
    
    gastosMensaisChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Gasto (R$)',
                data: data,
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: { scales: { y: { beginAtZero: true } }, responsive: true, maintainAspectRatio: false }
    });
}

function renderGastosPorCategoria(items) {
    const mesesDisponiveis = [...new Set(items.map(item => item.compradoEm.toDate().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })))];
    
    dashboardMonthFilter.innerHTML = '';
    mesesDisponiveis.forEach(mes => {
        const option = document.createElement('option');
        option.value = mes;
        option.textContent = mes.charAt(0).toUpperCase() + mes.slice(1);
        dashboardMonthFilter.appendChild(option);
    });
    
    const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    dashboardMonthFilter.value = mesesDisponiveis.includes(mesAtual) ? mesAtual : mesesDisponiveis[mesesDisponiveis.length - 1];

    const updateChart = () => {
        const mesSelecionado = dashboardMonthFilter.value;
        const itemsDoMes = items.filter(item => item.compradoEm.toDate().toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) === mesSelecionado);

        const gastosPorCategoria = itemsDoMes.reduce((acc, item) => {
            const categoria = item.categoriaOriginal || 'Outros';
            if (!acc[categoria]) acc[categoria] = 0;
            acc[categoria] += item.preco || 0;
            return acc;
        }, {});

        const labels = Object.keys(gastosPorCategoria);
        const data = Object.values(gastosPorCategoria);

        const ctx = document.getElementById('gastos-categoria-chart').getContext('2d');
        if (gastosCategoriaChart) gastosCategoriaChart.destroy();
        
        gastosCategoriaChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)'],
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    };
    
    dashboardMonthFilter.removeEventListener('change', updateChart);
    dashboardMonthFilter.addEventListener('change', updateChart);
    updateChart();
}

// --- LÓGICA DE LUGARES ---
async function loadLugares() {
    if (unsubscribeFromList) unsubscribeFromList();
    if (unsubscribeFromLugares) unsubscribeFromLugares();
    currentListId = 'lugares';
    mainTitle.textContent = 'Nossos Lugares';
    
    listView.style.display = 'none';
    dashboardView.style.display = 'none';
    lugaresView.style.display = 'block';
    updateActiveTabUI();
    
    let q;
    if (currentLugarCategoria === "Todos") {
        q = query(collection(db, "lugares"), where("status", "==", currentLugarStatus), orderBy("criadoEm", "desc"));
    } else {
        q = query(collection(db, "lugares"), where("status", "==", currentLugarStatus), where("categoria", "==", currentLugarCategoria), orderBy("criadoEm", "desc"));
    }
    
    unsubscribeFromLugares = onSnapshot(q, (snapshot) => {
        const lugares = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderLugaresGrid(lugares);
    }, (error) => {
        console.error("Erro ao buscar lugares: ", error);
        lugaresGrid.innerHTML = `<p class="col-span-3 text-center text-red-500 mt-8">Ocorreu um erro. Pode ser necessário criar um índice no Firestore. Verifique a consola para mais detalhes.</p>`;
    });
}

function renderLugaresGrid(lugares) {
    lugaresGrid.innerHTML = '';
    if (lugares.length === 0) {
        lugaresGrid.innerHTML = `<p class="col-span-3 text-center text-gray-500 mt-8">Nenhum lugar encontrado para os filtros selecionados.</p>`;
        return;
    }

    lugares.forEach(lugar => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-md overflow-hidden';
        
        const mediaAvaliacao = calcularMediaAvaliacoes(lugar.avaliacoes);
        const minhaAvaliacao = lugar.avaliacoes?.find(a => a.uid === currentUser.uid)?.estrelas || 0;

        card.innerHTML = `
            <img class="h-48 w-full object-cover" src="${lugar.fotoURL || 'https://placehold.co/600x400/e2e8f0/64748b?text=Sem+Foto'}" alt="Foto de ${lugar.nome}">
            <div class="p-6">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="uppercase tracking-wide text-sm text-indigo-500 font-semibold">${lugar.categoria}</div>
                        <h3 class="block mt-1 text-lg leading-tight font-medium text-black">${lugar.nome}</h3>
                    </div>
                    <div class="flex items-center text-yellow-400">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                        <span class="ml-1 text-gray-600 font-bold">${mediaAvaliacao.toFixed(1)}</span>
                    </div>
                </div>
                ${lugar.status === 'Já Visitado' ? `
                <div class="mt-4">
                    <p class="text-sm font-semibold text-gray-600 mb-1">Sua avaliação:</p>
                    <div class="star-rating" data-lugar-id="${lugar.id}">
                        ${[5, 4, 3, 2, 1].map(star => `
                            <input type="radio" id="${lugar.id}-${star}-star" name="rating-${lugar.id}" value="${star}" ${minhaAvaliacao === star ? 'checked' : ''}>
                            <label for="${lugar.id}-${star}-star" title="${star} estrelas">&#9733;</label>
                        `).join('')}
                    </div>
                </div>
                ` : `
                <button data-lugar-id="${lugar.id}" class="marcar-visitado-btn mt-4 w-full bg-green-500 text-white font-semibold py-2 rounded-lg hover:bg-green-600">Marcar como Visitado</button>
                `}
                 <button data-lugar-id="${lugar.id}" class="apagar-lugar-btn mt-2 w-full bg-red-100 text-red-600 font-semibold py-2 rounded-lg hover:bg-red-200">Apagar</button>
            </div>
        `;
        lugaresGrid.appendChild(card);
    });

    document.querySelectorAll('.star-rating input').forEach(radio => {
        radio.addEventListener('change', handleAvaliacao);
    });
    document.querySelectorAll('.marcar-visitado-btn').forEach(btn => {
        btn.addEventListener('click', handleMarcarVisitado);
    });
    document.querySelectorAll('.apagar-lugar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const lugarId = e.currentTarget.dataset.lugarId;
            showConfirmationModal("Apagar Lugar", "Tem a certeza que deseja apagar este lugar?", () => deleteDoc(doc(db, "lugares", lugarId)));
        });
    });
}

function showLugarModal(lugar = null) {
    lugarForm.reset();
    document.getElementById('lugar-modal-title').textContent = lugar ? "Editar Lugar" : "Adicionar Novo Lugar";
    document.getElementById('lugar-id').value = lugar ? lugar.id : '';
    
    const categoriaModalSelect = document.getElementById('lugar-categoria-modal');
    categoriaModalSelect.innerHTML = '';
    allLugarCategorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.nome;
        option.textContent = cat.nome;
        categoriaModalSelect.appendChild(option);
    });

    if (lugar) {
        document.getElementById('lugar-nome').value = lugar.nome;
        categoriaModalSelect.value = lugar.categoria;
        document.getElementById('lugar-foto-url').value = lugar.fotoURL || '';
    }
    lugarModal.style.display = 'flex';
}

function hideLugarModal() {
    lugarModal.style.display = 'none';
}

async function handleSalvarLugar(e) {
    e.preventDefault();
    const nome = document.getElementById('lugar-nome').value.trim();
    const categoria = document.getElementById('lugar-categoria-modal').value;
    const fotoURL = document.getElementById('lugar-foto-url').value.trim();
    
    if (!nome || !categoria) {
        alert("Por favor, preencha o nome e a categoria.");
        return;
    }

    const lugarData = {
        nome,
        categoria,
        fotoURL,
        status: "Para Visitar",
        criadoEm: serverTimestamp(),
        avaliacoes: []
    };

    await addDoc(collection(db, "lugares"), lugarData);
    hideLugarModal();
}

function handleFiltroLugar(e) {
    if (e.target.classList.contains('filtro-lugar-btn')) {
        currentLugarStatus = e.target.dataset.status;
        document.querySelectorAll('.filtro-lugar-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-white', 'text-gray-600');
        });
        e.target.classList.add('bg-blue-600', 'text-white');
        e.target.classList.remove('bg-white', 'text-gray-600');
    }
    
    if (e.target.id === 'lugar-category-filter') {
        currentLugarCategoria = e.target.value;
    }

    loadLugares();
}

async function handleAvaliacao(e) {
    const lugarId = e.target.closest('.star-rating').dataset.lugarId;
    const estrelas = parseInt(e.target.value);
    
    const lugarRef = doc(db, "lugares", lugarId);
    const docSnap = await getDoc(lugarRef);

    if (docSnap.exists()) {
        const lugar = docSnap.data();
        const outrasAvaliacoes = lugar.avaliacoes.filter(a => a.uid !== currentUser.uid);
        const novaAvaliacao = { uid: currentUser.uid, estrelas: estrelas };
        
        await updateDoc(lugarRef, {
            avaliacoes: [...outrasAvaliacoes, novaAvaliacao]
        });
    }
}

async function handleMarcarVisitado(e) {
    const lugarId = e.currentTarget.dataset.lugarId;
    const lugarRef = doc(db, "lugares", lugarId);
    await updateDoc(lugarRef, { status: "Já Visitado" });
}

function calcularMediaAvaliacoes(avaliacoes) {
    if (!avaliacoes || avaliacoes.length === 0) return 0;
    const soma = avaliacoes.reduce((acc, curr) => acc + curr.estrelas, 0);
    return soma / avaliacoes.length;
}

function listenToLugarCategorias() {
    const q = query(collection(db, "lugar_categorias"), orderBy("nome"));
    onSnapshot(q, (snapshot) => {
        allLugarCategorias = snapshot.docs.map(doc => doc.data());
        
        lugarCategoryFilter.innerHTML = '<option value="Todos">Todas as Categorias</option>';
        allLugarCategorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.nome;
            option.textContent = cat.nome;
            lugarCategoryFilter.appendChild(option);
        });
    });
}

async function handleAddLugarCategory(e) {
    e.preventDefault();
    const input = document.getElementById('lugar-category-name');
    const nomeCategoria = input.value.trim();
    if (!nomeCategoria) return;

    const q = query(collection(db, "lugar_categorias"), where("nome", "==", nomeCategoria));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        alert("Essa categoria já existe!");
        return;
    }

    await addDoc(collection(db, "lugar_categorias"), {
        nome: nomeCategoria
    });
    input.value = '';
}

// --- Funções de Renderização e CRUD (Restantes) ---
// ... (O resto do seu código, desde renderListData até ao final, permanece o mesmo)
async function setupGlobalDefaultLists() {
    const defaultListsQuery = query(collection(db, "user_lists"), where("isDefault", "==", true));
    const querySnapshot = await getDocs(defaultListsQuery);

    if (querySnapshot.empty) {
        const defaultLists = [
            { id: 'mercado', nome: 'Mercado', categorias: [ { nomeCategoria: "Mercearia", itens: [] }, { nomeCategoria: "Hortifruti", itens: [] }, { nomeCategoria: "Açougue e Frios", itens: [] }, { nomeCategoria: "Produtos de Limpeza", itens: [] }, { nomeCategoria: "Higiene Pessoal", itens: [] } ] },
            { id: 'casa', nome: 'Casa', categorias: [ { nomeCategoria: "Cozinha", itens: [] }, { nomeCategoria: "Quarto", itens: [] }, { nomeCategoria: "Sala", itens: [] }, { nomeCategoria: "Banheiro", itens: [] }, { nomeCategoria: "Escritório", itens: [] } ] },
            { id: 'roupas', nome: 'Roupas', categorias: [ { nomeCategoria: "Giovanna", itens: [] }, { nomeCategoria: "Tales", itens: [] } ] }
        ];

        const batch = writeBatch(db);
        for (const list of defaultLists) {
            const listRef = doc(db, "user_lists", list.id);
            batch.set(listRef, {
                nome: list.nome,
                criadoEm: serverTimestamp(),
                criadoPor: { uid: "system", nome: "Sistema" },
                categorias: list.categorias,
                isDefault: true,
                orcamento: 0
            });
        }
        await batch.commit();
    }
}

async function handleSalvarOrcamento() {
    const novoOrcamento = parseFloat(orcamentoInput.value);
    if (isNaN(novoOrcamento) || novoOrcamento < 0) {
        alert("Por favor, insira um valor de orçamento válido.");
        return;
    }

    const listRef = doc(db, "user_lists", currentListId);
    await updateDoc(listRef, {
        orcamento: novoOrcamento
    });
    
    salvarOrcamentoBtn.textContent = "Salvo!";
    setTimeout(() => {
        salvarOrcamentoBtn.textContent = "Salvar";
    }, 1500);
}

async function handleCreateList(e) {
    const input = document.getElementById('new-list-name');
    const listName = input.value.trim();
    if (!listName) return;

    await addDoc(collection(db, "user_lists"), {
        nome: listName,
        criadoEm: serverTimestamp(),
        criadoPor: { uid: currentUser.uid, nome: currentUser.displayName },
        categorias: [],
        isDefault: false,
        orcamento: 0
    });
    input.value = '';
}

function renderListData(data) {
    orcamentoContainer.style.display = 'block';
    formsSection.style.display = 'block';
    historyFilters.style.display = 'none';
    totalGeralContainer.style.display = 'block';

    const totalGeralValor = document.getElementById('total-geral-valor');
    listContainer.innerHTML = '';
    let totalGeral = 0;
    const categorySelector = document.getElementById('category-selector');
    categorySelector.innerHTML = '';

    (data.categorias || []).forEach((categoria, catIndex) => {
        const option = document.createElement('option');
        option.value = catIndex;
        option.textContent = categoria.nomeCategoria;
        categorySelector.appendChild(option);

        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'mb-6 fade-in';
        const totalCategoria = (categoria.itens || []).reduce((sum, item) => sum + (item.preco || 0), 0);
        totalGeral += totalCategoria;

        categoryDiv.innerHTML = `<div class="flex justify-between items-center border-b-2 pb-2 mb-3"><div class="flex items-center gap-2"><h2 class="text-xl font-bold text-gray-700">${categoria.nomeCategoria}</h2><button class="delete-category-btn text-gray-300 hover:text-red-500" data-cat-index="${catIndex}" title="Apagar categoria"><svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg></button></div><span class="text-lg font-semibold text-blue-600">R$ ${totalCategoria.toFixed(2).replace('.', ',')}</span></div><ul class="space-y-2 item-list" data-cat-index="${catIndex}"></ul>`;
        const itemList = categoryDiv.querySelector('ul');

        (categoria.itens || []).forEach((item, itemIndex) => {
            const li = document.createElement('li');
            li.className = `flex items-center justify-between bg-gray-50 p-3 rounded-lg hover:bg-gray-100`;
            li.dataset.itemIndex = itemIndex;
            li.innerHTML = getItemHtml(item);
            itemList.appendChild(li);
        });
        listContainer.appendChild(categoryDiv);

        new Sortable(itemList, { animation: 150, ghostClass: 'bg-blue-100', onEnd: (evt) => handleReorderItems(evt.from.dataset.catIndex, evt.oldIndex, evt.newIndex) });
    });
    
    totalGeralValor.textContent = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
    
    const orcamento = data.orcamento || 0;
    orcamentoInput.value = orcamento > 0 ? orcamento : '';
    orcamentoValores.textContent = `R$ ${totalGeral.toFixed(2).replace('.', ',')} / R$ ${orcamento.toFixed(2).replace('.', ',')}`;
    
    let percentualGasto = orcamento > 0 ? (totalGeral / orcamento) * 100 : 0;
    
    orcamentoBarra.style.width = `${Math.min(percentualGasto, 100)}%`;
    orcamentoBarra.classList.remove('bg-blue-600', 'bg-yellow-400', 'bg-red-600');
    if (percentualGasto > 100) orcamentoBarra.classList.add('bg-red-600');
    else if (percentualGasto > 75) orcamentoBarra.classList.add('bg-yellow-400');
    else orcamentoBarra.classList.add('bg-blue-600');

    listContainer.removeEventListener('click', handleListClick);
    listContainer.addEventListener('click', handleListClick);
}

function renderHistoryData(historyItems) {
    listContainer.innerHTML = '';
    
    const availableMonths = [...new Set(historyItems.map(item => item.compradoEm.toDate().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })))];
    const currentFilter = monthFilter.value;
    monthFilter.innerHTML = '<option value="all">Todos os Meses</option>';
    availableMonths.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month.charAt(0).toUpperCase() + month.slice(1);
        option.selected = month === currentFilter;
        monthFilter.appendChild(option);
    });
    monthFilter.onchange = () => renderHistoryData(historyItems);

    const filteredItems = currentFilter === 'all' ? historyItems : historyItems.filter(item => item.compradoEm.toDate().toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) === currentFilter);

    if (filteredItems.length === 0) {
        listContainer.innerHTML = `<p class="text-gray-500 p-4 text-center">Nenhum item encontrado para este filtro.</p>`;
        return;
    }

    const groupedByCategory = filteredItems.reduce((acc, item) => {
        const category = item.categoriaOriginal || 'Sem Categoria';
        if (!acc[category]) acc[category] = [];
        acc[category].push(item);
        return acc;
    }, {});

    Object.keys(groupedByCategory).sort().forEach(categoryName => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'mb-6 fade-in';
        const categoryItems = groupedByCategory[categoryName];
        const totalCategoria = categoryItems.reduce((sum, item) => sum + (item.preco || 0), 0);
        categoryDiv.innerHTML = `<div class="flex justify-between items-baseline border-b-2 pb-2 mb-3"><h2 class="text-xl font-bold text-gray-700">${categoryName}</h2><span class="text-lg font-semibold text-green-600">Gasto: R$ ${totalCategoria.toFixed(2).replace('.', ',')}</span></div><ul class="space-y-2"></ul>`;
        const itemList = categoryDiv.querySelector('ul');
        categoryItems.forEach(item => {
            const li = document.createElement('li');
            li.className = `item-comprado flex items-center justify-between bg-gray-100 p-3 rounded-lg`;
            li.dataset.itemId = item.id;
            li.innerHTML = getHistoryItemHtml(item);
            itemList.appendChild(li);
        });
        listContainer.appendChild(categoryDiv);
    });
    listContainer.removeEventListener('click', handleListClick);
    listContainer.addEventListener('click', handleListClick);
}

function getHistoryItemHtml(item) {
    const avatar = item.adicionadoPor?.fotoURL ? `<img src="${item.adicionadoPor.fotoURL}" title="Adicionado por: ${item.adicionadoPor.nome}" class="w-6 h-6 rounded-full">` : `<div class="w-6 h-6 rounded-full bg-gray-300"></div>`;
    const precoFormatado = (item.preco || 0).toFixed(2).replace('.', ',');
    const dataFormatada = item.compradoEm ? item.compradoEm.toDate().toLocaleDateString('pt-BR') : 'Data desconhecida';

    return `
        <div class="flex items-center flex-grow">
            <input type="checkbox" class="item-checkbox h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked>
            <div class="ml-3 flex flex-col">
                <span class="text-lg item-texto">${item.texto}</span>
                <span class="text-sm text-gray-500 item-preco">R$ ${precoFormatado} - Comprado em ${dataFormatada}</span>
            </div>
        </div>
        <div class="flex items-center gap-2">
            ${avatar}
        </div>`;
}

function getItemHtml(item) {
    const avatar = item.adicionadoPor?.fotoURL ? `<img src="${item.adicionadoPor.fotoURL}" title="Adicionado por: ${item.adicionadoPor.nome}" class="w-6 h-6 rounded-full">` : `<div class="w-6 h-6 rounded-full bg-gray-300"></div>`;
    const precoFormatado = (item.preco || 0).toFixed(2).replace('.', ',');
    return `
        <div class="flex items-center flex-grow cursor-pointer">
            <input type="checkbox" class="item-checkbox h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" ${item.comprado ? 'checked' : ''}>
            <div class="ml-3 flex flex-col">
                <span class="text-lg item-texto">${item.texto}</span>
                <span class="text-sm text-gray-500 item-preco">R$ ${precoFormatado}</span>
            </div>
        </div>
        <div class="flex items-center gap-2">
            ${avatar}
            <button class="edit-btn action-btn text-gray-400 hover:text-blue-500 p-1">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
            </button>
            <button class="delete-btn action-btn text-gray-400 hover:text-red-500 p-1">
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
            </button>
        </div>`;
}

function getEditItemHtml(item) {
    return `
        <div class="flex items-center flex-grow gap-2">
            <input type="text" value="${item.texto}" class="edit-text-input flex-grow px-2 py-1 border rounded-md">
            <input type="number" value="${item.preco || 0}" step="0.01" min="0" class="edit-price-input w-24 px-2 py-1 border rounded-md">
        </div>
        <div class="flex items-center">
            <button class="save-btn action-btn text-green-500 hover:text-green-600 p-1" style="opacity:1;">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </button>
        </div>`;
}

async function handleListClick(e) {
    const li = e.target.closest('li');
    if (!li) {
        const catDeleteBtn = e.target.closest('.delete-category-btn');
        if (catDeleteBtn) {
            const catIndex = catDeleteBtn.dataset.catIndex;
            showConfirmationModal('Apagar Categoria', 'Você tem certeza? Todos os itens desta categoria serão perdidos.', () => deleteCategory(catIndex));
        }
        return;
    }

    if (currentListId === 'historico') {
        if (e.target.closest('.item-checkbox')) {
            await unpurchaseItem(li.dataset.itemId);
        }
    } else {
        const { itemIndex } = li.dataset;
        const catIndex = li.parentElement.dataset.catIndex;

        if (e.target.closest('.item-checkbox')) {
            await purchaseItem(catIndex, itemIndex);
        } else if (e.target.closest('.delete-btn')) {
            showConfirmationModal('Apagar Item', 'Você tem certeza que deseja apagar este item?', () => deleteItem(catIndex, itemIndex));
        } else if (e.target.closest('.edit-btn')) {
            const data = allUserLists.find(l => l.id === currentListId);
            li.innerHTML = getEditItemHtml(data.categorias[catIndex].itens[itemIndex]);
        } else if (e.target.closest('.save-btn')) {
            const newText = li.querySelector('.edit-text-input').value.trim();
            const newPrice = parseFloat(li.querySelector('.edit-price-input').value) || 0;
            if (newText) await saveItem(catIndex, itemIndex, newText, newPrice);
        }
    }
}

async function handleAddItem(e) {
    if (!currentUser) return;
    const textInput = document.getElementById('item-text');
    const priceInput = document.getElementById('item-price');
    const texto = textInput.value.trim();
    const preco = parseFloat(priceInput.value) || 0;
    const catIndex = parseInt(document.getElementById('category-selector').value);
    if (!texto || isNaN(catIndex)) return;

    const newItem = { texto, preco, adicionadoPor: { nome: currentUser.displayName, fotoURL: currentUser.photoURL } };
    const listRef = doc(db, "user_lists", currentListId);
    const docSnap = await getDoc(listRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.categorias[catIndex].itens) data.categorias[catIndex].itens = [];
        data.categorias[catIndex].itens.push(newItem);
        await updateDoc(listRef, { categorias: data.categorias });
        textInput.value = '';
        priceInput.value = '';
        textInput.focus();
    }
}

async function handleAddCategory(e) {
    const categoryInput = document.getElementById('category-name');
    const nomeCategoria = categoryInput.value.trim();
    if (!nomeCategoria) return;

    const newCategory = { nomeCategoria, itens: [] };
    const listRef = doc(db, "user_lists", currentListId);
    const docSnap = await getDoc(listRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        data.categorias.push(newCategory);
        await updateDoc(listRef, { categorias: data.categorias });
        categoryInput.value = '';
    }
}

async function purchaseItem(catIndex, itemIndex) {
    const listRef = doc(db, "user_lists", currentListId);
    const docSnap = await getDoc(listRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const itemToMove = data.categorias[catIndex].itens[itemIndex];
    
    const itemForHistory = {
        ...itemToMove,
        compradoEm: Timestamp.fromDate(new Date()),
        listaOriginal: currentListId,
        listaOriginalNome: data.nome,
        categoriaOriginal: data.categorias[catIndex].nomeCategoria
    };

    data.categorias[catIndex].itens.splice(itemIndex, 1);

    const batch = writeBatch(db);
    batch.update(listRef, { categorias: data.categorias });
    batch.set(doc(collection(db, "historico")), itemForHistory);
    await batch.commit();
}

async function unpurchaseItem(itemId) {
    const historyRef = doc(db, "historico", itemId);
    const historySnap = await getDoc(historyRef);
    if (!historySnap.exists()) return;

    const itemToMoveBack = historySnap.data();
    const { listaOriginal, categoriaOriginal } = itemToMoveBack;
    
    delete itemToMoveBack.compradoEm;
    delete itemToMoveBack.listaOriginal;
    delete itemToMoveBack.listaOriginalNome;
    delete itemToMoveBack.categoriaOriginal;
    
    const listRef = doc(db, "user_lists", listaOriginal);
    const listSnap = await getDoc(listRef);
    if (!listSnap.exists()) {
        console.warn("A lista original foi apagada. Não é possível devolver o item.");
        await deleteDoc(historyRef);
        return;
    }

    const listData = listSnap.data();
    let targetCategory = listData.categorias.find(c => c.nomeCategoria === categoriaOriginal);

    if (!targetCategory) {
        targetCategory = { nomeCategoria: categoriaOriginal, itens: [] };
        listData.categorias.push(targetCategory);
    }
    targetCategory.itens.push(itemToMoveBack);

    const batch = writeBatch(db);
    batch.update(listRef, { categorias: listData.categorias });
    batch.delete(historyRef);
    await batch.commit();
}

async function deleteList(listId) {
    await deleteDoc(doc(db, "user_lists", listId));
    modal.style.display = 'none';
}

async function deleteCategory(catIndex) {
    const listRef = doc(db, "user_lists", currentListId);
    const docSnap = await getDoc(listRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        data.categorias.splice(catIndex, 1);
        await updateDoc(listRef, { categorias: data.categorias });
    }
    modal.style.display = 'none';
}

async function deleteItem(catIndex, itemIndex) {
    const listRef = doc(db, "user_lists", currentListId);
    const docSnap = await getDoc(listRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        data.categorias[catIndex].itens.splice(itemIndex, 1);
        await updateDoc(listRef, { categorias: data.categorias });
    }
    modal.style.display = 'none';
}

async function saveItem(catIndex, itemIndex, newText, newPrice) {
    const listRef = doc(db, "user_lists", currentListId);
    const docSnap = await getDoc(listRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        data.categorias[catIndex].itens[itemIndex].texto = newText;
        data.categorias[catIndex].itens[itemIndex].preco = newPrice;
        await updateDoc(listRef, { categorias: data.categorias });
    }
}

async function handleReorderItems(evt) {
    const catIndex = evt.from.dataset.catIndex;
    const oldIndex = evt.oldIndex;
    const newIndex = evt.newIndex;
    
    const listRef = doc(db, "user_lists", currentListId);
    const docSnap = await getDoc(listRef);
    if(docSnap.exists()) {
        const data = docSnap.data();
        const category = data.categorias[catIndex];
        const [movedItem] = category.itens.splice(oldIndex, 1);
        category.itens.splice(newIndex, 0, movedItem);
        await updateDoc(listRef, { categorias: data.categorias });
    }
}

function showConfirmationModal(title, message, onConfirm) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = 'flex';
    confirmDeleteBtn.onclick = onConfirm;
}
