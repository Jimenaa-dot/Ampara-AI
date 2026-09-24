document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Lógica del Chat ---
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');

    // Función para obtener la hora actual
    function getCurrentTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // Función para agregar un mensaje al chat
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
        
        const p = document.createElement('p');
        p.textContent = text;
        
        const span = document.createElement('span');
        span.classList.add('time');
        span.innerHTML = `${getCurrentTime()} <i class="fa-solid fa-check-double"></i>`;
        
        messageDiv.appendChild(p);
        messageDiv.appendChild(span);
        chatMessages.appendChild(messageDiv);
        
        // Auto-scroll al final
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Función para simular la respuesta de la IA
    function getAIResponse(userText) {
        const text = userText.toLowerCase();
        
        if (text.includes('calma')) {
            return "Vamos a respirar juntas. Inhala profundamente por 4 segundos, mantén el aire por 4 segundos y exhala lentamente por 6 segundos. Estoy aquí contigo.";
        } else if (text.includes('analizar') || text.includes('captura')) {
            return "Puedes subir una captura de pantalla o pegar el texto aquí. Lo analizaré de forma segura y privada para detectar posibles amenazas.";
        } else if (text.includes('casa') || text.includes('hogar') || text.includes('cerca')) {
            return "He detectado tu ubicación aproximada. Hay 3 Casas Hogar disponibles en un radio de 5 km. ¿Quieres que te muestre la ruta más segura?";
        } else if (text.includes('abrumada') || text.includes('no sé')) {
            return "Entiendo cómo te sientes. Respira conmigo un momento. Estoy aquí para ayudarte. ¿Quieres que te guíe con algo de calma o revisamos opciones seguras?";
        } else {
            return "Te escucho. Cuéntame un poco más sobre lo que está pasando, sin prisa. Este es un espacio seguro.";
        }
    }

    // Función principal para enviar mensaje
    function handleSendMessage() {
        const text = chatInput.value.trim();
        if (text === '') return;

        // Agregar mensaje del usuario
        addMessage(text, 'user');
        chatInput.value = '';

        // Simular respuesta de la IA después de 1.5 segundos
        setTimeout(() => {
            const aiResponse = getAIResponse(text);
            addMessage(aiResponse, 'ai');
        }, 1500);
    }

    // Event Listeners del Chat
    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    // --- 2. Botones de Acción Rápida ---
    window.sendQuickAction = function(actionText) {
        // Insertar mensaje automático
        addMessage(actionText, 'user');
        
        // Simular respuesta de la IA
        setTimeout(() => {
            const aiResponse = getAIResponse(actionText);
            addMessage(aiResponse, 'ai');
        }, 1500);
    };

    // --- 3. Toggle Modo Seguro ---
    const safeModeToggle = document.getElementById('safeModeToggle');
    const toast = document.getElementById('toast');

    safeModeToggle.addEventListener('change', () => {
        const isActive = safeModeToggle.checked;
        toast.textContent = isActive ? "Modo Seguro Activado" : "Modo Seguro Desactivado";
        toast.classList.add('show');
        
        // Ocultar toast después de 3 segundos
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);

        // Cambiar color del icono según estado (opcional)
        const icon = document.querySelector('.safe-mode-toggle i');
        icon.style.color = isActive ? 'var(--sage-green)' : '#ccc';
    });

    // --- 4. Menú Hamburguesa (Móvil) ---
    const menuBtn = document.getElementById('menuBtn');
    const navLinks = document.getElementById('navLinks');

    menuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // Cerrar menú al hacer clic en un enlace
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });

    // --- 5. Scroll Suave para el botón "Necesito ayuda ahora" ---
    window.scrollToChat = function() {
        document.getElementById('chatSection').scrollIntoView({ behavior: 'smooth' });
        // Enfocar el input después del scroll
        setTimeout(() => {
            chatInput.focus();
        }, 500);
    };
});