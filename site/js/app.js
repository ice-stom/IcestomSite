import { api, claimToken, openStream } from './api.js';
import { byId, toast } from './dom.js';
import { createBuildPane } from './build.js';
import { createRunPane } from './run.js';

const gate = byId('gate');
const gateMessage = byId('gate-message');
const app = byId('app');
const statusSession = byId('status-session');
const statusLink = byId('status-link');

let bootstrap = null;
let state = { events: [], players: [] };

const ctx = {
    getBootstrap: () => bootstrap,
    getState: () => state,
    refreshBootstrap,
    openInBuilder: (definition) => {
        selectTab('build');
        build.open(definition);
    },
};

const run = createRunPane(ctx);
const build = createBuildPane(ctx);

function selectTab(name) {
    for (const tab of document.querySelectorAll('.tab')) {
        tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
    }

    byId('pane-run').hidden = name !== 'run';
    byId('pane-build').hidden = name !== 'build';
}

for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
}

function renderSession() {
    if (!bootstrap) return;

    const expires = new Date(bootstrap.session.expiresAt);
    const minutes = Math.round((expires.getTime() - Date.now()) / 60000);

    const remaining = minutes <= 0
        ? 'link expired'
        : minutes < 60
            ? `${minutes} min left`
            : `${Math.floor(minutes / 60)} h ${minutes % 60} min left`;

    statusSession.textContent =
        `${bootstrap.session.owner} · IceStom ${bootstrap.server.version ?? '?'} · ${remaining}`;
}

function setLive(live) {
    statusLink.classList.toggle('is-live', live);
    statusLink.textContent = live ? 'Live' : 'Reconnecting…';
}

async function refreshBootstrap() {
    bootstrap = await api.bootstrap();
    renderSession();
    run.render();
    build.render();
}

function fail(message) {
    gateMessage.textContent = message;
    gateMessage.classList.add('is-error');
}

async function start() {
    if (!claimToken()) {
        fail('This page needs a panel link. Run /panel in game to get one.');
        return;
    }

    try {
        await refreshBootstrap();
    } catch (error) {
        fail(error.status === 401
            ? 'That link has expired or was already replaced. Run /panel in game for a new one.'
            : `Could not reach the server: ${error.message}`);
        return;
    }

    gate.hidden = true;
    app.hidden = false;

    selectTab('run');

    setInterval(renderSession, 30000);

    openStream({
        onOpen: () => setLive(true),
        onError: () => setLive(false),
        onState: (next) => {
            state = next;
            setLive(true);
            run.render();
        },
    });

    try {
        state = await api.state();
        run.render();
    } catch (error) {
        toast(error.message, 'error');
    }
}

start();
