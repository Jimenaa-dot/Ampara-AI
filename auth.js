 document.addEventListener('DOMContentLoaded', () => {
    'use strict';
 

    window.amparaAuth = {
        currentUser: null,
        ready: false
    };

    function emitAuthChange() {
        document.dispatchEvent(new CustomEvent('ampara:auth-changed', {
            detail: { user: window.amparaAuth.currentUser }
        }));
    }

    const authModal = document.getElementById('auth-modal');
    const btnAuth = document.getElementById('btn-auth');
    const btnCloseAuth = document.getElementById('btn-close-auth');
    const linkRegister = document.getElementById('link-register');
    const authForm = document.getElementById('auth-form');
    const authTitle = authModal ? authModal.querySelector('h2') : null;
    const authSubtitle = authModal ? authModal.querySelector('.auth-header p') : null;
    const authSubmitBtn = authForm ? authForm.querySelector('button[type="submit"]') : null;
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
 
    let isRegisterMode = false;
 
    function openAuthModal() {
        if (authModal) authModal.hidden = false;
        setAuthMode(false);
        clearAuthError();
    }
    function closeAuthModal() {
        if (authModal) authModal.hidden = true;
    }
    function setAuthMode(registerMode) {
        isRegisterMode = registerMode;
        if (registerMode) {
            if (authTitle) authTitle.textContent = 'Crea tu cuenta';
            if (authSubtitle) authSubtitle.textContent = 'Tu espacio seguro comienza aquí.';
            if (authSubmitBtn) authSubmitBtn.textContent = 'Registrarse';
            if (linkRegister) linkRegister.textContent = 'Inicia sesión aquí';
        } else {
            if (authTitle) authTitle.textContent = 'Bienvenida de nuevo';
            if (authSubtitle) authSubtitle.textContent = 'Tu espacio seguro te espera.';
            if (authSubmitBtn) authSubmitBtn.textContent = 'Iniciar sesión';
            if (linkRegister) linkRegister.textContent = 'Regístrate aquí';
        }
    }

    function showAuthError(message) {
        let errorEl = document.getElementById('auth-error');
        if (!errorEl && authForm) {
            errorEl = document.createElement('p');
            errorEl.id = 'auth-error';
            errorEl.style.cssText = 'color:#EF4444;font-size:13px;margin-top:-8px;';
            authForm.insertBefore(errorEl, authForm.firstChild);
        }
        if (errorEl) errorEl.textContent = message;
    }
    function clearAuthError() {
        const errorEl = document.getElementById('auth-error');
        if (errorEl) errorEl.textContent = '';
    }
 
    function actualizarBotonAuth() {
        if (!btnAuth) return;
        const span = btnAuth.querySelector('span');
        if (window.amparaAuth.currentUser) {
            if (span) span.textContent = 'Cerrar sesión';
            btnAuth.setAttribute('data-logged-in', 'true');
        } else {
            if (span) span.textContent = 'Iniciar sesión';
            btnAuth.removeAttribute('data-logged-in');
        }
    }

    if (btnAuth) {
        btnAuth.addEventListener('click', () => {
            if (window.amparaAuth.currentUser) {
                cerrarSesion();
            } else {
                openAuthModal();
            }
        });
    }
    if (btnCloseAuth) btnCloseAuth.addEventListener('click', closeAuthModal);
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) closeAuthModal();
        });
    }
    if (linkRegister) {
        linkRegister.addEventListener('click', (e) => {
            e.preventDefault();
            setAuthMode(!isRegisterMode);
            clearAuthError();
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAuthError();
 
            const email = authEmailInput ? authEmailInput.value.trim() : '';
            const password = authPasswordInput ? authPasswordInput.value : '';
 
            if (!email || !password) {
                showAuthError('Por favor, completa todos los campos.');
                return;
            }
            if (password.length < 6) {
                showAuthError('La contraseña debe tener al menos 6 caracteres.');
                return;
            }
 
            if (authSubmitBtn) {
                authSubmitBtn.disabled = true;
                authSubmitBtn.textContent = isRegisterMode ? 'Creando cuenta...' : 'Ingresando...';
            }
 
            try {
                if (isRegisterMode) {
                    const { data, error } = await supabaseClient.auth.signUp({ email, password });
                    if (error) throw error;

                    if (!data.session) {
                        showAuthError('Cuenta creada. Revisa tu correo para confirmar antes de iniciar sesión.');
                        setAuthMode(false);
                        return;
                    }
                } else {
                    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                }
 
                authForm.reset();
                closeAuthModal();

            } catch (err) {
                showAuthError(traducirErrorAuth(err));
            } finally {
                if (authSubmitBtn) {
                    authSubmitBtn.disabled = false;
                    authSubmitBtn.textContent = isRegisterMode ? 'Registrarse' : 'Iniciar sesión';
                }
            }
        });
    }
 
    function traducirErrorAuth(err) {
        const msg = (err && err.message) || '';
        if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
        if (msg.includes('User already registered')) return 'Ya existe una cuenta con este correo. Intenta iniciar sesión.';
        if (msg.includes('Password should be')) return 'La contraseña es muy débil, usa al menos 6 caracteres.';
        return 'Ocurrió un error. Intenta de nuevo en unos segundos.';
    }
 
    async function cerrarSesion() {
        await supabaseClient.auth.signOut();
    }
    window.amparaAuth.cerrarSesion = cerrarSesion;
    window.amparaAuth.abrirModalLogin = openAuthModal;
 
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        window.amparaAuth.currentUser = session ? session.user : null;
        window.amparaAuth.ready = true;
        actualizarBotonAuth();
        emitAuthChange();
    });
 
});