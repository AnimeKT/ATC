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

function prepararNuevoRegistro() {
    const vista = document.getElementById('vista-registro');
    delete vista.dataset.editId;
    
    document.getElementById('btn-publicar').textContent = "Publicar en el Hub";
    
    // Limpiar todos los inputs y textareas
    vista.querySelectorAll('input, select, textarea').forEach(i => i.value = '');
    
    // Reiniciar el constructor de temporadas
    cargarDatosTemporadas([]); 
    cambiarVista('registro');
}

function prepararEdicion() {
    if (!obraActual) return;
    
    const vista = document.getElementById('vista-registro');
    vista.dataset.editId = obraActual.id;
    document.getElementById('btn-publicar').textContent = "Actualizar Anime en el Hub";

    // Mapeo de campos básicos
    const campos = {
        'in-titulo': obraActual.titulo,
        'in-estado': obraActual.estado || 'En emisión',
        'in-portada': obraActual.portada_url,
        'in-banner': obraActual.banner_url,
        'in-sinopsis': obraActual.sinopsis,
        'in-japones': obraActual.nombres_alternativos?.Japonés,
        'in-ingles': obraActual.nombres_alternativos?.Ingles,
        'in-generos': (obraActual.generos || []).join(', '),
        'in-autor': obraActual.autor,
        'in-estudio': obraActual.estudio,
        'in-tipo': obraActual.tipo || 'TV',
        'in-origen': obraActual.origen,
        'in-estreno': obraActual.estreno,
        'in-dia': obraActual.dia_emision
    };

    for (let id in campos) {
        const el = document.getElementById(id);
        if (el) el.value = campos[id] || '';
    }

    cargarDatosTemporadas(obraActual.temporadas || []);
    cambiarVista('registro');
}

