export function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined || value === false) continue;

        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') throw new Error('Use text, not html');
        else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, value);
    }

    for (const child of [].concat(children)) {
        if (child === null || child === undefined || child === false) continue;

        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }

    return node;
}

export function byId(id) {
    const node = document.getElementById(id);

    if (!node) throw new Error(`Missing element #${id}`);

    return node;
}

export function replace(parent, children) {
    parent.replaceChildren(...[].concat(children).filter(Boolean));
}

export function empty(message) {
    return el('div', { class: 'empty', text: message });
}

let toastRoot = null;

export function toast(message, kind = '') {
    if (!toastRoot) toastRoot = byId('toasts');

    const node = el('div', { class: `toast ${kind ? `is-${kind}` : ''}`, text: message });

    toastRoot.append(node);

    setTimeout(() => node.remove(), kind === 'error' ? 8000 : 4000);
}

export function modal({ title, body, confirmLabel = 'Confirm' }) {
    const root = byId('modal');
    const confirm = byId('modal-confirm');
    const cancel = byId('modal-cancel');

    byId('modal-title').textContent = title;
    replace(byId('modal-body'), body);
    confirm.textContent = confirmLabel;

    root.hidden = false;

    return new Promise((resolve) => {
        const finish = (result) => {
            root.hidden = true;
            confirm.removeEventListener('click', onConfirm);
            cancel.removeEventListener('click', onCancel);
            root.removeEventListener('mousedown', onBackdrop);
            document.removeEventListener('keydown', onKey);
            resolve(result);
        };

        const onConfirm = () => finish(true);
        const onCancel = () => finish(false);
        const onBackdrop = (event) => { if (event.target === root) finish(false); };
        const onKey = (event) => { if (event.key === 'Escape') finish(false); };

        confirm.addEventListener('click', onConfirm);
        cancel.addEventListener('click', onCancel);
        root.addEventListener('mousedown', onBackdrop);
        document.addEventListener('keydown', onKey);
    });
}
