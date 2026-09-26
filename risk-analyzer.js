const AMPARA_ANALYSIS_WEBHOOK_URL = '';

// =========================================
// 1. DICCIONARIOS DE PATRONES (análisis local)
// =========================================
// Mismo espíritu que localFallbackResponse en app.js, pero pensado para
// barrer un historial completo en vez de un solo mensaje.
const PATRONES_RIESGO = {
    amenaza_explicita: {
        regex: /(te voy a matar|te mato|te va(n)? a matar|tiene(n)? (un )?(arma|cuchillo|pistola)|te va a doler|vas a pagar|te voy a hacer daño|te voy a lastimar|no vas a salir viva)/i,
        etiqueta: 'Amenaza explícita',
        peso: 5
    },
    violencia_fisica: {
        regex: /(me (golpe[oó]|empuj[oó]|ahorc[oó])|me peg[oó]|me tir[oó] (del pelo|al suelo)|me dej[oó] (moretones|marcas))/i,
        etiqueta: 'Violencia física',
        peso: 5
    },
    control_dominio: {
        regex: /(me revisa el celular|no me deja (salir|trabajar|estudiar|ver a mis amigas)|me quita el dinero|me prohíbe|me encierra|controla (todo lo que hago|mis redes)|me hace pedirle permiso)/i,
        etiqueta: 'Control y dominio',
        peso: 3
    },
    amenaza_extorsion_digital: {
        regex: /(amenaza con publicar|sextorsi|voy a subir (tus|las) fotos|si no me (pagas|respondes) (subo|publico|mando)|te voy a exponer|difundir (tus )?(fotos|videos))/i,
        etiqueta: 'Extorsión / amenaza digital',
        peso: 4
    },
    acoso_persistente: {
        regex: /(d[oó]nde est[aá]s|con qui[eé]n est[aá]s|contesta ya|por qu[eé] no contestas|te estoy llamando|responde ahora|no me ignores)/i,
        etiqueta: 'Acoso / monitoreo insistente',
        peso: 2
    },
    insultos_humillacion: {
        regex: /(eres una (tonta|est[uú]pida|in[uú]til|loca)|no vales nada|nadie te va a querer|est[aá]s exagerando|est[aá]s loca)/i,
        etiqueta: 'Insultos y humillación',
        peso: 2
    },
    aislamiento: {
        regex: /(no puedes ver a tus amigas|no quiero que hables con|tienes que elegir entre|tus amigas te llenan la cabeza|tu familia no te quiere ayudar)/i,
        etiqueta: 'Aislamiento social',
        peso: 3
    }
};

// =========================================
// 2. ANÁLISIS LOCAL (respaldo sin IA externa)
// =========================================

/**
 * Recorre todos los mensajes y marca coincidencias de patrones,
 * conservando de quién es cada mensaje y cuándo, para poder mostrar
 * hallazgos concretos y no solo un puntaje.
 */
function detectarHallazgos(mensajes) {
    const hallazgos = [];
    mensajes.forEach((msg, indice) => {
        if (msg.esMultimedia || !msg.mensaje) return;
        for (const [clave, patron] of Object.entries(PATRONES_RIESGO)) {
            if (patron.regex.test(msg.mensaje)) {
                hallazgos.push({
                    indice,
                    fecha: msg.fechaTexto,
                    hora: msg.horaTexto,
                    remitente: msg.remitente,
                    mensaje: msg.mensaje,
                    categoria: clave,
                    etiqueta: patron.etiqueta,
                    peso: patron.peso
                });
            }
        }
    });
    return hallazgos;
}

/**
 * Detecta si el riesgo escala, se mantiene o decrece a lo largo del
 * chat, dividiendo el historial en tres tercios cronológicos y
 * comparando la densidad de hallazgos en cada uno.
 */
function calcularTendencia(hallazgos, totalMensajes) {
    if (hallazgos.length < 3 || totalMensajes < 6) return 'sin_patron_claro';

    const tercio = totalMensajes / 3;
    const pesoPorTercio = [0, 0, 0];
    hallazgos.forEach(h => {
        const grupo = Math.min(2, Math.floor(h.indice / tercio));
        pesoPorTercio[grupo] += h.peso;
    });

    const [inicio, medio, final] = pesoPorTercio;
    if (final > inicio * 1.5 && final >= medio) return 'escalando';
    if (inicio > final * 1.5) return 'decreciendo';
    return 'estable';
}

