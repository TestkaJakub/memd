const sidebar = document.getElementById('sidebar');
const toggle = document.getElementById('toggle');
const floatingToggle = document.getElementById('floating-toggle');
const resizer = document.getElementById('resizer');
const fileList = document.getElementById('file-list');
const content = document.getElementById('content');
const search = document.getElementById('search');

let allFiles = [];
const expanded = new Set();
marked.use({
    renderer: (() => {
        const renderer = new marked.Renderer();
        renderer.code = ({ text, lang }) => {
            if (typeof hljs === 'undefined') {
                return `<pre><code>${text}</code></pre>`;
            }
            const language =
                lang && hljs.getLanguage(lang) ? lang : 'plaintext';
            const highlighted = hljs.highlight(text, { language }).value;
            return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
        };
        return renderer;
    })(),
});

function toggleSidebar() {
    sidebar.classList.toggle('hidden');
    floatingToggle.style.display = sidebar.classList.contains('hidden')
        ? 'block'
        : 'none';
}

toggle.addEventListener('click', toggleSidebar);
floatingToggle.addEventListener('click', toggleSidebar);
floatingToggle.style.display = 'none';


resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (e) => {
        const newWidth = e.clientX;
        const min = parseInt(getComputedStyle(sidebar).minWidth);
        const max = parseInt(getComputedStyle(sidebar).maxWidth);
        if (newWidth >= min && newWidth <= max) {
            sidebar.style.width = `${newWidth}px`;
        }
    };

    const onMouseUp = () => {
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});

search.addEventListener('input', () => {
    const query = search.value.toLowerCase().trim();
    const filtered = query
        ? allFiles.filter((f) => f.toLowerCase().includes(query))
        : allFiles;

    renderTree(buildTree(filtered), fileList, '');
    restoreActive();
});

function restoreActive() {
    const active = getHash();
    if (!active) return;
    document.querySelectorAll('#file-list li:not(.dir)').forEach((li) => {
        if (li.dataset.path === active) li.classList.add('active');
    });
}

function setHash(path) {
    location.hash = encodeURIComponent(path);
}

function getHash() {
    return location.hash
        ? decodeURIComponent(location.hash.slice(1))
        : null;
}

window.addEventListener('hashchange', () => {
    const path = getHash();
    if (path) openFile(path);
});

function buildTree(files) {
    const tree = {};
    files.forEach((path) => {
        const parts = path.split('/');
        let node = tree;
        parts.forEach((part, i) => {
            if (i === parts.length - 1) {
                if (!node.__files) node.__files = [];
                node.__files.push(path);
            } else {
                if (!node[part]) node[part] = {};
                node = node[part];
            }
        });
    });
    return tree;
}

function renderTree(node, container, prefixKey) {
    container.innerHTML = '';

    (node.__files || []).forEach((path) => {
        const parts = path.split('/');
        const name = parts[parts.length - 1].replace(/\.md$/, '');
        const li = document.createElement('li');
        li.textContent = name;
        li.title = name;
        li.dataset.path = path;
        li.addEventListener('click', () => {
            setHash(path);
            openFile(path, li);
        });
        container.appendChild(li);
    });

    Object.keys(node).forEach((key) => {
        if (key === '__files') return;

        const folderKey = prefixKey ? `${prefixKey}/${key}` : key;
        const isCollapsed = !expanded.has(folderKey);

        const li = document.createElement('li');
        li.classList.add('dir');

        const label = document.createElement('span');
        label.textContent = `${isCollapsed ? '📂' : '📁'} ${key}`;
        label.title = key;
        li.appendChild(label);

        const ul = document.createElement('ul');
        ul.style.display = isCollapsed ? 'none' : 'block';
        renderTree(node[key], ul, folderKey);

        label.addEventListener('click', () => {
            const nowCollapsed = ul.style.display !== 'none';
            ul.style.display = nowCollapsed ? 'none' : 'block';
            label.textContent = `${nowCollapsed ? '📂' : '📁'} ${key}`;
            if (nowCollapsed) {
                expanded.delete(folderKey);
            } else {
                expanded.add(folderKey);
            }
        });

        li.appendChild(ul);
        container.appendChild(li);
    });
}

async function openFile(path, el) {
    document.querySelectorAll('#file-list li:not(.dir)').forEach((li) => {
        li.classList.remove('active');
    });

    if (!el) {
        el = document.querySelector(
            `#file-list li[data-path="${CSS.escape(path)}"]`
        );
    }

    if (el) el.classList.add('active');

    let res;
    try {
        res = await fetch(`/api/file?name=${encodeURIComponent(path)}`);
    } catch (err) {
        content.innerHTML = `<p class="error">Network error: ${err.message}</p>`;
        return;
    }

    if (!res.ok) {
        content.innerHTML = `<p class="error">File not found: ${path}</p>`;
        return;
    }

    const text = await res.text();
    const dirty = marked.parse(text);
    content.innerHTML = DOMPurify.sanitize(dirty);
    content.scrollTop = 0;
    document.title = `memd — ${path.replace(/\.md$/, '')}`;
}

async function loadFiles() {
    let res;
    try {
        res = await fetch('/api/files');
    } catch (err) {
        fileList.innerHTML = `<li class="error">Cannot load files: ${err.message}</li>`;
        return;
    }

    if (!res.ok) {
        fileList.innerHTML = `<li class="error">Server error: ${res.status}</li>`;
        return;
    }

    allFiles = (await res.json()) || [];
    renderTree(buildTree(allFiles), fileList, '');

    const hash = getHash();
    if (hash) openFile(hash);
}

loadFiles();
