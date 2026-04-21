
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { auth, googleProvider } from '../../firebaseConfig.js';

const toggleBtns = document.querySelectorAll('.toggle-btn');
const adminNote = document.getElementById('admin-note');
const loginForm = document.querySelector('.login-form');
const googleBtn = document.querySelector('.google-btn');
const loginBtn = document.querySelector('.login-btn');

// Initialize user type in localStorage if not set
if (!localStorage.getItem('userType')) {
    localStorage.setItem('userType', 'user');
}

// Set initial toggle state based on localStorage
const initialUserType = localStorage.getItem('userType') || 'user';
toggleBtns.forEach(btn => {
    if (btn.dataset.type === initialUserType) {
        btn.classList.add('active');
        if (btn.dataset.type === 'admin') {
            adminNote.style.display = 'block';
        }
    } else {
        btn.classList.remove('active');
    }
});

// Toggle between user and admin
toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Store user type in localStorage
        localStorage.setItem('userType', btn.dataset.type);
        if (btn.dataset.type === 'admin') {
            adminNote.style.display = 'block';
        } else {
            adminNote.style.display = 'none';
        }
    });
});

// Login with email and password
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const userType = localStorage.getItem('userType') || 'user';

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Redirect based on user type
        if (userType === 'admin') {
            window.location.href = '../panel_administrador/panel_administrador.html';
        } else {
            window.location.href = '../Panel_User/panel_user.html';
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('Error al iniciar sesión: ' + error.message);
    }
});

// Login with Google
googleBtn.addEventListener('click', async () => {
    const userType = localStorage.getItem('userType') || 'user';

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Redirect based on user type
        if (userType === 'admin') {
            window.location.href = '../panel_administrador/panel_administrador.html';
        } else {
            window.location.href = '../Panel_User/panel_user.html';
        }
    } catch (error) {
        console.error('Error during Google login:', error);
        alert('Error al iniciar sesión con Google: ' + error.message);
    }
});

// Check if user is already logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, but don't auto-redirect
        // Let user choose type and login manually
        console.log('User is already signed in:', user.email);
    }
});