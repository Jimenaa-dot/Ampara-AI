/* =========================================
   AMPARA AI - MÓDULO DE EXPEDIENTE (ligado a la cuenta)
   =========================================
   Flujo pensado para no poner una barrera de login antes de que la
   víctima pueda ver el análisis: cualquiera puede subir un .txt o una
   captura y ver el resultado (nivel de riesgo, hallazgos) sin haber
   iniciado sesión. El login solo se pide para GUARDAR ese resultado
   como parte del expediente permanente.

   Requiere que se hayan cargado antes, en este orden:
   1. supabase-client.js
   2. auth.js
   3. whatsapp-parser.js
   4. crypto-utils.js
   5. risk-analyzer.js
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // =========================================
    // 0. REFERENCIAS AL DOM
    // =========================================
    const seccionExpediente = document.getElementById('expediente');
    const dropzone = document.getElementById('expediente-dropzone');
    const inputArchivo = document.getElementById('expediente-file-input');
    const estadoProceso = document.getElementById('expediente-estado');
    const listaContainer = document.getElementById('expediente-lista');
    const avisoNoLogueada = document.getElementById('expediente-login-required');

    const previewContainer = document.getElementById('expediente-resultado-preview');

    if (!seccionExpediente) return; // La sección no está en esta página

    const ETIQUETAS_RIESGO = {
        alto: { texto: 'Riesgo alto', color: '#EF4444' },
        medio: { texto: 'Riesgo medio', color: '#DF6507' },
        bajo: { texto: 'Riesgo bajo', color: '#8EA889' }
    };

    // Guarda el último análisis hecho mientras la usuaria no ha iniciado
    // sesión, para poder guardarlo apenas inicie sesión sin pedirle que
    // vuelva a subir el archivo.
    let analisisPendienteDeGuardar = null;

    // =========================================
    // 1. AJUSTAR UI SEGÚN SESIÓN (sin bloquear la subida)
    // =========================================
    function actualizarVistaSegunSesion() {
        const logueada = !!window.amparaAuth.currentUser;

        if (avisoNoLogueada) {
            avisoNoLogueada.hidden = logueada;
        }

        if (logueada) {
            cargarExpediente();
            // Si había un análisis pendiente de una subida sin sesión,
            // se guarda automáticamente apenas hay sesión.
            if (analisisPendienteDeGuardar) {
                guardarCaso(analisisPendienteDeGuardar).then(() => {
                    analisisPendienteDeGuardar = null;
                    mostrarEstado('Caso guardado en tu expediente.', 'exito');
                    setTimeout(ocultarEstado, 4000);
                    actualizarBotonGuardarPreview(true);
                    cargarExpediente();
                }).catch(err => {
                    console.error(err);
                    mostrarEstado('No se pudo guardar el caso automáticamente, intenta de nuevo desde el botón.', 'error');
                });
            }
        } else if (listaContainer) {
            listaContainer.innerHTML = '';
        }
    }

    document.addEventListener('ampara:auth-changed', actualizarVistaSegunSesion);
    if (window.amparaAuth && window.amparaAuth.ready) actualizarVistaSegunSesion();

    // =========================================
    // 2. SUBIDA DE ARCHIVO (siempre disponible, sin login)
    // =========================================
    if (dropzone && inputArchivo) {
        dropzone.addEventListener('click', () => inputArchivo.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dropzone-hover');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dropzone-hover'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dropzone-hover');
            if (e.dataTransfer.files.length) procesarArchivo(e.dataTransfer.files[0]);
        });

        inputArchivo.addEventListener('change', () => {
            if (inputArchivo.files.length) procesarArchivo(inputArchivo.files[0]);
            inputArchivo.value = ''; // permite volver a subir el mismo archivo si hace falta
        });
    }

    function mostrarEstado(mensaje, tipo) {
        if (!estadoProceso) return;
        estadoProceso.hidden = false;
        estadoProceso.textContent = mensaje;
        estadoProceso.className = 'expediente-estado' + (tipo ? ` expediente-estado-${tipo}` : '');
    }
    function ocultarEstado() {
        if (estadoProceso) estadoProceso.hidden = true;
    }

    async function procesarArchivo(archivo) {
        const esImagen = archivo.type.startsWith('image/');
        const esTxt = archivo.name.toLowerCase().endsWith('.txt');

        if (!esImagen && !esTxt) {
            mostrarEstado('El archivo debe ser el .txt exportado desde WhatsApp o una captura (.jpg, .png).', 'error');
            return;
        }
        if (archivo.size > 15 * 1024 * 1024) {
            mostrarEstado('El archivo es muy grande (más de 15 MB). Intenta con un archivo más pequeño.', 'error');
            return;
        }

        try {
            if (previewContainer) previewContainer.hidden = true;
            analisisPendienteDeGuardar = null;

            let caso;

            if (esImagen) {
                // =========================================
                // FLUJO IMAGEN (captura de pantalla)
                // =========================================
                mostrarEstado('Analizando la captura con IA, esto puede tomar unos segundos...', 'progreso');
                const analisis = await analizarImagen(archivo);

                caso = {
                    nombre_archivo: archivo.name,
                    hash_sha256: null,
                    num_mensajes: 0,
                    fecha_primer_mensaje: null,
                    fecha_ultimo_mensaje: null,
                    nivel_riesgo: analisis.nivel_riesgo,
                    categorias: analisis.categorias,
                    tendencia: analisis.tendencia,
                    resumen: analisis.resumen,
                    hallazgos: analisis.hallazgos,
                    fuente_analisis: analisis.fuente_analisis
                };

                ocultarEstado();
                mostrarResultadoPreview(caso, '(imagen analizada por IA)', generarSelloDeTiempo());
            } else {
                // =========================================
                // FLUJO .TXT
                // =========================================
                mostrarEstado('Leyendo archivo...', 'progreso');
                const textoCompleto = await archivo.text();

                mostrarEstado('Calculando huella digital (cadena de custodia)...', 'progreso');
                const hash = await calcularHashSHA256(textoCompleto);
                const sello = generarSelloDeTiempo();

                mostrarEstado('Interpretando la conversación...', 'progreso');
                const mensajes = parsearChatWhatsApp(textoCompleto);
                const validacion = validarFormatoWhatsApp(mensajes);
                if (!validacion.valido) {
                    mostrarEstado(validacion.motivo, 'error');
                    return;
                }
                const stats = resumenEstadisticoChat(mensajes);

                mostrarEstado('Analizando señales de riesgo, esto puede tomar unos segundos...', 'progreso');
                const analisis = await analizarArchivo(archivo, mensajes, stats);

                caso = {
                    nombre_archivo: archivo.name,
                    hash_sha256: hash,
                    num_mensajes: stats.totalMensajes,
                    fecha_primer_mensaje: stats.fechaPrimerMensaje ? stats.fechaPrimerMensaje.toISOString() : null,
                    fecha_ultimo_mensaje: stats.fechaUltimoMensaje ? stats.fechaUltimoMensaje.toISOString() : null,
                    nivel_riesgo: analisis.nivel_riesgo,
                    categorias: analisis.categorias,
                    tendencia: analisis.tendencia,
                    resumen: analisis.resumen,
                    hallazgos: analisis.hallazgos,
                    fuente_analisis: analisis.fuente_analisis
                };

                ocultarEstado();
                mostrarResultadoPreview(caso, hash, sello);
            }

            if (window.amparaAuth.currentUser) {
                await guardarCaso(caso);
                mostrarEstado('Caso guardado en tu expediente.', 'exito');
                setTimeout(ocultarEstado, 4000);
                actualizarBotonGuardarPreview(true);
                cargarExpediente();
            } else {
                analisisPendienteDeGuardar = caso;
                actualizarBotonGuardarPreview(false);
            }
        } catch (err) {
            console.error('Error procesando el archivo:', err);
            mostrarEstado('Ocurrió un error al procesar el archivo. Intenta de nuevo.', 'error');
        }
    }

    // =========================================
    // 3. VISTA PREVIA INMEDIATA DEL ANÁLISIS (con o sin sesión)
    // =========================================
    let botonGuardarPreviewRef = null;

    function actualizarBotonGuardarPreview(yaGuardado) {
        if (!botonGuardarPreviewRef) return;
        if (yaGuardado) {
            botonGuardarPreviewRef.textContent = '✓ Guardado en tu expediente';
            botonGuardarPreviewRef.disabled = true;
        } else {
            botonGuardarPreviewRef.innerHTML = '<i class="fas fa-lock" aria-hidden="true"></i> Iniciar sesión y guardar en mi expediente';
            botonGuardarPreviewRef.disabled = false;
        }
    }

    function mostrarResultadoPreview(caso, hash, sello) {
        if (!previewContainer) return;
        const badge = ETIQUETAS_RIESGO[caso.nivel_riesgo] || ETIQUETAS_RIESGO.bajo;
        const hashTexto = typeof hash === 'string' ? hash.slice(0, 16) : String(hash);

        previewContainer.hidden = false;
        previewContainer.innerHTML = `
            <div class="card caso-card">
                <div class="caso-header">
                    <div>
                        <span class="caso-badge" style="background:${badge.color}">${badge.texto}</span>
                        <strong class="caso-nombre">${escaparHTML(caso.nombre_archivo)}</strong>
                    </div>
                </div>
                <p class="caso-resumen">${escaparHTML(caso.resumen)}</p>
                <div class="caso-meta">
                    <span class="caption"><i class="fas fa-comments" aria-hidden="true"></i> ${caso.num_mensajes > 0 ? caso.num_mensajes + ' mensajes' : 'Análisis de captura'}</span>
                    <span class="caption"><i class="fas fa-fingerprint" aria-hidden="true"></i> ${escaparHTML(hashTexto)}...</span>
                    <span class="caption"><i class="fas fa-clock" aria-hidden="true"></i> ${sello.legible}</span>
                </div>
                ${caso.hallazgos && caso.hallazgos.length ? `
                <div class="caso-hallazgos">
                    ${caso.hallazgos.map(h => `
                        <div class="hallazgo-item">
                            <span class="hallazgo-categoria">${escaparHTML(h.categoria)}</span>
                            <span class="caption">${escaparHTML(h.remitente || '')} · ${escaparHTML(h.fecha || '')} ${escaparHTML(h.hora || '')}</span>
                            <p>"${escaparHTML(h.mensaje)}"</p>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                <p class="caption" style="margin-top:10px;">
                    Este resultado es un análisis técnico preliminar, no una determinación legal.
                    ${window.amparaAuth.currentUser ? '' : 'Todavía no se ha guardado, si cierras esta pestaña se pierde.'}
                </p>
                <div class="caso-actions">
                    <button type="button" id="btn-guardar-preview" class="btn btn-primary"></button>
                </div>
            </div>
        `;

        botonGuardarPreviewRef = previewContainer.querySelector('#btn-guardar-preview');
        actualizarBotonGuardarPreview(!!window.amparaAuth.currentUser);

        if (botonGuardarPreviewRef) {
            botonGuardarPreviewRef.addEventListener('click', async () => {
                if (window.amparaAuth.currentUser) return; // ya guardado, el botón está disabled
                if (window.amparaAuth && window.amparaAuth.abrirModalLogin) {
                    window.amparaAuth.abrirModalLogin();
                    // El guardado real ocurre en actualizarVistaSegunSesion()
                    // apenas se detecte la nueva sesión (evento ampara:auth-changed).
                }
            });
        }
    }

    // =========================================
    // 4. GUARDAR / LEER / BORRAR EN SUPABASE
    // =========================================
    async function guardarCaso(caso) {
        const { error } = await supabaseClient
            .from('expediente_casos')
            .insert({
                user_id: window.amparaAuth.currentUser.id,
                ...caso
            });
        if (error) throw error;
    }

    async function cargarExpediente() {
        if (!listaContainer || !window.amparaAuth.currentUser) return;
        listaContainer.hidden = false;
        listaContainer.innerHTML = '<p class="caption">Cargando tu expediente...</p>';

        const { data, error } = await supabaseClient
            .from('expediente_casos')
            .select('*')
            .order('creado_en', { ascending: false });

        if (error) {
            listaContainer.innerHTML = '<p class="caption">No se pudo cargar el expediente. Intenta recargar la página.</p>';
            console.error(error);
            return;
        }

        renderizarLista(data);
    }

    async function borrarCaso(id) {
        const confirmado = confirm('¿Eliminar este caso del expediente? Esta acción no se puede deshacer.');
        if (!confirmado) return;
        const { error } = await supabaseClient.from('expediente_casos').delete().eq('id', id);
        if (error) {
            alert('No se pudo eliminar el caso.');
            console.error(error);
            return;
        }
        cargarExpediente();
    }

    // =========================================
    // 5. RENDERIZADO DE LA LISTA GUARDADA
    // =========================================
    function formatearRangoFechas(caso) {
        if (!caso.fecha_primer_mensaje) return 'Fechas no disponibles';
        const opciones = { day: '2-digit', month: 'short', year: 'numeric' };
        const inicio = new Date(caso.fecha_primer_mensaje).toLocaleDateString('es-PE', opciones);
        const fin = caso.fecha_ultimo_mensaje ? new Date(caso.fecha_ultimo_mensaje).toLocaleDateString('es-PE', opciones) : inicio;
        return inicio === fin ? inicio : `${inicio} – ${fin}`;
    }

    function renderizarLista(casos) {
        listaContainer.innerHTML = '';

        if (!casos || casos.length === 0) {
            listaContainer.innerHTML = '<p class="caption">Todavía no has guardado ninguna conversación en tu expediente.</p>';
            return;
        }

        casos.forEach(caso => {
            const badge = ETIQUETAS_RIESGO[caso.nivel_riesgo] || ETIQUETAS_RIESGO.bajo;
            const hashMostrar = caso.hash_sha256 ? caso.hash_sha256.slice(0, 12) + '...' : '(imagen)';
            const card = document.createElement('div');
            card.className = 'card caso-card';
            card.innerHTML = `
                <div class="caso-header">
                    <div>
                        <span class="caso-badge" style="background:${badge.color}">${badge.texto}</span>
                        <strong class="caso-nombre">${escaparHTML(caso.nombre_archivo)}</strong>
                    </div>
                    <span class="caption">${formatearRangoFechas(caso)}</span>
                </div>
                <p class="caso-resumen">${escaparHTML(caso.resumen)}</p>
                <div class="caso-meta">
                    <span class="caption"><i class="fas fa-comments" aria-hidden="true"></i> ${caso.num_mensajes > 0 ? caso.num_mensajes + ' mensajes' : 'Captura'}</span>
                    <span class="caption"><i class="fas fa-fingerprint" aria-hidden="true"></i> ${hashMostrar}</span>
                    <span class="caption"><i class="fas fa-clock" aria-hidden="true"></i> Subido ${new Date(caso.creado_en).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                ${caso.hallazgos && caso.hallazgos.length ? `
                <button type="button" class="btn-toggle-hallazgos" aria-expanded="false">
                    Ver ${caso.hallazgos.length} hallazgo(s) <i class="fas fa-chevron-down" aria-hidden="true"></i>
                </button>
                <div class="caso-hallazgos" hidden></div>
                ` : ''}
                <div class="caso-actions">
                    <button type="button" class="btn-exportar-caso btn-outline btn"><i class="fas fa-download" aria-hidden="true"></i> Exportar JSON</button>
                    <button type="button" class="btn-borrar-caso"><i class="fas fa-trash" aria-hidden="true"></i></button>
                </div>
            `;

            const btnToggle = card.querySelector('.btn-toggle-hallazgos');
            const panelHallazgos = card.querySelector('.caso-hallazgos');
            if (btnToggle && panelHallazgos) {
                btnToggle.addEventListener('click', () => {
                    const expandido = panelHallazgos.hidden === false;
                    panelHallazgos.hidden = expandido;
                    btnToggle.setAttribute('aria-expanded', String(!expandido));
                    if (!expandido && !panelHallazgos.dataset.render) {
                        panelHallazgos.innerHTML = caso.hallazgos.map(h => `
                            <div class="hallazgo-item">
                                <span class="hallazgo-categoria">${escaparHTML(h.categoria)}</span>
                                <span class="caption">${escaparHTML(h.remitente || '')} · ${escaparHTML(h.fecha || '')} ${escaparHTML(h.hora || '')}</span>
                                <p>"${escaparHTML(h.mensaje)}"</p>
                            </div>
                        `).join('');
                        panelHallazgos.dataset.render = 'true';
                    }
                });
            }

            card.querySelector('.btn-borrar-caso').addEventListener('click', () => borrarCaso(caso.id));
            card.querySelector('.btn-exportar-caso').addEventListener('click', () => exportarCasoJSON(caso));

            listaContainer.appendChild(card);
        });
    }

    function escaparHTML(texto) {
        const div = document.createElement('div');
        div.textContent = texto == null ? '' : String(texto);
        return div.innerHTML;
    }

    function exportarCasoJSON(caso) {
        const blob = new Blob([JSON.stringify(caso, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ampara-expediente-${caso.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
});