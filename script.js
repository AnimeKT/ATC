const SUPABASE_URL = "https://urmnngtfoavnmvbwqepq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybW5uZ3Rmb2F2bm12YndxZXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTE4NzcsImV4cCI6MjA5MTI4Nzg3N30.HnfoffLftMYWt2ZEkv1YEbG0vqRPWjB5IeQunj2I5cs";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tg = window.Telegram.WebApp;
let todasLasObras = [];

async function inicializarApp() {
    await cargarObras();
}

function cambiarVista(vista) {
    document.getElementById('vista-catalogo').style.display = vista === 'catalogo' ? 'block' : 'none';
    document.getElementById('vista-registro').style.display = vista === 'registro' ? 'block' : 'none';
    document.getElementById('barra-busqueda').style.display = vista === 'catalogo' ? 'block' : 'none';
}

function prepararNuevoRegistro() {
    // Limpiamos todo rastro de IDs o datos previos
    document.querySelectorAll('#vista-registro input').forEach(i => i.value = '');
    document.getElementById('builder-temporadas').innerHTML = '';
    agregarTemporadaUI(); 
    cambiarVista('registro');
}

async function cargarObras() {
    const { data, error } = await _supabase.from('obras').select('*').order('fecha_creacion', { ascending: false });
    if (data) {
        todasLasObras = data;
        renderizarObras(data);
    }
}

function renderizarObras(obras) {
    const grid = document.getElementById('grid-obras');
    grid.innerHTML = obras.map(obra => `
        <div class="tarjeta-anime">
            <img src="${obra.portada_url}">
            <div class="info-tarjeta">
                <div class="titulo-tarjeta">${obra.titulo}</div>
            </div>
        </div>
    `).join('');
}

function agregarTemporadaUI() {
    const container = document.getElementById('builder-temporadas');
    const div = document.createElement('div');
    div.className = 'temporada-block';
    div.style.background = "#18181b";
    div.style.padding = "15px";
    div.style.marginBottom = "10px";
    div.style.border = "1px solid #27272a";
    div.style.borderRadius = "8px";

    div.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="text" class="temp-nombre" placeholder="Nombre (Ej: Temporada 1)" style="flex: 1; padding: 8px; background: #0f0f11; border: 1px solid #333; color: #fff;">
            <button onclick="this.closest('.temporada-block').remove()" style="background: #ef4444; color: #fff; border: none; padding: 5px 10px; border-radius: 4px;">X</button>
        </div>
        <div class="lista-capitulos"></div>
        <button onclick="agregarCapituloUI(this.previousElementSibling)" style="width: 100%; margin-top: 10px; background: transparent; border: 1px dashed #3ba4fa; color: #3ba4fa; padding: 5px;">+ Añadir Capítulo</button>
    `;
    container.appendChild(div);
}

function agregarCapituloUI(container) {
    const div = document.createElement('div');
    div.className = 'capitulo-row';
    div.style.display = "flex";
    div.style.gap = "5px";
    div.style.marginTop = "5px";
    div.innerHTML = `
        <input type="text" class="cap-nombre" placeholder="N°" style="width: 50px; background: #0f0f11; border: 1px solid #333; color: #fff; padding: 5px;">
        <input type="text" class="cap-url" placeholder="URL Telegram" style="flex: 1; background: #0f0f11; border: 1px solid #333; color: #fff; padding: 5px;">
    `;
    container.appendChild(div);
}

async function ejecutarRegistro() {
    const btn = document.getElementById('btn-publicar');
    const titulo = document.getElementById('in-titulo').value;
    const portada = document.getElementById('in-portada').value;

    if (!titulo || !portada) return alert("Faltan datos");

    btn.disabled = true;
    btn.textContent = "Publicando...";

    const seasons = [];
    document.querySelectorAll('.temporada-block').forEach(b => {
        const name = b.querySelector('.temp-nombre').value;
        const links = {};
        b.querySelectorAll('.capitulo-row').forEach(r => {
            const n = r.querySelector('.cap-nombre').value;
            const u = r.querySelector('.cap-url').value;
            if(n && u) links[n] = u;
        });
        seasons.push({ nombre: name, enlaces: { "Principal": links } });
    });

    const { error } = await _supabase.from('obras').insert([{
        titulo: titulo,
        portada_url: portada,
        estado: document.getElementById('in-estado').value,
        tipo: document.getElementById('in-tipo').value,
        temporadas: seasons
    }]);

    if (!error) {
        alert("¡Publicado!");
        cargarObras();
        cambiarVista('catalogo');
    }
    btn.disabled = false;
    btn.textContent = "Publicar";
}

document.addEventListener('DOMContentLoaded', inicializarApp);