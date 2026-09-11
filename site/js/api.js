let token = null;

export function claimToken() {
    const fragment = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';

    if (fragment) {
        token = fragment;

        window.history.replaceState(null, '', window.location.pathname);
    }

    return token;
}

export function hasToken() {
    return Boolean(token);
}

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

async function request(method, path, body) {
    const response = await fetch(`/api/${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
    });

    if (response.status === 204) return null;

    const text = await response.text();
    let payload = null;

    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        throw new ApiError(`Unexpected reply from the server (${response.status})`, response.status);
    }

    if (!response.ok) {
        throw new ApiError(payload?.error || `Request failed (${response.status})`, response.status);
    }

    return payload;
}

export const api = {
    bootstrap: () => request('GET', 'bootstrap'),
    state: () => request('GET', 'state'),

    readDefinition: (name) => request('GET', `definitions/${encodeURIComponent(name)}`),
    saveDefinition: (name, document) => request('POST', 'definitions', { name, document }),
    deleteDefinition: (name) => request('DELETE', `definitions/${encodeURIComponent(name)}`),

    runEvent: (definition, participants) => request('POST', 'events', { definition, participants }),
    cancelEvent: (id) => request('DELETE', `events/${encodeURIComponent(id)}`),
    transition: (id, stage, transition) =>
        request('POST', `events/${encodeURIComponent(id)}/transition`, { stage, transition }),
};

export function openStream({ onState, onOpen, onError }) {
    const source = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);

    source.addEventListener('open', () => onOpen?.());
    source.addEventListener('error', () => onError?.());
    source.addEventListener('state', (event) => {
        try {
            onState(JSON.parse(event.data));
        } catch (error) {
            console.error('Bad state frame', error);
        }
    });

    return source;
}

export { ApiError };
