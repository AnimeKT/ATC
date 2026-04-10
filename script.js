// 1. Configuración de Supabase
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
let obraActual = null; 
let posicionScrollGuardada = 0;
let timeoutBusqueda = null;
let listaFavoritos = [];

let filtrosActuales = {
    texto: '',
    estado: 'Todos',
    soloFavoritos: false
};

// =========================================
// INICIALIZACIÓN (A PRUEBA DE MÓVILES)
// =========================================
async function inicializarApp() {
    // 1. Cargamos las obras INMEDIATAMENTE para que el móvil no se quede en blanco
    await cargarObras(); 

    // 2. Cargamos los favoritos en segundo plano sin detener la aplicación
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        tg.CloudStorage.getItem('vistos_anime', (err, value) => {
            if (!err && value) {
                try { listaFavoritos = JSON.parse(value); } 
                catch (e) { listaFavoritos = []; }
            }
        });
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

    if (vistaCatalogo.style.display !== 'none') {
        posicionScrollGuardada = window.scrollY;
    }

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
function abrirDetalle(tituloObra) {
    tg.HapticFeedback.impactOccurred('medium');
    obraActual = todasLasObras.find(o => o.titulo === tituloObra);
    if (!obraActual) return;

    // Poblar datos con protección por si falta algún dato en la base de datos
    document.getElementById('det-banner').src = obraActual.banner_url || obraActual.portada_url || '';
    const imgPort = document.getElementById('det-portada');
    imgPort.src = obraActual.portada_url || '';
    imgPort.style.opacity = 1;
    document.getElementById('det-titulo').textContent = obraActual.titulo || 'Sin título';
    
    // Nombres alternativos seguros
    let nombresAlt = [];
    if(obraActual.nombres_alternativos?.Japonés) nombresAlt.push(obraActual.nombres_alternativos.Japonés);
    if(obraActual.nombres_alternativos?.Ingles) nombresAlt.push(obraActual.nombres_alternativos.Ingles);
    document.getElementById('det-nombres-alt').textContent = nombresAlt.join(' • ');

    const tagsContainer = document.getElementById('det-tags');
    tagsContainer.innerHTML = '';
    if(Array.isArray(obraActual.generos)) {
        obraActual.generos.forEach(g => {
            tagsContainer.innerHTML += `<span class="tag">${g}</span>`;
        });
    }

    document.getElementById('det-estado').textContent = obraActual.estado || '--';
    document.getElementById('det-tipo').textContent = obraActual.tipo || '--';
    document.getElementById('det-estudio').textContent = obraActual.estudio || '--';
    document.getElementById('det-origen').textContent = obraActual.origen || '--';
    document.getElementById('det-dia').textContent = obraActual.dia_emision || '--';
    document.getElementById('det-estreno').textContent = obraActual.estreno || '--';
    document.getElementById('det-autor').textContent = obraActual.autor || '--';
    document.getElementById('det-sinopsis').textContent = obraActual.sinopsis || 'Sin descripción.';

    // Botón de edición inteligente
    const panelAdmin = document.getElementById('admin-options-detalle');
    if (panelAdmin) {
        const btnAdminView = document.getElementById('btn-admin-view');
        const esAdmin = btnAdminView && btnAdminView.style.display !== 'none';
        
        panelAdmin.innerHTML = esAdmin ? `
            <button onclick="prepararEdicion()" class="btn-editar-discreto">
                <i class="fa-solid fa-pen-to-square"></i> Editar Información
            </button>
        ` : '';
    }

    iniciarNavegacionContenido(obraActual.temporadas);
    cambiarVista('detalle');
}

// =========================================
// JERARQUÍA DINÁMICA (Temporadas -> Idiomas -> Caps)
// =========================================
function iniciarNavegacionContenido(temporadasData) {
    const contenedor = document.getElementById('det-temporadas');
    contenedor.innerHTML = '';

    if (!temporadasData || !Array.isArray(temporadasData) || temporadasData.length === 0) {
        contenedor.innerHTML = '<p class="text-muted" style="color: #a1a1aa;">Aún no hay enlaces disponibles.</p>';
        return;
    }

    const seccionesObj = {};
    temporadasData.forEach((temp) => {
        const nombreSeccion = temp.seccion || "Contenido Principal";
        if (!seccionesObj[nombreSeccion]) seccionesObj[nombreSeccion] = [];
        seccionesObj[nombreSeccion].push(temp);
    });

    for (const [secName, temps] of Object.entries(seccionesObj)) {
        contenedor.innerHTML += `<h4 style="margin-top: 15px; margin-bottom: 10px; color: #3ba4fa; font-size: 14px;">${secName}</h4>`;
        
        temps.forEach((temp) => {
            const btn = document.createElement('button');
            btn.className = 'btn-dinamico';
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
    
    contenedor.innerHTML = `<button onclick="iniciarNavegacionContenido(obraActual.temporadas)" style="background: transparent; border: none; color: #a1a1aa; padding-bottom: 15px; cursor: pointer; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-chevron-left"></i> Volver a Temporadas</button>`;

    if(temporadaObj.imagen && temporadaObj.imagen !== "") {
        const imgPortada = document.getElementById('det-portada');
        imgPortada.style.opacity = 0.3;
        setTimeout(() => {
            imgPortada.src = temporadaObj.imagen;
            imgPortada.style.opacity = 1;
        }, 150);
    }

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
    
    contenedor.innerHTML = `<button onclick="mostrarIdiomas(obraActual.temporadas.find(t => t.nombre === '${temporadaPadre.nombre}'))" style="background: transparent; border: none; color: #a1a1aa; padding-bottom: 15px; cursor: pointer; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-chevron-left"></i> Volver a Idiomas</button>`;

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
}

function aplicarTodosLosFiltros() {
    const resultado = todasLasObras.filter(obra => {
        const tituloMatch = obra.titulo.toLowerCase().includes(filtrosActuales.texto);
        const altJap = obra.nombres_alternativos?.Japonés?.toLowerCase() || '';
        const altIng = obra.nombres_alternativos?.Ingles?.toLowerCase() || '';
        const textoMatch = tituloMatch || altJap.includes(filtrosActuales.texto) || altIng.includes(filtrosActuales.texto);
        const estadoMatch = filtrosActuales.estado === 'Todos' || obra.estado === filtrosActuales.estado;

        return textoMatch && estadoMatch;
    });

    renderizarObras(resultado);
}

document.getElementById('buscador').addEventListener('input', (e) => {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(() => {
        filtrosActuales.texto = e.target.value.toLowerCase();
        aplicarTodosLosFiltros();
    }, 300);
});

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

    grid.innerHTML = obras.map(obra => {
        const claseEstado = obra.estado === 'Finalizado' ? 'estado-finalizado' : 'estado-emision';
        const estadoTexto = obra.estado || 'En emisión';
        
        // Evitamos que comillas raras rompan el HTML en celulares
        const tituloSeguro = obra.titulo.replace(/'/g, "\\'").replace(/"/g, '&quot;'); 

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
// REGISTRO Y EDICIÓN DE OBRAS
// =========================================
async function ejecutarRegistro() {
    const btnPublicar = document.getElementById('btn-publicar');
    const vistaRegistro = document.getElementById('vista-registro');
    
    const idParaEditar = vistaRegistro.dataset.editId;
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

    const temporadasData = recolectarDatosTemporadas();

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
            const res = await _supabase.from('obras').update(datosObra).eq('id', idParaEditar);
            error = res.error;
        } else {
            const res = await _supabase.from('obras').insert([datosObra]);
            error = res.error;
        }

        if (error) throw error;

        alert(idParaEditar ? "✅ ¡Actualizado con éxito!" : "✅ ¡Publicado con éxito!");
        
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

function prepararEdicion() {
    if (!obraActual) return;
    cambiarVista('registro');

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
    cargarDatosTemporadas(obraActual.temporadas || []);

    document.getElementById('vista-registro').dataset.editId = obraActual.id;
    document.getElementById('btn-publicar').textContent = "Actualizar Anime en el Hub";
}

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
    if (!user || !user.id) return "admin_pc@kaergsty.hub"; 
    return `${user.id}@kaergsty.hub`;
}

async function registrarUsuario() {
    const virtualEmail = obtenerEmailVirtual();
    const password = document.getElementById('auth-password').value;

    if (password.length < 6) return mostrarErrorAuth('La clave debe tener al menos 6 caracteres.');

    mostrarMensajeAuth('Procesando...', '#e0e0e0');
    const { error } = await _supabase.auth.signUp({ email: virtualEmail, password: password });
    
    if (error) mostrarErrorAuth(error.message);
    else mostrarMensajeAuth('¡Clave vinculada exitosamente!', '#10b981');
}

async function iniciarSesion() {
    const virtualEmail = obtenerEmailVirtual();
    const password = document.getElementById('auth-password').value;

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

// =========================================
// CONSTRUCTOR VISUAL DE TEMPORADAS
// =========================================

function agregarTemporadaUI(datos = null) {
    const container = document.getElementById('builder-temporadas');
    const tId = 'temp_' + Math.random().toString(36).substr(2, 9); // ID único

    // Valores por defecto si estamos editando
    const seccion = datos?.seccion || "Contenido Principal";
    const nombre = datos?.nombre || "";
    const imagen = datos?.imagen || "";

    const div = document.createElement('div');
    div.className = 'admin-panel temporada-block';
    div.style.padding = '15px';
    div.style.marginBottom = '10px';
    div.style.borderLeft = '3px solid #3ba4fa';

    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="color: #3ba4fa; margin: 0; font-size: 14px;"><i class="fa-solid fa-folder"></i> Bloque de Contenido</h4>
            <button type="button" onclick="this.parentElement.parentElement.remove()" style="background: transparent; border: none; color: #ef4444; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="form-grid-complex" style="margin-bottom: 15px;">
            <div class="input-group">
                <label>Sección (Ej: Principal, Extras)</label>
                <input type="text" class="temp-seccion" value="${seccion}">
            </div>
            <div class="input-group">
                <label>Nombre (Ej: Temporada 1)</label>
                <input type="text" class="temp-nombre" value="${nombre}" placeholder="Obligatorio">
            </div>
            <div class="input-group full-width">
                <label>URL de Imagen Portada (Opcional)</label>
                <input type="text" class="temp-imagen" value="${imagen}" placeholder="https://...">
            </div>
        </div>
        <div id="idiomas_${tId}"></div>
        <button type="button" class="btn-filtro" onclick="agregarIdiomaUI('${tId}')" style="margin-top: 10px; font-size: 12px; padding: 6px 12px;">
            <i class="fa-solid fa-language"></i> Añadir Idioma
        </button>
    `;
    container.appendChild(div);

    // Cargar idiomas y capítulos si existen
    if (datos?.enlaces) {
        for (const [idioma, capitulos] of Object.entries(datos.enlaces)) {
            agregarIdiomaUI(tId, idioma, capitulos);
        }
    } else if (!datos) {
        agregarIdiomaUI(tId); // Si es nuevo, añade un idioma vacío por defecto
    }
}

function agregarIdiomaUI(tempId, idiomaNombre = "", capitulos = null) {
    const container = document.getElementById(`idiomas_${tempId}`);
    const iId = 'idio_' + Math.random().toString(36).substr(2, 9);

    const div = document.createElement('div');
    div.className = 'idioma-block';
    div.style.background = '#121214';
    div.style.padding = '12px';
    div.style.borderRadius = '8px';
    div.style.marginTop = '10px';
    div.style.border = '1px dashed #27272a';

    div.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
            <input type="text" class="idioma-nombre" value="${idiomaNombre}" placeholder="Ej: Japonés Sub Español" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white;">
            <button type="button" onclick="this.parentElement.parentElement.remove()" style="background: transparent; border: none; color: #ef4444; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="caps_${iId}" style="display: flex; flex-direction: column; gap: 8px;"></div>
        <button type="button" onclick="agregarCapituloUI('${iId}')" style="background: transparent; border: 1px solid #10b981; color: #10b981; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; margin-top: 8px;">
            <i class="fa-solid fa-plus"></i> Añadir Capítulo
        </button>
    `;
    container.appendChild(div);

    if (capitulos) {
        for (const [capNombre, url] of Object.entries(capitulos)) {
            agregarCapituloUI(iId, capNombre, url);
        }
    } else {
        agregarCapituloUI(iId); // Capítulo vacío por defecto
    }
}

function agregarCapituloUI(idiomaId, nombre = "", url = "") {
    const container = document.getElementById(`caps_${idiomaId}`);
    const div = document.createElement('div');
    div.className = 'capitulo-row';
    div.style.display = 'flex';
    div.style.gap = '8px';

    div.innerHTML = `
        <input type="text" class="cap-nombre" value="${nombre}" placeholder="Ej: Episodio 1" style="width: 120px; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white; font-size: 12px;">
        <input type="text" class="cap-url" value="${url}" placeholder="https://t.me/..." style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white; font-size: 12px;">
        <button type="button" onclick="this.parentElement.remove()" style="background: transparent; border: none; color: #71717a; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
    `;
    container.appendChild(div);
}

function recolectarDatosTemporadas() {
    const datos = [];
    document.querySelectorAll('.temporada-block').forEach(tempBlock => {
        const seccion = tempBlock.querySelector('.temp-seccion').value.trim() || "Contenido Principal";
        const nombre = tempBlock.querySelector('.temp-nombre').value.trim();
        const imagen = tempBlock.querySelector('.temp-imagen').value.trim();

        if (!nombre) return; // Se salta temporadas sin nombre

        const enlaces = {};
        tempBlock.querySelectorAll('.idioma-block').forEach(idiomaBlock => {
            const idiomaNombre = idiomaBlock.querySelector('.idioma-nombre').value.trim();
            if (!idiomaNombre) return;

            enlaces[idiomaNombre] = {};
            idiomaBlock.querySelectorAll('.capitulo-row').forEach(capRow => {
                const capNombre = capRow.querySelector('.cap-nombre').value.trim();
                const capUrl = capRow.querySelector('.cap-url').value.trim();
                
                if (capNombre && capUrl) {
                    enlaces[idiomaNombre][capNombre] = capUrl;
                }
            });
            
            // Si el idioma se quedó vacío, lo borra para no subir basura a la BD
            if (Object.keys(enlaces[idiomaNombre]).length === 0) {
                delete enlaces[idiomaNombre];
            }
        });

        datos.push({ seccion, nombre, imagen, enlaces });
    });
    return datos;
}

function cargarDatosTemporadas(temporadas) {
    document.getElementById('builder-temporadas').innerHTML = ''; // Limpiar panel
    if (!temporadas || temporadas.length === 0) {
        agregarTemporadaUI(); // Empezar con uno vacío
        return;
    }
    temporadas.forEach(temp => agregarTemporadaUI(temp));
}

// Nueva función para limpiar el panel cuando clickeas "Añadir Obra"
function prepararNuevoRegistro() {
    delete document.getElementById('vista-registro').dataset.editId;
    document.getElementById('btn-publicar').textContent = "Publicar en el Hub";
    
    // Limpiar inputs
    document.querySelectorAll('#vista-registro input, #vista-registro select, #vista-registro textarea').forEach(i => i.value = '');
    
    // Iniciar con un constructor limpio
    cargarDatosTemporadas([]); 
    cambiarVista('registro');
}

// Arrancar al cargar la página
document.addEventListener('DOMContentLoaded', inicializarApp);