async function ejecutarRegistro() {
    const btn = document.getElementById('btn-publicar');
    const vista = document.getElementById('vista-registro');
    const idEdicion = vista.dataset.editId;

    // Recolección de datos básicos
    const titulo = document.getElementById('in-titulo').value.trim();
    const portada = document.getElementById('in-portada').value.trim();

    if (!titulo || !portada) {
        tg.HapticFeedback.notificationOccurred('error');
        return alert("⚠️ Título y Portada son obligatorios.");
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${idEdicion ? 'Actualizando...' : 'Publicando...'}`;

    const generosRaw = document.getElementById('in-generos').value;
    const datosObra = {
        titulo: titulo,
        slug: titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"),
        portada_url: portada,
        banner_url: document.getElementById('in-banner').value.trim(),
        sinopsis: document.getElementById('in-sinopsis').value.trim(),
        estado: document.getElementById('in-estado').value,
        tipo: document.getElementById('in-tipo').value,
        autor: document.getElementById('in-autor').value.trim(),
        estudio: document.getElementById('in-estudio').value.trim(),
        origen: document.getElementById('in-origen').value,
        estreno: document.getElementById('in-estreno').value.trim(),
        dia_emision: document.getElementById('in-dia').value,
        generos: generosRaw.split(',').map(g => g.trim()).filter(g => g !== ""),
        nombres_alternativos: {
            "Japonés": document.getElementById('in-japones').value.trim(),
            "Ingles": document.getElementById('in-ingles').value.trim()
        },
        temporadas: recolectarDatosTemporadas()
    };

    try {
        const { error } = idEdicion 
            ? await _supabase.from('obras').update(datosObra).eq('id', idEdicion)
            : await _supabase.from('obras').insert([datosObra]);

        if (error) throw error;

        tg.HapticFeedback.notificationOccurred('success');
        alert(idEdicion ? "✅ Actualizado correctamente" : "✅ Publicado en el Hub");
        
        cargarObras(); // Refrescar catálogo
        cambiarVista('catalogo');
    } catch (err) {
        console.error(err);
        alert("❌ Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Publicar en el Hub";
    }
}

function cargarDatosTemporadas(temporadas) {
    const contenedor = document.getElementById('builder-temporadas');
    contenedor.innerHTML = '';
    
    if (!temporadas || temporadas.length === 0) {
        agregarTemporadaUI();
    } else {
        temporadas.forEach(t => agregarTemporadaUI(t));
    }
}

function agregarTemporadaUI(datos = null) {
    const container = document.getElementById('builder-temporadas');
    const tempDiv = document.createElement('div');
    tempDiv.className = 'temporada-block';
    
    // El botón de eliminar ahora está integrado en el header del bloque
    tempDiv.innerHTML = `
        <div class="header-bloque-dinamico">
            <input type="text" class="temp-nombre" placeholder="Nombre de la Temporada (Ej: Temporada 1)" value="${datos ? datos.nombre : ''}">
            <button type="button" class="btn-delete-block" onclick="this.closest('.temporada-block').remove()">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        <div class="input-group">
            <label>URL Imagen Miniatura (Opcional)</label>
            <input type="text" class="temp-imagen" placeholder="URL de imagen para esta temporada" value="${datos ? datos.imagen : ''}">
        </div>
        <div class="idiomas-wrapper">
            </div>
        <button type="button" class="btn-add-idioma" onclick="agregarIdiomaUI(this.previousElementSibling)">
            <i class="fa-solid fa-plus"></i> Añadir Idioma/Servidor
        </button>
    `;

    container.appendChild(tempDiv);

    if (datos && datos.enlaces) {
        const wrapper = tempDiv.querySelector('.idiomas-wrapper');
        for (const idioma in datos.enlaces) {
            agregarIdiomaUI(wrapper, { nombre: idioma, caps: datos.enlaces[idioma] });
        }
    } else {
        agregarIdiomaUI(tempDiv.querySelector('.idiomas-wrapper'));
    }
}

function agregarIdiomaUI(container, nombre = '', caps = null) {
    const div = document.createElement('div');
    div.className = 'idioma-bloque';
    div.innerHTML = `
        <div class="header-bloque-dinamico">
            <input type="text" class="idioma-nombre" placeholder="Ej: Sub Español" value="${nombre}">
            <button type="button" class="btn-delete-mini" onclick="this.closest('.idioma-bloque').remove()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="lista-capitulos"></div>
        <button type="button" class="btn-add-micro" onclick="agregarCapituloUI(this.parentElement.querySelector('.lista-capitulos'))">
            + Capítulo
        </button>
    `;

    container.appendChild(div);
    const listaCaps = div.querySelector('.lista-capitulos');

    if (caps) {
        Object.entries(caps).forEach(([n, u]) => agregarCapituloUI(listaCaps, n, u));
    } else {
        agregarCapituloUI(listaCaps);
    }
}

function agregarCapituloUI(container, num = '', url = '') {
    const div = document.createElement('div');
    div.className = 'capitulo-row';
    div.innerHTML = `
        <input type="text" class="cap-nombre" placeholder="N°" value="${num}">
        <input type="text" class="cap-url" placeholder="URL de Telegram/Web" value="${url}">
        <button type="button" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>
    `;
    container.appendChild(div);
}

function recolectarDatosTemporadas() {
    const resultado = [];
    document.querySelectorAll('.temporada-block').forEach(tBlock => {
        const nombre = tBlock.querySelector('.temp-nombre').value.trim();
        if (!nombre) return;

        const temporada = {
            nombre: nombre,
            imagen: tBlock.querySelector('.temp-img').value.trim(),
            enlaces: {}
        };

        tBlock.querySelectorAll('.idioma-bloque').forEach(iBlock => {
            const lang = iBlock.querySelector('.idioma-nombre').value.trim();
            if (!lang) return;

            temporada.enlaces[lang] = {};
            iBlock.querySelectorAll('.capitulo-row').forEach(cRow => {
                const n = cRow.querySelector('.cap-nombre').value.trim();
                const u = cRow.querySelector('.cap-url').value.trim();
                if (n && u) temporada.enlaces[lang][n] = u;
            });
        });

        resultado.push(temporada);
    });
    return resultado;
}

function confirmarBorrado(btn, selector) {
    tg.HapticFeedback.impactOccurred('medium');
    if(confirm("¿Estás seguro de borrar este elemento?")) {
        btn.closest(selector).remove();
    }
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

//////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////

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
    
    // Creamos un elemento real en el DOM en lugar de sumar strings
    const bloque = document.createElement('div');
    bloque.className = 'temporada-block';
    bloque.style.border = "1px solid #27272a";
    bloque.style.padding = "15px";
    bloque.style.borderRadius = "8px";
    bloque.style.marginBottom = "15px";
    bloque.style.background = "#18181b";

    // Insertamos la estructura base del bloque
    bloque.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <input type="text" class="temp-nombre" placeholder="Nombre de Sección (Ej: Principal, Extras)" value="${datos ? datos.nombre || datos.seccion || '' : ''}" style="width: 80%; padding: 10px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white; outline: none;">
            <button type="button" class="btn-cerrar" onclick="this.closest('.temporada-bloque').remove()" style="background: #ef4444; color: white; padding: 10px 15px; border-radius: 6px; border: none; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
        </div>
        <input type="text" class="temp-img" placeholder="URL de Imagen para esta sección (Opcional)" value="${datos && datos.imagen ? datos.imagen : ''}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white; outline: none; margin-bottom: 15px;">
        
        <div class="idiomas-container">
            <h4 style="color: #a1a1aa; margin-bottom: 10px; font-size: 14px;"><i class="fa-solid fa-language"></i> Idiomas Disponibles</h4>
            <div class="lista-idiomas" style="display: flex; flex-direction: column; gap: 10px;"></div>
            <button type="button" class="btn-filtro" onclick="agregarIdiomaUI(this.closest('.temporada-bloque').querySelector('.lista-idiomas'))" style="margin-top: 10px; padding: 8px 15px; font-size: 13px;">
                <i class="fa-solid fa-plus"></i> Añadir Idioma
            </button>
        </div>
    `;

    // Lo añadimos de forma segura sin afectar a los demás bloques
    container.appendChild(bloque);

    const listaIdiomas = bloque.querySelector('.lista-idiomas');

    // Si estamos editando y vienen datos de la base de datos, los reconstruimos
    if (datos && datos.enlaces && Object.keys(datos.enlaces).length > 0) {
        Object.entries(datos.enlaces).forEach(([idioma, capitulos]) => {
            agregarIdiomaUI(listaIdiomas, idioma, capitulos);
        });
    } else {
        // Si es un bloque nuevo, le ponemos un idioma vacío para empezar
        agregarIdiomaUI(listaIdiomas);
    }
}

function agregarIdiomaUI(containerLista, nombreIdioma = '', capitulos = null) {
    const divIdioma = document.createElement('div');
    divIdioma.className = 'idioma-bloque';
    divIdioma.style.padding = "10px";
    divIdioma.style.background = "#0c0c0f";
    divIdioma.style.border = "1px solid #27272a";
    divIdioma.style.borderRadius = "6px";

    divIdioma.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="text" class="idioma-nombre" placeholder="Ej: Sub Español, Latino, Castellano" value="${nombreIdioma}" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; outline: none;">
            <button type="button" onclick="this.closest('.idioma-bloque').remove()" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; padding: 8px 12px; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="lista-capitulos" style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px; border-left: 2px solid #27272a; padding-left: 10px;"></div>
        <button type="button" onclick="agregarCapituloUI(this.closest('.idioma-bloque').querySelector('.lista-capitulos'))" style="margin-top: 10px; margin-left: 10px; padding: 6px 12px; background: transparent; border: 1px dashed #3ba4fa; color: #3ba4fa; border-radius: 6px; cursor: pointer; font-size: 12px;">
            + Añadir Capítulo
        </button>
    `;

    containerLista.appendChild(divIdioma);
    
    const listaCaps = divIdioma.querySelector('.lista-capitulos');

    if (capitulos && Object.keys(capitulos).length > 0) {
        Object.entries(capitulos).forEach(([capNombre, capUrl]) => {
            agregarCapituloUI(listaCaps, capNombre, capUrl);
        });
    } else {
        agregarCapituloUI(listaCaps);
    }
}

function agregarCapituloUI(containerCaps, capNombre = '', capUrl = '') {
    const divCap = document.createElement('div');
    divCap.className = 'capitulo-row';
    divCap.style.display = "flex";
    divCap.style.gap = "8px";

    divCap.innerHTML = `
        <input type="text" class="cap-nombre" placeholder="N° / Nombre" value="${capNombre}" style="width: 35%; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; font-size: 13px; outline: none;">
        <input type="text" class="cap-url" placeholder="Enlace (https://...)" value="${capUrl}" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; font-size: 13px; outline: none;">
        <button type="button" onclick="this.closest('.capitulo-row').remove()" style="background: transparent; color: #a1a1aa; border: none; cursor: pointer; padding: 0 5px;"><i class="fa-solid fa-trash"></i></button>
    `;
    
    containerCaps.appendChild(divCap);
}

function recolectarDatosTemporadas() {
    const datos = [];
    // Asegúrate de que la clase aquí coincida con la que creas en el UI
    document.querySelectorAll('.temporada-block').forEach(tempBlock => {
        const nombre = tempBlock.querySelector('.temp-nombre').value.trim();
        const imagen = tempBlock.querySelector('.temp-img').value.trim(); // Cambiado de temp-imagen a temp-img

        if (!nombre) return; 

        const enlaces = {};
        tempBlock.querySelectorAll('.idioma-bloque').forEach(idiomaBlock => {
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
        });

        datos.push({ nombre, imagen, enlaces });
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