/* =========================================
   AMPARA AI - LÓGICA DEL SITIO WEB
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // =========================================
    // 1. SALIDA RÁPIDA
    // =========================================
    const btnQuickExit = document.getElementById('btn-quick-exit');
    if (btnQuickExit) {
        btnQuickExit.addEventListener('click', () => {
            // Reemplaza el historial para que el botón "atrás" no vuelva al sitio
            window.location.replace('https://www.google.com');
        });
    }

    // Tecla de escape rápida: presionar ESC tres veces sale del sitio
    let escCount = 0;
    let escTimer = null;
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        escCount++;
        clearTimeout(escTimer);
        escTimer = setTimeout(() => { escCount = 0; }, 1200);
        if (escCount >= 3) {
            window.location.replace('https://www.google.com');
        }
    });

    // =========================================
    // 2. MENÚ MÓVIL
    // =========================================
    const navToggle = document.getElementById('nav-toggle');
    const mainNav = document.getElementById('main-nav');
    if (navToggle && mainNav) {
        navToggle.addEventListener('click', () => {
            const isOpen = mainNav.classList.toggle('open');
            navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // =========================================
    // 3. MODAL DE EMERGENCIA
    // =========================================
    const emergencyModal = document.getElementById('emergency-modal');
    const btnEmergency = document.getElementById('btn-emergency');
    const btnCancelAlert = document.getElementById('btn-cancel-alert');

    function openEmergencyModal() {
        if (emergencyModal) emergencyModal.hidden = false;
    }
    function closeEmergencyModal() {
        if (emergencyModal) emergencyModal.hidden = true;
    }

    if (btnEmergency) btnEmergency.addEventListener('click', openEmergencyModal);
    if (btnCancelAlert) btnCancelAlert.addEventListener('click', closeEmergencyModal);
    if (emergencyModal) {
        emergencyModal.addEventListener('click', (e) => {
            if (e.target === emergencyModal) closeEmergencyModal();
        });
    }

    // =========================================
    // 4. MODAL DE AUTENTICACIÓN (INICIAR SESIÓN / REGISTRO)
    // =========================================
    const authModal = document.getElementById('auth-modal');
    const btnAuth = document.getElementById('btn-auth');
    const btnCloseAuth = document.getElementById('btn-close-auth');
    const linkRegister = document.getElementById('link-register');
    const authForm = document.getElementById('auth-form');
    const authTitle = authModal ? authModal.querySelector('h2') : null;
    const authSubtitle = authModal ? authModal.querySelector('.auth-header p') : null;
    const authSubmitBtn = authForm ? authForm.querySelector('button[type="submit"]') : null;

    let isRegisterMode = false;

    function openAuthModal() {
        if (authModal) authModal.hidden = false;
        // Resetear a modo inicio de sesión por defecto
        setAuthMode(false);
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

    if (btnAuth) btnAuth.addEventListener('click', openAuthModal);
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
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;

            if (!email || !password) {
                alert('Por favor, completa todos los campos.');
                return;
            }

            // Simulación de éxito
            const action = isRegisterMode ? 'Registro' : 'Inicio de sesión';
            console.log(`%c✅ ${action} exitoso para: ${email}`, 'color: #22C55E; font-weight: bold;');
            
            // Cerrar modal y limpiar formulario
            closeAuthModal();
            authForm.reset();
            
            // Mostrar mensaje de éxito (puedes cambiar esto por una redirección real)
            alert(`¡${action} exitoso! Bienvenida, ${email}`);
        });
    }

    // =========================================
    // 5. CHAT SIMULADO
    // =========================================
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('btn-send-chat');
    const chatMessages = document.getElementById('chat-messages');
    const quickRepliesContainer = document.getElementById('quick-replies');

    const aiResponses = [
        "Entiendo. Estoy aquí para escucharte sin juzgarte. ¿Puedes contarme un poco más?",
        "Gracias por confiar en mí. Recuerda que no estás sola. ¿Hay alguien con quien te sientas segura ahora?",
        "Eso suena muy difícil. Tu seguridad es lo más importante. ¿Quieres que busquemos juntas un refugio cerca?",
        "Si en algún momento sientes que estás en peligro, podemos activar una alerta silenciosa.",
        "Válido. Tómate tu tiempo. Respira profundo. Estoy aquí contigo."
    ];

    function addMessage(text, sender) {
        if (!chatMessages) return;
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender === 'user' ? 'message-user' : 'message-ai');

        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
                        now.getMinutes().toString().padStart(2, '0');

        msgDiv.innerHTML = `${text} <span class="time">${timeStr}</span>`;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function simulateAIResponse(userMessage) {
        setTimeout(() => {
            const lowerMsg = userMessage.toLowerCase();
            let responseText;
            if (lowerMsg.includes('segur')) {
                responseText = "Me alegra saber que estás en un lugar seguro. ¿Quieres que te guíe en un ejercicio de respiración?";
            } else if (lowerMsg.includes('ayuda')) {
                responseText = "Entiendo que necesitas ayuda. Puedo mostrarte refugios cercanos o líneas de emergencia. ¿Qué prefieres?";
            } else {
                responseText = aiResponses[Math.floor(Math.random() * aiResponses.length)];
            }
            addMessage(responseText, 'ai');
        }, 1200);
    }

    function handleUserMessage(text) {
        if (!text || !text.trim()) return;
        if (quickRepliesContainer) quickRepliesContainer.style.display = 'none';
        addMessage(text, 'user');
        if (chatInput) chatInput.value = '';
        simulateAIResponse(text);
    }

    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener('click', () => handleUserMessage(chatInput.value));
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleUserMessage(chatInput.value);
        });
    }

    document.querySelectorAll('.quick-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => handleUserMessage(btn.getAttribute('data-reply')));
    });

    // =========================================
    // 6. ANÁLISIS DE EVIDENCIA (demo)
    // =========================================
    const dropzone = document.getElementById('evidence-dropzone');
    const evidenceProgress = document.getElementById('evidence-progress');
    const progressFill = document.getElementById('progress-fill');
    const evidenceResult = document.getElementById('evidence-result');

    if (dropzone) {
        dropzone.addEventListener('click', () => {
            dropzone.hidden = true;
            evidenceProgress.hidden = false;
            requestAnimationFrame(() => { progressFill.style.width = '100%'; });

            setTimeout(() => {
                evidenceProgress.hidden = true;
                evidenceResult.hidden = false;
            }, 1400);
        });
    }

    // =========================================
    // 7. EJERCICIO DE RESPIRACIÓN
    // =========================================
    const breathingCircle = document.getElementById('breathing-circle');
    const breathingText = document.getElementById('breathing-text');
    const btnToggleBreathing = document.getElementById('btn-toggle-breathing');

    let breathingInterval = null;
    let isBreathingActive = false;

    function startBreathingAnimation() {
        if (breathingInterval) clearInterval(breathingInterval);
        let phase = 'inhale';
        let seconds = 4;

        breathingCircle.classList.add('inhale');
        breathingText.textContent = 'Inhala';

        breathingInterval = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                if (phase === 'inhale') {
                    phase = 'hold'; seconds = 4; breathingText.textContent = 'Mantén';
                } else if (phase === 'hold') {
                    phase = 'exhale'; seconds = 4; breathingText.textContent = 'Exhala';
                    breathingCircle.classList.remove('inhale');
                } else {
                    phase = 'inhale'; seconds = 4; breathingText.textContent = 'Inhala';
                    breathingCircle.classList.add('inhale');
                }
            }
        }, 1000);
    }

    function stopBreathingAnimation() {
        clearInterval(breathingInterval);
        breathingInterval = null;
        breathingText.textContent = 'Pausado';
    }

    if (btnToggleBreathing) {
        btnToggleBreathing.addEventListener('click', () => {
            isBreathingActive = !isBreathingActive;
            if (isBreathingActive) {
                startBreathingAnimation();
                btnToggleBreathing.textContent = 'Pausar ejercicio';
            } else {
                stopBreathingAnimation();
                btnToggleBreathing.textContent = 'Continuar ejercicio';
            }
        });
    }

    // =========================================
    // 8. FILTROS DE REFUGIOS
    // =========================================
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });

    console.log('%c🛡️ Ampara AI', 'color: #520A5B; font-size: 20px; font-weight: bold;');
    console.log('%cSitio web iniciado correctamente.', 'color: #6D8A68;');
});