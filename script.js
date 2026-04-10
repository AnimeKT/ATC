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
    const vistaDetalle = document.getElementById('vista-detalle');
    const barraBusqueda = document.getElementById('barra-busqueda');

    // Ocultar todas primero
    vistaCatalogo.style.display = 'none';
    vistaRegistro.style.display = 'none';
    vistaDetalle.style.display = 'none';
    barraBusqueda.style.display = 'none';

    if (vista === 'registro') {
        vistaRegistro.style.display = 'block';
    } else if (vista === 'detalle') {
        vistaDetalle.style.display = 'block';
    } else {
        vistaCatalogo.style.display = 'block';
        barraBusqueda.style.display = 'block';
    }
    
    window.scrollTo(0, 0);
}

// =========================================
// RENDERIZAR VISTA DE DETALLES
// =========================================
function abrirDetalle(index) {
    const obra = todasLasObras[index];
    if (!obra) return;

    // Poblar datos visuales
    document.getElementById('det-banner').src = obra.banner_url || obra.portada_url;
    document.getElementById('det-portada').src = obra.portada_url;
    document.getElementById('det-titulo').textContent = obra.titulo;
    
    // Nombres alternativos
    let nombresAlt = [];
    if(obra.nombres_alternativos?.Japonés) nombresAlt.push(obra.nombres_alternativos.Japonés);
    if(obra.nombres_alternativos?.Ingles) nombresAlt.push(obra.nombres_alternativos.Ingles);
    document.getElementById('det-nombres-alt').textContent = nombresAlt.join(' • ');

    // Géneros
    const tagsContainer = document.getElementById('det-tags');
    tagsContainer.innerHTML = '';
    if(obra.generos && Array.isArray(obra.generos)) {
        obra.generos.forEach(g => {
            tagsContainer.innerHTML += `<span class="tag">${g}</span>`;
        });
    }

    // Información Lateral
    document.getElementById('det-estado').textContent = obra.estado || '--';
    document.getElementById('det-tipo').textContent = obra.tipo || '--';
    document.getElementById('det-estudio').textContent = obra.estudio || '--';
    document.getElementById('det-origen').textContent = obra.origen || '--';
    document.getElementById('det-dia').textContent = obra.dia_emision || '--';
    document.getElementById('det-estreno').textContent = obra.estreno || '--';
    document.getElementById('det-autor').textContent = obra.autor || '--';

    // Sinopsis
    document.getElementById('det-sinopsis').textContent = obra.sinopsis || 'No hay sinopsis registrada para esta obra.';

    // Temporadas y Enlaces (con integración de Telegram)
    const tempContainer = document.getElementById('det-temporadas');
    tempContainer.innerHTML = '';
    
    if(obra.temporadas && Array.isArray(obra.temporadas) && obra.temporadas.length > 0) {
        obra.temporadas.forEach(temp => {
            let enlacesHtml = '';
            if(temp.enlaces) {
                for(const [idioma, url] of Object.entries(temp.enlaces)) {
                    enlacesHtml += `<a href="${url}" target="_blank" class="btn-enlace"><i class="fa-brands fa-telegram"></i> ${idioma}</a>`;
                }
            }
            
            tempContainer.innerHTML += `
                <div class="temporada-card">
                    <h4>${temp.nombre || 'Temporada'}</h4>
                    <div class="enlaces-grid">${enlacesHtml}</div>
                </div>
            `;
        });
    } else {
        tempContainer.innerHTML = '<p class="text-muted">Aún no hay enlaces disponibles.</p>';
    }

    cambiarVista('detalle');
}

// =========================================
// REGISTRO DE OBRA COMPLEJA
// =========================================
async function ejecutarRegistro() {
    const btnPublicar = document.getElementById('btn-publicar');
    
    // Recolectar datos básicos
    const titulo = document.getElementById('in-titulo').value;
    const estado = document.getElementById('in-estado').value;
    const portada = document.getElementById('in-portada').value;
    const banner = document.getElementById('in-banner').value;
    const sinopsis = document.getElementById('in-sinopsis').value;
    
    if(!titulo || !portada) {
        return alert("⚠️ El título y la URL de la portada son obligatorios.");
    }

    // Estado de carga en el botón
    btnPublicar.disabled = true;
    btnPublicar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

    // Construir objetos y arreglos
    const nombresAlternativos = {
        "Japonés": document.getElementById('in-japones').value || "",
        "Ingles": document.getElementById('in-ingles').value || ""
    };

    const generosStr = document.getElementById('in-generos').value;
    const generosArray = generosStr ? generosStr.split(',').map(g => g.trim()).filter(g => g) : [];

    const autor = document.getElementById('in-autor').value;
    const estudio = document.getElementById('in-estudio').value;
    const tipo = document.getElementById('in-tipo').value;
    const origen = document.getElementById('in-origen').value;
    const estreno = document.getElementById('in-estreno').value;
    const diaEmision = document.getElementById('in-dia').value;

    let temporadasData = [];
    const temporadasRaw = document.getElementById('in-temporadas').value;
    if (temporadasRaw.trim() !== "") {
        try {
            temporadasData = JSON.parse(temporadasRaw);
        } catch (error) {
            btnPublicar.disabled = false;
            btnPublicar.textContent = 'Publicar en el Hub';
            return alert("⚠️ Error: El formato JSON de las Temporadas no es válido. Revisa los corchetes y comillas.");
        }
    }

    const slug = titulo.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

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

    try {
        const { error } = await _supabase.from('obras').insert([nuevaObra]);

        if (error) {
            if (error.code === '23505') {
                alert("⚠️ Error: Esta obra ya existe en la base de datos.");
            } else {
                // Notificación visual del error de base de datos
                alert("⚠️ Ocurrió un problema al guardar en Supabase: " + error.message);
                console.error("Detalles del Error de DB:", error);
            }
        } else {
            alert("✅ Obra registrada con éxito en el Hub.");
            document.querySelectorAll('#vista-registro input, #vista-registro textarea').forEach(input => input.value = '');
            cargarObras();
            cambiarVista('catalogo');
        }
    } catch(e) {
        alert("⚠️ Error de conexión: " + e.message);
    } finally {
        // Restaurar estado del botón
        btnPublicar.disabled = false;
        btnPublicar.textContent = 'Publicar en el Hub';
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

    todasLasObras = obras || []; 
    renderizarObras(todasLasObras);
}

function renderizarObras(obras) {
    const grid = document.getElementById('grid-obras');
    
    if (obras.length === 0) {
        grid.innerHTML = "<p style='color: #a1a1aa; grid-column: 1 / -1; text-align: center; padding: 40px;'>No se encontraron obras...</p>";
        return;
    }

    // Ahora pasamos el index de cada obra para poder abrir el detalle correcto
    grid.innerHTML = obras.map((obra, index) => {
        const claseEstado = obra.estado === 'Finalizado' ? 'estado-finalizado' : 'estado-emision';
        const estadoTexto = obra.estado || 'En emisión';

        return `
            <div class="tarjeta-anime" onclick="abrirDetalle(${index})">
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
        cambiarVista('catalogo');
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