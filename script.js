document.addEventListener('DOMContentLoaded', () => {
    const fileExplorer = document.getElementById('file-explorer');
    const newFolderBtn = document.getElementById('new-folder-btn');
    const breadcrumbs = document.getElementById('breadcrumbs');

    // Modal elements
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalInput = document.getElementById('modal-input');
    let modalConfirmBtn = document.getElementById('modal-confirm-btn'); // Changed to let
    const closeBtn = document.querySelector('.close-btn');

    let currentPath = '/';
    let fileSystem = {};

    // --- Data Management ---
    function getFileSystem() {
        const fs = localStorage.getItem('shareplaceFS');
        return fs ? JSON.parse(fs) : { '/': { type: 'folder', children: {} } };
    }

    function saveFileSystem() {
        localStorage.setItem('shareplaceFS', JSON.stringify(fileSystem));
    }

    function getItemByPath(path) {
        const parts = path.split('/').filter(p => p);
        let current = fileSystem['/'];
        for (const part of parts) {
            if (current && current.type === 'folder' && current.children[part]) {
                current = current.children[part];
            } else {
                return null; // Not found
            }
        }
        return current;
    }

    // --- UI Rendering ---
    function render() {
        fileExplorer.innerHTML = '';
        const currentFolder = getItemByPath(currentPath);

        if (!currentFolder || currentFolder.type !== 'folder') {
            console.error("Cannot render: path not found or not a folder", currentPath);
            currentPath = '/'; // Reset to root if path is invalid
            render();
            return;
        }

        // Sort items: folders first, then files, alphabetically
        const items = Object.entries(currentFolder.children).sort((a, b) => {
            const a_is_folder = a[1].type === 'folder';
            const b_is_folder = b[1].type === 'folder';
            if (a_is_folder !== b_is_folder) {
                return a_is_folder ? -1 : 1;
            }
            return a[0].localeCompare(b[0]);
        });

        for (const [name, item] of items) {
            const itemEl = document.createElement('div');
            itemEl.className = 'item';
            itemEl.dataset.name = name;

            const icon = document.createElement('div');
            icon.className = 'icon';
            icon.textContent = item.type === 'folder' ? '📁' : '📄';

            const nameEl = document.createElement('div');
            nameEl.className = 'name';
            nameEl.textContent = name;

            itemEl.appendChild(icon);
            itemEl.appendChild(nameEl);
            fileExplorer.appendChild(itemEl);
        }
        updateBreadcrumbs();
    }

    function updateBreadcrumbs() {
        breadcrumbs.innerHTML = '';
        const parts = currentPath.split('/').filter(p => p);
        let path = '/';

        const rootLink = document.createElement('a');
        rootLink.href = '#';
        rootLink.textContent = 'Root';
        rootLink.onclick = (e) => {
            e.preventDefault();
            currentPath = '/';
            render();
        };
        breadcrumbs.appendChild(rootLink);

        for (const part of parts) {
            path += part + '/';
            const separator = document.createTextNode(' / ');
            breadcrumbs.appendChild(separator);

            const link = document.createElement('a');
            link.href = '#';
            link.textContent = part;
            const capturedPath = path;
            link.onclick = (e) => {
                e.preventDefault();
                currentPath = capturedPath;
                render();
            };
            breadcrumbs.appendChild(link);
        }
    }


    // --- Modal Logic ---
    function showModal(title, placeholder, confirmText, onConfirm) {
        modalTitle.textContent = title;
        modalInput.placeholder = placeholder;
        modalInput.value = '';
        modalConfirmBtn.textContent = confirmText;

        // Clone and replace the button to remove old event listeners
        const newConfirmBtn = modalConfirmBtn.cloneNode(true);
        modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
        modalConfirmBtn = newConfirmBtn; // Re-assign the new button

        modalConfirmBtn.onclick = () => {
            onConfirm(modalInput.value);
            hideModal();
        };

        modal.classList.remove('hidden');
        modalInput.focus();
    }

    function hideModal() {
        modal.classList.add('hidden');
    }

    // --- Event Listeners ---
    newFolderBtn.addEventListener('click', () => {
        showModal('新規フォルダ作成', 'フォルダ名', '作成', (folderName) => {
            if (folderName) {
                const currentFolder = getItemByPath(currentPath);
                if (currentFolder && currentFolder.children[folderName] === undefined) {
                    currentFolder.children[folderName] = { type: 'folder', children: {} };
                    saveFileSystem();
                    render();
                } else {
                    alert('同じ名前のフォルダが既に存在します。');
                }
            }
        });
    });

    fileExplorer.addEventListener('dblclick', (e) => {
        const itemEl = e.target.closest('.item');
        if (itemEl) {
            const itemName = itemEl.dataset.name;
            const item = getItemByPath(currentPath).children[itemName];
            if (item.type === 'folder') {
                currentPath += itemName + '/';
                render();
            }
        }
    });

    // --- Context Menu ---
    let contextMenu = null;

    function showContextMenu(x, y, itemName) {
        hideContextMenu(); // Hide any existing menu

        contextMenu = document.createElement('div');
        contextMenu.id = 'context-menu';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;

        const ul = document.createElement('ul');
        const renameLi = document.createElement('li');
        renameLi.textContent = '名前の変更';
        renameLi.onclick = () => {
            hideContextMenu();
            const currentItem = getItemByPath(currentPath).children[itemName];
            showModal('名前の変更', '新しい名前', '変更', (newName) => {
                if (newName && newName !== itemName) {
                    renameItem(itemName, newName);
                }
            });
            // Pre-fill the input with the old name
            document.getElementById('modal-input').value = itemName;
        };

        const deleteLi = document.createElement('li');
        deleteLi.textContent = '削除';
        deleteLi.onclick = () => {
            hideContextMenu();
            if (confirm(`'${itemName}'を本当に削除しますか？`)) {
                deleteItem(itemName);
            }
        };

        ul.appendChild(renameLi);
        ul.appendChild(deleteLi);
        contextMenu.appendChild(ul);
        document.body.appendChild(contextMenu);
    }

    function hideContextMenu() {
        if (contextMenu) {
            contextMenu.remove();
            contextMenu = null;
        }
    }

    // --- Core Logic ---
    function renameItem(oldName, newName) {
        const currentFolder = getItemByPath(currentPath);
        if (currentFolder.children[newName]) {
            alert('同じ名前のアイテムが既に存在します。');
            return;
        }
        currentFolder.children[newName] = currentFolder.children[oldName];
        delete currentFolder.children[oldName];
        saveFileSystem();
        render();
    }

    function deleteItem(name) {
        const currentFolder = getItemByPath(currentPath);
        delete currentFolder.children[name];
        saveFileSystem();
        render();
    }

    // --- Event Listeners ---
    fileExplorer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const itemEl = e.target.closest('.item');
        if (itemEl) {
            const itemName = itemEl.dataset.name;
            showContextMenu(e.pageX, e.pageY, itemName);
        }
    });

    closeBtn.addEventListener('click', hideModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
        // Hide context menu if clicking outside of it
        if (contextMenu && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    // --- Initialization ---
    function init() {
        fileSystem = getFileSystem();
        render();
    }

    init();
});
