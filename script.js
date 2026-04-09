// 1. Configuración
const SUPABASE_URL = "https://urmnngtfoavnmvbwqepq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybW5uZ3Rmb2F2bm12YndxZXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTE4NzcsImV4cCI6MjA5MTI4Nzg3N30.HnfoffLftMYWt2ZEkv1YEbG0vqRPWjB5IeQunj2I5cs";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Inicializar Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand(); // Expande la app para ocupar toda la pantalla en Telegram

let todasLasObras = []; 

// 2. Función de Registro
async function ejecutarRegistro() {
    const titulo = document.getElementById('input-titulo').value;
    const portada = document.getElementById('input-portada').value;
    const sinopsis = document.getElementById('input-sinopsis').value;
    const estado = document.getElementById('input-estado').value;

    if(!titulo || !portada) return alert("El título y la portada son obligatorios");
    
    const slug = titulo.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

    const { error } = await _supabase
        .from('obras')
        .insert([{ titulo, slug, sinopsis, portada_url: portada, estado }]);

    if (error) {
        if (error.code === '23505') alert("⚠️ Error: Esta obra ya existe.");
        else console.error("Error:", error.message);
    } else {
        alert("✅ Obra registrada.");
        document.getElementById('input-titulo').value = "";
        document.getElementById('input-portada').value = "";
        document.getElementById('input-sinopsis').value = "";
        cargarObras();
    }
}

// 3. Cargar Obras desde Supabase
async function cargarObras() {
    const { data: obras, error } = await _supabase
        .from('obras')
        .select('*')
        .order('fecha_creacion', { ascending: false });

    if (error) return console.error("Error cargando obras:", error);

    todasLasObras = obras; 
    renderizarObras(obras);
}

// 4. Dibujar el HTML
function renderizarObras(obras) {
    const grid = document.getElementById('grid-obras');
    
    if (obras.length === 0) {
        grid.innerHTML = "<p style='color: #a1a1aa; grid-column: 1 / -1;'>No se encontraron obras...</p>";
        return;
    }

    grid.innerHTML = obras.map(obra => {
        const claseEstado = obra.estado === 'Finalizado' ? 'estado-finalizado' : 'estado-emision';
        const estadoTexto = obra.estado || 'Emisión';

        return `
            <div class="tarjeta-anime">
                <div class="estado-badge ${claseEstado}">${estadoTexto}</div>
                <img src="${obra.portada_url}" alt="${obra.titulo}">
                <div class="info-tarjeta">
                    <div class="titulo-tarjeta">${obra.titulo}</div>
                </div>
            </div>
        `;
    }).join('');
}

// 5. Botones de Filtro
function filtrar(estado, evento) {
    document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('active'));
    evento.currentTarget.classList.add('active');

    if (estado === 'Todos') {
        renderizarObras(todasLasObras);
    } else {
        const filtradas = todasLasObras.filter(obra => obra.estado === estado);
        renderizarObras(filtradas);
    }
}

// 6. Buscador Mágico (En tiempo real)
document.getElementById('buscador').addEventListener('input', (e) => {
    const textoBuscado = e.target.value.toLowerCase();
    const filtradas = todasLasObras.filter(obra => 
        obra.titulo.toLowerCase().includes(textoBuscado)
    );
    renderizarObras(filtradas);
});

// =========================================
// 7. Sistema de Autenticación con Telegram
// =========================================

const adminPanel = document.getElementById('panel-admin');
const btnAuth = document.getElementById('btn-auth');
const authMensaje = document.getElementById('auth-mensaje');

// Escuchar cambios en la sesión
_supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        adminPanel.style.display = 'block';
        btnAuth.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Salir';
        btnAuth.onclick = cerrarSesion;
        cerrarModalAuth();
    } else {
        adminPanel.style.display = 'none';
        btnAuth.innerHTML = '<i class="fa-solid fa-user"></i> Ingresar';
        btnAuth.onclick = abrirModalAuth;
    }
});

// Verificar sesión inicial
_supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) adminPanel.style.display = 'block';
});

function abrirModalAuth() {
    document.getElementById('modal-auth').classList.add('modal-visible');
    authMensaje.textContent = '';
}

function cerrarModalAuth() {
    document.getElementById('modal-auth').classList.remove('modal-visible');
}

// Función auxiliar para crear el usuario basado en Telegram
function obtenerEmailVirtual() {
    const user = tg.initDataUnsafe?.user;
    if (!user || !user.id) {
        return null; // Retorna null si no se abre desde Telegram
    }
    return `${user.id}@kaergsty.hub`;
}

// Registrar Usuario (Vincular Clave)
async function registrarUsuario() {
    const virtualEmail = obtenerEmailVirtual();
    const password = document.getElementById('auth-password').value;

    if (!virtualEmail) {
        authMensaje.style.color = '#ef4444';
        authMensaje.textContent = 'Error: Abre esto desde la app de Telegram.';
        return;
    }

    if (password.length < 6) {
        authMensaje.style.color = '#ef4444';
        authMensaje.textContent = 'La clave debe tener al menos 6 caracteres.';
        return;
    }

    authMensaje.style.color = '#e0e0e0';
    authMensaje.textContent = 'Procesando...';

    const { data, error } = await _supabase.auth.signUp({
        email: virtualEmail,
        password: password,
    });

    if (error) {
        authMensaje.style.color = '#ef4444';
        authMensaje.textContent = error.message;
    } else {
        authMensaje.style.color = '#10b981';
        authMensaje.textContent = '¡Clave vinculada exitosamente!';
    }
}

// Iniciar Sesión
async function iniciarSesion() {
    const virtualEmail = obtenerEmailVirtual();
    const password = document.getElementById('auth-password').value;

    if (!virtualEmail) {
        authMensaje.style.color = '#ef4444';
        authMensaje.textContent = 'Error: Abre esto desde la app de Telegram.';
        return;
    }

    authMensaje.style.color = '#e0e0e0';
    authMensaje.textContent = 'Iniciando...';

    const { data, error } = await _supabase.auth.signInWithPassword({
        email: virtualEmail,
        password: password,
    });

    if (error) {
        authMensaje.style.color = '#ef4444';
        authMensaje.textContent = 'Error: Contraseña incorrecta.';
    }
}

// Cerrar Sesión
async function cerrarSesion() {
    await _supabase.auth.signOut();
}

// Arrancar al cargar la página
document.addEventListener('DOMContentLoaded', cargarObras);