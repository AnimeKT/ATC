// 1. Configuración
const SUPABASE_URL = "https://urmnngtfoavnmvbwqepq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybW5uZ3Rmb2F2bm12YndxZXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTE4NzcsImV4cCI6MjA5MTI4Nzg3N30.HnfoffLftMYWt2ZEkv1YEbG0vqRPWjB5IeQunj2I5cs";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Inicializar Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

let todasLasObras = []; 

// =========================================
// GESTIÓN DE VISTAS (Pestañas)
// =========================================
function cambiarVista(vista) {
    const vistaCatalogo = document.getElementById('vista-catalogo');
    const vistaRegistro = document.getElementById('vista-registro');
    const barraBusqueda = document.getElementById('barra-busqueda');

    if (vista === 'registro') {
        vistaCatalogo.style.display = 'none';
        barraBusqueda.style.display = 'none'; // Ocultar buscador al registrar
        vistaRegistro.style.display = 'block';
        window.scrollTo(0, 0);
    } else {
        vistaRegistro.style.display = 'none';
        vistaCatalogo.style.display = 'block';
        barraBusqueda.style.display = 'block';
    }
}

// =========================================
// REGISTRO DE OBRA COMPLEJA
// =========================================
async function ejecutarRegistro() {
    // Recolectar datos básicos
    const titulo = document.getElementById('in-titulo').value;
    const estado = document.getElementById('in-estado').value;
    const portada = document.getElementById('in-portada').value;
    const banner = document.getElementById('in-banner').value;
    const sinopsis = document.getElementById('in-sinopsis').value;
    
    if(!titulo || !portada) return alert("El título y la portada son obligatorios");

    // Construir objetos y arreglos a partir de los inputs
    const nombresAlternativos = {
        "Japonés": document.getElementById('in-japones').value || "",
        "Ingles": document.getElementById('in-ingles').value || ""
    };

    // Convertir string de géneros a un array limpio
    const generosStr = document.getElementById('in-generos').value;
    const generosArray = generosStr ? generosStr.split(',').map(g => g.trim()).filter(g => g) : [];

    const autor = document.getElementById('in-autor').value;
    const estudio = document.getElementById('in-estudio').value;
    const tipo = document.getElementById('in-tipo').value;
    const origen = document.getElementById('in-origen').value;
    const estreno = document.getElementById('in-estreno').value;
    const diaEmision = document.getElementById('in-dia').value;

    // Parsear el JSON de temporadas de forma segura
    let temporadasData = [];
    const temporadasRaw = document.getElementById('in-temporadas').value;
    if (temporadasRaw.trim() !== "") {
        try {
            temporadasData = JSON.parse(temporadasRaw);
        } catch (error) {
            return alert("⚠️ Error: El formato JSON de las Temporadas no es válido. Revisa los corchetes y comillas.");
        }
    }

    const slug = titulo.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

    // Construir el objeto final a enviar a Supabase
    const nuevaObra = {
        titulo: titulo,
        slug: slug,
        portada_url: portada,
        banner_url: banner,
        nombres_alternativos: nombresAlternativos,
        sinopsis: sinopsis,
        estado: estado,
        generos: generosArray,
        autor: autor,
        estudio: estudio,
        tipo: tipo,
        origen: origen,
        estreno: estreno,
        dia_emision: diaEmision,
        temporadas: temporadasData
    };

    const { error } = await _supabase.from('obras').insert([nuevaObra]);

    if (error) {
        if (error.code === '23505') alert("⚠️ Error: Esta obra ya existe.");
        else console.error("Error de DB:", error.message);
    } else {
        alert("✅ Obra registrada con éxito en el Hub.");
        // Limpiar el formulario y volver al catálogo
        document.querySelectorAll('#vista-registro input, #vista-registro textarea').forEach(input => input.value = '');
        cargarObras();
        cambiarVista('catalogo');
    }
}

