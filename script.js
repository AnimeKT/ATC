// 1. Configuración (Intacta con tus llaves)
const SUPABASE_URL = "https://urmnngtfoavnmvbwqepq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybW5uZ3Rmb2F2bm12YndxZXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTE4NzcsImV4cCI6MjA5MTI4Nzg3N30.HnfoffLftMYWt2ZEkv1YEbG0vqRPWjB5IeQunj2I5cs";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Inicializar Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

// =========================================
// ESTADO GLOBAL DE LA APP
// =========================================
let todasLasObras = []; 
let obraActual = null; // Para saber qué obra estamos viendo
let posicionScrollGuardada = 0;
let timeoutBusqueda = null;
let listaFavoritos = [];

let filtrosActuales = {
    texto: '',
    estado: 'Todos',
    soloFavoritos: false
};

// =========================================
// INICIALIZACIÓN Y CLOUD STORAGE
// =========================================
async function inicializarApp() {
    // Verificamos si hay datos de Telegram para saber si estamos en la App
    if (tg.initData) {
        tg.CloudStorage.getItem('vistos_anime', (err, value) => {
            if (!err && value) {
                try { 
                    listaFavoritos = JSON.parse(value); 
                } catch (e) { 
                    listaFavoritos = []; 
                }
            }
            // Cargamos las obras después de intentar leer de la nube
            cargarObras(); 
        });
    } else {
        // Si estamos en VS Code (navegador normal), cargamos las obras directamente
        console.warn("⚠️ Ejecutando fuera de Telegram: CloudStorage no disponible.");
        cargarObras();
    }
}

// =========================================
// GESTIÓN DE VISTAS (Pestañas y Scroll)
// =========================================
function cambiarVista(vista) {
    const vistaCatalogo = document.getElementById('vista-catalogo');
    const vistaRegistro = document.getElementById('vista-registro');
    const vistaDetalle = document.getElementById('vista-detalle');
    const barraBusqueda = document.getElementById('barra-busqueda');

    // Preservar scroll si salimos del catálogo
    if (vistaCatalogo.style.display !== 'none') {
        posicionScrollGuardada = window.scrollY;
    }

    // Ocultar todas primero
    vistaCatalogo.style.display = 'none';
    vistaRegistro.style.display = 'none';
    vistaDetalle.style.display = 'none';
    barraBusqueda.style.display = 'none';

    if (vista === 'registro') {
        vistaRegistro.style.display = 'block';
        window.scrollTo(0, 0);
    } else if (vista === 'detalle') {
        vistaDetalle.style.display = 'block';
        window.scrollTo(0, 0);
    } else {
        vistaCatalogo.style.display = 'block';
        barraBusqueda.style.display = 'block';
        // Restaurar scroll al volver al catálogo
        setTimeout(() => window.scrollTo(0, posicionScrollGuardada), 10);
    }
}

function volverAlCatalogo() {
    tg.HapticFeedback.impactOccurred('light');
    cambiarVista('catalogo');
}

