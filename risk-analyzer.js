/* =========================================
   AMPARA AI - MOTOR DE ANÁLISIS DE RIESGO (v2)
   =========================================
   Analiza el chat completo con dos capas:

   1. Lenguaje: frases de riesgo agrupadas por categoría, sobre el
      texto normalizado (sin tildes, abreviaturas de WhatsApp
      expandidas, letras repetidas reducidas) y con detección simple
      de negaciones ("no te voy a hacer daño" no cuenta).
   2. Comportamiento: ráfagas de mensajes sin respuesta, mensajes de
      madrugada, señales repetidas en varios días y escalamiento.

   Si AMPARA_ANALYSIS_WEBHOOK_URL tiene un endpoint (por ejemplo, el
   análisis con IA), se usa ese resultado y este motor queda como
   respaldo automático si la IA falla.

   IMPORTANTE: es un análisis técnico preliminar, no un veredicto.
   ========================================= */

// Endpoint opcional del análisis con IA (dejar vacío para usar solo el motor local)
const AMPARA_ANALYSIS_WEBHOOK_URL = '';

// =========================================
// 1. NORMALIZACIÓN DEL TEXTO
// =========================================
const ABREVIATURAS = [
    [/\bq\b/g, 'que'], [/\bk\b/g, 'que'], [/\bke\b/g, 'que'],
    [/\b(xq|xk|pq|porq)\b/g, 'porque'], [/\bx\b/g, 'por'],
    [/\b(tb|tmb|tbn)\b/g, 'tambien'], [/\bd\b/g, 'de'],
    [/\bstas\b/g, 'estas'], [/\bstoy\b/g, 'estoy'],
    [/\b(wsp|wasap|wasa|whatsap|guasap)\b/g, 'whatsapp'],
    [/\b(dnd|dnde)\b/g, 'donde'], [/\bkn\b/g, 'con'],
    [/\b(msj|msjs)\b/g, 'mensaje'], [/\b(cel)\b/g, 'celular'],
    [/\bnd\b/g, 'nada'], [/\bntp\b/g, 'no te preocupes'],
    [/\b(ubi|ubica)\b/g, 'ubicacion'], [/\bpls\b/g, 'por favor']
];

