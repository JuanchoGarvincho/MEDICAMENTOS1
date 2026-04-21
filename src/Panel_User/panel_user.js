import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, db } from '../../firebaseConfig.js';

const medicamentosCol = collection(db, 'medicamentos');
const farmaciasCol = collection(db, 'farmacias');
const reservasCol = collection(db, 'reservas');
const notificacionesCol = collection(db, 'notificaciones');

let activeTab = 'search';
let searchQuery = '';
let selectedMedication = null;
let selectedPharmacy = null;
let showReservationModal = false;
let showProfileModal = false;
let showNotificationsPanel = false;
let pendingReservationRef = null;
let currentUser = null;

let profileData = {
    name: 'Usuario',
    email: 'usuario@email.com',
    phone: '',
};

let medications = [];
let pharmacies = [];
let favorites = [];
let reservations = [];
let history = [];
let notifications = [];

// Imagen genérica para farmacias
const GENERIC_PHARMACY_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZTBmMmZlIi8+CiAgPHBhdGggZD0iTTEyIDJMMyA3VjE3QzMgMTguMTA0NiAzLjg5NTQgMTkgNSAxOUgxOUMyMC4xMDQ2IDE5IDIxIDE4LjEwNDYgMjEgMTdWN0wxMiAyWiIgZmlsbD0iIzI1NjNlYiIgZmlsbC1vcGFjaXR5PSIwLjEiIHN0cm9rZT0iIzI1NjNlYiIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPHJlY3QgeD0iOCIgeT0iOS41IiB3aWR0aD0iOCIgaGVpZ2h0PSI0IiBmaWxsPSIjMjU2M2ViIiBmaWxsLW9wYWNpdHk9IjAuMyIvPgo8L3N2Zz4=';

// DOM elements
const userGreeting = document.getElementById('user-greeting');
const notificationsBtn = document.getElementById('notifications-btn');
const unreadCount = document.getElementById('unread-count');
const notificationsPanel = document.getElementById('notifications-panel');
const notificationsList = document.getElementById('notifications-list');
const markAllRead = document.getElementById('mark-all-read');
const profileBtn = document.getElementById('profile-btn');
const logoutBtn = document.getElementById('logout-btn');

const tabSearch = document.getElementById('tab-search');
const tabReservations = document.getElementById('tab-reservations');
const tabHistory = document.getElementById('tab-history');
const reservationsCount = document.getElementById('reservations-count');

const searchTab = document.getElementById('search-tab');
const reservationsTab = document.getElementById('reservations-tab');
const historyTab = document.getElementById('history-tab');

const searchInput = document.getElementById('search-input');
const medicationsCount = document.getElementById('medications-count');
const medicationsList = document.getElementById('medications-list');
const pharmaciesTitle = document.getElementById('pharmacies-title');
const pharmaciesSubtitle = document.getElementById('pharmacies-subtitle');
const pharmaciesContent = document.getElementById('pharmacies-content');

const reservationsContent = document.getElementById('reservations-content');
const historyContent = document.getElementById('history-content');

const reservationModal = document.getElementById('reservation-modal');
const cancelReservation = document.getElementById('cancel-reservation');
const confirmReservation = document.getElementById('confirm-reservation');

const profileModal = document.getElementById('profile-modal');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profilePhone = document.getElementById('profile-phone');
const favoritesCount = document.getElementById('favorites-count');
const cancelProfile = document.getElementById('cancel-profile');
const saveProfile = document.getElementById('save-profile');

const toastContainer = document.getElementById('toast-container');

async function initApp() {
    setupEventListeners();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            profileData.name = user.displayName || user.email?.split('@')[0] || 'Usuario';
            profileData.email = user.email || profileData.email;
            userGreeting.textContent = `Hola, ${profileData.name}`;
        } else {
            currentUser = null;
        }

        await loadFirebaseData();
        renderAll();
    });
}

async function loadFirebaseData() {
    await Promise.all([fetchMedications(), fetchCentros(), fetchReservations(), fetchNotifications()]);
}