function calcularNivelRiesgo(hallazgos, tendencia) {
    const pesoTotal = hallazgos.reduce((suma, h) => suma + h.peso, 0);
    const hayAmenazaOFisica = hallazgos.some(h => h.categoria === 'amenaza_explicita' || h.categoria === 'violencia_fisica');

    if (hayAmenazaOFisica || pesoTotal >= 10) return 'alto';
    if (pesoTotal >= 4 || tendencia === 'escalando') return 'medio';
    if (pesoTotal > 0) return 'bajo';
    return 'bajo';
}

function generarResumenLocal(hallazgos, tendencia, nivelRiesgo, stats) {
    const categorias = [...new Set(hallazgos.map(h => h.etiqueta))];
    const partes = [];

    partes.push(`Se analizaron ${stats.totalMensajes} mensajes entre ${stats.participantes.join(' y ')}.`);

    if (categorias.length > 0) {
        partes.push(`Se identificaron señales de: ${categorias.join(', ')}.`);
    } else {
        partes.push('No se identificaron patrones de riesgo evidentes en el texto, esto no descarta que la situación sea grave, ya que el contexto y el tono no siempre se detectan por palabras clave.');
    }

    if (tendencia === 'escalando') {
        partes.push('El patrón muestra un incremento de señales de riesgo hacia el final de la conversación.');
    }

    partes.push('Este resultado es un análisis técnico preliminar y no constituye una determinación legal. Se recomienda respaldo de un profesional para el proceso de denuncia.');

    return partes.join(' ');
}

/**
 * Análisis 100% local, sin depender de ningún servicio externo.
 */
function analizarLocalmente(mensajes, stats) {
    const hallazgos = detectarHallazgos(mensajes);
    const tendencia = calcularTendencia(hallazgos, mensajes.length);
    const nivelRiesgo = calcularNivelRiesgo(hallazgos, tendencia);
    const categorias = [...new Set(hallazgos.map(h => h.etiqueta))];

    return {
        nivel_riesgo: nivelRiesgo,
        categorias,
        tendencia,
        hallazgos: hallazgos.map(h => ({
            fecha: h.fecha,
            hora: h.hora,
            remitente: h.remitente,
            mensaje: h.mensaje,
            categoria: h.etiqueta
        })),
        resumen: generarResumenLocal(hallazgos, tendencia, nivelRiesgo, stats),
        fuente_analisis: 'local'
    };
}

// =========================================
// 3. ANÁLISIS VÍA IA (webhook), con fallback local
// =========================================

/**
 * Punto de entrada principal. Intenta el webhook de IA primero (mejor
 * comprensión de contexto, sarcasmo, lenguaje indirecto); si no está
 * configurado o falla, usa el análisis local por patrones.
 *
 * @param {import('./whatsapp-parser.js').MensajeWhatsApp[]} mensajes
 * @param {ReturnType<typeof resumenEstadisticoChat>} stats
 */
async function analizarRiesgoChat(mensajes, stats) {
    if (!AMPARA_ANALYSIS_WEBHOOK_URL) {
        return analizarLocalmente(mensajes, stats);
    }

    try {
        // Solo se envían los campos necesarios para el análisis, sin
        // metadata técnica del archivo (eso se calcula aparte y no
        // necesita salir del navegador).
        const cuerpoEnvio = {
            mensajes: mensajes.map(m => ({
                fecha: m.fechaTexto,
                hora: m.horaTexto,
                remitente: m.remitente,
                mensaje: m.esMultimedia ? '[multimedia]' : m.mensaje
            })),
            participantes: stats.participantes
        };

        const res = await fetch(AMPARA_ANALYSIS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpoEnvio)
        });

        if (!res.ok) throw new Error(`Webhook respondió ${res.status}`);
        const data = await res.json();

        // Validación mínima de la forma esperada; si el webhook devuelve
        // algo incompleto, mejor caer al análisis local que mostrar un
        // resultado a medias.
        if (!data || !data.nivel_riesgo || !data.resumen) {
            throw new Error('Respuesta del webhook incompleta');
        }

        return {
            nivel_riesgo: data.nivel_riesgo,
            categorias: Array.isArray(data.categorias) ? data.categorias : [],
            tendencia: data.tendencia || 'sin_patron_claro',
            hallazgos: Array.isArray(data.hallazgos) ? data.hallazgos : [],
            resumen: data.resumen,
            fuente_analisis: 'ia'
        };
    } catch (err) {
        console.warn('⚠️ No se pudo completar el análisis vía IA, usando análisis local:', err);
        return analizarLocalmente(mensajes, stats);
    }
}