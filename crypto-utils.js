/* =========================================
   AMPARA AI - CADENA DE CUSTODIA (hash + sello de tiempo)
   =========================================
   No prueba que el contenido del chat sea verídico, prueba que el
   archivo que Ampara AI recibió no fue alterado DESPUÉS de subirlo.
   Por eso el hash se calcula apenas se lee el archivo, antes de
   cualquier otro procesamiento.
   ========================================= */

/**
 * Calcula el hash SHA-256 de un texto y lo devuelve en hexadecimal.
 * Usa la Web Crypto API nativa del navegador (no depende de librerías externas).
 * @param {string} texto
 * @returns {Promise<string>}
 */
async function calcularHashSHA256(texto) {
    const codificador = new TextEncoder();
    const datos = codificador.encode(texto);
    const bufferHash = await crypto.subtle.digest('SHA-256', datos);
    const bytes = Array.from(new Uint8Array(bufferHash));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sello de tiempo del momento exacto de la carga, en dos formatos:
 * uno para guardar (ISO, sin ambigüedad de zona horaria) y uno legible
 * para mostrar en la UI en hora de Perú.
 */
function generarSelloDeTiempo() {
    const ahora = new Date();
    return {
        iso: ahora.toISOString(),
        legible: ahora.toLocaleString('es-PE', {
            timeZone: 'America/Lima',
            dateStyle: 'long',
            timeStyle: 'medium'
        })
    };
}