async function fetchMedications() {
    const snapshot = await getDocs(medicamentosCol);
    medications = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            name: data.name,
            genericName: data.genericName,
            category: data.category,
            stock: data.stock,
            available: data.stock > 0,
            ...data,
        };
    });
    renderMedications();
}

async function fetchCentros() {
    try {
        const snapshot = await getDocs(farmaciasCol);
        pharmacies = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                name: data.name || '',
                address: data.address || '',
                distance: data.distance || 0,
                openUntil: data.openUntil || '',
                hasStock: typeof data.hasStock === 'boolean' ? data.hasStock : true,
                ...data,
            };
        });
        renderPharmacies();
    } catch (error) {
        console.error('Error cargando farmacias desde Firestore:', error);
        pharmacies = [];
    }
}

async function fetchReservations() {
    const snapshot = await getDocs(query(reservasCol, orderBy('createdAt', 'desc')));
    const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    }));

    reservations = items.filter((item) => item.status === 'pendiente' || item.status === 'active' || item.status === 'seleccionado' || item.status === 'confirmado');
    history = items.filter((item) => item.status === 'cancelled' || item.status === 'completed');

    renderReservations();
    renderHistory();
}

async function fetchNotifications() {
    const snapshot = await getDocs(query(notificacionesCol, orderBy('createdAt', 'desc')));
    notifications = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    }));
    renderNotifications();
}

function setupEventListeners() {
    notificationsBtn.addEventListener('click', toggleNotificationsPanel);
    markAllRead.addEventListener('click', markAllNotificationsAsRead);
    profileBtn.addEventListener('click', () => setShowProfileModal(true));
    logoutBtn.addEventListener('click', handleLogout);

    tabSearch.addEventListener('click', () => setActiveTab('search'));
    tabReservations.addEventListener('click', () => setActiveTab('reservations'));
    tabHistory.addEventListener('click', () => setActiveTab('history'));

    searchInput.addEventListener('input', handleSearch);

    cancelReservation.addEventListener('click', () => setShowReservationModal(false));
    confirmReservation.addEventListener('click', handleConfirmReservation);
    cancelProfile.addEventListener('click', () => setShowProfileModal(false));
    saveProfile.addEventListener('click', handleSaveProfile);

    reservationModal.addEventListener('click', (e) => {
        if (e.target === reservationModal) setShowReservationModal(false);
    });
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) setShowProfileModal(false);
    });

    document.addEventListener('click', (e) => {
        if (!notificationsBtn.contains(e.target) && !notificationsPanel.contains(e.target)) {
            setShowNotificationsPanel(false);
        }
    });
}

function setActiveTab(tab) {
    activeTab = tab;
    renderTabs();
    renderTabContent();
}

function setSelectedMedication(medication) {
    selectedMedication = medication;
    selectedPharmacy = null;
    renderMedications();
    renderPharmacies();
}

function setSelectedPharmacy(pharmacy) {
    selectedPharmacy = pharmacy;
    renderPharmacies();
}

function setShowReservationModal(show) {
    showReservationModal = show;
    renderReservationModal();
}

function setShowProfileModal(show) {
    showProfileModal = show;
    renderProfileModal();
}

function setShowNotificationsPanel(show) {
    showNotificationsPanel = show;
    renderNotificationsPanel();
}

function renderAll() {
    renderNotifications();
    renderTabs();
    renderTabContent();
    renderReservationModal();
    renderProfileModal();
}

function renderNotifications() {
    const unread = notifications.filter((n) => !n.read).length;
    unreadCount.textContent = unread;
    unreadCount.classList.toggle('hidden', unread === 0);
    renderNotificationsList();
}