// =========================================
// RENDERIZAR VISTA DE DETALLES
// =========================================
// NOTA: Ahora busca por Título para evitar errores al filtrar
function abrirDetalle(tituloObra) {
    tg.HapticFeedback.impactOccurred('medium');
    obraActual = todasLasObras.find(o => o.titulo === tituloObra);
    if (!obraActual) return;

    // Poblar datos visuales
    document.getElementById('det-banner').src = obraActual.banner_url || obraActual.portada_url;
    document.getElementById('det-portada').src = obraActual.portada_url;
    document.getElementById('det-portada').style.opacity = 1; // Resetear opacidad por si cambió
    document.getElementById('det-titulo').textContent = obraActual.titulo;
    
    // Nombres alternativos
    let nombresAlt = [];
    if(obraActual.nombres_alternativos?.Japonés) nombresAlt.push(obraActual.nombres_alternativos.Japonés);
    if(obraActual.nombres_alternativos?.Ingles) nombresAlt.push(obraActual.nombres_alternativos.Ingles);
    document.getElementById('det-nombres-alt').textContent = nombresAlt.join(' • ');

    // Géneros (Mantenido exactamente como lo tenías)
    const tagsContainer = document.getElementById('det-tags');
    tagsContainer.innerHTML = '';
    if(obraActual.generos && Array.isArray(obraActual.generos)) {
        obraActual.generos.forEach(g => {
            tagsContainer.innerHTML += `<span class="tag">${g}</span>`;
        });
    }

    // Información Lateral
    document.getElementById('det-estado').textContent = obraActual.estado || '--';
    document.getElementById('det-tipo').textContent = obraActual.tipo || '--';
    document.getElementById('det-estudio').textContent = obraActual.estudio || '--';
    document.getElementById('det-origen').textContent = obraActual.origen || '--';
    document.getElementById('det-dia').textContent = obraActual.dia_emision || '--';
    document.getElementById('det-estreno').textContent = obraActual.estreno || '--';
    document.getElementById('det-autor').textContent = obraActual.autor || '--';

    // Sinopsis
    document.getElementById('det-sinopsis').textContent = obraActual.sinopsis || 'No hay sinopsis registrada para esta obra.';

    // Estado del botón favorito si existe en el HTML
    const btnFav = document.getElementById('btn-fav-detalle');
    if(btnFav) {
        if (listaFavoritos.includes(obraActual.titulo)) {
            btnFav.classList.add('favorito-activo');
            btnFav.innerHTML = '<i class="fa-solid fa-heart"></i>';
        } else {
            btnFav.classList.remove('favorito-activo');
            btnFav.innerHTML = '<i class="fa-regular fa-heart"></i>';
        }
    }
    

    // Iniciar el renderizado de Temporadas y Capítulos
    iniciarNavegacionContenido(obraActual.temporadas);
    cambiarVista('detalle');

    const panelAdminDetalle = document.getElementById('admin-options-detalle');
    if (panelAdminDetalle) {
        // Si el botón de "Añadir Obra" es visible, significa que eres Admin
        const esAdmin = document.getElementById('btn-admin-view').style.display === 'flex';
        
        if (esAdmin) {
            panelAdminDetalle.innerHTML = `
                <button onclick="prepararEdicion()" class="btn-editar-anime">
                    <i class="fa-solid fa-pen-to-square"></i> Editar este Anime
                </button>
            `;
        } else {
            panelAdminDetalle.innerHTML = ''; // Si no es admin, no ve nada
        }
    }
    
}

// =========================================
// JERARQUÍA DINÁMICA (Temporadas -> Idiomas -> Caps)
// =========================================
function iniciarNavegacionContenido(temporadasData) {
    // Usamos el contenedor que ya tienes en tu HTML original
    const contenedor = document.getElementById('det-temporadas');
    contenedor.innerHTML = '';

    if (!temporadasData || !Array.isArray(temporadasData) || temporadasData.length === 0) {
        contenedor.innerHTML = '<p class="text-muted">Aún no hay enlaces disponibles.</p>';
        return;
    }

    // Agrupar por "seccion" (ej: "Temporadas", "Universo Anime")
    const seccionesObj = {};
    temporadasData.forEach((temp) => {
        const nombreSeccion = temp.seccion || "Contenido Principal";
        if (!seccionesObj[nombreSeccion]) seccionesObj[nombreSeccion] = [];
        seccionesObj[nombreSeccion].push(temp);
    });

    // Renderizar botones agrupados por sección
    for (const [secName, temps] of Object.entries(seccionesObj)) {
        contenedor.innerHTML += `<h4 style="margin-top: 15px; margin-bottom: 10px; color: #3ba4fa; font-size: 14px;">${secName}</h4>`;
        
        temps.forEach((temp) => {
            const btn = document.createElement('button');
            btn.className = 'btn-dinamico'; // Usa la clase CSS que agregamos
            btn.style.cssText = "display: block; width: 100%; text-align: left; background: #18181b; border: 1px solid #27272a; padding: 12px; border-radius: 8px; color: white; margin-bottom: 8px; cursor: pointer;";
            btn.innerHTML = `<i class="fa-solid fa-folder-open" style="color: #3ba4fa; margin-right: 8px;"></i> ${temp.nombre}`;
            btn.onclick = () => mostrarIdiomas(temp);
            contenedor.appendChild(btn);
        });
    }
}

