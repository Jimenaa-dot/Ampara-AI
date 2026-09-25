/* =========================================
   AMPARA AI - LÓGICA DEL SITIO WEB
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // =========================================
    // 0. CONFIGURACIÓN
    // =========================================
    // ⚠️ IMPORTANTE: usa /webhook/ (PRODUCCIÓN), no /webhook-test/.
    const AMPARA_CHAT_WEBHOOK_URL = 'https://ncol021.app.n8n.cloud/webhook/ampara-chat';

    const amparaSessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

    // Historial en memoria para enviar contexto al webhook
    const amparaHistory = [];

    // =========================================
    // Helper: limpiar texto de la IA antes de mostrarlo
    // =========================================
    // - Convierte \n literales (backslash + n) y saltos reales en espacios
    // - Convierte **texto** en <strong>texto</strong>
    // - Escapa HTML para evitar inyecciones
    function cleanAIText(rawText) {
        let text = String(rawText || '');

        // 1) Convertir \n literales y saltos reales en espacios (evita el bug del "\n\n")
        text = text.replace(/\\n/g, ' ').replace(/\r\n|\r|\n/g, ' ');

        // 2) Colapsar espacios múltiples que puedan quedar
        text = text.replace(/[ \t]{2,}/g, ' ').trim();

        // 3) Escapar caracteres HTML para seguridad
        text = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 4) Convertir **negritas** en <strong>negritas</strong>
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // 5) Convertir *cursiva* suelta en <em>cursiva</em> (opcional)
        //    Ojo: se hace después de las negritas para no chocar
        text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');

        // 6) Quitar residuos de almohadillas tipo "## Título" al inicio de frase
        text = text.replace(/(^|\s)#{1,6}\s+/g, '$1');

        return text;
    }

    // Limpia el texto ANTES de guardarlo en el historial (para no reenviar \n al webhook)
    function cleanForHistory(rawText) {
        let text = String(rawText || '');
        text = text.replace(/\\n/g, ' ').replace(/\r\n|\r|\n/g, ' ');
        text = text.replace(/\*\*/g, '').replace(/\*/g, '');
        text = text.replace(/[ \t]{2,}/g, ' ').trim();
        return text.slice(0, 500);
    }

    // =========================================
    // 1. SALIDA RÁPIDA
    // =========================================
    const btnQuickExit = document.getElementById('btn-quick-exit');
    if (btnQuickExit) {
        btnQuickExit.addEventListener('click', () => {
            window.location.replace('https://www.google.com');
        });
    }

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
    // 4. MODAL DE AUTENTICACIÓN
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
            const action = isRegisterMode ? 'Registro' : 'Inicio de sesión';
            console.log(`%c✅ ${action} exitoso para: ${email}`, 'color: #22C55E; font-weight: bold;');
            closeAuthModal();
            authForm.reset();
            alert(`¡${action} exitoso! Bienvenida, ${email}`);
        });
    }

    // =========================================
    // 5. CHAT — EMPÁTICO, CONTEXTUAL, HUMANO
    // =========================================
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('btn-send-chat');
    const chatMessages = document.getElementById('chat-messages');
    const quickRepliesContainer = document.getElementById('quick-replies');

    const ACTION_MAP = {
        respirar: { label: '🧘 Ir a "Necesito calma"', target: '#respira' },
        evidencias: { label: '📷 Analizar evidencia', target: '#evidencias' },
        refugios: { label: '🏠 Ver refugios cercanos', target: '#refugios' },
        alerta: { label: '🚨 Activar alerta de emergencia', target: 'emergency' }
    };

    function addMessage(text, sender, suggestedActions) {
        if (!chatMessages) return;
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender === 'user' ? 'message-user' : 'message-ai');

        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
                        now.getMinutes().toString().padStart(2, '0');

        const textNode = document.createElement('span');

        if (sender === 'ai') {
            // Limpiamos el texto de la IA: quita \n literales y convierte **negritas**
            textNode.innerHTML = cleanAIText(text) + ' ';
        } else {
            // Para mensajes del usuario usamos textContent (más seguro, sin HTML)
            textNode.textContent = text + ' ';
        }

        msgDiv.appendChild(textNode);

        const timeSpan = document.createElement('span');
        timeSpan.classList.add('time');
        timeSpan.textContent = timeStr;
        msgDiv.appendChild(timeSpan);

        if (Array.isArray(suggestedActions) && suggestedActions.length) {
            const actionsWrap = document.createElement('div');
            actionsWrap.classList.add('message-actions');

            suggestedActions.forEach((key) => {
                const action = ACTION_MAP[key];
                if (!action) return;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.classList.add('message-action-btn');
                if (key === 'alerta') btn.classList.add('message-action-btn-danger');
                btn.textContent = action.label;
                btn.addEventListener('click', () => {
                    if (action.target === 'emergency') {
                        openEmergencyModal();
                    } else {
                        const section = document.querySelector(action.target);
                        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
                actionsWrap.appendChild(btn);
            });

            if (actionsWrap.children.length) msgDiv.appendChild(actionsWrap);
        }

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // =========================================
    // Fallback LOCAL: solo se usa si el webhook falla.
    // =========================================
    function localFallbackResponse(userMessage) {
        const lower = userMessage.toLowerCase();

        const highRisk = /(me va(n)? a matar|me quiere(n)? matar|tiene(n)? (un )?(arma|cuchillo|pistola)|me est(á|a|án) (golpeando|ahorcando|violando|persiguiendo)|me est(á|a|án) siguiendo|me siguen|siguiéndome|me persiguen|est(á|a|án) afuera de (mi|la) (casa|cuarto)|no puedo salir|auxilio|socorro|ay(ú|u)dame ya|ayuda urgente|peligro ahora)/;
        const digitalHarrassment = /(capturas|amenaza con publicar|sextorsi|me hacke|me escribe por (instagram|whatsapp|facebook|tiktok|wasap)|extorsi|me amenaza por (wasap|whatsapp|instagram|facebook)|me mandó (fotos|mensajes) amenaz|tiene (mis )?fotos|me filma sin permiso|me está extorsionando|difundir (fotos|imágenes|videos))/;
        const domestic = /(mi (esposo|pareja|marido|novio|enamorado|papá|padrastro|hermano|tío|abuelo) me (pega|golpea|empuja|insulta|humilla|amenaza|controla|encierra|persigue)|me revisa el celular|no me deja (salir|trabajar|estudiar)|me quita el dinero|violencia en (mi )?casa|abuso en (mi )?casa|me cela mucho|me prohíbe|me empujó)/;
        const acosoCallejero = /(me sigue(n)? (unos )?hombres|me sigue (un|el) (hombre|tipo|señor)|me acosa en la calle|me silba|me dice cosas por la calle|me persigue en la calle|me mira raro en la calle)/;
        const incomodidad = /(fiesta|reunión|bar|antro|discoteca|me dejaron (mis amigas|mis amigos)|sola en (una|la) fiesta|no conozco a nadie|no sé cómo irme|no me siento cómoda|me da miedo estar aquí)/;
        const mediumRisk = /(me sigue|me persigue|me amenaz|me controla|me revisa|no me deja|me insulta|me grita|me acosa|me molesta|me incómoda|no me siento segura|me da miedo)/;
        const lowRisk = /(incóm|incomod|ansi|triste|nervios|preocupa|no sé qué hacer|me siento mal|estoy cansada|estoy agotada)/;

        if (highRisk.test(lower)) {
            return {
                reply: 'Escúchame: tu seguridad es lo primero. Presiona YA el botón rojo "Necesito ayuda ahora" arriba en la página, y llama al 105 o al 100. Aléjate del lugar o enciérrate donde puedas, y si hay gente cerca, pídeles ayuda. Estoy aquí, no cierres esta conversación.',
                risk_level: 'alto',
                suggested_actions: ['alerta'],
                escalate: true
            };
        }
        if (digitalHarrassment.test(lower)) {
            return {
                reply: 'Gracias por contármelo, no estás sola. Primero: no le respondas nada y no borres los mensajes, porque son tu prueba. Toma capturas de todo (perfil, conversación, número) y guárdalas en la sección Analizar evidencia, que las deja fuera de tu celular por si él tiene acceso. Después bloquealo y repórtalo en la plataforma. Si quieres, seguimos hablando.',
                risk_level: 'medio',
                suggested_actions: ['evidencias'],
                escalate: false
            };
        }
        if (domestic.test(lower)) {
            return {
                reply: 'Lamento mucho que estés pasando esto, y quiero que sepas algo importante: no es tu culpa. Lo que describes es violencia, aunque él te diga que exageras. ¿Hay algún lugar donde puedas estar segura ahora, o alguien de confianza a quien puedas escribirle? Si tienes fotos o mensajes, guárdalos en Analizar evidencia por si los necesitas después. Y si en algún momento sientes peligro, el botón rojo de arriba te conecta al instante. ¿Quieres contarme un poco más?',
                risk_level: 'medio',
                suggested_actions: ['evidencias', 'refugios'],
                escalate: false
            };
        }
        if (acosoCallejero.test(lower)) {
            return {
                reply: 'Comprendo, y es normal sentirte así. Si puedes, camina hacia un lugar con más gente (una tienda, un banco, una farmacia) y quédate ahí un momento. Si tienes a alguien de confianza cerca, llámalo y cuéntale dónde estás. Si sientes que te siguen de verdad, activa la alerta con el botón rojo de arriba para que tu contacto de emergencia reciba tu ubicación. ¿Dónde estás ahora?',
                risk_level: 'medio',
                suggested_actions: ['alerta', 'refugios'],
                escalate: false
            };
        }
        if (incomodidad.test(lower)) {
            return {
                reply: 'Comprendo, no estás sola. ¿Hay algún lugar con más gente o recepción donde puedas estar mientras decides? Si quieres, activamos la Alerta de Ampara para que tu contacto de emergencia venga por ti con tu ubicación. ¿Lo hacemos?',
                risk_level: 'medio',
                suggested_actions: ['alerta'],
                escalate: false
            };
        }
        if (mediumRisk.test(lower)) {
            return {
                reply: 'Gracias por confiarme esto, entiendo que no es fácil. ¿Hay algún lugar donde te sientas más segura ahora mismo? Guarda cualquier mensaje, captura o audio que tengas en Analizar evidencia, y si quieres revisa los refugios y líneas de ayuda cercanas. Si la situación empeora, el botón rojo de arriba activa ayuda de inmediato. ¿Quieres contarme un poco más?',
                risk_level: 'medio',
                suggested_actions: ['evidencias', 'refugios'],
                escalate: false
            };
        }
        if (lowRisk.test(lower)) {
            return {
                reply: 'Tiene sentido sentirte así, y me alegra que me lo cuentes. ¿Quieres contarme un poco más de lo que pasó? Estoy aquí contigo. Si te ayuda, prueba respirar lento unos momentos en la sección Necesito calma.',
                risk_level: 'bajo',
                suggested_actions: ['respirar'],
                escalate: false
            };
        }
        return {
            reply: 'Estoy aquí contigo. ¿Puedes contarme un poco más sobre lo que está pasando?',
            risk_level: 'bajo',
            suggested_actions: [],
            escalate: false
        };
    }

    function showTypingIndicator() {
        if (!chatMessages) return null;
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('message', 'message-ai', 'message-typing');
        typingDiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return typingDiv;
    }

    async function getAIResponse(userMessage) {
        if (AMPARA_CHAT_WEBHOOK_URL) {
            try {
                const res = await fetch(AMPARA_CHAT_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: userMessage,
                        sessionId: amparaSessionId,
                        history: amparaHistory.slice(-8)
                    })
                });
                if (!res.ok) throw new Error('Respuesta no OK del webhook: ' + res.status);
                const data = await res.json();
                if (!data || !data.reply) throw new Error('Respuesta del webhook sin campo "reply"');

                // Guardar turno LIMPIO en el historial local (sin \n ni markdown)
                amparaHistory.push({ role: 'user', content: cleanForHistory(userMessage) });
                amparaHistory.push({ role: 'assistant', content: cleanForHistory(data.reply) });

                return {
                    reply: data.reply,
                    risk_level: data.risk_level || 'bajo',
                    suggested_actions: Array.isArray(data.suggested_actions) ? data.suggested_actions : [],
                    escalate: !!data.escalate
                };
            } catch (err) {
                console.warn('⚠️ No se pudo contactar al webhook de n8n, usando respuesta local:', err);
                return localFallbackResponse(userMessage);
            }
        }
        return localFallbackResponse(userMessage);
    }

    async function simulateAIResponse(userMessage) {
        const typingDiv = showTypingIndicator();
        const minDelay = new Promise(resolve => setTimeout(resolve, 900));
        const [result] = await Promise.all([getAIResponse(userMessage), minDelay]);
        if (typingDiv) typingDiv.remove();

        addMessage(result.reply, 'ai', result.suggested_actions);

        if (result.escalate) {
            openEmergencyModal();
        }
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
    // 8. REFUGIOS: BÚSQUEDA POR CIUDAD + MAPA
    // =========================================
    const cityInput = document.getElementById('city-search-input');
    const btnSearchCity = document.getElementById('btn-search-city');
    const mapPlaceholder = document.getElementById('map-placeholder');
    const mapFrame = document.getElementById('map-frame');
    const mapHint = document.getElementById('map-hint');

    let activeChipQuery = document.querySelector('.chip.active')
        ? document.querySelector('.chip.active').getAttribute('data-query')
        : 'casas de acogida para mujeres';

    function updateMap(city) {
        const cleanCity = (city || '').trim();
        if (!cleanCity) {
            if (mapHint) mapHint.hidden = false;
            return;
        }
        if (mapHint) mapHint.hidden = true;

        const query = `${activeChipQuery} cerca de ${cleanCity}`;
        const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;

        mapFrame.src = src;
        if (mapPlaceholder) mapPlaceholder.hidden = true;
        mapFrame.hidden = false;
    }

    if (btnSearchCity && cityInput) {
        btnSearchCity.addEventListener('click', () => updateMap(cityInput.value));
        cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateMap(cityInput.value);
            }
        });
    }

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeChipQuery = chip.getAttribute('data-query') || activeChipQuery;
            if (cityInput && cityInput.value.trim()) {
                updateMap(cityInput.value);
            }
        });
    });

    console.log('%c🛡️ Ampara AI', 'color: #520A5B; font-size: 20px; font-weight: bold;');
    console.log('%cSitio web iniciado correctamente.', 'color: #6D8A68;');
});