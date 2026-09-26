document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // =========================================
    // 0. ESTADO GLOBAL DE SESIÓN
    // =========================================
    window.amparaAuth = {
        currentUser: null,
        ready: false
    };

    function emitAuthChange() {
        document.dispatchEvent(new CustomEvent('ampara:auth-changed', {
            detail: { user: window.amparaAuth.currentUser }
        }));
    }

    // =========================================
    // 1. REFERENCIAS AL MODAL
    // =========================================
    const authModal = document.getElementById('auth-modal');
    const btnAuth = document.getElementById('btn-auth');
    const btnCloseAuth = document.getElementById('btn-close-auth');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const authPhoneGroup = document.getElementById('auth-phone-group');
    const authPhoneInput = document.getElementById('auth-phone');
    const footerRegistro = document.getElementById('auth-footer-text');
    const footerLogin = document.getElementById('auth-footer-login');
    const linkRegister = document.getElementById('link-register');
    const linkLogin = document.getElementById('link-login');

    let isRegisterMode = false;

    function setAuthMode(registerMode) {
        isRegisterMode = registerMode;
        clearAuthError();

        if (authTitle) authTitle.textContent = registerMode ? 'Crea tu cuenta' : 'Bienvenida de nuevo';
        if (authSubtitle) authSubtitle.textContent = registerMode ? 'Tu espacio seguro comienza aquí.' : 'Tu espacio seguro te espera.';
        if (authSubmitBtn) authSubmitBtn.textContent = registerMode ? 'Registrarme' : 'Iniciar sesión';

        if (authPhoneGroup) authPhoneGroup.hidden = !registerMode;
        if (authPhoneInput) {
            authPhoneInput.required = registerMode;
            if (!registerMode) authPhoneInput.value = '';
        }

        if (footerRegistro) footerRegistro.hidden = registerMode;
        if (footerLogin) footerLogin.hidden = !registerMode;
    }

    function openAuthModal() {
        setAuthMode(false);
        if (authModal) authModal.hidden = false;
    }
    function closeAuthModal() {
        if (authModal) authModal.hidden = true;
        setAuthMode(false);
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

    // Deja solo dígitos y valida un celular peruano (9 dígitos, empieza en 9),
    // aceptando que la persona escriba +51 o espacios.
    function normalizarTelefono(valor) {
        let digitos = String(valor || '').replace(/\D/g, '');
        if (digitos.startsWith('51') && digitos.length === 11) digitos = digitos.slice(2);
        return digitos;
    }
    function telefonoValido(digitos) {
        return /^9\d{8}$/.test(digitos);
    }

    // =========================================
    // 2. BOTÓN DE CABECERA SEGÚN SESIÓN
    // =========================================
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

    // =========================================
    // 3. LISTENERS DEL MODAL
    // =========================================
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
            setAuthMode(true);
        });
    }
    if (linkLogin) {
        linkLogin.addEventListener('click', (e) => {
            e.preventDefault();
            setAuthMode(false);
        });
    }

    // =========================================
    // 4. REGISTRO / INICIO DE SESIÓN
    // =========================================
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAuthError();

            const email = authEmailInput ? authEmailInput.value.trim() : '';
            const password = authPasswordInput ? authPasswordInput.value : '';
            const telefono = normalizarTelefono(authPhoneInput ? authPhoneInput.value : '');

            if (!email || !password) {
                showAuthError('Por favor, completa todos los campos.');
                return;
            }
            if (password.length < 6) {
                showAuthError('La contraseña debe tener al menos 6 caracteres.');
                return;
            }

            const modoAlEnviar = isRegisterMode;
            if (authSubmitBtn) {
                authSubmitBtn.disabled = true;
                authSubmitBtn.textContent = modoAlEnviar ? 'Creando cuenta...' : 'Ingresando...';
            }

            try {
                if (modoAlEnviar) {
                    const { data, error } = await supabaseClient.auth.signUp({
                        email,
                        password,
                        options: { emailRedirectTo: window.location.origin }
                    });
                    if (error) throw error;

                    // Con "Confirm email" activado no hay sesión hasta confirmar
                    if (!data.session) {
                        setAuthMode(false);
                        showAuthError('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.');
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
                    authSubmitBtn.textContent = isRegisterMode ? 'Registrarme' : 'Iniciar sesión';
                }
            }
        });
    }

    function traducirErrorAuth(err) {
        console.error('Error de Supabase Auth:', err);
        const msg = (err && err.message) || '';
        if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
        if (msg.includes('User already registered')) return 'Ya existe una cuenta con este correo. Intenta iniciar sesión.';
        if (msg.includes('Password should be')) return 'La contraseña es muy débil, usa al menos 6 caracteres.';
        if (msg.includes('Email not confirmed')) return 'Debes confirmar tu correo antes de iniciar sesión (revisa tu bandeja).';
        if (msg.toLowerCase().includes('rate limit')) return 'Demasiados intentos seguidos. Espera un minuto e intenta de nuevo.';
        return 'Error: ' + msg;
    }

    // =========================================
    // 5. CERRAR SESIÓN
    // =========================================
    async function cerrarSesion() {
        await supabaseClient.auth.signOut();
    }
    window.amparaAuth.cerrarSesion = cerrarSesion;
    window.amparaAuth.abrirModalLogin = openAuthModal;
    window.amparaAuth.abrirModalRegistro = () => { openAuthModal(); setAuthMode(true); };

    // =========================================
    // 6. CAMBIOS DE SESIÓN
    // =========================================
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        window.amparaAuth.currentUser = session ? session.user : null;
        window.amparaAuth.ready = true;
        actualizarBotonAuth();
        emitAuthChange();
    });
});