function mostrarIdiomas(temporadaObj) {
    tg.HapticFeedback.impactOccurred('light');
    const contenedor = document.getElementById('det-temporadas');
    
    // Botón para volver atrás
    contenedor.innerHTML = `<button onclick="iniciarNavegacionContenido(obraActual.temporadas)" style="background: transparent; border: none; color: #a1a1aa; padding-bottom: 15px; cursor: pointer; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-chevron-left"></i> Volver a Temporadas</button>`;

    // Cambiar el póster dinámicamente si la temporada trae una imagen
    if(temporadaObj.imagen && temporadaObj.imagen !== "") {
        const imgPortada = document.getElementById('det-portada');
        imgPortada.style.opacity = 0.3; // Efecto suave
        setTimeout(() => {
            imgPortada.src = temporadaObj.imagen;
            imgPortada.style.opacity = 1;
        }, 150);
    }

    // Renderizar Idiomas ("Japonés", "Latino")
    if (temporadaObj.enlaces) {
        for (const [idioma, capitulos] of Object.entries(temporadaObj.enlaces)) {
            const btn = document.createElement('button');
            btn.style.cssText = "display: block; width: 100%; text-align: left; background: #18181b; border: 1px solid #27272a; padding: 12px; border-radius: 8px; color: white; margin-bottom: 8px; cursor: pointer;";
            btn.innerHTML = `<i class="fa-solid fa-language" style="color: #10b981; margin-right: 8px;"></i> Audio: ${idioma}`;
            btn.onclick = () => mostrarCapitulos(capitulos, temporadaObj);
            contenedor.appendChild(btn);
        }
    }
}

function mostrarCapitulos(capitulosObj, temporadaPadre) {
    tg.HapticFeedback.impactOccurred('light');
    const contenedor = document.getElementById('det-temporadas');
    
    // Botón para volver a los idiomas
    contenedor.innerHTML = `<button onclick="mostrarIdiomas(obraActual.temporadas.find(t => t.nombre === '${temporadaPadre.nombre}'))" style="background: transparent; border: none; color: #a1a1aa; padding-bottom: 15px; cursor: pointer; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-chevron-left"></i> Volver a Idiomas</button>`;

    // Renderizar cada capítulo ("CAP 1", "CAP 2")
    for (const [capitulo, url] of Object.entries(capitulosObj)) {
        const btn = document.createElement('button');
        btn.style.cssText = "display: block; width: 100%; text-align: left; background: #18181b; border: 1px solid #3ba4fa; padding: 12px; border-radius: 8px; color: white; margin-bottom: 8px; cursor: pointer;";
        btn.innerHTML = `<i class="fa-solid fa-play" style="color: #3ba4fa; margin-right: 8px;"></i> ${capitulo}`;
        btn.onclick = () => abrirEnlaceTelegram(url);
        contenedor.appendChild(btn);
    }
}

function abrirEnlaceTelegram(url) {
    tg.HapticFeedback.impactOccurred('heavy');
    if (url.includes('t.me')) {
        tg.openTelegramLink(url);
    } else {
        tg.openLink(url);
    }
}

// =========================================
// FAVORITOS Y COMPARTIR
// =========================================
function toggleFavoritoActual() {
    if (!obraActual) return;
    tg.HapticFeedback.impactOccurred('medium');
    
    const index = listaFavoritos.indexOf(obraActual.titulo);
    const btnFav = document.getElementById('btn-fav-detalle');

    if (index > -1) {
        listaFavoritos.splice(index, 1);
        if(btnFav) {
            btnFav.classList.remove('favorito-activo');
            btnFav.innerHTML = '<i class="fa-regular fa-heart"></i>';
        }
    } else {
        listaFavoritos.push(obraActual.titulo);
        if(btnFav) {
            btnFav.classList.add('favorito-activo');
            btnFav.innerHTML = '<i class="fa-solid fa-heart" style="color: #ef4444;"></i>';
        }
    }

    // Guardar en la nube de Telegram
    tg.CloudStorage.setItem('vistos_anime', JSON.stringify(listaFavoritos));
    if(filtrosActuales.soloFavoritos) aplicarTodosLosFiltros();
}

function compartirObraActual() {
    if (!obraActual) return;
    tg.HapticFeedback.impactOccurred('medium');
    
    const botUsername = "TuBotUsername"; // Pon el @ de tu bot aquí si tienes
    const slugFormateado = obraActual.titulo.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^\w_]+/g, '');
    const enlaceStartapp = `https://t.me/${botUsername}?startapp=${slugFormateado}`;
    
    navigator.clipboard.writeText(enlaceStartapp).then(() => {
        tg.showAlert("✅ Enlace copiado. ¡Pégalo en cualquier chat de Telegram para compartir este anime!");
    });
}

function toggleFiltroFavoritos() {
    tg.HapticFeedback.impactOccurred('medium');
    filtrosActuales.soloFavoritos = !filtrosActuales.soloFavoritos;
    const btn = document.getElementById('btn-filtro-fav');
    
    if (filtrosActuales.soloFavoritos) {
        if(btn) { btn.classList.add('active'); btn.style.color = '#ef4444'; }
    } else {
        if(btn) { btn.classList.remove('active'); btn.style.color = ''; }
    }
    aplicarTodosLosFiltros();
}

