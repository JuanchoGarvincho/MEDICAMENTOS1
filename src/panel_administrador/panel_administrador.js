import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, db } from '../../firebaseConfig.js';

// ==================== State Management ====================
let appState = {
    activeTab: 'medications',
    editingMedication: null,
    editingPharmacy: null,
    medications: [],
    pharmacies: [],
    selectedPharmaciesForMed: [], // Farmacias seleccionadas para el medicamento actual
};

// ==================== DOM Elements ====================
const medicationsList = document.getElementById('medicationsList');
const pharmaciesList = document.getElementById('pharmaciesList');
const medicationModal = document.getElementById('medicationModal');
const pharmacyModal = document.getElementById('pharmacyModal');
const toast = document.getElementById('toast');
const addMedicationBtn = document.getElementById('addMedicationBtn');
const addPharmacyBtn = document.getElementById('addPharmacyBtn');
const cancelMedicationBtn = document.getElementById('cancelMedicationBtn');
const cancelPharmacyBtn = document.getElementById('cancelPharmacyBtn');
const saveMedicationBtn = document.getElementById('saveMedicationBtn');
const savePharmacyBtn = document.getElementById('savePharmacyBtn');
const logoutBtn = document.getElementById('logoutBtn');
const usernameSpan = document.getElementById('user-greeting');

// Form inputs - Medications
const medNameInput = document.getElementById('medName');
const medGenericNameInput = document.getElementById('medGenericName');
const medCategoryInput = document.getElementById('medCategory');
const medStockInput = document.getElementById('medStock');
const medicationModalTitle = document.getElementById('medicationModalTitle');
const pharmaciesCheckboxesContainer = document.getElementById('pharmaciesCheckboxes');

// Form inputs - Pharmacies
const pharmNameInput = document.getElementById('pharmName');
const pharmAddressInput = document.getElementById('pharmAddress');
const pharmDistanceInput = document.getElementById('pharmDistance');
const pharmOpenUntilInput = document.getElementById('pharmOpenUntil');
const pharmHasStockInput = document.getElementById('pharmHasStock');
const pharmacyModalTitle = document.getElementById('pharmacyModalTitle');

const medicationsCollection = collection(db, 'medicamentos');
const pharmaciesCollection = collection(db, 'farmacias');
// ==================== Event Listeners ====================
function initializeEventListeners() {
    
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', handleTabChange);
    });

    // Medication modal
    addMedicationBtn.addEventListener('click', openMedicationModal);
    cancelMedicationBtn.addEventListener('click', closeMedicationModal);
    saveMedicationBtn.addEventListener('click', saveMedication);
    medicationModal.addEventListener('click', event => {
        if (event.target === medicationModal) {
            closeMedicationModal();
        }
    });

    // Pharmacy modal
    addPharmacyBtn.addEventListener('click', openPharmacyModal);
    cancelPharmacyBtn.addEventListener('click', closePharmacyModal);
    savePharmacyBtn.addEventListener('click', savePharmacy);
    pharmacyModal.addEventListener('click', event => {
        if (event.target === pharmacyModal) {
            closePharmacyModal();
        }
    });

    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Initial render
    renderMedications();
    renderPharmacies();
}