// =========================================
// CARGA Y RENDERIZADO
// =========================================
async function cargarObras() {
    const { data: obras, error } = await _supabase
        .from('obras')
        .select('*')
        .order('fecha_creacion', { ascending: false });

    if (error) return console.error("Error cargando obras:", error);

    todasLasObras = obras; 
    renderizarObras(obras);
}

function renderizarObras(obras) {
    const grid = document.getElementById('grid-obras');
    
    if (obras.length === 0) {
        grid.innerHTML = "<p style='color: #a1a1aa; grid-column: 1 / -1; text-align: center; padding: 40px;'>No se encontraron obras...</p>";
        return;
    }

    grid.innerHTML = obras.map(obra => {
        const claseEstado = obra.estado === 'Finalizado' ? 'estado-finalizado' : 'estado-emision';
        const estadoTexto = obra.estado || 'En emisión';

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

// =========================================
// FILTROS Y BUSCADOR
// =========================================
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

document.getElementById('buscador').addEventListener('input', (e) => {
    const textoBuscado = e.target.value.toLowerCase();
    const filtradas = todasLasObras.filter(obra => 
        obra.titulo.toLowerCase().includes(textoBuscado)
    );
    renderizarObras(filtradas);
});

// =========================================
// SISTEMA DE AUTENTICACIÓN
// =========================================
const btnAdminView = document.getElementById('btn-admin-view');
const btnAuth = document.getElementById('btn-auth');
const authMensaje = document.getElementById('auth-mensaje');

_supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        btnAdminView.style.display = 'flex';
        btnAuth.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> <span class="hide-mobile">Salir</span>';
        btnAuth.onclick = cerrarSesion;
        cerrarModalAuth();
    } else {
        btnAdminView.style.display = 'none';
        btnAuth.innerHTML = '<i class="fa-solid fa-user"></i> <span class="hide-mobile">Ingresar</span>';
        btnAuth.onclick = abrirModalAuth;
        cambiarVista('catalogo'); // Si cierra sesión mientras está en la vista admin, lo devuelve
    }
});

_supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) btnAdminView.style.display = 'flex';
});

function abrirModalAuth() {
    document.getElementById('modal-auth').classList.add('modal-visible');
    authMensaje.textContent = '';
}

function cerrarModalAuth() {
    document.getElementById('modal-auth').classList.remove('modal-visible');
}

function obtenerEmailVirtual() {
    const user = tg.initDataUnsafe?.user;
    if (!user || !user.id) return null; 
    return `${user.id}@kaergsty.hub`;
}

async function registrarUsuario() {
    const virtualEmail = obtenerEmailVirtual();
    const password = document.getElementById('auth-password').value;

    if (!virtualEmail) return mostrarErrorAuth('Error: Abre esto desde la app de Telegram.');
    if (password.length < 6) return mostrarErrorAuth('La clave debe tener al menos 6 caracteres.');

    mostrarMensajeAuth('Procesando...', '#e0e0e0');
    const { error } = await _supabase.auth.signUp({ email: virtualEmail, password: password });
    
    if (error) mostrarErrorAuth(error.message);
    else mostrarMensajeAuth('¡Clave vinculada exitosamente!', '#10b981');
}

async function iniciarSesion() {
    const virtualEmail = obtenerEmailVirtual();
    const password = document.getElementById('auth-password').value;

    if (!virtualEmail) return mostrarErrorAuth('Error: Abre esto desde la app de Telegram.');

    mostrarMensajeAuth('Iniciando...', '#e0e0e0');
    const { error } = await _supabase.auth.signInWithPassword({ email: virtualEmail, password: password });

    if (error) mostrarErrorAuth('Error: Contraseña incorrecta.');
}

async function cerrarSesion() {
    await _supabase.auth.signOut();
}

function mostrarErrorAuth(msg) {
    authMensaje.style.color = '#ef4444';
    authMensaje.textContent = msg;
}
function mostrarMensajeAuth(msg, color) {
    authMensaje.style.color = color;
    authMensaje.textContent = msg;
}

// Arrancar al cargar la página
document.addEventListener('DOMContentLoaded', cargarObras);