// =========================================
// FILTROS, BUSCADOR Y RENDERIZADO CATÁLOGO
// =========================================
async function cargarObras() {
    const { data: obras, error } = await _supabase
        .from('obras')
        .select('*')
        .order('fecha_creacion', { ascending: false });

    if (error) return console.error("Error cargando obras:", error);

    todasLasObras = obras || []; 
    aplicarTodosLosFiltros();

    // Detección de link compartido (Deep Linking) al abrir la app
    const startParam = tg.initDataUnsafe?.start_param;
    if (startParam) {
        const tituloEsperado = startParam.replace(/_/g, ' '); // Convierte guiones bajos a espacios
        const obraSolicitada = todasLasObras.find(o => o.titulo.toLowerCase().includes(tituloEsperado));
        if (obraSolicitada) abrirDetalle(obraSolicitada.titulo);
    }
}

function aplicarTodosLosFiltros() {
    const resultado = todasLasObras.filter(obra => {
        // 1. Filtro Búsqueda
        const tituloMatch = obra.titulo.toLowerCase().includes(filtrosActuales.texto);
        const altJap = obra.nombres_alternativos?.Japonés?.toLowerCase() || '';
        const altIng = obra.nombres_alternativos?.Ingles?.toLowerCase() || '';
        const textoMatch = tituloMatch || altJap.includes(filtrosActuales.texto) || altIng.includes(filtrosActuales.texto);

        // 2. Filtro Estado
        const estadoMatch = filtrosActuales.estado === 'Todos' || obra.estado === filtrosActuales.estado;

        // 3. Filtro Favoritos
        const favMatch = !filtrosActuales.soloFavoritos || listaFavoritos.includes(obra.titulo);

        return textoMatch && estadoMatch && favMatch;
    });

    renderizarObras(resultado);
}

// Optimización Buscador
document.getElementById('buscador').addEventListener('input', (e) => {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(() => {
        filtrosActuales.texto = e.target.value.toLowerCase();
        aplicarTodosLosFiltros();
    }, 300);
});

// Reemplaza tu antigua función de filtrar
function filtrar(estado, evento) {
    tg.HapticFeedback.impactOccurred('light');
    document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('active'));
    if(evento) evento.currentTarget.classList.add('active');

    filtrosActuales.estado = estado;
    aplicarTodosLosFiltros();
}