// ==================== Tab Management ====================
function handleTabChange(e) {
    const tabName = e.currentTarget.dataset.tab;
    appState.activeTab = tabName;

    // Update active tab button
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    e.currentTarget.classList.add('active');

    // Update active content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// ==================== Medication Functions ====================
function openMedicationModal() {
    console.log('openMedicationModal');
    appState.editingMedication = null;
    appState.selectedPharmaciesForMed = [];
    medicationModalTitle.textContent = 'Agregar medicamento';
    saveMedicationBtn.textContent = 'Agregar';
    clearMedicationForm();
    renderPharmaciesCheckboxes();
    medicationModal.classList.add('active');
}

function renderPharmaciesCheckboxes() {
    pharmaciesCheckboxesContainer.innerHTML = '';
    
    if (appState.pharmacies.length === 0) {
        pharmaciesCheckboxesContainer.innerHTML = '<p style="color: var(--muted-foreground); font-size: 0.875rem;">No hay centros disponibles</p>';
        return;
    }

    appState.pharmacies.forEach(pharm => {
        const isChecked = appState.selectedPharmaciesForMed.includes(pharm.id);
        const div = document.createElement('div');
        div.className = 'pharmacy-checkbox-item';
        div.innerHTML = `
            <input 
                type="checkbox" 
                id="pharm_${pharm.id}" 
                value="${pharm.id}"
                ${isChecked ? 'checked' : ''}
                class="pharmacy-checkbox"
            >
            <label for="pharm_${pharm.id}">${escapeHtml(pharm.name)}</label>
        `;
        pharmaciesCheckboxesContainer.appendChild(div);
    });
}

function closeMedicationModal() {
    console.log('closeMedicationModal');
    medicationModal.classList.remove('active');
    clearMedicationForm();
}

function clearMedicationForm() {
    medNameInput.value = '';
    medGenericNameInput.value = '';
    medCategoryInput.value = '';
    medStockInput.value = '';
}

function saveMedication() {
    const name = medNameInput.value.trim();
    const genericName = medGenericNameInput.value.trim();
    const category = medCategoryInput.value.trim();
    const stock = parseInt(medStockInput.value) || 0;
    
    // Obtener farmacias seleccionadas
    const selectedPharmacies = Array.from(document.querySelectorAll('.pharmacy-checkbox:checked'))
        .map(checkbox => checkbox.value);

    if (!name || !genericName || !category) {
        showToast('Por favor completa todos los campos', 'error');
        return;
    }

    console.log('saveMedication start', { name, genericName, category, stock, selectedPharmacies });

    const localMedData = {
        name,
        genericName,
        category,
        stock,
        available: stock > 0,
        pharmacyIds: selectedPharmacies, // Guardar IDs de farmacias
    };

    const firestoreMedData = {
        ...localMedData,
        createdAt: serverTimestamp(),
    };

    if (appState.editingMedication) {
        console.log('Updating existing medication in Firestore');
        const medIndex = appState.medications.findIndex(m => String(m.id) === String(appState.editingMedication.id));
        if (medIndex !== -1) {
            appState.medications[medIndex] = {
                ...appState.medications[medIndex],
                ...localMedData,
            };
            const firestoreId = appState.medications[medIndex].firestoreId;
            if (firestoreId) {
                setDoc(doc(db, 'medicamentos', firestoreId), {
                    ...appState.medications[medIndex],
                    updatedAt: serverTimestamp(),
                }, { merge: true })
                .then(() => {
                    console.log('Medication updated in Firestore', firestoreId);
                    showToast('Medicamento actualizado correctamente', 'success');
                    renderMedications();
                    closeMedicationModal();
                })
                .catch(error => {
                    console.error('Error actualizando medicamento en Firestore:', error);
                    showToast('Error al actualizar medicamento en Firestore', 'error');
                });
                return;
            }
        }
        showToast('Medicamento actualizado correctamente', 'success');
        renderMedications();
        closeMedicationModal();
        return;
    }

    console.log('Adding medication to Firestore collection medicamentos');
    addDoc(medicationsCollection, firestoreMedData)
    .then(docRef => {
        console.log('Added medication doc to Firestore with ID', docRef.id);
        const newMed = {
            id: docRef.id,
            firestoreId: docRef.id,
            ...localMedData,
        };
        appState.medications.push(newMed);
        renderMedications();
        closeMedicationModal();
        showToast('Medicamento agregado correctamente', 'success');
    })
    .catch(error => {
        console.error('Error guardando medicamento en Firestore:', error);
        showToast('Error al guardar medicamento en Firestore', 'error');
    });
}

function editMedication(id) {
    const med = appState.medications.find(m => String(m.id) === String(id));
    if (!med) return;

    appState.editingMedication = med;
    appState.selectedPharmaciesForMed = med.pharmacyIds || [];
    medicationModalTitle.textContent = 'Editar medicamento';
    saveMedicationBtn.textContent = 'Actualizar';
    
    medNameInput.value = med.name;
    medGenericNameInput.value = med.genericName;
    medCategoryInput.value = med.category;
    medStockInput.value = med.stock;

    renderPharmaciesCheckboxes();
    medicationModal.classList.add('active');
}

function deleteMedication(id) {
    if (confirm('¿Estás seguro de eliminar este medicamento?')) {
        const medToDelete = appState.medications.find(m => String(m.id) === String(id));
        const firestoreId = medToDelete?.firestoreId || medToDelete?.id;

        if (firestoreId) {
            deleteDoc(doc(db, 'medicamentos', firestoreId))
                .then(() => {
                    appState.medications = appState.medications.filter(m => String(m.id) !== String(id));
                    renderMedications();
                    showToast('Medicamento eliminado', 'success');
                })
                .catch(error => {
                    console.error('Error eliminando medicamento en Firestore:', error);
                    showToast('Error al eliminar medicamento en Firestore', 'error');
                });
            return;
        }

        appState.medications = appState.medications.filter(m => String(m.id) !== String(id));
        renderMedications();
        showToast('Medicamento eliminado', 'success');
    }
}

function toggleMedicationAvailability(id) {
    const med = appState.medications.find(m => String(m.id) === String(id));
    if (med) {
        med.available = !med.available;
        renderMedications();
    }
}

function renderMedications() {
    medicationsList.innerHTML = '';

    appState.medications.forEach(med => {
        // Obtener nombres de farmacias seleccionadas
        const pharmacyNames = (med.pharmacyIds || [])
            .map(pharmId => {
                const pharm = appState.pharmacies.find(p => p.id == pharmId);
                return pharm ? pharm.name : null;
            })
            .filter(name => name !== null);

        const pharmaciesText = pharmacyNames.length > 0 
            ? `Disponible en: ${pharmacyNames.join(', ')}`
            : 'No asignado a ningún centro';

        const div = document.createElement('div');
        div.className = 'medication-item';
        div.innerHTML = `
            <div class="item-content">
                <div class="item-title">${escapeHtml(med.name)}</div>
                <div class="item-subtitle">${escapeHtml(med.genericName)} • ${escapeHtml(med.category)}</div>
                <div class="item-subtitle">Stock: ${med.stock} unidades</div>
                <div class="item-subtitle" style="color: var(--primary); font-size: 0.75rem; margin-top: 0.5rem;">${escapeHtml(pharmaciesText)}</div>
            </div>
            <div class="item-actions">
                <button class="status-btn ${med.available ? 'status-available' : 'status-unavailable'}" 
                        data-id="${med.id}" 
                        onclick="toggleMedicationAvailability('${med.id}')">
                    ${med.available ? 'Disponible' : 'No disponible'}
                </button>
                <button class="btn btn-icon-only" onclick="editMedication('${med.id}')" title="Editar">
                    ✏️
                </button>
                <button class="btn btn-icon-only btn-danger" onclick="deleteMedication('${med.id}')" title="Eliminar">
                    🗑️
                </button>
            </div>
        `;
        medicationsList.appendChild(div);
    });
}

// ==================== Pharmacy Functions ====================
function openPharmacyModal() {
    appState.editingPharmacy = null;
    pharmacyModalTitle.textContent = 'Agregar centro';
    savePharmacyBtn.textContent = 'Agregar';
    clearPharmacyForm();
    pharmacyModal.classList.add('active');
}

function closePharmacyModal() {
    pharmacyModal.classList.remove('active');
    clearPharmacyForm();
}

function clearPharmacyForm() {
    pharmNameInput.value = '';
    pharmAddressInput.value = '';
    pharmDistanceInput.value = '';
    pharmOpenUntilInput.value = '';
    pharmHasStockInput.checked = true;
}

function savePharmacy() {
    const name = pharmNameInput.value.trim();
    const address = pharmAddressInput.value.trim();
    const distance = parseFloat(pharmDistanceInput.value) || 0;
    const openUntil = pharmOpenUntilInput.value;
    const hasStock = pharmHasStockInput.checked;

    if (!name || !address || !openUntil) {
        showToast('Por favor completa todos los campos', 'error');
        return;
    }

    const pharmacyData = {
        name,
        address,
        distance,
        openUntil,
        hasStock,
        createdAt: serverTimestamp(),
    };

    if (appState.editingPharmacy) {
        // Update existing
        const pharmIndex = appState.pharmacies.findIndex(p => p.id === appState.editingPharmacy.id);
        if (pharmIndex !== -1) {
            appState.pharmacies[pharmIndex] = {
                ...appState.pharmacies[pharmIndex],
                name,
                address,
                distance,
                openUntil,
                hasStock,
            };
            
            // Actualizar en Firestore si existe firestoreId
            const firestoreId = appState.pharmacies[pharmIndex].firestoreId;
            if (firestoreId) {
                setDoc(doc(db, 'farmacias', firestoreId), {
                    ...appState.pharmacies[pharmIndex],
                    updatedAt: serverTimestamp(),
                }, { merge: true })
                .then(() => {
                    showToast('Centro actualizado correctamente', 'success');
                    renderPharmacies();
                    renderMedications();
                    closePharmacyModal();
                })
                .catch(error => {
                    console.error('Error actualizando farmacia en Firestore:', error);
                    showToast('Error al actualizar centro en Firestore', 'error');
                });
            } else {
                showToast('Centro actualizado correctamente', 'success');
                renderPharmacies();
                renderMedications();
                closePharmacyModal();
            }
        }
    } else {
        // Add new - Guardar en Firestore
        addDoc(pharmaciesCollection, pharmacyData)
        .then(docRef => {
            const newPharm = {
                id: docRef.id,
                firestoreId: docRef.id,
                name,
                address,
                distance,
                openUntil,
                hasStock,
            };
            appState.pharmacies.push(newPharm);
            renderPharmacies();
            renderMedications();
            closePharmacyModal();
            showToast('Centro agregado correctamente', 'success');
        })
        .catch(error => {
            console.error('Error guardando farmacia en Firestore:', error);
            showToast('Error al guardar centro en Firestore', 'error');
        });
    }
}

function editPharmacy(id) {
    const pharm = appState.pharmacies.find(p => p.id === id);
    if (!pharm) return;

    appState.editingPharmacy = pharm;
    pharmacyModalTitle.textContent = 'Editar centro';
    savePharmacyBtn.textContent = 'Actualizar';
    
    pharmNameInput.value = pharm.name;
    pharmAddressInput.value = pharm.address;
    pharmDistanceInput.value = pharm.distance;
    pharmOpenUntilInput.value = pharm.openUntil;
    pharmHasStockInput.checked = pharm.hasStock;

    pharmacyModal.classList.add('active');
}

function deletePharmacy(id) {
    if (confirm('¿Estás seguro de eliminar este centro?')) {
        const pharmToDelete = appState.pharmacies.find(p => p.id === id);
        const firestoreId = pharmToDelete?.firestoreId || pharmToDelete?.id;

        if (firestoreId && firestoreId !== id) {
            deleteDoc(doc(db, 'farmacias', firestoreId))
                .then(() => {
                    appState.pharmacies = appState.pharmacies.filter(p => p.id !== id);
                    renderPharmacies();
                    renderMedications();
                    showToast('Centro eliminado', 'success');
                })
                .catch(error => {
                    console.error('Error eliminando farmacia en Firestore:', error);
                    showToast('Error al eliminar centro en Firestore', 'error');
                });
            return;
        }

        appState.pharmacies = appState.pharmacies.filter(p => p.id !== id);
        renderPharmacies();
        renderMedications();
        showToast('Centro eliminado', 'success');
    }
}

function togglePharmacyStock(id) {
    const pharm = appState.pharmacies.find(p => p.id === id);
    if (pharm) {
        pharm.hasStock = !pharm.hasStock;
        renderPharmacies();
    }
}

function renderPharmacies() {
    pharmaciesList.innerHTML = '';

    appState.pharmacies.forEach(pharm => {
        const div = document.createElement('div');
        div.className = 'pharmacy-item';
        div.innerHTML = `
            <div class="item-content">
                <div class="item-title">${escapeHtml(pharm.name)}</div>
                <div class="item-subtitle">${escapeHtml(pharm.address)}</div>
                <div class="item-subtitle">Distancia: ${pharm.distance} km • Abierto hasta ${pharm.openUntil}</div>
            </div>
            <div class="item-actions">
                <button class="status-btn ${pharm.hasStock ? 'status-available' : 'status-unavailable'}" 
                        data-id="${pharm.id}" 
                        onclick="togglePharmacyStock(${pharm.id})">
                    ${pharm.hasStock ? 'Con stock' : 'Sin stock'}
                </button>
                <button class="btn btn-icon-only" onclick="editPharmacy(${pharm.id})" title="Editar">
                    ✏️
                </button>
                <button class="btn btn-icon-only btn-danger" onclick="deletePharmacy(${pharm.id})" title="Eliminar">
                    🗑️
                </button>
            </div>
        `;
        pharmaciesList.appendChild(div);
    });
}

// ==================== Utility Functions ====================
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    // Remove hide animation class if exists
    setTimeout(() => {
        toast.classList.remove('hide');
    }, 10);

    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            toast.classList.remove('show', 'hide', type);
        }, 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function handleLogout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        signOut(auth)
            .then(() => {
                window.location.href = '../login/indexLogin.html';
            })
            .catch((error) => {
                console.error('Error cerrando sesión:', error);
                showToast('Error al cerrar sesión', 'error');
            });
    }
}