function renderNotificationsList() {
    notificationsList.innerHTML = '';

    if (notifications.length === 0) {
        notificationsList.innerHTML = '<div class="p-8 text-center text-muted-foreground">No hay notificaciones</div>';
        return;
    }

    notifications.forEach((notification) => {
        const item = document.createElement('div');
        item.className = `notification-item ${!notification.read ? 'unread' : ''}`;
        item.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon ${notification.type || 'info'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${notification.type === 'restock'
                            ? '<path d="M20.5 7.27783L12 12.0001M12 12.0001L3.5 7.27783M12 12.0001L12 21.5001M21 16.5V7.5C21 6.67157 20.3284 6 19.5 6H4.5C3.67157 6 3 6.67157 3 7.5V16.5C3 17.3284 3.67157 18 4.5 18H19.5C20.3284 18 21 17.3284 21 16.5Z"/>'
                            : '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>'}
                    </svg>
                </div>
                <div class="notification-text">
                    <p>${notification.message}</p>
                    <p class="notification-date">${notification.date || ''}</p>
                </div>
            </div>
        `;
        notificationsList.appendChild(item);
    });
}

function renderNotificationsPanel() {
    notificationsPanel.classList.toggle('hidden', !showNotificationsPanel);
}

function renderTabs() {
    tabSearch.classList.toggle('active', activeTab === 'search');
    tabReservations.classList.toggle('active', activeTab === 'reservations');
    tabHistory.classList.toggle('active', activeTab === 'history');

    reservationsCount.textContent = reservations.length;
    reservationsCount.classList.toggle('hidden', reservations.length === 0);
}

function renderTabContent() {
    searchTab.classList.toggle('active', activeTab === 'search');
    reservationsTab.classList.toggle('active', activeTab === 'reservations');
    historyTab.classList.toggle('active', activeTab === 'history');

    if (activeTab === 'search') {
        renderMedications();
        renderPharmacies();
    } else if (activeTab === 'reservations') {
        renderReservations();
    } else if (activeTab === 'history') {
        renderHistory();
    }
}

function renderMedications() {
    const filtered = medications.filter(
        (med) =>
            med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            med.genericName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            med.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    medicationsCount.textContent = `${filtered.length} resultados`;
    medicationsList.innerHTML = '';

    filtered.forEach((medication) => {
        const item = document.createElement('div');
        item.className = `medication-item ${selectedMedication?.id === medication.id ? 'selected' : ''} ${!medication.available ? 'unavailable' : ''}`;

        item.innerHTML = `
            <div class="medication-content">
                <div class="medication-info">
                    <div class="medication-name">
                        ${medication.name}
                        ${selectedMedication?.id === medication.id ? '<svg class="check-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
                    </div>
                    <div class="medication-generic">${medication.genericName}</div>
                    <div class="medication-details">
                        <span class="category-tag">${medication.category}</span>
                        ${medication.available
                            ? `<span class="stock-info">Stock: ${medication.stock} unidades</span>`
                            : '<span class="unavailable-info"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> No disponible</span>'}
                    </div>
                </div>
                <button class="favorite-btn" data-id="${medication.id}">
                    <svg class="favorite-icon ${favorites.includes(medication.id) ? 'favorited' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
            </div>
        `;

        item.addEventListener('click', (e) => {
            if (!e.target.closest('.favorite-btn')) {
                handleMedicationSelect(medication);
            }
        });

        const favoriteBtn = item.querySelector('.favorite-btn');
        favoriteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await handleToggleFavorite(medication.id);
        });

        medicationsList.appendChild(item);
    });
}

function renderPharmacies() {
    pharmaciesTitle.textContent = selectedMedication ? 'Centros de dispensación cercanos' : 'Selecciona un medicamento';
    pharmaciesSubtitle.classList.toggle('hidden', !selectedMedication);
    if (selectedMedication) {
        pharmaciesSubtitle.textContent = `Mostrando disponibilidad para ${selectedMedication.name}`;
    }

    pharmaciesContent.innerHTML = '';

    if (!selectedMedication) {
        pharmaciesContent.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.5 7.27783L12 12.0001M12 12.0001L3.5 7.27783M12 12.0001L12 21.5001M21 16.5V7.5C21 6.67157 20.3284 6 19.5 6H4.5C3.67157 6 3 6.67157 3 7.5V16.5C3 17.3284 3.67157 18 4.5 18H19.5C20.3284 18 21 17.3284 21 16.5Z"/>
                </svg>
                <p>Selecciona un medicamento para ver centros disponibles</p>
            </div>
        `;
        return;
    }

    const availablePharmacies = pharmacies.filter((pharmacy) => {
        return selectedMedication.pharmacyIds && selectedMedication.pharmacyIds.includes(pharmacy.id);
    });

    if (availablePharmacies.length === 0) {
        pharmaciesContent.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.5 7.27783L12 12.0001M12 12.0001L3.5 7.27783M12 12.0001L12 21.5001M21 16.5V7.5C21 6.67157 20.3284 6 19.5 6H4.5C3.67157 6 3 6.67157 3 7.5V16.5C3 17.3284 3.67157 18 4.5 18H19.5C20.3284 18 21 17.3284 21 16.5Z"/>
                </svg>
                <p>No existen centros relacionados para este medicamento.</p>
            </div>
        `;
        return;
    }

    availablePharmacies.forEach((pharmacy) => {
        const item = document.createElement('button');
        item.className = `pharmacy-item ${pharmacy.hasStock ? 'available' : 'unavailable'}`;
        item.disabled = !pharmacy.hasStock;

        item.innerHTML = `
            <div class="pharmacy-content">
                <div class="pharmacy-info">
                    <div class="pharmacy-name">${pharmacy.name}</div>
                    <div class="pharmacy-details">
                        <div class="pharmacy-address">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            ${pharmacy.address}
                        </div>
                        <div class="pharmacy-hours">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12,6 12,12 16,14"></polyline>
                            </svg>
                            Abierto hasta ${pharmacy.openUntil}
                        </div>
                        <span class="pharmacy-distance">• ${pharmacy.distance} km</span>
                    </div>
                </div>
                <div class="pharmacy-status ${pharmacy.hasStock ? 'available' : 'unavailable'}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${pharmacy.hasStock ? '<path d="M20 6L9 17l-5-5"/>' : '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'}
                    </svg>
                </div>
            </div>
        `;

        item.addEventListener('click', async () => await handlePharmacySelect(pharmacy));
        pharmaciesContent.appendChild(item);
    });
}

function renderReservations() {
    reservationsContent.innerHTML = '';

    if (reservations.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <p>No tienes reservas activas</p>
        `;
        const button = document.createElement('button');
        button.className = 'btn-primary';
        button.textContent = 'Buscar medicamentos';
        button.addEventListener('click', () => setActiveTab('search'));
        empty.appendChild(button);
        reservationsContent.appendChild(empty);
        return;
    }

    reservations.forEach((reservation) => {
        const item = document.createElement('div');
        item.className = 'reservation-item';

        const pharmacyImage = reservation.pharmacyImage || GENERIC_PHARMACY_IMAGE;

        item.innerHTML = `
            <div class="reservation-header">
                <img src="${pharmacyImage}" alt="${reservation.pharmacyName || ''}" class="reservation-image">
                <button class="cancel-btn" data-id="${reservation.id}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>
            <div class="reservation-body">
                <div class="reservation-med-info">
                    <div class="reservation-med-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.5 7.27783L12 12.0001M12 12.0001L3.5 7.27783M12 12.0001L12 21.5001M21 16.5V7.5C21 6.67157 20.3284 6 19.5 6H4.5C3.67157 6 3 6.67157 3 7.5V16.5C3 17.3284 3.67157 18 4.5 18H19.5C20.3284 18 21 17.3284 21 16.5Z"/>
                        </svg>
                    </div>
                    <div class="reservation-med-details">
                        <h3>${reservation.medicationName || reservation.medication?.name || ''}</h3>
                        <p>${reservation.medicationGenericName || reservation.medication?.genericName || ''}</p>
                    </div>
                </div>
                <div class="reservation-details">
                    <div class="reservation-address">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <div>
                            <p><strong>${reservation.pharmacyName || reservation.pharmacy?.name || ''}</strong></p>
                            <p>${reservation.pharmacyAddress || reservation.pharmacy?.address || ''}</p>
                        </div>
                    </div>
                    <div class="reservation-date">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        Reservado: ${reservation.date || ''}
                    </div>
                    <div class="reservation-validity">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12,6 12,12 16,14"></polyline>
                        </svg>
                        Válido por 24 horas
                    </div>
                </div>
                <div class="reservation-note">
                    <p>Presenta tu identificación al retirar</p>
                </div>
            </div>
        `;

        const cancelBtn = item.querySelector('.cancel-btn');
        cancelBtn.addEventListener('click', () => handleCancelReservation(reservation.id));

        reservationsContent.appendChild(item);
    });
}

function renderHistory() {
    historyContent.innerHTML = '';

    if (history.length === 0) {
        historyContent.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12,6 12,12 16,14"></polyline>
                </svg>
                <p>No tienes historial de reservas</p>
            </div>
        `;
        return;
    }

    history.forEach((item) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        historyItem.innerHTML = `
            <div class="history-content">
                <div class="history-icon ${item.status}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.5 7.27783L12 12.0001M12 12.0001L3.5 7.27783M12 12.0001L12 21.5001M21 16.5V7.5C21 6.67157 20.3284 6 19.5 6H4.5C3.67157 6 3 6.67157 3 7.5V16.5C3 17.3284 3.67157 18 4.5 18H19.5C20.3284 18 21 17.3284 21 16.5Z"/>
                    </svg>
                </div>
                <div class="history-info">
                    <h3>${item.medicationName || item.medication?.name || ''}</h3>
                    <p>${item.medicationGenericName || item.medication?.genericName || ''} • ${item.pharmacyName || item.pharmacy?.name || ''}</p>
                    <div class="history-meta">
                        <span>${item.date || ''}</span>
                        <span>•</span>
                        <span class="history-status ${item.status}">${item.status === 'completed' ? 'Completado' : item.status === 'cancelled' ? 'Cancelado' : item.status}</span>
                    </div>
                </div>
            </div>
        `;

        historyContent.appendChild(historyItem);
    });
}

function renderReservationModal() {
    reservationModal.classList.toggle('hidden', !showReservationModal);

    if (showReservationModal && selectedMedication && selectedPharmacy) {
        document.getElementById('modal-med-name').textContent = selectedMedication.name;
        document.getElementById('modal-med-details').textContent = `${selectedMedication.genericName} • ${selectedMedication.category}`;
        document.getElementById('modal-pharmacy-image').src = selectedPharmacy.image || GENERIC_PHARMACY_IMAGE;
        document.getElementById('modal-pharmacy-name').textContent = selectedPharmacy.name || '';
        document.getElementById('modal-pharmacy-address').textContent = `${selectedPharmacy.address || ''} • ${selectedPharmacy.distance ?? ''} km`;
    }
}

function renderProfileModal() {
    profileModal.classList.toggle('hidden', !showProfileModal);

    if (showProfileModal) {
        profileName.value = profileData.name;
        profileEmail.value = profileData.email;
        profilePhone.value = profileData.phone;
        favoritesCount.textContent = `${favorites.length > 0 ? `${favorites.length} medicamento${favorites.length > 1 ? 's' : ''}` : 'No tienes'} en favoritos`;
    }
}

async function toggleNotificationsPanel() {
    setShowNotificationsPanel(!showNotificationsPanel);
}

async function markAllNotificationsAsRead() {
    const unreadItems = notifications.filter((n) => !n.read);
    await Promise.all(
        unreadItems.map((notification) =>
            updateDoc(doc(db, 'notificaciones', notification.id), {
                read: true,
            })
        )
    );
    await fetchNotifications();
}

async function handleLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout error', error);
    }
    window.location.href = '../login/indexLogin.html';
}

function handleSearch(e) {
    searchQuery = e.target.value;
    renderMedications();
}

async function handleMedicationSelect(medication) {
    if (!medication.available || medication.stock <= 0) {
        showToast('Este medicamento no está disponible actualmente', 'error');
        return;
    }
    setSelectedMedication(medication);
}

async function handlePharmacySelect(pharmacy) {
    if (!pharmacy.hasStock) {
        showToast('Este centro no tiene stock del medicamento seleccionado', 'error');
        return;
    }

    if (!selectedMedication) {
        showToast('Selecciona primero un medicamento', 'error');
        return;
    }

    const medRef = doc(db, 'medicamentos', selectedMedication.id);
    const remainingStock = Math.max(0, selectedMedication.stock - 1);
    await updateDoc(medRef, {
        stock: remainingStock,
        available: remainingStock > 0,
    });

    pendingReservationRef = await addDoc(reservasCol, {
        userId: currentUser?.uid || 'guest',
        userName: profileData.name,
        userEmail: profileData.email,
        medicationId: selectedMedication.id,
        medicationName: selectedMedication.name,
        medicationGenericName: selectedMedication.genericName,
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        pharmacyAddress: pharmacy.address,
        pharmacyImage: pharmacy.image || GENERIC_PHARMACY_IMAGE,
        pharmacyDistance: pharmacy.distance,
        status: 'seleccionado',
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
    });

    await addNotification({
        userId: currentUser?.uid || 'guest',
        userName: profileData.name,
        medicationId: selectedMedication.id,
        medicationName: selectedMedication.name,
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        message: `El usuario ${profileData.name} inició una reserva provisional de ${selectedMedication.name} en ${pharmacy.name}`,
        type: 'reservation',
    });

    await fetchMedications();
    setSelectedPharmacy(pharmacy);
    setShowReservationModal(true);
    showToast('Reserva provisional creada. Confirma para ponerla en pendiente.', 'success');
}

async function handleConfirmReservation() {
    if (selectedMedication && selectedPharmacy) {
        if (pendingReservationRef) {
            await updateDoc(pendingReservationRef, {
                status: 'pendiente',
                confirmedAt: serverTimestamp(),
            });

            await addNotification({
                userId: currentUser?.uid || 'guest',
                userName: profileData.name,
                medicationId: selectedMedication.id,
                medicationName: selectedMedication.name,
                pharmacyId: selectedPharmacy.id,
                pharmacyName: selectedPharmacy.name,
                message: `Reserva pendiente confirmada para ${selectedMedication.name} en ${selectedPharmacy.name}`,
                type: 'reservation',
            });

            pendingReservationRef = null;
        }

        await fetchReservations();
        await fetchNotifications();

        showToast(`Reserva confirmada: ${selectedMedication.name} en ${selectedPharmacy.name}`, 'success');
        setShowReservationModal(false);
        setSelectedMedication(null);
        setSelectedPharmacy(null);
        setActiveTab('reservations');
    }
}

async function handleCancelReservation(reservationId) {
    if (confirm('¿Estás seguro de cancelar esta reserva?')) {
        const reservationRef = doc(db, 'reservas', reservationId);
        await updateDoc(reservationRef, {
            status: 'cancelled',
            cancelledAt: serverTimestamp(),
        });
        await fetchReservations();
        showToast('Reserva cancelada', 'success');
    }
}

async function handleToggleFavorite(medId) {
    const medication = medications.find((med) => med.id === medId);
    if (!medication) return;

    if (favorites.includes(medId)) {
        favorites = favorites.filter((id) => id !== medId);
        showToast('Removido de favoritos', 'info');
    } else {
        favorites = [...favorites, medId];
        showToast('Agregado a favoritos', 'success');

        await addNotification({
            userId: currentUser?.uid || 'guest',
            userName: profileData.name,
            userEmail: profileData.email,
            medicationId: medId,
            medicationName: medication.name,
            pharmacyId: selectedPharmacy?.id || null,
            pharmacyName: selectedPharmacy?.name || null,
            message: `El usuario ${profileData.name} está interesado en ${medication.name}`,
            type: 'interest',
        });
        await fetchNotifications();
    }

    renderMedications();
    renderProfileModal();
}

async function handleSaveProfile() {
    profileData.name = profileName.value;
    profileData.email = profileEmail.value;
    profileData.phone = profilePhone.value;
    userGreeting.textContent = `Hola, ${profileData.name}`;
    showToast('Perfil actualizado correctamente', 'success');
    setShowProfileModal(false);
}

async function addNotification(notificationData) {
    const newNotification = {
        ...notificationData,
        read: false,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
    };
    await addDoc(notificacionesCol, newNotification);
}

function showToast(message, type = 'info', description = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${icon}</span>
            <div class="toast-text">
                <div class="toast-title">${message}</div>
                ${description ? `<div class="toast-description">${description}</div>` : ''}
            </div>
        </div>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

initApp();