function normalizarTexto(texto) {
    let s = String(texto || '').toLowerCase();
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');   // quita tildes
    s = s.replace(/([a-z])\1{2,}/g, '$1');                     // contestaaaa -> contesta
    s = s.replace(/[¿?¡!.,;:"“”()*_~]+/g, ' ');                // puntuación -> espacio
    ABREVIATURAS.forEach(([re, rep]) => { s = s.replace(re, rep); });
    return s.replace(/\s+/g, ' ').trim();
}

// =========================================
// 2. CATEGORÍAS DE LENGUAJE
// =========================================
// peso: cuánto suma al riesgo. negable: si "no/nunca/jamas" justo
// antes de la frase la anula ("no te voy a matar").
const CATEGORIAS_RIESGO = {
    amenaza_muerte: {
        etiqueta: 'Amenaza de muerte o con arma',
        peso: 6, negable: true,
        regex: /(te voy a matar|te mato|te van a matar|te quiero ver muerta|no vas a salir viva|te voy a desaparecer|(tengo|traigo|llevo) (un |una )?(arma|cuchillo|pistola|revolver|navaja|chaveta)|te voy a (meter|dar) (un )?(balazo|tiro|punalada))/
    },
    amenaza_dano: {
        etiqueta: 'Amenaza de hacer daño',
        peso: 5, negable: true,
        regex: /(te voy a (hacer dano|lastimar|golpear|pegar|reventar|romper la cara|partir la cara|desfigurar|sacar la mierda)|te va a doler|me las vas a pagar|vas a pagar( caro)?|te vas a acordar de mi)/
    },
    violencia_fisica: {
        etiqueta: 'Referencia a violencia física',
        peso: 6, negable: false,
        regex: /(me (golpeo|golpeaste|pego|pegaste|empujo|empujaste|ahorco|ahorcaste|pateo|pateaste|cacheteo|cacheteaste|tiro al suelo|jalo del pelo|jalaste del pelo)|me dejaste (moretones|marcas)|perdon por (pegarte|golpearte|empujarte)|no (te )?(volvere|vuelvo) a (pegar|golpear|empujar))/
    },
    intimidacion: {
        etiqueta: 'Intimidación o amenaza velada',
        peso: 4, negable: true,
        regex: /(ya vas a ver|ya veras|vas a ver lo que te pasa|te vas a arrepentir|ya sabes lo que te (puede|va a) pasar|se donde (vives|trabajas|estudias|estas)|te voy a (buscar|encontrar)|no sabes de lo que soy capaz|atente a las consecuencias|no me provoques|voy a ir a tu casa|te estoy esperando afuera|estoy afuera de tu casa)/
    },
    sextorsion: {
        etiqueta: 'Extorsión con fotos o videos íntimos',
        peso: 6, negable: true,
        regex: /(voy a (subir|publicar|pasar|mandar|difundir|compartir) (tus|las|esas) (fotos|videos|pack)|todos van a ver tus (fotos|videos)|te voy a exponer|si no .{0,40}(subo|publico|paso|difundo) (tus|las) (fotos|videos))/
    },
    acoso_sexual: {
        etiqueta: 'Presión o acoso sexual',
        peso: 3, negable: true,
        regex: /((mandame|pasame|enviame) (una |mas )?(foto|fotos|pack|nudes|video)( desnuda| sin ropa)?|quitate la ropa|sin ropa|desnuda para mi)/
    },
    control_vigilancia: {
        etiqueta: 'Control y vigilancia',
        peso: 3, negable: true,
        regex: /((mandame|pasame|comparteme|comparte) (tu )?(ubicacion|ubicacion en tiempo real)|(pasame|dame) tu (contrasena|clave)|revise tu (celular|telefono|whatsapp|instagram|facebook|chat)|(revisame|me revisas|muestrame|ensename|dame) tu (celular|telefono|chat|whatsapp)|te vi con|me dijeron que te vieron|quien es ese|con quien saliste|(borra|bloquea|elimina) a (ese|esa|tus)|no quiero que (le |les )?(hables|salgas|te juntes|veas)|no me gusta que (salgas|hables|te juntes|te vistas)|tienes que pedirme permiso|no puedes salir|sin avisarme)/
    },
    acoso_insistente: {
        etiqueta: 'Acoso o monitoreo insistente',
        peso: 2, negable: false,
        regex: /(contesta( ya| ahora)?\b|contestame|(por que|porque) no (me )?(contestas|respondes|contesta|responde)|no me ignores|respondeme|responde( ya| ahora)|te estoy llamando|donde estas|con quien estas|a donde vas)/
    },
    control_economico: {
        etiqueta: 'Control económico',
        peso: 3, negable: true,
        regex: /((dame|pasame|devuelveme) (tu |mi )?(sueldo|plata|dinero|tarjeta)|yo decido en que gastas|sin mi plata no eres nada|no te voy a dar (plata|dinero) si)/
    },
    aislamiento: {
        etiqueta: 'Aislamiento social',
        peso: 3, negable: true,
        regex: /((tus amigas|tu familia|tu mama) te (llena|llenan) la cabeza|no quiero que veas a|elige entre|alejate de (tus|tu)|no necesitas a nadie mas que a mi|ya no hables con)/
    },
    chantaje_emocional: {
        etiqueta: 'Chantaje o manipulación emocional',
        peso: 3, negable: false,
        regex: /(si me dejas (me mato|me muero|te mato|te vas a arrepentir)|despues de todo lo que (hice|he hecho) por ti|es tu culpa que (me ponga|me pongo|reaccione)|tu me obligas a|mira lo que me haces hacer|si me quisieras)/
    },
    desvalorizacion: {
        etiqueta: 'Insultos y desvalorización',
        peso: 2, negable: true,
        regex: /((eres|estas) (una )?(tonta|estupida|inutil|loca|idiota|basura|puta|perra|zorra|cualquiera|fea|gorda)|no vales nada|nadie te va a (querer|creer)|das asco|no sirves para nada|estas exagerando|te lo inventas|sin mi no eres nada)/
    },
    temor_expresado: {
        etiqueta: 'Expresión de miedo o pedido de que pare',
        peso: 1, negable: false,
        regex: /(me estas asustando|tengo miedo|dejame en paz|ya para|por favor para|no me hagas dano|me haces dano|auxilio|ayudame)/
    }
};

const CATEGORIAS_GRAVES = ['amenaza_muerte', 'amenaza_dano', 'violencia_fisica', 'sextorsion'];
const PALABRAS_NEGACION = /\b(no|nunca|jamas)$/;

function estaNegado(textoNormalizado, indice) {
    const anterior = textoNormalizado.slice(0, indice).trim();
    return PALABRAS_NEGACION.test(anterior);
}

// =========================================
// 3. CAPA DE LENGUAJE
// =========================================
function detectarHallazgosLenguaje(mensajes) {
    const hallazgos = [];
    mensajes.forEach((msg, indice) => {
        if (msg.esMultimedia || !msg.mensaje) return;
        const texto = normalizarTexto(msg.mensaje);

        for (const [clave, cat] of Object.entries(CATEGORIAS_RIESGO)) {
            const match = cat.regex.exec(texto);
            if (!match) continue;
            if (cat.negable && estaNegado(texto, match.index)) continue;

            hallazgos.push({
                indice,
                fechaHora: msg.fechaHora,
                fecha: msg.fechaTexto,
                hora: msg.horaTexto,
                remitente: msg.remitente,
                mensaje: msg.mensaje,
                clave,
                categoria: cat.etiqueta,
                peso: cat.peso
            });
        }
    });
    return hallazgos;
}

// =========================================
// 4. CAPA DE COMPORTAMIENTO
// =========================================
function detectarRafagas(mensajes) {
    // 5 o más mensajes seguidos de la misma persona en 10 minutos o menos,
    // sin respuesta de la otra persona entre medio.
    const rafagas = [];
    const VENTANA_MS = 10 * 60000;
    let inicioBloque = 0;

    for (let i = 1; i <= mensajes.length; i++) {
        const mismoRemitente = i < mensajes.length && mensajes[i].remitente === mensajes[inicioBloque].remitente;
        if (mismoRemitente) continue;

        // Dentro del bloque de una misma persona, buscar ventanas de 10 minutos
        let j = inicioBloque;
        while (j < i) {
            const t0 = mensajes[j].fechaHora;
            if (!t0) { j++; continue; }
            let k = j;
            while (k + 1 < i && mensajes[k + 1].fechaHora && (mensajes[k + 1].fechaHora - t0) <= VENTANA_MS) k++;
            const largo = k - j + 1;
            if (largo >= 5) {
                const minutos = Math.round((mensajes[k].fechaHora - t0) / 60000);
                rafagas.push({
                    indice: j,
                    fechaHora: t0,
                    fecha: mensajes[j].fechaTexto,
                    hora: mensajes[j].horaTexto,
                    remitente: mensajes[j].remitente,
                    mensaje: `${largo} mensajes seguidos en ${minutos < 2 ? 'menos de 2' : minutos} minutos sin respuesta`,
                    clave: 'rafaga',
                    categoria: 'Mensajes en ráfaga (presión insistente)',
                    peso: 2
                });
                j = k + 1;
            } else {
                j++;
            }
        }
        inicioBloque = i;
    }
    return rafagas.slice(0, 5);
}

function esMadrugada(fecha) {
    if (!fecha) return false;
    const h = fecha.getHours();
    return h >= 0 && h < 5;
}

function diaClave(fecha) {
    return fecha ? `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}` : null;
}

function calcularTendencia(hallazgos, totalMensajes) {
    const conPeso = hallazgos.filter(h => h.clave !== 'temor_expresado');
    if (conPeso.length < 3 || totalMensajes < 6) return 'sin_patron_claro';

    const tercio = totalMensajes / 3;
    const pesos = [0, 0, 0];
    conPeso.forEach(h => { pesos[Math.min(2, Math.floor(h.indice / tercio))] += h.peso; });

    const [inicio, medio, final] = pesos;
    if (final >= 4 && final > inicio * 1.5 && final >= medio) return 'escalando';
    if (inicio > final * 1.5) return 'decreciendo';
    return 'estable';
}

// =========================================
// 5. ANÁLISIS LOCAL COMPLETO
// =========================================
function listaNatural(items) {
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' y ' + items[items.length - 1];
}

function analizarLocalmente(mensajes, stats) {
    const lenguaje = detectarHallazgosLenguaje(mensajes);
    const rafagas = detectarRafagas(mensajes);
    const hallazgos = [...lenguaje, ...rafagas].sort((a, b) => a.indice - b.indice);

    const deRiesgo = hallazgos.filter(h => h.clave !== 'temor_expresado');
    const tendencia = calcularTendencia(hallazgos, mensajes.length);

    // Señales de contexto
    const nocturnos = deRiesgo.filter(h => esMadrugada(h.fechaHora)).length;
    const diasConSenales = new Set(deRiesgo.map(h => diaClave(h.fechaHora)).filter(Boolean)).size;
    const temor = hallazgos.filter(h => h.clave === 'temor_expresado');

    // Puntaje total
    let puntaje = deRiesgo.reduce((s, h) => s + h.peso, 0);
    if (nocturnos >= 2) puntaje += 2;
    if (diasConSenales >= 3) puntaje += 2;
    if (temor.length > 0 && deRiesgo.length > 0) puntaje += 1;

    // Nivel de riesgo
    // Alto se reserva para amenazas, violencia física, sextorsión o
    // intimidación reiterada. El control y el acoso, aunque se repitan
    // mucho, se marcan como medio (patrón de riesgo que debe atenderse).
    const hayGrave = deRiesgo.some(h => CATEGORIAS_GRAVES.includes(h.clave));
    const hayIntimidacion = deRiesgo.some(h => h.clave === 'intimidacion');
    const hayMedia = deRiesgo.some(h => ['intimidacion', 'chantaje_emocional', 'control_vigilancia', 'control_economico', 'aislamiento', 'acoso_sexual'].includes(h.clave));
    let nivel = 'bajo';
    if (hayGrave || (hayIntimidacion && puntaje >= 8)) nivel = 'alto';
    else if (puntaje >= 4 || hayMedia || tendencia === 'escalando') nivel = 'medio';

    // Quién concentra las señales
    const pesoPorRemitente = {};
    deRiesgo.forEach(h => { pesoPorRemitente[h.remitente] = (pesoPorRemitente[h.remitente] || 0) + h.peso; });
    const ranking = Object.entries(pesoPorRemitente).sort((a, b) => b[1] - a[1]);

    // Resumen legible (sin veredictos)
    const categorias = [...new Set(deRiesgo.map(h => h.categoria))];
    const partes = [];
    partes.push(`Se analizaron ${stats.totalMensajes} mensajes entre ${listaNatural(stats.participantes)}.`);

    if (categorias.length > 0) {
        partes.push(`Se identificaron señales de ${listaNatural(categorias.map(c => c.toLowerCase()))}.`);
    } else {
        partes.push('No se identificaron señales de riesgo evidentes en el texto. Esto no descarta una situación grave, porque el tono y el contexto no siempre se detectan de forma automática.');
    }

    if (ranking.length > 0 && puntaje > 0) {
        const [nombre, peso] = ranking[0];
        const total = ranking.reduce((s, r) => s + r[1], 0);
        const porcentaje = Math.round((peso / total) * 100);
        if (porcentaje >= 60) partes.push(`El ${porcentaje}% de las señales aparece en mensajes de ${nombre}.`);
    }
    if (temor.length > 0) {
        partes.push(`${listaNatural([...new Set(temor.map(t => t.remitente))])} expresó miedo o pidió que la situación pare en ${temor.length} ${temor.length === 1 ? 'mensaje' : 'mensajes'}.`);
    }
    if (tendencia === 'escalando') partes.push('Las señales se vuelven más fuertes hacia el final de la conversación.');
    if (diasConSenales >= 3) partes.push(`Las señales se repiten en ${diasConSenales} días distintos, lo que sugiere un patrón sostenido y no un hecho aislado.`);
    if (nocturnos >= 2) partes.push(`${nocturnos} mensajes con señales de riesgo fueron enviados de madrugada.`);
    if (rafagas.length === 1) partes.push('Se detectó una ráfaga de mensajes insistentes sin respuesta.');
    if (rafagas.length > 1) partes.push(`Se detectaron ${rafagas.length} ráfagas de mensajes insistentes sin respuesta.`);

    partes.push('Este resultado es un análisis técnico preliminar y no constituye una determinación legal.');

    return {
        nivel_riesgo: nivel,
        categorias,
        tendencia,
        hallazgos: hallazgos.slice(0, 60).map(h => ({
            fecha: h.fecha,
            hora: h.hora,
            remitente: h.remitente,
            mensaje: h.mensaje,
            categoria: h.categoria
        })),
        resumen: partes.join(' '),
        fuente_analisis: 'local'
    };
}

// =========================================
// 6. PUNTO DE ENTRADA (IA si está configurada, si no, local)
// =========================================
async function analizarRiesgoChat(mensajes, stats) {
    if (!AMPARA_ANALYSIS_WEBHOOK_URL) {
        return analizarLocalmente(mensajes, stats);
    }

    try {
        const res = await fetch(AMPARA_ANALYSIS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mensajes: mensajes.map(m => ({
                    fecha: m.fechaTexto,
                    hora: m.horaTexto,
                    remitente: m.remitente,
                    mensaje: m.esMultimedia ? '[multimedia]' : m.mensaje
                })),
                participantes: stats.participantes
            })
        });

        if (!res.ok) throw new Error(`Webhook respondió ${res.status}`);
        const data = await res.json();
        if (!data || !['alto', 'medio', 'bajo'].includes(data.nivel_riesgo) || !data.resumen) {
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
        console.warn('⚠️ No se pudo completar el análisis con IA, usando el motor local:', err);
        return analizarLocalmente(mensajes, stats);
    }
}