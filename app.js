/* =========================================
   AMPARA AI - LÓGICA DEL SITIO WEB
   =========================================
   Requiere que antes se carguen: supabase-client.js y auth.js
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';
            // =========================================
    // 0.1. MODO OSCURO / CLARO
    // =========================================
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const rootElement = document.documentElement;

    // Leer preferencia guardada o la del sistema
    function getPreferredTheme() {
        const saved = localStorage.getItem('ampara_theme');
        if (saved === 'dark' || saved === 'light') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Aplicar tema
    function applyTheme(theme) {
        rootElement.setAttribute('data-theme', theme);
        localStorage.setItem('ampara_theme', theme);
        if (btnThemeToggle) {
            const icon = btnThemeToggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
            btnThemeToggle.setAttribute('aria-label',
                theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
        }
    }

    // Inicializar
    applyTheme(getPreferredTheme());

    // Toggle al hacer clic
    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            const current = rootElement.getAttribute('data-theme');
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });
    }

    // Escuchar cambios de preferencia del sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('ampara_theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
    // =========================================
    // 0. CONFIGURACIÓN
    // =========================================
    const AMPARA_CHAT_WEBHOOK_URL = 'https://ncol021.app.n8n.cloud/webhook/ampara-chat';
    const amparaSessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const amparaHistory = [];

    // =========================================
    // Helpers
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

    function escapeHTML(texto) {
        const div = document.createElement('div');
        div.textContent = texto == null ? '' : String(texto);
        return div.innerHTML;
    }

    function getCurrentUser() {
        return (window.amparaAuth && window.amparaAuth.currentUser) ? window.amparaAuth.currentUser : null;
    }

    // =========================================
    // 1. MENÚ MÓVIL
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
    // 2. MODAL DE EMERGENCIA (muestra el círculo de confianza)
    // =========================================
    const emergencyModal = document.getElementById('emergency-modal');
    const btnEmergency = document.getElementById('btn-emergency');
    const btnCancelAlert = document.getElementById('btn-cancel-alert');

    // --- Ubicación real del dispositivo para la alerta ---
    let ubicacionEmergencia = null;         // { lat, lng, precision }
    let buscandoUbicacion = false;
    const contactosAvisados = new Set();

    function setCheck(id, estado, texto) {
        const el = document.getElementById(id);
        if (!el) return;
        const iconos = {
            ok: 'fa-check',
            error: 'fa-xmark',
            cargando: 'fa-spinner fa-spin',
            pendiente: 'fa-hand-pointer'
        };
        el.classList.toggle('done', estado === 'ok');
        el.classList.toggle('error', estado === 'error');
        const icon = el.querySelector('.status-icon');
        if (icon) icon.innerHTML = `<i class="fas ${iconos[estado] || iconos.pendiente}" aria-hidden="true"></i>`;
        const txt = el.querySelector('.status-text');
        if (txt) txt.textContent = texto;
    }

    function obtenerUbicacionEmergencia() {
        setCheck('check-ubicacion', 'cargando', 'Obteniendo...');
        buscandoUbicacion = true;
        return new Promise(resolve => {
            const terminar = (ubic, estado, texto) => {
                ubicacionEmergencia = ubic;
                buscandoUbicacion = false;
                setCheck('check-ubicacion', estado, texto);
                resolve(ubic);
            };
            if (!navigator.geolocation) {
                terminar(null, 'error', 'No disponible');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const ubic = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        precision: Math.round(pos.coords.accuracy)
                    };
                    terminar(ubic, 'ok', `Lista (±${ubic.precision} m)`);
                },
                (err) => terminar(null, 'error', err.code === 1 ? 'Permiso denegado' : 'No disponible'),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
            );
        });
    }

    function construirMensajeAlerta() {
        const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        if (ubicacionEmergencia) {
            const { lat, lng, precision } = ubicacionEmergencia;
            const link = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
            return `🚨 Necesito ayuda. Estoy aquí ${link} (precisión aproximada ${precision} m, ${hora}). Enviado desde Ampara AI.`;
        }
        return `🚨 Necesito ayuda, por favor comunícate conmigo lo antes posible (${hora}). No pude compartir mi ubicación. Enviado desde Ampara AI.`;
    }

    // 987654321 -> 51987654321 (formato que piden WhatsApp y SMS)
    function telefonoInternacional(telefono) {
        let d = String(telefono || '').replace(/\D/g, '');
        if (d.length === 9 && d.startsWith('9')) d = '51' + d;
        return d;
    }

    function renderContactosEnEmergencia() {
        const list = document.getElementById('emergency-contacts-list');
        if (!list) return;

        if (!getCurrentUser()) {
            list.innerHTML = `<p class="emergency-empty">Inicia sesión y agrega contactos para enviarles tu ubicación con un toque.</p>`;
            setCheck('check-envio', 'pendiente', 'Sin contactos');
            return;
        }

        const contactos = contactosCache.filter(c => c.telefono);
        if (contactos.length === 0) {
            list.innerHTML = `<p class="emergency-empty">Aún no tienes contactos con teléfono. Agrégalos en "Contactos de emergencia".</p>`;
            setCheck('check-envio', 'pendiente', 'Sin contactos');
            return;
        }

        const mensaje = construirMensajeAlerta();
        const esperando = buscandoUbicacion ? ' <small>(esperando GPS...)</small>' : '';

        list.innerHTML = contactos.map(c => {
            const num = telefonoInternacional(c.telefono);
            const wa = `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
            const sms = `sms:+${num}?body=${encodeURIComponent(mensaje)}`;
            return `
                <div class="emergency-contact-row">
                    <span class="emergency-contact-name">${escapeHTML(c.nombre)}</span>
                    <a class="emergency-btn-wa" href="${wa}" target="_blank" rel="noopener" data-nombre="${escapeHTML(c.nombre)}">
                        <i class="fab fa-whatsapp" aria-hidden="true"></i> Enviar ubicación${esperando}
                    </a>
                    <a class="emergency-btn-icon" href="${sms}" data-nombre="${escapeHTML(c.nombre)}" title="Enviar por SMS" aria-label="Enviar por SMS a ${escapeHTML(c.nombre)}">
                        <i class="fas fa-comment-sms" aria-hidden="true"></i>
                    </a>
                    <a class="emergency-btn-icon" href="tel:+${num}" title="Llamar" aria-label="Llamar a ${escapeHTML(c.nombre)}">
                        <i class="fas fa-phone" aria-hidden="true"></i>
                    </a>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.emergency-btn-wa, .emergency-btn-icon[href^="sms:"]').forEach(a => {
            a.addEventListener('click', () => {
                contactosAvisados.add(a.dataset.nombre);
                const nombres = [...contactosAvisados];
                setCheck('check-envio', 'ok', nombres.length === 1 ? `Mensaje listo para ${nombres[0]}` : `Mensaje listo para ${nombres.length} contactos`);
            });
        });

        if (contactosAvisados.size === 0) setCheck('check-envio', 'pendiente', 'Toca un contacto');
    }

    async function compartirUbicacionGenerica() {
        const hint = document.getElementById('emergency-hint');
        const mensaje = construirMensajeAlerta();
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Necesito ayuda', text: mensaje });
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(mensaje);
                if (hint) hint.textContent = 'Mensaje copiado. Pégalo en la app que prefieras.';
            }
        } catch (err) {
            // La persona canceló el menú de compartir, no es un error
        }
    }

    const btnShareLocation = document.getElementById('btn-share-location');
    if (btnShareLocation) btnShareLocation.addEventListener('click', compartirUbicacionGenerica);

    function openEmergencyModal() {
        contactosAvisados.clear();
        const hint = document.getElementById('emergency-hint');
        if (hint) hint.textContent = '';
        ubicacionEmergencia = null;
        if (emergencyModal) emergencyModal.hidden = false;

        const promesa = obtenerUbicacionEmergencia();
        renderContactosEnEmergencia();
        // Cuando llega la ubicación, los botones se actualizan con el link del mapa
        promesa.then(() => renderContactosEnEmergencia());
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
    // 3. CÍRCULO DE CONFIANZA (Supabase: contactos_emergencia)
    // =========================================
    let contactosCache = [];

    async function cargarContactos() {
        if (!getCurrentUser()) {
            contactosCache = [];
            return;
        }
        const { data, error } = await supabaseClient
            .from('contactos_emergencia')
            .select('*')
            .order('creado_en', { ascending: true });
        if (error) {
            console.error('Error cargando contactos:', error);
            contactosCache = [];
            return;
        }
        contactosCache = data || [];
    }

    async function agregarContacto(contacto) {
        const { error } = await supabaseClient
            .from('contactos_emergencia')
            .insert({ user_id: getCurrentUser().id, ...contacto });
        if (error) throw error;
    }

    async function borrarContacto(id) {
        const { error } = await supabaseClient
            .from('contactos_emergencia')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // Geocodificar dirección usando Nominatim (OpenStreetMap, gratis)
    async function geocodeAddress(address) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address + ', Perú')}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error('Error al buscar dirección');
        const data = await res.json();
        if (!data || data.length === 0) throw new Error('Dirección no encontrada');
        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
        };
    }

    function renderSafeLocationsPanel() {
        const panel = document.getElementById('safe-locations-panel');
        const prompt = document.getElementById('safe-locations-login-prompt');
        const content = document.getElementById('safe-locations-content');
        if (!panel || !prompt || !content) return;

        panel.hidden = false;

        if (!getCurrentUser()) {
            prompt.hidden = false;
            content.hidden = true;
            return;
        }

        prompt.hidden = true;
        content.hidden = false;
        renderSafeLocationsList();
        renderSafeLocationsOnMap();
    }

    function renderSafeLocationsList() {
        const list = document.getElementById('safe-locations-list');
        if (!list) return;

        if (contactosCache.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:var(--text-secondary); font-size:14px; padding:20px;">
                Aún no tienes personas en tu círculo de confianza. ¡Agrega la primera arriba! 💜
            </p>`;
            return;
        }

        list.innerHTML = '';
        contactosCache.forEach(c => {
            const item = document.createElement('div');
            item.className = 'safe-location-item';
            item.innerHTML = `
                <i class="fas fa-house-user"></i>
                <div class="safe-info">
                    <strong>${escapeHTML(c.nombre)}</strong>
                    ${c.telefono ? `<span><i class="fas fa-phone" aria-hidden="true"></i> ${escapeHTML(c.telefono)}</span>` : ''}
                    <span>${escapeHTML(c.direccion)}</span>
                </div>
                <div class="safe-actions">
                    ${c.telefono ? `<a class="btn-go" href="tel:${escapeHTML(c.telefono)}" title="Llamar"><i class="fas fa-phone"></i></a>` : ''}
                    ${(c.lat && c.lng) ? `<button class="btn-go btn-route-contact" title="Cómo llegar"><i class="fas fa-compass"></i></button>` : ''}
                    <button class="btn-delete" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            `;

            const btnRuta = item.querySelector('.btn-route-contact');
            if (btnRuta) {
                btnRuta.onclick = () => {
                    const userLoc = userMarker ? userMarker.getLatLng() : null;
                    const origin = userLoc ? `${userLoc.lat},${userLoc.lng}` : '';
                    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${c.lat},${c.lng}`, '_blank');
                };
            }

            item.querySelector('.btn-delete').onclick = async () => {
                if (!confirm(`¿Quitar a "${c.nombre}" de tu círculo de confianza?`)) return;
                try {
                    await borrarContacto(c.id);
                    await cargarContactos();
                    renderSafeLocationsList();
                    refrescarContactosUI();
                } catch (err) {
                    console.error(err);
                    alert('No se pudo eliminar el contacto.');
                }
            };

            list.appendChild(item);
        });
    }

    let safeMarkers = [];
    function renderSafeLocationsOnMap() {
        if (!map) return;
        safeMarkers.forEach(m => map.removeLayer(m));
        safeMarkers = [];

        contactosCache.forEach(c => {
            if (!c.lat || !c.lng) return;
            const icon = L.divIcon({
                className: '',
                html: '<div class="safe-marker-icon"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 24]
            });
            const marker = L.marker([c.lat, c.lng], { icon })
                .bindPopup(`<b>🛡️ ${escapeHTML(c.nombre)}</b><br><small>${escapeHTML(c.direccion)}</small>${c.telefono ? `<br><a href="tel:${escapeHTML(c.telefono)}">📞 ${escapeHTML(c.telefono)}</a>` : ''}`)
                .bindTooltip(escapeHTML(c.nombre), {
                    permanent: true,
                    direction: 'top',
                    offset: [0, -26],
                    className: 'safe-marker-label'
                });
            safeMarkers.push(marker);
        });

        actualizarMarcadoresMapa(false);
    }

    // Muestra en el mapa solo los marcadores de la categoría activa
    // (o todos si el chip activo es "Todos").
    function actualizarMarcadoresMapa(ajustarVista = true) {
        if (!map) return;
        const mostrarTodo = categoriaActiva === 'todos';
        const visibles = [];

        shelterMarkers.forEach(({ marker, categoria }) => {
            if (mostrarTodo || categoria === categoriaActiva) {
                if (!map.hasLayer(marker)) marker.addTo(map);
                visibles.push(marker.getLatLng());
            } else if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });

        const mostrarContactos = mostrarTodo || categoriaActiva === 'seguras';
        safeMarkers.forEach(marker => {
            if (mostrarContactos) {
                if (!map.hasLayer(marker)) marker.addTo(map);
                visibles.push(marker.getLatLng());
            } else if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });

        if (ajustarVista && visibles.length > 0) {
            if (userMarker) visibles.push(userMarker.getLatLng());
            map.fitBounds(L.latLngBounds(visibles), { padding: [30, 30], maxZoom: 14 });
        }
    }

    // Guarda un contacto (intenta ubicar la dirección en el mapa primero).
    // Lo usan tanto el formulario del mapa como el modal de contactos.
    async function guardarContactoCompleto({ nombre, telefono, direccion }) {
        let coords = { lat: null, lng: null };
        let ubicado = true;
        try {
            coords = await geocodeAddress(direccion);
        } catch (geoErr) {
            ubicado = false;
        }
        await agregarContacto({ nombre, telefono: telefono || null, direccion, lat: coords.lat, lng: coords.lng });
        await cargarContactos();
        refrescarContactosUI();
        return ubicado;
    }

    function refrescarContactosUI() {
        if (categoriaActiva === 'seguras') renderSafeLocationsList();
        renderSafeLocationsOnMap();
        renderContactsModal();
    }

    const safeForm = document.getElementById('safe-location-form');
    if (safeForm) {
        safeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('safe-name');
            const phoneInput = document.getElementById('safe-phone');
            const addressInput = document.getElementById('safe-address');
            const status = document.getElementById('safe-form-status');
            const submitBtn = safeForm.querySelector('button[type="submit"]');

            const nombre = nameInput.value.trim();
            const telefono = phoneInput ? phoneInput.value.trim() : '';
            const direccion = addressInput.value.trim();

            if (!nombre || !direccion) return;
            if (!getCurrentUser()) {
                status.textContent = '❌ Debes iniciar sesión primero';
                status.className = 'form-hint error';
                return;
            }

            status.textContent = '🔍 Buscando la dirección en el mapa...';
            status.className = 'form-hint';
            if (submitBtn) submitBtn.disabled = true;

            try {
                // Si la dirección no se encuentra, igual se guarda el contacto
                // (sin marcador), para no perder el teléfono de emergencia.
                const ubicado = await guardarContactoCompleto({ nombre, telefono, direccion });

                status.textContent = ubicado
                    ? '✅ Contacto guardado en tu círculo de confianza'
                    : '✅ Contacto guardado, pero no pudimos ubicar la dirección en el mapa (prueba con más detalle, incluye el distrito)';
                status.className = 'form-hint success';

                safeForm.reset();
                renderSafeLocationsList();
                setTimeout(() => { status.textContent = ''; }, 4000);
            } catch (err) {
                console.error(err);
                status.textContent = '❌ No se pudo guardar el contacto. Intenta de nuevo.';
                status.className = 'form-hint error';
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    const btnLoginFromSafe = document.getElementById('btn-login-from-safe');
    if (btnLoginFromSafe) {
        btnLoginFromSafe.addEventListener('click', () => {
            if (window.amparaAuth && window.amparaAuth.abrirModalLogin) {
                window.amparaAuth.abrirModalLogin();
            }
        });
    }

    // =========================================
    // 3.1. MODAL "CONTACTOS DE EMERGENCIA"
    // (misma lista que el círculo de confianza, guardada en Supabase)
    // =========================================
    const contactsModal = document.getElementById('contacts-modal');
    const contactForm = document.getElementById('contact-form');

    function renderContactsModal() {
        const prompt = document.getElementById('contacts-login-prompt');
        const content = document.getElementById('contacts-content');
        const list = document.getElementById('contacts-list');
        const noMsg = document.getElementById('no-contacts-msg');
        if (!prompt || !content || !list) return;

        if (!getCurrentUser()) {
            prompt.hidden = false;
            content.hidden = true;
            return;
        }
        prompt.hidden = true;
        content.hidden = false;

        list.innerHTML = '';
        if (noMsg) noMsg.hidden = contactosCache.length > 0;

        contactosCache.forEach(c => {
            const li = document.createElement('li');
            li.className = 'contact-item';
            li.innerHTML = `
                <div class="contact-info">
                    <span class="contact-name">${escapeHTML(c.nombre)}</span>
                    ${c.telefono ? `<span class="contact-phone"><i class="fas fa-phone" aria-hidden="true"></i> ${escapeHTML(c.telefono)}</span>` : ''}
                    <span class="contact-address"><i class="fas fa-location-dot" aria-hidden="true"></i> ${escapeHTML(c.direccion)}${(c.lat && c.lng) ? '' : ' (no ubicada en el mapa)'}</span>
                </div>
                <div class="contact-actions">
                    ${c.telefono ? `<a class="btn-call-contact" href="tel:${escapeHTML(c.telefono)}" title="Llamar"><i class="fas fa-phone"></i></a>` : ''}
                    <button type="button" class="btn-delete-contact" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            `;
            li.querySelector('.btn-delete-contact').addEventListener('click', async () => {
                if (!confirm(`¿Eliminar a "${c.nombre}" de tus contactos de emergencia?`)) return;
                try {
                    await borrarContacto(c.id);
                    await cargarContactos();
                    refrescarContactosUI();
                } catch (err) {
                    console.error(err);
                    alert('No se pudo eliminar el contacto.');
                }
            });
            list.appendChild(li);
        });
    }

    function openContactsModal(e) {
        if (e) e.preventDefault();
        renderContactsModal();
        if (contactsModal) contactsModal.hidden = false;
    }
    function closeContactsModal() {
        if (contactsModal) contactsModal.hidden = true;
    }

    ['nav-add-contact', 'btn-add-contact'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', openContactsModal);
    });

    const btnCloseContacts = document.getElementById('btn-close-contacts');
    if (btnCloseContacts) btnCloseContacts.addEventListener('click', closeContactsModal);
    if (contactsModal) {
        contactsModal.addEventListener('click', (e) => {
            if (e.target === contactsModal) closeContactsModal();
        });
    }

    const btnLoginFromContacts = document.getElementById('btn-login-from-contacts');
    if (btnLoginFromContacts) {
        btnLoginFromContacts.addEventListener('click', () => {
            closeContactsModal();
            if (window.amparaAuth && window.amparaAuth.abrirModalLogin) {
                window.amparaAuth.abrirModalLogin();
            }
        });
    }

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('contact-name').value.trim();
            const telefono = document.getElementById('contact-phone').value.trim();
            const direccion = document.getElementById('contact-address').value.trim();
            const status = document.getElementById('contact-form-status');
            const submitBtn = document.getElementById('btn-save-contact');

            if (!nombre || !telefono || !direccion) return;
            if (!getCurrentUser()) {
                renderContactsModal();
                return;
            }

            if (status) { status.textContent = '🔍 Guardando y ubicando la dirección...'; status.className = 'form-hint'; }
            if (submitBtn) submitBtn.disabled = true;

            try {
                const ubicado = await guardarContactoCompleto({ nombre, telefono, direccion });
                contactForm.reset();
                if (status) {
                    status.textContent = ubicado
                        ? '✅ Contacto guardado. Ya aparece en el mapa y en el botón de emergencia.'
                        : '✅ Contacto guardado, pero no pudimos ubicar la dirección en el mapa (incluye el distrito).';
                    status.className = 'form-hint success';
                    setTimeout(() => { status.textContent = ''; }, 4000);
                }
            } catch (err) {
                console.error(err);
                if (status) { status.textContent = '❌ No se pudo guardar el contacto. Intenta de nuevo.'; status.className = 'form-hint error'; }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // =========================================
    // 4. CHAT — EMPÁTICO CON N8N (+ historial en Supabase)
    // =========================================
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('btn-send-chat');
    const chatMessages = document.getElementById('chat-messages');
    const quickRepliesContainer = document.getElementById('quick-replies');
    const chatMensajeInicialHTML = chatMessages ? chatMessages.innerHTML : '';

    const ACTION_MAP = {
        respirar: { label: '🧘 Ir a "Necesito calma"', target: '#respira' },
        evidencias: { label: '📂 Ir a Mi expediente', target: '#expediente' },
        refugios: { label: '🏠 Ver refugios cercanos', target: '#refugios' },
        alerta: { label: '🚨 Activar alerta de emergencia', target: 'emergency' }
    };

    function addMessage(text, sender, suggestedActions, fecha) {
        if (!chatMessages) return;
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender === 'user' ? 'message-user' : 'message-ai');

        const now = fecha || new Date();
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

    // --- Historial persistente (solo si hay sesión) ---
    async function guardarMensajeChat(rol, contenido) {
        const user = getCurrentUser();
        if (!user || !contenido) return;
        const { error } = await supabaseClient
            .from('chat_mensajes')
            .insert({ user_id: user.id, rol, contenido: String(contenido).slice(0, 4000) });
        if (error) console.error('No se pudo guardar el mensaje:', error);
    }

    let historialCargadoPara = null;

    async function cargarHistorialChat() {
        const user = getCurrentUser();
        if (!user || !chatMessages) return;
        if (historialCargadoPara === user.id) return;
        historialCargadoPara = user.id;

        const { data, error } = await supabaseClient
            .from('chat_mensajes')
            .select('rol, contenido, creado_en')
            .order('creado_en', { ascending: false })
            .limit(60);

        if (error) {
            console.error('Error cargando historial:', error);
            return;
        }
        if (!data || data.length === 0) return;

        const mensajes = data.reverse();

        const separador = document.createElement('div');
        separador.className = 'chat-history-separator';
        separador.textContent = 'Tu conversación anterior';
        chatMessages.appendChild(separador);

        mensajes.forEach(m => {
            addMessage(m.contenido, m.rol === 'user' ? 'user' : 'ai', null, new Date(m.creado_en));
            amparaHistory.push({ role: m.rol, content: cleanForHistory(m.contenido) });
        });

        if (quickRepliesContainer) quickRepliesContainer.style.display = 'none';
    }

    // Al cerrar sesión se limpia el chat de la pantalla, por si el
    // dispositivo es compartido (el historial sigue guardado en la cuenta).
    function limpiarChatEnPantalla() {
        if (!chatMessages) return;
        chatMessages.innerHTML = chatMensajeInicialHTML;
        amparaHistory.length = 0;
        historialCargadoPara = null;
        if (quickRepliesContainer) quickRepliesContainer.style.display = '';
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
            return { reply: 'Gracias por contármelo, no estás sola. Primero: no le respondas nada y no borres los mensajes, porque son tu prueba. Exporta el chat desde WhatsApp y súbelo a Mi expediente, así queda guardado fuera de tu celular por si él tiene acceso. Después bloquéalo y repórtalo en la plataforma. Si quieres, seguimos hablando.', risk_level: 'medio', suggested_actions: ['evidencias'], escalate: false };
        }
        if (domestic.test(lower)) {
            return { reply: 'Lamento mucho que estés pasando esto, y quiero que sepas algo importante: no es tu culpa. Lo que describes es violencia, aunque él te diga que exageras. ¿Hay algún lugar donde puedas estar segura ahora, o alguien de confianza a quien puedas escribirle? Si tienes mensajes, guárdalos en Mi expediente por si los necesitas después. Y si en algún momento sientes peligro, el botón rojo de arriba te conecta al instante. ¿Quieres contarme un poco más?', risk_level: 'medio', suggested_actions: ['evidencias', 'refugios'], escalate: false };
        }
        if (acosoCallejero.test(lower)) {
            return { reply: 'Comprendo, y es normal sentirte así. Si puedes, camina hacia un lugar con más gente (una tienda, un banco, una farmacia) y quédate ahí un momento. Si tienes a alguien de confianza cerca, llámalo y cuéntale dónde estás. Si sientes que te siguen de verdad, activa la alerta con el botón rojo de arriba. ¿Dónde estás ahora?', risk_level: 'medio', suggested_actions: ['alerta', 'refugios'], escalate: false };
        }
        if (incomodidad.test(lower)) {
            return { reply: 'Comprendo, no estás sola. ¿Hay algún lugar con más gente o recepción donde puedas estar mientras decides? Si quieres, activamos la Alerta de Ampara para que llames rápido a alguien de tu círculo de confianza. ¿Lo hacemos?', risk_level: 'medio', suggested_actions: ['alerta'], escalate: false };
        }
        if (mediumRisk.test(lower)) {
            return { reply: 'Gracias por confiarme esto, entiendo que no es fácil. ¿Hay algún lugar donde te sientas más segura ahora mismo? Guarda cualquier mensaje que tengas en Mi expediente, y si quieres revisa los refugios y líneas de ayuda cercanas. Si la situación empeora, el botón rojo de arriba activa ayuda de inmediato. ¿Quieres contarme un poco más?', risk_level: 'medio', suggested_actions: ['evidencias', 'refugios'], escalate: false };
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

        amparaHistory.push({ role: 'user', content: cleanForHistory(userMessage) });
        amparaHistory.push({ role: 'assistant', content: cleanForHistory(result.reply) });

        addMessage(result.reply, 'ai', result.suggested_actions);
        guardarMensajeChat('assistant', result.reply);

        if (result.escalate) {
            openEmergencyModal();
        }
    }

    function handleUserMessage(text) {
        if (!text || !text.trim()) return;
        if (quickRepliesContainer) quickRepliesContainer.style.display = 'none';
        addMessage(text, 'user');
        guardarMensajeChat('user', text);
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
    // 5. EJERCICIO DE RESPIRACIÓN
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
    // 6. GEOLOCALIZACIÓN, MAPA Y RENDERIZADO
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

        // Si los contactos ya se cargaron antes que el mapa, pintarlos ahora
        renderSafeLocationsOnMap();
    }

    function updateShelterUI(userLat, userLng, isFallback = false) {
        if (mapStatus) {
            mapStatus.textContent = isFallback
                ? 'Usando ubicación aproximada (Lima, Perú)'
                : '📍 Ubicación detectada. Mostrando refugios cercanos.';
        }

        initMap(userLat, userLng);

        shelterMarkers.forEach(m => map.removeLayer(m.marker));
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

                const marker = L.marker([lat, lng])
                    .bindPopup(`<b>${card.querySelector('.place-title').textContent}</b><br>${card.querySelector('.place-desc').textContent}`);
                shelterMarkers.push({ marker, categoria: card.getAttribute('data-category') });

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

        actualizarMarcadoresMapa(true);
    }

    function initGeolocation() {
        if (!navigator.geolocation) {
            if (mapStatus) mapStatus.textContent = 'Geolocalización no soportada.';
            updateShelterUI(-12.046374, -77.042793, true);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => updateShelterUI(position.coords.latitude, position.coords.longitude, false),
            () => {
                console.warn('⚠️ Permiso denegado. Usando ubicación por defecto (Lima).');
                updateShelterUI(-12.046374, -77.042793, true);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    // =========================================
    // 7. FILTROS, BÚSQUEDA, BANNER Y CÍRCULO DE CONFIANZA
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

    const CATEGORY_INFO = {
        'todos': '<strong>Todos los recursos:</strong> CEM, comisarías, otros servicios y tu círculo de confianza en un solo mapa.',
        'casas-hogar': '<strong>Centros de Emergencia Mujer (CEM):</strong> servicios gratuitos del MIMP que brindan atención legal, psicológica y social a mujeres víctimas de violencia. Hay más de 60 en Lima Metropolitana.',
        'comisarias': '<strong>Comisarías PNP:</strong> puedes denunciar violencia familiar en cualquier comisaría del país. Si estás en peligro, llama al 105 o al 100. Estas son las más cercanas a ti.',
        'otros': '<strong>Otros recursos:</strong> Defensoría del Pueblo, Fiscalía de Familia, UDAVIT, hospitales y líneas de apoyo adicionales que complementan la protección.',
        'seguras': '<strong>Círculo de confianza:</strong> guarda a familiares o amistades con su teléfono y dirección. Solo tú los verás, aparecerán en el mapa y podrás llamarlos directo desde el botón de emergencia.'
    };

    function aplicarFiltroYPaginacion() {
        const todasLasCards = Array.from(document.querySelectorAll('.place-card'));

        if (infoText && CATEGORY_INFO[categoriaActiva]) {
            infoText.innerHTML = CATEGORY_INFO[categoriaActiva];
            if (infoBanner) infoBanner.hidden = false;
        } else if (infoBanner) {
            infoBanner.hidden = true;
        }

        if (safePanel) {
            safePanel.hidden = (categoriaActiva !== 'seguras');
        }

        if (categoriaActiva === 'seguras') {
            renderSafeLocationsPanel();
            todasLasCards.forEach(card => card.style.display = 'none');
            if (btnLoadMore) btnLoadMore.style.display = 'none';
            const noRes = document.getElementById('no-results-msg');
            if (noRes) noRes.hidden = true;
            actualizarMarcadoresMapa(true);
            if (map) map.invalidateSize();
            return;
        }

        let cardsFiltradas = (categoriaActiva === 'todos')
            ? todasLasCards
            : todasLasCards.filter(card => card.getAttribute('data-category') === categoriaActiva);

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

        if (btnLoadMore) {
            if (cardsFiltradas.length > cardsMostradas) {
                btnLoadMore.style.display = 'inline-flex';
                const restantes = cardsFiltradas.length - cardsMostradas;
                btnLoadMore.innerHTML = `<i class="fas fa-plus-circle"></i> Cargar más (${restantes} restantes)`;
            } else {
                btnLoadMore.style.display = 'none';
            }
        }

        actualizarMarcadoresMapa(true);
        if (map) map.invalidateSize();
    }

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            categoriaActiva = chip.getAttribute('data-filter');
            cardsMostradas = CARDS_POR_PAGINA;
            aplicarFiltroYPaginacion();
        });
    });

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

    if (btnLoadMore) {
        btnLoadMore.addEventListener('click', () => {
            cardsMostradas += CARDS_POR_PAGINA;
            aplicarFiltroYPaginacion();
        });
    }

    // =========================================
    // 8. REACCIONAR A LOGIN / LOGOUT
    // =========================================
    let ultimoUsuarioId = null;

    async function alCambiarSesion() {
        const user = getCurrentUser();
        const nuevoId = user ? user.id : null;

        // Cerró sesión: limpiar todo lo personal de la pantalla
        if (!nuevoId && ultimoUsuarioId) {
            limpiarChatEnPantalla();
        }
        ultimoUsuarioId = nuevoId;

        await cargarContactos();
        renderSafeLocationsOnMap();
        renderContactsModal();
        if (categoriaActiva === 'seguras') renderSafeLocationsPanel();

        if (nuevoId) await cargarHistorialChat();
    }

    document.addEventListener('ampara:auth-changed', alCambiarSesion);

    // =========================================
    // 9. ACCESOS DE CELULAR (botón grande de ayuda y barra inferior)
    // =========================================
    const btnEmergencyHero = document.getElementById('btn-emergency-hero');
    if (btnEmergencyHero) btnEmergencyHero.addEventListener('click', openEmergencyModal);

    const bottomNavContacts = document.getElementById('bottom-nav-contacts');
    if (bottomNavContacts) bottomNavContacts.addEventListener('click', openContactsModal);

    // Marca en la barra inferior la sección que se está viendo
    const bottomLinks = document.querySelectorAll('.bottom-nav a[data-section]');
    const seccionesNav = [
        ['inicio', document.querySelector('.hero')],
        ['chat', document.getElementById('chat')],
        ['expediente', document.getElementById('expediente')],
        ['refugios', document.getElementById('refugios')]
    ].filter(([, el]) => el);

    if ('IntersectionObserver' in window && bottomLinks.length) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const par = seccionesNav.find(([, el]) => el === entry.target);
                if (!par) return;
                bottomLinks.forEach(a => a.classList.toggle('active', a.dataset.section === par[0]));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        seccionesNav.forEach(([, el]) => observer.observe(el));
    }

    // =========================================
    // INICIALIZACIÓN
    // =========================================
    renderizarTarjetas();
    initGeolocation();

    setTimeout(() => {
        aplicarFiltroYPaginacion();
    }, 200);

    // Si auth.js ya resolvió la sesión antes de que este archivo cargara
    if (window.amparaAuth && window.amparaAuth.ready) alCambiarSesion();

    console.log('%c🛡️ Ampara AI', 'color: #520A5B; font-size: 20px; font-weight: bold;');
    console.log('%cSitio web iniciado correctamente.', 'color: #6D8A68;');
});