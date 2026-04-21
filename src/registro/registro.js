// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import firebaseConfig from '../../firebaseConfig.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registerForm');
    const googleBtn = document.getElementById('googleBtn');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!email) {
            alert('Por favor ingresa tu correo electrónico');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Por favor ingresa un correo válido');
            return;
        }

        if (!password) {
            alert('Por favor ingresa una contraseña');
            return;
        }

        if (password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            alert('Las contraseñas no coinciden');
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            alert('Cuenta creada exitosamente');
            // Redirect to login or dashboard
            // window.location.href = '../login/indexLogin.html';
        } catch (error) {
            console.error('Error creating account:', error);
            alert('Error al crear la cuenta: ' + error.message);
        }
    });

    googleBtn.addEventListener('click', async function() {
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            alert('Registro con Google completado. Bienvenido ' + user.displayName);
            // Redirect
        } catch (error) {
            console.error('Error with Google sign-in:', error);
            alert('Error al registrarse con Google: ' + error.message);
        }
    });
});