function setUsername(username) {
    usernameSpan.textContent = username;
}

async function loadMedicationsFromFirestore() {
    try {
        const snapshot = await getDocs(medicationsCollection);
        appState.medications = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                firestoreId: docSnap.id,
                name: data.name || '',
                genericName: data.genericName || '',
                category: data.category || '',
                stock: data.stock || 0,
                available: typeof data.available === 'boolean' ? data.available : (data.stock || 0) > 0,
                pharmacyIds: data.pharmacyIds || [],
                ...data,
            };
        });
        renderMedications();
    } catch (error) {
        console.error('Error cargando medicamentos desde Firestore:', error);
        showToast('Error al cargar medicamentos desde Firestore', 'error');
    }
}

async function loadPharmaciesFromFirestore() {
    try {
        const snapshot = await getDocs(pharmaciesCollection);
        appState.pharmacies = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                firestoreId: docSnap.id,
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
        // No mostrar error si la colección no existe
    }
}

// ==================== Initialize ====================
document.addEventListener('DOMContentLoaded', async () => {
    initializeEventListeners();
    await loadPharmaciesFromFirestore();
    await loadMedicationsFromFirestore();
    setUsername('Administrador');
});

window.editMedication = editMedication;
window.deleteMedication = deleteMedication;
window.toggleMedicationAvailability = toggleMedicationAvailability;
window.editPharmacy = editPharmacy;
window.deletePharmacy = deletePharmacy;
window.togglePharmacyStock = togglePharmacyStock;
