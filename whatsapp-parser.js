

/**
 * @typedef {Object} MensajeWhatsApp
 * @property {Date|null} fechaHora - objeto Date si se pudo parsear, si no null
 * @property {string} fechaTexto - fecha tal cual aparece en el archivo
 * @property {string} horaTexto - hora tal cual aparece en el archivo
 * @property {string} remitente
 * @property {string} mensaje
 * @property {boolean} esMultimedia
 */

const REGEX_LINEA_ANDROID = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?\s?m\.?)?)\]\s([^:]+):\s(.*)$/i;
const REGEX_LINEA_IOS = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?:\s?[ap]\.?\s?m\.?)?)\s-\s([^:]+):\s(.*)$/i;

const PATRONES_MULTIMEDIA = /(<Multimedia omitido>|image omitted|video omitted|audio omitted|sticker omitted|GIF omitted|<attached:)/i;

/**
 * Intenta parsear una fecha+hora en formato DD/MM/AA(AA) HH:MM(:SS) a un objeto Date.
 * Devuelve null si no se puede interpretar (no bloquea el parseo del resto del chat).
 */
function parsearFechaHora(fechaTexto, horaTexto) {
    try {
        const partesFecha = fechaTexto.split('/').map(p => parseInt(p, 10));
        if (partesFecha.length !== 3) return null;
        let [dia, mes, anio] = partesFecha;
        if (anio < 100) anio += 2000;

        const horaLimpia = horaTexto.replace(/\s?([ap])\.?\s?m\.?/i, ' $1m').trim();
        const esPM = /pm/i.test(horaLimpia);
        const esAM = /am/i.test(horaLimpia);
        const soloHora = horaLimpia.replace(/\s?[ap]m/i, '');
        const partesHora = soloHora.split(':').map(p => parseInt(p, 10));
        let [horas, minutos, segundos] = [partesHora[0] || 0, partesHora[1] || 0, partesHora[2] || 0];

        if (esPM && horas < 12) horas += 12;
        if (esAM && horas === 12) horas = 0;

        const fecha = new Date(anio, mes - 1, dia, horas, minutos, segundos);
        return isNaN(fecha.getTime()) ? null : fecha;
    } catch (e) {
        return null;
    }
}

/**
 * Parsea el contenido completo de un .txt exportado de WhatsApp.
 * @param {string} textoCompleto
 * @returns {MensajeWhatsApp[]}
 */
function parsearChatWhatsApp(textoCompleto) {
    if (!textoCompleto || typeof textoCompleto !== 'string') return [];

    // Normaliza saltos de línea y quita el BOM que a veces trae el archivo exportado
    const texto = textoCompleto.replace(/^﻿/, '').replace(/\r\n/g, '\n');
    const lineas = texto.split('\n');

    const mensajes = [];

    for (const lineaCruda of lineas) {
        const linea = lineaCruda.trimEnd();
        if (!linea.trim()) continue;

        const matchAndroid = linea.match(REGEX_LINEA_ANDROID);
        const matchIOS = !matchAndroid ? linea.match(REGEX_LINEA_IOS) : null;
        const match = matchAndroid || matchIOS;

        if (match) {
            const [, fechaTexto, horaTexto, remitente, mensajeTexto] = match;
            mensajes.push({
                fechaHora: parsearFechaHora(fechaTexto, horaTexto),
                fechaTexto,
                horaTexto,
                remitente: remitente.trim(),
                mensaje: mensajeTexto.trim(),
                esMultimedia: PATRONES_MULTIMEDIA.test(mensajeTexto)
            });
        } else if (mensajes.length > 0) {
            // Línea de continuación (mensaje multilínea): se anexa al último mensaje
            mensajes[mensajes.length - 1].mensaje += '\n' + linea.trim();
        }
        // Si no hay match y no hay mensaje previo, es una línea de sistema
        // al inicio del archivo (p. ej. "Los mensajes están cifrados...") y se ignora.
    }

    return mensajes;
}

/**
 * Valida que el archivo parseado tenga pinta real de export de WhatsApp,
 * para poder avisarle a la usuaria si subió el archivo equivocado.
 */
function validarFormatoWhatsApp(mensajes) {
    if (mensajes.length === 0) {
        return { valido: false, motivo: 'No se pudo leer ningún mensaje. Verifica que sea el .txt exportado directamente desde WhatsApp.' };
    }
    const conFecha = mensajes.filter(m => m.fechaHora !== null).length;
    if (conFecha / mensajes.length < 0.5) {
        return { valido: false, motivo: 'El formato de fechas no coincide con el de WhatsApp. Puede que el archivo haya sido editado.' };
    }
    return { valido: true, motivo: null };
}

/**
 * Calcula estadísticas rápidas del chat parseado, útiles para el resumen
 * del expediente (rango de fechas, participantes, cantidad de mensajes).
 */
function resumenEstadisticoChat(mensajes) {
    const participantes = [...new Set(mensajes.map(m => m.remitente))];
    const conFecha = mensajes.filter(m => m.fechaHora).map(m => m.fechaHora);
    return {
        totalMensajes: mensajes.length,
        participantes,
        fechaPrimerMensaje: conFecha.length ? new Date(Math.min(...conFecha)) : null,
        fechaUltimoMensaje: conFecha.length ? new Date(Math.max(...conFecha)) : null,
        mensajesMultimedia: mensajes.filter(m => m.esMultimedia).length
    };
}