function renderizarObras(obras) {
    const grid = document.getElementById('grid-obras');
    
    if (obras.length === 0) {
        grid.innerHTML = "<p style='color: #a1a1aa; grid-column: 1 / -1; text-align: center; padding: 40px;'>No se encontraron obras...</p>";
        return;
    }

    // EL GRAN CAMBIO PARA EVITAR BUGS: Ahora enviamos el TITULO en vez de index numérico
    grid.innerHTML = obras.map(obra => {
        const claseEstado = obra.estado === 'Finalizado' ? 'estado-finalizado' : 'estado-emision';
        const estadoTexto = obra.estado || 'En emisión';
        // Usamos comillas simples e ignoramos comillas en el título para evitar romper el string
        const tituloSeguro = obra.titulo.replace(/'/g, "\\'"); 

        return `
            <div class="tarjeta-anime" onclick="abrirDetalle('${tituloSeguro}')">
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
// REGISTRO DE OBRA COMPLEJA (INTACTO)
// =========================================
async function ejecutarRegistro() {
    const btnPublicar = document.getElementById('btn-publicar');
    const vistaRegistro = document.getElementById('vista-registro');
    
    // Aquí detectamos si estamos editando o creando uno nuevo
    const idParaEditar = vistaRegistro.dataset.editId;

    // Recolectar datos de los inputs (usando tus IDs: in-titulo, in-estado, etc.)
    const titulo = document.getElementById('in-titulo').value;
    const estado = document.getElementById('in-estado').value;
    const portada = document.getElementById('in-portada').value;
    const banner = document.getElementById('in-banner').value;
    const sinopsis = document.getElementById('in-sinopsis').value;
    
    if(!titulo || !portada) {
        return alert("⚠️ El título y la URL de la portada son obligatorios.");
    }

    btnPublicar.disabled = true;
    btnPublicar.innerHTML = idParaEditar ? '<i class="fa-solid fa-spinner fa-spin"></i> Actualizando...' : '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

    const generosStr = document.getElementById('in-generos').value;
    const generosArray = generosStr ? generosStr.split(',').map(g => g.trim()).filter(g => g) : [];

    let temporadasData = [];
    try {
        const tempVal = document.getElementById('in-temporadas').value;
        temporadasData = tempVal.trim() !== "" ? JSON.parse(tempVal) : [];
    } catch (e) {
        btnPublicar.disabled = false;
        btnPublicar.textContent = 'Publicar en el Hub';
        return alert("⚠️ Error: El JSON de las temporadas está mal escrito.");
    }

    const datosObra = {
        titulo: titulo,
        slug: titulo.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
        portada_url: portada,
        banner_url: banner,
        nombres_alternativos: {
            "Japonés": document.getElementById('in-japones').value || "",
            "Ingles": document.getElementById('in-ingles').value || ""
        },
        sinopsis: sinopsis,
        estado: estado,
        generos: generosArray,
        autor: document.getElementById('in-autor').value,
        estudio: document.getElementById('in-estudio').value,
        tipo: document.getElementById('in-tipo').value,
        origen: document.getElementById('in-origen').value,
        estreno: document.getElementById('in-estreno').value,
        dia_emision: document.getElementById('in-dia').value,
        temporadas: temporadasData
    };

    try {
        let error;
        if (idParaEditar) {
            // MODO EDITAR
            const res = await _supabase.from('obras').update(datosObra).eq('id', idParaEditar);
            error = res.error;
        } else {
            // MODO NUEVO
            const res = await _supabase.from('obras').insert([datosObra]);
            error = res.error;
        }

        if (error) throw error;

        alert(idParaEditar ? "✅ ¡Actualizado con éxito!" : "✅ ¡Publicado con éxito!");
        
        // Limpiamos todo
        delete vistaRegistro.dataset.editId;
        document.querySelectorAll('#vista-registro input, #vista-registro textarea').forEach(i => i.value = '');
        btnPublicar.textContent = 'Publicar en el Hub';
        
        cargarObras();
        cambiarVista('catalogo');

    } catch(e) {
        alert("⚠️ Error: " + e.message);
    } finally {
        btnPublicar.disabled = false;
    }
}


// =========================================
// SISTEMA DE AUTENTICACIÓN (INTACTO)
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
    
    // Si estamos en PC y no detecta el ID, usamos uno de prueba para que no te bloquee
    if (!user || !user.id) {
        console.warn("⚠️ No se detectó ID de Telegram. Usando modo desarrollo.");
        return "admin@test.com"; // O pon aquí un correo fijo para tus pruebas en PC
    } 
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
function prepararEdicion() {
    if (!obraActual) return;

    // 1. Vamos a la vista de registro
    cambiarVista('registro');

    // 2. Llenamos los campos con la info que ya tiene el anime
    document.getElementById('in-titulo').value = obraActual.titulo || '';
    document.getElementById('in-estado').value = obraActual.estado || 'En emisión';
    document.getElementById('in-portada').value = obraActual.portada_url || '';
    document.getElementById('in-banner').value = obraActual.banner_url || '';
    document.getElementById('in-sinopsis').value = obraActual.sinopsis || '';
    document.getElementById('in-japones').value = obraActual.nombres_alternativos?.Japonés || '';
    document.getElementById('in-ingles').value = obraActual.nombres_alternativos?.Ingles || '';
    document.getElementById('in-generos').value = (obraActual.generos || []).join(', ');
    document.getElementById('in-autor').value = obraActual.autor || '';
    document.getElementById('in-estudio').value = obraActual.estudio || '';
    document.getElementById('in-tipo').value = obraActual.tipo || 'TV';
    document.getElementById('in-origen').value = obraActual.origen || '';
    document.getElementById('in-estreno').value = obraActual.estreno || '';
    document.getElementById('in-dia').value = obraActual.dia_emision || '';
    document.getElementById('in-temporadas').value = JSON.stringify(obraActual.temporadas || [], null, 2);

    // 3. Guardamos el ID para que 'ejecutarRegistro' sepa que es una edición
    document.getElementById('vista-registro').dataset.editId = obraActual.id;
    
    // 4. Cambiamos el texto del botón
    document.getElementById('btn-publicar').textContent = "Actualizar Anime en el Hub";
}

// Arrancar al cargar la página (Reemplaza el viejo DOMContentLoaded)
document.addEventListener('DOMContentLoaded', inicializarApp);