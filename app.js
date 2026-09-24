/* =========================================
   AMPARA AI - LÓGICA DE LA APLICACIÓN
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // =========================================
    // 1. GESTIÓN DE PANTALLAS (SPA)
    // =========================================
    const screens = document.querySelectorAll('.screen');
    const backButtons = document.querySelectorAll('.back-btn, [data-target]');

    /**
     * Muestra una pantalla específica ocultando las demás.
     * @param {string} screenId - ID de la pantalla a mostrar.
     */
    function showScreen(screenId) {
        screens.forEach(screen => screen.classList.remove('active'));
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            targetScreen.scrollTop = 0;
        }
    }

    // Exponer la función globalmente por si se necesita desde HTML
    window.showScreen = showScreen;

    // Navegación desde botones con data-target
    backButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target') || 'screen-home';
            showScreen(target);
        });
    });

    // Botón Comenzar
    const btnStart = document.getElementById('btn-start');
    if (btnStart) btnStart.addEventListener('click', () => showScreen('screen-home'));

    // Botones del menú principal
    const navMap = {
        'btn-emergency': 'screen-emergency',
        'btn-calm': 'screen-calm',
        'btn-location': 'screen-nearby',
        'btn-chat': 'screen-chat',
        'btn-evidence': 'screen-evidence'
    };

    Object.keys(navMap).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.addEventListener('click', () => showScreen(navMap[btnId]));
    });

    // Botones específicos
    const btnCancelAlert = document.getElementById('btn-cancel-alert');
    if (btnCancelAlert) btnCancelAlert.addEventListener('click', () => showScreen('screen-home'));

    const btnExitSafe = document.getElementById('btn-exit-safe');
    if (btnExitSafe) btnExitSafe.addEventListener('click', () => showScreen('screen-home'));

    // =========================================
    // 2. TOGGLE MODO SEGURO
    // =========================================
    const safeModeToggle = document.getElementById('safe-mode-toggle');
    let isSafeModeOn = false;

    if (safeModeToggle) {
        safeModeToggle.addEventListener('click', () => {
            isSafeModeOn = !isSafeModeOn;

            if (isSafeModeOn) {
                safeModeToggle.classList.remove('off');
                safeModeToggle.innerHTML = '<i class="fas fa-lock"></i> Modo Seguro';
                showScreen('screen-safe-mode');
            } else {
                safeModeToggle.classList.add('off');
                safeModeToggle.innerHTML = '<i class="fas fa-unlock"></i> Modo Seguro';
                showToast('Modo Seguro Desactivado');
            }
        });
    }

    /**
     * Muestra un toast temporal en pantalla.
     * @param {string} message
     */
    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 24px;
            font-size: 14px;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);

        requestAnimationFrame(() => { toast.style.opacity = '1'; });

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // =========================================
    // 3. CHAT SIMULADO
    // =========================================
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('btn-send-chat');
    const chatMessages = document.getElementById('chat-messages');
    const quickRepliesContainer = document.getElementById('quick-replies');

    const aiResponses = [
        "Entiendo. Estoy aquí para escucharte sin juzgarte. ¿Puedes contarme un poco más?",
        "Gracias por confiar en mí. Recuerda que no estás sola. ¿Hay alguien con quien te sientas segura ahora?",
        "Eso suena muy difícil. Tu seguridad es lo más importante. ¿Quieres que busquemos juntas un refugio cerca?",
        "Estoy procesando lo que me dices. Si en algún momento sientes que estás en peligro, podemos activar una alerta silenciosa.",
        "Válido. Tómate tu tiempo. Respira profundo. Estoy aquí contigo."
    ];

    /**
     * Añade un mensaje al chat.
     * @param {string} text
     * @param {'user'|'ai'} sender
     */
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

    /**
     * Simula la respuesta automática de la IA.
     * @param {string} userMessage
     */
    function simulateAIResponse(userMessage) {
        setTimeout(() => {
            let responseText;
            const lowerMsg = userMessage.toLowerCase();

            if (lowerMsg.includes('seguro')) {
                responseText = "Me alegra saber que estás en un lugar seguro. ¿Quieres que te guíe en un ejercicio de respiración para calmar la ansiedad?";
            } else if (lowerMsg.includes('ayuda')) {
                responseText = "Entiendo que necesitas ayuda. Puedo conectarte con una línea de emergencia o mostrarte refugios cercanos. ¿Qué prefieres?";
            } else {
                responseText = aiResponses[Math.floor(Math.random() * aiResponses.length)];
            }
            addMessage(responseText, 'ai');
        }, 1500);
    }

    /**
     * Maneja el envío de un mensaje del usuario.
     * @param {string} text
     */
    function handleUserMessage(text) {
        if (!text || !text.trim()) return;

        if (quickRepliesContainer) quickRepliesContainer.style.display = 'none';

        addMessage(text, 'user');
        if (chatInput) chatInput.value = '';

        simulateAIResponse(text);
    }

    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', () => handleUserMessage(chatInput.value));
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleUserMessage(chatInput.value);
        });
    }

    // Botones de respuesta rápida
    document.querySelectorAll('.quick-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const reply = btn.getAttribute('data-reply');
            handleUserMessage(reply);
        });
    });

    // =========================================
    // 4. ANIMACIÓN DE RESPIRACIÓN
    // =========================================
    const breathingCircle = document.getElementById('breathing-circle');
    const breathingText = document.getElementById('breathing-text');
    const btnPause = document.getElementById('btn-pause');

    let breathingInterval = null;
    let isBreathingActive = true;

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
                    phase = 'hold';
                    seconds = 4;
                    breathingText.textContent = 'Mantén';
                } else if (phase === 'hold') {
                    phase = 'exhale';
                    seconds = 4;
                    breathingText.textContent = 'Exhala';
                    breathingCircle.classList.remove('inhale');
                } else {
                    phase = 'inhale';
                    seconds = 4;
                    breathingText.textContent = 'Inhala';
                    breathingCircle.classList.add('inhale');
                }
            }
        }, 1000);
    }

    // Iniciar animación al entrar a la pantalla de calma
    const btnCalm = document.getElementById('btn-calm');
    if (btnCalm) {
        btnCalm.addEventListener('click', () => {
            setTimeout(() => {
                startBreathingAnimation();
                isBreathingActive = true;
                if (btnPause) btnPause.innerHTML = '<i class="fas fa-pause"></i>';
            }, 300);
        });
    }

    // Pausar / Reanudar
    if (btnPause) {
        btnPause.addEventListener('click', () => {
            if (isBreathingActive) {
                clearInterval(breathingInterval);
                breathingInterval = null;
                isBreathingActive = false;
                btnPause.innerHTML = '<i class="fas fa-play"></i>';
                breathingText.textContent = 'Pausado';
            } else {
                startBreathingAnimation();
                isBreathingActive = true;
                btnPause.innerHTML = '<i class="fas fa-pause"></i>';
            }
        });
    }

    // Detener animación al salir de la pantalla de calma
    document.querySelectorAll('[data-target="screen-home"]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (breathingInterval) {
                clearInterval(breathingInterval);
                breathingInterval = null;
            }
        });
    });

    // =========================================
    // 5. INICIALIZACIÓN
    // =========================================
    showScreen('screen-welcome');
    console.log('%c🛡️ Ampara AI', 'color: #520A5B; font-size: 20px; font-weight: bold;');
    console.log('%cAplicación web iniciada correctamente.', 'color: #6D8A68;');
});