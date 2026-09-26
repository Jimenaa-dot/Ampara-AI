/* =========================================
   AMPARA AI - LÓGICA DEL SITIO WEB
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // =========================================
    // 0. CONFIGURACIÓN
    // =========================================
    const AMPARA_CHAT_WEBHOOK_URL = 'https://ncol021.app.n8n.cloud/webhook/ampara-chat';
    const amparaSessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const amparaHistory = [];

    // =========================================
    // Helpers: limpiar texto de la IA
    // =========================================
    function cleanAIText(rawText) {
        let text = String(rawText || '');
        text = text.replace(/\\n/g, ' ').replace(/\r\n|\r|\n/g, ' ');
        text = text.replace(/[ \t]{2,}/g, ' ').trim();
        text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
        text = text.replace(/(^|\s)#{1,6}\s+/g, '$1');
        return text;
    }

    function cleanForHistory(rawText) {
        let text = String(rawText || '');
        text = text.replace(/\\n/g, ' ').replace(/\r\n|\r|\n/g, ' ');
        text = text.replace(/\*\*/g, '').replace(/\*/g, '');
        text = text.replace(/[ \t]{2,}/g, ' ').trim();
        return text.slice(0, 500);
    }

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
            
            // 💾 Guardar usuario logueado
            localStorage.setItem('ampara_user', email);
            actualizarUIUsuario(email);
            
            closeAuthModal();
            authForm.reset();
            alert(`¡${action} exitoso! Bienvenida, ${email}`);
            
            // Refrescar el panel de ubicaciones seguras si está visible
            if (categoriaActiva === 'seguras') {
                renderSafeLocationsPanel();
            }
        });
    }

    // =========================================
    // 4.1. ESTADO DE USUARIO Y UBICACIONES SEGURAS
    // =========================================
    let currentUser = localStorage.getItem('ampara_user') || null;

    // Actualizar UI cuando se loguea/desloguea
    function actualizarUIUsuario(email) {
        currentUser = email;
        const btnAuth = document.getElementById('btn-auth');
        if (btnAuth && email) {
            btnAuth.innerHTML = `<i class="fas fa-user-circle"></i> <span>${email.split('@')[0]}</span>`;
            btnAuth.title = `Cerrar sesión de ${email}`;
            btnAuth.onclick = (e) => {
                e.preventDefault();
                if (confirm(`¿Cerrar sesión de ${email}?`)) {
                    localStorage.removeItem('ampara_user');
                    currentUser = null;
                    btnAuth.innerHTML = `<i class="fas fa-user-circle"></i> <span>Iniciar sesión</span>`;
                    btnAuth.title = '';
                    btnAuth.onclick = openAuthModal;
                    if (categoriaActiva === 'seguras') renderSafeLocationsPanel();
                }
            };
        }
    }

    // Inicializar UI al cargar (si ya había sesión guardada)
    if (currentUser) actualizarUIUsuario(currentUser);

    // Obtener ubicaciones seguras del usuario actual
    function getSafeLocations() {
        if (!currentUser) return [];
        const key = `ampara_safe_locations_${currentUser}`;
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch {
            return [];
        }
    }

    // Guardar ubicaciones seguras
    function saveSafeLocations(locations) {
        if (!currentUser) return;
        const key = `ampara_safe_locations_${currentUser}`;
        localStorage.setItem(key, JSON.stringify(locations));
    }

    // Geocodificar dirección usando Nominatim (OpenStreetMap, gratis)
    async function geocodeAddress(address) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address + ', Perú')}`;
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error('Error al buscar dirección');
        const data = await res.json();
        if (!data || data.length === 0) throw new Error('Dirección no encontrada');
        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            displayName: data[0].display_name
        };
    }

    // Renderizar panel de ubicaciones seguras
    function renderSafeLocationsPanel() {
        const panel = document.getElementById('safe-locations-panel');
        const prompt = document.getElementById('safe-locations-login-prompt');
        const content = document.getElementById('safe-locations-content');
        if (!panel || !prompt || !content) return;

        panel.hidden = false;

        if (!currentUser) {
            prompt.hidden = false;
            content.hidden = true;
            return;
        }

        prompt.hidden = true;
        content.hidden = false;
        renderSafeLocationsList();
        renderSafeLocationsOnMap();
    }

    // Renderizar lista de ubicaciones guardadas
    function renderSafeLocationsList() {
        const list = document.getElementById('safe-locations-list');
        if (!list) return;

        const locations = getSafeLocations();
        if (locations.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:var(--text-secondary); font-size:14px; padding:20px;">
                Aún no tienes ubicaciones guardadas. ¡Agrega la primera arriba! 💜
            </p>`;
            return;
        }

        list.innerHTML = '';
        locations.forEach((loc, index) => {
            const item = document.createElement('div');
            item.className = 'safe-location-item';
            item.innerHTML = `
                <i class="fas fa-house-chimney-heart"></i>
                <div class="safe-info">
                    <strong>${loc.name}</strong>
                    <span>${loc.address}</span>
                </div>
                <div class="safe-actions">
                    <button class="btn-go" data-index="${index}" title="Cómo llegar">
                        <i class="fas fa-compass"></i>
                    </button>
                    <button class="btn-delete" data-index="${index}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            list.appendChild(item);
        });

        // Botón "Cómo llegar" → Google Maps
        list.querySelectorAll('.btn-go').forEach(btn => {
            btn.onclick = () => {
                const loc = getSafeLocations()[parseInt(btn.dataset.index)];
                if (!loc) return;
                const userLoc = userMarker ? userMarker.getLatLng() : null;
                const origin = userLoc ? `${userLoc.lat},${userLoc.lng}` : '';
                const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${loc.lat},${loc.lng}`;
                window.open(url, '_blank');
            };
        });

        // Botón "Eliminar"
        list.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = () => {
                const index = parseInt(btn.dataset.index);
                const locations = getSafeLocations();
                if (confirm(`¿Eliminar "${locations[index].name}"?`)) {
                    locations.splice(index, 1);
                    saveSafeLocations(locations);
                    renderSafeLocationsList();
                    renderSafeLocationsOnMap();
                }
            };
        });
    }

    // Renderizar marcadores dorados en el mapa
    let safeMarkers = [];
    function renderSafeLocationsOnMap() {
        if (!map) return;
        // Limpiar marcadores anteriores
        safeMarkers.forEach(m => map.removeLayer(m));
        safeMarkers = [];

        const locations = getSafeLocations();
        locations.forEach(loc => {
            const icon = L.divIcon({
                className: '',
                html: '<div class="safe-marker-icon"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 24]
            });
            const marker = L.marker([loc.lat, loc.lng], { icon })
                .addTo(map)
                .bindPopup(`<b>🛡️ ${loc.name}</b><br><small>${loc.address}</small>`);
            safeMarkers.push(marker);
        });
    }

    // Formulario para agregar ubicación segura
    const safeForm = document.getElementById('safe-location-form');
    if (safeForm) {
        safeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('safe-name');
            const addressInput = document.getElementById('safe-address');
            const status = document.getElementById('safe-form-status');
            const name = nameInput.value.trim();
            const address = addressInput.value.trim();

            if (!name || !address) return;
            if (!currentUser) {
                status.textContent = '❌ Debes iniciar sesión primero';
                status.className = 'form-hint error';
                return;
            }

            status.textContent = '🔍 Buscando dirección...';
            status.className = 'form-hint';

            try {
                const geo = await geocodeAddress(address);
                const locations = getSafeLocations();
                locations.push({
                    name,
                    address: geo.displayName || address,
                    lat: geo.lat,
                    lng: geo.lng,
                    createdAt: Date.now()
                });
                saveSafeLocations(locations);

                status.textContent = '✅ Ubicación guardada';
                status.className = 'form-hint success';

                nameInput.value = '';
                addressInput.value = '';

                renderSafeLocationsList();
                renderSafeLocationsOnMap();

                setTimeout(() => { status.textContent = ''; }, 2500);
            } catch (err) {
                status.textContent = `❌ ${err.message}. Intenta con más detalle (distrito incluido).`;
                status.className = 'form-hint error';
            }
        });
    }

    // Botón "Iniciar sesión" del panel de ubicaciones seguras
    const btnLoginFromSafe = document.getElementById('btn-login-from-safe');
    if (btnLoginFromSafe) {
        btnLoginFromSafe.addEventListener('click', openAuthModal);
    }


    // =========================================
    // 5. CHAT — EMPÁTICO CON N8N
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
            textNode.innerHTML = cleanAIText(text) + ' ';
        } else {
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

    // Fallback local si el webhook falla
    function localFallbackResponse(userMessage) {
        const lower = userMessage.toLowerCase();
        const highRisk = /(me va(n)? a matar|me quiere(n)? matar|tiene(n)? (un )?(arma|cuchillo|pistola)|me est(á|a|án) (golpeando|ahorcando|violando|persiguiendo)|me est(á|a|án) siguiendo|me siguen|siguiéndome|me persiguen|est(á|a|án) afuera de (mi|la) (casa|cuarto)|no puedo salir|auxilio|socorro|ay(ú|u)dame ya|ayuda urgente|peligro ahora)/;
        const digitalHarrassment = /(capturas|amenaza con publicar|sextorsi|me hacke|me escribe por (instagram|whatsapp|facebook|tiktok|wasap)|extorsi|me amenaza por (wasap|whatsapp|instagram|facebook)|me mandó (fotos|mensajes) amenaz|tiene (mis )?fotos|me filma sin permiso|me está extorsionando|difundir (fotos|imágenes|videos))/;
        const domestic = /(mi (esposo|pareja|marido|novio|enamorado|papá|padrastro|hermano|tío|abuelo) me (pega|golpea|empuja|insulta|insultó|humilla|humilló|amenaza|amenazó|controla|encierra|persigue|grita|gritó)|me revisa el celular|no me deja (salir|trabajar|estudiar)|me quita el dinero|violencia en (mi )?casa|abuso en (mi )?casa|me cela mucho|me prohíbe|me empujó|tuvimos una discusi[oó]n|discutimos y me (grit[oó]|insult[oó])|me (grit[oó]|insult[oó]) (mi|el|la))/;
        const acosoCallejero = /(me sigue(n)? (unos )?hombres|me sigue (un|el) (hombre|tipo|señor)|me acosa en la calle|me silba|me dice cosas por la calle|me persigue en la calle|me mira raro en la calle)/;
        const incomodidad = /(fiesta|reunión|bar|antro|discoteca|me dejaron (mis amigas|mis amigos)|sola en (una|la) fiesta|no conozco a nadie|no sé cómo irme|no me siento cómoda|me da miedo estar aquí)/;
        const mediumRisk = /(me sigue|me persigue|me amenaz|me controla|me revisa|no me deja|me insult|me grit|me acosa|me molesta|me incómoda|no me siento segura|me da miedo|discusi[oó]n)/;
        const lowRisk = /(incóm|incomod|ansi|triste|nervios|preocupa|no sé qué hacer|me siento mal|estoy cansada|estoy agotada)/;

        if (highRisk.test(lower)) {
            return { reply: 'Escúchame: tu seguridad es lo primero. Presiona YA el botón rojo "Necesito ayuda ahora" arriba en la página, y llama al 105 o al 100. Aléjate del lugar o enciérrate donde puedas, y si hay gente cerca, pídeles ayuda. Estoy aquí, no cierres esta conversación.', risk_level: 'alto', suggested_actions: ['alerta'], escalate: true };
        }
        if (digitalHarrassment.test(lower)) {
            return { reply: 'Gracias por contármelo, no estás sola. Primero: no le respondas nada y no borres los mensajes, porque son tu prueba. Toma capturas de todo (perfil, conversación, número) y guárdalas en la sección Analizar evidencia, que las deja fuera de tu celular por si él tiene acceso. Después bloquealo y repórtalo en la plataforma. Si quieres, seguimos hablando.', risk_level: 'medio', suggested_actions: ['evidencias'], escalate: false };
        }
        if (domestic.test(lower)) {
            return { reply: 'Lamento mucho que estés pasando esto, y quiero que sepas algo importante: no es tu culpa. Lo que describes es violencia, aunque él te diga que exageras. ¿Hay algún lugar donde puedas estar segura ahora, o alguien de confianza a quien puedas escribirle? Si tienes fotos o mensajes, guárdalos en Analizar evidencia por si los necesitas después. Y si en algún momento sientes peligro, el botón rojo de arriba te conecta al instante. ¿Quieres contarme un poco más?', risk_level: 'medio', suggested_actions: ['evidencias', 'refugios'], escalate: false };
        }
        if (acosoCallejero.test(lower)) {
            return { reply: 'Comprendo, y es normal sentirte así. Si puedes, camina hacia un lugar con más gente (una tienda, un banco, una farmacia) y quédate ahí un momento. Si tienes a alguien de confianza cerca, llámalo y cuéntale dónde estás. Si sientes que te siguen de verdad, activa la alerta con el botón rojo de arriba para que tu contacto de emergencia reciba tu ubicación. ¿Dónde estás ahora?', risk_level: 'medio', suggested_actions: ['alerta', 'refugios'], escalate: false };
        }
        if (incomodidad.test(lower)) {
            return { reply: 'Comprendo, no estás sola. ¿Hay algún lugar con más gente o recepción donde puedas estar mientras decides? Si quieres, activamos la Alerta de Ampara para que tu contacto de emergencia venga por ti con tu ubicación. ¿Lo hacemos?', risk_level: 'medio', suggested_actions: ['alerta'], escalate: false };
        }
        if (mediumRisk.test(lower)) {
            return { reply: 'Gracias por confiarme esto, entiendo que no es fácil. ¿Hay algún lugar donde te sientas más segura ahora mismo? Guarda cualquier mensaje, captura o audio que tengas en Analizar evidencia, y si quieres revisa los refugios y líneas de ayuda cercanas. Si la situación empeora, el botón rojo de arriba activa ayuda de inmediato. ¿Quieres contarme un poco más?', risk_level: 'medio', suggested_actions: ['evidencias', 'refugios'], escalate: false };
        }
        if (lowRisk.test(lower)) {
            return { reply: 'Tiene sentido sentirte así, y me alegra que me lo cuentes. ¿Quieres contarme un poco más de lo que pasó? Estoy aquí contigo. Si te ayuda, prueba respirar lento unos momentos en la sección Necesito calma.', risk_level: 'bajo', suggested_actions: ['respirar'], escalate: false };
        }
        return { reply: 'Estoy aquí contigo. ¿Puedes contarme un poco más sobre lo que está pasando?', risk_level: 'bajo', suggested_actions: [], escalate: false };
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
                if (!res.ok) {
                    const bodyText = await res.text().catch(() => '(sin cuerpo)');
                    throw new Error(`Respuesta no OK del webhook: ${res.status} — ${bodyText}`);
                }
                const data = await res.json();
                if (!data || !data.reply) {
                    console.error('⚠️ El webhook respondió pero sin campo "reply". Payload recibido:', data);
                    throw new Error('Respuesta del webhook sin campo "reply"');
                }
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
    // 8. GEOLOCALIZACIÓN, MAPA Y RENDERIZADO
    // =========================================
    let map;
    let userMarker;
    let shelterMarkers = [];
    const mapStatus = document.getElementById('map-status');

    function renderizarTarjetas() {
        const placesList = document.getElementById('places-list');
        if (!placesList || typeof lugares === 'undefined') return;

        placesList.innerHTML = '';

        lugares.forEach(lugar => {
            const card = document.createElement('div');
            card.className = 'card place-card';
            card.setAttribute('data-category', lugar.categoria);
            if (lugar.lat && lugar.lng) {
                card.setAttribute('data-lat', lugar.lat);
                card.setAttribute('data-lng', lugar.lng);
            }

            const distanciaTexto = (lugar.lat && lugar.lng) ? 'Calculando...' : 'Nacional · 24h';
            const botonRuta = (lugar.lat && lugar.lng)
                ? `<button class="btn-route"><i class="fas fa-compass"></i> Cómo llegar</button>`
                : '';

            card.innerHTML = `
                <div class="place-header">
                    <div class="place-title">${lugar.nombre}</div>
                    <div class="place-distance">${distanciaTexto}</div>
                </div>
                <div class="place-desc">${lugar.desc}</div>
                <div class="place-actions">
                    <button class="btn-call" onclick="window.location.href='tel:${lugar.telefono}'">
                        <i class="fas fa-phone"></i> Llamar
                    </button>
                    ${botonRuta}
                </div>
            `;
            placesList.appendChild(card);
        });
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    function initMap(userLat, userLng) {
        if (map) return;
        map = L.map('map').setView([userLat, userLng], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        userMarker = L.circleMarker([userLat, userLng], {
            color: '#520A5B', fillColor: '#520A5B', fillOpacity: 0.5, radius: 8
        }).addTo(map).bindPopup('Tu ubicación actual').openPopup();
    }

    function updateShelterUI(userLat, userLng, isFallback = false) {
        if (mapStatus) {
            mapStatus.textContent = isFallback
                ? 'Usando ubicación aproximada (Lima, Perú)'
                : '📍 Ubicación detectada. Mostrando refugios cercanos.';
        }

        initMap(userLat, userLng);

        shelterMarkers.forEach(marker => map.removeLayer(marker));
        shelterMarkers = [];

        let closestDistance = Infinity;
        let closestCard = null;
        const shelterCards = document.querySelectorAll('.place-card[data-lat]');

        shelterCards.forEach(card => {
            const lat = parseFloat(card.getAttribute('data-lat'));
            const lng = parseFloat(card.getAttribute('data-lng'));
            const distanceEl = card.querySelector('.place-distance');
            const routeBtn = card.querySelector('.btn-route');

            if (distanceEl && !isNaN(lat) && !isNaN(lng)) {
                const dist = calculateDistance(userLat, userLng, lat, lng);
                distanceEl.textContent = `A ${dist.toFixed(1)} km`;

                const marker = L.marker([lat, lng]).addTo(map)
                    .bindPopup(`<b>${card.querySelector('.place-title').textContent}</b><br>${card.querySelector('.place-desc').textContent}`);
                shelterMarkers.push(marker);

                if (routeBtn) {
                    routeBtn.onclick = (e) => {
                        e.preventDefault();
                        const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${lat},${lng}`;
                        window.open(url, '_blank');
                    };
                }

                if (dist < closestDistance) {
                    closestDistance = dist;
                    closestCard = card;
                }
            }
        });

        const placesList = document.getElementById('places-list');
        const allCards = Array.from(document.querySelectorAll('.place-card'));
        const sortedCards = allCards.sort((a, b) => {
            const distA = parseFloat(a.querySelector('.place-distance').textContent.replace('A ', '')) || 9999;
            const distB = parseFloat(b.querySelector('.place-distance').textContent.replace('A ', '')) || 9999;
            return distA - distB;
        });
        sortedCards.forEach(card => placesList.appendChild(card));

        if (closestCard) {
            closestCard.style.border = '2px solid var(--purple-main)';
            const titleEl = closestCard.querySelector('.place-title');
            if (titleEl && !titleEl.querySelector('.badge-nearest')) {
                const badge = document.createElement('span');
                badge.className = 'badge-nearest';
                badge.textContent = 'Más cercano';
                badge.style.cssText = 'background: var(--purple-main); color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left: 8px; vertical-align: middle;';
                titleEl.appendChild(badge);
            }
        }
    }

    function initGeolocation() {
        if (!navigator.geolocation) {
            if (mapStatus) mapStatus.textContent = 'Geolocalización no soportada.';
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => updateShelterUI(position.coords.latitude, position.coords.longitude, false),
            (error) => {
                console.warn('⚠️ Permiso denegado. Usando ubicación por defecto (Lima).');
                updateShelterUI(-12.046374, -77.042793, true);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

        // =========================================
    // 9. FILTROS, BÚSQUEDA, BANNER Y UBICACIONES SEGURAS
    // =========================================
    const chips = document.querySelectorAll('.chip');
    const btnLoadMore = document.getElementById('btn-load-more');
    const searchInput = document.getElementById('search-input');
    const infoBanner = document.getElementById('category-info-banner');
    const infoText = document.getElementById('category-info-text');
    const safePanel = document.getElementById('safe-locations-panel');
    const CARDS_POR_PAGINA = 5;
    let cardsMostradas = CARDS_POR_PAGINA;
    let categoriaActiva = 'casas-hogar';
    let terminoBusqueda = '';

    // Textos del banner informativo por categoría
    const CATEGORY_INFO = {
        'casas-hogar': '<strong>Centros de Emergencia Mujer (CEM):</strong> servicios gratuitos del MIMP que brindan atención legal, psicológica y social a mujeres víctimas de violencia. Hay más de 60 en Lima Metropolitana.',
        'comisarias': '<strong>Comisarías PNP:</strong> puedes denunciar violencia familiar en cualquier comisaría del país. Si estás en peligro, llama al 105 o al 100. Estas son las más cercanas a ti.',
        'otros': '<strong>Otros recursos:</strong> Defensoría del Pueblo, Fiscalía de Familia, UDAVIT, hospitales y líneas de apoyo adicionales que complementan la protección.',
        'seguras': '<strong>Ubicaciones seguras:</strong> guarda casas de familiares, amistades o lugares de confianza. Solo tú las verás, y aparecerán en el mapa para llegar rápido cuando lo necesites.'
    };

    function aplicarFiltroYPaginacion() {
        const todasLasCards = Array.from(document.querySelectorAll('.place-card'));

        // Actualizar banner informativo
        if (infoText && CATEGORY_INFO[categoriaActiva]) {
            infoText.innerHTML = CATEGORY_INFO[categoriaActiva];
            if (infoBanner) infoBanner.hidden = false;
        } else if (infoBanner) {
            infoBanner.hidden = true;
        }

        // Mostrar/ocultar panel de ubicaciones seguras
        if (safePanel) {
            safePanel.hidden = (categoriaActiva !== 'seguras');
        }

        // Si es "seguras", renderizar el panel y salir (no hay cards)
        if (categoriaActiva === 'seguras') {
            renderSafeLocationsPanel();
            todasLasCards.forEach(card => card.style.display = 'none');
            if (btnLoadMore) btnLoadMore.style.display = 'none';
            if (map) map.invalidateSize();
            return;
        }

        // Filtrar por categoría
        let cardsFiltradas = todasLasCards.filter(card =>
            card.getAttribute('data-category') === categoriaActiva
        );

        // Filtrar por término de búsqueda
        if (terminoBusqueda.trim() !== '') {
            const termino = terminoBusqueda.toLowerCase().trim();
            cardsFiltradas = cardsFiltradas.filter(card => {
                const titulo = card.querySelector('.place-title')?.textContent.toLowerCase() || '';
                const descripcion = card.querySelector('.place-desc')?.textContent.toLowerCase() || '';
                return titulo.includes(termino) || descripcion.includes(termino);
            });
        }

        todasLasCards.forEach(card => card.style.display = 'none');
        cardsFiltradas.slice(0, cardsMostradas).forEach(card => {
            card.style.display = 'flex';
        });

        // Mensaje sin resultados
        let noResults = document.getElementById('no-results-msg');
        if (cardsFiltradas.length === 0) {
            if (!noResults) {
                noResults = document.createElement('p');
                noResults.id = 'no-results-msg';
                noResults.style.cssText = 'grid-column: 1 / -1; text-align: center; color: var(--text-secondary); font-size: 14px; padding: 20px;';
                document.getElementById('places-list').after(noResults);
            }
            noResults.textContent = '🔍 No se encontraron resultados. Intenta con otro distrito o cambia la categoría.';
            noResults.hidden = false;
        } else if (noResults) {
            noResults.hidden = true;
        }

        // Botón cargar más
        if (btnLoadMore) {
            if (cardsFiltradas.length > cardsMostradas) {
                btnLoadMore.style.display = 'inline-flex';
                const restantes = cardsFiltradas.length - cardsMostradas;
                btnLoadMore.innerHTML = `<i class="fas fa-plus-circle"></i> Cargar más (${restantes} restantes)`;
            } else {
                btnLoadMore.style.display = 'none';
            }
        }

        if (map) map.invalidateSize();
    }

    // Click en cada chip
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            categoriaActiva = chip.getAttribute('data-filter');
            cardsMostradas = CARDS_POR_PAGINA;
            aplicarFiltroYPaginacion();
        });
    });

    // Búsqueda con debounce
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                terminoBusqueda = e.target.value;
                cardsMostradas = CARDS_POR_PAGINA;
                aplicarFiltroYPaginacion();
            }, 250);
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchTimeout);
                terminoBusqueda = e.target.value;
                cardsMostradas = CARDS_POR_PAGINA;
                aplicarFiltroYPaginacion();
            }
        });
    }

    // Cargar más
    if (btnLoadMore) {
        btnLoadMore.addEventListener('click', () => {
            cardsMostradas += CARDS_POR_PAGINA;
            aplicarFiltroYPaginacion();
        });
    }

    // =========================================
    // INICIALIZACIÓN
    // =========================================
    renderizarTarjetas();
    initGeolocation();

    setTimeout(() => {
        aplicarFiltroYPaginacion();
    }, 200);

    console.log('%c🛡️ Ampara AI', 'color: #520A5B; font-size: 20px; font-weight: bold;');
    console.log('%cSitio web iniciado correctamente.', 'color: #6D8A68;');
});